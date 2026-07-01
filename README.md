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
# Claude Code
node mcp/install.js --target claude-code
```

This adds a `raccourier` entry to `~/.claude.json` under `mcpServers`. **Restart
Claude Code** to load it. Then the tools below are available; the first `notify`
call auto-starts the tray app.

> **Claude Cowork:** its MCP config location isn't auto-detected yet. Run
> `node mcp/install.js --target cowork` to print the exact JSON snippet, then paste
> it into Cowork's MCP config manually.

Manual registration snippet (any client):

```json
{
  "mcpServers": {
    "raccourier": {
      "type": "stdio",
      "command": "<path-to-node-or-Raccourier.exe>",
      "args": ["<path-to>/mcp/server.js"],
      "env": {}
    }
  }
}
```

### Packaged installer (to share)

```bash
npm run dist
```

Produces an unsigned NSIS installer in `dist/`. The installer creates a Start-Menu
shortcut (which also makes Windows attribute toasts to "Raccourier"). After install,
register with:

```bash
"C:\Users\<you>\AppData\Local\Programs\Raccourier\Raccourier.exe" --install-mcp --target claude-code
```

The installed `Raccourier.exe --mcp` runs the MCP server headlessly (no window); no
Node needed on the target machine.

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
