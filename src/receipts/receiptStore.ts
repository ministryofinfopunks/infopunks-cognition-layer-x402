import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/env.js";
import type { PaymentVerificationResult, PublicReceipt, ReceiptRecord } from "../x402/types.js";

export interface CreateReceiptInput {
  toolId: string;
  endpoint: string;
  finalStatus: number;
  payment: PaymentVerificationResult;
  resultHash: string;
  resultSummary: string;
}

export interface ReceiptRepository {
  create(input: CreateReceiptInput): Promise<ReceiptRecord>;
  get(receiptId: string): ReceiptRecord | null;
  list(limit?: number): ReceiptRecord[];
}

function toPaymentStatus(payment: PaymentVerificationResult): ReceiptRecord["payment_status"] {
  return payment.mode === "mock" ? "mock_verified" : "verified";
}

export class ReceiptStore implements ReceiptRepository {
  private readonly receipts = new Map<string, ReceiptRecord>();

  public constructor(private readonly config: AppConfig) {}

  public async create(input: CreateReceiptInput): Promise<ReceiptRecord> {
    const receiptId = `rcpt_${randomUUID()}`;
    const proofUrl = `${this.config.publicBaseUrl}/proof/${receiptId}`;
    const receipt: PublicReceipt = {
      receipt_id: receiptId,
      tool_id: input.toolId,
      endpoint: input.endpoint,
      final_status: input.finalStatus,
      x402_verified: input.payment.verified,
      facilitator_provider: input.payment.verifier,
      network: this.config.x402Network,
      asset: `${this.config.x402AssetSymbol}:${this.config.x402PaymentAssetAddress}`,
      payTo: this.config.x402PayTo,
      result_hash: input.resultHash,
      created_at: input.payment.verifiedAt,
      proof_url: proofUrl,
      ...(input.payment.settlementReference ? { settlement_reference: input.payment.settlementReference } : {}),
      ...(input.payment.settlementStatus ? { settlement_status: input.payment.settlementStatus } : {})
    };
    const record: ReceiptRecord = {
      receipt,
      payment_status: toPaymentStatus(input.payment),
      result_summary: input.resultSummary
    };

    this.receipts.set(receiptId, record);
    await mkdir(this.config.runtimeDir, { recursive: true });
    await appendFile(path.join(this.config.runtimeDir, "receipts.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
    return record;
  }

  public get(receiptId: string): ReceiptRecord | null {
    return this.receipts.get(receiptId) ?? null;
  }

  public list(limit = this.config.eventFeedLimit): ReceiptRecord[] {
    return Array.from(this.receipts.values())
      .sort((left, right) => right.receipt.created_at.localeCompare(left.receipt.created_at))
      .slice(0, limit);
  }
}
