import { describe, it, expect } from "vitest";
import { notifySchema, teaser, applyOrigin, buildRecord } from "../shared/schema.js";

describe("notifySchema", () => {
  it("accepts a valid payload and applies defaults", () => {
    const r = notifySchema.parse({ title: "Hi", body: "Body" });
    expect(r.severity).toBe("info");
    expect(r.popup).toBe(true);
  });
  it("rejects a missing title", () => {
    expect(notifySchema.safeParse({ body: "x" }).success).toBe(false);
  });
  it("rejects an unknown severity", () => {
    expect(notifySchema.safeParse({ title: "a", body: "b", severity: "boom" }).success).toBe(false);
  });
});

describe("notifySchema origin", () => {
  it("accepts an optional origin", () => {
    const r = notifySchema.parse({ title: "Hi", body: "Body", origin: "work" });
    expect(r.origin).toBe("work");
  });
});

describe("applyOrigin (server payload stamping)", () => {
  it("adds the env origin label to the payload when set", () => {
    expect(applyOrigin({ title: "a", body: "b" }, "work")).toEqual({ title: "a", body: "b", origin: "work" });
  });
  it("env origin wins over an arg-supplied origin", () => {
    expect(applyOrigin({ title: "a", body: "b", origin: "arg" }, "work").origin).toBe("work");
  });
  it("leaves the payload untouched when no env label is set", () => {
    expect(applyOrigin({ title: "a", body: "b" }, undefined)).toEqual({ title: "a", body: "b" });
  });
});

describe("buildRecord (onNotify fallback chain)", () => {
  const base = { id: "id1", receivedAt: "2026-07-01T00:00:00.000Z", configOrigin: "cfg", hostname: "hostpc" };
  it("prefers the payload origin", () => {
    expect(buildRecord({ title: "t", body: "b", origin: "payload" }, base).origin).toBe("payload");
  });
  it("falls back to config origin when payload lacks one", () => {
    expect(buildRecord({ title: "t", body: "b" }, base).origin).toBe("cfg");
  });
  it("falls back to hostname when payload and config lack one", () => {
    expect(buildRecord({ title: "t", body: "b" }, { ...base, configOrigin: undefined }).origin).toBe("hostpc");
  });
  it("always yields a non-empty origin", () => {
    const r = buildRecord({ title: "t", body: "b" }, { id: "x", receivedAt: "now", configOrigin: "", hostname: "hostpc" });
    expect(r.origin).toBe("hostpc");
  });
});

describe("teaser", () => {
  it("collapses whitespace and strips markdown symbols", () => {
    expect(teaser("# Heading\n\n- **bold** item")).toBe("Heading bold item");
  });
  it("truncates with an ellipsis past max", () => {
    const t = teaser("x".repeat(200), 10);
    expect(t.length).toBe(10);
    expect(t.endsWith("…")).toBe(true);
  });
});
