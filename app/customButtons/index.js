"use strict";

const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { listIcons, getIconSvg } = require("./icons");
const {
  openCustomButtonModal,
  closeCustomButtonModal,
} = require("./modal-manager");

const BUTTONS_FILE = path.join(app.getPath("userData"), "custom-buttons.json");

function getStoredButtons() {
  if (!fs.existsSync(BUTTONS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(BUTTONS_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveStoredButtons(buttons) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(BUTTONS_FILE, JSON.stringify(buttons, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao salvar custom-buttons.json:", err);
  }
}

function notifyButtonsChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) {
        win.webContents.send("customButtons:changed");
      }
    } catch {
      // Window might be closing
    }
  }
}

function listButtons(activeSessionId = null) {
  const buttons = getStoredButtons();
  if (!activeSessionId) return buttons;

  return buttons.filter(
    (b) => b.scope === "global" || b.sessionId === activeSessionId,
  );
}

function getButton(id) {
  const buttons = getStoredButtons();
  return buttons.find((b) => b.id === id) || null;
}

function createButton(data) {
  const buttons = getStoredButtons();
  const newBtn = {
    id: `btn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: (data.name || "Botão").trim(),
    type: data.type === "message" ? "message" : "url",
    url: typeof data.url === "string" ? data.url.trim() : "",
    message: typeof data.message === "string" ? data.message.trim() : "",
    scope: data.scope === "session" ? "session" : "global",
    sessionId: data.scope === "session" ? data.sessionId || null : null,
    color: data.color || "#00a884",
    icon: data.icon || "external-link",
    createdAt: Date.now(),
  };

  buttons.push(newBtn);
  saveStoredButtons(buttons);
  notifyButtonsChanged();
  return newBtn;
}

function updateButton(data) {
  const buttons = getStoredButtons();
  const idx = buttons.findIndex((b) => b.id === data.id);
  if (idx === -1) return null;

  buttons[idx] = {
    ...buttons[idx],
    name: (data.name || buttons[idx].name).trim(),
    type: data.type === "message" ? "message" : "url",
    url: typeof data.url === "string" ? data.url.trim() : buttons[idx].url,
    message:
      typeof data.message === "string"
        ? data.message.trim()
        : buttons[idx].message,
    scope: data.scope === "session" ? "session" : "global",
    sessionId: data.scope === "session" ? data.sessionId || null : null,
    color: data.color || buttons[idx].color,
    icon: data.icon || buttons[idx].icon,
    updatedAt: Date.now(),
  };

  saveStoredButtons(buttons);
  notifyButtonsChanged();
  return buttons[idx];
}

function deleteButton(id) {
  const buttons = getStoredButtons();
  const filtered = buttons.filter((b) => b.id !== id);
  if (filtered.length !== buttons.length) {
    saveStoredButtons(filtered);
    notifyButtonsChanged();
    return true;
  }
  return false;
}

const nodePhoneCacheByName = new Map();

async function resolveContactPhoneViaDrawer(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return { hasActiveChat: false, isGroup: false, phone: "", name: "" };
  }

  // Step 1: Query initial state & element coordinates from webContents
  let initial = null;
  try {
    initial = await webContents.executeJavaScript(`
      (function() {
        try {
          const mainEl = document.querySelector('#main');
          if (!mainEl) {
            return { hasActiveChat: false, isGroup: false, phone: '', name: '', coords: null };
          }

          window.__zapprPhoneCache = window.__zapprPhoneCache || {};

          function extractPhone(str) {
            if (!str) return '';
            const intl = /\\+[\\d\\s()–—\\-]{6,25}/.exec(str);
            if (intl) {
              const digits = intl[0].replace(/\\D/g, '');
              if (digits.length >= 8 && digits.length <= 16) return digits;
            }
            const allDigits = str.replace(/\\D/g, '');
            if (allDigits.length >= 10 && allDigits.length <= 16) {
              const letterCount = (str.match(/[a-zA-Z\\u00C0-\\u017F]/g) || []).length;
              if (letterCount <= 3) return allDigits;
            }
            return '';
          }

          function checkIfGroup(el) {
            if (!el) return false;

            const hdr = el.querySelector('header');
            if (hdr) {
              if (hdr.querySelector('[data-icon*="default-user"], [data-testid*="default-user"]')) {
                return false;
              }
              const hdrText = (hdr.textContent || '').toLowerCase();
              if (
                hdrText.includes('online') ||
                hdrText.includes('visto por') ||
                hdrText.includes('last seen') ||
                hdrText.includes('digitando...') ||
                hdrText.includes('typing...')
              ) {
                return false;
              }

              if (
                hdr.querySelector(
                  '[data-icon*="group"], [data-testid*="group"], [data-icon*="community"], [data-testid*="community"]'
                )
              ) {
                return true;
              }
              if (
                hdrText.includes('dados do grupo') ||
                hdrText.includes('group info') ||
                hdrText.includes('informações do grupo') ||
                hdrText.includes('información del grupo') ||
                hdrText.includes('admin do grupo') ||
                hdrText.includes('group admin') ||
                hdrText.includes('somente admins') ||
                hdrText.includes('only admins') ||
                hdrText.includes('participantes') ||
                hdrText.includes('participants')
              ) {
                return true;
              }
              if (/(?:^|\\s)(?:você|you|tú),\\s/i.test(hdrText)) {
                return true;
              }
            }

            const selRow = document.querySelector(
              '#pane-side [aria-selected="true"], #pane-side div[role="listitem"].active, #pane-side div[role="row"][aria-selected="true"]'
            );
            if (selRow) {
              const rowId = selRow.getAttribute('data-id') || selRow.querySelector('[data-id]')?.getAttribute('data-id') || '';
              if (rowId.includes('@c.us') || rowId.includes('@s.whatsapp.net')) return false;
              if (rowId.includes('@g.us')) return true;
              if (selRow.querySelector('[data-icon*="default-user"], [data-testid*="default-user"]')) return false;
              if (
                selRow.querySelector(
                  '[data-icon*="group"], [data-testid*="group"], [data-icon*="community"], [data-testid*="community"]'
                )
              ) {
                return true;
              }
            }

            const msgs = el.querySelectorAll('[data-id*="@c.us"], [data-id*="@g.us"], [data-id*="@s.whatsapp.net"]');
            for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 8); i--) {
              const dId = msgs[i].getAttribute('data-id') || '';
              if (/^(?:true|false)_\\d+@(c\\.us|s\\.whatsapp\\.net)/.test(dId)) {
                return false;
              }
              if (/^(?:true|false)_\\d+@g\\.us/.test(dId)) {
                return true;
              }
            }

            const footer = el.querySelector('footer');
            if (footer) {
              const fTxt = (footer.textContent || '').toLowerCase();
              if (fTxt.includes('somente admins') || fTxt.includes('only admins')) return true;
            }
            return false;
          }

          const isGroup = checkIfGroup(mainEl);

          let contactName = '';
          const header = mainEl.querySelector('header');
          let titleEl = null;
          if (header) {
            titleEl = header.querySelector(
              '[data-testid="conversation-info-header-chat-title"], span[dir="auto"][title], div[role="button"] span[title], span[title], h2'
            );
            if (titleEl) {
              contactName = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
            } else {
              const anySpan = header.querySelector('span[dir="auto"]');
              if (anySpan) contactName = anySpan.textContent.trim();
            }
          }

          // Direct phone in contact title/name
          const directPhone = extractPhone(contactName);
          if (directPhone) {
            return { hasActiveChat: true, isGroup: false, phone: directPhone, name: contactName, coords: null };
          }

          // Direct phone in header spans
          if (header) {
            const headerSpans = header.querySelectorAll('span');
            for (const s of headerSpans) {
              if (s.children.length > 2) continue;
              const found = extractPhone(s.textContent || '');
              if (found) {
                return { hasActiveChat: true, isGroup: false, phone: found, name: contactName, coords: null };
              }
            }
          }

          if (isGroup) {
            return { hasActiveChat: true, isGroup: true, phone: '', name: contactName || 'Grupo', coords: null };
          }

          if (contactName && window.__zapprPhoneCache[contactName] && typeof window.__zapprPhoneCache[contactName] === 'string' && window.__zapprPhoneCache[contactName].trim().length >= 8) {
            return { hasActiveChat: true, isGroup: false, phone: window.__zapprPhoneCache[contactName].trim(), name: contactName, coords: null };
          }

          // Find exact click coordinates of the title/name area in header
          let coords = null;
          if (header) {
            const infoHeader =
              header.querySelector('[data-testid="conversation-info-header"]') ||
              header.querySelector('div[role="button"][tabindex="0"]');
            const avatar = header.querySelector(
              '[data-testid="chat-avatar"], img[src], [data-icon*="user"], [data-testid="avatar"]'
            );
            const clickable = infoHeader || titleEl || avatar || header.firstElementChild;
            if (clickable) {
              const rect = clickable.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                coords = {
                  x: Math.round(rect.left + Math.min(60, rect.width / 2)),
                  y: Math.round(rect.top + rect.height / 2)
                };
              }
            }
            if (!coords) {
              const hr = header.getBoundingClientRect();
              coords = {
                x: Math.round(hr.left + 80),
                y: Math.round(hr.top + hr.height / 2)
              };
            }
          }

          return {
            hasActiveChat: true,
            isGroup: false,
            phone: '',
            name: contactName,
            coords
          };
        } catch (err) {
          return { hasActiveChat: false, isGroup: false, phone: '', name: '', coords: null, error: String(err) };
        }
      })()
    `);
  } catch (err) {
    console.error("[Zappr CustomButtons] Error in initial chat query:", err);
    return { hasActiveChat: false, isGroup: false, phone: "", name: "" };
  }

  if (!initial || !initial.hasActiveChat) {
    return { hasActiveChat: false, isGroup: false, phone: "", name: "" };
  }

  if (initial.isGroup) {
    return { hasActiveChat: true, isGroup: true, phone: "", name: initial.name };
  }

  if (initial.phone) {
    nodePhoneCacheByName.set(initial.name, initial.phone);
    return { hasActiveChat: true, isGroup: false, phone: initial.phone, name: initial.name };
  }

  const cachedPhone = initial.name ? nodePhoneCacheByName.get(initial.name) : null;
  if (cachedPhone && typeof cachedPhone === "string" && cachedPhone.trim().length >= 8) {
    return { hasActiveChat: true, isGroup: false, phone: cachedPhone.trim(), name: initial.name };
  }

  // Step 2: Saved contact without known phone — open contact info drawer
  console.log(`[Zappr CustomButtons] Opening contact info for "${initial.name}"...`);

  // Native mouse click on header coordinates (guaranteed to trigger Chromium & React)
  if (initial.coords) {
    try {
      webContents.sendInputEvent({ type: "mouseMove", x: initial.coords.x, y: initial.coords.y });
      webContents.sendInputEvent({ type: "mouseDown", x: initial.coords.x, y: initial.coords.y, button: "left", clickCount: 1 });
      await new Promise((r) => setTimeout(r, 60));
      webContents.sendInputEvent({ type: "mouseUp", x: initial.coords.x, y: initial.coords.y, button: "left", clickCount: 1 });
    } catch {
      // Send input non-critical error
    }
  }

  // Also dispatch full DOM Pointer and Mouse events directly to the header element
  webContents
    .executeJavaScript(`
      (function() {
        try {
          const header = document.querySelector('#main header');
          if (!header) return;
          const target =
            header.querySelector('[data-testid="conversation-info-header"]') ||
            header.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
            header.querySelector('span[dir="auto"][title]') ||
            header.querySelector('img[src]') ||
            header.querySelector('div[role="button"]') ||
            header.firstElementChild;
          if (target) {
            const opts = { bubbles: true, cancelable: true, view: window };
            target.dispatchEvent(new PointerEvent('pointerdown', opts));
            target.dispatchEvent(new MouseEvent('mousedown', opts));
            target.dispatchEvent(new PointerEvent('pointerup', opts));
            target.dispatchEvent(new MouseEvent('mouseup', opts));
            target.dispatchEvent(new MouseEvent('click', opts));
            target.click();
          }
        } catch (_) {}
      })()
    `)
    .catch(() => {});

  // Step 3: Poll for drawer to open and extract phone number
  let extractedPhone = "";
  const pollStart = Date.now();

  while (Date.now() - pollStart < 3200) {
    await new Promise((r) => setTimeout(r, 120));

    try {
      const drawerRes = await webContents.executeJavaScript(`
        (function() {
          try {
            const mainEl = document.querySelector('#main');

            function findDrawer() {
              const byTestId = document.querySelector(
                '[data-testid="contact-info-drawer"], [data-testid="chat-info-drawer"], [data-testid="drawer-right"], section[data-testid*="drawer"]'
              );
              if (byTestId) return byTestId;

              const animated = document.querySelector('div[data-animate-drawer-right="true"], div[data-animate-drawer-middle="true"]');
              if (animated) return animated;

              const panels = document.querySelectorAll('section, aside, div[role="region"], div[data-animate-modal-body]');
              for (const p of panels) {
                if (p === mainEl || mainEl?.contains(p)) continue;
                const side = document.querySelector('#pane-side, #side');
                if (side?.contains(p)) continue;
                const hasClose = p.querySelector(
                  'button[aria-label*="Fechar" i], button[aria-label*="Close" i], [data-icon="x"], [data-testid="btn-close"], [data-testid="x"]'
                );
                if (hasClose) return p;
              }
              return null;
            }

            const drawer = findDrawer();
            if (!drawer) return { isOpen: false };

            function extractPhone(str) {
              if (!str) return '';
              const intl = /\\+[\\d\\s()–—\\-]{6,25}/.exec(str);
              if (intl) {
                const digits = intl[0].replace(/\\D/g, '');
                if (digits.length >= 8 && digits.length <= 16) return digits;
              }
              const allDigits = str.replace(/\\D/g, '');
              if (allDigits.length >= 10 && allDigits.length <= 16) {
                const letterCount = (str.match(/[a-zA-Z\\u00C0-\\u017F]/g) || []).length;
                if (letterCount <= 3) return allDigits;
              }
              return '';
            }

            let phone = '';

            // 1. Line-by-line inspection of drawer text
            const lines = (drawer.innerText || '').split('\\n').map(l => l.trim()).filter(Boolean);
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const lower = line.toLowerCase();
              if (lower === 'telefone' || lower === 'phone number' || lower === 'celular' || lower === 'mobile') {
                if (i + 1 < lines.length) {
                  const cand = extractPhone(lines[i + 1]);
                  if (cand) { phone = cand; break; }
                }
              }
              const direct = extractPhone(line);
              if (direct) { phone = direct; break; }
            }

            // 2. Child elements inspection
            if (!phone) {
              const elements = Array.from(drawer.querySelectorAll('span, p, div, a, h2, h3'));
              for (const el of elements) {
                if (el.children.length > 2) continue;
                const cand = extractPhone(el.textContent || '');
                if (cand) { phone = cand; break; }
              }
            }

            return {
              isOpen: true,
              phone: phone || ''
            };
          } catch (e) {
            return { isOpen: false, error: String(e) };
          }
        })()
      `);

      if (drawerRes && drawerRes.isOpen && drawerRes.phone) {
        extractedPhone = drawerRes.phone;
        console.log(`[Zappr CustomButtons] Extracted phone from drawer: ${extractedPhone}`);
        break;
      }
    } catch {
      // Polling error
    }
  }

  // Step 4: Close drawer by clicking ONLY the drawer close button (never dispatch Escape key to avoid exiting chat)
  try {
    await webContents.executeJavaScript(`
      (function() {
        try {
          const mainEl = document.querySelector('#main');

          function findDrawer() {
            const byTestId = document.querySelector(
              '[data-testid="contact-info-drawer"], [data-testid="chat-info-drawer"], [data-testid="drawer-right"], section[data-testid*="drawer"]'
            );
            if (byTestId) return byTestId;

            const animated = document.querySelector('div[data-animate-drawer-right="true"], div[data-animate-drawer-middle="true"]');
            if (animated) return animated;

            const panels = document.querySelectorAll('section, aside, div[role="region"], div[data-animate-modal-body]');
            for (const p of panels) {
              if (p === mainEl || mainEl?.contains(p)) continue;
              const side = document.querySelector('#pane-side, #side');
              if (side?.contains(p)) continue;
              const hasClose = p.querySelector(
                'button[aria-label*="Fechar" i], button[aria-label*="Close" i], [data-icon="x"], [data-testid="btn-close"], [data-testid="x"]'
              );
              if (hasClose) return p;
            }
            return null;
          }

          const drawer = findDrawer();
          if (!drawer) return;

          const closeBtn =
            drawer.querySelector('[data-testid="btn-close"]') ||
            drawer.querySelector('[data-testid="x"]') ||
            drawer.querySelector('[data-icon="x"]')?.closest('button, [role="button"]') ||
            drawer.querySelector('[data-icon="x"]') ||
            drawer.querySelector('button[aria-label*="Fechar" i], button[aria-label*="Close" i], button[aria-label*="Cerrar" i]') ||
            drawer.querySelector('header button');

          if (closeBtn) {
            const opts = { bubbles: true, cancelable: true, view: window };
            closeBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
            closeBtn.dispatchEvent(new MouseEvent('mousedown', opts));
            closeBtn.dispatchEvent(new PointerEvent('pointerup', opts));
            closeBtn.dispatchEvent(new MouseEvent('mouseup', opts));
            closeBtn.dispatchEvent(new MouseEvent('click', opts));
            closeBtn.click();
          }
        } catch (_) {}
      })()
    `);
  } catch {
    // Close button non-critical error
  }

  // Cache phone if found
  if (extractedPhone && initial.name) {
    nodePhoneCacheByName.set(initial.name, extractedPhone);
    webContents
      .executeJavaScript(`
        if (window.__zapprPhoneCache) window.__zapprPhoneCache[${JSON.stringify(initial.name)}] = ${JSON.stringify(extractedPhone)};
      `)
      .catch(() => {});
  }

  // Fallback: incoming message data-ids from contact
  if (!extractedPhone) {
    try {
      const fallbackPhone = await webContents.executeJavaScript(`
        (function() {
          const mainEl = document.querySelector('#main');
          if (!mainEl) return '';
          const msgEls = mainEl.querySelectorAll('[data-id*="@c.us"], [data-id*="@s.whatsapp.net"]');
          for (let i = msgEls.length - 1; i >= 0; i--) {
            const dataId = msgEls[i].getAttribute('data-id') || '';
            const m = /^false_(\\d{8,16})@(c\\.us|s\\.whatsapp\\.net)/.exec(dataId);
            if (m && m[1]) return m[1];
          }
          return '';
        })()
      `);
      if (fallbackPhone) {
        extractedPhone = fallbackPhone;
        nodePhoneCacheByName.set(initial.name, extractedPhone);
        console.log(`[Zappr CustomButtons] Extracted phone from incoming message fallback: ${extractedPhone}`);
      }
    } catch {
      // Fallback query error
    }
  }

  return {
    hasActiveChat: true,
    isGroup: false,
    phone: extractedPhone || "",
    name: initial.name || ""
  };
}

async function getChatStatusFromWebContents(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return { hasActiveChat: false, isGroup: false, phone: "", name: "", isRawPhone: false };
  }
  try {
    const res = await webContents.executeJavaScript(`
      (function() {
        try {
          const mainEl = document.querySelector('#main');
          if (!mainEl) {
            return { hasActiveChat: false, isGroup: false, phone: '', name: '', isRawPhone: false };
          }

          window.__zapprPhoneCache = window.__zapprPhoneCache || {};

          function extractPhoneFromText(str) {
            if (!str) return '';
            const intl = /\\+[\\d\\s()–—\\-]{6,25}/.exec(str);
            if (intl) {
              const digits = intl[0].replace(/\\D/g, '');
              if (digits.length >= 8 && digits.length <= 16) return digits;
            }
            const allDigits = str.replace(/\\D/g, '');
            if (allDigits.length >= 10 && allDigits.length <= 16) {
              const letterCount = (str.match(/[a-zA-Z\\u00C0-\\u017F]/g) || []).length;
              if (letterCount <= 3) return allDigits;
            }
            return '';
          }

          function checkIfGroup(el) {
            if (!el) return false;

            const hdr = el.querySelector('header');
            if (hdr) {
              if (hdr.querySelector('[data-icon*="default-user"], [data-testid*="default-user"]')) {
                return false;
              }
              const hdrText = (hdr.textContent || '').toLowerCase();
              if (
                hdrText.includes('online') ||
                hdrText.includes('visto por') ||
                hdrText.includes('last seen') ||
                hdrText.includes('digitando...') ||
                hdrText.includes('typing...')
              ) {
                return false;
              }

              if (
                hdr.querySelector(
                  '[data-icon*="group"], [data-testid*="group"], [data-icon*="community"], [data-testid*="community"]'
                )
              ) {
                return true;
              }
              if (
                hdrText.includes('dados do grupo') ||
                hdrText.includes('group info') ||
                hdrText.includes('informações do grupo') ||
                hdrText.includes('información del grupo') ||
                hdrText.includes('admin do grupo') ||
                hdrText.includes('group admin') ||
                hdrText.includes('somente admins') ||
                hdrText.includes('only admins') ||
                hdrText.includes('participantes') ||
                hdrText.includes('participants')
              ) {
                return true;
              }
              if (/(?:^|\\s)(?:você|you|tú),\\s/i.test(hdrText)) {
                return true;
              }
            }

            const selRow = document.querySelector(
              '#pane-side [aria-selected="true"], #pane-side div[role="listitem"].active, #pane-side div[role="row"][aria-selected="true"]'
            );
            if (selRow) {
              const rowId = selRow.getAttribute('data-id') || selRow.querySelector('[data-id]')?.getAttribute('data-id') || '';
              if (rowId.includes('@c.us') || rowId.includes('@s.whatsapp.net')) return false;
              if (rowId.includes('@g.us')) return true;
              if (selRow.querySelector('[data-icon*="default-user"], [data-testid*="default-user"]')) return false;
              if (
                selRow.querySelector(
                  '[data-icon*="group"], [data-testid*="group"], [data-icon*="community"], [data-testid*="community"]'
                )
              ) {
                return true;
              }
            }

            const msgs = el.querySelectorAll('[data-id*="@c.us"], [data-id*="@g.us"], [data-id*="@s.whatsapp.net"]');
            for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 8); i--) {
              const dId = msgs[i].getAttribute('data-id') || '';
              if (/^(?:true|false)_\\d+@(c\\.us|s\\.whatsapp\\.net)/.test(dId)) {
                return false;
              }
              if (/^(?:true|false)_\\d+@g\\.us/.test(dId)) {
                return true;
              }
            }

            const footer = el.querySelector('footer');
            if (footer) {
              const fTxt = (footer.textContent || '').toLowerCase();
              if (fTxt.includes('somente admins') || fTxt.includes('only admins')) return true;
            }
            return false;
          }

          const isGroup = checkIfGroup(mainEl);
          let phone = '';
          let name = '';
          let isRawPhone = false;

          const header = mainEl.querySelector('header');
          if (header) {
            const titleEl = header.querySelector(
              'span[dir="auto"][title], div[role="button"] span[title], span[title], h2, [data-testid="conversation-info-header"]'
            );
            if (titleEl) {
              name = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
            } else {
              const anySpan = header.querySelector('span[dir="auto"]');
              if (anySpan) name = anySpan.textContent.trim();
            }

            phone = extractPhoneFromText(name);
            if (phone) {
              isRawPhone = true;
            } else {
              const headerSpans = header.querySelectorAll('span');
              for (const s of headerSpans) {
                if (s.children.length > 2) continue;
                const found = extractPhoneFromText(s.textContent || '');
                if (found) {
                  phone = found;
                  isRawPhone = true;
                  break;
                }
              }
            }
          }

          if (!phone && name && window.__zapprPhoneCache[name]) {
            phone = window.__zapprPhoneCache[name];
          }

          const hasRealName = Boolean(name && /[a-zA-Z\\u00C0-\\u017F]{2,}/.test(name) && !name.includes('+'));
          if (!phone && !hasRealName && !isGroup) {
            const msgEls = mainEl.querySelectorAll('[data-id*="@c.us"], [data-id*="@s.whatsapp.net"]');
            for (let i = msgEls.length - 1; i >= 0; i--) {
              const dataId = msgEls[i].getAttribute('data-id') || '';
              const m = /^false_(\\d{8,16})@(c\\.us|s\\.whatsapp\\.net)/.exec(dataId);
              if (m && m[1]) {
                phone = m[1];
                isRawPhone = true;
                break;
              }
            }
          }

          if (!phone && !isGroup) {
            const drawer = document.querySelector(
              '[data-testid="contact-info-drawer"], [data-testid="chat-info-drawer"], [data-testid="drawer-right"]'
            );
            if (drawer) {
              const spans = drawer.querySelectorAll('span, div, p');
              for (const s of spans) {
                if (s.children.length > 2) continue;
                const found = extractPhoneFromText(s.textContent || '');
                if (found) {
                  phone = found;
                  if (name) window.__zapprPhoneCache[name] = found;
                  break;
                }
              }
            }
          }

          return {
            hasActiveChat: true,
            isGroup: isGroup,
            phone: phone || '',
            name: name || '',
            isRawPhone: isRawPhone
          };
        } catch (_) {
          return { hasActiveChat: Boolean(document.querySelector('#main')), isGroup: false, phone: '', name: '', isRawPhone: false };
        }
      })()
    `);
    if (res && res.name && res.phone) {
      nodePhoneCacheByName.set(res.name, res.phone);
    }
    return res || { hasActiveChat: false, isGroup: false, phone: "", name: "", isRawPhone: false };
  } catch {
    return { hasActiveChat: false, isGroup: false, phone: "", name: "", isRawPhone: false };
  }
}

async function sendPredefinedMessageToWebContents(webContents, textToSend) {
  if (!webContents || webContents.isDestroyed()) {
    return { ok: false, error: "WebContents destroyed" };
  }

  const script = `
    (async function() {
      try {
        const main = document.querySelector('#main');
        if (!main) return { ok: false, error: 'Nenhuma conversa aberta' };

        const footer = main.querySelector('footer');
        if (!footer) return { ok: false, error: 'Campo de mensagem não encontrado' };

        const chatInput = footer.querySelector('div[contenteditable="true"], div[data-lexical-editor="true"]');
        if (!chatInput) return { ok: false, error: 'Editor de texto não encontrado' };

        chatInput.focus();

        const messageText = ${JSON.stringify(textToSend)};

        // Insert text into editor
        let inserted = false;
        try {
          const dt = new DataTransfer();
          dt.setData('text/plain', messageText);
          const pasteEvt = new ClipboardEvent('paste', {
            clipboardData: dt,
            bubbles: true,
            cancelable: true
          });
          chatInput.dispatchEvent(pasteEvt);
          inserted = true;
        } catch (_) {}

        if (!inserted || chatInput.textContent.trim().length === 0) {
          try {
            document.execCommand('insertText', false, messageText);
          } catch (_) {}
        }

        // Wait a tick for Lexical state to update
        await new Promise(r => setTimeout(r, 120));

        // Locate send button
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
            '[data-icon*="send"]'
          ];
          for (const sel of directSelectors) {
            const el = footer.querySelector(sel);
            if (el) {
              return el.closest('button, [role="button"]') || el;
            }
          }

          const ariaMatches = footer.querySelectorAll('button[aria-label], [role="button"][aria-label]');
          for (const el of ariaMatches) {
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('enviar') || label.includes('send')) {
              return el;
            }
          }

          const paths = footer.querySelectorAll('path');
          for (const p of paths) {
            const d = p.getAttribute('d') || '';
            if (d.includes('21.757') || d.includes('12.028') || d.includes('1.101') || d.includes('13.623')) {
              return p.closest('button, [role="button"]') || p.closest('span') || p;
            }
          }

          const buttons = footer.querySelectorAll('button, [role="button"]');
          for (const btn of buttons) {
            const html = btn.outerHTML.toLowerCase();
            const isMic = html.includes('ptt') || html.includes('audio-mic') || html.includes('mic') || html.includes('grav');
            const isAttach = html.includes('attach') || html.includes('anexo') || html.includes('clip');
            const isEmoji = html.includes('smiley') || html.includes('emoji') || html.includes('sticker');
            if (!isMic && !isAttach && !isEmoji) {
              return btn;
            }
          }

          return null;
        }

        const sendBtn = findSendButton();
        if (sendBtn) {
          sendBtn.click();
          return { ok: true, clicked: true };
        } else {
          return { ok: true, needEnterKey: true };
        }
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    })()
  `;

  const result = await webContents.executeJavaScript(script);
  if (result && result.needEnterKey) {
    webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" });
    webContents.sendInputEvent({ type: "char", keyCode: "Enter" });
    webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" });
  }

  return result || { ok: false };
}

async function executeButton(buttonId) {
  const btn = getButton(buttonId);
  if (!btn) return { ok: false, error: "Botão não encontrado" };

  const { getWhatsAppContents } = require("../mainWindow");
  const contents = getWhatsAppContents();
  if (!contents || contents.isDestroyed()) {
    return { ok: false, error: "Sessão não disponível" };
  }

  // Resolves the contact phone: if the contact has a name, opens "Dados do contato",
  // extracts the real phone number, and closes the drawer with "X".
  const chatStatus = await resolveContactPhoneViaDrawer(contents);
  if (!chatStatus.hasActiveChat) {
    return { ok: false, error: "Nenhuma conversa aberta no WhatsApp" };
  }

  if (btn.type === "url" && chatStatus.isGroup) {
    return { ok: false, error: "Botão de link externo não disponível em grupos" };
  }

  let phone = chatStatus.phone || "";
  const name = chatStatus.name || "";

  if (!phone && name && nodePhoneCacheByName.has(name)) {
    phone = nodePhoneCacheByName.get(name);
  }


  if (btn.type === "url") {
    let targetUrl = btn.url || "";
    targetUrl = targetUrl
      .replace(/\{telefone\}/gi, phone)
      .replace(/\{phone\}/gi, phone)
      .replace(/\{nome\}/gi, encodeURIComponent(name))
      .replace(/\{name\}/gi, encodeURIComponent(name));

    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      await shell.openExternal(targetUrl);
      return { ok: true, url: targetUrl };
    } catch (err) {
      console.error("Erro ao abrir URL externo:", err);
      return { ok: false, error: String(err) };
    }
  } else if (btn.type === "message") {
    let msg = btn.message || "";
    msg = msg
      .replace(/\{telefone\}/gi, phone)
      .replace(/\{phone\}/gi, phone)
      .replace(/\{nome\}/gi, name)
      .replace(/\{name\}/gi, name);

    return await sendPredefinedMessageToWebContents(contents, msg);
  }

  return { ok: false, error: "Tipo de botão desconhecido" };
}

function showButtonContextMenu(buttonId, parentWin) {
  const btn = getButton(buttonId);
  if (!btn) return;

  const win =
    parentWin || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

  const template = [
    {
      label: `Executar "${btn.name}"`,
      click: () => executeButton(buttonId),
    },
    { type: "separator" },
    {
      label: "Editar Botão...",
      click: () =>
        openCustomButtonModal(win, {
          mode: "edit",
          buttonId,
        }),
    },
    {
      label: "Excluir Botão",
      click: () => deleteButton(buttonId),
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win });
}

let ipcInitialized = false;

function initCustomButtonsIPC() {
  if (ipcInitialized) return;
  ipcInitialized = true;

  ipcMain.handle("customButtons:list", (_event, activeSessionId) => {
    return listButtons(activeSessionId);
  });

  ipcMain.handle("customButtons:get", (_event, buttonId) => {
    return getButton(buttonId);
  });

  ipcMain.handle("customButtons:save", (_event, data) => {
    if (data.id) {
      return updateButton(data);
    }
    return createButton(data);
  });

  ipcMain.handle("customButtons:delete", (_event, buttonId) => {
    return deleteButton(buttonId);
  });

  ipcMain.handle("customButtons:execute", (_event, buttonId) => {
    return executeButton(buttonId);
  });

  ipcMain.handle("customButtons:list-icons", () => {
    return listIcons();
  });

  ipcMain.handle("customButtons:open-add", (_event, currentSessionId) => {
    const parent = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    openCustomButtonModal(parent, { mode: "create", currentSessionId });
    return { ok: true };
  });

  ipcMain.handle("customButtons:open-edit", (_event, buttonId) => {
    const parent = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    openCustomButtonModal(parent, { mode: "edit", buttonId });
    return { ok: true };
  });

  ipcMain.on("customButtons:context-menu", (event, buttonId) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    showButtonContextMenu(buttonId, win);
  });

  ipcMain.on("customButtons:modal-close", () => {
    closeCustomButtonModal();
  });

  ipcMain.handle("customButtons:get-chat-status", async () => {
    const { getWhatsAppContents } = require("../mainWindow");
    const contents = getWhatsAppContents();
    if (!contents) return { hasActiveChat: false, phone: "", name: "" };
    return await getChatStatusFromWebContents(contents);
  });
}

module.exports = {
  getStoredButtons,
  listButtons,
  getButton,
  createButton,
  updateButton,
  deleteButton,
  executeButton,
  getChatStatusFromWebContents,
  resolveContactPhoneViaDrawer,
  initCustomButtonsIPC,
  getIconSvg,
  openCustomButtonModal,
};

