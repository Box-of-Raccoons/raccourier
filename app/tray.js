const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell } = require("electron");
const { loadConfig } = require("../shared/config");
const { teaser, buildRecord } = require("../shared/schema");
const store = require("./store");
const readState = require("./readState");
const { view } = require("./mergeView");
const { createServer } = require("./httpServer");

// Phase 1: host source is stubbed empty; Phase 3 wires in polled host records.
function currentView() {
  return view(store.load(), [], readState.load());
}

const APP_ID = "com.raccourier.app";
app.setAppUserModelId(APP_ID);

let win = null;
let tray = null;
let quitting = false;
const cfg = loadConfig();

const iconPath = path.join(__dirname, "..", "build", "icon.png");

function getIcon() {
  const img = nativeImage.createFromPath(iconPath);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 640,
    show: false,
    title: "Raccourier",
    icon: getIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  // Keep a force-reload even though the menu bar is gone.
  win.webContents.on("before-input-event", (e, input) => {
    const key = (input.key || "").toLowerCase();
    if (input.type === "keyDown" && ((input.control && input.shift && key === "r") || key === "f5")) {
      win.webContents.reloadIgnoringCache();
      e.preventDefault();
    }
  });
  // Open markdown links in the external browser; never navigate the window away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function forceReload() {
  if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  win.show();
  win.focus();
}

function fireToast(record) {
  const n = new Notification({ title: record.title, body: teaser(record.body) });
  n.on("click", showWindow);
  n.show();
}

function onNotify(data) {
  // Origin fallback chain: payload origin -> config.json origin -> hostname.
  const record = buildRecord(data, {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    configOrigin: cfg.origin,
    hostname: os.hostname(),
  });
  store.add(record, Date.now());
  fireToast(record);
  if (data.popup || data.severity === "alert") showWindow();
  if (win && !win.isDestroyed() && win.webContents) {
    win.webContents.send("message", record);
  }
  return record;
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: "Open Raccourier", click: showWindow },
    { label: "Force reload", accelerator: "CmdOrCtrl+Shift+R", click: forceReload },
    { type: "separator" },
    {
      label: "Clear history",
      click: () => {
        // Overlay-only: hide the currently-visible ids; never wipe the append-log.
        readState.clear(currentView().map((r) => r.id), Date.now());
        if (win && !win.isDestroyed()) win.webContents.send("init", []);
      },
    },
    { type: "separator" },
    {
      label: "Start at login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: "separator" },
    { label: "Quit", click: () => { quitting = true; app.quit(); } },
  ]);
}

app.whenReady().then(() => {
  // No File/Edit/View/Window/Help menu bar on the window.
  Menu.setApplicationMenu(null);

  // Prune stale history on startup.
  store.save(store.prune(store.load(), Date.now()));

  createWindow();

  tray = new Tray(getIcon());
  tray.setToolTip("Raccourier");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", showWindow);

  const httpServer = createServer({
    secret: cfg.secret,
    version: app.getVersion(),
    store,
    onNotify,
  });
  httpServer.listen(cfg.port, "127.0.0.1");

  const { ipcMain } = require("electron");
  ipcMain.on("ready", (e) => {
    e.sender.send("init", currentView().slice().reverse());
  });
  ipcMain.on("clear", (e) => {
    // Overlay-only: hide the currently-visible ids; never wipe the append-log.
    readState.clear(currentView().map((r) => r.id), Date.now());
    e.sender.send("init", []);
  });
  ipcMain.on("mark-read", (_e, id) => readState.markRead(id, Date.now()));
  ipcMain.on("mark-all-read", () => readState.markAllRead(currentView().map((r) => r.id), Date.now()));
});

// Keep running in the tray when the window is closed.
app.on("window-all-closed", (e) => {});
