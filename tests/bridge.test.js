import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";

let server;
afterEach(() => server && new Promise((r) => server.close(r)));

async function startFakeTray({ secret }) {
  server = http.createServer((req, res) => {
    if (req.headers["x-raccourier-secret"] !== secret) {
      res.writeHead(401); return res.end("{}");
    }
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ app: "raccourier", version: "test" }));
    }
    res.writeHead(404); res.end("{}");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { port: server.address().port, secret };
}

describe("bridge.healthy", () => {
  it("true when the tray answers with the right secret and signature", async () => {
    const cfg = await startFakeTray({ secret: "ok" });
    const { healthy } = await import("../mcp/bridge.js");
    expect(await healthy(cfg)).toBe(true);
  });
  it("false when the secret is wrong", async () => {
    const cfg = await startFakeTray({ secret: "ok" });
    const { healthy } = await import("../mcp/bridge.js");
    expect(await healthy({ ...cfg, secret: "nope" })).toBe(false);
  });
  it("false when nothing is listening", async () => {
    const { healthy } = await import("../mcp/bridge.js");
    expect(await healthy({ port: 1, secret: "x" }, 200)).toBe(false);
  });
});

describe("bridge.ensureRunning race guard", () => {
  const cfg = { port: 1, secret: "x" };

  it("never launches when the tray is already healthy", async () => {
    const { ensureRunning } = await import("../mcp/bridge.js");
    let launched = 0;
    await ensureRunning(cfg, { check: async () => true, launch: () => launched++ });
    expect(launched).toBe(0);
  });

  it("skips the launch when the tray comes up during the re-check window", async () => {
    const { ensureRunning } = await import("../mcp/bridge.js");
    // Another instance won the race: unhealthy on first look, healthy on re-check.
    let calls = 0;
    const check = async () => ++calls >= 2;
    let launched = 0;
    await ensureRunning(cfg, { check, launch: () => launched++, recheckDelayMs: 1 });
    expect(launched).toBe(0);
    expect(calls).toBe(2);
  });

  it("launches once when still unhealthy after the re-check", async () => {
    const { ensureRunning } = await import("../mcp/bridge.js");
    const seq = [false, false, true]; // initial, re-check, then healthy after launch
    let i = 0;
    const check = async () => seq[i++] ?? true;
    let launched = 0;
    await ensureRunning(cfg, { check, launch: () => launched++, recheckDelayMs: 1, intervalMs: 1 });
    expect(launched).toBe(1);
  });

  it("throws if the tray never becomes healthy after launching", async () => {
    const { ensureRunning } = await import("../mcp/bridge.js");
    await expect(
      ensureRunning(cfg, { check: async () => false, launch: () => {}, recheckDelayMs: 1, intervalMs: 1, attempts: 2 })
    ).rejects.toThrow(/did not become healthy/);
  });
});
