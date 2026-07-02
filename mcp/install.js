const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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

// Parse --origin <label> from argv. Returns the label string or undefined.
function parseOrigin(argv) {
  const i = argv.indexOf("--origin");
  return i >= 0 ? argv[i + 1] : undefined;
}

// Build the argv array passed to `codex mcp add raccourier`.
// Always includes --env ELECTRON_RUN_AS_NODE=1. Adds --env RACCOURIER_ORIGIN=<label>
// only when an origin label is provided — omitting it lets the tray-side hostname
// fallback cover it (per Phase 1 design: fallback chain = payload → config → hostname).
function buildCodexArgs(entry, origin) {
  return [
    "mcp", "add", "raccourier",
    "--env", "ELECTRON_RUN_AS_NODE=1",
    ...(origin ? ["--env", `RACCOURIER_ORIGIN=${origin}`] : []),
    "--",
    entry.command,
    ...entry.args,
  ];
}

// TOML snippet for manual paste into ~/.codex/config.toml when the codex binary
// is not on PATH. JSON.stringify produces valid TOML basic-string escaping for
// paths (backslashes, double-quotes).
function codexTomlSnippet(entry, origin) {
  const argsToml = entry.args.map((a) => JSON.stringify(a)).join(", ");
  const envLines = [
    `ELECTRON_RUN_AS_NODE = "1"`,
    ...(origin ? [`RACCOURIER_ORIGIN = ${JSON.stringify(origin)}`] : []),
  ].join("\n");
  return [
    `[mcp_servers.raccourier]`,
    `command = ${JSON.stringify(entry.command)}`,
    `args = [${argsToml}]`,
    ``,
    `[mcp_servers.raccourier.env]`,
    envLines,
  ].join("\n");
}

// On Windows the codex CLI is typically an npm .cmd shim, which Node refuses to
// spawn directly (EINVAL since the CVE-2024-27980 hardening) — route through the
// shell there. shell:true joins args without quoting, so pre-quote anything with
// spaces (e.g. a packaged exe under Program Files).
function quoteForShell(a) {
  return /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

// Register with Codex by shelling out to the codex CLI (it owns the TOML merge).
// Falls back to printing a TOML snippet when codex is not on PATH (ENOENT) or
// exits non-zero. Accepts an optional _spawnSync + platform for test injection.
function runCodex(argv, _spawnSync = spawnSync, platform = process.platform) {
  const origin = parseOrigin(argv);
  const entry = serverEntry();
  const args = buildCodexArgs(entry, origin);
  const useShell = platform === "win32";
  const result = _spawnSync("codex", useShell ? args.map(quoteForShell) : args, {
    stdio: "inherit",
    shell: useShell,
  });
  if (result.error || result.status !== 0) {
    console.error(
      `codex not found or failed. Add this to ~/.codex/config.toml manually:\n${codexTomlSnippet(entry, origin)}`
    );
    process.exit(2);
    return; // guard: prevents reaching the success log when process.exit is mocked in tests
  }
  console.log("Registered Raccourier MCP server with Codex. Restart Codex to load it.");
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

  // Codex registration delegates to its own CLI — does not use the JSON TARGETS flow.
  if (target === "codex") {
    runCodex(argv);
    return;
  }

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

module.exports = { run, register, serverEntry, manualSnippet, TARGETS, runCodex, buildCodexArgs, codexTomlSnippet, parseOrigin };
