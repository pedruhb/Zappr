/* global window */
"use strict";

const { ipcRenderer, webFrame } = require("electron");


function injectMainWorldScripts() {
  const code = `
    (function() {
      // Chat opener helper
      if (typeof window.abrirChatComMensagem !== 'function') {
        window.abrirChatComMensagem = function(numero, mensagem = "") {
          let numeroLimpo = String(numero).replace(/\\D/g, '');
          if ((numeroLimpo.length === 10 || numeroLimpo.length === 11) && !numeroLimpo.startsWith('55')) {
            numeroLimpo = '55' + numeroLimpo;
          }
          const mensagemCodificada = encodeURIComponent(mensagem || '');
          const linkInvisivel = document.createElement('a');
          linkInvisivel.setAttribute('href', 'https://web.whatsapp.com/send?phone=' + numeroLimpo + '&text=' + mensagemCodificada);
          linkInvisivel.setAttribute('style', 'display:none;');
          document.body.appendChild(linkInvisivel);
          linkInvisivel.click();
          document.body.removeChild(linkInvisivel);
        };
      }

      // Zappr Audio Controller (intercepts HTMLMediaElement and AudioContext)
      if (window.__zapprAudioHooked) return;
      window.__zapprAudioHooked = true;

      window.__zapprInstanceVolume = typeof window.__zapprInstanceVolume === 'number' ? window.__zapprInstanceVolume : 1;
      window.__zapprInstanceMuted = Boolean(window.__zapprInstanceMuted);
      window.__zapprActiveAudioElements = window.__zapprActiveAudioElements || new Set();
      window.__zapprAudioContexts = window.__zapprAudioContexts || new Set();

      function getEffectiveFactor() {
        if (window.__zapprInstanceMuted) return 0;
        if (typeof window.__zapprInstanceVolume === 'number') {
          return Math.max(0, Math.min(1, window.__zapprInstanceVolume));
        }
        return 1;
      }

      // 1. Hook HTMLMediaElement.prototype.volume & muted
      const volDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume") || {};
      const origVolGet = volDesc.get;
      const origVolSet = volDesc.set;

      const mutedDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted") || {};
      const origMutedGet = mutedDesc.get;
      const origMutedSet = mutedDesc.set;

      window.__zapprOrigMedia = {
        origVolGet,
        origVolSet,
        origMutedGet,
        origMutedSet,
      };

      Object.defineProperty(HTMLMediaElement.prototype, "volume", {
        configurable: true,
        enumerable: true,
        get() {
          if (this.__zapprVirtualVolume !== undefined) {
            return this.__zapprVirtualVolume;
          }
          return origVolGet ? origVolGet.call(this) : 1;
        },
        set(val) {
          const num = Math.max(0, Math.min(1, Number(val) || 0));
          this.__zapprVirtualVolume = num;
          window.__zapprActiveAudioElements.add(this);
          const real = num * getEffectiveFactor();
          if (origVolSet) origVolSet.call(this, real);
        }
      });

      Object.defineProperty(HTMLMediaElement.prototype, "muted", {
        configurable: true,
        enumerable: true,
        get() {
          if (this.__zapprVirtualMuted !== undefined) {
            return this.__zapprVirtualMuted;
          }
          return origMutedGet ? origMutedGet.call(this) : false;
        },
        set(val) {
          const b = Boolean(val);
          this.__zapprVirtualMuted = b;
          window.__zapprActiveAudioElements.add(this);
          const real = b || window.__zapprInstanceMuted || getEffectiveFactor() === 0;
          if (origMutedSet) origMutedSet.call(this, real);
        }
      });

      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function(...args) {
        window.__zapprActiveAudioElements.add(this);
        const v = this.__zapprVirtualVolume !== undefined ? this.__zapprVirtualVolume : 1;
        const real = v * getEffectiveFactor();
        if (origVolSet) {
          try { origVolSet.call(this, real); } catch(_) {}
        }
        if (origMutedSet && (window.__zapprInstanceMuted || getEffectiveFactor() === 0)) {
          try { origMutedSet.call(this, true); } catch(_) {}
        }
        return origPlay.apply(this, args);
      };

      // Hook window.Audio constructor
      const origAudio = window.Audio;
      if (typeof origAudio === 'function') {
        window.Audio = function(...args) {
          const el = new origAudio(...args);
          window.__zapprActiveAudioElements.add(el);
          const factor = getEffectiveFactor();
          if (origVolSet) {
            try { origVolSet.call(el, (el.__zapprVirtualVolume !== undefined ? el.__zapprVirtualVolume : 1) * factor); } catch(_) {}
          }
          return el;
        };
        window.Audio.prototype = origAudio.prototype;
      }

      // 2. Hook Web Audio API (AudioContext)
      const origConnect = AudioNode.prototype.connect;
      window.__zapprOrigConnect = origConnect;

      function hookContext(NativeContext) {
        if (!NativeContext) return NativeContext;
        const Wrapped = function(...args) {
          const ctx = new NativeContext(...args);
          window.__zapprAudioContexts.add(ctx);
          try {
            const masterGain = ctx.createGain();
            masterGain.gain.value = getEffectiveFactor();
            origConnect.call(masterGain, ctx.destination);
            ctx.__zapprMasterGain = masterGain;
          } catch (_) {}
          return ctx;
        };
        Wrapped.prototype = NativeContext.prototype;
        return Wrapped;
      }

      AudioNode.prototype.connect = function(destination, outputIndex, inputIndex) {
        if (destination && destination instanceof AudioDestinationNode) {
          const ctx = destination.context;
          if (ctx && ctx.__zapprMasterGain && this !== ctx.__zapprMasterGain) {
            return origConnect.call(this, ctx.__zapprMasterGain, outputIndex, inputIndex);
          }
        }
        return origConnect.apply(this, arguments);
      };

      if (window.AudioContext) window.AudioContext = hookContext(window.AudioContext);
      if (window.webkitAudioContext) window.webkitAudioContext = hookContext(window.webkitAudioContext);

      // 3. Global update function
      window.__zapprUpdateVolume = function(volPercent, isMuted) {
        window.__zapprInstanceVolume = Math.max(0, Math.min(1, (Number(volPercent) || 0) / 100));
        window.__zapprInstanceMuted = Boolean(isMuted);
        const factor = getEffectiveFactor();

        const curVolSet = window.__zapprOrigMedia?.origVolSet;
        const curMutedSet = window.__zapprOrigMedia?.origMutedSet;

        document.querySelectorAll('audio, video').forEach((el) => {
          window.__zapprActiveAudioElements.add(el);
        });

        for (const el of window.__zapprActiveAudioElements) {
          try {
            const v = el.__zapprVirtualVolume !== undefined ? el.__zapprVirtualVolume : 1;
            if (curVolSet) {
              curVolSet.call(el, v * factor);
            } else {
              el.volume = v * factor;
            }
            if (curMutedSet) {
              if (window.__zapprInstanceMuted || factor === 0) {
                curMutedSet.call(el, true);
              } else if (el.__zapprVirtualMuted !== undefined) {
                curMutedSet.call(el, el.__zapprVirtualMuted);
              } else {
                curMutedSet.call(el, false);
              }
            } else if (window.__zapprInstanceMuted || factor === 0) {
              el.muted = true;
            }
          } catch (_) {}
        }

        for (const ctx of window.__zapprAudioContexts) {
          try {
            if (ctx && ctx.__zapprMasterGain) {
              ctx.__zapprMasterGain.gain.value = factor;
              try {
                ctx.__zapprMasterGain.gain.setValueAtTime(factor, ctx.currentTime);
              } catch (_) {}
            }
          } catch (_) {}
        }
      };
    })();
  `;

  try {
    webFrame.executeJavaScript(code);
  } catch {
    // webFrame error during window closure
  }
}

// Inject immediately so audio is intercepted before WhatsApp scripts run
injectMainWorldScripts();

function extractUnreadCount() {
  try {
    // 1. WhatsApp Web navbar item for "Conversas" / "Chats"
    const chatBtn = document.querySelector(
      'button[data-navbar-item-index="0"], ' +
        'button[aria-label="Conversas"], ' +
        'button[aria-label="Chats"], ' +
        'button[aria-label="Chats "], ' +
        'button[aria-label="Conversaciones"], ' +
        'button[data-navbar-item="true"]',
    );
    if (chatBtn && chatBtn.parentElement) {
      const statusSpan = chatBtn.parentElement.querySelector('[role="status"]');
      if (statusSpan) {
        const text = statusSpan.textContent.trim();
        const num = parseInt(text, 10);
        if (!isNaN(num) && num > 0) return num;
        if (text && text.length > 0) return text;
      }
    }

    // 2. Check title attribute in SVG icon
    const chatTitleSvg = document.querySelector("svg title");
    if (
      chatTitleSvg &&
      chatTitleSvg.textContent &&
      chatTitleSvg.textContent.includes("chat")
    ) {
      const container = chatTitleSvg.closest("button")?.parentElement;
      if (container) {
        const statusSpan = container.querySelector('[role="status"]');
        if (statusSpan) {
          const num = parseInt(statusSpan.textContent.trim(), 10);
          if (!isNaN(num) && num > 0) return num;
        }
      }
    }

    // 3. Fallback: document.title "(43) WhatsApp"
    if (document.title) {
      const match = document.title.match(/^\((\d+)\)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
  } catch {
    // DOM access error
  }
  return 0;
}

let lastSentUnreadCount = null;

function syncUnreadCount() {
  const currentCount = extractUnreadCount();
  if (currentCount !== lastSentUnreadCount) {
    lastSentUnreadCount = currentCount;
    try {
      ipcRenderer.send("session:unread-count", currentCount);
    } catch {
      // IPC send error during destruction
    }
  }
}

function extractPhoneFromText(str) {
  if (!str) return "";
  const intl = /\+[\d\s()–—-]{6,25}/.exec(str);
  if (intl) {
    const digits = intl[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 16) return digits;
  }
  const allDigits = str.replace(/\D/g, "");
  if (allDigits.length >= 10 && allDigits.length <= 16) {
    const letterCount = (str.match(/[a-zA-Z\u00C0-\u017F]/g) || []).length;
    if (letterCount <= 3) return allDigits;
  }
  return "";
}

function checkIfGroup(el) {
  if (!el) return false;

  const hdr = el.querySelector("header");
  if (hdr) {
    // 1. Explicit contact signals (cannot be a group)
    if (hdr.querySelector('[data-icon*="default-user"], [data-testid*="default-user"]')) {
      return false;
    }
    const hdrText = (hdr.textContent || "").toLowerCase();
    if (
      hdrText.includes("online") ||
      hdrText.includes("visto por") ||
      hdrText.includes("last seen")
    ) {
      return false;
    }

    // 2. Explicit group signals in header
    if (
      hdr.querySelector(
        '[data-icon*="group"], [data-testid*="group"], [data-icon*="community"], [data-testid*="community"]',
      )
    ) {
      return true;
    }
    if (
      hdrText.includes("dados do grupo") ||
      hdrText.includes("group info") ||
      hdrText.includes("informações do grupo") ||
      hdrText.includes("información del grupo") ||
      hdrText.includes("admin do grupo") ||
      hdrText.includes("group admin") ||
      hdrText.includes("somente admins") ||
      hdrText.includes("only admins") ||
      hdrText.includes("participantes") ||
      hdrText.includes("participants")
    ) {
      return true;
    }
    if (/(?:^|\s)(?:você|you|tú),\s/i.test(hdrText)) {
      return true;
    }
  }

  // 3. Active chat row in sidebar
  const selRow = document.querySelector(
    '#pane-side [aria-selected="true"], #pane-side div[role="listitem"].active, #pane-side div[role="row"][aria-selected="true"]',
  );
  if (selRow) {
    const rowId = selRow.getAttribute("data-id") || selRow.querySelector("[data-id]")?.getAttribute("data-id") || "";
    if (rowId.includes("@c.us") || rowId.includes("@s.whatsapp.net")) return false;
    if (rowId.includes("@g.us")) return true;
    if (
      selRow.querySelector(
        '[data-icon*="group"], [data-testid*="group"], [data-icon*="community"], [data-testid*="community"]',
      )
    ) {
      return true;
    }
    if (
      selRow.querySelector(
        '[data-icon*="default-user"], [data-testid*="default-user"]',
      )
    ) {
      return false;
    }
  }

  // 4. Message remoteJid check in #main
  const msgs = el.querySelectorAll('[data-id*="@c.us"], [data-id*="@g.us"], [data-id*="@s.whatsapp.net"]');
  for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 8); i--) {
    const dId = msgs[i].getAttribute("data-id") || "";
    if (/^(?:true|false)_\d+@(c\.us|s\.whatsapp\.net)/.test(dId)) {
      return false;
    }
    if (/^(?:true|false)_\d+@g\.us/.test(dId)) {
      return true;
    }
  }

  // 5. Footer admin notice
  const footer = el.querySelector("footer");
  if (footer) {
    const fTxt = (footer.textContent || "").toLowerCase();
    if (fTxt.includes("somente admins") || fTxt.includes("only admins")) {
      return true;
    }
  }

  return false;
}

function extractCurrentChatInfo() {
  try {
    const mainEl = document.querySelector("#main");
    if (!mainEl) {
      return { hasActiveChat: false, isGroup: false, phone: "", name: "", isRawPhone: false };
    }

    window.__zapprPhoneCache = window.__zapprPhoneCache || {};

    let phone = "";
    let name = "";
    let isRawPhone = false;

    const header = mainEl.querySelector("header");
    if (header) {
      const titleEl = header.querySelector(
        'span[dir="auto"][title], div[role="button"] span[title], span[title], h2, [data-testid="conversation-info-header"]',
      );
      if (titleEl) {
        name = (
          titleEl.getAttribute("title") ||
          titleEl.textContent ||
          ""
        ).trim();
      } else {
        const anySpan = header.querySelector('span[dir="auto"]');
        if (anySpan) name = anySpan.textContent.trim();
      }

      phone = extractPhoneFromText(name);
      if (phone) {
        isRawPhone = true;
      } else {
        const headerSpans = header.querySelectorAll("span");
        for (const s of headerSpans) {
          if (s.children.length > 2) continue;
          const found = extractPhoneFromText(s.textContent || "");
          if (found) {
            phone = found;
            isRawPhone = true;
            break;
          }
        }
      }
    }

    const isGroup = checkIfGroup(mainEl);

    if (!phone && name && window.__zapprPhoneCache[name]) {
      phone = window.__zapprPhoneCache[name];
    }

    const hasRealName = Boolean(name && /[a-zA-Z\u00C0-\u017F]{2,}/.test(name) && !name.includes("+"));
    if (!phone && !hasRealName && !isGroup) {
      const msgEls = mainEl.querySelectorAll(
        '[data-id*="@c.us"], [data-id*="@s.whatsapp.net"]',
      );
      for (let i = msgEls.length - 1; i >= 0; i--) {
        const dataId = msgEls[i].getAttribute("data-id") || "";
        const m = /^false_(\d{8,16})@(c\.us|s\.whatsapp\.net)/.exec(dataId);
        if (m && m[1]) {
          phone = m[1];
          isRawPhone = true;
          break;
        }
      }
    }

    if (!phone && !isGroup) {
      const drawer = document.querySelector(
        '[data-testid="contact-info-drawer"], [data-testid="chat-info-drawer"], [data-testid="drawer-right"]',
      );
      if (drawer) {
        const spans = drawer.querySelectorAll("span, div, p");
        for (const s of spans) {
          if (s.children.length > 2) continue;
          const found = extractPhoneFromText(s.textContent || "");
          if (found) {
            phone = found;
            if (name) window.__zapprPhoneCache[name] = found;
            break;
          }
        }
      }
    }

    return { hasActiveChat: true, isGroup, phone, name, isRawPhone };
  } catch {
    return {
      hasActiveChat: Boolean(document.querySelector("#main")),
      isGroup: false,
      phone: "",
      name: "",
      isRawPhone: false,
    };
  }
}

let lastChatStateJson = null;

function syncActiveChatState() {
  const current = extractCurrentChatInfo();
  const json = JSON.stringify(current);
  if (json !== lastChatStateJson) {
    lastChatStateJson = json;
    try {
      ipcRenderer.send("session:active-chat-changed", current);
    } catch {
      // IPC send error during destruction
    }
  }
}

function initUnreadTracker() {
  syncUnreadCount();
  syncActiveChatState();

  // Watch document.title mutations
  const titleEl = document.querySelector("title");
  if (titleEl) {
    const titleObs = new MutationObserver(() => {
      syncUnreadCount();
      syncActiveChatState();
    });
    titleObs.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // Watch body mutations (debounced)
  if (document.body) {
    let debounceTimer = null;
    const bodyObs = new MutationObserver(() => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        syncUnreadCount();
        syncActiveChatState();
      }, 250);
    });
    bodyObs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", () => {
      setTimeout(syncActiveChatState, 150);
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        setTimeout(syncActiveChatState, 150);
      }
    });
  }

  // Periodic heartbeat every 1s to guarantee real-time sync
  setInterval(() => {
    syncUnreadCount();
    syncActiveChatState();
  }, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectMainWorldScripts();
    initUnreadTracker();
  });
} else {
  injectMainWorldScripts();
  initUnreadTracker();
}

