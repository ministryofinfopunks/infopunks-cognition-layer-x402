import type { AppConfig } from "../config/env.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import type { PaymentChallenge } from "./types.js";

export function buildPaymentChallenge(config: AppConfig, tool: PaidToolRegistration): PaymentChallenge {
  const price = tool.getPrice(config);
  return {
    error: "payment_required",
    message: "x402 payment required for this endpoint.",
    payment: {
      version: "x402",
      mode: config.x402VerifierMode,
      scheme: config.x402Scheme,
      network: config.x402Network,
      asset_symbol: config.x402AssetSymbol,
      asset_address: config.x402PaymentAssetAddress,
      price_usd: price.priceUsd,
      price_atomic: price.priceAtomic,
      pay_to: config.x402PayTo,
      required_header: config.x402VerifierMode === "mock" ? "x402-mock-payment: paid" : "x402-payment",
      facilitator_url: config.x402FacilitatorUrl,
      resource: tool.route,
      method: tool.method
    }
  };
}
