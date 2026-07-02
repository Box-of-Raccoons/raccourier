const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Config file per target. Each returns the absolute path to the JSON file
// whose top-level `mcpServers` map we merge into.
function claudeDesktopConfig() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

const TARGETS = {
  "claude-code": () => path.join(os.homedir(), ".claude.json"),
  "claude-desktop": claudeDesktopConfig,
  // Claude Cowork stores its MCP config elsewhere / may not be installed.
  // Left unresolved on purpose: `run()` prints the manual snippet for it.
  cowork: () => null,
};

// The MCP server entry Claude launches. Both paths run mcp/server.js on stdio.
// Dev: the current node binary. Packaged: the installed Raccourier.exe run as a
// plain Node process via ELECTRON_RUN_AS_NODE (a bare `--mcp` would boot the full
// Electron/Chromium runtime, which never completes the stdio JSON-RPC handshake).
// `__dirname` resolves inside resources/app.asar when packaged, so the server.js
// path is correct in both cases.
function serverEntry() {
  const isPackaged = /raccourier\.exe$/i.test(path.basename(process.execPath));
  const serverJs = path.resolve(__dirname, "server.js");
  const env = isPackaged ? { ELECTRON_RUN_AS_NODE: "1" } : {};
  return { type: "stdio", command: process.execPath, args: [serverJs], env };
}

function manualSnippet() {
  return JSON.stringify({ mcpServers: { raccourier: serverEntry() } }, null, 2);
}

// Merge the raccourier server entry into `file`'s top-level `mcpServers`,
// preserving every other key. Creates the dir/file if absent, and tolerates a
// missing or corrupt file by starting from an empty config.
function register(file) {
  // Create the config dir if the client hasn't been launched yet (e.g. a fresh
  // Claude Desktop install writes its config dir only on first run).
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    cfg = {};
  }
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers.raccourier = serverEntry();
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  return file;
}

function run(argv) {
  const i = argv.indexOf("--target");
  const target = i >= 0 ? argv[i + 1] : "claude-code";
  const resolve = TARGETS[target];

  if (!resolve) {
    console.error(`Unknown target "${target}". Add this to your client's MCP config manually:\n${manualSnippet()}`);
    process.exit(2);
  }

  const file = resolve();
  if (!file) {
    // Target has no known config path (e.g. cowork): print the snippet to paste.
    console.error(`Config path for "${target}" is unknown. Add this manually:\n${manualSnippet()}`);
    process.exit(2);
  }
  register(file);
  console.log(`Registered Raccourier MCP server in ${file}. Restart ${target} to load it.`);
}

if (require.main === module) {
  run(process.argv);
}

module.exports = { run, register, serverEntry, manualSnippet, TARGETS };
