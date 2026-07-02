// Phase 3 spoke→host link + cross-machine toast policy.
//
// A machine is a SPOKE when config.host.url is set; otherwise it is the HOST.
// Spokes write locally first, then best-effort forward the full minted record to
// the host's /ingest, and poll the host's /messages for the merged feed. All
// network work here is fire-and-forget: nothing throws, failures are logged and
// swallowed (no retry, no queue — the Tier 3 durable outbound queue was rejected;
// critical messages already survive via the direct Pushover path).

const SECRET_HEADER = "x-raccourier-secret";

// Severity floor ordering for the remote-origin toast policy.
const SEVERITY_ORDER = { info: 0, success: 1, warning: 2, alert: 3 };

/**
 * Best-effort forward of a full pre-minted record to the host's /ingest.
 * No-op when this machine is the host (no host.url). Never throws.
 */
async function forwardToHost(cfg, record, fetchImpl = fetch) {
  if (!cfg || !cfg.host || !cfg.host.url) return; // host machine — nothing to forward to
  try {
    const res = await fetchImpl(`${cfg.host.url}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: cfg.secret },
      body: JSON.stringify(record),
    });
    if (!res.ok) console.error(`[hostLink] ingest non-2xx: ${res.status}`);
  } catch (e) {
    // Host down / network error: drop silently (best-effort LAN feed).
    console.error("[hostLink] forward failed:", e && e.message ? e.message : e);
  }
}

/**
 * Poll the host's raw feed (/messages?raw=1 — the bare append-log, so the
 * host's local clears never leak into this spoke's view). Returns the records
 * array, [] when this machine is the host (nothing to poll), or NULL on any
 * failure — callers keep the last known host records on null rather than
 * blanking the feed while the host naps (records are immutable events; stale
 * is still true). Host serves newest-first; mergeView re-sorts.
 */
async function pollHost(cfg, fetchImpl = fetch) {
  if (!cfg || !cfg.host || !cfg.host.url) return [];
  try {
    const res = await fetchImpl(`${cfg.host.url}/messages?raw=1`, {
      headers: { [SECRET_HEADER]: cfg.secret },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j && j.messages) ? j.messages : null;
  } catch {
    return null;
  }
}

/**
 * Cross-machine toast policy for a REMOTE-origin record. Callers gate on
 * remoteness + not-already-seen first; this decides noise level by severity.
 * A record toasts only if its severity meets the configured floor
 * (cfg.toastRemote, default "warning"); "never" disables remote toasts.
 */
function shouldToastRemote(record, cfg) {
  const floor = (cfg && cfg.toastRemote) || "warning";
  if (floor === "never") return false;
  const floorRank = SEVERITY_ORDER[floor];
  const sevRank = SEVERITY_ORDER[record && record.severity];
  if (floorRank === undefined || sevRank === undefined) return false;
  return sevRank >= floorRank;
}

module.exports = { forwardToHost, pollHost, shouldToastRemote, SEVERITY_ORDER };
