import os from "node:os";
import path from "node:path";
import type { PaymentVerifierMode } from "../x402/types.js";

const BASE_MAINNET_CAIP2 = "eip155:8453";
const BASE_MAINNET_USDC = "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913";
const DEV_PAY_TO = "0x1111111111111111111111111111111111111111";

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
  x402FacilitatorUrl: string | null;
  x402VerifierTimeoutMs: number;
  x402Network: string;
  x402AssetSymbol: string;
  x402PaymentAssetAddress: string;
  x402PayTo: string;
  x402Scheme: "exact";
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
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = String(env.APP_ENVIRONMENT ?? env.NODE_ENV ?? "development").trim().toLowerCase();
  const nodeEnv = String(env.NODE_ENV ?? "development").trim().toLowerCase();
  const verifierMode = String(env.X402_VERIFIER_MODE ?? "mock").trim().toLowerCase() as PaymentVerifierMode;
  if (!["mock", "facilitator"].includes(verifierMode)) {
    throw new Error("X402_VERIFIER_MODE must be mock or facilitator.");
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
    x402FacilitatorUrl: isNonEmptyString(env.X402_FACILITATOR_URL) ? env.X402_FACILITATOR_URL.trim() : null,
    x402VerifierTimeoutMs: parsePositiveInt("X402_VERIFIER_TIMEOUT_MS", env.X402_VERIFIER_TIMEOUT_MS, 5000),
    x402Network: String(env.X402_NETWORK ?? BASE_MAINNET_CAIP2).trim(),
    x402AssetSymbol: String(env.X402_ASSET_SYMBOL ?? "USDC").trim().toUpperCase(),
    x402PaymentAssetAddress: String(env.X402_PAYMENT_ASSET_ADDRESS ?? BASE_MAINNET_USDC).trim(),
    x402PayTo: String(env.X402_PAY_TO ?? DEV_PAY_TO).trim(),
    x402Scheme: "exact",
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
  if (environment === "production" || nodeEnv === "production") {
    validateProduction(config);
  }

  return config;
}
