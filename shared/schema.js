const { z } = require("zod");

const notifyShape = {
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(["info", "success", "warning", "alert"]).default("info"),
  source: z.string().optional(),
  origin: z.string().optional(),
  popup: z.boolean().default(true),
  push: z.boolean().optional(),
};

const notifySchema = z.object(notifyShape);

// Origin rides the notify payload: the MCP server stamps its per-registration
// RACCOURIER_ORIGIN here (env wins over any arg-supplied origin) before POSTing.
function applyOrigin(args, origin) {
  return origin ? { ...args, origin } : args;
}

// Pure record builder used by the tray's onNotify. The origin fallback chain is
// payload origin -> config.json origin -> os.hostname(); ids/timestamps and the
// hostname are injected so this stays testable without Electron. Guarantees a
// non-empty origin as long as hostname is non-empty.
function buildRecord(data, { id, receivedAt, configOrigin, hostname }) {
  const origin = data.origin || configOrigin || hostname;
  return { id, receivedAt, ...data, origin };
}

function teaser(body, max = 140) {
  const line = String(body)
    .replace(/[#*_`>~]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

module.exports = { notifyShape, notifySchema, applyOrigin, buildRecord, teaser };
