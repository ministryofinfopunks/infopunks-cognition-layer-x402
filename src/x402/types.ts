export type PaymentVerifierMode = "mock" | "facilitator";
export type FacilitatorProvider = "cdp" | "openfacilitator";
export type PaymentStatus = "verified" | "unpaid" | "mock_verified";

export interface PaymentChallenge {
  x402Version: 1;
  accepts: Array<{
    scheme: "exact";
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: "application/json";
    payTo: string;
    maxTimeoutSeconds: 300;
    asset: string;
    amount: string;
    extra?: {
      name: string;
      version: string;
    };
  }>;
  error: "X-PAYMENT header is required";
  message?: string;
  payment: {
    version: "x402";
    mode: PaymentVerifierMode;
    scheme: "exact";
    network: string;
    asset_symbol: string;
    asset_address: string;
    price_usd: string;
    price_atomic: string;
    pay_to: string;
    required_header: string;
    facilitator_url: string | null;
    resource: string;
    method: string;
  };
}

export interface PaymentVerificationResult {
  verified: true;
  mode: PaymentVerifierMode;
  payer: string;
  reference: string;
  verifiedAt: string;
  verifier: string;
  settlementReference?: string;
  settlementStatus?: "settled" | "verified";
}

export interface PublicReceipt {
  receipt_id: string;
  tool_id: string;
  endpoint: string;
  final_status: number;
  x402_verified: boolean;
  facilitator_provider: string;
  network: string;
  asset: string;
  payTo: string;
  result_hash: string;
  created_at: string;
  proof_url: string;
  settlement_reference?: string;
  settlement_status?: "settled" | "verified";
}

export interface ReceiptRecord {
  receipt: PublicReceipt;
  payment_status: Exclude<PaymentStatus, "unpaid">;
  result_summary: string;
}

export interface PublicEvent {
  event_id: string;
  event_type: string;
  tool_id: string;
  endpoint: string;
  payment_status: PaymentStatus;
  x402_verified: boolean;
  network: string;
  receipt_id: string;
  result_summary: string;
  created_at: string;
}
