const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell, dialog } = require("electron");
const { loadConfig } = require("../shared/config");
const { teaser, buildRecord } = require("../shared/schema");
const store = require("./store");
const readState = require("./readState");
const { view } = require("./mergeView");
const { createServer } = require("./httpServer");
const { sendPushover } = require("./pushover");
const { forwardToHost, pollHost, shouldToastRemote } = require("./hostLink");
const { listenWithFallback, resolveBindHost } = require("./listenSafe");

// Spoke read path: host records are polled on an interval and cached here; the
// merged view is local ∪ host. On the host machine this stays [] (no polling).
let hostRecords = [];
const POLL_INTERVAL_MS = 15000;

// Connection status surfaced to the renderer's header dot. `listenResult` is set
// once the HTTP listener resolves; `hostReachable` tracks spoke->host poll health.
let listenResult = null;
let hostReachable = null;

function currentView() {
  return view(store.load(), hostRecords, readState.load());
}

// Display-ready status for the renderer: { tone, text, detail }. Policy lives here
// so the renderer just paints a dot (color) + label (text, never color alone).
function computeStatus() {
  if (listenResult === null) return { tone: "idle", text: "Starting…", detail: "Bringing up the listener." };
  if (listenResult.bound === null) {
    return { tone: "down", text: "Not listening", detail: `Port ${cfg.port} is unavailable — deliveries can't arrive until it's freed and Raccourier restarts.` };
  }
  const loopbackOnly = listenResult.bound === "127.0.0.1" && listenResult.error;
  if (cfg.host && cfg.host.url && hostReachable === false) {
    return { tone: "warn", text: "Host unreachable", detail: `Local deliveries work; can't reach the host at ${cfg.host.url}.` };
  }
  if (loopbackOnly) {
    return { tone: "warn", text: "Local only", detail: "LAN feed disabled (port busy); local notifications and the MCP path still work." };
  }
  return { tone: "ok", text: "Listening", detail: "Ready for deliveries." };
}

function sendStatus() {
  if (win && !win.isDestroyed() && win.webContents) win.webContents.send("status", computeStatus());
}

const APP_ID = "com.raccourier.app";
app.setAppUserModelId(APP_ID);

// Single-instance guard. The MCP bridge auto-launches the tray, and a second
// Claude Code instance can spawn a duplicate before the first hub is healthy.
// A second tray would try to bind the same cfg.port/bind as the running hub and
// die with EADDRINUSE (breaking the host/spoke model). Fail fast if we don't
// own the lock; the primary instance surfaces its window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", () => showWindow());

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
  // Pushover: fire-and-forget from the originating machine only (never from /ingest).
  // Condition: alert severity OR explicit per-message push:true, AND creds configured.
  if ((record.severity === "alert" || data.push === true) && cfg.pushover) {
    sendPushover(record, cfg.pushover); // intentionally not awaited
  }
  // Spoke: best-effort forward the full minted record to the host (no-op on the
  // host machine). Fire-and-forget — never awaited, never throws.
  forwardToHost(cfg, record);
  fireToast(record);
  if (data.popup || data.severity === "alert") showWindow();
  if (win && !win.isDestroyed() && win.webContents) {
    win.webContents.send("message", record);
  }
  return record;
}

// POST /ingest side effects (remote record arriving at the host): notify the
// renderer + a policy-gated toast only. No re-mint, no showWindow, no Pushover
// (the spoke already pushed to the phone directly). An ingested record is always
// remote-origin, so no local-origin check is needed; ingest dedupe covers repeats.
function onIngest(record) {
  if (win && !win.isDestroyed() && win.webContents) {
    win.webContents.send("message", record);
  }
  if (shouldToastRemote(record, cfg)) fireToast(record);
}

// Spoke read path: poll the host on an interval, cache the result, toast newly-
// seen remote items per policy, and refresh the renderer with the merged view.
// Not started on the host (no host.url).
function startHostPoll() {
  if (!cfg.host || !cfg.host.url) return;
  setInterval(async () => {
    const records = await pollHost(cfg);
    if (!records) {
      // Poll failed — keep the last known host records, but surface the outage.
      if (hostReachable !== false) { hostReachable = false; sendStatus(); }
      return;
    }
    if (hostReachable !== true) { hostReachable = true; sendStatus(); }
    hostRecords = records;
    // Toast only records that are new (not in the persisted seen-set) AND not
    // locally-originated (our own forwarded record, already toasted at onNotify;
    // detected by id membership in the local store). ALWAYS mark every polled id
    // seen so a restart / host-nap recovery can't toast-storm the backlog.
    const localIds = new Set(store.load().map((r) => r.id));
    const now = Date.now();
    for (const r of records) {
      if (localIds.has(r.id)) continue;
      if (readState.isSeen(r.id)) continue;
      if (shouldToastRemote(r, cfg)) fireToast(r);
    }
    if (records.length) readState.markSeen(records.map((r) => r.id), now);
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send("init", currentView().slice().reverse());
    }
  }, POLL_INTERVAL_MS);
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
    onIngest,
    getHostRecords: () => hostRecords,
  });
  // A configured LAN feed (config.bind set) must serve BOTH the LAN — so spokes
  // reach the host — AND 127.0.0.1 — so the local MCP path works, since bridge.js
  // always talks to 127.0.0.1. Binding a specific IP excludes loopback, so we
  // listen on all interfaces (0.0.0.0); the secret guards the port. Spokes have
  // no bind set and stay loopback-only. See resolveBindHost.
  const listenHost = resolveBindHost(cfg);
  listenWithFallback(httpServer, cfg.port, listenHost).then((result) => {
    const { bound, error } = result;
    listenResult = result;
    sendStatus();
    if (bound === listenHost && listenHost !== "127.0.0.1") return; // all-interfaces bind OK (LAN + loopback)
    if (bound === "127.0.0.1" && error) {
      dialog.showErrorBox(
        "Raccourier — LAN feed disabled",
        `Couldn't listen on all interfaces for port ${cfg.port} (${error.code}).\n\n` +
          `Another program is likely using that port. Raccourier is still running on ` +
          `127.0.0.1: local notifications, history, and the MCP path work, but other ` +
          `machines can't reach this host until the conflict is cleared and you ` +
          `restart.\n\nConfig: ${path.join(process.env.APPDATA || "", "Raccourier", "config.json")}`
      );
    } else if (bound === null) {
      dialog.showErrorBox(
        "Raccourier — couldn't start",
        `Couldn't listen on port ${cfg.port} (${error && error.code}). ` +
          `Another program may be using the port, or another Raccourier is already ` +
          `running. Change "port" in config.json or close the conflicting program, ` +
          `then restart Raccourier.`
      );
    }
  });

  startHostPoll();

  const { ipcMain } = require("electron");
  ipcMain.on("ready", (e) => {
    e.sender.send("init", currentView().slice().reverse());
    e.sender.send("status", computeStatus());
  });
  ipcMain.on("clear", (e) => {
    // Overlay-only: hide the currently-visible ids; never wipe the append-log.
    readState.clear(currentView().map((r) => r.id), Date.now());
    e.sender.send("init", []);
  });
  ipcMain.on("unclear", (e, ids) => {
    // Undo a clear: drop the ids back out of the cleared overlay, then repaint.
    readState.unclear(Array.isArray(ids) ? ids : [], Date.now());
    e.sender.send("init", currentView().slice().reverse());
  });
  ipcMain.on("mark-read", (_e, id) => readState.markRead(id, Date.now()));
  ipcMain.on("mark-all-read", () => readState.markAllRead(currentView().map((r) => r.id), Date.now()));
});

// Keep running in the tray when the window is closed.
app.on("window-all-closed", (e) => {});
