const { z } = require("zod");

const notifyShape = {
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(["info", "success", "warning", "alert"]).default("info"),
  source: z.string().optional(),
  popup: z.boolean().default(true),
};

const notifySchema = z.object(notifyShape);

function teaser(body, max = 140) {
  const line = String(body)
    .replace(/[#*_`>~]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

module.exports = { notifyShape, notifySchema, teaser };
