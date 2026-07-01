const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

function resolveConfigDir(platform, env, home) {
  if (env.RACCOURIER_DIR) return env.RACCOURIER_DIR;
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Raccourier");
  }
  if (platform === "win32") {
    const base = env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(base, "Raccourier");
  }
  const base = env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(base, "Raccourier");
}

function configDir() {
  return resolveConfigDir(process.platform, process.env, os.homedir());
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

module.exports = { configDir, resolveConfigDir, historyPath, loadConfig };
