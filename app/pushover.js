const { teaser } = require("../shared/schema");

/**
 * Fire a Pushover notification for the given record. Always fire-and-forget
 * from the caller — this function never throws; all failures are logged only.
 *
 * @param {object} record       - Fully-built record (title, body, severity, …)
 * @param {object} pushoverCfg  - { token, user } from config.json; absent → skip.
 * @param {Function} fetchImpl  - Injectable fetch for testing; defaults to global fetch.
 */
async function sendPushover(record, pushoverCfg, fetchImpl = fetch) {
  // Missing or incomplete creds → silent skip (Pushover feature is off).
  if (!pushoverCfg || !pushoverCfg.token || !pushoverCfg.user) return;

  try {
    const params = new URLSearchParams({
      token: pushoverCfg.token,
      user: pushoverCfg.user,
      title: record.title,
      // Pushover caps message at 1024 chars; flatten markdown first.
      message: teaser(record.body, 1024),
      // priority 1 = high (bypasses quiet hours) for alerts; 0 = normal.
      priority: String(record.severity === "alert" ? 1 : 0),
    });

    const res = await fetchImpl("https://api.pushover.net/1/messages.json", {
      method: "POST",
      body: params,
    });

    if (!res.ok) {
      console.error(`[pushover] non-2xx response: ${res.status}`);
    }
  } catch (e) {
    // Never let a Pushover failure propagate — the local write path must not break.
    console.error("[pushover] request failed:", e);
  }
}

module.exports = { sendPushover };
