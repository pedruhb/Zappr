"use strict";

const menusEl = document.getElementById("menus");
const titleEl = document.getElementById("title");
const sidebarEl = document.getElementById("sessions-sidebar");

let currentActiveId = "zappr";
let currentSessions = [];
let currentCustomButtons = [];
const unreadCounts = new Map(); // desktopId -> unread count
const qrWaitingSessions = new Map(); // desktopId -> boolean
const activeChatStatuses = new Map(); // desktopId -> { hasActiveChat: boolean, isGroup: boolean, phone: string, name: string }

let currentAddSessionLabel = "Criar Sessão";
let currentMutedLabel = "Mute audio";

const CUSTOM_ICONS = {
  "external-link": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
  "message-square": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
  "phone-call": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
  "dollar-sign": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
  "credit-card": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
  "shopping-cart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  "check-circle": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  "file-text": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
  headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
  "help-circle": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
};

function getCustomIconSvg(iconId) {
  return CUSTOM_ICONS[iconId] || CUSTOM_ICONS["external-link"];
}

function updateSessionUnreadBadge(desktopId, count) {
  unreadCounts.set(desktopId, count);
  const badge = sidebarEl.querySelector(
    `.session-unread-badge[data-unread-badge="${desktopId}"]`,
  );
  if (!badge) return;

  const hasUnread = count && count !== "0" && count !== 0;
  if (hasUnread) {
    const text = String(count);
    if (badge.textContent !== text) {
      badge.textContent = text;
      badge.classList.remove("badge-bounce");
      void badge.offsetWidth;
      badge.classList.add("badge-bounce");
    }
    badge.hidden = false;
  } else {
    badge.textContent = "";
    badge.hidden = true;
  }
}

function updateSessionQrBadge(desktopId, isQrWaiting) {
  qrWaitingSessions.set(desktopId, Boolean(isQrWaiting));
  const badge = sidebarEl.querySelector(
    `.session-qr-badge[data-qr-badge="${desktopId}"]`,
  );
  if (badge) {
    badge.hidden = !isQrWaiting;
  }
}

window.__updateSessionUnreadBadge = updateSessionUnreadBadge;
window.__sessionUnreadCounts = unreadCounts;

function renderTitlebar({ title, bg, fg, menus, addSessionLabel, mutedLabel }) {
  document.documentElement.style.setProperty("--bg", bg);
  document.documentElement.style.setProperty("--fg", fg);
  if (title) {
    titleEl.textContent = title;
    document.title = title;
  }

  if (mutedLabel) {
    currentMutedLabel = mutedLabel;
  }

  if (addSessionLabel) {
    currentAddSessionLabel = addSessionLabel.includes("...")
      ? "Criar Sessão"
      : addSessionLabel;
  }
  const addBtn = document.querySelector(".add-session-btn");
  if (addBtn) {
    addBtn.setAttribute("aria-label", currentAddSessionLabel);
    addBtn.setAttribute("title", currentAddSessionLabel);
    if (addBtn.parentElement) {
      addBtn.parentElement.setAttribute("title", currentAddSessionLabel);
      const addTooltip = addBtn.parentElement.querySelector(".session-tooltip");
      if (addTooltip) addTooltip.textContent = currentAddSessionLabel;
    }
  }

  menusEl.innerHTML = "";
  for (const { id, label } of menus) {
    const button = document.createElement("button");
    button.textContent = label;
    if (id !== "about") {
      button.setAttribute("aria-haspopup", "menu");
    }
    button.addEventListener("click", () => {
      const rect = button.getBoundingClientRect();
      window.titlebar.openMenu(
        id,
        Math.round(rect.left),
        Math.round(rect.bottom),
      );
    });
    menusEl.appendChild(button);
  }
}

// Crisp Plus Icon SVG for Add Session button
const PLUS_ICON_SVG = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
`;

function getInitials(name) {
  if (!name) return "S";
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (clean.slice(0, 2) || name.slice(0, 2) || "S").toUpperCase();
}

function getContrastColor(hexColor) {
  if (!hexColor) return "#1D1F1F";
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111b21" : "#ffffff";
}

function applySessionStyle(wrapper, session, isCurrent) {
  const sessionColor = session ? session.color : null;
  const btn = wrapper.querySelector(".session-btn");
  const pill = wrapper.querySelector(".session-pill");
  if (!btn) return;

  if (pill) {
    pill.style.backgroundColor = sessionColor && isCurrent ? sessionColor : "";
  }

  const hasAvatar = session && Boolean(session.avatar);
  if (hasAvatar) {
    if (sessionColor) {
      btn.style.border = isCurrent
        ? `2.5px solid ${sessionColor}`
        : `2px solid ${sessionColor}aa`;
      btn.style.boxShadow = isCurrent ? `0 4px 14px ${sessionColor}66` : "";
    } else {
      btn.style.border = "";
      btn.style.boxShadow = "";
    }
    btn.style.backgroundColor = "";
    btn.style.color = "";
  } else {
    if (sessionColor) {
      if (isCurrent) {
        btn.style.backgroundColor = sessionColor;
        btn.style.color = getContrastColor(sessionColor);
        btn.style.boxShadow = `0 4px 14px ${sessionColor}66`;
        btn.style.border = "";
      } else {
        btn.style.backgroundColor = "var(--item-bg)";
        btn.style.color = sessionColor;
        btn.style.border = `1.5px solid ${sessionColor}aa`;
        btn.style.boxShadow = "";
      }
    } else {
      btn.style.backgroundColor = "";
      btn.style.color = "";
      btn.style.border = "";
      btn.style.boxShadow = "";
    }
  }
}

function updateActiveSidebar() {
  const wrappers = sidebarEl.querySelectorAll(".session-wrapper");
  for (const w of wrappers) {
    const id = w.getAttribute("data-desktop-id");
    if (id) {
      const isCurrent = id === currentActiveId;
      w.classList.toggle("active", isCurrent);
      const s = currentSessions.find((item) => item.desktopId === id);
      applySessionStyle(w, s, isCurrent);
    }
  }

  const activeSession = currentSessions.find(
    (s) => s.desktopId === currentActiveId,
  );
  if (activeSession) {
    let name = activeSession.profileName || "";
    const m = /^Zappr\s*\((.+)\)$/i.exec(name);
    if (m) {
      name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    }
    const titleText = name ? `Zappr - ${name}` : "Zappr";
    titleEl.textContent = titleText;
    document.title = titleText;
  }
}

let draggedDesktopId = null;

function buildSidebarDOM() {
  sidebarEl.innerHTML = "";

  // Render each session icon
  for (const session of currentSessions) {
    const isCurrent = session.desktopId === currentActiveId;
    const wrapper = document.createElement("div");
    wrapper.className = `session-wrapper${isCurrent ? " active" : ""}`;
    wrapper.setAttribute("data-desktop-id", session.desktopId);
    wrapper.setAttribute("draggable", "true");

    // Discord-style Pill Indicator
    const pill = document.createElement("div");
    pill.className = "session-pill";
    wrapper.appendChild(pill);

    // Discord-style Icon Button
    const btn = document.createElement("button");
    btn.className = "session-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", session.profileName);
    btn.setAttribute("title", session.profileName);
    wrapper.setAttribute("title", session.profileName);

    if (session.avatar) {
      const img = document.createElement("img");
      img.className = "session-avatar-img";
      img.src = session.avatar;
      img.alt = session.profileName;
      img.setAttribute("draggable", "false");
      btn.appendChild(img);
    } /* else if (session.desktopId === "zappr") {
      btn.innerHTML = WHATSAPP_ICON_SVG;
    }  */ else {
      btn.textContent = getInitials(session.profileName);
    }

    // Left-click switches session tab in the same window
    btn.addEventListener("click", () => {
      if (session.desktopId !== currentActiveId) {
        currentActiveId = session.desktopId;
        updateActiveSidebar();
        window.sessionsSidebar.switch(session.desktopId);
      }
    });

    // Right-click opens context menu to Edit / Delete
    const onContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.sessionsSidebar.showContextMenu(session.desktopId);
    };
    wrapper.addEventListener("contextmenu", onContextMenu);
    btn.addEventListener("contextmenu", onContextMenu);

    // Drag and drop reordering
    wrapper.addEventListener("dragstart", (e) => {
      draggedDesktopId = session.desktopId;
      document.body.classList.add("is-dragging");
      wrapper.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", session.desktopId);
    });

    wrapper.addEventListener("dragover", (e) => {
      if (!draggedDesktopId || draggedDesktopId === session.desktopId) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      for (const w of sidebarEl.querySelectorAll(".session-wrapper")) {
        if (w !== wrapper) {
          w.classList.remove("drag-over-top", "drag-over-bottom");
        }
      }

      const rect = wrapper.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const isTop = e.clientY < midY;
      wrapper.classList.toggle("drag-over-top", isTop);
      wrapper.classList.toggle("drag-over-bottom", !isTop);
    });

    wrapper.addEventListener("dragleave", (e) => {
      if (!wrapper.contains(e.relatedTarget)) {
        wrapper.classList.remove("drag-over-top", "drag-over-bottom");
      }
    });

    wrapper.addEventListener("drop", (e) => {
      if (!draggedDesktopId || draggedDesktopId === session.desktopId) {
        return;
      }
      e.preventDefault();
      const isTop = wrapper.classList.contains("drag-over-top");
      wrapper.classList.remove("drag-over-top", "drag-over-bottom");

      const fromIndex = currentSessions.findIndex(
        (s) => s.desktopId === draggedDesktopId,
      );
      const targetIndex = currentSessions.findIndex(
        (s) => s.desktopId === session.desktopId,
      );

      if (fromIndex !== -1 && targetIndex !== -1 && fromIndex !== targetIndex) {
        const newSessions = [...currentSessions];
        const [movedItem] = newSessions.splice(fromIndex, 1);
        let insertIndex = newSessions.findIndex(
          (s) => s.desktopId === session.desktopId,
        );
        if (!isTop) {
          insertIndex += 1;
        }
        newSessions.splice(insertIndex, 0, movedItem);
        currentSessions = newSessions;

        buildSidebarDOM();
        const orderedIds = currentSessions.map((s) => s.desktopId);
        window.sessionsSidebar.reorder(orderedIds);
      }
    });

    wrapper.addEventListener("dragend", () => {
      draggedDesktopId = null;
      document.body.classList.remove("is-dragging");
      for (const w of sidebarEl.querySelectorAll(".session-wrapper")) {
        w.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
      }
    });

    wrapper.appendChild(btn);

    if (session.muted) {
      const mutedBadge = document.createElement("div");
      mutedBadge.className = "session-muted-badge";
      mutedBadge.title = currentMutedLabel || "Áudio mutado";
      mutedBadge.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      `;
      wrapper.appendChild(mutedBadge);
    }

    // QR Code / waiting login badge (bottom left)
    const isQr = Boolean(qrWaitingSessions.get(session.desktopId));
    const qrBadge = document.createElement("div");
    qrBadge.className = "session-qr-badge";
    qrBadge.setAttribute("data-qr-badge", session.desktopId);
    qrBadge.title = "Aguardando leitura do QR Code";
    qrBadge.hidden = !isQr;
    qrBadge.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
      </svg>
    `;
    wrapper.appendChild(qrBadge);

    // Unread conversations badge (top right)
    const unreadBadge = document.createElement("div");
    unreadBadge.className = "session-unread-badge";
    unreadBadge.setAttribute("data-unread-badge", session.desktopId);
    const unreadCount = unreadCounts.get(session.desktopId);
    if (unreadCount && unreadCount !== "0" && unreadCount !== 0) {
      unreadBadge.textContent = String(unreadCount);
      unreadBadge.hidden = false;
    } else {
      unreadBadge.hidden = true;
    }
    wrapper.appendChild(unreadBadge);

    applySessionStyle(wrapper, session, isCurrent);

    // Floating Discord-style Tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "session-tooltip";
    tooltip.textContent = session.profileName;
    wrapper.appendChild(tooltip);

    sidebarEl.appendChild(wrapper);
  }

  // Divider
  const divider = document.createElement("div");
  divider.className = "sessions-divider";
  sidebarEl.appendChild(divider);

  // Add Session (+) Button
  const addWrapper = document.createElement("div");
  addWrapper.className = "session-wrapper";
  addWrapper.setAttribute("title", currentAddSessionLabel);

  const addBtn = document.createElement("button");
  addBtn.className = "add-session-btn";
  addBtn.type = "button";
  addBtn.innerHTML = PLUS_ICON_SVG;
  addBtn.setAttribute("aria-label", currentAddSessionLabel);
  addBtn.setAttribute("title", currentAddSessionLabel);
  addBtn.addEventListener("click", () => {
    window.sessionsSidebar.openAdd();
  });
  addWrapper.appendChild(addBtn);

  const addTooltip = document.createElement("div");
  addTooltip.className = "session-tooltip";
  addTooltip.textContent = currentAddSessionLabel;
  addWrapper.appendChild(addTooltip);

  sidebarEl.appendChild(addWrapper);

  // Divider before Custom Buttons
  const customDivider = document.createElement("div");
  customDivider.className = "custom-buttons-divider";
  sidebarEl.appendChild(customDivider);

  // Render Custom Buttons (visible for current active session)
  const visibleButtons = currentCustomButtons.filter(
    (b) => b.scope === "global" || b.sessionId === currentActiveId,
  );

  const activeChat = activeChatStatuses.get(currentActiveId);
  const isChatOpen = Boolean(activeChat && activeChat.hasActiveChat);
  const isGroup = Boolean(activeChat && activeChat.isGroup);

  for (const btnData of visibleButtons) {
    const isUrlBtn = btnData.type === "url";
    const isDisabled = !isChatOpen || (isUrlBtn && isGroup);

    const wrapper = document.createElement("div");
    wrapper.className = `session-wrapper custom-btn-wrapper${isDisabled ? " has-disabled-btn" : ""}`;
    wrapper.setAttribute("data-custom-btn-id", btnData.id);

    const btn = document.createElement("button");
    btn.className = `custom-action-btn${isDisabled ? " disabled" : ""}`;
    btn.type = "button";
    btn.disabled = isDisabled;
    btn.setAttribute("aria-label", btnData.name);

    let tooltipText = btnData.name;
    if (!isChatOpen) {
      tooltipText = `${btnData.name} (Nenhuma conversa aberta)`;
    } else if (isUrlBtn && isGroup) {
      tooltipText = `${btnData.name} (Indisponível em grupos)`;
    }

    btn.setAttribute("title", tooltipText);
    wrapper.setAttribute("title", tooltipText);

    const btnColor = btnData.color || "#00a884";
    btn.style.backgroundColor = btnColor;
    btn.style.color = getContrastColor(btnColor);

    const iconSvg = getCustomIconSvg(btnData.icon);
    btn.innerHTML = iconSvg;

    btn.addEventListener("click", () => {
      const currentStatus = activeChatStatuses.get(currentActiveId);
      if (btnData.type === "url" && currentStatus && currentStatus.isGroup) {
        return;
      }
      btn.classList.add("custom-btn-pulse");
      setTimeout(() => btn.classList.remove("custom-btn-pulse"), 400);
      if (window.customButtons && typeof window.customButtons.execute === "function") {
        window.customButtons.execute(btnData.id);
      }
    });

    const onContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.customButtons && typeof window.customButtons.showContextMenu === "function") {
        window.customButtons.showContextMenu(btnData.id);
      }
    };
    btn.addEventListener("contextmenu", onContextMenu);
    wrapper.addEventListener("contextmenu", onContextMenu);

    wrapper.appendChild(btn);

    const tooltip = document.createElement("div");
    tooltip.className = "session-tooltip";
    tooltip.textContent = tooltipText;
    wrapper.appendChild(tooltip);

    sidebarEl.appendChild(wrapper);
  }

  // Add Custom Button (+)
  const addCustomWrapper = document.createElement("div");
  addCustomWrapper.className = "session-wrapper";
  addCustomWrapper.setAttribute("title", "Criar Botão");

  const addCustomBtn = document.createElement("button");
  addCustomBtn.className = "add-custom-btn";
  addCustomBtn.type = "button";
  addCustomBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `;
  addCustomBtn.setAttribute("aria-label", "Criar Botão");
  addCustomBtn.setAttribute("title", "Criar Botão");
  addCustomBtn.addEventListener("click", () => {
    if (window.customButtons && typeof window.customButtons.openAdd === "function") {
      window.customButtons.openAdd(currentActiveId);
    }
  });
  addCustomWrapper.appendChild(addCustomBtn);

  const addCustomTooltip = document.createElement("div");
  addCustomTooltip.className = "session-tooltip";
  addCustomTooltip.textContent = "Criar Botão";
  addCustomWrapper.appendChild(addCustomTooltip);

  sidebarEl.appendChild(addCustomWrapper);

  updateActiveSidebar();
}

function updateCustomButtonsChatStatus(desktopId, hasActiveChat, isGroup) {
  const prev = activeChatStatuses.get(desktopId) || {};
  const groupStatus =
    isGroup !== undefined ? Boolean(isGroup) : Boolean(prev.isGroup);
  activeChatStatuses.set(desktopId, {
    ...prev,
    hasActiveChat,
    isGroup: groupStatus,
  });
  if (desktopId !== currentActiveId) return;

  const btnWrappers = sidebarEl.querySelectorAll(".custom-btn-wrapper");
  for (const w of btnWrappers) {
    const btnId = w.getAttribute("data-custom-btn-id");
    const btn = w.querySelector(".custom-action-btn");
    const tooltip = w.querySelector(".session-tooltip");
    const btnData = currentCustomButtons.find((b) => b.id === btnId);
    if (!btn || !btnData) continue;

    const isUrlBtn = btnData.type === "url";
    const isDisabled = !hasActiveChat || (isUrlBtn && groupStatus);

    btn.disabled = isDisabled;
    btn.classList.toggle("disabled", isDisabled);
    w.classList.toggle("has-disabled-btn", isDisabled);

    let tooltipText = btnData.name;
    if (!hasActiveChat) {
      tooltipText = `${btnData.name} (Nenhuma conversa aberta)`;
    } else if (isUrlBtn && groupStatus) {
      tooltipText = `${btnData.name} (Indisponível em grupos)`;
    }

    btn.setAttribute("title", tooltipText);
    w.setAttribute("title", tooltipText);

    if (tooltip) {
      tooltip.textContent = tooltipText;
    }
  }
}

async function renderSidebar() {
  if (!sidebarEl || !window.sessionsSidebar) return;
  if (draggedDesktopId) return;

  const promises = [
    window.sessionsSidebar.list(),
    window.sessionsSidebar.current(),
  ];

  if (window.customButtons) {
    promises.push(window.customButtons.list(currentActiveId));
    promises.push(window.customButtons.getChatStatus(currentActiveId));
  }

  const results = await Promise.all(promises);
  const sessions = results[0];
  const current = results[1];
  const customBtns = results[2];
  const chatStatus = results[3];

  currentSessions = sessions || [];
  if (current && current.desktopId) {
    currentActiveId = current.desktopId;
  }
  if (customBtns) {
    currentCustomButtons = customBtns;
  }
  if (chatStatus) {
    activeChatStatuses.set(currentActiveId, {
      ...chatStatus,
      isGroup: Boolean(chatStatus.isGroup),
    });
  }

  buildSidebarDOM();
}

if (sidebarEl) {
  sidebarEl.addEventListener("dragover", (e) => {
    if (!draggedDesktopId) return;
    const sessionWrappers = Array.from(
      sidebarEl.querySelectorAll(".session-wrapper[data-desktop-id]"),
    );
    if (sessionWrappers.length === 0) return;

    const firstWrapper = sessionWrappers[0];
    const firstRect = firstWrapper.getBoundingClientRect();
    if (e.clientY < firstRect.top && e.clientY > firstRect.top - 40) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      for (const w of sessionWrappers) {
        if (w !== firstWrapper) {
          w.classList.remove("drag-over-top", "drag-over-bottom");
        }
      }
      firstWrapper.classList.add("drag-over-top");
      firstWrapper.classList.remove("drag-over-bottom");
      return;
    }

    const lastWrapper = sessionWrappers[sessionWrappers.length - 1];
    const lastRect = lastWrapper.getBoundingClientRect();
    if (e.clientY > lastRect.bottom && e.clientY < lastRect.bottom + 60) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      for (const w of sessionWrappers) {
        if (w !== lastWrapper) {
          w.classList.remove("drag-over-top", "drag-over-bottom");
        }
      }
      lastWrapper.classList.add("drag-over-bottom");
      lastWrapper.classList.remove("drag-over-top");
    }
  });

  sidebarEl.addEventListener("drop", (e) => {
    if (!draggedDesktopId) return;
    const sessionWrappers = Array.from(
      sidebarEl.querySelectorAll(".session-wrapper[data-desktop-id]"),
    );
    if (sessionWrappers.length === 0) return;

    const firstWrapper = sessionWrappers[0];
    if (
      firstWrapper.classList.contains("drag-over-top") &&
      !e.defaultPrevented
    ) {
      e.preventDefault();
      firstWrapper.classList.remove("drag-over-top");
      const firstId = firstWrapper.getAttribute("data-desktop-id");
      if (draggedDesktopId !== firstId) {
        const fromIndex = currentSessions.findIndex(
          (s) => s.desktopId === draggedDesktopId,
        );
        if (fromIndex !== -1) {
          const newSessions = [...currentSessions];
          const [movedItem] = newSessions.splice(fromIndex, 1);
          newSessions.unshift(movedItem);
          currentSessions = newSessions;
          buildSidebarDOM();
          const orderedIds = currentSessions.map((s) => s.desktopId);
          window.sessionsSidebar.reorder(orderedIds);
        }
      }
      return;
    }

    const lastWrapper = sessionWrappers[sessionWrappers.length - 1];
    if (
      lastWrapper.classList.contains("drag-over-bottom") &&
      !e.defaultPrevented
    ) {
      e.preventDefault();
      lastWrapper.classList.remove("drag-over-bottom");
      const lastId = lastWrapper.getAttribute("data-desktop-id");
      if (draggedDesktopId !== lastId) {
        const fromIndex = currentSessions.findIndex(
          (s) => s.desktopId === draggedDesktopId,
        );
        if (fromIndex !== -1) {
          const newSessions = [...currentSessions];
          const [movedItem] = newSessions.splice(fromIndex, 1);
          newSessions.push(movedItem);
          currentSessions = newSessions;
          buildSidebarDOM();
          const orderedIds = currentSessions.map((s) => s.desktopId);
          window.sessionsSidebar.reorder(orderedIds);
        }
      }
    }
  });
}

/* ============================================================
   IPC EVENT LISTENERS
   ============================================================ */
window.titlebar.get().then(renderTitlebar);
window.titlebar.onState(renderTitlebar);

if (window.sessionsSidebar) {
  renderSidebar();

  if (typeof window.sessionsSidebar.getUnreadCounts === "function") {
    window.sessionsSidebar
      .getUnreadCounts()
      .then((counts) => {
        if (counts) {
          for (const [id, count] of Object.entries(counts)) {
            updateSessionUnreadBadge(id, count);
          }
        }
      })
      .catch(() => {});
  }

  if (typeof window.sessionsSidebar.onUnreadUpdated === "function") {
    window.sessionsSidebar.onUnreadUpdated(({ desktopId, count }) => {
      updateSessionUnreadBadge(desktopId, count);
    });
  }

  if (typeof window.sessionsSidebar.getStatuses === "function") {
    window.sessionsSidebar
      .getStatuses()
      .then((statuses) => {
        if (statuses) {
          for (const [id, data] of Object.entries(statuses)) {
            updateSessionQrBadge(id, data.isQrWaiting);
          }
        }
      })
      .catch(() => {});
  }

  if (typeof window.sessionsSidebar.onStatusUpdated === "function") {
    window.sessionsSidebar.onStatusUpdated(({ desktopId, isQrWaiting }) => {
      updateSessionQrBadge(desktopId, isQrWaiting);
    });
  }

  window.sessionsSidebar.onChanged(() => {
    renderSidebar();
  });

  window.sessionsSidebar.onActiveChanged(async (id) => {
    currentActiveId = id;
    updateActiveSidebar();
    if (window.customButtons) {
      try {
        const [btns, status] = await Promise.all([
          window.customButtons.list(id),
          window.customButtons.getChatStatus(id),
        ]);
        if (btns) currentCustomButtons = btns;
        if (status) {
          activeChatStatuses.set(id, {
            ...status,
            isGroup: Boolean(status.isGroup),
          });
        }
        buildSidebarDOM();
      } catch (err) {
        console.error("Error updating buttons on session switch:", err);
      }
    }
  });

  window.sessionsSidebar.onFullscreen((isFullscreen) => {
    document.body.classList.toggle("fullscreen", isFullscreen);
  });
}

if (window.customButtons) {
  window.customButtons.onChanged(async () => {
    if (window.customButtons.list) {
      try {
        currentCustomButtons =
          (await window.customButtons.list(currentActiveId)) || [];
        buildSidebarDOM();
      } catch (err) {
        console.error("Error refreshing custom buttons:", err);
      }
    }
  });

  window.customButtons.onChatStatusChanged(
    ({ desktopId, hasActiveChat, isGroup, phone, name }) => {
      activeChatStatuses.set(desktopId, {
        hasActiveChat,
        isGroup: Boolean(isGroup),
        phone,
        name,
      });
      updateCustomButtonsChatStatus(desktopId, hasActiveChat, Boolean(isGroup));
    },
  );
}

