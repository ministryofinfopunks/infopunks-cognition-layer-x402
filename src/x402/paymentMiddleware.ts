import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";
import type { EventRepository } from "../events/eventStore.js";
import { createSanitizedResultHash } from "../receipts/receiptHash.js";
import type { ReceiptRepository } from "../receipts/receiptStore.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import { buildPaymentChallenge } from "./challenge.js";
import { toX402NetworkName } from "./paymentRequirements.js";
import type { PaymentChallenge, PaymentFailureStage, PaymentVerificationResult } from "./types.js";
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

function compactPaymentDescription(routeTemplate: string, fallbackDescription: string): string {
  switch (routeTemplate) {
    case "/v1/coherence-score":
      return "Coherence scoring endpoint.";
    case "/v1/extract-signal":
      return "Signal extraction endpoint.";
    case "/v1/simulate-narrative":
      return "Narrative simulation endpoint.";
    default:
      return fallbackDescription.replace(/\s+/g, " ").trim().slice(0, 72);
  }
}

function applyUnpaidX402Headers(config: AppConfig, reply: { header: (name: string, value: string) => void }): void {
  reply.header("www-authenticate", `x402 realm="${config.serviceName}", units="1", rail="x402"`);
  reply.header("x402-payment-required", "true");
  reply.header("x402-payment-rail", "x402");
  reply.header("x402-required", "true");
  reply.header("x402-pricing-units", "1");
  reply.header("x402-supported-networks", toX402NetworkName(config.x402Network));
  reply.header("x402-accepted-assets", config.x402AssetSymbol);
  reply.header("x402-discovery", `${config.publicBaseUrl}/.well-known/infopunks-cognition-layer.json`);
}

function buildCompactPaymentRequiredHeaderPayload(challenge: PaymentChallenge): Record<string, unknown> {
  return {
    x402Version: challenge.x402Version,
    accepts: challenge.accepts.map((entry) => ({
      scheme: entry.scheme,
      network: entry.network,
      maxAmountRequired: entry.amount,
      resource: entry.resource.url,
      description: compactPaymentDescription(entry.resource.routeTemplate, entry.description),
      mimeType: entry.mimeType,
      asset: entry.asset,
      payTo: entry.payTo,
      maxTimeoutSeconds: entry.maxTimeoutSeconds,
      ...(entry.extra ? { extra: entry.extra } : {})
    })),
    error: challenge.error
  };
}

function encodePaymentRequiredHeader(challenge: PaymentChallenge): string {
  const compact = buildCompactPaymentRequiredHeaderPayload(challenge);
  return Buffer.from(JSON.stringify(compact), "utf8").toString("base64");
}

function paymentChallengeErrorForStage(stage: PaymentFailureStage): string {
  switch (stage) {
    case "missing_payment_header":
      return "X-PAYMENT header is required";
    case "invalid_payment_payload":
      return "Invalid x402 payment payload";
    case "facilitator_verify_failed":
      return "x402 facilitator verify failed";
    case "facilitator_settle_failed":
      return "x402 facilitator settle failed";
    case "facilitator_exception":
      return "x402 facilitator verification error";
    default:
      return "X-PAYMENT header is required";
  }
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
    let payment: PaymentVerificationResult | undefined;
    if (config.x402RequiredDefault) {
      const verification = await verifier.verify({
        method: tool.method,
        path: request.url,
        headers: request.headers
      }, tool);

      if (!verification.payment) {
        const failureStage = verification.failure?.failure_stage ?? "missing_payment_header";
        const challenge = buildPaymentChallenge(config, tool, request.url, {
          error: paymentChallengeErrorForStage(failureStage),
          ...(config.x402DiagnosticMode ? { diagnostic: verification.failure } : {})
        });
        applyUnpaidX402Headers(config, reply);
        reply.header("payment-required", encodePaymentRequiredHeader(challenge));
        return reply.status(402).send(challenge);
      }
      payment = verification.payment;
    }

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
    if (!payment) {
      throw new Error("Paid route missing verified payment.");
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
