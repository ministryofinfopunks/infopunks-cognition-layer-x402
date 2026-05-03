import type { AppConfig } from "../config/env.js";
import type { PaidToolRegistration } from "../registry/tools.js";

export interface X402PaymentRequirement {
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
}

function normalizeRequestPath(requestPath: string): string {
  const pathWithoutQuery = requestPath.split("?")[0] ?? requestPath;
  if (pathWithoutQuery.startsWith("/")) {
    return pathWithoutQuery;
  }
  return `/${pathWithoutQuery}`;
}

export function buildX402PaymentRequirement(
  config: AppConfig,
  tool: PaidToolRegistration,
  requestPath: string
): X402PaymentRequirement {
  const price = tool.getPrice(config);
  const resource = `${config.publicBaseUrl}${normalizeRequestPath(requestPath)}`;
  return {
    scheme: "exact",
    network: config.x402Network,
    maxAmountRequired: price.priceAtomic,
    resource,
    description: tool.discovery_description,
    mimeType: "application/json",
    payTo: config.x402PayTo,
    maxTimeoutSeconds: 300,
    asset: config.x402PaymentAssetAddress,
    // CDP verify/settle expects amount in paymentRequirements.
    amount: price.priceAtomic
  };
}
