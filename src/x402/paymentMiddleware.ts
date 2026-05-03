import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";
import type { EventRepository } from "../events/eventStore.js";
import { createSanitizedResultHash } from "../receipts/receiptHash.js";
import type { ReceiptRepository } from "../receipts/receiptStore.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import { buildPaymentChallenge } from "./challenge.js";
import { PaymentVerifier } from "./verify.js";

interface RegisterPaidToolRouteOptions {
  app: FastifyInstance;
  config: AppConfig;
  verifier: PaymentVerifier;
  receiptStore: ReceiptRepository;
  eventStore: EventRepository;
  tool: PaidToolRegistration;
}

function sanitizeSummary(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 280);
}

function applyUnpaidX402Headers(config: AppConfig, reply: { header: (name: string, value: string) => void }): void {
  reply.header("www-authenticate", `x402 realm="${config.serviceName}", units="1", rail="x402"`);
  reply.header("x402-payment-required", "true");
  reply.header("x402-payment-rail", "x402");
  reply.header("x402-required", "true");
  reply.header("x402-pricing-units", "1");
  reply.header("x402-supported-networks", config.x402Network);
  reply.header("x402-accepted-assets", config.x402AssetSymbol);
  reply.header("x402-discovery", `${config.publicBaseUrl}/.well-known/infopunks-cognition-layer.json`);
}

export async function registerPaidToolRoute({
  app,
  config,
  verifier,
  receiptStore,
  eventStore,
  tool
}: RegisterPaidToolRouteOptions): Promise<void> {
  app.post(tool.route, async (request, reply) => {
    let input: unknown;
    try {
      input = tool.runtime.inputSchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: "invalid_request",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        });
      }
      throw error;
    }

    if (!config.x402RequiredDefault) {
      return reply.send(tool.runtime.execute(input));
    }

    const payment = await verifier.verify({
      method: tool.method,
      path: request.url,
      headers: request.headers
    }, tool);

    if (!payment) {
      applyUnpaidX402Headers(config, reply);
      return reply.status(402).send(buildPaymentChallenge(config, tool, request.url));
    }

    const result = tool.runtime.execute(input);
    const resultSummary = sanitizeSummary(tool.runtime.summarize(result));
    const resultHash = createSanitizedResultHash(result);
    const receiptRecord = await receiptStore.create({
      toolId: tool.tool_id,
      endpoint: tool.route,
      finalStatus: 200,
      payment,
      resultHash,
      resultSummary
    });

    await eventStore.add({
      event_type: tool.event_type,
      tool_id: tool.tool_id,
      endpoint: tool.route,
      payment_status: receiptRecord.payment_status,
      x402_verified: payment.verified,
      network: config.x402Network,
      receipt_id: receiptRecord.receipt.receipt_id,
      result_summary: resultSummary,
      created_at: receiptRecord.receipt.created_at
    });

    return reply.send({
      ...result,
      receipt: receiptRecord.receipt
    });
  });
}
