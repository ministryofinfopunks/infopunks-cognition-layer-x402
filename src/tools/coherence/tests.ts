import test from "node:test";
import assert from "node:assert/strict";
import { scoreCoherence } from "./engine.js";

test("coherence engine returns stable deterministic output", () => {
  const input = {
    artifact: "POST /v1/coherence-score as an x402-paid endpoint on Base. Every paid call returns a receipt, emits a war-room event, and preserves a proof page. Publish the OpenAPI contract, keep X402_VERIFIER_MODE=facilitator in production, and run typecheck, tests, and build before rollout because agents need stable routing and auditable payment evidence.",
    context: "Audience is agent builders deciding whether to trust and route the endpoint.",
    criteria: ["technical credibility", "actionability", "thesis alignment"],
    audience: "agents and founders",
    intended_action: "publish and route the endpoint"
  };

  const first = scoreCoherence(input);
  const second = scoreCoherence(input);

  assert.deepEqual(first, second);
});

test("low-quality vague artifact scores poorly", () => {
  const result = scoreCoherence({
    artifact: "This changes everything for everyone. It is revolutionary, seamless, and massively powerful.",
    audience: "agents"
  });

  assert.ok(result.coherence_score < 45);
  assert.ok(result.specificity < 35);
  assert.ok(result.technical_credibility < 35);
  assert.equal(result.decision, "high_risk");
});

test("overclaiming language is flagged", () => {
  const result = scoreCoherence({
    artifact: "This is the default layer, guaranteed to replace everything, and everyone will use it because it cannot fail."
  });

  assert.equal(result.overclaiming_risk, "high");
  assert.ok(result.technical_credibility < 30);
  assert.equal(result.decision, "high_risk");
});

test("strong proof-backed x402 artifact scores highly", () => {
  const result = scoreCoherence({
    artifact: "POST /v1/coherence-score as an x402-paid endpoint on Base. Each paid call returns a receipt, emits a war-room event, and exposes a proof page. Publish the OpenAPI contract, keep X402_VERIFIER_MODE=facilitator in production, and run typecheck, tests, and build before rollout because agents need stable routing and auditable payment evidence.",
    context: "The endpoint is aimed at agent builders and founders evaluating paid trust infrastructure.",
    criteria: ["technical credibility", "proof", "routing"],
    audience: "agents and founders",
    intended_action: "publish and route the endpoint"
  });

  assert.ok(result.coherence_score >= 75);
  assert.ok(result.technical_credibility >= 75);
  assert.equal(result.overclaiming_risk, "low");
  assert.deepEqual(result.missing_proof, []);
  assert.equal(result.decision, "publishable");
});

test("contradiction risk is surfaced", () => {
  const result = scoreCoherence({
    artifact: "The endpoint is live on Base mainnet today. The endpoint is not live yet and still needs a testnet dry run."
  });

  assert.equal(result.contradiction_risk, "high");
  assert.ok(result.contradictions.length >= 1);
  assert.ok(result.internal_consistency < 60);
});

test("missing proof detection catches unsupported operational claims", () => {
  const result = scoreCoherence({
    artifact: "The service already has broad developer adoption, paid volume, and a Bazaar listing with major integrations."
  });

  assert.ok(result.missing_proof.length >= 2);
  assert.equal(result.technical_credibility < 50, true);
});

test("extremely short artifact stays valid but scores low with useful feedback", () => {
  const result = scoreCoherence({
    artifact: "Launch it."
  });

  assert.ok(result.coherence_score < 40);
  assert.ok(result.weak_points.length >= 1);
  assert.equal(result.decision === "revise" || result.decision === "high_risk", true);
});
