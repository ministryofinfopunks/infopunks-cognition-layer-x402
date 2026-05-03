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
  extra?: {
    name: string;
    version: string;
  };
}

const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913";

function normalizeRequestPath(requestPath: string): string {
  const pathWithoutQuery = requestPath.split("?")[0] ?? requestPath;
  if (pathWithoutQuery.startsWith("/")) {
    return pathWithoutQuery;
  }
  return `/${pathWithoutQuery}`;
}

export function toX402NetworkName(network: string): string {
  const normalized = String(network).trim().toLowerCase();
  if (normalized === "eip155:8453" || normalized === "base") {
    return "base";
  }
  return normalized;
}

export function buildX402PaymentRequirement(
  config: AppConfig,
  tool: PaidToolRegistration,
  requestPath: string
): X402PaymentRequirement {
  const price = tool.getPrice(config);
  const x402Network = toX402NetworkName(config.x402Network);
  const resource = `${config.publicBaseUrl}${normalizeRequestPath(requestPath)}`;
  const isBaseUsdc =
    x402Network === "base"
    && config.x402PaymentAssetAddress.toLowerCase() === BASE_MAINNET_USDC.toLowerCase();
  return {
    scheme: "exact",
    network: x402Network,
    maxAmountRequired: price.priceAtomic,
    resource,
    description: tool.discovery_description,
    mimeType: "application/json",
    payTo: config.x402PayTo,
    maxTimeoutSeconds: 300,
    asset: config.x402PaymentAssetAddress,
    ...(isBaseUsdc
      ? {
        extra: {
          name: config.x402Eip712Name,
          version: config.x402Eip712Version
        }
      }
      : {})
  };
}
