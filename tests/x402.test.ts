import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { loadEnv } from "../src/config/env.js";
import { buildServer } from "../src/server.js";
import { getToolById, getToolByRoute, listTools } from "../src/registry/tools.js";

const TEST_BASE_URL = "http://127.0.0.1:4024";
const TEST_PAY_TO = "0x1111111111111111111111111111111111111111";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913";

const PAID_ENDPOINTS = [
  "/v1/coherence-score",
  "/v1/extract-signal",
  "/v1/simulate-narrative"
] as const;

function decodePaymentRequiredHeader(response: { headers: Record<string, string | undefined> }): Record<string, unknown> {
  const encoded = response.headers["payment-required"];
  assert.equal(typeof encoded, "string");
  return JSON.parse(Buffer.from(String(encoded), "base64").toString("utf8")) as Record<string, unknown>;
}

function assertCompactPaymentRequiredHeader(
  decoded: any,
  encodedHeader: string,
  route: string
): void {
  assert.equal(decoded.x402Version, 2);
  assert.equal(Array.isArray(decoded.accepts), true);
  assert.equal(decoded.accepts.length > 0, true);
  assert.equal(encodedHeader.length < 8192, true);
  assert.equal(encodedHeader.length < 4096, true);

  const requirement = decoded.accepts[0];
  assert.equal(requirement.scheme, "exact");
  assert.equal(requirement.network, "eip155:8453");
  assert.equal(requirement.chain, "Base");
  assert.equal(requirement.amount, "10000");
  assert.equal(requirement.asset, BASE_USDC);
  assert.equal(requirement.payTo, TEST_PAY_TO);
  assert.equal(requirement.resource, `${TEST_BASE_URL}${route}`);
  assert.equal(typeof requirement.maxTimeoutSeconds, "number");
  assert.equal(requirement.maxTimeoutSeconds > 0, true);

  assert.equal(Object.hasOwn(decoded, "extensions"), false);
  assert.equal(Object.hasOwn(decoded, "resource"), false);
  assert.equal(Object.hasOwn(decoded, "inputSchema"), false);
  assert.equal(Object.hasOwn(decoded, "outputSchema"), false);
  assert.equal(JSON.stringify(decoded).includes("\"bazaar\""), false);
}

function assertBazaarChallengeShape(challenge: any, route: string): void {
  assert.equal(challenge.x402Version, 2);
  assert.ok(Array.isArray(challenge.accepts));
  assert.equal(challenge.accepts.length > 0, true);

  const requirement = challenge.accepts[0];
  assert.equal(requirement.scheme, "exact");
  assert.equal(requirement.network, "eip155:8453");
  assert.equal(requirement.chain, "Base");
  assert.equal(requirement.amount, "10000");
  assert.equal(requirement.asset, BASE_USDC);
  assert.equal(requirement.payTo, TEST_PAY_TO);
  assert.equal(typeof requirement.maxTimeoutSeconds, "number");
  assert.equal(requirement.maxTimeoutSeconds > 0, true);

  assert.equal(challenge.resource.url, `${TEST_BASE_URL}${route}`);
  assert.equal(challenge.resource.resource, `${TEST_BASE_URL}${route}`);
  assert.equal(challenge.resource.routeTemplate, route);
  assert.equal(challenge.resource.mimeType, "application/json");
  assert.equal(challenge.accepts[0].resource.url, `${TEST_BASE_URL}${route}`);

  const topLevelBazaar = challenge.extensions?.bazaar;
  const resourceBazaar = challenge.resource?.extensions?.bazaar;
  const acceptsBazaar = challenge.accepts?.[0]?.resource?.extensions?.bazaar;
  assert.ok(topLevelBazaar);
  assert.ok(resourceBazaar);
  assert.ok(acceptsBazaar);
  assert.deepEqual(topLevelBazaar, resourceBazaar);
  assert.deepEqual(resourceBazaar, acceptsBazaar);

  assert.ok(resourceBazaar.info);
  assert.ok(resourceBazaar.schema);
  assert.ok(resourceBazaar.info.input);
  assert.ok(resourceBazaar.info.output?.example);
  assert.equal(typeof resourceBazaar.info.output.example, "object");
  assert.equal(Array.isArray(resourceBazaar.info.output.example), false);
  assert.equal(Object.hasOwn(resourceBazaar.info.output.example, "type"), false);
  assert.equal(Object.hasOwn(resourceBazaar.info.output.example, "properties"), false);

  const schemaInput = resourceBazaar.schema?.properties?.input;
  const infoInput = resourceBazaar.info?.input;
  const required = Array.isArray(schemaInput?.required) ? schemaInput.required : [];
  for (const key of required) {
    assert.equal(Object.hasOwn(infoInput ?? {}, String(key)), true);
  }

  const bodySchema = schemaInput?.properties?.body;
  const bodyRequired = Array.isArray(bodySchema?.required) ? bodySchema.required : [];
  for (const key of bodyRequired) {
    assert.equal(Object.hasOwn(infoInput?.body ?? {}, String(key)), true);
  }
}

async function createTestServer() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "infopunks-cognition-layer-"));
  const config = loadEnv({
    ...process.env,
    APP_ENVIRONMENT: "test",
    NODE_ENV: "test",
    PORT: "4024",
    PUBLIC_BASE_URL: TEST_BASE_URL,
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

test("unpaid no-body and empty-body POST requests return 402 for all paid endpoints", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    for (const route of PAID_ENDPOINTS) {
      const noBody = await app.inject({
        method: "POST",
        url: route
      });
      assert.equal(noBody.statusCode, 402);
      assert.equal(noBody.json().error, "X-PAYMENT header is required");

      const emptyJson = await app.inject({
        method: "POST",
        url: route,
        headers: {
          "content-type": "application/json"
        },
        payload: {}
      });
      assert.equal(emptyJson.statusCode, 402);
      assert.equal(emptyJson.json().error, "X-PAYMENT header is required");
    }
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("unpaid 402 challenge includes x402 v2 + Bazaar metadata for all paid endpoints", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    for (const route of PAID_ENDPOINTS) {
      const response = await app.inject({
        method: "POST",
        url: route
      });
      const headers = response.headers as Record<string, string | undefined>;
      assert.equal(response.statusCode, 402);
      assert.equal(headers["x402-payment-required"], "true");
      assert.equal(headers["x402-payment-rail"], "x402");
      assert.equal(headers["x402-required"], "true");
      assert.equal(headers["x402-pricing-units"], "1");
      assert.equal(headers["x402-supported-networks"], "eip155:8453");
      assert.equal(headers["x402-accepted-assets"], "USDC");
      assert.equal(headers["x402-discovery"], `${TEST_BASE_URL}/.well-known/infopunks-cognition-layer.json`);

      const body = response.json();
      const decoded = decodePaymentRequiredHeader(response as any);
      const encodedHeader = String(headers["payment-required"] ?? "");
      assertCompactPaymentRequiredHeader(decoded, encodedHeader, route);
      assertBazaarChallengeShape(body, route);
    }
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("node fetch receives unpaid 402 without headers overflow", async () => {
  const { app, runtimeDir } = await createTestServer();
  let baseUrl: string | undefined;
  try {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    assert.equal(address != null && typeof address === "object", true);
    const port = Number((address as { port: number }).port);
    baseUrl = `http://127.0.0.1:${String(port)}`;
    const response = await fetch(`${baseUrl}/v1/coherence-score`, {
      method: "POST"
    });
    assert.equal(response.status, 402);
    const decoded = decodePaymentRequiredHeader({
      headers: Object.fromEntries(response.headers.entries())
    });
    const encoded = response.headers.get("payment-required") ?? "";
    assertCompactPaymentRequiredHeader(decoded, encoded, "/v1/coherence-score");
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("paid invalid body returns 400 after payment verification", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      headers: {
        "x402-mock-payment": "paid",
        "x402-mock-payer": "test-agent"
      },
      payload: {}
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.error, "invalid_request");
    assert.equal(Array.isArray(body.issues), true);
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test("mock-paid valid requests return 200 with receipt metadata for all paid endpoints", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const cases: Array<{ route: string; payload: Record<string, unknown>; toolId: string }> = [
      {
        route: "/v1/coherence-score",
        payload: {
          artifact: "Infopunks should validate input, require x402 payment, execute deterministically, hash the result, emit an event, and return proof-safe receipt metadata."
        },
        toolId: "score_coherence"
      },
      {
        route: "/v1/extract-signal",
        payload: {
          input: "x402 lets agents pay cognition endpoints directly.",
          output_type: "briefing",
          context: "agentic markets"
        },
        toolId: "extract_signal"
      },
      {
        route: "/v1/simulate-narrative",
        payload: {
          narrative: "Paid cognition APIs become a primitive for agentic markets.",
          time_horizon: "30d"
        },
        toolId: "simulate_narrative"
      }
    ];

    for (const item of cases) {
      const response = await app.inject({
        method: "POST",
        url: item.route,
        headers: {
          "x402-mock-payment": "paid",
          "x402-mock-payer": "test-agent"
        },
        payload: item.payload
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.receipt.tool_id, item.toolId);
      assert.equal(body.receipt.endpoint, item.route);
      assert.equal(body.receipt.final_status, 200);
      assert.equal(body.receipt.x402_verified, true);
      assert.match(body.receipt.result_hash, /^[a-f0-9]{64}$/);
      assert.match(body.receipt.proof_url, /\/proof\/rcpt_/);
    }
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
