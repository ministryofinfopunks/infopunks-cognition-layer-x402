import test from "node:test";
import assert from "node:assert/strict";
import { loadEnv } from "../src/config/env.js";

test("production public URL validation rejects localhost", () => {
  assert.throws(() => {
    loadEnv({
      ...process.env,
      APP_ENVIRONMENT: "production",
      NODE_ENV: "production",
      PORT: "4024",
      PUBLIC_BASE_URL: "https://localhost:4024",
      X402_VERIFIER_MODE: "facilitator",
      X402_FACILITATOR_URL: "https://facilitator.base.org/verify",
      X402_NETWORK: "eip155:8453",
      X402_ASSET_SYMBOL: "USDC",
      X402_PAYMENT_ASSET_ADDRESS: "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913",
      X402_PAY_TO: "0x2222222222222222222222222222222222222222"
    });
  }, /Production URLs cannot contain localhost/);
});
