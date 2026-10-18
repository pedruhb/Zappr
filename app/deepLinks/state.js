"use strict";

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// Shared across every profile (not scoped to any one --user-data-dir),
// since the whole point is remembering which *session* should handle an
// incoming link regardless of which one happens to be running when it
// arrives. Lives under ~/.local/share, same tree as the .desktop/icon
// files sessions/index.js already manages.
function stateFile() {
  const home =
    app && typeof app.getPath === "function"
      ? app.getPath("home")
      : require("node:os").homedir();
  return path.join(
    home,
    ".local",
    "share",
    "tuxchat",
    "deep-links.json",
  );
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8")) || {};
  } catch {
    return {};
  }
}

function writeState(data) {
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getRememberedHandler() {
  return readState().desktopId || null;
}

function setRememberedHandler(desktopId) {
  const state = readState();
  state.desktopId = desktopId;
  writeState(state);
}

function clearRememberedHandler() {
  const state = readState();
  delete state.desktopId;
  writeState(state);
}

function getAutoRouteOldest() {
  return Boolean(readState().autoRouteOldest);
}

function setAutoRouteOldest(enabled) {
  const state = readState();
  state.autoRouteOldest = Boolean(enabled);
  writeState(state);
}

module.exports = {
  getRememberedHandler,
  setRememberedHandler,
  clearRememberedHandler,
  getAutoRouteOldest,
  setAutoRouteOldest,
};
