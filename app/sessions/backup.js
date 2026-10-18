"use strict";

const { app, dialog, BrowserWindow } = require("electron");
const fs = require("node:fs");
const { t } = require("../i18n");
const {
  getStoredSessions,
  saveStoredSessions,
  notifySessionsChanged,
} = require("./index");
const {
  getAutoRouteOldest,
  setAutoRouteOldest,
  getRememberedHandler,
  setRememberedHandler,
} = require("../deepLinks/state");

async function exportBackup(parentWin) {
  const win =
    parentWin ||
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

  const dateStr = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: t("menu.exportSettings"),
    defaultPath: `zappr-backup-${dateStr}.json`,
    filters: [{ name: "JSON (*.json)", extensions: ["json"] }],
  });

  if (canceled || !filePath) return false;

  try {
    const data = {
      zapprVersion: app.getVersion(),
      exportedAt: new Date().toISOString(),
      sessions: getStoredSessions(),
      autoRouteOldest: getAutoRouteOldest(),
      rememberedHandler: getRememberedHandler(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    dialog.showMessageBox(win, {
      type: "info",
      title: "Zappr",
      message: "Backup exportado com sucesso!",
      detail: `Arquivo salvo em:\n${filePath}`,
    });
    return true;
  } catch (err) {
    dialog.showErrorBox(
      "Erro ao exportar",
      `Falha ao salvar backup: ${err.message}`,
    );
    return false;
  }
}

async function importBackup(parentWin) {
  const win =
    parentWin ||
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: t("menu.importSettings"),
    filters: [{ name: "JSON (*.json)", extensions: ["json"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths || filePaths.length === 0) return false;

  try {
    const raw = fs.readFileSync(filePaths[0], "utf8");
    const parsed = JSON.parse(raw);
    const sessionsList = Array.isArray(parsed) ? parsed : parsed.sessions;

    if (!Array.isArray(sessionsList)) {
      dialog.showErrorBox(
        "Erro ao importar",
        "O arquivo selecionado não contém um formato de backup válido.",
      );
      return false;
    }

    saveStoredSessions(sessionsList);

    if (parsed.autoRouteOldest !== undefined) {
      setAutoRouteOldest(Boolean(parsed.autoRouteOldest));
    }
    if (parsed.rememberedHandler !== undefined) {
      setRememberedHandler(parsed.rememberedHandler);
    }

    notifySessionsChanged();

    dialog.showMessageBox(win, {
      type: "info",
      title: "Zappr",
      message: "Configurações importadas com sucesso!",
      detail: `${sessionsList.length} sessão(ões) atualizada(s).`,
    });
    return true;
  } catch (err) {
    dialog.showErrorBox(
      "Erro ao importar",
      `Falha ao ler o arquivo: ${err.message}`,
    );
    return false;
  }
}

module.exports = {
  exportBackup,
  importBackup,
};
