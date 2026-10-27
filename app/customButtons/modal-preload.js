"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("customButtonModalAPI", {
  getButton: (buttonId) => ipcRenderer.invoke("customButtons:get", buttonId),
  listSessions: () => ipcRenderer.invoke("sessions:list-all"),
  listIcons: () => ipcRenderer.invoke("customButtons:list-icons"),
  save: (data) => ipcRenderer.invoke("customButtons:save", data),
  close: () => ipcRenderer.send("customButtons:modal-close"),
  resize: (height) => ipcRenderer.send("customButtons:modal-resize", height),
});
