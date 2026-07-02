import { describe, it, expect, vi, afterEach } from "vitest";
import http from "node:http";
import { listenWithFallback, resolveBindHost } from "../app/listenSafe.js";

// 192.0.2.x is TEST-NET-1 (RFC 5737): never assigned to a local interface, so
// binding it reliably produces EADDRNOTAVAIL — the same failure as a wrong
// config.json "bind" IP or a NIC that isn't up yet.
const BAD_IP = "192.0.2.1";

let servers = [];
function makeServer() {
  const s = http.createServer(() => {});
  servers.push(s);
  return s;
}
afterEach(async () => {
  for (const s of servers) {
    if (s.listening) await new Promise((r) => s.close(r));
  }
  servers = [];
});

describe("listenWithFallback", () => {
  it("binds normally and does not invoke onFallback", async () => {
    const server = makeServer();
    const onFallback = vi.fn();
    const result = await listenWithFallback(server, 0, "127.0.0.1", onFallback);
    expect(result.bound).toBe("127.0.0.1");
    expect(result.error).toBeUndefined();
    expect(onFallback).not.toHaveBeenCalled();
    expect(server.listening).toBe(true);
  });

  it("falls back to loopback when the bind address is not local", async () => {
    const server = makeServer();
    const onFallback = vi.fn();
    const result = await listenWithFallback(server, 0, BAD_IP, onFallback);
    expect(result.bound).toBe("127.0.0.1");
    expect(result.error.code).toBe("EADDRNOTAVAIL");
    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback.mock.calls[0][0].code).toBe("EADDRNOTAVAIL");
    // The server must actually be listening on loopback after the fallback.
    expect(server.listening).toBe(true);
    expect(server.address().address).toBe("127.0.0.1");
  });

  it("resolves bound:null (no crash) when the fallback also fails", async () => {
    // Occupy a loopback port, then ask listenWithFallback to bind the bad IP
    // with that same port — the loopback fallback hits EADDRINUSE.
    const blocker = makeServer();
    await new Promise((r) => blocker.listen(0, "127.0.0.1", r));
    const port = blocker.address().port;

    const server = makeServer();
    const result = await listenWithFallback(server, port, BAD_IP, () => {});
    expect(result.bound).toBeNull();
    expect(result.error).toBeTruthy();
    expect(server.listening).toBe(false);
  });
});

describe("resolveBindHost", () => {
  it("loopback-only when no bind is configured (spoke)", () => {
    expect(resolveBindHost({})).toBe("127.0.0.1");
    expect(resolveBindHost({ bind: "" })).toBe("127.0.0.1");
    expect(resolveBindHost(undefined)).toBe("127.0.0.1");
  });

  it("loopback-only when bind is explicitly 127.0.0.1", () => {
    expect(resolveBindHost({ bind: "127.0.0.1" })).toBe("127.0.0.1");
  });

  it("all interfaces (0.0.0.0) when a LAN bind is configured — keeps loopback for MCP", () => {
    // A specific IP would exclude 127.0.0.1 and break the local MCP path; 0.0.0.0
    // serves both the LAN feed and loopback.
    expect(resolveBindHost({ bind: "192.168.1.206" })).toBe("0.0.0.0");
    expect(resolveBindHost({ bind: "0.0.0.0" })).toBe("0.0.0.0");
  });
});
