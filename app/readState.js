const fs = require("node:fs");
const path = require("node:path");
const { readStatePath } = require("../shared/config");

// Device-local overlay keyed by record id, with a timestamp per entry. Bare id
// sets can't be age-pruned, and pruning by absence-from-view would resurrect
// host-side entries as unread whenever the host naps — so every entry carries
// `at` (ISO 8601, stamped at mark time) and is pruned against the same
// 500-per-list / 14-day window the store uses.
const MAX = 500;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function empty() {
  return { read: [], cleared: [] };
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(readStatePath(), "utf8"));
    return {
      read: Array.isArray(data.read) ? data.read : [],
      cleared: Array.isArray(data.cleared) ? data.cleared : [],
    };
  } catch {
    return empty();
  }
}

function pruneList(list, cutoff) {
  let kept = (Array.isArray(list) ? list : []).filter((e) => Date.parse(e.at) >= cutoff);
  if (kept.length > MAX) kept = kept.slice(kept.length - MAX);
  return kept;
}

function prune(state, now) {
  const cutoff = now - MAX_AGE_MS;
  return {
    read: pruneList(state.read, cutoff),
    cleared: pruneList(state.cleared, cutoff),
  };
}

// Prune on every write.
function save(state, now = Date.now()) {
  const pruned = prune(state, now);
  fs.mkdirSync(path.dirname(readStatePath()), { recursive: true });
  fs.writeFileSync(readStatePath(), JSON.stringify(pruned, null, 2));
  return pruned;
}

function upsert(list, id, now) {
  const at = new Date(now).toISOString();
  const filtered = list.filter((e) => e.id !== id);
  filtered.push({ id, at });
  return filtered;
}

function markRead(id, now = Date.now()) {
  const state = load();
  state.read = upsert(state.read, id, now);
  return save(state, now);
}

function markAllRead(ids, now = Date.now()) {
  const state = load();
  for (const id of ids) state.read = upsert(state.read, id, now);
  return save(state, now);
}

function clear(ids, now = Date.now()) {
  const state = load();
  for (const id of ids) state.cleared = upsert(state.cleared, id, now);
  return save(state, now);
}

function isRead(id, state = load()) {
  return state.read.some((e) => e.id === id);
}

function isCleared(id, state = load()) {
  return state.cleared.some((e) => e.id === id);
}

module.exports = { load, save, prune, markRead, markAllRead, clear, isRead, isCleared };
