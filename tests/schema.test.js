import { describe, it, expect } from "vitest";
import { notifySchema, teaser } from "../shared/schema.js";

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
