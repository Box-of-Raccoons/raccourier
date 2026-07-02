const { loadConfig } = require("../shared/config");
const { notifyShape, applyOrigin } = require("../shared/schema");
const { ensureRunning, postNotify, getMessages, clearMessages } = require("./bridge");

// Per-registration label — the tray copies whichever caller's env launched it,
// so origin must travel per-request in the payload rather than via tray env.
const ORIGIN = process.env.RACCOURIER_ORIGIN;

async function main() {
  const { z } = require("zod");
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

  const cfg = loadConfig();
  const server = new McpServer({ name: "raccourier", version: "1.0.0" });

  const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });
  const fail = (msg) => ({ isError: true, content: [{ type: "text", text: msg }] });

  server.registerTool(
    "notify",
    {
      title: "Notify",
      description:
        "Show a desktop toast and add a markdown entry to the Raccourier history window. Use for daily mail-triage summaries and important alerts.",
      inputSchema: notifyShape,
    },
    async (args) => {
      try {
        await ensureRunning(cfg);
        const result = await postNotify(cfg, applyOrigin(args, ORIGIN));
        return ok(result);
      } catch (e) {
        return fail(`Raccourier could not deliver the notification: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "list_messages",
    {
      title: "List messages",
      description: "Return recent Raccourier history (newest first). Optionally filter by source or limit count.",
      inputSchema: { limit: z.number().int().positive().optional(), source: z.string().optional() },
    },
    async (args) => {
      try {
        await ensureRunning(cfg);
        return ok(await getMessages(cfg, args));
      } catch (e) {
        return fail(`Could not read history: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "clear_messages",
    { title: "Clear messages", description: "Delete all Raccourier history.", inputSchema: {} },
    async () => {
      try {
        await ensureRunning(cfg);
        return ok(await clearMessages(cfg));
      } catch (e) {
        return fail(`Could not clear history: ${e.message}`);
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
