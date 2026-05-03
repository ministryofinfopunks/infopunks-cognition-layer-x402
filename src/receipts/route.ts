import type { FastifyInstance } from "fastify";
import type { ReceiptStore } from "./receiptStore.js";

export async function registerReceiptRoutes(app: FastifyInstance, receiptStore: ReceiptStore): Promise<void> {
  app.get("/receipts/:receipt_id", async (request, reply) => {
    const params = request.params as { receipt_id: string };
    const record = receiptStore.get(params.receipt_id);
    if (!record) {
      return reply.status(404).send({ error: "not_found" });
    }
    return record.receipt;
  });
}
