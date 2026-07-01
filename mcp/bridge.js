const path = require("node:path");
const { spawn } = require("node:child_process");

function baseUrl(cfg) {
  return `http://127.0.0.1:${cfg.port}`;
}

async function healthy(cfg, timeoutMs = 500) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(baseUrl(cfg) + "/health", {
      headers: { "x-raccourier-secret": cfg.secret },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const j = await res.json();
    return !!j && j.app === "raccourier";
  } catch {
    return false;
  }
}

function launchTray() {
  const isPackaged = /raccourier/i.test(path.basename(process.execPath));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  let cmd, args;
  if (isPackaged) {
    cmd = process.execPath;
    args = [];
  } else {
    cmd = require("electron"); // string path to the electron binary under node
    args = [path.join(__dirname, "..", "app")];
  }
  spawn(cmd, args, { detached: true, stdio: "ignore", env }).unref();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureRunning(cfg, { attempts = 50, intervalMs = 200 } = {}) {
  if (await healthy(cfg)) return;
  launchTray();
  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    if (await healthy(cfg)) return;
  }
  throw new Error("Raccourier tray app did not become healthy within timeout");
}

async function postNotify(cfg, payload) {
  const res = await fetch(baseUrl(cfg) + "/notify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-raccourier-secret": cfg.secret },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`notify failed: HTTP ${res.status}`);
  return res.json();
}

async function getMessages(cfg, q = {}) {
  const u = new URL(baseUrl(cfg) + "/messages");
  if (q.limit) u.searchParams.set("limit", String(q.limit));
  if (q.source) u.searchParams.set("source", q.source);
  const res = await fetch(u, { headers: { "x-raccourier-secret": cfg.secret } });
  return res.json();
}

async function clearMessages(cfg) {
  const res = await fetch(baseUrl(cfg) + "/clear", {
    method: "POST",
    headers: { "x-raccourier-secret": cfg.secret },
  });
  return res.json();
}

module.exports = { baseUrl, healthy, launchTray, ensureRunning, postNotify, getMessages, clearMessages };
