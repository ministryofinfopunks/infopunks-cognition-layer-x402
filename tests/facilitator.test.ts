import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/config/env.js";

async function createFacilitatorTestServer() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "infopunks-cognition-layer-facilitator-"));
  const config = loadEnv({
    ...process.env,
    APP_ENVIRONMENT: "test",
    NODE_ENV: "test",
    PORT: "4024",
    PUBLIC_BASE_URL: "http://127.0.0.1:4024",
    RUNTIME_DIR: runtimeDir,
    X402_VERIFIER_MODE: "facilitator",
    X402_FACILITATOR_PROVIDER: "cdp",
    X402_FACILITATOR_URL: "https://facilitator.test/v2/x402",
    X402_REQUIRED_DEFAULT: "true",
    CDP_API_KEY_ID: "test-key-id",
    CDP_API_KEY_SECRET: "test-key-secret"
  });
  const context = await buildServer(config);
  return { ...context, runtimeDir };
}

function samplePaymentPayloadBase64(): string {
  const payload = {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "base",
      asset: "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913",
      amount: "10000",
      payTo: "0x1111111111111111111111111111111111111111",
      extra: {
        name: "USD Coin",
        version: "2"
      }
    },
    payload: {
      signature: "0xdeadbeef",
      authorization: {
        from: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        to: "0x1111111111111111111111111111111111111111",
        value: "10000",
        validAfter: "1",
        validBefore: "9999999999",
        nonce: "0x1234"
      }
    }
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

test("facilitator mode requires a payment header", async () => {
  const { app, runtimeDir } = await createFacilitatorTestServer();
  const originalFetch = globalThis.fetch;
  const fetchCalls: string[] = [];
  globalThis.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push(url);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      payload: {
        artifact: "Missing payment header should produce 402 in facilitator mode."
      }
    });
    assert.equal(response.statusCode, 402);
    assert.equal(fetchCalls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("facilitator mode calls verify then settle and returns settled receipt", async () => {
  const { app, runtimeDir } = await createFacilitatorTestServer();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

  globalThis.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url, body });

    if (url.endsWith("/verify")) {
      return new Response(JSON.stringify({ isValid: true, payer: "0xverify-payer", verifier_reference: "verify_ref" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/settle")) {
      return new Response(JSON.stringify({ success: true, transaction: "0xsettle_tx_hash" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("not found", { status: 404 });
  };

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      headers: {
        "x-payment": samplePaymentPayloadBase64()
      },
      payload: {
        artifact: "Facilitator verify and settle should both run before success is returned."
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.receipt.x402_verified, true);
    assert.equal(body.receipt.settlement_reference, "0xsettle_tx_hash");
    assert.equal(body.receipt.settlement_status, "settled");
    assert.equal(calls.length, 2);
    assert.match(calls[0]?.url ?? "", /\/verify$/);
    assert.match(calls[1]?.url ?? "", /\/settle$/);

    const verifyBody = calls[0]?.body ?? {};
    const settleBody = calls[1]?.body ?? {};
    const paymentRequirements = (verifyBody.paymentRequirements ?? {}) as Record<string, unknown>;
    const settlePaymentRequirements = (settleBody.paymentRequirements ?? {}) as Record<string, unknown>;
    assert.equal(paymentRequirements.scheme, "exact");
    assert.equal(paymentRequirements.network, "base");
    assert.equal(paymentRequirements.asset, "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913");
    assert.equal(paymentRequirements.payTo, "0x1111111111111111111111111111111111111111");
    assert.equal(paymentRequirements.amount, "10000");
    assert.equal(paymentRequirements.maxAmountRequired, "10000");
    assert.equal(paymentRequirements.resource, "http://127.0.0.1:4024/v1/coherence-score");
    assert.equal(paymentRequirements.mimeType, "application/json");
    assert.deepEqual(paymentRequirements.extra, { name: "USD Coin", version: "2" });
    assert.deepEqual(settlePaymentRequirements.extra, { name: "USD Coin", version: "2" });
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("facilitator mode returns 402 when verify fails", async () => {
  const { app, runtimeDir } = await createFacilitatorTestServer();
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async (input: URL | RequestInfo) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    return new Response(JSON.stringify({ isValid: false }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      headers: {
        "x402-payment": samplePaymentPayloadBase64()
      },
      payload: {
        artifact: "Verify failure should map to unpaid response."
      }
    });
    assert.equal(response.statusCode, 402);
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? "", /\/verify$/);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("facilitator mode returns 402 when settle fails", async () => {
  const { app, runtimeDir } = await createFacilitatorTestServer();
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async (input: URL | RequestInfo) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    if (url.endsWith("/verify")) {
      return new Response(JSON.stringify({ isValid: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      headers: {
        "payment-signature": samplePaymentPayloadBase64()
      },
      payload: {
        artifact: "Settle failure should map to unpaid response."
      }
    });
    assert.equal(response.statusCode, 402);
    assert.equal(calls.length, 2);
    assert.match(calls[0] ?? "", /\/verify$/);
    assert.match(calls[1] ?? "", /\/settle$/);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
