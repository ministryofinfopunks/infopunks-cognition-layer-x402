import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { loadEnv } from "../src/config/env.js";
import { buildServer } from "../src/server.js";

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

test("paid mock requests create receipts, proof pages, and sanitized events", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const headers = {
      "x402-mock-payment": "paid",
      "x402-mock-payer": "integration-buyer"
    };

    const coherence = await app.inject({
      method: "POST",
      url: "/v1/coherence-score",
      headers,
      payload: {
        artifact: "POST /v1/coherence-score as an x402-paid endpoint on Base. Every paid call returns a receipt, emits a war-room event, and preserves a proof page. Publish the OpenAPI contract and run typecheck, tests, and build before rollout because agents need stable routing and auditable payment evidence.",
        context: "Audience is agent builders deciding whether to route the endpoint.",
        criteria: ["technical credibility", "proof", "actionability"],
        audience: "agents and founders",
        intended_action: "publish and route the endpoint"
      }
    });
    assert.equal(coherence.statusCode, 200);
    const coherenceBody = coherence.json();
    assert.equal(coherenceBody.receipt.tool_id, "score_coherence");
    assert.equal(coherenceBody.receipt.endpoint, "/v1/coherence-score");
    assert.equal(coherenceBody.receipt.final_status, 200);

    const receiptResponse = await app.inject({
      method: "GET",
      url: `/receipts/${coherenceBody.receipt.receipt_id}`
    });
    assert.equal(receiptResponse.statusCode, 200);
    assert.equal(receiptResponse.json().receipt_id, coherenceBody.receipt.receipt_id);
    assert.equal(receiptResponse.json().tool_id, "score_coherence");
    assert.equal("result_summary" in receiptResponse.json(), false);

    const proofResponse = await app.inject({
      method: "GET",
      url: `/proof/${coherenceBody.receipt.receipt_id}`
    });
    assert.equal(proofResponse.statusCode, 200);
    assert.match(proofResponse.body, /paid call verified/i);
    assert.doesNotMatch(proofResponse.body, /Request Excerpt|Response Excerpt|integration-buyer/);

    const signal = await app.inject({
      method: "POST",
      url: "/v1/extract-signal",
      headers,
      payload: {
        input: [
          "x402 receipts keep showing up in operator notes.",
          "Agentic.Market indexing and Base routing make the endpoint easier to distribute.",
          "Buyer chats keep repeating paid calls and proof-backed routing."
        ],
        context: "agent economy / Base",
        output_type: "founder_post",
        tone: "infopunks"
      }
    });
    assert.equal(signal.statusCode, 200);
    assert.equal(signal.json().recommended_artifact, "founder_post");

    const narrative = await app.inject({
      method: "POST",
      url: "/v1/simulate-narrative",
      headers,
      payload: {
        narrative: "Launch /v1/simulate-narrative as an x402-paid API on Base with receipts and War Room proof so agents can route or kill narratives with evidence.",
        time_horizon: "45d",
        market_context: "Builders want stable endpoints and marketplaces are indexing agent-callable tools.",
        perspective: "builder distribution",
        risk_tolerance: "medium"
      }
    });
    assert.equal(narrative.statusCode, 200);
    assert.equal(narrative.json().receipt.tool_id, "simulate_narrative");

    const eventsResponse = await app.inject({ method: "GET", url: "/v1/events/recent" });
    assert.equal(eventsResponse.statusCode, 200);
    const events = eventsResponse.json();
    assert.equal(events.length, 3);
    assert.equal(events[0].event_type, "cognition.simulate_narrative.paid");
    assert.equal(events[0].payment_status, "mock_verified");
    assert.equal(events[0].receipt_id, narrative.json().receipt.receipt_id);
    assert.ok(!JSON.stringify(events[0]).includes("Launch /v1/simulate-narrative"));

    const proofIndexResponse = await app.inject({ method: "GET", url: "/proof" });
    assert.equal(proofIndexResponse.statusCode, 200);
    assert.match(proofIndexResponse.body, /Verified paid calls with public proof metadata only/i);
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
