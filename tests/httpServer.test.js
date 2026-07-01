import { describe, it, expect, beforeEach, afterEach } from "vitest";

let server, base;
const secret = "s3cr3t";
let db;

async function call(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(base + path, { ...opts, headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeEach(async () => {
  db = [];
  const store = {
    load: () => db,
    save: (r) => { db = r; },
  };
  const onNotify = (data) => {
    const record = { id: "id-" + db.length, receivedAt: "2026-07-01T00:00:00.000Z", ...data };
    db.push(record);
    return record;
  };
  const { createServer } = await import("../app/httpServer.js");
  server = createServer({ secret, version: "test", store, onNotify });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => new Promise((r) => server.close(r)));

const auth = { headers: { "x-raccourier-secret": secret } };

describe("httpServer", () => {
  it("rejects requests without the secret", async () => {
    const { status } = await call("/health");
    expect(status).toBe(401);
  });
  it("health returns the app signature", async () => {
    const { status, body } = await call("/health", auth);
    expect(status).toBe(200);
    expect(body).toEqual({ app: "raccourier", version: "test" });
  });
  it("notify validates, stores, and returns id + receivedAt", async () => {
    const { status, body } = await call("/notify", {
      ...auth, method: "POST",
      body: JSON.stringify({ title: "T", body: "B", source: "mail-triage" }),
    });
    expect(status).toBe(200);
    expect(body.id).toBe("id-0");
    expect(body.receivedAt).toBeTruthy();
    expect(db).toHaveLength(1);
  });
  it("notify rejects an invalid payload with 400", async () => {
    const { status } = await call("/notify", { ...auth, method: "POST", body: JSON.stringify({ body: "no title" }) });
    expect(status).toBe(400);
  });
  it("messages returns newest-first and filters by source", async () => {
    await call("/notify", { ...auth, method: "POST", body: JSON.stringify({ title: "a", body: "b", source: "x" }) });
    await call("/notify", { ...auth, method: "POST", body: JSON.stringify({ title: "c", body: "d", source: "y" }) });
    const { body } = await call("/messages?source=x", auth);
    expect(body.messages.map((m) => m.title)).toEqual(["a"]);
    const all = await call("/messages", auth);
    expect(all.body.messages.map((m) => m.title)).toEqual(["c", "a"]);
  });
  it("clear empties the store and reports the count", async () => {
    await call("/notify", { ...auth, method: "POST", body: JSON.stringify({ title: "a", body: "b" }) });
    const { body } = await call("/clear", { ...auth, method: "POST" });
    expect(body.cleared).toBe(1);
    expect(db).toHaveLength(0);
  });
});
