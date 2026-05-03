import { createHash } from "node:crypto";
import { createCdpAuthHeaders } from "@coinbase/x402";
import type { AppConfig } from "../config/env.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import { buildX402PaymentRequirement } from "./paymentRequirements.js";
import type {
  PaymentVerificationFailure,
  PaymentVerificationOutcome,
  PaymentVerificationResult
} from "./types.js";

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

interface SelectedPaymentHeader {
  payment_header_seen: boolean;
  payment_header_name: string | null;
  payment_value: string | null;
  payment_value_length: number | null;
}

const PAYMENT_HEADER_CANDIDATES = [
  "x-payment",
  "X-PAYMENT",
  "x402-payment",
  "payment-signature",
  "Payment-Signature"
] as const;

function truncate(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength)}...`;
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
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
  try {
    const decoded = parseJsonObject(decodeBase64(paymentHeader));
    if (decoded) {
      return decoded;
    }
  } catch {
    return null;
  }
  return null;
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

function selectPaymentHeader(headers: Record<string, string | string[] | undefined>): SelectedPaymentHeader {
  for (const candidate of PAYMENT_HEADER_CANDIDATES) {
    const value = readHeader(headers, candidate);
    if (value != null && value.trim().length > 0) {
      return {
        payment_header_seen: true,
        payment_header_name: candidate,
        payment_value: value.trim(),
        payment_value_length: value.trim().length
      };
    }
  }
  return {
    payment_header_seen: false,
    payment_header_name: null,
    payment_value: null,
    payment_value_length: null
  };
}

function failure(base: Omit<PaymentVerificationFailure, "facilitator_verify_status" | "facilitator_settle_status" | "facilitator_error_code" | "facilitator_error_message"> & {
  facilitator_verify_status?: number | null;
  facilitator_settle_status?: number | null;
  facilitator_error_code?: string | null;
  facilitator_error_message?: string | null;
}): PaymentVerificationOutcome {
  return {
    payment: null,
    failure: {
      facilitator_verify_status: null,
      facilitator_settle_status: null,
      facilitator_error_code: null,
      facilitator_error_message: null,
      ...base
    }
  };
}

function success(payment: PaymentVerificationResult): PaymentVerificationOutcome {
  return { payment, failure: null };
}

function safeFacilitatorError(responseBody: Record<string, unknown>, fallbackText: string | null): {
  code: string | null;
  message: string | null;
} {
  const code = responseBody.code ?? responseBody.error_code ?? responseBody.error;
  const message = responseBody.message ?? responseBody.error_message ?? responseBody.reason ?? fallbackText;
  return {
    code: typeof code === "string" ? truncate(code, 120) : null,
    message: truncate(message, 300)
  };
}

export class PaymentVerifier {
  public constructor(private readonly config: AppConfig) {}

  public async verify(request: PaymentVerificationRequest, tool: PaidToolRegistration): Promise<PaymentVerificationOutcome> {
    if (this.config.x402VerifierMode === "mock") {
      return this.verifyMock(request);
    }
    return this.verifyFacilitator(request, tool);
  }

  private verifyMock(request: PaymentVerificationRequest): PaymentVerificationOutcome {
    const marker = readHeader(request.headers, "x402-mock-payment");
    if (String(marker ?? "").trim().toLowerCase() !== "paid") {
      return failure({
        failure_stage: "missing_payment_header",
        payment_header_seen: false,
        payment_header_name: null,
        payment_value_length: null
      });
    }
    const payer = readHeader(request.headers, "x402-mock-payer") ?? "mock-buyer";
    const referenceSeed = [
      request.method,
      request.path,
      payer,
      readHeader(request.headers, "x402-mock-reference") ?? "mock-reference"
    ].join("|");
    return success({
      verified: true,
      mode: "mock",
      payer,
      reference: `mock_${createHash("sha256").update(referenceSeed).digest("hex").slice(0, 16)}`,
      verifiedAt: new Date().toISOString(),
      verifier: "mock-header"
    });
  }

  private async authHeaders(phase: "verify" | "settle"): Promise<Record<string, string>> {
    if (this.config.x402FacilitatorProvider !== "cdp") {
      return {};
    }
    if (!this.config.cdpApiKeyId || !this.config.cdpApiKeySecret) {
      return {};
    }
    const cdpHeadersFactory = createCdpAuthHeaders(this.config.cdpApiKeyId, this.config.cdpApiKeySecret);
    if (!cdpHeadersFactory) {
      return {};
    }
    const allHeaders = await cdpHeadersFactory();
    return allHeaders[phase] ?? {};
  }

  private async verifyFacilitator(
    request: PaymentVerificationRequest,
    tool: PaidToolRegistration
  ): Promise<PaymentVerificationOutcome> {
    const selectedHeader = selectPaymentHeader(request.headers);
    console.info("[x402] facilitator header", {
      payment_header_seen: selectedHeader.payment_header_seen,
      payment_header_name: selectedHeader.payment_header_name,
      payment_value_length: selectedHeader.payment_value_length
    });

    if (!selectedHeader.payment_header_seen || !selectedHeader.payment_value) {
      return failure({
        failure_stage: "missing_payment_header",
        payment_header_seen: false,
        payment_header_name: null,
        payment_value_length: null
      });
    }

    const decodedPaymentPayload = decodePaymentHeader(selectedHeader.payment_value);
    if (!decodedPaymentPayload) {
      return failure({
        failure_stage: "invalid_payment_payload",
        payment_header_seen: true,
        payment_header_name: selectedHeader.payment_header_name,
        payment_value_length: selectedHeader.payment_value_length
      });
    }

    if (!this.config.x402FacilitatorUrl) {
      return failure({
        failure_stage: "facilitator_exception",
        payment_header_seen: true,
        payment_header_name: selectedHeader.payment_header_name,
        payment_value_length: selectedHeader.payment_value_length,
        facilitator_error_message: "facilitator URL is not configured"
      });
    }

    try {
      const paymentPayload = (decodedPaymentPayload.paymentPayload as Record<string, unknown> | undefined)
        ?? decodedPaymentPayload;
      const paymentRequirements = buildX402PaymentRequirement(this.config, tool, request.path) as unknown as Record<string, unknown>;
      const cdpPayload = cdpV2PhasePayload(paymentPayload, paymentRequirements);
      const baseUrl = this.config.x402FacilitatorUrl.replace(/\/$/, "");
      const verifyUrl = `${baseUrl}/verify`;
      console.info("[x402] facilitator verify request", { verify_url: verifyUrl });

      const verifyResponse = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(await this.authHeaders("verify"))
        },
        body: JSON.stringify(cdpPayload),
        signal: AbortSignal.timeout(this.config.x402VerifierTimeoutMs)
      });
      console.info("[x402] facilitator verify status", { verify_status: verifyResponse.status });
      const verifyText = await verifyResponse.text();
      const verifyBody = parseJsonObject(verifyText) ?? {};

      if (!verifyResponse.ok) {
        const err = safeFacilitatorError(verifyBody, truncate(verifyText, 300));
        console.warn("[x402] facilitator verify error", {
          verify_status: verifyResponse.status,
          error_code: err.code,
          error_message: err.message
        });
        return failure({
          failure_stage: "facilitator_verify_failed",
          payment_header_seen: true,
          payment_header_name: selectedHeader.payment_header_name,
          payment_value_length: selectedHeader.payment_value_length,
          facilitator_verify_status: verifyResponse.status,
          facilitator_error_code: err.code,
          facilitator_error_message: err.message
        });
      }

      const verified = verifyBody.ok === true || verifyBody.isValid === true || verifyBody.verified === true;
      if (!verified) {
        const err = safeFacilitatorError(verifyBody, truncate(verifyText, 300));
        return failure({
          failure_stage: "facilitator_verify_failed",
          payment_header_seen: true,
          payment_header_name: selectedHeader.payment_header_name,
          payment_value_length: selectedHeader.payment_value_length,
          facilitator_verify_status: verifyResponse.status,
          facilitator_error_code: err.code,
          facilitator_error_message: err.message
        });
      }

      const settleUrl = `${baseUrl}/settle`;
      const settleResponse = await fetch(settleUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(await this.authHeaders("settle"))
        },
        body: JSON.stringify(cdpPayload),
        signal: AbortSignal.timeout(this.config.x402VerifierTimeoutMs)
      });
      console.info("[x402] facilitator settle status", { settle_status: settleResponse.status });
      const settleText = await settleResponse.text();
      const settleBody = parseJsonObject(settleText) ?? {};

      if (!settleResponse.ok) {
        const err = safeFacilitatorError(settleBody, truncate(settleText, 300));
        console.warn("[x402] facilitator settle error", {
          settle_status: settleResponse.status,
          error_code: err.code,
          error_message: err.message
        });
        return failure({
          failure_stage: "facilitator_settle_failed",
          payment_header_seen: true,
          payment_header_name: selectedHeader.payment_header_name,
          payment_value_length: selectedHeader.payment_value_length,
          facilitator_verify_status: verifyResponse.status,
          facilitator_settle_status: settleResponse.status,
          facilitator_error_code: err.code,
          facilitator_error_message: err.message
        });
      }

      if (settleBody.success === false || settleBody.settled === false) {
        const err = safeFacilitatorError(settleBody, truncate(settleText, 300));
        return failure({
          failure_stage: "facilitator_settle_failed",
          payment_header_seen: true,
          payment_header_name: selectedHeader.payment_header_name,
          payment_value_length: selectedHeader.payment_value_length,
          facilitator_verify_status: verifyResponse.status,
          facilitator_settle_status: settleResponse.status,
          facilitator_error_code: err.code,
          facilitator_error_message: err.message
        });
      }

      const payer = String(
        verifyBody.payer
        ?? settleBody.payer
        ?? extractPayerFromPaymentPayload(paymentPayload)
        ?? "unknown"
      );
      const settlementReference = settlementReferenceFromBody(settleBody);
      const verifyReference = settlementReferenceFromBody(verifyBody);
      const reference = settlementReference ?? verifyReference ?? "facilitator-reference";

      return success({
        verified: true,
        mode: "facilitator",
        payer,
        reference,
        ...(settlementReference ? { settlementReference } : {}),
        settlementStatus: settlementReference ? "settled" : "verified",
        verifiedAt: new Date().toISOString(),
        verifier: this.config.x402FacilitatorProvider
      });
    } catch (error) {
      const safeMessage = truncate(error instanceof Error ? error.message : String(error), 300);
      console.warn("[x402] facilitator exception", { error_message: safeMessage });
      return failure({
        failure_stage: "facilitator_exception",
        payment_header_seen: true,
        payment_header_name: selectedHeader.payment_header_name,
        payment_value_length: selectedHeader.payment_value_length,
        facilitator_error_message: safeMessage
      });
    }
  }
}
