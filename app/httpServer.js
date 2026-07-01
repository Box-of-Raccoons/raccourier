const http = require("node:http");
const { notifySchema } = require("../shared/schema");

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function createServer({ secret, version, store, onNotify }) {
  return http.createServer(async (req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (req.headers["x-raccourier-secret"] !== secret) return send(401, { error: "unauthorized" });
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health") {
        return send(200, { app: "raccourier", version });
      }
      if (req.method === "POST" && url.pathname === "/notify") {
        const parsed = notifySchema.safeParse(await readJson(req));
        if (!parsed.success) return send(400, { error: "invalid", detail: parsed.error.issues });
        const record = onNotify(parsed.data);
        return send(200, { id: record.id, receivedAt: record.receivedAt });
      }
      if (req.method === "GET" && url.pathname === "/messages") {
        const limit = Number(url.searchParams.get("limit")) || undefined;
        const source = url.searchParams.get("source") || undefined;
        let msgs = store.load().slice().reverse();
        if (source) msgs = msgs.filter((m) => m.source === source);
        if (limit) msgs = msgs.slice(0, limit);
        return send(200, { messages: msgs });
      }
      if (req.method === "POST" && url.pathname === "/clear") {
        const cleared = store.load().length;
        store.save([]);
        return send(200, { cleared });
      }
      return send(404, { error: "not found" });
    } catch (e) {
      return send(500, { error: String((e && e.message) || e) });
    }
  });
}

module.exports = { createServer };
