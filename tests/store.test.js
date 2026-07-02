import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "raccourier-"));
  process.env.RACCOURIER_DIR = dir;
});
afterEach(() => {
  delete process.env.RACCOURIER_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const NOW = Date.parse("2026-07-01T12:00:00Z");
const rec = (id, ageDays) => ({
  id,
  title: id,
  body: "b",
  severity: "info",
  receivedAt: new Date(NOW - ageDays * 86400000).toISOString(),
});

describe("store", () => {
  it("load returns [] when no file exists", async () => {
    const s = await import("../app/store.js");
    expect(s.load()).toEqual([]);
  });

  it("prune drops records older than 14 days", async () => {
    const { prune } = await import("../app/store.js");
    const kept = prune([rec("old", 15), rec("fresh", 1)], NOW);
    expect(kept.map((r) => r.id)).toEqual(["fresh"]);
  });

  it("prune caps at 500 newest", async () => {
    const { prune } = await import("../app/store.js");
    const many = Array.from({ length: 600 }, (_, i) => rec("r" + i, 0));
    const kept = prune(many, NOW);
    expect(kept.length).toBe(500);
    expect(kept[kept.length - 1].id).toBe("r599");
  });

  it("add prunes, appends, persists, and returns the new list", async () => {
    const { add, load } = await import("../app/store.js");
    add(rec("old", 20), NOW);
    const out = add(rec("new", 0), NOW);
    expect(out.map((r) => r.id)).toEqual(["new"]);
    expect(load().map((r) => r.id)).toEqual(["new"]);
  });

  // Read-state mutation moved out of the store to the read-state.json overlay
  // (app/readState.js) — see tests/readState.test.js. history.json is now a pure
  // append-log, so store no longer exposes markRead/markAllRead.
  it("no longer mutates records for read-state", async () => {
    const s = await import("../app/store.js");
    expect(s.markRead).toBeUndefined();
    expect(s.markAllRead).toBeUndefined();
  });
});
