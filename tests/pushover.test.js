import { describe, it, expect, vi } from "vitest";
import { sendPushover } from "../app/pushover.js";
import { notifySchema } from "../shared/schema.js";

const pushoverCfg = { token: "tok123", user: "usr456" };

const alertRecord = {
  id: "id-1",
  receivedAt: "2026-07-01T00:00:00.000Z",
  title: "Alert!",
  body: "**Something bad** happened",
  severity: "alert",
  origin: "work",
};

const infoRecord = {
  id: "id-2",
  receivedAt: "2026-07-01T00:00:00.000Z",
  title: "Info",
  body: "Everything is fine",
  severity: "info",
  origin: "work",
};

function okFetch() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200 });
}

describe("sendPushover — fires correctly when creds present", () => {
  it("calls the Pushover API with the correct URL", async () => {
    const mockFetch = okFetch();
    await sendPushover(alertRecord, pushoverCfg, mockFetch);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.pushover.net/1/messages.json");
  });

  it("sends token and user from creds", async () => {
    const mockFetch = okFetch();
    await sendPushover(alertRecord, pushoverCfg, mockFetch);
    const [, opts] = mockFetch.mock.calls[0];
    const params = opts.body;
    expect(params.get("token")).toBe("tok123");
    expect(params.get("user")).toBe("usr456");
  });

  it("maps record.title to the title field", async () => {
    const mockFetch = okFetch();
    await sendPushover(alertRecord, pushoverCfg, mockFetch);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body.get("title")).toBe("Alert!");
  });

  it("flattens markdown in the message body via teaser", async () => {
    const mockFetch = okFetch();
    await sendPushover(alertRecord, pushoverCfg, mockFetch);
    const [, opts] = mockFetch.mock.calls[0];
    // "**Something bad** happened" → markdown stripped → "Something bad happened"
    expect(opts.body.get("message")).toBe("Something bad happened");
  });

  it("sets priority 1 for severity === 'alert'", async () => {
    const mockFetch = okFetch();
    await sendPushover(alertRecord, pushoverCfg, mockFetch);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body.get("priority")).toBe("1");
  });

  it("sets priority 0 for non-alert severity", async () => {
    const mockFetch = okFetch();
    await sendPushover(infoRecord, pushoverCfg, mockFetch);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body.get("priority")).toBe("0");
  });
});

describe("sendPushover — skips when creds absent or incomplete", () => {
  it("skips (fetch not called) when pushoverCfg is undefined", async () => {
    const mockFetch = vi.fn();
    await sendPushover(alertRecord, undefined, mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips when pushoverCfg is null", async () => {
    const mockFetch = vi.fn();
    await sendPushover(alertRecord, null, mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips when token is missing", async () => {
    const mockFetch = vi.fn();
    await sendPushover(alertRecord, { user: "usr456" }, mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips when user is missing", async () => {
    const mockFetch = vi.fn();
    await sendPushover(alertRecord, { token: "tok123" }, mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("sendPushover — fetch failure does not throw", () => {
  it("a rejecting fetch resolves without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    await expect(sendPushover(alertRecord, pushoverCfg, mockFetch)).resolves.toBeUndefined();
  });

  it("a non-2xx response resolves without throwing", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(sendPushover(alertRecord, pushoverCfg, mockFetch)).resolves.toBeUndefined();
  });
});

describe("sendPushover — message truncation", () => {
  it("truncates a body longer than 1024 chars via teaser", async () => {
    const longRecord = { ...alertRecord, body: "x".repeat(2000) };
    const mockFetch = okFetch();
    await sendPushover(longRecord, pushoverCfg, mockFetch);
    const [, opts] = mockFetch.mock.calls[0];
    const msg = opts.body.get("message");
    expect(msg.length).toBeLessThanOrEqual(1024);
    expect(msg.endsWith("…")).toBe(true);
  });
});

// Additive schema test: push: true passes notifySchema validation.
describe("notifySchema — push field (additive)", () => {
  it("accepts push: true", () => {
    const r = notifySchema.parse({ title: "T", body: "B", push: true });
    expect(r.push).toBe(true);
  });

  it("accepts push: false", () => {
    const r = notifySchema.parse({ title: "T", body: "B", push: false });
    expect(r.push).toBe(false);
  });

  it("omitting push leaves it undefined (optional)", () => {
    const r = notifySchema.parse({ title: "T", body: "B" });
    expect(r.push).toBeUndefined();
  });
});
