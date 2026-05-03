import os from "node:os";
import path from "node:path";
import type { FacilitatorProvider, PaymentVerifierMode } from "../x402/types.js";

const BASE_MAINNET_CAIP2 = "eip155:8453";
const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913";
const DEV_PAY_TO = "0x1111111111111111111111111111111111111111";
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

export interface AppConfig {
  serviceName: string;
  serviceVersion: string;
  serviceTitle: string;
  serviceDescription: string;
  environment: string;
  nodeEnv: string;
  port: number;
  publicBaseUrl: string;
  runtimeDir: string;
  proofPagesEnabled: boolean;
  eventFeedLimit: number;
  x402RequiredDefault: boolean;
  x402VerifierMode: PaymentVerifierMode;
  x402FacilitatorProvider: FacilitatorProvider;
  x402FacilitatorUrl: string | null;
  x402VerifierTimeoutMs: number;
  x402DiagnosticMode: boolean;
  x402Network: string;
  x402AssetSymbol: string;
  x402PaymentAssetAddress: string;
  x402PayTo: string;
  x402Scheme: "exact";
  x402Eip712Name: string;
  x402Eip712Version: string;
  cdpApiKeyId: string | null;
  cdpApiKeySecret: string | null;
  receiptHmacSecret: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!isNonEmptyString(value)) {
    return fallback;
  }
  return value.trim().toLowerCase() === "true";
}

function parsePositiveInt(name: string, value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function isHexAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function containsUnsafeProductionMarker(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("localhost")
    || normalized.includes("127.0.0.1")
    || normalized.includes("::1")
    || normalized.includes("mock")
    || normalized.includes("test")
    || normalized.includes("sepolia");
}

function resolveRuntimeDir(environment: string, env: NodeJS.ProcessEnv): string {
  if (isNonEmptyString(env.RUNTIME_DIR)) {
    return path.resolve(env.RUNTIME_DIR.trim());
  }
  if (environment === "test") {
    return path.resolve(process.cwd(), ".runtime-test");
  }
  if (environment === "development" || environment === "local") {
    return path.resolve(process.cwd(), ".runtime");
  }
  return path.join(os.tmpdir(), "infopunks-cognition-layer");
}

function validateProduction(config: AppConfig): void {
  if (config.nodeEnv !== "production") {
    throw new Error("NODE_ENV=production is required for production deployment.");
  }
  if (config.x402VerifierMode !== "facilitator") {
    throw new Error("X402_VERIFIER_MODE=facilitator is required for production deployment.");
  }
  if (config.x402FacilitatorProvider !== "cdp") {
    throw new Error("X402_FACILITATOR_PROVIDER=cdp is required for production deployment.");
  }
  if (!config.x402FacilitatorUrl) {
    throw new Error("X402_FACILITATOR_URL is required for production deployment.");
  }
  if (!config.publicBaseUrl.startsWith("https://")) {
    throw new Error("PUBLIC_BASE_URL must use HTTPS in production.");
  }
  if (containsUnsafeProductionMarker(config.publicBaseUrl) || containsUnsafeProductionMarker(config.x402FacilitatorUrl)) {
    throw new Error("Production URLs cannot contain localhost, mock, test, sepolia, or loopback markers.");
  }
  if (config.x402Network !== BASE_MAINNET_CAIP2) {
    throw new Error("X402_NETWORK must be eip155:8453 in production.");
  }
  if (config.x402AssetSymbol !== "USDC") {
    throw new Error("X402_ASSET_SYMBOL must be USDC in production.");
  }
  if (!isHexAddress(config.x402PayTo) || config.x402PayTo.toLowerCase() === DEV_PAY_TO.toLowerCase()) {
    throw new Error("X402_PAY_TO must be a non-dev 0x address in production.");
  }
  if (!isNonEmptyString(config.cdpApiKeyId) || !isNonEmptyString(config.cdpApiKeySecret)) {
    throw new Error("CDP_API_KEY_ID and CDP_API_KEY_SECRET are required for production deployment.");
  }
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = String(env.APP_ENVIRONMENT ?? env.NODE_ENV ?? "development").trim().toLowerCase();
  const nodeEnv = String(env.NODE_ENV ?? "development").trim().toLowerCase();
  const verifierMode = String(env.X402_VERIFIER_MODE ?? "mock").trim().toLowerCase() as PaymentVerifierMode;
  if (!["mock", "facilitator"].includes(verifierMode)) {
    throw new Error("X402_VERIFIER_MODE must be mock or facilitator.");
  }
  const facilitatorProvider = String(env.X402_FACILITATOR_PROVIDER ?? "cdp").trim().toLowerCase() as FacilitatorProvider;
  if (!["cdp", "openfacilitator"].includes(facilitatorProvider)) {
    throw new Error("X402_FACILITATOR_PROVIDER must be cdp or openfacilitator.");
  }

  const publicBaseUrl = String(env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${env.PORT ?? "4024"}`).trim().replace(/\/$/, "");
  let parsedPublicUrl: URL;
  try {
    parsedPublicUrl = new URL(publicBaseUrl);
  } catch {
    throw new Error("PUBLIC_BASE_URL must be an absolute URL.");
  }
  if (!["http:", "https:"].includes(parsedPublicUrl.protocol)) {
    throw new Error("PUBLIC_BASE_URL must use http:// or https://.");
  }

  const config: AppConfig = {
    serviceName: "infopunks-cognition-layer",
    serviceVersion: "0.1.0",
    serviceTitle: "Infopunks Cognition Layer",
    serviceDescription: "Infopunks Cognition Layer is an x402-paid cultural intelligence API for agents and humans. It turns raw narrative, market noise, and agent output into coherent machine-usable intelligence.",
    environment,
    nodeEnv,
    port: parsePositiveInt("PORT", env.PORT, 4024),
    publicBaseUrl,
    runtimeDir: resolveRuntimeDir(environment, env),
    proofPagesEnabled: parseBoolean(env.PROOF_PAGES_ENABLED, true),
    eventFeedLimit: parsePositiveInt("EVENT_FEED_LIMIT", env.EVENT_FEED_LIMIT, 50),
    x402RequiredDefault: parseBoolean(env.X402_REQUIRED_DEFAULT, true),
    x402VerifierMode: verifierMode,
    x402FacilitatorProvider: facilitatorProvider,
    x402FacilitatorUrl: isNonEmptyString(env.X402_FACILITATOR_URL)
      ? env.X402_FACILITATOR_URL.trim()
      : (verifierMode === "facilitator" && facilitatorProvider === "cdp" ? CDP_FACILITATOR_URL : null),
    x402VerifierTimeoutMs: parsePositiveInt("X402_VERIFIER_TIMEOUT_MS", env.X402_VERIFIER_TIMEOUT_MS, 5000),
    x402DiagnosticMode: parseBoolean(env.X402_DIAGNOSTIC_MODE, false),
    x402Network: String(env.X402_NETWORK ?? BASE_MAINNET_CAIP2).trim(),
    x402AssetSymbol: String(env.X402_ASSET_SYMBOL ?? "USDC").trim().toUpperCase(),
    x402PaymentAssetAddress: String(env.X402_PAYMENT_ASSET_ADDRESS ?? BASE_MAINNET_USDC).trim(),
    x402PayTo: String(env.X402_PAY_TO ?? DEV_PAY_TO).trim(),
    x402Scheme: "exact",
    x402Eip712Name: String(env.X402_EIP712_NAME ?? "USD Coin").trim(),
    x402Eip712Version: String(env.X402_EIP712_VERSION ?? "2").trim(),
    cdpApiKeyId: isNonEmptyString(env.CDP_API_KEY_ID) ? env.CDP_API_KEY_ID.trim() : null,
    cdpApiKeySecret: isNonEmptyString(env.CDP_API_KEY_SECRET) ? env.CDP_API_KEY_SECRET.trim() : null,
    receiptHmacSecret: isNonEmptyString(env.RECEIPT_HMAC_SECRET) ? env.RECEIPT_HMAC_SECRET.trim() : null
  };

  if (!isHexAddress(config.x402PaymentAssetAddress)) {
    throw new Error("X402_PAYMENT_ASSET_ADDRESS must be a 0x-prefixed 20-byte address.");
  }
  if (!isHexAddress(config.x402PayTo)) {
    throw new Error("X402_PAY_TO must be a 0x-prefixed 20-byte address.");
  }
  if (config.x402VerifierMode === "facilitator" && !config.x402FacilitatorUrl) {
    throw new Error("X402_FACILITATOR_URL is required when X402_VERIFIER_MODE=facilitator.");
  }
  if (config.x402VerifierMode === "facilitator" && config.x402FacilitatorProvider === "cdp") {
    if (!isNonEmptyString(config.cdpApiKeyId)) {
      throw new Error("CDP_API_KEY_ID is required when X402_FACILITATOR_PROVIDER=cdp.");
    }
    if (!isNonEmptyString(config.cdpApiKeySecret)) {
      throw new Error("CDP_API_KEY_SECRET is required when X402_FACILITATOR_PROVIDER=cdp.");
    }
    if (!isNonEmptyString(config.x402Eip712Name)) {
      throw new Error("X402_EIP712_NAME is required when X402_FACILITATOR_PROVIDER=cdp.");
    }
    if (!isNonEmptyString(config.x402Eip712Version)) {
      throw new Error("X402_EIP712_VERSION is required when X402_FACILITATOR_PROVIDER=cdp.");
    }
  }
  if (environment === "production" || nodeEnv === "production") {
    validateProduction(config);
  }

  return config;
}
