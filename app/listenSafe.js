// Bind the HTTP server without letting a bad `bind` address kill the app.
//
// A wrong config.json "bind" IP, a DHCP lease change, or a NIC that isn't up
// yet at login-autostart all produce a listen error (EADDRNOTAVAIL). The tray's
// local features (toasts, history, the loopback MCP path) don't depend on the
// LAN bind, so the right behavior is: fall back to 127.0.0.1, tell the user,
// keep running. Only if the loopback bind ALSO fails (e.g. port in use) do we
// give up — and even then we resolve so the caller can show a real message
// instead of Electron's uncaught-exception dialog.

// One listen attempt with strictly-paired error/listening listeners. We never
// pass a callback to listen() — that registers a 'listening' listener that
// SURVIVES a failed attempt and would fire on a later successful bind.
function attempt(server, port, host) {
  return new Promise((resolve) => {
    const onError = (err) => {
      server.removeListener("listening", onListening);
      resolve({ ok: false, err });
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve({ ok: true });
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

// Resolves with one of:
//   { bound: <bind> }               — bound as requested
//   { bound: "127.0.0.1", error }   — LAN bind failed, loopback fallback is up
//   { bound: null, error }          — both binds failed
async function listenWithFallback(server, port, bind, onFallback = () => {}) {
  const first = await attempt(server, port, bind);
  if (first.ok) return { bound: bind };
  if (bind === "127.0.0.1") return { bound: null, error: first.err }; // nothing to fall back to
  onFallback(first.err);
  const second = await attempt(server, port, "127.0.0.1");
  if (second.ok) return { bound: "127.0.0.1", error: first.err };
  return { bound: null, error: second.err };
}

// Decide which host the tray's HTTP server listens on. A configured LAN feed
// (cfg.bind set to a real interface, not loopback) must serve BOTH the LAN — so
// spokes can reach the host — AND 127.0.0.1 — so the local MCP path works, since
// bridge.js always talks to 127.0.0.1. Binding a specific IP EXCLUDES loopback,
// which silently breaks notify/list/clear on the host. So when a LAN feed is
// wanted we listen on all interfaces (0.0.0.0); the secret guards the port. No
// LAN feed configured → loopback only.
function resolveBindHost(cfg) {
  return cfg && cfg.bind && cfg.bind !== "127.0.0.1" ? "0.0.0.0" : "127.0.0.1";
}

module.exports = { listenWithFallback, resolveBindHost };
