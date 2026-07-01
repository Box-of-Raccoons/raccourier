const path = require("node:path");
const crypto = require("node:crypto");
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell } = require("electron");
const { loadConfig } = require("../shared/config");
const { teaser } = require("../shared/schema");
const store = require("./store");
const { createServer } = require("./httpServer");

const APP_ID = "com.raccourier.app";
app.setAppUserModelId(APP_ID);

let win = null;
let tray = null;
let quitting = false;
const cfg = loadConfig();

const iconPath = path.join(__dirname, "..", "build", "icon.png");
const isMac = process.platform === "darwin";

function getIcon() {
  const img = nativeImage.createFromPath(iconPath);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

// macOS menu-bar icons should be small monochrome "template" images (auto-
// recolored for light/dark menu bars). Use one if present; otherwise fall back
// to the colored app icon.
function getTrayIcon() {
  if (isMac) {
    const t = nativeImage.createFromPath(path.join(__dirname, "..", "build", "trayTemplate.png"));
    if (!t.isEmpty()) {
      t.setTemplateImage(true);
      return t;
    }
  }
  return getIcon();
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
  const record = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...data,
  };
  store.add(record, Date.now());
  fireToast(record);
  if (data.popup || data.severity === "alert") showWindow();
  if (win && !win.isDestroyed() && win.webContents) {
    win.webContents.send("message", record);
  }
  return record;
}

function buildAppMenu() {
  // Windows: no application menu bar at all. macOS: a minimal menu so Cmd+Q,
  // copy/paste, and force-reload still work (macOS apps expect an app menu).
  if (!isMac) return null;
  return Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Force Reload", accelerator: "CmdOrCtrl+Shift+R", click: forceReload },
        { role: "toggleDevTools" },
      ],
    },
  ]);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: "Open Raccourier", click: showWindow },
    { label: "Force reload", accelerator: "CmdOrCtrl+Shift+R", click: forceReload },
    { type: "separator" },
    {
      label: "Clear history",
      click: () => {
        store.save([]);
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
  // Windows: drop the File/Edit/View/Window/Help bar. macOS: minimal menu.
  Menu.setApplicationMenu(buildAppMenu());

  // macOS: menu-bar-only app — no Dock icon.
  if (isMac && app.dock) app.dock.hide();

  // Prune stale history on startup.
  store.save(store.prune(store.load(), Date.now()));

  createWindow();

  tray = new Tray(getTrayIcon());
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
    e.sender.send("init", store.load().slice().reverse());
  });
  ipcMain.on("clear", (e) => {
    store.save([]);
    e.sender.send("init", []);
  });
  ipcMain.on("mark-read", (_e, id) => store.markRead(id));
  ipcMain.on("mark-all-read", () => store.markAllRead());
});

// Keep running in the tray when the window is closed.
app.on("window-all-closed", (e) => {});
