import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
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

describe("config", () => {
  it("first run creates config.json with a port in range and a hex secret", async () => {
    const { loadConfig, configDir } = await import("../shared/config.js");
    const cfg = loadConfig();
    expect(configDir()).toBe(dir);
    expect(cfg.port).toBeGreaterThanOrEqual(40000);
    expect(cfg.port).toBeLessThan(60000);
    expect(cfg.secret).toMatch(/^[0-9a-f]{48}$/);
    expect(existsSync(join(dir, "config.json"))).toBe(true);
  });

  it("is idempotent: second load returns identical values", async () => {
    const { loadConfig } = await import("../shared/config.js");
    const a = loadConfig();
    const b = loadConfig();
    expect(b).toEqual(a);
    // and the file was not rewritten with new values
    expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8"))).toEqual(a);
  });
});
