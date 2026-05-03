import test from "node:test";
import assert from "node:assert/strict";
import { simulateNarrative } from "./engine.js";

const infrastructureNarrative = {
  narrative: "Launch /v1/simulate-narrative as an x402-paid API on Base so agents can test narratives before routing them through marketplaces.",
  time_horizon: "45d",
  market_context: "Builders want stable endpoints, paid calls, and receipt-backed proof before integrating.",
  perspective: "builder distribution",
  risk_tolerance: "medium"
} as const;

test("narrative simulator probabilities sum to roughly 1.0 and stay ordered", () => {
  const result = simulateNarrative(infrastructureNarrative);
  const sum = result.paths.reduce((total, path) => total + path.probability, 0);

  assert.ok(result.paths.length >= 3 && result.paths.length <= 5);
  assert.ok(Math.abs(sum - 1) <= 0.0001);
  assert.equal(result.paths[0]?.name, result.highest_probability_path);

  for (let index = 1; index < result.paths.length; index += 1) {
    assert.ok(result.paths[index - 1]!.probability >= result.paths[index]!.probability);
  }
});

test("x402, Base, and agent-heavy narratives favor infrastructure or proof-led paths", () => {
  const result = simulateNarrative({
    ...infrastructureNarrative,
    narrative: `${infrastructureNarrative.narrative} Publish receipts and War Room proof so the paid endpoint is legible on X.`,
    market_context: "Agent marketplaces on Base are indexing callable APIs with paid receipts."
  });

  assert.ok([
    "Infrastructure Pull",
    "Viral Proof Moment"
  ].includes(result.highest_probability_path));
});

test("overclaiming narratives surface exhaustion or confusion", () => {
  const result = simulateNarrative({
    narrative: "This new protocol standard will replace everything across wallets, metadata, settlement, and every ecosystem because it is guaranteed to become the default layer.",
    time_horizon: "30d",
    market_context: "The claim spans Base, Solana, and multiple marketplaces without proof.",
    perspective: "market commentary",
    risk_tolerance: "high"
  });

  assert.ok([
    "Narrative Exhaustion",
    "Spec Confusion"
  ].includes(result.highest_probability_path));
});

test("proof-backed narratives boost Viral Proof Moment", () => {
  const withoutProof = simulateNarrative({
    narrative: "Launch the paid narrative endpoint for agents and builders on Base.",
    time_horizon: "30d",
    market_context: "The API is live for builders.",
    perspective: "launch ops",
    risk_tolerance: "medium"
  });
  const withProof = simulateNarrative({
    narrative: "Launch the paid narrative endpoint for agents and builders on Base with paid call receipts, War Room screenshots, and Bazaar metadata.",
    time_horizon: "30d",
    market_context: "The API is live and the team is sharing proof cards on X.",
    perspective: "launch ops",
    risk_tolerance: "medium"
  });

  const findProbability = (result: ReturnType<typeof simulateNarrative>, name: string): number =>
    result.paths.find((path) => path.name === name)?.probability ?? 0;

  assert.ok(findProbability(withProof, "Viral Proof Moment") > findProbability(withoutProof, "Viral Proof Moment"));
});

test("narrative simulator is deterministic", () => {
  const first = simulateNarrative({
    narrative: "Receipts, docs, and x402 endpoints make the narrative primitive callable by agents.",
    time_horizon: "60d",
    market_context: "Developers are evaluating whether to integrate or ignore the endpoint.",
    perspective: "operator",
    risk_tolerance: "low"
  });
  const second = simulateNarrative({
    narrative: "Receipts, docs, and x402 endpoints make the narrative primitive callable by agents.",
    time_horizon: "60d",
    market_context: "Developers are evaluating whether to integrate or ignore the endpoint.",
    perspective: "operator",
    risk_tolerance: "low"
  });

  assert.deepEqual(first, second);
});
