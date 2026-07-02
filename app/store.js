const fs = require("node:fs");
const path = require("node:path");
const { historyPath } = require("../shared/config");

const MAX = 500;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(historyPath(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(records) {
  fs.mkdirSync(path.dirname(historyPath()), { recursive: true });
  fs.writeFileSync(historyPath(), JSON.stringify(records, null, 2));
}

function prune(records, now) {
  const cutoff = now - MAX_AGE_MS;
  let kept = records.filter((r) => Date.parse(r.receivedAt) >= cutoff);
  if (kept.length > MAX) kept = kept.slice(kept.length - MAX);
  return kept;
}

function add(record, now) {
  const next = prune([...prune(load(), now), record], now);
  save(next);
  return next;
}

// history.json is a pure, immutable append-log. Read-state lives in the
// read-state.json overlay (app/readState.js); records are never mutated here.
// Old records carrying a legacy `read: true` field are left as-is and ignored.
module.exports = { load, save, prune, add };
