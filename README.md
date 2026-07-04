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

# Codex CLI   (shells out to `codex mcp add`; falls back to a printed TOML
#              snippet for ~/.codex/config.toml if codex is not on PATH)
node mcp/install.js --target codex
# With an origin label (distinguishes this agent in the merged feed):
node mcp/install.js --target codex --origin home-codex
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
# Codex:
"C:\Users\<you>\AppData\Local\Programs\Raccourier\Raccourier.exe" --install-mcp --target codex [--origin <label>]
```

`--install-mcp` writes an entry that runs `Raccourier.exe` as a headless Node process
(`ELECTRON_RUN_AS_NODE=1`) against the bundled `mcp/server.js` — no separate Node
install needed on the target machine.

## Tools

| Tool | Args | Effect |
|---|---|---|
| `notify` | `title`*, `body`* (markdown), `severity` (`info`\|`success`\|`warning`\|`alert`, default `info`), `source`, `popup` (default `true`), `push` (default `false`) | Toast + a history entry. `alert` (or `popup`) brings the window to front. `push: true` triggers Pushover regardless of severity (if creds are configured). |
| `list_messages` | `limit`, `source` | Return recent history (newest first). |
| `clear_messages` | — | **Hide** all messages on this device (read-state overlay). The append-log is never wiped — it is pruned automatically. |

\* required.

## Origin labels

Each MCP registration can carry a `RACCOURIER_ORIGIN` env var — a friendly label
that appears on every message that registration sends (e.g. `home-claude`,
`home-codex`, `work-claude`). Claude and Codex running on the same machine are
separate registrations and benefit from distinct labels.

- **Codex:** pass `--origin <label>` to `node mcp/install.js --target codex`; the
  installer writes the env var into the Codex registration for you.
- **Other targets:** add `"RACCOURIER_ORIGIN": "<label>"` to the `env` map in the
  JSON config by hand.

Fallback when absent: payload `origin` → `config.json` `"origin"` field → hostname.

## Multi-machine (host / spoke)

One machine is the **host** (the shared archive); every other is a **spoke**. Each
machine writes locally first, then best-effort forwards records to the host. Host
down = the message stays in the spoke's local store; no retry, no queue. For
must-not-drop messages, pair with [Pushover alerts](#pushover-alerts) — those bypass
the host entirely.

The spoke polls the host every **15 seconds** and merges the result with its local
store. Remote-origin items toast on the receiving machine only when their severity
meets the `toastRemote` floor.

### config.json fields

| Field | Machine | Effect |
|---|---|---|
| `secret` | Both | The one top-level `"secret"` authenticates everything — the local MCP path **and** all spoke↔host traffic. Host and every spoke must hold the **identical value**; there is no separate `host.secret`. |
| `host` | Spoke | `{ "url": "http://<host-LAN-IP>:<port>" }` — its presence marks this machine as a spoke. `url` is the only key; credentials come from the top-level `secret`. |
| `bind` | Host | LAN IP to listen on (e.g. `"192.168.1.10"`). Absent → loopback only; spokes can't reach a loopback-bound host. |
| `toastRemote` | Either | Severity floor for cross-machine toasts: `"info"`, `"success"`, `"warning"` (default), `"alert"`, or `"never"` to disable. |

### Host setup (one-time)

1. Add `"bind": "<host-LAN-IP>"` to `%APPDATA%\Raccourier\config.json`.
2. Add a **Windows Firewall inbound rule** on the host: TCP inbound, private
   networks, the port number in `config.json`.
3. Restart the tray app so it rebinds to the LAN interface.

### Spoke setup (one-time)

1. Add `"host": { "url": "http://<host-LAN-IP>:<port>" }` to the spoke's
   `%APPDATA%\Raccourier\config.json`. Use the **host's** port here — the spoke's
   own `"port"` stays whatever was generated for it.
2. **Replace the spoke's auto-generated top-level `"secret"` with the host's.**
   Both machines must share the same value — there is no automated pairing flow,
   and no nested `host.secret` field.
3. Restart the tray app on the spoke.

A working spoke config looks like this:

```jsonc
// spoke's %APPDATA%\Raccourier\config.json
{
  "port": 52341,                                   // spoke's own local port (keep the generated value)
  "secret": "<paste the HOST's secret here>",      // shared — replaces the spoke's generated secret
  "host": { "url": "http://192.168.1.10:46768" }   // host's LAN IP and the HOST's port
}
```

**If the secrets differ, nothing errors loudly:** the host answers every forward
and poll with 401, the spoke drops those failures by design (best-effort link),
and the only symptom is "Host unreachable" in the spoke's window header while
messages silently stop crossing machines. Quick check from the spoke:
`curl -H "x-raccourier-secret: <host-secret>" http://<host-LAN-IP>:<port>/health`
— `{"app":"raccourier",...}` means the pairing is good; `unauthorized` means the
secrets still differ.

> **Security note:** the shared secret travels over your LAN in cleartext (HTTP).
> This is an accepted tradeoff on a trusted private network: the secret is a strong
> 48-character random hex value (generated on first run), and no Internet exposure is
> assumed. Don't enable host/spoke on untrusted networks.

## Pushover alerts

Add `pushover` creds to `%APPDATA%\Raccourier\config.json` on any machine that
should ping your phone:

```jsonc
{
  "port": ..., "secret": "...",
  "pushover": { "token": "<app-token>", "user": "<user-key>" }
}
```

Raccourier fires a Pushover notification when `severity: "alert"` or `push: true`.
It fires **from the originating machine directly to Pushover** — never relayed
through the host (which may be asleep). `severity: "alert"` maps to Pushover
priority 1 (bypasses quiet hours); all other severities use priority 0.

Absent or incomplete creds silently disable the feature — the local write and feed
work regardless. Each machine that should push to your phone needs its own creds.

## Behavior & storage

- **`history.json`** (`%APPDATA%\Raccourier\history.json`) is an **append-only log**,
  pruned by **both** rules (whichever trims first): older than **14 days** and at
  most **500** records. It is never wiped by "Clear history" or `clear_messages` —
  those write a local overlay instead (see below).
- **`read-state.json`** (same directory) is a device-local overlay that records
  which messages have been read or hidden. All three clear paths — tray "Clear
  history" menu, the renderer IPC clear, and `clear_messages` — write this overlay
  only. On the host, `history.json` is the cross-machine archive; a spoke's
  `clear_messages` does not wipe it.
- Config (`port`, `secret`) is generated per-user on first run at
  `%APPDATA%\Raccourier\config.json`. Optional fields for advanced setups: `bind`,
  `host`, `pushover`, `origin`, `toastRemote` — see the sections above.
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
