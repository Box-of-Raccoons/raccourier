const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("raccourier", {
  ready: () => ipcRenderer.send("ready"),
  clear: () => ipcRenderer.send("clear"),
  markRead: (id) => ipcRenderer.send("mark-read", id),
  markAllRead: () => ipcRenderer.send("mark-all-read"),
  onInit: (cb) => ipcRenderer.on("init", (_e, records) => cb(records)),
  onMessage: (cb) => ipcRenderer.on("message", (_e, record) => cb(record)),
});
