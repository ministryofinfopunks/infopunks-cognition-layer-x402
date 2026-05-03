import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import type { ReceiptStore } from "../receipts/receiptStore.js";
import { renderProofIndex, renderProofPage } from "./proofPage.js";

export async function registerProofRoutes(app: FastifyInstance, config: AppConfig, receiptStore: ReceiptStore): Promise<void> {
  app.get("/proof", async (_request, reply) => {
    if (!config.proofPagesEnabled) {
      return reply.status(404).send({ error: "proof_pages_disabled" });
    }
    reply.type("text/html; charset=utf-8");
    return renderProofIndex(receiptStore.list(config.eventFeedLimit));
  });

  app.get("/proof/:receipt_id", async (request, reply) => {
    if (!config.proofPagesEnabled) {
      return reply.status(404).send({ error: "proof_pages_disabled" });
    }
    const params = request.params as { receipt_id: string };
    const record = receiptStore.get(params.receipt_id);
    if (!record) {
      return reply.status(404).send({ error: "not_found" });
    }
    reply.type("text/html; charset=utf-8");
    return renderProofPage(record);
  });
}
