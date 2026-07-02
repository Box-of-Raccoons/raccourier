# Raccourier 🦝

A little courier that drops your alerts on your desk. Raccourier is a Windows
desktop notifier that **Claude** (Claude Code / Cowork, running locally) can push
messages to — shown as a Windows **toast** and kept in a persistent **pop-up window
with a 14-day markdown history**. Built for daily mail-triage summaries and other
important alerts.

## How it works

Two cooperating processes:

- **Tray app** (Electron) — always-on. Owns the system-tray icon, the history
  window, toasts, and a secret-guarded loopback HTTP listener. Holds all state.
- **MCP server** (stdio) — what Claude connects to. On each tool call it health-checks
  the tray app, launches it if it's down, forwards the message, and returns.

## Install

### From source (your own machine)

```bash
npm install
```

Register it with your local Claude:

```bash
# Claude Code   (writes ~/.claude.json)
node mcp/install.js --target claude-code

# Claude Desktop / Cowork   (writes %APPDATA%\Claude\claude_desktop_config.json
#                            or ~/Library/Application Support/Claude/... on macOS)
node mcp/install.js --target claude-desktop
```

Each adds a `raccourier` entry under `mcpServers`, preserving any other servers and
keys already there. **Fully quit and reopen** the client (Claude Desktop: tray →
Quit, not just closing the window) to load it. Then the tools below are available;
the first `notify` call auto-starts the tray app.

> **Claude Cowork** shares Claude Desktop's config file, so `--target claude-desktop`
> covers it. If your build stores config elsewhere, run `node mcp/install.js --target
> cowork` to print the JSON snippet and paste it in manually.

Manual registration snippet (any client). Note the **command differs** between
running from source (Node) and from the packaged app:

```jsonc
// From source — plain Node runs the server:
{ "mcpServers": { "raccourier": {
  "type": "stdio",
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": ["C:\\path\\to\\raccourier\\mcp\\server.js"],
  "env": {}
} } }

// From the packaged app — run Raccourier.exe AS Node via ELECTRON_RUN_AS_NODE.
// A bare `--mcp` here boots the full Electron/Chromium runtime, which never
// completes the stdio JSON-RPC handshake ("Unexpected end of JSON input").
{ "mcpServers": { "raccourier": {
  "type": "stdio",
  "command": "C:\\Users\\<you>\\AppData\\Local\\Programs\\Raccourier\\Raccourier.exe",
  "args": ["C:\\Users\\<you>\\AppData\\Local\\Programs\\Raccourier\\resources\\app.asar\\mcp\\server.js"],
  "env": { "ELECTRON_RUN_AS_NODE": "1" }
} } }
```

### Packaged installer (to share)

```bash
npm run dist
```

Produces an unsigned NSIS installer in `dist/`. The installer creates a Start-Menu
shortcut (which also makes Windows attribute toasts to "Raccourier"). After install,
register with:

```bash
# Claude Code:
"C:\Users\<you>\AppData\Local\Programs\Raccourier\Raccourier.exe" --install-mcp --target claude-code
# Claude Desktop / Cowork:
"C:\Users\<you>\AppData\Local\Programs\Raccourier\Raccourier.exe" --install-mcp --target claude-desktop
```

`--install-mcp` writes an entry that runs `Raccourier.exe` as a headless Node process
(`ELECTRON_RUN_AS_NODE=1`) against the bundled `mcp/server.js` — no separate Node
install needed on the target machine.

## Tools

| Tool | Args | Effect |
|---|---|---|
| `notify` | `title`*, `body`* (markdown), `severity` (`info`\|`success`\|`warning`\|`alert`, default `info`), `source`, `popup` (default `true`) | Toast + a history entry. `alert` (or `popup`) brings the window to front. |
| `list_messages` | `limit`, `source` | Return recent history (newest first). |
| `clear_messages` | — | Delete all history. |

\* required.

## Behavior & storage

- History is stored at `%APPDATA%\Raccourier\history.json`, pruned by **both** rules
  (whichever trims first): older than **14 days**, and at most **500** records.
- Config (`port`, `secret`) is generated per-user on first run at
  `%APPDATA%\Raccourier\config.json`.
- Closing the window hides it to the tray. Tray menu: Open · Clear history ·
  Start at login · Quit.

## Notes & gotchas

- **Unsigned installer:** Windows SmartScreen will warn on first run ("More info →
  Run anyway"). Code-signing is a future step.
- **Building the installer needs Windows Developer Mode** (or an elevated shell):
  electron-builder unpacks a signing bundle containing macOS symlinks, and Windows
  blocks symlink creation without that privilege. Enable Settings → System → For
  developers → Developer Mode, then `npm run dist`.
- **If `npm install` leaves Electron's binary missing** (`Electron failed to install
  correctly`), the postinstall's zip extractor occasionally stops early. Re-run
  `node node_modules/electron/install.js`; if `path.txt` is still missing, extract
  `%LOCALAPPDATA%\electron\Cache\...\electron-*.zip` into `node_modules/electron/dist`
  and write `electron.exe` into `node_modules/electron/path.txt`.

## Development

```bash
npm start        # run the tray app
npm run mcp      # run the MCP server on stdio
npm test         # vitest
```
