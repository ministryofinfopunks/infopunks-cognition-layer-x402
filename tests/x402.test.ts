import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { loadEnv } from "../src/config/env.js";
import { buildServer } from "../src/server.js";
import { getToolById, getToolByRoute, listTools } from "../src/registry/tools.js";

async function createTestServer() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "infopunks-cognition-layer-"));
  const config = loadEnv({
    ...process.env,
    APP_ENVIRONMENT: "test",
    NODE_ENV: "test",
    PORT: "4024",
    PUBLIC_BASE_URL: "http://127.0.0.1:4024",
    RUNTIME_DIR: runtimeDir,
    X402_VERIFIER_MODE: "mock",
    X402_REQUIRED_DEFAULT: "true"
  });
  const context = await buildServer(config);
  return { ...context, runtimeDir };
}

test("all three tools are registered", () => {
  assert.deepEqual(listTools().map((tool) => tool.tool_id), [
    "score_coherence",
    "extract_signal",
    "simulate_narrative"
  ]);
});

test("routes are unique", () => {
  const routes = listTools().map((tool) => tool.route);
  assert.equal(new Set(routes).size, routes.length);
});

test("tool ids are unique", () => {
  const ids = listTools().map((tool) => tool.tool_id);
  assert.equal(new Set(ids).size, ids.length);
});

test("registry lookups work by id and route", () => {
  assert.equal(getToolById("score_coherence")?.route, "/v1/coherence-score");
  assert.equal(getToolByRoute("/v1/simulate-narrative")?.tool_id, "simulate_narrative");
});

test("unpaid requests receive x402 challenge", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const unpaidCases: Array<{ route: string; payload: Record<string, unknown> }> = [
      {
        route: "/v1/coherence-score",
        payload: {
          artifact: "Publish the x402-paid coherence endpoint and keep receipts attached to every paid result."
        }
      },
      {
        route: "/v1/extract-signal",
        payload: {
          input: "agent-native paid routing needs public x402 discovery metadata",
          output_type: "briefing"
        }
      },
      {
        route: "/v1/simulate-narrative",
        payload: {
          narrative: "x402 paid cognition primitives become easier to route once receipts and proof are discoverable."
        }
      }
    ];

    for (const unpaidCase of unpaidCases) {
      const response = await app.inject({
        method: "POST",
        url: unpaidCase.route,
        payload: unpaidCase.payload
      });
      const headers = response.headers as Record<string, string | undefined>;
      assert.equal(response.statusCode, 402);
      const body = response.json();
      assert.equal(body.x402Version, 1);
      assert.equal(body.error, "X-PAYMENT header is required");
      assert.ok(Array.isArray(body.accepts));
      assert.ok(body.accepts.length > 0);
      assert.equal(body.accepts[0].scheme, "exact");
      assert.equal(body.accepts[0].network, "base");
      assert.equal(body.accepts[0].maxAmountRequired, "10000");
      assert.equal(body.accepts[0].resource, `http://127.0.0.1:4024${unpaidCase.route}`);
      assert.equal(body.accepts[0].payTo, "0x1111111111111111111111111111111111111111");
      assert.equal(body.accepts[0].asset, "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913");
      assert.equal(headers["payment-required"], undefined);
      assert.equal(headers["x402-payment-required"], "true");
      assert.equal(headers["www-authenticate"], 'x402 realm="infopunks-cognition-layer", units="1", rail="x402"');
      assert.equal(headers["x402-payment-rail"], "x402");
      assert.equal(headers["x402-required"], "true");
      assert.equal(headers["x402-pricing-units"], "1");
      assert.match(headers["x402-supported-networks"] ?? "", /base/);
      assert.equal(headers["x402-accepted-assets"], "USDC");
      assert.equal(
        headers["x402-discovery"],
        "http://127.0.0.1:4024/.well-known/infopunks-cognition-layer.json"
      );
    }
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("mock-paid requests return 200 with public receipt metadata", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      headers: {
        "x402-mock-payment": "paid",
        "x402-mock-payer": "test-agent"
      },
      payload: {
        artifact: "Infopunks should validate input, require x402 payment, execute deterministically, hash the result, emit an event, and return proof-safe receipt metadata."
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.receipt.tool_id, "score_coherence");
    assert.equal(body.receipt.endpoint, "/v1/coherence-score");
    assert.equal(body.receipt.final_status, 200);
    assert.equal(body.receipt.x402_verified, true);
    assert.match(body.receipt.result_hash, /^[a-f0-9]{64}$/);
    assert.match(body.receipt.proof_url, /\/proof\/rcpt_/);
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("empty coherence artifact returns validation error before payment challenge", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      payload: {
        artifact: "   "
      }
    });
    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.error, "invalid_request");
    assert.equal(body.issues[0].path, "artifact");
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("empty simulate narrative request returns validation error before payment challenge", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/simulate-narrative",
      payload: {
        narrative: "   "
      }
    });
    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.error, "invalid_request");
    assert.equal(body.issues[0].path, "narrative");
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
