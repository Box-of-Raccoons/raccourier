import { describe, it, expect, vi } from "vitest";
import { forwardToHost, pollHost, shouldToastRemote } from "../app/hostLink.js";

const spokeCfg = { secret: "shared-secret", host: { url: "http://192.168.1.10:41234" } };
const hostCfg = { secret: "shared-secret" }; // no host.url ⇒ this machine is the host

const record = {
  id: "rec-1",
  receivedAt: "2026-07-01T00:00:00.000Z",
  origin: "work-claude",
  title: "T",
  body: "B",
  severity: "warning",
};

function okFetch(json = {}) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => json });
}

describe("forwardToHost", () => {
  it("POSTs the full record to host.url/ingest with the secret header", async () => {
    const mockFetch = okFetch();
    await forwardToHost(spokeCfg, record, mockFetch);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("http://192.168.1.10:41234/ingest");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-raccourier-secret"]).toBe("shared-secret");
    expect(JSON.parse(opts.body)).toEqual(record);
  });

  it("is a no-op (no fetch) when host.url is absent (host machine)", async () => {
    const mockFetch = vi.fn();
    await forwardToHost(hostCfg, record, mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not throw when fetch rejects (host down)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(forwardToHost(spokeCfg, record, mockFetch)).resolves.toBeUndefined();
  });

  it("does not throw on a non-2xx response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(forwardToHost(spokeCfg, record, mockFetch)).resolves.toBeUndefined();
  });
});

describe("pollHost", () => {
  it("polls the raw feed (no host-overlay filtering) and returns the messages array", async () => {
    const mockFetch = okFetch({ messages: [record] });
    const out = await pollHost(spokeCfg, mockFetch);
    expect(out).toEqual([record]);
    const [url, opts] = mockFetch.mock.calls[0];
    // raw=1: the host's local clears must not leak into this spoke's feed.
    expect(url).toBe("http://192.168.1.10:41234/messages?raw=1");
    expect(opts.headers["x-raccourier-secret"]).toBe("shared-secret");
  });

  it("returns [] when host.url is absent", async () => {
    const mockFetch = vi.fn();
    expect(await pollHost(hostCfg, mockFetch)).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Failures return null (not []) so the caller keeps the last known host
  // records instead of blanking the merged view while the host naps.
  it("returns null on a network failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("network"));
    expect(await pollHost(spokeCfg, mockFetch)).toBeNull();
  });

  it("returns null on a non-2xx response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    expect(await pollHost(spokeCfg, mockFetch)).toBeNull();
  });
});

describe("shouldToastRemote", () => {
  const rec = (severity) => ({ ...record, severity });

  it("default floor is warning: info/success do not toast, warning/alert do", () => {
    expect(shouldToastRemote(rec("info"), {})).toBe(false);
    expect(shouldToastRemote(rec("success"), {})).toBe(false);
    expect(shouldToastRemote(rec("warning"), {})).toBe(true);
    expect(shouldToastRemote(rec("alert"), {})).toBe(true);
  });

  it("floor 'alert' toasts only alerts", () => {
    const cfg = { toastRemote: "alert" };
    expect(shouldToastRemote(rec("warning"), cfg)).toBe(false);
    expect(shouldToastRemote(rec("alert"), cfg)).toBe(true);
  });

  it("floor 'info' toasts everything", () => {
    const cfg = { toastRemote: "info" };
    expect(shouldToastRemote(rec("info"), cfg)).toBe(true);
    expect(shouldToastRemote(rec("alert"), cfg)).toBe(true);
  });

  it("floor 'never' disables all remote toasts", () => {
    const cfg = { toastRemote: "never" };
    expect(shouldToastRemote(rec("alert"), cfg)).toBe(false);
    expect(shouldToastRemote(rec("warning"), cfg)).toBe(false);
  });
});
