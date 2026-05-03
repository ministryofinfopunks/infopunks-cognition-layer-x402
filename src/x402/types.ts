export type PaymentVerifierMode = "mock" | "facilitator";
export type FacilitatorProvider = "cdp" | "openfacilitator";
export type PaymentStatus = "verified" | "unpaid" | "mock_verified";
export type PaymentFailureStage =
  | "missing_payment_header"
  | "invalid_payment_payload"
  | "facilitator_verify_failed"
  | "facilitator_settle_failed"
  | "facilitator_exception";

export interface PaymentVerificationFailure {
  failure_stage: PaymentFailureStage;
  payment_header_seen: boolean;
  payment_header_name: string | null;
  payment_value_length: number | null;
  facilitator_verify_status: number | null;
  facilitator_settle_status: number | null;
  facilitator_error_code: string | null;
  facilitator_error_message: string | null;
}

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
    extra?: {
      name: string;
      version: string;
    };
  }>;
  error: string;
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
  diagnostic?: PaymentVerificationFailure;
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

export interface PaymentVerificationOutcome {
  payment: PaymentVerificationResult | null;
  failure: PaymentVerificationFailure | null;
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
