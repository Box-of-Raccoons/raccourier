const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

function configDir() {
  if (process.env.RACCOURIER_DIR) return process.env.RACCOURIER_DIR;
  const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(base, "Raccourier");
}

function historyPath() {
  return path.join(configDir(), "history.json");
}

function loadConfig() {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "config.json");
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  const cfg = {
    port: 40000 + crypto.randomInt(0, 20000),
    secret: crypto.randomBytes(24).toString("hex"),
  };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  return cfg;
}

module.exports = { configDir, historyPath, loadConfig };
