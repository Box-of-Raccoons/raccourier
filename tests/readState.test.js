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
const ago = (days) => NOW - days * 86400000;

describe("readState overlay", () => {
  it("load returns an empty overlay when no file exists", async () => {
    const rs = await import("../app/readState.js");
    expect(rs.load()).toEqual({ read: [], cleared: [] });
  });

  it("markRead writes {id, at} and isRead reflects it", async () => {
    const rs = await import("../app/readState.js");
    rs.markRead("a", NOW);
    const state = rs.load();
    expect(state.read).toEqual([{ id: "a", at: new Date(NOW).toISOString() }]);
    expect(rs.isRead("a")).toBe(true);
    expect(rs.isRead("b")).toBe(false);
  });

  it("markRead upserts (no duplicate id, keeps latest at)", async () => {
    const rs = await import("../app/readState.js");
    rs.markRead("a", ago(1));
    rs.markRead("a", NOW);
    const state = rs.load();
    expect(state.read).toEqual([{ id: "a", at: new Date(NOW).toISOString() }]);
  });

  it("markAllRead writes an {id, at} entry per id", async () => {
    const rs = await import("../app/readState.js");
    rs.markAllRead(["a", "b"], NOW);
    expect(rs.load().read.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("clear writes to the cleared list and isCleared reflects it", async () => {
    const rs = await import("../app/readState.js");
    rs.clear(["x", "y"], NOW);
    const state = rs.load();
    expect(state.cleared.map((e) => e.id)).toEqual(["x", "y"]);
    expect(state.cleared.every((e) => e.at === new Date(NOW).toISOString())).toBe(true);
    expect(rs.isCleared("x")).toBe(true);
    expect(rs.isCleared("z")).toBe(false);
  });

  it("prune drops entries older than 14 days by their at", async () => {
    const { prune } = await import("../app/readState.js");
    const state = {
      read: [{ id: "old", at: new Date(ago(15)).toISOString() }, { id: "fresh", at: new Date(ago(1)).toISOString() }],
      cleared: [{ id: "cold", at: new Date(ago(20)).toISOString() }],
    };
    const kept = prune(state, NOW);
    expect(kept.read.map((e) => e.id)).toEqual(["fresh"]);
    expect(kept.cleared).toEqual([]);
  });

  it("prune caps each list at 500 newest", async () => {
    const { prune } = await import("../app/readState.js");
    const read = Array.from({ length: 600 }, (_, i) => ({ id: "r" + i, at: new Date(ago(0)).toISOString() }));
    const kept = prune({ read, cleared: [] }, NOW);
    expect(kept.read.length).toBe(500);
    expect(kept.read[kept.read.length - 1].id).toBe("r599");
  });

  it("save prunes on write", async () => {
    const rs = await import("../app/readState.js");
    const state = {
      read: [{ id: "old", at: new Date(ago(30)).toISOString() }, { id: "fresh", at: new Date(ago(1)).toISOString() }],
      cleared: [],
    };
    rs.save(state, NOW);
    expect(rs.load().read.map((e) => e.id)).toEqual(["fresh"]);
  });
});
