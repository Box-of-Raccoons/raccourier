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
  return { read: [], cleared: [], seen: [] };
}

// Full on-disk state incl. the Phase 3 `seen` toast-dedupe set. Backward-compat:
// a read-state.json written before `seen` existed loads as seen: []. Used
// internally so mutating writes preserve seen; the public load() below keeps its
// {read, cleared} shape (the render/merge overlay contract) unchanged.
function loadFull() {
  try {
    const data = JSON.parse(fs.readFileSync(readStatePath(), "utf8"));
    return {
      read: Array.isArray(data.read) ? data.read : [],
      cleared: Array.isArray(data.cleared) ? data.cleared : [],
      seen: Array.isArray(data.seen) ? data.seen : [],
    };
  } catch {
    return empty();
  }
}

function load() {
  const { read, cleared } = loadFull();
  return { read, cleared };
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
    seen: pruneList(state.seen, cutoff),
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
  const state = loadFull();
  state.read = upsert(state.read, id, now);
  return save(state, now);
}

function markAllRead(ids, now = Date.now()) {
  const state = loadFull();
  for (const id of ids) state.read = upsert(state.read, id, now);
  return save(state, now);
}

function clear(ids, now = Date.now()) {
  const state = loadFull();
  for (const id of ids) state.cleared = upsert(state.cleared, id, now);
  return save(state, now);
}

// Undo a clear: drop ids back out of the cleared overlay so they reappear in the
// merged view. Cheap and lossless because clear is overlay-only — the append-log
// was never touched. Unknown ids are a no-op.
function unclear(ids, now = Date.now()) {
  const drop = new Set(ids);
  const state = loadFull();
  state.cleared = state.cleared.filter((e) => !drop.has(e.id));
  return save(state, now);
}

// Phase 3 cross-machine toast dedupe: record every id the spoke has polled from
// the host so a restart / host-nap recovery can't toast-storm the backlog.
function markSeen(ids, now = Date.now()) {
  const state = loadFull();
  for (const id of ids) state.seen = upsert(state.seen, id, now);
  return save(state, now);
}

function isRead(id, state = loadFull()) {
  return state.read.some((e) => e.id === id);
}

function isCleared(id, state = loadFull()) {
  return state.cleared.some((e) => e.id === id);
}

function isSeen(id, state = loadFull()) {
  return state.seen.some((e) => e.id === id);
}

module.exports = { load, loadFull, save, prune, markRead, markAllRead, clear, unclear, markSeen, isRead, isCleared, isSeen };
