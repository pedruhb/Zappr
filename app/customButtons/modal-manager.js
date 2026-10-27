"use strict";

const { BrowserWindow } = require("electron");
const path = require("node:path");

let modalWin = null;

function openCustomButtonModal(parentWin, options = {}) {
  if (modalWin && !modalWin.isDestroyed()) {
    modalWin.close();
  }

  const parent =
    parentWin || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (!parent) return null;

  const {
    width: pWidth,
    height: pHeight,
    x: pX,
    y: pY,
  } = parent.getContentBounds();
  const mWidth = 440;
  const mHeight = 580;
  const mX = Math.round(pX + (pWidth - mWidth) / 2);
  const mY = Math.round(pY + (pHeight - mHeight) / 2);

  modalWin = new BrowserWindow({
    width: mWidth,
    height: mHeight,
    x: mX,
    y: mY,
    parent,
    modal: true,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    backgroundColor: "#202c33",
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "modal-preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  const query = {
    mode: options.mode || "create",
    buttonId: options.buttonId || "",
    currentSessionId: options.currentSessionId || "",
  };

  modalWin.loadFile(path.join(__dirname, "modal.html"), { query });

  modalWin.once("ready-to-show", () => {
    if (modalWin && !modalWin.isDestroyed()) {
      modalWin.show();
      modalWin.focus();
    }
  });

  modalWin.on("closed", () => {
    modalWin = null;
    if (parent && !parent.isDestroyed()) {
      parent.focus();
    }
  });

  return modalWin;
}

function closeCustomButtonModal() {
  if (modalWin && !modalWin.isDestroyed()) {
    modalWin.close();
    modalWin = null;
  }
}

module.exports = {
  openCustomButtonModal,
  closeCustomButtonModal,
};
