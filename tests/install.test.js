import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { register, serverEntry, TARGETS } from "../mcp/install.js";

describe("serverEntry", () => {
  it("dev (node) entry runs server.js with no ELECTRON_RUN_AS_NODE", () => {
    // Tests run under node, so execPath is not raccourier.exe → dev branch.
    const e = serverEntry();
    expect(e.type).toBe("stdio");
    expect(e.command).toBe(process.execPath);
    expect(e.args).toHaveLength(1);
    expect(e.args[0]).toMatch(/server\.js$/);
    expect(e.env).toEqual({});
  });

  it("packaged (Raccourier.exe) entry sets ELECTRON_RUN_AS_NODE, never a bare --mcp", () => {
    const real = process.execPath;
    try {
      // Simulate being invoked from the packaged exe.
      Object.defineProperty(process, "execPath", { value: join(real, "..", "Raccourier.exe"), configurable: true });
      const e = serverEntry();
      expect(e.args).not.toContain("--mcp"); // the bug we are fixing
      expect(e.args[0]).toMatch(/server\.js$/);
      expect(e.env).toEqual({ ELECTRON_RUN_AS_NODE: "1" });
    } finally {
      Object.defineProperty(process, "execPath", { value: real, configurable: true });
    }
  });
});

describe("TARGETS", () => {
  it("resolves claude-code and claude-desktop to concrete paths, cowork to null", () => {
    expect(TARGETS["claude-code"]()).toMatch(/\.claude\.json$/);
    expect(TARGETS["claude-desktop"]()).toMatch(/claude_desktop_config\.json$/);
    expect(TARGETS.cowork()).toBeNull();
  });
});

describe("register", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "raccourier-install-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates the config file (and missing parent dirs) with a raccourier entry", () => {
    const file = join(dir, "nested", "claude_desktop_config.json");
    register(file);
    expect(existsSync(file)).toBe(true);
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    expect(cfg.mcpServers.raccourier.args[0]).toMatch(/server\.js$/);
  });

  it("merges into an existing config without clobbering other keys or servers", () => {
    const file = join(dir, "config.json");
    writeFileSync(
      file,
      JSON.stringify({ theme: "dark", mcpServers: { other: { command: "x" } } })
    );
    register(file);
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    expect(cfg.theme).toBe("dark"); // unrelated top-level key preserved
    expect(cfg.mcpServers.other).toEqual({ command: "x" }); // sibling server preserved
    expect(cfg.mcpServers.raccourier).toBeDefined();
  });

  it("recovers from a corrupt config file by starting fresh", () => {
    const file = join(dir, "config.json");
    writeFileSync(file, "{ not valid json");
    register(file);
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    expect(cfg.mcpServers.raccourier).toBeDefined();
  });
});
