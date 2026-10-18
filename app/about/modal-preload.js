"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aboutAPI", {
  getInfo: () => ipcRenderer.invoke("about:get-info"),
  openLink: (url) => ipcRenderer.send("about:open-link", url),
  close: () => ipcRenderer.send("about:close"),
  checkUpdates: () => ipcRenderer.invoke("updater:check-for-updates"),
  getUpdateStatus: () => ipcRenderer.invoke("updater:get-status"),
  installUpdate: () => ipcRenderer.invoke("updater:install-now"),
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  },
});
