import { describe, it, expect } from "vitest";
import { view } from "../app/mergeView.js";

const rec = (id, receivedAt, extra = {}) => ({ id, title: id, body: "b", receivedAt, ...extra });
const T = (s) => `2026-07-01T00:00:0${s}.000Z`;

describe("mergeView.view", () => {
  it("dedupes by id with local winning over host", () => {
    const local = [rec("a", T(1), { title: "local-a" })];
    const host = [rec("a", T(1), { title: "host-a" }), rec("b", T(2))];
    const out = view(local, host, { read: [], cleared: [] });
    const byId = Object.fromEntries(out.map((r) => [r.id, r.title]));
    expect(byId).toEqual({ a: "local-a", b: "b" });
  });

  it("hides cleared ids", () => {
    const local = [rec("a", T(1)), rec("b", T(2))];
    const out = view(local, [], { read: [], cleared: [{ id: "a", at: T(1) }] });
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("decorates each record with an effective read boolean from the overlay", () => {
    const local = [rec("a", T(1)), rec("b", T(2))];
    const out = view(local, [], { read: [{ id: "a", at: T(1) }], cleared: [] });
    const byId = Object.fromEntries(out.map((r) => [r.id, r.read]));
    expect(byId).toEqual({ a: true, b: false });
  });

  it("sorts by receivedAt ascending", () => {
    const local = [rec("late", T(3)), rec("early", T(1)), rec("mid", T(2))];
    const out = view(local, [], { read: [], cleared: [] });
    expect(out.map((r) => r.id)).toEqual(["early", "mid", "late"]);
  });

  it("tolerates an empty host array and undefined overlay lists", () => {
    const out = view([rec("a", T(1))], [], {});
    expect(out.map((r) => r.id)).toEqual(["a"]);
    expect(out[0].read).toBe(false);
  });
});
