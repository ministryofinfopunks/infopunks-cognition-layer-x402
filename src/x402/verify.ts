import { createHash } from "node:crypto";
import { createCdpAuthHeaders } from "@coinbase/x402";
import type { AppConfig } from "../config/env.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import type { PaymentVerificationResult } from "./types.js";

export interface PaymentVerificationRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
}

interface CdpPhasePayload {
  x402Version: 2;
  paymentPayload: Record<string, unknown>;
  paymentRequirements: Record<string, unknown>;
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
}

function readFirstHeader(headers: Record<string, string | string[] | undefined>, names: string[]): string | null {
  for (const name of names) {
    const value = readHeader(headers, name);
    if (value != null && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function decodeBase64(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function decodePaymentHeader(paymentHeader: string): Record<string, unknown> | null {
  const direct = parseJsonObject(paymentHeader);
  if (direct) {
    return direct;
  }
  const decoded = parseJsonObject(decodeBase64(paymentHeader));
  if (decoded) {
    return decoded;
  }
  return null;
}

function extractPayerFromPaymentPayload(paymentPayload: Record<string, unknown> | null): string | null {
  const payload = paymentPayload?.payload;
  if (payload == null || typeof payload !== "object") {
    return null;
  }
  const authorization = (payload as { authorization?: unknown }).authorization;
  if (authorization == null || typeof authorization !== "object") {
    return null;
  }
  const from = (authorization as { from?: unknown }).from;
  if (typeof from !== "string" || from.trim().length === 0) {
    return null;
  }
  return from.trim();
}

function cdpV2PhasePayload(
  paymentPayload: Record<string, unknown>,
  paymentRequirements: Record<string, unknown>
): CdpPhasePayload {
  return {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      ...paymentPayload
    },
    paymentRequirements
  };
}

function settlementReferenceFromBody(body: Record<string, unknown>): string | null {
  const candidates = [
    body.reference,
    body.verifier_reference,
    body.receipt_reference,
    body.transaction,
    body.transactionHash,
    body.txHash,
    body.tx_hash
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export class PaymentVerifier {
  public constructor(private readonly config: AppConfig) {}

  public async verify(request: PaymentVerificationRequest, tool: PaidToolRegistration): Promise<PaymentVerificationResult | null> {
    if (this.config.x402VerifierMode === "mock") {
      return this.verifyMock(request);
    }
    return this.verifyFacilitator(request, tool);
  }

  private verifyMock(request: PaymentVerificationRequest): PaymentVerificationResult | null {
    const marker = readHeader(request.headers, "x402-mock-payment");
    if (String(marker ?? "").trim().toLowerCase() !== "paid") {
      return null;
    }
    const payer = readHeader(request.headers, "x402-mock-payer") ?? "mock-buyer";
    const referenceSeed = [
      request.method,
      request.path,
      payer,
      readHeader(request.headers, "x402-mock-reference") ?? "mock-reference"
    ].join("|");
    return {
      verified: true,
      mode: "mock",
      payer,
      reference: `mock_${createHash("sha256").update(referenceSeed).digest("hex").slice(0, 16)}`,
      verifiedAt: new Date().toISOString(),
      verifier: "mock-header"
    };
  }

  private async authHeaders(phase: "verify" | "settle"): Promise<Record<string, string>> {
    if (this.config.x402FacilitatorProvider !== "cdp") {
      return {};
    }
    if (!this.config.cdpApiKeyId || !this.config.cdpApiKeySecret) {
      return {};
    }
    try {
      const cdpHeadersFactory = createCdpAuthHeaders(this.config.cdpApiKeyId, this.config.cdpApiKeySecret);
      if (!cdpHeadersFactory) {
        return {};
      }
      const allHeaders = await cdpHeadersFactory();
      return allHeaders[phase] ?? {};
    } catch {
      return {};
    }
  }

  private buildPaymentRequirements(request: PaymentVerificationRequest, tool: PaidToolRegistration): Record<string, unknown> {
    const price = tool.getPrice(this.config);
    return {
      scheme: "exact",
      network: this.config.x402Network,
      asset: this.config.x402PaymentAssetAddress,
      payTo: this.config.x402PayTo,
      amount: price.priceAtomic,
      maxAmountRequired: price.priceAtomic,
      resource: `${this.config.publicBaseUrl}${request.path}`,
      description: tool.public_description,
      mimeType: "application/json"
    };
  }

  private async verifyFacilitator(
    request: PaymentVerificationRequest,
    tool: PaidToolRegistration
  ): Promise<PaymentVerificationResult | null> {
    try {
      if (!this.config.x402FacilitatorUrl) {
        return null;
      }

      const paymentHeader = readFirstHeader(request.headers, [
        "X-PAYMENT",
        "x-payment",
        "x402-payment",
        "payment-signature"
      ]);
      if (!paymentHeader) {
        return null;
      }

      const decodedPaymentPayload = decodePaymentHeader(paymentHeader);
      if (!decodedPaymentPayload) {
        return null;
      }
      const paymentPayload = (decodedPaymentPayload.paymentPayload as Record<string, unknown> | undefined)
        ?? decodedPaymentPayload;
      const paymentRequirements = this.buildPaymentRequirements(request, tool);
      const cdpPayload = cdpV2PhasePayload(paymentPayload, paymentRequirements);
      const baseUrl = this.config.x402FacilitatorUrl.replace(/\/$/, "");

      const verifyResponse = await fetch(`${baseUrl}/verify`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(await this.authHeaders("verify"))
        },
        body: JSON.stringify(cdpPayload),
        signal: AbortSignal.timeout(this.config.x402VerifierTimeoutMs)
      });
      if (!verifyResponse.ok) {
        return null;
      }
      const verifyPayload = await verifyResponse.json() as Record<string, unknown>;
      const verified = verifyPayload.ok === true || verifyPayload.isValid === true || verifyPayload.verified === true;
      if (!verified) {
        return null;
      }

      const settleResponse = await fetch(`${baseUrl}/settle`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(await this.authHeaders("settle"))
        },
        body: JSON.stringify(cdpPayload),
        signal: AbortSignal.timeout(this.config.x402VerifierTimeoutMs)
      });
      if (!settleResponse.ok) {
        return null;
      }
      const settlePayload = await settleResponse.json() as Record<string, unknown>;
      if (settlePayload.success === false || settlePayload.settled === false) {
        return null;
      }

      const payer = String(
        verifyPayload.payer
        ?? settlePayload.payer
        ?? extractPayerFromPaymentPayload(paymentPayload)
        ?? "unknown"
      );
      const settlementReference = settlementReferenceFromBody(settlePayload);
      const verifyReference = settlementReferenceFromBody(verifyPayload);
      const reference = settlementReference ?? verifyReference ?? "facilitator-reference";

      return {
        verified: true,
        mode: "facilitator",
        payer,
        reference,
        ...(settlementReference ? { settlementReference } : {}),
        settlementStatus: settlementReference ? "settled" : "verified",
        verifiedAt: new Date().toISOString(),
        verifier: this.config.x402FacilitatorProvider
      };
    } catch {
      return null;
    }
  }
}
