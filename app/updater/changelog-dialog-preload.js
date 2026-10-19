"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("changelogDialog", {
  onNotes: (callback) =>
    ipcRenderer.on("updater:notes", (_event, payload) => callback(payload)),
  onLocaleChanged: (callback) =>
    ipcRenderer.on("i18n:changed", (_event, locale) => callback(locale)),
  close: () => ipcRenderer.send("updater:changelog-close"),
  openLink: (url) => ipcRenderer.send("updater:open-link", url),
});
