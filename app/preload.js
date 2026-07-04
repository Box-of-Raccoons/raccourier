const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("raccourier", {
  ready: () => ipcRenderer.send("ready"),
  clear: () => ipcRenderer.send("clear"),
  unclear: (ids) => ipcRenderer.send("unclear", ids),
  markRead: (id) => ipcRenderer.send("mark-read", id),
  markAllRead: () => ipcRenderer.send("mark-all-read"),
  onInit: (cb) => ipcRenderer.on("init", (_e, records) => cb(records)),
  onMessage: (cb) => ipcRenderer.on("message", (_e, record) => cb(record)),
  onStatus: (cb) => ipcRenderer.on("status", (_e, status) => cb(status)),
});
