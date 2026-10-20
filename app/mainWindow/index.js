"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  ipcMain,
  nativeImage,
  net,
  session,
  shell,
} = require("electron");
const { Buffer } = require("node:buffer");
const path = require("node:path");
const { t } = require("../i18n");
const titlebar = require("./titlebar");
const { registerPermissionHandlers } = require("../permissions");
const { registerScreenSharing } = require("../screenSharing");

// WhatsApp Web rejects Electron's default UA ("... Electron/44.4.3 ...")
// as an unsupported browser and asks to "update Chrome". This strips the
// Electron token and reports the real Chromium version underneath instead
// of a fake one, which is enough to pass the check.
const DESKTOP_CHROME_UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

// Schemes safe to hand to the desktop (xdg-open). Anything else — file:,
// javascript:, blob:, custom app schemes — is dropped, since a chat
// message is untrusted input.
const EXTERNAL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const SIDEBAR_WIDTH = 68;

function openExternally(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (!EXTERNAL_SCHEMES.has(parsed.protocol)) return;
  shell.openExternal(parsed.href).catch((err) => {
    console.error("No se pudo abrir el enlace en el navegador:", err);
  });
}

function routeExternalLinks(contents, appUrl) {
  const appOrigin = new URL(appUrl).origin;

  contents.setWindowOpenHandler(({ url }) => {
    const { extractDeepLinkArg } = require("../deepLinks/translate");
    const deepLink = extractDeepLinkArg([url]);
    if (deepLink) {
      const { handleWhatsAppLink } = require("../router");
      handleWhatsAppLink(deepLink, currentMainWindow);
      return { action: "deny" };
    }
    openExternally(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      return;
    }
    if (origin === appOrigin) return;
    event.preventDefault();

    openExternally(url);
  });
}

function addLinkContextMenu(win, contents) {
  contents.on("context-menu", (_event, params) => {
    if (!params.linkURL) return;
    Menu.buildFromTemplate([
      {
        label: t("contextMenu.copyLink"),
        click: () => clipboard.writeText(params.linkURL),
      },
      {
        label: t("contextMenu.openLink"),
        click: () => openExternally(params.linkURL),
      },
    ]).popup({ window: win });
  });
}

let currentMainWindow = null;
let currentConfig = null;
let activeSessionId = "zappr";
const sessionViews = new Map(); // desktopId -> WebContentsView
const sessionUnreadCounts = new Map(); // desktopId -> unread count
const sessionQrWaiting = new Map(); // desktopId -> boolean

function getDesktopIdByWebContents(sender) {
  if (!sender) return null;
  for (const [id, view] of sessionViews.entries()) {
    if (
      view &&
      view.webContents &&
      (view.webContents === sender || view.webContents.id === sender.id)
    ) {
      return id;
    }
  }
  return null;
}

function broadcastUnreadCount(desktopId, count) {
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    try {
      currentMainWindow.webContents.send("sessions:unread-updated", {
        desktopId,
        count,
      });
    } catch {
      // Window may be closing
    }
  }

  if (typeof app.setBadgeCount === "function") {
    let total = 0;
    for (const c of sessionUnreadCounts.values()) {
      const n = parseInt(c, 10);
      if (!isNaN(n)) total += n;
    }
    try {
      app.setBadgeCount(total);
    } catch {
      // Set badge count not supported
    }
  }
}

ipcMain.on("session:unread-count", (event, count) => {
  const desktopId = getDesktopIdByWebContents(event.sender);
  if (!desktopId) return;
  const normalized = count && count !== "0" && count !== 0 ? count : 0;
  if (sessionUnreadCounts.get(desktopId) !== normalized) {
    sessionUnreadCounts.set(desktopId, normalized);
    broadcastUnreadCount(desktopId, normalized);
  }
});

ipcMain.handle("sessions:get-unread-counts", () => {
  const result = {};
  for (const [id, count] of sessionUnreadCounts.entries()) {
    result[id] = count;
  }
  return result;
});

function broadcastSessionStatus(desktopId, isQrWaiting) {
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    try {
      currentMainWindow.webContents.send("sessions:status-updated", {
        desktopId,
        isQrWaiting,
      });
    } catch {
      // Window may be closing
    }
  }
}

ipcMain.handle("sessions:get-statuses", () => {
  const result = {};
  for (const [id, qr] of sessionQrWaiting.entries()) {
    result[id] = { isQrWaiting: qr };
  }
  return result;
});

function pollSessionUnreadCounts() {
  for (const [id, view] of sessionViews.entries()) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) continue;
    view.webContents
      .executeJavaScript(
        `
        (function() {
          try {
            let unread = 0;
            const chatBtn = document.querySelector(
              'button[data-navbar-item-index="0"], ' +
              'button[aria-label="Conversas"], ' +
              'button[aria-label="Chats"], ' +
              'button[aria-label="Chats "], ' +
              'button[aria-label="Conversaciones"]'
            );
            if (chatBtn) {
              const container = chatBtn.closest("div") || chatBtn.parentElement;
              if (container) {
                const statusSpan = container.querySelector('[role="status"], [data-visualcompletion="ignore"]');
                if (statusSpan) {
                  const text = statusSpan.textContent.trim();
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num > 0) unread = text;
                }
              }
            }
            if (!unread && document.title) {
              const match = document.title.match(/^\\((\\d+)\\)/);
              if (match) unread = match[1];
            }

            const hasQr = Boolean(
              document.querySelector('canvas[aria-label*="scan" i], canvas[aria-label*="código" i], [data-ref], [data-testid="qrcode"], div[data-testid="qrcode-container"]') ||
              (!document.querySelector('button[data-navbar-item-index="0"]') && !document.querySelector('#side') && document.querySelector('canvas'))
            );

            return { unread, isQrWaiting: hasQr };
          } catch (_) {
            return { unread: 0, isQrWaiting: false };
          }
        })()
      `,
      )
      .then((data) => {
        if (!data) return;
        const normalized =
          data.unread && data.unread !== "0" && data.unread !== 0
            ? data.unread
            : 0;
        if (sessionUnreadCounts.get(id) !== normalized) {
          sessionUnreadCounts.set(id, normalized);
          broadcastUnreadCount(id, normalized);
        }

        const isQr = Boolean(data.isQrWaiting);
        if (sessionQrWaiting.get(id) !== isQr) {
          sessionQrWaiting.set(id, isQr);
          broadcastSessionStatus(id, isQr);
        }
      })
      .catch(() => {});
  }
}

// Background poll every 2.5s to ensure unread badges sync across all sessions
setInterval(pollSessionUnreadCounts, 2500);

function getWhatsAppContents() {
  const view = sessionViews.get(activeSessionId);
  return view ? view.webContents : null;
}

function getActiveSessionId() {
  return activeSessionId;
}

function updateLayout() {
  if (!currentMainWindow || currentMainWindow.isDestroyed()) return;
  // Use getContentBounds() for exact client coordinates inside win.contentView
  const { width, height } = currentMainWindow.getContentBounds();
  const top = currentMainWindow.isFullScreen() ? 0 : titlebar.HEIGHT;
  const viewWidth = Math.max(0, width - SIDEBAR_WIDTH);
  const viewHeight = Math.max(0, height - top);

  for (const [id, sView] of sessionViews.entries()) {
    if (id === activeSessionId) {
      sView.setBounds({
        x: 0,
        y: top,
        width: viewWidth,
        height: viewHeight,
      });
    } else {
      // Park inactive views off-screen to keep connection & background audio/notifications alive
      sView.setBounds({
        x: -10000,
        y: -10000,
        width: 100,
        height: 100,
      });
    }
  }
}

function getOrCreateSessionView(desktopId) {
  if (sessionViews.has(desktopId)) {
    return sessionViews.get(desktopId);
  }

  let partitionSession;
  if (desktopId === "zappr") {
    partitionSession = session.defaultSession;
  } else {
    partitionSession = session.fromPartition(`persist:${desktopId}`, {
      cache: true,
    });
  }

  partitionSession.setUserAgent(DESKTOP_CHROME_UA);
  registerPermissionHandlers(partitionSession);
  registerScreenSharing(partitionSession);

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "..", "browser", "preload.js"),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      session: partitionSession,
    },
  });

  try {
    const { getSessionMuted, getSessionVolume } = require("../sessions");
    const isMuted = getSessionMuted(desktopId);
    const vol = getSessionVolume(desktopId);
    view.webContents.setAudioMuted(isMuted || vol === 0);
  } catch {
    // Sessions module not yet available
  }

  view.webContents.setUserAgent(DESKTOP_CHROME_UA);
  routeExternalLinks(view.webContents, currentConfig.url);
  addLinkContextMenu(currentMainWindow, view.webContents);

  view.webContents.on("did-finish-load", () => {
    updateLayout();
    try {
      const { getSessionMuted, getSessionVolume } = require("../sessions");
      const isMuted = getSessionMuted(desktopId);
      const vol = getSessionVolume(desktopId);
      view.webContents.setAudioMuted(isMuted || vol === 0);
      applyVolumeToWebContents(view.webContents, vol, isMuted || vol === 0);
    } catch {
      // Sessions module not yet available
    }
    view.webContents
      .executeJavaScript(
        `
      if (typeof window.abrirChatComMensagem !== 'function') {
        window.abrirChatComMensagem = function(numero, mensagem = "") {
          let numeroLimpo = String(numero).replace(/\\D/g, '');
          if ((numeroLimpo.length === 10 || numeroLimpo.length === 11) && !numeroLimpo.startsWith('55')) {
            numeroLimpo = '55' + numeroLimpo;
          }
          const mensagemCodificada = encodeURIComponent(mensagem || '');
          const linkInvisivel = document.createElement('a');
          linkInvisivel.setAttribute('href', \`https://web.whatsapp.com/send?phone=\${numeroLimpo}&text=\${mensagemCodificada}\`);
          linkInvisivel.setAttribute('style', 'display:none;');
          document.body.appendChild(linkInvisivel);
          linkInvisivel.click();
          document.body.removeChild(linkInvisivel);
          console.log(\`%c[Sucesso] Abrindo chat para \${numeroLimpo} com mensagem pré-definida.\`, "color: #25D366; font-weight: bold;");
        };
      }
    `,
      )
      .catch(() => {});

    setTimeout(async () => {
      try {
        if (!view.webContents || view.webContents.isDestroyed()) return;
        const { listAllSessions, updateSession } = require("../sessions");
        const sessions = listAllSessions();
        const s = sessions.find((item) => item.desktopId === desktopId);
        if (s && s.syncWhatsAppPhoto) {
          const photoRes = await extractSessionWhatsAppPhoto(desktopId);
          if (photoRes.ok && photoRes.avatar && photoRes.avatar !== s.avatar) {
            updateSession({ desktopId, avatar: photoRes.avatar });
          }
        }
      } catch {
        // Auto-sync non-critical error
      }
    }, 4500);
  });

  view.webContents.loadURL(currentConfig.url);
  if (desktopId !== activeSessionId) {
    view.setBounds({
      x: -10000,
      y: -10000,
      width: 100,
      height: 100,
    });
  }
  currentMainWindow.contentView.addChildView(view);
  sessionViews.set(desktopId, view);

  return view;
}

function applyVolumeToWebContents(webContents, volumePercent, isMuted = false) {
  const vol = Math.max(
    0,
    Math.min(100, Math.round(Number(volumePercent) || 0)),
  );
  const muted = Boolean(isMuted || vol === 0);
  const fraction = muted ? 0 : vol / 100;

  const script = `
    (() => {
      // 1. Initialize audio interceptor if not already present
      if (!window.__zapprAudioHooked) {
        window.__zapprAudioHooked = true;
        window.__zapprActiveAudioElements = window.__zapprActiveAudioElements || new Set();
        window.__zapprAudioContexts = window.__zapprAudioContexts || new Set();

        const volDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume") || {};
        const origVolGet = volDesc.get;
        const origVolSet = volDesc.set;

        const mutedDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted") || {};
        const origMutedGet = mutedDesc.get;
        const origMutedSet = mutedDesc.set;

        window.__zapprOrigMedia = { origVolGet, origVolSet, origMutedGet, origMutedSet };

        function getFactor() {
          if (window.__zapprInstanceMuted) return 0;
          if (typeof window.__zapprInstanceVolume === 'number') {
            return Math.max(0, Math.min(1, window.__zapprInstanceVolume));
          }
          return 1;
        }

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
            const real = num * getFactor();
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
            const real = b || window.__zapprInstanceMuted || getFactor() === 0;
            if (origMutedSet) origMutedSet.call(this, real);
          }
        });

        const origPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function(...args) {
          window.__zapprActiveAudioElements.add(this);
          const v = this.__zapprVirtualVolume !== undefined ? this.__zapprVirtualVolume : 1;
          const real = v * getFactor();
          if (origVolSet) {
            try { origVolSet.call(this, real); } catch(_) {}
          }
          if (origMutedSet && (window.__zapprInstanceMuted || getFactor() === 0)) {
            try { origMutedSet.call(this, true); } catch(_) {}
          }
          return origPlay.apply(this, args);
        };

        const origAudio = window.Audio;
        if (typeof origAudio === 'function') {
          window.Audio = function(...args) {
            const el = new origAudio(...args);
            window.__zapprActiveAudioElements.add(el);
            const f = getFactor();
            if (origVolSet) {
              try { origVolSet.call(el, (el.__zapprVirtualVolume !== undefined ? el.__zapprVirtualVolume : 1) * f); } catch(_) {}
            }
            return el;
          };
          window.Audio.prototype = origAudio.prototype;
        }

        const origConnect = AudioNode.prototype.connect;
        function hookContext(NativeContext) {
          if (!NativeContext) return NativeContext;
          const Wrapped = function(...args) {
            const ctx = new NativeContext(...args);
            window.__zapprAudioContexts.add(ctx);
            try {
              const masterGain = ctx.createGain();
              masterGain.gain.value = getFactor();
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
      }

      // 2. Set current instance volume and mute
      window.__zapprInstanceVolume = ${fraction};
      window.__zapprInstanceMuted = ${muted};
      const factor = ${muted ? 0 : fraction};

      const origVolSet = window.__zapprOrigMedia?.origVolSet;
      const origMutedSet = window.__zapprOrigMedia?.origMutedSet;

      document.querySelectorAll('audio, video').forEach((el) => {
        if (window.__zapprActiveAudioElements) window.__zapprActiveAudioElements.add(el);
      });

      if (window.__zapprActiveAudioElements) {
        for (const el of window.__zapprActiveAudioElements) {
          try {
            const v = el.__zapprVirtualVolume !== undefined ? el.__zapprVirtualVolume : 1;
            if (origVolSet) {
              origVolSet.call(el, v * factor);
            } else {
              el.volume = v * factor;
            }
            if (origMutedSet) {
              if (${muted} || factor === 0) {
                origMutedSet.call(el, true);
              } else if (el.__zapprVirtualMuted !== undefined) {
                origMutedSet.call(el, el.__zapprVirtualMuted);
              } else {
                origMutedSet.call(el, false);
              }
            } else if (${muted} || factor === 0) {
              el.muted = true;
            }
          } catch (_) {}
        }
      }

      if (window.__zapprAudioContexts) {
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
      }
    })()
  `;

  webContents.executeJavaScript(script).catch(() => {});
}

function setAudioMutedForSession(desktopId, muted) {
  const view = sessionViews.get(desktopId);
  if (view && !view.webContents.isDestroyed()) {
    const isMuted = Boolean(muted);
    let vol = 100;
    try {
      const { getSessionVolume } = require("../sessions");
      vol = getSessionVolume(desktopId);
    } catch {
      vol = 100;
    }
    const effectiveMuted = isMuted || vol === 0;
    view.webContents.setAudioMuted(effectiveMuted);
    applyVolumeToWebContents(view.webContents, vol, effectiveMuted);
  }
}

function setVolumeForSession(desktopId, volumePercent) {
  const view = sessionViews.get(desktopId);
  if (view && !view.webContents.isDestroyed()) {
    const vol = Math.max(
      0,
      Math.min(100, Math.round(Number(volumePercent) || 0)),
    );
    let isMuted = false;
    try {
      const { getSessionMuted } = require("../sessions");
      isMuted = getSessionMuted(desktopId);
    } catch {
      isMuted = false;
    }
    const effectiveMuted = isMuted || vol === 0;
    view.webContents.setAudioMuted(effectiveMuted);
    applyVolumeToWebContents(view.webContents, vol, effectiveMuted);
  }
}

function switchSessionTab(desktopId) {
  if (!currentMainWindow || currentMainWindow.isDestroyed())
    return { ok: false };
  const targetId = desktopId || "zappr";
  activeSessionId = targetId;

  const targetView = getOrCreateSessionView(targetId);
  updateLayout();
  targetView.webContents.focus();

  try {
    const { getSessionColor, listAllSessions } = require("../sessions");
    const color = getSessionColor(targetId);
    titlebar.setColor(color);
    const sessions = listAllSessions();
    const active = sessions.find((s) => s.desktopId === targetId);
    if (active) {
      let name = active.profileName || "";
      const m = /^Zappr\s*\((.+)\)$/i.exec(name);
      if (m) name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
      const title = name ? `Zappr - ${name}` : "Zappr";
      titlebar.setTitle(title);
    }
  } catch {
    // Session color lookup error
  }

  try {
    currentMainWindow.webContents.send("sessions:active-changed", targetId);
  } catch {
    // Window may be closing
  }

  return { ok: true, desktopId: targetId };
}

function removeSessionTab(desktopId) {
  if (sessionViews.has(desktopId)) {
    const sView = sessionViews.get(desktopId);
    try {
      if (currentMainWindow && !currentMainWindow.isDestroyed()) {
        currentMainWindow.contentView.removeChildView(sView);
      }
      sView.webContents.close();
    } catch (e) {
      console.error("Error closing session view:", e);
    }
    sessionViews.delete(desktopId);
  }
  if (sessionUnreadCounts.has(desktopId)) {
    sessionUnreadCounts.delete(desktopId);
    broadcastUnreadCount(desktopId, 0);
  }
  if (activeSessionId === desktopId) {
    switchSessionTab("zappr");
  }
}

function createMainWindow(config) {
  session.defaultSession.setUserAgent(DESKTOP_CHROME_UA);

  // GNOME draws the native title bar and menu bar and apps can't color
  // them, so the window is frameless and draws its own bar (titlebar.html)
  // in the session color. The minimize/maximize/close buttons are still
  // Electron's own (titleBarOverlay), recolored to match.
  const initial = titlebar.currentColors();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: config.appName,
    icon: config.appIcon,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: initial.bg,
      symbolColor: initial.fg,
      height: titlebar.HEIGHT,
    },
    backgroundColor: initial.bg,
    webPreferences: {
      preload: path.join(__dirname, "titlebar-preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "titlebar.html"));

  currentMainWindow = win;
  currentConfig = config;
  activeSessionId = "zappr";

  // Initialize main session view first
  getOrCreateSessionView("zappr");

  // Preload all registered sessions on startup so WhatsApp Web is immediately loaded for all accounts
  try {
    const { listAllSessions } = require("../sessions");
    const sessions = listAllSessions();
    for (const s of sessions) {
      if (s && s.desktopId && s.desktopId !== "zappr") {
        getOrCreateSessionView(s.desktopId);
      }
    }
  } catch (err) {
    console.error("Error preloading sessions:", err);
  }

  updateLayout();

  // Handle all resize and maximize events on Windows & Linux
  win.on("resize", updateLayout);
  win.on("maximize", updateLayout);
  win.on("unmaximize", updateLayout);
  win.on("restore", updateLayout);
  win.on("resized", updateLayout);

  win.on("enter-full-screen", () => {
    updateLayout();
    win.webContents.send("window:fullscreen", true);
  });
  win.on("leave-full-screen", () => {
    updateLayout();
    win.webContents.send("window:fullscreen", false);
  });

  win.on("focus", () => {
    const active = sessionViews.get(activeSessionId);
    if (active) active.webContents.focus();
  });

  try {
    const { listAllSessions } = require("../sessions");
    const all = listAllSessions();
    const mainS = all.find((s) => s.desktopId === "zappr") || all[0];
    let mainName = mainS && mainS.profileName ? mainS.profileName : "";
    const m = /^Zappr\s*\((.+)\)$/i.exec(mainName);
    if (m) mainName = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    const initialTitle = mainName ? `Zappr - ${mainName}` : config.appName;
    titlebar.attach(win, initialTitle);
  } catch {
    titlebar.attach(win, config.appName);
  }

  win.on("page-title-updated", (event) => {
    event.preventDefault();
  });

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function getMainWindow() {
  return currentMainWindow;
}

const activeAutoSendSupervisors = new Map();
const recentSendHistory = new Map();

function startAutoSendSupervisor(view, targetId) {
  if (!view || !view.webContents || view.webContents.isDestroyed()) return;

  // Clear any existing supervisor running on the same session
  if (activeAutoSendSupervisors.has(targetId)) {
    clearInterval(activeAutoSendSupervisors.get(targetId));
    activeAutoSendSupervisors.delete(targetId);
  }

  let attempts = 0;
  const maxAttempts = 60; // 60 * 300ms = 18s
  let hasTriggeredSend = false;

  // Read-only inspection script: does NOT click or mutate DOM
  const checkScript = `
    (function() {
      try {
        // 1. Detect invalid phone number modal
        const invalidModal = document.querySelector(
          'div[data-animate-modal-popup="true"], [data-testid="popup-contents"], div[role="dialog"]'
        );
        if (invalidModal) {
          const modalText = (invalidModal.textContent || '').toLowerCase();
          if (
            modalText.includes('url') ||
            modalText.includes('inválid') ||
            modalText.includes('invalid') ||
            modalText.includes('não encontrado') ||
            modalText.includes('not found')
          ) {
            return { status: 'invalid_number' };
          }
        }

        // 2. Locate composer input field
        const chatInput = document.querySelector(
          '#main footer div[contenteditable="true"], footer div[contenteditable="true"], div[data-lexical-editor="true"]'
        );
        const currentText = chatInput ? (chatInput.textContent || '').trim() : '';

        // 3. Locate send button
        function findSendButton() {
          const directSelectors = [
            '[data-testid="send"]',
            '[data-testid="compose-btn-send"]',
            'button[data-testid="send"]',
            'span[data-testid="send"]',
            'span[data-icon="send"]',
            'span[data-icon="send-light"]',
            'span[data-icon="wds-ic-send-filled"]',
            '[data-icon="send"]',
            '[data-icon="wds-ic-send-filled"]',
            '[data-icon*="send"]',
          ];
          for (const sel of directSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              return el.closest('button, [role="button"]') || el;
            }
          }

          const ariaMatches = document.querySelectorAll(
            '#main footer button[aria-label], footer button[aria-label], #main footer [role="button"][aria-label], footer [role="button"][aria-label]'
          );
          for (const el of ariaMatches) {
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('enviar') || label.includes('send')) {
              return el;
            }
          }

          const footer = document.querySelector('#main footer, footer');
          if (footer) {
            const paths = footer.querySelectorAll('path');
            for (const p of paths) {
              const d = p.getAttribute('d') || '';
              if (
                d.includes('21.757') ||
                d.includes('12.028') ||
                d.includes('1.101') ||
                d.includes('13.623')
              ) {
                return p.closest('button, [role="button"]') || p.closest('span') || p;
              }
            }

            const buttons = footer.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
              const html = btn.outerHTML.toLowerCase();
              const isMic =
                html.includes('ptt') ||
                html.includes('audio-mic') ||
                html.includes('mic') ||
                html.includes('grav');
              const isAttach =
                html.includes('attach') ||
                html.includes('anexo') ||
                html.includes('clip');
              const isEmoji =
                html.includes('smiley') ||
                html.includes('emoji') ||
                html.includes('sticker');
              if (!isMic && !isAttach && !isEmoji) {
                const input = footer.querySelector('div[contenteditable="true"]');
                if (
                  input &&
                  (input.compareDocumentPosition(btn) &
                    Node.DOCUMENT_POSITION_FOLLOWING)
                ) {
                  return btn;
                }
              }
            }
          }

          return null;
        }

        const sendBtn = findSendButton();

        return {
          status: 'ok',
          hasInput: Boolean(chatInput),
          hasSendBtn: Boolean(sendBtn),
          textLength: currentText.length,
        };
      } catch (err) {
        return { status: 'error', error: String(err) };
      }
    })()
  `;

  // Single-action execution script: triggers ONE single native click
  const triggerSendScript = `
    (function() {
      try {
        function findSendButton() {
          const directSelectors = [
            '[data-testid="send"]',
            '[data-testid="compose-btn-send"]',
            'button[data-testid="send"]',
            'span[data-testid="send"]',
            'span[data-icon="send"]',
            'span[data-icon="send-light"]',
            'span[data-icon="wds-ic-send-filled"]',
            '[data-icon="send"]',
            '[data-icon="wds-ic-send-filled"]',
            '[data-icon*="send"]',
          ];
          for (const sel of directSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              return el.closest('button, [role="button"]') || el;
            }
          }

          const ariaMatches = document.querySelectorAll(
            '#main footer button[aria-label], footer button[aria-label], #main footer [role="button"][aria-label], footer [role="button"][aria-label]'
          );
          for (const el of ariaMatches) {
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('enviar') || label.includes('send')) {
              return el;
            }
          }

          const footer = document.querySelector('#main footer, footer');
          if (footer) {
            const paths = footer.querySelectorAll('path');
            for (const p of paths) {
              const d = p.getAttribute('d') || '';
              if (
                d.includes('21.757') ||
                d.includes('12.028') ||
                d.includes('1.101') ||
                d.includes('13.623')
              ) {
                return p.closest('button, [role="button"]') || p.closest('span') || p;
              }
            }

            const buttons = footer.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
              const html = btn.outerHTML.toLowerCase();
              const isMic =
                html.includes('ptt') ||
                html.includes('audio-mic') ||
                html.includes('mic') ||
                html.includes('grav');
              const isAttach =
                html.includes('attach') ||
                html.includes('anexo') ||
                html.includes('clip');
              const isEmoji =
                html.includes('smiley') ||
                html.includes('emoji') ||
                html.includes('sticker');
              if (!isMic && !isAttach && !isEmoji) {
                const input = footer.querySelector('div[contenteditable="true"]');
                if (
                  input &&
                  (input.compareDocumentPosition(btn) &
                    Node.DOCUMENT_POSITION_FOLLOWING)
                ) {
                  return btn;
                }
              }
            }
          }

          return null;
        }

        const btn = findSendButton();
        if (btn) {
          try { btn.focus(); } catch (_) {}
          try { btn.click(); } catch (_) {}
          return { clicked: true };
        }

        const chatInput = document.querySelector(
          '#main footer div[contenteditable="true"], footer div[contenteditable="true"], div[data-lexical-editor="true"]'
        );
        if (chatInput) {
          try { chatInput.focus(); } catch (_) {}
          return { clicked: false, focusedInput: true };
        }

        return { clicked: false };
      } catch (e) {
        return { clicked: false, error: String(e) };
      }
    })()
  `;

  const intervalId = setInterval(async () => {
    attempts++;
    if (
      !view.webContents ||
      view.webContents.isDestroyed() ||
      attempts >= maxAttempts
    ) {
      clearInterval(intervalId);
      activeAutoSendSupervisors.delete(targetId);
      return;
    }

    try {
      const res = await view.webContents.executeJavaScript(checkScript);
      if (!res || res.status === "invalid_number") {
        clearInterval(intervalId);
        activeAutoSendSupervisors.delete(targetId);
        return;
      }

      // If we already triggered send:
      if (hasTriggeredSend) {
        // Confirmation: input text is now cleared OR send button disappeared (switched to mic)
        if (res.hasInput && (res.textLength === 0 || !res.hasSendBtn)) {
          clearInterval(intervalId);
          activeAutoSendSupervisors.delete(targetId);
          return;
        }
        // Never retry or re-click once triggered: wait for confirmation or timeout
        return;
      }

      // We have NOT triggered send yet:
      // Wait until the input has the message text
      if (res.hasInput && res.textLength > 0) {
        hasTriggeredSend = true;

        if (res.hasSendBtn) {
          await view.webContents.executeJavaScript(triggerSendScript);
        } else {
          // If send button icon not found directly, focus input and send native Enter keystroke
          const trigRes = await view.webContents.executeJavaScript(triggerSendScript);
          if (trigRes && trigRes.focusedInput && !view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" });
            view.webContents.sendInputEvent({ type: "char", keyCode: "Enter" });
            view.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
          }
        }
      }
    } catch {
      // Ignore intermittent script errors while page navigates
    }
  }, 300);

  activeAutoSendSupervisors.set(targetId, intervalId);
}

function sendWhatsAppMessageToSession(
  desktopId,
  phone,
  text,
  autoSend = false,
) {
  const targetId = desktopId || "zappr";
  switchSessionTab(targetId);

  const view = getOrCreateSessionView(targetId);
  if (!view || !view.webContents) return;

  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    if (currentMainWindow.isMinimized()) currentMainWindow.restore();
    currentMainWindow.show();
    currentMainWindow.focus();
  }

  if (!phone) return;

  const cleanPhone = String(phone).replace(/\D/g, "");
  const fullPhone =
    (cleanPhone.length === 10 || cleanPhone.length === 11) &&
    !cleanPhone.startsWith("55")
      ? `55${cleanPhone}`
      : cleanPhone;
  const encodedText = encodeURIComponent(text || "");
  const targetWebUrl = `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;
  const shouldAutoSend = Boolean(autoSend && text && text.trim().length > 0);

  // Idempotency / Deduplication Guard: block identical sends within 4 seconds
  const dedupeKey = `${targetId}:${fullPhone}:${encodedText}`;
  const now = Date.now();
  if (shouldAutoSend && recentSendHistory.has(dedupeKey)) {
    const lastSent = recentSendHistory.get(dedupeKey);
    if (now - lastSent < 4000) {
      return;
    }
  }
  if (shouldAutoSend) {
    recentSendHistory.set(dedupeKey, now);
    if (recentSendHistory.size > 50) {
      for (const [k, time] of recentSendHistory.entries()) {
        if (now - time > 10000) recentSendHistory.delete(k);
      }
    }
  }

  const dispatchNavigation = () => {
    if (!view.webContents || view.webContents.isDestroyed()) return;

    const navCode = `
      (function() {
        try {
          const linkInvisivel = document.createElement('a');
          linkInvisivel.setAttribute('href', ${JSON.stringify(targetWebUrl)});
          linkInvisivel.setAttribute('style', 'display:none;');
          document.body.appendChild(linkInvisivel);
          linkInvisivel.click();
          document.body.removeChild(linkInvisivel);
        } catch (e) {
          console.error("Erro ao despachar chat no WhatsApp Web:", e);
        }
      })();
    `;

    view.webContents.executeJavaScript(navCode).catch(() => {});

    if (shouldAutoSend) {
      startAutoSendSupervisor(view, targetId);
    }
  };

  if (view.webContents.isLoading()) {
    view.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        dispatchNavigation();
      }, 700);
    });
  } else {
    dispatchNavigation();
  }
}

async function extractSessionWhatsAppPhoto(desktopId) {
  const targetId = desktopId || activeSessionId || "zappr";
  let view = sessionViews.get(targetId);
  if (!view && currentMainWindow && currentConfig) {
    view = getOrCreateSessionView(targetId);
  }
  if (!view || !view.webContents || view.webContents.isDestroyed()) {
    return { ok: false, error: "Sessão não disponível ou não carregada." };
  }

  const jsExtract = `
    (async function() {
      try {
        function findProfileImg() {
          const profileLabels = [
            "você",
            "you",
            "perfil",
            "profile",
            "tú",
            "vos",
            "voce",
          ];
          const buttons = Array.from(
            document.querySelectorAll(
              'button[data-navbar-item="true"], button[aria-label]'
            )
          );
          for (const btn of buttons) {
            const label = (btn.getAttribute("aria-label") || "")
              .trim()
              .toLowerCase();
            if (profileLabels.some((l) => label === l || label.includes(l))) {
              const img = btn.querySelector("img");
              if (img && img.src) return img.src;
            }
          }

          for (const btn of buttons) {
            if (btn.getAttribute("data-navbar-item") === "true") {
              const img = btn.querySelector("img");
              if (
                img &&
                img.src &&
                (img.src.includes("whatsapp.net") ||
                  img.src.startsWith("blob:") ||
                  img.src.startsWith("data:"))
              ) {
                return img.src;
              }
            }
          }

          const headerImgs = Array.from(
            document.querySelectorAll(
              'header img, nav img, [role="navigation"] img'
            )
          );
          for (const img of headerImgs) {
            if (
              img.src &&
              (img.src.includes("whatsapp.net") ||
                img.src.includes("pps.whatsapp.net"))
            ) {
              return img.src;
            }
          }

          const indexedImg = document.querySelector(
            'button[data-navbar-item-index="7"] img, button[data-navbar-item-index="6"] img, button[data-navbar-item-index="8"] img'
          );
          if (indexedImg && indexedImg.src) return indexedImg.src;

          const anyImg = document.querySelector('img[src*="whatsapp.net"]');
          if (anyImg && anyImg.src) return anyImg.src;

          return null;
        }

        const src = findProfileImg();
        if (!src) return { ok: false, error: "not_found" };

        if (src.startsWith("data:")) {
          return { ok: true, url: src, isDataUrl: true };
        }

        if (src.startsWith("blob:")) {
          try {
            const res = await fetch(src);
            const blob = await res.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ ok: true, url: reader.result, isDataUrl: true });
              reader.onerror = () =>
                resolve({ ok: true, url: src, isDataUrl: false });
              reader.readAsDataURL(blob);
            });
          } catch {
            return { ok: true, url: src, isDataUrl: false };
          }
        }

        return { ok: true, url: src, isDataUrl: false };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    })();
  `;

  let evalResult;
  try {
    evalResult = await view.webContents.executeJavaScript(jsExtract);
  } catch (err) {
    return { ok: false, error: err.message || "Falha ao consultar a sessão." };
  }

  if (!evalResult || !evalResult.ok || !evalResult.url) {
    return {
      ok: false,
      error:
        "Foto do perfil do WhatsApp não encontrada. Verifique se o WhatsApp está logado.",
    };
  }

  try {
    let natImg;
    if (evalResult.isDataUrl) {
      natImg = nativeImage.createFromDataURL(evalResult.url);
    } else {
      const resp = await net.fetch(evalResult.url);
      if (!resp.ok) {
        return {
          ok: false,
          error: `Falha ao baixar foto: status ${resp.status}`,
        };
      }
      const arrayBuf = await resp.arrayBuffer();
      natImg = nativeImage.createFromBuffer(Buffer.from(arrayBuf));
    }

    if (!natImg || natImg.isEmpty()) {
      return { ok: false, error: "Imagem retornada pelo WhatsApp é inválida." };
    }

    const size = natImg.getSize();
    const minDim = Math.min(size.width, size.height);
    if (minDim <= 0) {
      return { ok: false, error: "Dimensão da imagem inválida." };
    }
    const cropX = Math.round((size.width - minDim) / 2);
    const cropY = Math.round((size.height - minDim) / 2);
    const cropped = natImg.crop({
      x: cropX,
      y: cropY,
      width: minDim,
      height: minDim,
    });
    const resized = cropped.resize({
      width: 128,
      height: 128,
      quality: "better",
    });
    const dataUrl = resized.toDataURL();

    return { ok: true, avatar: dataUrl };
  } catch (err) {
    return {
      ok: false,
      error: `Erro ao processar imagem: ${err.message || String(err)}`,
    };
  }
}

function reloadSessionTab(desktopId) {
  const targetId = desktopId || activeSessionId || "zappr";
  const view = sessionViews.get(targetId);
  if (view && view.webContents && !view.webContents.isDestroyed()) {
    view.webContents.reload();
    return true;
  }
  return false;
}

module.exports = {
  createMainWindow,
  getMainWindow,
  getWhatsAppContents,
  switchSessionTab,
  removeSessionTab,
  reloadSessionTab,
  getActiveSessionId,
  updateLayout,
  setAudioMutedForSession,
  setVolumeForSession,
  sendWhatsAppMessageToSession,
  getLoadedSessionIds: () => Array.from(sessionViews.keys()),
  sessionUnreadCounts,
  broadcastUnreadCount,
  applyVolumeToWebContents,
  extractSessionWhatsAppPhoto,
};
