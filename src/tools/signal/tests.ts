import test from "node:test";
import assert from "node:assert/strict";
import { extractSignal } from "./engine.js";
import { extractSignalInputSchema } from "./schema.js";

test("single string input produces a coherent signal output", () => {
  const result = extractSignal({
    input: "x402 tools are getting indexed on Agentic.Market",
    context: "crypto / agent economy / Base",
    output_type: "briefing",
    tone: "neutral"
  });

  assert.equal(result.recommended_artifact, "briefing");
  assert.ok(result.detected_themes.includes("x402"));
  assert.match(result.core_signal, /distribution layer|payable doors|paid endpoints/i);
  assert.ok(result.coherence_score > 0);
});

test("multiple source input clusters themes across sources", () => {
  const result = extractSignal({
    input: [
      "x402 receipts make paid calls legible for agents.",
      "Agentic.Market indexing turns the endpoint into a distribution surface.",
      "Base keeps the payment path close to where the buyers already route."
    ],
    output_type: "thesis",
    tone: "founder"
  });

  assert.ok(result.detected_themes.includes("x402"));
  assert.ok(result.detected_themes.includes("Agentic.Market"));
  assert.ok(result.detected_themes.includes("Base"));
  assert.equal(result.recommended_artifact, "thesis");
});

test("founder_post output is short and distribution-oriented", () => {
  const result = extractSignal({
    input: "x402 receipts and Agentic.Market indexing are turning paid calls into real distribution.",
    output_type: "founder_post",
    tone: "infopunks"
  });

  assert.equal(result.recommended_artifact, "founder_post");
  assert.match(result.artifact, /paid doors/i);
  assert.match(result.distribution_angle, /X post/i);
});

test("thesis output returns a concise thesis statement", () => {
  const result = extractSignal({
    input: [
      "Coherence scoring gives agent output a measurable trust layer.",
      "Receipts and proof pages make the trust claim auditable."
    ],
    output_type: "thesis",
    tone: "technical"
  });

  assert.match(result.artifact, /^Thesis:/);
  assert.match(result.amplified_artifact, /proof/i);
});

test("risk_signal output returns warning and mitigation", () => {
  const result = extractSignal({
    input: "Everyone is using our new x402 endpoint and adoption is exploding.",
    output_type: "risk_signal",
    tone: "neutral"
  });

  assert.match(result.artifact, /^Risk:/);
  assert.match(result.artifact, /Mitigation:/);
  assert.ok(result.risk_notes.length >= 1);
});

test("meme_angle output returns phrase and visual direction", () => {
  const result = extractSignal({
    input: "Signal wins when agents can route one clear claim instead of a wall of narrative noise.",
    output_type: "meme_angle",
    tone: "market"
  });

  assert.match(result.artifact, /^Phrase:/);
  assert.match(result.artifact, /Visual:/);
});

test("empty input fails validation", () => {
  const parsed = extractSignalInputSchema.safeParse({
    input: "   ",
    output_type: "thesis"
  });

  assert.equal(parsed.success, false);
});

test("unsupported adoption claims are flagged", () => {
  const result = extractSignal({
    input: "This is seeing mass adoption and everyone is using it across the market.",
    output_type: "briefing",
    tone: "neutral"
  });

  assert.ok(result.noise_removed.includes("unsupported adoption claims"));
  assert.ok(result.risk_notes.some((note) => note.includes("Adoption or listing claims need proof")));
});

test("signal extraction is deterministic", () => {
  const input = {
    input: [
      "x402 on Base gives agents a clean paid route.",
      "Receipts and proof pages make the route easier to trust.",
      "Agentic.Market indexing turns the route into discoverable distribution."
    ],
    context: "agent economy / paid APIs",
    output_type: "launch_copy" as const,
    tone: "infopunks" as const,
    audience: "agent builders"
  };

  const left = extractSignal(input);
  const right = extractSignal(input);

  assert.deepEqual(left, right);
});
