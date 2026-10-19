"use strict";

const urlParams = new URLSearchParams(window.location.search);
const localeParam = urlParams.get("locale") || "";
const LOCALE = ["pt", "es", "en"].includes(localeParam) ? localeParam : "pt";
const L = (window.ZAPPR_STRINGS &&
  window.ZAPPR_STRINGS[LOCALE] &&
  window.ZAPPR_STRINGS[LOCALE].aboutModal) ||
  (window.ZAPPR_STRINGS &&
    window.ZAPPR_STRINGS.pt &&
    window.ZAPPR_STRINGS.pt.aboutModal) || {
    title: "Sobre o Zappr",
    subtitle: "Informações do aplicativo e atualizações",
    desc: "Cliente desktop moderno para WhatsApp Web com suporte a múltiplas sessões isoladas.",
    platform: "Plataforma",
    repository: "Repositório no GitHub",
    releases: "Ver lançamentos",
    checkUpdates: "Verificar",
    checkingUpdates: "Buscando atualizações...",
    upToDate: "Versão mais recente instalada",
    updateAvailable: (ver) => `Nova versão: v${ver}`,
    downloading: (pct) => `Baixando: ${pct}%`,
    readyToInstall: "Pronta para instalar ao reiniciar",
    installNow: "Reiniciar e atualizar",
    devMode: "Modo de desenvolvimento",
    close: "Fechar",
  };

document.documentElement.lang = LOCALE;
document.title = L.title;

const titleTextEl = document.getElementById("about-title-text");
if (titleTextEl) titleTextEl.textContent = L.title;
const subtitleTextEl = document.getElementById("about-subtitle-text");
if (subtitleTextEl) subtitleTextEl.textContent = L.subtitle;
const descEl = document.getElementById("app-desc");
if (descEl) descEl.textContent = L.desc;
const platformLabelEl = document.getElementById("platform-label");
if (platformLabelEl) platformLabelEl.textContent = L.platform;
const repoLabelEl = document.getElementById("repo-label");
if (repoLabelEl) repoLabelEl.textContent = L.repository;
const releasesLabelEl = document.getElementById("releases-label");
if (releasesLabelEl) releasesLabelEl.textContent = L.releases;
const checkUpdatesLabelEl = document.getElementById("check-updates-label");
if (checkUpdatesLabelEl) checkUpdatesLabelEl.textContent = L.checkUpdates;
const closeBtn = document.getElementById("close-btn");
if (closeBtn) closeBtn.textContent = L.close;

const appVersionEl = document.getElementById("app-version");
const electronVerEl = document.getElementById("electron-ver");
const chromeVerEl = document.getElementById("chrome-ver");
const nodeVerEl = document.getElementById("node-ver");
const platformVerEl = document.getElementById("platform-ver");
const repoBtn = document.getElementById("repo-btn");
const releasesBtn = document.getElementById("releases-btn");
const updaterIconWrapEl = document.getElementById("updater-icon-wrap");
const updaterStatusTextEl = document.getElementById("updater-status-text");
const updaterSubtextEl = document.getElementById("updater-subtext");
const closeXBtn = document.getElementById("close-x-btn");

const footerCheckBtn = document.getElementById("footer-check-btn");
const footerCheckLabelEl = document.getElementById("footer-check-label");

let currentUpdateState = null;

function setButtonsState(disabled, text) {
  if (footerCheckBtn) {
    footerCheckBtn.disabled = disabled;
    if (footerCheckLabelEl && text) footerCheckLabelEl.textContent = text;
  }
}

function applyUpdateStatus(status) {
  if (!status) return;
  currentUpdateState = status;

  updaterIconWrapEl.classList.remove("checking");
  if (footerCheckBtn) {
    const svg = footerCheckBtn.querySelector("svg");
    if (svg) svg.classList.remove("spin");
  }

  switch (status.state) {
    case "checking":
      updaterIconWrapEl.classList.add("checking");
      if (footerCheckBtn) {
        const svg = footerCheckBtn.querySelector("svg");
        if (svg) svg.classList.add("spin");
      }
      updaterStatusTextEl.textContent = L.checkingUpdates;
      updaterSubtextEl.textContent = "GitHub Releases (pedruhb/Zappr)";
      setButtonsState(true, L.checkingUpdates);
      break;

    case "available":
      updaterStatusTextEl.textContent =
        typeof L.updateAvailable === "function"
          ? L.updateAvailable(status.version)
          : `Nova versão: v${status.version}`;
      updaterSubtextEl.textContent = "Baixando atualização em segundo plano...";
      setButtonsState(true, L.checkingUpdates);
      break;

    case "downloading":
      updaterStatusTextEl.textContent =
        typeof L.downloading === "function"
          ? L.downloading(status.percent || 0)
          : `Baixando: ${status.percent || 0}%`;
      updaterSubtextEl.textContent = "Aguarde o download da nova versão...";
      setButtonsState(true, L.checkingUpdates);
      break;

    case "downloaded":
      updaterStatusTextEl.textContent = L.readyToInstall;
      updaterSubtextEl.textContent = `Versão v${status.version} instalada no próximo reinício`;
      setButtonsState(false, L.installNow);
      break;

    case "dev":
      updaterStatusTextEl.textContent = L.devMode;
      updaterSubtextEl.textContent = "Ambiente local sem auto-atualização";
      setButtonsState(false, L.checkUpdates);
      break;

    case "error":
      updaterStatusTextEl.textContent = "Não foi possível verificar";
      updaterSubtextEl.textContent = status.message || "Erro de conexão";
      setButtonsState(false, L.checkUpdates);
      break;

    case "latest":
    default:
      updaterStatusTextEl.textContent = L.upToDate;
      updaterSubtextEl.textContent =
        "Verificação automática via GitHub Releases";
      setButtonsState(false, L.checkUpdates);
      break;
  }
}

async function init() {
  try {
    const info = await window.aboutAPI.getInfo();
    if (info) {
      appVersionEl.textContent = `v${info.version || "0.0.1"}`;
      electronVerEl.textContent = info.electronVersion || "-";
      chromeVerEl.textContent = info.chromeVersion || "-";
      nodeVerEl.textContent = info.nodeVersion || "-";
      platformVerEl.textContent = `${info.platform || "linux"} (${info.arch || "x64"})`;
    }
  } catch {
    appVersionEl.textContent = "v0.0.1";
  }

  try {
    if (
      window.aboutAPI &&
      typeof window.aboutAPI.getUpdateStatus === "function"
    ) {
      const status = await window.aboutAPI.getUpdateStatus();
      applyUpdateStatus(status);
    }
  } catch {
    // ignore
  }

  if (window.aboutAPI && typeof window.aboutAPI.onUpdateStatus === "function") {
    window.aboutAPI.onUpdateStatus((status) => {
      applyUpdateStatus(status);
    });
  }
}

function closeModal() {
  if (window.aboutAPI && typeof window.aboutAPI.close === "function") {
    window.aboutAPI.close();
  } else {
    window.close();
  }
}

closeXBtn.addEventListener("click", closeModal);
closeBtn.addEventListener("click", closeModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
  }
});

repoBtn.addEventListener("click", () => {
  if (window.aboutAPI && typeof window.aboutAPI.openLink === "function") {
    window.aboutAPI.openLink("https://github.com/pedruhb/Zappr");
  }
});

releasesBtn.addEventListener("click", () => {
  if (window.aboutAPI && typeof window.aboutAPI.openLink === "function") {
    window.aboutAPI.openLink("https://github.com/pedruhb/Zappr/releases");
  }
});

async function handleCheckUpdates() {
  if (
    currentUpdateState &&
    currentUpdateState.state === "downloaded" &&
    window.aboutAPI &&
    typeof window.aboutAPI.installUpdate === "function"
  ) {
    window.aboutAPI.installUpdate();
    return;
  }

  if (window.aboutAPI && typeof window.aboutAPI.checkUpdates === "function") {
    applyUpdateStatus({ state: "checking" });
    try {
      const res = await window.aboutAPI.checkUpdates();
      if (res && res.status) {
        applyUpdateStatus(res.status);
      }
    } catch (err) {
      applyUpdateStatus({
        state: "error",
        message: err && err.message ? err.message : String(err),
      });
    }
  }
}

if (footerCheckBtn) {
  footerCheckBtn.addEventListener("click", handleCheckUpdates);
}

init();
