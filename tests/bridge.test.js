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
