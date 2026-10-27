"use strict";

const PALETTE = [
  "#00a884", // WhatsApp Green
  "#10b981", // Emerald
  "#0ea5e9", // Sky Blue
  "#3b82f6", // Royal Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose Red
  "#f97316", // Orange
  "#f59e0b", // Amber
];

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") || "create";
const editButtonId = params.get("buttonId") || "";
const defaultSessionId = params.get("currentSessionId") || "";

const modalTitleText = document.getElementById("modal-title-text");
const btnClose = document.getElementById("btn-close");
const btnCancel = document.getElementById("btn-cancel");
const btnSave = document.getElementById("btn-save");

const nameInput = document.getElementById("btn-name");
const typeSelector = document.getElementById("type-selector");
const urlSection = document.getElementById("url-config-section");
const messageSection = document.getElementById("message-config-section");
const urlInput = document.getElementById("btn-url");
const messageInput = document.getElementById("btn-message");
const insertUrlVar = document.getElementById("insert-url-var");
const insertMsgVar = document.getElementById("insert-msg-var");

const scopeSelector = document.getElementById("scope-selector");
const sessionSelectWrapper = document.getElementById("session-select-wrapper");
const sessionSelect = document.getElementById("btn-session-select");

const colorsPalette = document.getElementById("colors-palette");
const customColorInput = document.getElementById("custom-color");
const iconsPalette = document.getElementById("icons-palette");
const previewBtn = document.getElementById("preview-btn");

let currentType = "url";
let currentScope = "global";
let currentColor = "#00a884";
let currentIcon = "external-link";
let availableIcons = [];
let allSessions = [];

function getContrastColor(hexColor) {
  if (!hexColor) return "#ffffff";
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#111b21" : "#ffffff";
}

function updatePreview() {
  const iconObj = availableIcons.find((i) => i.id === currentIcon);
  const svg = iconObj ? iconObj.svg : "";
  const textColor = getContrastColor(currentColor);

  previewBtn.style.backgroundColor = currentColor;
  previewBtn.style.color = textColor;
  previewBtn.innerHTML = svg;
}

function selectColor(hex) {
  currentColor = hex;
  customColorInput.value = hex;

  const swatches = colorsPalette.querySelectorAll(".color-swatch");
  for (const s of swatches) {
    s.classList.toggle("active", s.getAttribute("data-color").toLowerCase() === hex.toLowerCase());
  }
  updatePreview();
}

function selectIcon(iconId) {
  currentIcon = iconId;
  const options = iconsPalette.querySelectorAll(".icon-option");
  for (const opt of options) {
    opt.classList.toggle("active", opt.getAttribute("data-icon-id") === iconId);
  }
  updatePreview();
}

function setType(type) {
  currentType = type;
  const buttons = typeSelector.querySelectorAll(".segmented-option");
  for (const btn of buttons) {
    btn.classList.toggle("active", btn.getAttribute("data-type") === type);
  }

  if (type === "url") {
    urlSection.hidden = false;
    messageSection.hidden = true;
    if (mode === "create" && currentIcon === "message-square") {
      selectIcon("external-link");
    }
  } else {
    urlSection.hidden = true;
    messageSection.hidden = false;
    if (mode === "create" && currentIcon === "external-link") {
      selectIcon("message-square");
    }
  }
}

function setScope(scope) {
  currentScope = scope;
  const buttons = scopeSelector.querySelectorAll(".segmented-option");
  for (const btn of buttons) {
    btn.classList.toggle("active", btn.getAttribute("data-scope") === scope);
  }
  sessionSelectWrapper.hidden = scope !== "session";
}

function insertAtCursor(inputEl, textToInsert) {
  inputEl.focus();
  const start = inputEl.selectionStart || 0;
  const end = inputEl.selectionEnd || 0;
  const val = inputEl.value;
  inputEl.value = val.substring(0, start) + textToInsert + val.substring(end);
  const newPos = start + textToInsert.length;
  inputEl.setSelectionRange(newPos, newPos);
}

// Build color palette DOM
function renderColorPalette() {
  for (const hex of PALETTE) {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.setAttribute("data-color", hex);
    swatch.style.backgroundColor = hex;
    if (hex.toLowerCase() === currentColor.toLowerCase()) {
      swatch.classList.add("active");
    }
    swatch.addEventListener("click", () => selectColor(hex));
    colorsPalette.insertBefore(swatch, customColorInput.parentElement);
  }

  customColorInput.addEventListener("input", (e) => {
    selectColor(e.target.value);
  });
}

// Build icon grid DOM
function renderIconGrid() {
  iconsPalette.innerHTML = "";
  for (const icon of availableIcons) {
    const btn = document.createElement("button");
    btn.className = "icon-option";
    btn.type = "button";
    btn.setAttribute("data-icon-id", icon.id);
    btn.setAttribute("title", icon.label);
    btn.innerHTML = icon.svg;
    if (icon.id === currentIcon) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => selectIcon(icon.id));
    iconsPalette.appendChild(btn);
  }
}

// Populate sessions dropdown
function renderSessionsDropdown() {
  sessionSelect.innerHTML = "";
  for (const s of allSessions) {
    const opt = document.createElement("option");
    opt.value = s.desktopId;
    opt.textContent = s.profileName || s.desktopId;
    sessionSelect.appendChild(opt);
  }
  if (defaultSessionId && allSessions.some((s) => s.desktopId === defaultSessionId)) {
    sessionSelect.value = defaultSessionId;
  }
}

async function init() {
  try {
    const [icons, sessions] = await Promise.all([
      window.customButtonModalAPI.listIcons(),
      window.customButtonModalAPI.listSessions(),
    ]);

    availableIcons = icons || [];
    allSessions = sessions || [];

    renderColorPalette();
    renderIconGrid();
    renderSessionsDropdown();

    if (mode === "edit" && editButtonId) {
      modalTitleText.textContent = "Editar Botão Personalizado";
      btnSave.textContent = "Salvar Alterações";

      const btn = await window.customButtonModalAPI.getButton(editButtonId);
      if (btn) {
        nameInput.value = btn.name || "";
        setType(btn.type || "url");
        if (btn.url) urlInput.value = btn.url;
        if (btn.message) messageInput.value = btn.message;
        setScope(btn.scope || "global");
        if (btn.sessionId) sessionSelect.value = btn.sessionId;
        if (btn.color) selectColor(btn.color);
        if (btn.icon) selectIcon(btn.icon);
      }
    } else {
      modalTitleText.textContent = "Novo Botão Personalizado";
      btnSave.textContent = "Criar Botão";
      setType("url");
      setScope("global");
      selectColor("#00a884");
      selectIcon("external-link");
    }

    updatePreview();
    nameInput.focus();
  } catch (err) {
    console.error("Erro ao inicializar modal:", err);
  }
}

// Event Listeners
typeSelector.addEventListener("click", (e) => {
  const btn = e.target.closest(".segmented-option");
  if (btn) {
    setType(btn.getAttribute("data-type"));
  }
});

scopeSelector.addEventListener("click", (e) => {
  const btn = e.target.closest(".segmented-option");
  if (btn) {
    setScope(btn.getAttribute("data-scope"));
  }
});

insertUrlVar.addEventListener("click", () => insertAtCursor(urlInput, "{telefone}"));
insertMsgVar.addEventListener("click", () => insertAtCursor(messageInput, "{telefone}"));

btnClose.addEventListener("click", () => window.customButtonModalAPI.close());
btnCancel.addEventListener("click", () => window.customButtonModalAPI.close());

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.customButtonModalAPI.close();
  }
});

btnSave.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  let url = urlInput.value.trim();
  let message = messageInput.value.trim();

  if (currentType === "url") {
    if (!url) {
      urlInput.focus();
      return;
    }
  } else {
    if (!message) {
      messageInput.focus();
      return;
    }
  }

  const payload = {
    id: mode === "edit" ? editButtonId : undefined,
    name,
    type: currentType,
    url: currentType === "url" ? url : "",
    message: currentType === "message" ? message : "",
    scope: currentScope,
    sessionId: currentScope === "session" ? sessionSelect.value : null,
    color: currentColor,
    icon: currentIcon,
  };

  btnSave.disabled = true;
  try {
    await window.customButtonModalAPI.save(payload);
    window.customButtonModalAPI.close();
  } catch (err) {
    console.error("Falha ao salvar botão:", err);
    btnSave.disabled = false;
  }
});

init();
