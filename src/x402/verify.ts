import { createHash } from "node:crypto";
import type { AppConfig } from "../config/env.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import type { PaymentVerificationResult } from "./types.js";

export interface PaymentVerificationRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
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

  private async verifyFacilitator(
    request: PaymentVerificationRequest,
    tool: PaidToolRegistration
  ): Promise<PaymentVerificationResult | null> {
    if (!this.config.x402FacilitatorUrl) {
      return null;
    }
    const paymentProof = readHeader(request.headers, "x402-payment");
    if (!paymentProof) {
      return null;
    }
    const price = tool.getPrice(this.config);
    const response = await fetch(this.config.x402FacilitatorUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        method: request.method,
        path: request.path,
        payment: paymentProof,
        expected: {
          network: this.config.x402Network,
          asset: this.config.x402PaymentAssetAddress,
          pay_to: this.config.x402PayTo,
          price_atomic: price.priceAtomic
        }
      }),
      signal: AbortSignal.timeout(this.config.x402VerifierTimeoutMs)
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json() as Record<string, unknown>;
    if (payload.verified !== true) {
      return null;
    }
    return {
      verified: true,
      mode: "facilitator",
      payer: String(payload.payer ?? "unknown"),
      reference: String(payload.reference ?? payload.tx_hash ?? "facilitator-reference"),
      verifiedAt: new Date().toISOString(),
      verifier: this.config.x402FacilitatorUrl
    };
  }
}
