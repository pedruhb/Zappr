"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("titlebar", {
  get: () => ipcRenderer.invoke("titlebar:get"),
  onState: (callback) =>
    ipcRenderer.on("titlebar:state", (_event, data) => callback(data)),
  openMenu: (id, x, y) => ipcRenderer.send("titlebar:menu", id, x, y),
});

contextBridge.exposeInMainWorld("sessionsSidebar", {
  list: () => ipcRenderer.invoke("sessions:list-all"),
  current: () => ipcRenderer.invoke("sessions:current"),
  switch: (desktopId) => ipcRenderer.invoke("sessions:switch", desktopId),
  reorder: (orderedIds) => ipcRenderer.invoke("sessions:reorder", orderedIds),
  openAdd: () => ipcRenderer.invoke("sessions:open-add"),
  openEdit: (desktopId) => ipcRenderer.invoke("sessions:open-edit", desktopId),
  openDelete: (desktopId) =>
    ipcRenderer.invoke("sessions:open-delete", desktopId),
  showContextMenu: (desktopId) =>
    ipcRenderer.send("sessions:context-menu", desktopId),
  onChanged: (callback) => ipcRenderer.on("sessions:changed", () => callback()),
  onActiveChanged: (callback) =>
    ipcRenderer.on("sessions:active-changed", (_event, id) => callback(id)),
  onFullscreen: (callback) =>
    ipcRenderer.on("window:fullscreen", (_event, isFullscreen) =>
      callback(isFullscreen),
    ),
  getUnreadCounts: () => ipcRenderer.invoke("sessions:get-unread-counts"),
  onUnreadUpdated: (callback) =>
    ipcRenderer.on("sessions:unread-updated", (_event, data) => callback(data)),
  getStatuses: () => ipcRenderer.invoke("sessions:get-statuses"),
  onStatusUpdated: (callback) =>
    ipcRenderer.on("sessions:status-updated", (_event, data) => callback(data)),
});

contextBridge.exposeInMainWorld("customButtons", {
  list: (activeSessionId) => ipcRenderer.invoke("customButtons:list", activeSessionId),
  openAdd: (currentSessionId) =>
    ipcRenderer.invoke("customButtons:open-add", currentSessionId),
  openEdit: (buttonId) => ipcRenderer.invoke("customButtons:open-edit", buttonId),
  delete: (buttonId) => ipcRenderer.invoke("customButtons:delete", buttonId),
  execute: (buttonId) => ipcRenderer.invoke("customButtons:execute", buttonId),
  showContextMenu: (buttonId) =>
    ipcRenderer.send("customButtons:context-menu", buttonId),
  getChatStatus: (desktopId) =>
    ipcRenderer.invoke("session:get-active-chat-status", desktopId),
  onChanged: (callback) =>
    ipcRenderer.on("customButtons:changed", () => callback()),
  onChatStatusChanged: (callback) =>
    ipcRenderer.on("session:chat-status-changed", (_event, data) =>
      callback(data),
    ),
});

