import type { AppConfig } from "../config/env.js";
import type { PaidToolRegistration } from "../registry/tools.js";
import { buildX402PaymentRequirement } from "./paymentRequirements.js";
import type { PaymentChallenge } from "./types.js";

export function buildPaymentChallenge(config: AppConfig, tool: PaidToolRegistration, requestPath: string): PaymentChallenge {
  const price = tool.getPrice(config);
  const requirement = buildX402PaymentRequirement(config, tool, requestPath);
  return {
    x402Version: 1,
    accepts: [requirement],
    error: "X-PAYMENT header is required",
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
      resource: requirement.resource,
      method: tool.method
    }
  };
}
