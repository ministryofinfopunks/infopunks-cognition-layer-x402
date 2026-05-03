import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import type { PublicEvent } from "../x402/types.js";
import type { EventStore } from "./eventStore.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderWarRoomPage(events: PublicEvent[]): string {
  const rows = events.map((event) => `
    <tr>
      <td>${escapeHtml(event.created_at)}</td>
      <td>${escapeHtml(event.tool_id)}</td>
      <td>${escapeHtml(event.payment_status)}</td>
      <td>${escapeHtml(event.receipt_id)}</td>
      <td>${escapeHtml(event.result_summary)}</td>
    </tr>
  `).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Infopunks War Room</title>
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; background: #f4f7fb; color: #0f172a; }
      main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 72px; }
      table { width: 100%; border-collapse: collapse; background: white; }
      th, td { padding: 12px; border-bottom: 1px solid #dbe4f0; text-align: left; vertical-align: top; }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Infopunks War Room</h1>
      <table>
        <thead>
          <tr><th>Time</th><th>Tool</th><th>Status</th><th>Receipt</th><th>Summary</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

export async function registerEventRoutes(app: FastifyInstance, config: AppConfig, eventStore: EventStore): Promise<void> {
  const listEvents = async (request: { query: unknown }) => {
    const limit = Number((request.query as { limit?: string }).limit ?? config.eventFeedLimit);
    return eventStore.list(Number.isFinite(limit) ? limit : config.eventFeedLimit);
  };

  app.get("/v1/events/recent", listEvents);
  app.get("/war-room/recent", listEvents);

  app.get("/war-room", async (request, reply) => {
    reply.type("text/html; charset=utf-8");
    return renderWarRoomPage(eventStore.list(config.eventFeedLimit));
  });
}
