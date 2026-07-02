// Merge/view: union local + host records deduped by id (local wins on a
// duplicate id), minus cleared ids, each record decorated with an effective
// `read` boolean from the overlay, sorted by receivedAt ascending. Callers that
// want newest-first keep their existing `.slice().reverse()`.
//
// Host source is stubbed empty in Phase 1; Phase 3 fills it in.
function view(localRecords, hostRecords, overlay) {
  const ov = overlay || { read: [], cleared: [] };
  const readSet = new Set((ov.read || []).map((e) => e.id));
  const clearedSet = new Set((ov.cleared || []).map((e) => e.id));

  const byId = new Map();
  for (const r of hostRecords || []) byId.set(r.id, r); // host first
  for (const r of localRecords || []) byId.set(r.id, r); // local wins on dup id

  const merged = [];
  for (const r of byId.values()) {
    if (clearedSet.has(r.id)) continue;
    merged.push({ ...r, read: readSet.has(r.id) });
  }
  merged.sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  return merged;
}

module.exports = { view };
