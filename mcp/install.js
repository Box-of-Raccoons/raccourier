const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isPackagedExec } = require("../shared/platform");

// Config file per target. Each returns the absolute path to the JSON file
// whose top-level `mcpServers` map we merge into.
const TARGETS = {
  "claude-code": () => path.join(os.homedir(), ".claude.json"),
  // Claude Cowork stores its MCP config elsewhere / may not be installed.
  // Left unresolved on purpose: `run()` prints the manual snippet for it.
  cowork: () => null,
};

// The MCP server entry Claude launches. Packaged: the installed Raccourier.exe
// run headless with --mcp. Dev: the current node binary running mcp/server.js.
function serverEntry() {
  const isPackaged = isPackagedExec(process.execPath, process.platform);
  return isPackaged
    ? { type: "stdio", command: process.execPath, args: ["--mcp"], env: {} }
    : { type: "stdio", command: process.execPath, args: [path.resolve(__dirname, "server.js")], env: {} };
}

function manualSnippet() {
  return JSON.stringify({ mcpServers: { raccourier: serverEntry() } }, null, 2);
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
  if (!file || !fs.existsSync(path.dirname(file))) {
    console.error(`Config for "${target}" was not found on this machine. Add this manually:\n${manualSnippet()}`);
    process.exit(2);
  }

  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    cfg = {};
  }
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers.raccourier = serverEntry();
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`Registered Raccourier MCP server in ${file}. Restart ${target} to load it.`);
}

if (require.main === module) {
  run(process.argv);
}

module.exports = { run, serverEntry, manualSnippet };
