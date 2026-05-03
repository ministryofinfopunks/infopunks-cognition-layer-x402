import { average, clamp, jaccard, toPercent, uniqueTokens } from "../common.js";
import type { CoherenceScoreInput, CoherenceScoreOutput, RiskLevel } from "./schema.js";

type ThemeName = "trust" | "signal" | "narrative" | "payment" | "routing" | "proof";

interface SentenceAnalysis {
  text: string;
  tokens: string[];
  themes: ThemeName[];
  hasNegation: boolean;
}

interface ScoreContext {
  artifactLower: string;
  supportLower: string;
  artifactWords: string[];
  supportWords: string[];
  artifactTokens: string[];
  supportTokens: string[];
  sentences: SentenceAnalysis[];
  criteriaCoverage: number;
  audienceFit: number;
  intendedActionFit: number;
  themeCounts: Record<ThemeName, number>;
  dominantTheme: ThemeName;
}

const VAGUE_WORDS = [
  "amazing", "best-in-class", "breakthrough", "cutting-edge", "disruptive", "game-changing", "massive",
  "next-gen", "powerful", "revolutionary", "seamless", "world-class", "value", "optimized", "optimize"
] as const;

const JARGON_WORDS = [
  "alpha", "ecosystem", "flywheel", "holistic", "innovation", "leverage", "paradigm", "synergy",
  "transformative", "visionary", "frictionless", "omnichannel", "mindshare"
] as const;

const CAUSAL_TERMS = [
  "because", "therefore", "if", "then", "enables", "so", "which means", "turns", "drives",
  "leads to", "results in", "allows", "causes", "depends on"
] as const;

const ACTION_TERMS = [
  "ship", "publish", "route", "verify", "integrate", "test", "launch", "deploy", "roll out",
  "measure", "reject", "amplify", "audit", "monitor", "buy", "list"
] as const;

const MARKET_TERMS = [
  "agent", "agents", "founder", "founders", "developer", "developers", "market", "marketplace",
  "marketplaces", "distribution", "adoption", "buyers", "routing", "protocol", "payments",
  "checkout", "bazaar", "agentic.market", "base", "coinbase"
] as const;

const TECH_TERMS = [
  "api", "endpoint", "endpoints", "openapi", "schema", "json", "proof", "receipt", "receipts",
  "metadata", "test", "tests", "build", "typecheck", "implementation", "network", "base",
  "mainnet", "testnet", "x402", "facilitator", "verifier", "route", "routes", "war-room"
] as const;

const PROOF_TERMS = [
  "proof", "receipt", "receipts", "evidence", "verified", "verify", "test", "tests", "transaction",
  "transactions", "tx", "hash", "metric", "metrics", "logs", "log", "openapi", "schema",
  "endpoint", "api", "commit", "pr", "spec",
  "proof page", "war-room", "event", "events", "metadata"
] as const;

const OVERCLAIM_PHRASES = [
  "guaranteed", "everyone will", "everyone uses", "everyone wants", "replaces everything", "replaces all",
  "unstoppable", "certain", "cannot fail", "always wins", "becomes the default", "is the default",
  "default layer", "inevitable", "proves everything"
] as const;

const ABSOLUTE_TERMS = ["always", "never", "impossible", "undeniable", "certain", "guaranteed"] as const;

const OPPOSITE_PAIRS = [
  ["increase", "decrease", "growth direction"],
  ["growing", "shrinking", "growth direction"],
  ["live", "not live", "launch status"],
  ["live", "testnet", "network status"],
  ["mainnet", "testnet", "network status"],
  ["open", "closed", "availability"],
  ["trust", "distrust", "trust posture"],
  ["paid", "free", "payment model"],
  ["stable", "unstable", "stability"],
  ["launch", "delay", "timeline"],
  ["adoption", "rejection", "market reception"]
] as const;

const THEME_KEYWORDS: Record<ThemeName, readonly string[]> = {
  trust: ["trust", "coherent", "coherence", "reliable", "reliability", "credibility", "consistent", "alignment", "stable", "verify"],
  signal: ["signal", "noise", "clarity", "density", "attention", "relevance", "salience", "insight", "sensemaking"],
  narrative: ["narrative", "story", "thesis", "frame", "framing", "message", "positioning", "meme", "coordination"],
  payment: ["x402", "payment", "payments", "paid", "pricing", "checkout", "settlement", "usdc", "facilitator", "verifier"],
  routing: ["route", "routing", "distribution", "marketplace", "bazaar", "index", "indexed", "discovery", "amplify", "reject"],
  proof: ["proof", "receipt", "receipts", "evidence", "audit", "metadata", "openapi", "schema", "endpoint", "test"]
};

const PROOF_SENSITIVE_CLAIMS = [
  {
    label: "Adoption claim lacks proof such as usage metrics, integration counts, or receipt-backed activity.",
    patterns: [/\badoption\b/i, /\bused by\b/i, /\bactive users?\b/i, /\bin production\b/i, /\bgrowing usage\b/i, /\bdeveloper adoption\b/i]
  },
  {
    label: "Mainnet or live-network claim lacks proof such as the network name, transaction evidence, or test reference.",
    patterns: [/\bmainnet\b/i, /\blive on base\b/i, /\blive onchain\b/i, /\bproduction network\b/i]
  },
  {
    label: "Bazaar or marketplace listing claim lacks proof such as listing metadata, endpoint discovery, or index evidence.",
    patterns: [/\bbazaar\b/i, /\bagentic\.market\b/i, /\bmarketplace\b/i, /\blisted\b/i, /\bindexed\b/i]
  },
  {
    label: "Paid usage or volume claim lacks proof such as receipts, transaction counts, or payment metrics.",
    patterns: [/\bpaid usage\b/i, /\brevenue\b/i, /\bvolume\b/i, /\bgmv\b/i, /\btransactions?\b/i, /\bbuyers paid\b/i]
  },
  {
    label: "Integration claim lacks proof such as named partners, endpoints, tests, or implementation references.",
    patterns: [/\bintegrations?\b/i, /\bintegrated\b/i, /\bpartners?\b/i, /\bplugin\b/i, /\bconnector\b/i, /\bsdk\b/i]
  }
] as const;

function splitSentences(value: string): string[] {
  return value
    .split(/(?:[.!?]+\s+|\n+)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function wordList(value: string): string[] {
  return value.match(/[A-Za-z0-9/._:-]+/g) ?? [];
}

function countPhraseHits(text: string, phrases: readonly string[]): number {
  return phrases.reduce((count, phrase) => count + (text.includes(phrase) ? 1 : 0), 0);
}

function countRegexMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches == null ? 0 : matches.length;
}

function listPresentPhrases(text: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => text.includes(phrase));
}

function riskLevel(value: number): RiskLevel {
  if (value >= 0.67) {
    return "high";
  }
  if (value >= 0.34) {
    return "medium";
  }
  return "low";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function themeHits(text: string): Record<ThemeName, number> {
  const lowered = text.toLowerCase();
  return {
    trust: countPhraseHits(lowered, THEME_KEYWORDS.trust),
    signal: countPhraseHits(lowered, THEME_KEYWORDS.signal),
    narrative: countPhraseHits(lowered, THEME_KEYWORDS.narrative),
    payment: countPhraseHits(lowered, THEME_KEYWORDS.payment),
    routing: countPhraseHits(lowered, THEME_KEYWORDS.routing),
    proof: countPhraseHits(lowered, THEME_KEYWORDS.proof)
  };
}

function dominantThemeFromCounts(counts: Record<ThemeName, number>): ThemeName {
  const order: ThemeName[] = ["payment", "proof", "routing", "trust", "narrative", "signal"];
  let current: ThemeName = "payment";
  for (const candidate of order.slice(1)) {
    if (counts[candidate] > counts[current]) {
      current = candidate;
    }
  }
  return current;
}

function analyzeSentences(artifact: string): SentenceAnalysis[] {
  return splitSentences(artifact).map((sentence) => {
    const hits = themeHits(sentence);
    const themes = (Object.entries(hits) as Array<[ThemeName, number]>)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2)
      .map(([theme]) => theme);
    return {
      text: sentence,
      tokens: uniqueTokens(sentence),
      themes,
      hasNegation: /\b(no|not|never|without|lacks?)\b/i.test(sentence)
    };
  });
}

function computeCriteriaCoverage(criteria: string[], text: string): number {
  if (criteria.length === 0) {
    return 1;
  }
  const lowered = text.toLowerCase();
  return average(criteria.map((criterion) => {
    const tokens = uniqueTokens(criterion);
    if (tokens.length === 0) {
      return 1;
    }
    return tokens.some((token) => lowered.includes(token)) ? 1 : 0;
  }));
}

function computeAudienceFit(audience: string | undefined, artifactTokens: string[]): number {
  if (!audience) {
    return 0.5;
  }
  const overlap = jaccard(uniqueTokens(audience), artifactTokens);
  return clamp(0.35 + overlap * 1.8, 0, 1);
}

function computeIntendedActionFit(intendedAction: string | undefined, supportLower: string): number {
  if (!intendedAction) {
    return 0.5;
  }
  const tokens = uniqueTokens(intendedAction);
  if (tokens.length === 0) {
    return 0.5;
  }
  const overlap = average(tokens.map((token) => supportLower.includes(token) ? 1 : 0));
  return clamp(0.25 + overlap * 1.4, 0, 1);
}

function buildScoreContext(input: CoherenceScoreInput): ScoreContext {
  const criteria = input.criteria ?? [];
  const supportText = [
    input.artifact,
    input.context ?? "",
    criteria.join(" "),
    input.audience ?? "",
    input.intended_action ?? ""
  ].filter((value) => value.length > 0).join(" ");
  const artifactLower = input.artifact.toLowerCase();
  const supportLower = supportText.toLowerCase();
  const artifactWords = wordList(input.artifact);
  const supportWords = wordList(supportText);
  const artifactTokens = uniqueTokens(input.artifact);
  const supportTokens = uniqueTokens(supportText);
  const sentences = analyzeSentences(input.artifact);
  const themeCounts = themeHits(supportText);
  return {
    artifactLower,
    supportLower,
    artifactWords,
    supportWords,
    artifactTokens,
    supportTokens,
    sentences,
    criteriaCoverage: computeCriteriaCoverage(criteria, supportText),
    audienceFit: computeAudienceFit(input.audience, artifactTokens),
    intendedActionFit: computeIntendedActionFit(input.intended_action, supportLower),
    themeCounts,
    dominantTheme: dominantThemeFromCounts(themeCounts)
  };
}

function detectContradictions(sentences: SentenceAnalysis[]): string[] {
  const contradictions: string[] = [];
  for (const [index, current] of sentences.entries()) {
    for (const target of sentences.slice(index + 1)) {
      const overlap = jaccard(current.tokens, target.tokens);
      if (overlap < 0.18 && current.themes.every((theme) => !target.themes.includes(theme))) {
        continue;
      }
      for (const [leftTerm, rightTerm, label] of OPPOSITE_PAIRS) {
        const currentHasLeft = current.text.toLowerCase().includes(leftTerm);
        const currentHasRight = current.text.toLowerCase().includes(rightTerm);
        const targetHasLeft = target.text.toLowerCase().includes(leftTerm);
        const targetHasRight = target.text.toLowerCase().includes(rightTerm);
        if ((currentHasLeft && targetHasRight) || (currentHasRight && targetHasLeft)) {
          pushUnique(
            contradictions,
            `Sentence ${index + 1} conflicts with sentence ${sentences.indexOf(target) + 1} on ${label}: "${leftTerm}" versus "${rightTerm}".`
          );
        }
      }
      if (current.hasNegation !== target.hasNegation && overlap >= 0.35) {
        pushUnique(
          contradictions,
          `Sentence ${index + 1} and sentence ${sentences.indexOf(target) + 1} use overlapping terms with opposite polarity.`
        );
      }
    }
  }
  return contradictions;
}

function detectMissingProof(sentences: SentenceAnalysis[]): string[] {
  const notes: string[] = [];
  for (const [index, sentence] of sentences.entries()) {
    const window = `${sentence.text} ${sentences[index + 1]?.text ?? ""}`.toLowerCase();
    const proofPresent = countPhraseHits(window, PROOF_TERMS) > 0 || /\b\d+\b/.test(window);
    if (proofPresent) {
      continue;
    }
    for (const detector of PROOF_SENSITIVE_CLAIMS) {
      if (detector.patterns.some((pattern) => pattern.test(window))) {
        pushUnique(notes, detector.label);
      }
    }
  }
  return notes;
}

function scoreClarity(context: ScoreContext): number {
  const wordCount = context.artifactWords.length;
  const sentenceLengths = context.sentences.map((sentence) => wordList(sentence.text).length);
  const averageSentenceLength = average(sentenceLengths);
  const longSentenceRatio = average(sentenceLengths.map((length) => length > 24 ? 1 : 0));
  const vagueDensity = countPhraseHits(context.artifactLower, VAGUE_WORDS) / Math.max(wordCount, 1);
  const jargonDensity = countPhraseHits(context.artifactLower, JARGON_WORDS) / Math.max(wordCount, 1);
  const readabilityPenalty = Math.max(averageSentenceLength - 18, 0) * 0.015;
  const brevityPenalty = wordCount < 18 ? (18 - wordCount) * 0.02 : 0;
  return clamp(
    0.9
      - readabilityPenalty
      - longSentenceRatio * 0.2
      - vagueDensity * 1.7
      - jargonDensity * 1.1
      - brevityPenalty,
    0,
    1
  );
}

function scoreSpecificity(context: ScoreContext): number {
  const wordCount = context.artifactWords.length;
  const numbers = countRegexMatches(context.supportLower, /\b\d+(?:\.\d+)?\b/g);
  const endpoints = countRegexMatches(context.supportLower, /\/v\d+\/[a-z0-9-]+/g);
  const namedSystems = countRegexMatches(context.artifactLower, /\b(x402|openapi|war-room|receipt|proof|base|usdc|json|api|endpoint|schema|testnet|mainnet)\b/g);
  const vagueDensity = countPhraseHits(context.artifactLower, VAGUE_WORDS) / Math.max(wordCount, 1);
  const proofTerms = countPhraseHits(context.supportLower, PROOF_TERMS);
  return clamp(
    0.08
      + Math.min(numbers, 4) * 0.09
      + Math.min(endpoints, 3) * 0.14
      + Math.min(namedSystems, 6) * 0.07
      + Math.min(proofTerms, 6) * 0.05
      + context.criteriaCoverage * 0.08
      - vagueDensity * 1.15
      - (wordCount < 14 ? 0.18 : 0),
    0,
    1
  );
}

function scoreCausalLogic(context: ScoreContext): number {
  const causalHits = countPhraseHits(context.artifactLower, CAUSAL_TERMS);
  const ifThenBonus = /\bif\b[\s\S]{0,80}\bthen\b/i.test(context.artifactLower) ? 0.16 : 0;
  return clamp(
    0.08
      + Math.min(causalHits, 5) * 0.15
      + ifThenBonus
      + context.criteriaCoverage * 0.04
      - (context.artifactWords.length < 12 ? 0.16 : 0),
    0,
    1
  );
}

function scoreActionability(context: ScoreContext): number {
  const actionHits = countPhraseHits(context.supportLower, ACTION_TERMS);
  const enumeratedStepBonus = /\b(before|next|step|run|publish|verify|route|launch)\b/i.test(context.artifactLower) ? 0.08 : 0;
  return clamp(
    0.06
      + Math.min(actionHits, 6) * 0.12
      + enumeratedStepBonus
      + context.intendedActionFit * 0.18
      + context.audienceFit * 0.04
      - (context.artifactWords.length < 10 ? 0.12 : 0),
    0,
    1
  );
}

function scoreThesisAlignment(context: ScoreContext): number {
  const totalHits = Object.values(context.themeCounts).reduce((sum, value) => sum + value, 0);
  const corePrimitiveBonus = ["payment", "routing", "proof", "trust"].some((theme) => context.themeCounts[theme as ThemeName] > 0) ? 0.14 : 0;
  return clamp(
    0.06
      + Math.min(totalHits, 12) * 0.06
      + corePrimitiveBonus
      + context.criteriaCoverage * 0.1
      - (totalHits === 0 ? 0.18 : 0),
    0,
    1
  );
}

function scoreTechnicalCredibility(
  context: ScoreContext,
  contradictions: string[],
  missingProof: string[],
  overclaimSeverity: number
): number {
  const techHits = countPhraseHits(context.supportLower, TECH_TERMS);
  const proofHits = countPhraseHits(context.supportLower, PROOF_TERMS);
  const vagueDensity = countPhraseHits(context.artifactLower, VAGUE_WORDS) / Math.max(context.artifactWords.length, 1);
  return clamp(
    0.12
      + Math.min(techHits, 8) * 0.07
      + Math.min(proofHits, 8) * 0.05
      + (/\b(test|tests|typecheck|build|implementation|openapi|endpoint)\b/i.test(context.supportLower) ? 0.08 : 0)
      - overclaimSeverity * 0.28
      - Math.min(missingProof.length, 4) * 0.1
      - Math.min(contradictions.length, 3) * 0.08
      - vagueDensity * 0.9,
    0,
    1
  );
}

function scoreMarketRelevance(context: ScoreContext): number {
  const marketHits = countPhraseHits(context.supportLower, MARKET_TERMS);
  return clamp(
    0.08
      + Math.min(marketHits, 8) * 0.08
      + context.audienceFit * 0.12
      + context.intendedActionFit * 0.06
      - (marketHits === 0 ? 0.1 : 0),
    0,
    1
  );
}

function scoreNarrativeStrength(
  clarity: number,
  thesisAlignment: number,
  overclaimSeverity: number,
  driftSeverity: number,
  context: ScoreContext
): number {
  const strongFrameHits = countPhraseHits(context.artifactLower, ["trust", "signal", "narrative", "proof", "route", "receipt", "agent"]);
  const compactnessPenalty = context.artifactWords.length > 220 ? 0.12 : 0;
  return clamp(
    0.16
      + clarity * 0.32
      + thesisAlignment * 0.25
      + Math.min(strongFrameHits, 6) * 0.04
      - overclaimSeverity * 0.2
      - driftSeverity * 0.18
      - compactnessPenalty,
    0,
    1
  );
}

function scoreIntelligenceDensity(
  clarity: number,
  specificity: number,
  causalLogic: number,
  thesisAlignment: number,
  technicalCredibility: number,
  context: ScoreContext
): number {
  const wordCount = context.artifactWords.length;
  const fluffPenalty = clamp(
    (countPhraseHits(context.artifactLower, VAGUE_WORDS) * 0.04)
      + (countPhraseHits(context.artifactLower, JARGON_WORDS) * 0.03)
      + Math.max(wordCount - 240, 0) * 0.0012,
    0,
    0.32
  );
  return clamp(
    clarity * 0.18
      + specificity * 0.28
      + causalLogic * 0.18
      + thesisAlignment * 0.16
      + technicalCredibility * 0.2
      + context.criteriaCoverage * 0.06
      - fluffPenalty,
    0,
    1
  );
}

function scoreNarrativeDrift(context: ScoreContext): number {
  const labels = context.sentences.flatMap((sentence) => sentence.themes.slice(0, 1));
  const distinctThemes = new Set(labels).size;
  const adjacentPairs: Array<{ overlap: number; sharesTheme: boolean }> = [];
  for (let index = 1; index < context.sentences.length; index += 1) {
    const previous = context.sentences[index - 1];
    const current = context.sentences[index];
    if (!previous || !current) {
      continue;
    }
    adjacentPairs.push({
      overlap: jaccard(previous.tokens, current.tokens),
      sharesTheme: previous.themes.some((theme) => current.themes.includes(theme))
    });
  }
  const weakTransitions = average(adjacentPairs.map((pair) => pair.overlap < 0.08 && !pair.sharesTheme ? 1 : 0));
  let themeSwitches = 0;
  for (let index = 1; index < context.sentences.length; index += 1) {
    const previousTheme = context.sentences[index - 1]?.themes[0];
    const currentTheme = context.sentences[index]?.themes[0];
    if (previousTheme != null && currentTheme != null && previousTheme !== currentTheme) {
      themeSwitches += 1;
    }
  }
  return clamp(
    (distinctThemes > 3 ? (distinctThemes - 3) * 0.22 : 0)
      + weakTransitions * 0.42
      + themeSwitches * 0.08
      + (context.sentences.length >= 4 && average(adjacentPairs.map((pair) => pair.overlap)) < 0.12 ? 0.14 : 0),
    0,
    1
  );
}

function scoreOverclaiming(context: ScoreContext, missingProof: string[]): { severity: number; phrases: string[] } {
  const phrases = listPresentPhrases(context.artifactLower, OVERCLAIM_PHRASES);
  const absoluteHits = countPhraseHits(context.artifactLower, ABSOLUTE_TERMS);
  const severity = clamp(
    phrases.length * 0.28
      + absoluteHits * 0.08
      + Math.min(missingProof.length, 3) * 0.08,
    0,
    1
  );
  return { severity, phrases };
}

function buildWeakPoints(
  scores: {
    clarity: number;
    internalConsistency: number;
    specificity: number;
    causalLogic: number;
    actionability: number;
    thesisAlignment: number;
    technicalCredibility: number;
    marketRelevance: number;
  },
  context: ScoreContext,
  contradictions: string[],
  missingProof: string[],
  driftLevel: RiskLevel,
  overclaimLevel: RiskLevel
): string[] {
  const weakPoints: string[] = [];
  if (scores.clarity < 0.55) {
    pushUnique(weakPoints, "Clarity is weak: sentence length, hype terms, or compressed phrasing make the artifact hard to parse quickly.");
  }
  if (scores.internalConsistency < 0.62 || contradictions.length > 0) {
    pushUnique(weakPoints, "Internal consistency is fragile: the artifact contains overlapping claims that do not fully agree.");
  }
  if (scores.specificity < 0.55) {
    pushUnique(weakPoints, "Specificity is low: the artifact needs more named systems, endpoints, metrics, or implementation details.");
  }
  if (scores.causalLogic < 0.5) {
    pushUnique(weakPoints, "Causal logic is thin: the artifact states outcomes without clearly showing why they follow.");
  }
  if (scores.actionability < 0.55) {
    pushUnique(weakPoints, "Actionability is weak: a founder or agent cannot tell what to ship, verify, route, or reject next.");
  }
  if (scores.thesisAlignment < 0.55) {
    pushUnique(weakPoints, "Thesis alignment is weak: trust, routing, proof, payment, or signal relevance is not explicit enough.");
  }
  if (scores.technicalCredibility < 0.58 || missingProof.length > 0) {
    pushUnique(weakPoints, "Technical credibility is not strong enough: claims need proof surfaces such as receipts, tests, endpoints, or network evidence.");
  }
  if (scores.marketRelevance < 0.52 && (context.audienceFit < 0.55 || context.intendedActionFit < 0.55)) {
    pushUnique(weakPoints, "Market relevance is underdeveloped: connect the artifact more directly to agents, founders, marketplaces, or distribution.");
  }
  if (driftLevel !== "low") {
    pushUnique(weakPoints, "Narrative drift is elevated: the artifact spans too many themes without a clean bridge between them.");
  }
  if (overclaimLevel === "high") {
    pushUnique(weakPoints, "Overclaiming is too strong: absolute language outruns the available proof.");
  }
  if (context.criteriaCoverage < 0.5) {
    pushUnique(weakPoints, "The artifact does not fully address the requested evaluation criteria.");
  }
  return weakPoints.slice(0, 6);
}

function buildRiskNotes(
  contradictions: string[],
  missingProof: string[],
  driftLevel: RiskLevel,
  contradictionLevel: RiskLevel,
  overclaimLevel: RiskLevel,
  overclaimPhrases: string[]
): string[] {
  const notes: string[] = [];
  if (contradictionLevel !== "low") {
    pushUnique(notes, `Contradiction risk is ${contradictionLevel} because overlapping claims describe materially different states or outcomes.`);
  }
  if (driftLevel !== "low") {
    pushUnique(notes, `Narrative drift is ${driftLevel} because the artifact jumps between themes faster than it resolves them.`);
  }
  if (overclaimLevel !== "low") {
    const phraseDetail = overclaimPhrases.length > 0 ? ` Terms detected: ${overclaimPhrases.join(", ")}.` : "";
    pushUnique(notes, `Overclaiming risk is ${overclaimLevel} because the artifact uses absolute or sweeping language without enough support.${phraseDetail}`);
  }
  if (missingProof.length > 0) {
    pushUnique(notes, "Proof risk is elevated because material adoption, payment, network, or listing claims are not backed by explicit evidence.");
  }
  if (contradictions.length >= 2) {
    pushUnique(notes, "Multiple contradiction signals were detected, so an agent may route this artifact incorrectly.");
  }
  return notes;
}

function buildRecommendedRevision(
  missingProof: string[],
  overclaimLevel: RiskLevel,
  actionability: number,
  context: ScoreContext
): string {
  const clauses: string[] = [];
  if (missingProof.length > 0) {
    clauses.push("Replace unsupported adoption, payment, network, or listing claims with proof-backed language tied to receipts, endpoints, tests, or transaction evidence");
  }
  if (overclaimLevel === "high") {
    clauses.push("soften absolute claims so the artifact promises only what can be verified");
  } else if (overclaimLevel === "medium") {
    clauses.push("tighten certainty language so confidence is proportional to the evidence");
  }
  if (actionability < 0.55) {
    clauses.push("add one concrete next action such as publish, verify, route, test, or reject");
  }
  const paymentOrRoutingRelevant = context.themeCounts.payment > 0 || context.themeCounts.routing > 0 || context.themeCounts.proof > 0;
  const primitiveMissing = paymentOrRoutingRelevant && countPhraseHits(context.artifactLower, ["x402", "payment", "receipt", "route", "routing", "proof"]) === 0;
  if (primitiveMissing) {
    clauses.push("make the payment, proof, or routing primitive explicit so agents know how to trust and route the artifact");
  }
  if (clauses.length === 0) {
    clauses.push("keep the proof-backed framing and move the strongest operational claim into the opening sentence");
  }
  return `${clauses.join("; ")}.`;
}

function infopunksAngle(theme: ThemeName): string {
  switch (theme) {
    case "trust":
      return "Frame the artifact as a trust primitive: state what can be verified, what stays stable, and why an agent should rely on it.";
    case "signal":
      return "Tighten the signal layer: cut noise, surface the key claim, and make the intelligence density obvious on first pass.";
    case "narrative":
      return "Sharpen the narrative spine: keep one thesis, one frame, and one reason the message should compound instead of drift.";
    case "payment":
      return "Make the payment primitive explicit: name the x402 path, pricing surface, and receipt flow so paid usage is machine-actionable.";
    case "routing":
      return "State the routing logic directly: who should receive this, where it should propagate, and what criteria an agent should use to route or reject it.";
    case "proof":
      return "Anchor the artifact in proof surfaces: cite receipts, endpoints, metadata, tests, or network evidence so trust is earned mechanically.";
  }
}

function chooseDecision(
  coherenceScore: number,
  technicalCredibility: number,
  actionability: number,
  contradictionLevel: RiskLevel,
  overclaimLevel: RiskLevel,
  missingProof: string[]
): CoherenceScoreOutput["decision"] {
  if (
    coherenceScore < 50
    || technicalCredibility < 45
    || contradictionLevel === "high"
    || overclaimLevel === "high"
  ) {
    return "high_risk";
  }
  if (
    coherenceScore >= 75
    && technicalCredibility >= 70
    && actionability >= 55
    && contradictionLevel === "low"
    && overclaimLevel === "low"
    && missingProof.length === 0
  ) {
    return "publishable";
  }
  return "revise";
}

export function scoreCoherence(input: CoherenceScoreInput): CoherenceScoreOutput {
  const context = buildScoreContext(input);
  const contradictions = detectContradictions(context.sentences);
  const missingProof = detectMissingProof(context.sentences);
  const driftSeverity = scoreNarrativeDrift(context);
  const driftLevel = riskLevel(driftSeverity);
  const { severity: overclaimSeverity, phrases: overclaimPhrases } = scoreOverclaiming(context, missingProof);
  const overclaimLevel = riskLevel(overclaimSeverity);
  const contradictionSeverity = clamp((contradictions.length * 0.28) + driftSeverity * 0.18, 0, 1);
  const contradictionLevel = riskLevel(contradictionSeverity);

  const clarity = scoreClarity(context);
  const specificity = scoreSpecificity(context);
  const causalLogic = scoreCausalLogic(context);
  const actionability = scoreActionability(context);
  const thesisAlignment = scoreThesisAlignment(context);
  const technicalCredibility = scoreTechnicalCredibility(context, contradictions, missingProof, overclaimSeverity);
  const marketRelevance = scoreMarketRelevance(context);
  const internalConsistency = clamp(
    0.92 - contradictions.length * 0.18 - driftSeverity * 0.12 - (context.sentences.length <= 1 && context.artifactWords.length < 12 ? 0.16 : 0),
    0,
    1
  );
  const narrativeStrength = scoreNarrativeStrength(clarity, thesisAlignment, overclaimSeverity, driftSeverity, context);
  const intelligenceDensity = scoreIntelligenceDensity(
    clarity,
    specificity,
    causalLogic,
    thesisAlignment,
    technicalCredibility,
    context
  );

  const coherenceScore = clamp(
    clarity * 0.11
      + internalConsistency * 0.16
      + specificity * 0.12
      + causalLogic * 0.1
      + actionability * 0.1
      + thesisAlignment * 0.11
      + technicalCredibility * 0.12
      + narrativeStrength * 0.08
      + marketRelevance * 0.1
      + intelligenceDensity * 0.1
      - driftSeverity * 0.05
      - overclaimSeverity * 0.06,
    0,
    1
  );

  const scores = {
    clarity,
    internalConsistency,
    specificity,
    causalLogic,
    actionability,
    thesisAlignment,
    technicalCredibility,
    marketRelevance
  };
  const weakPoints = buildWeakPoints(scores, context, contradictions, missingProof, driftLevel, overclaimLevel);
  const riskNotes = buildRiskNotes(
    contradictions,
    missingProof,
    driftLevel,
    contradictionLevel,
    overclaimLevel,
    overclaimPhrases
  );
  const recommendedRevision = buildRecommendedRevision(missingProof, overclaimLevel, actionability, context);
  const decision = chooseDecision(
    toPercent(coherenceScore),
    toPercent(technicalCredibility),
    toPercent(actionability),
    contradictionLevel,
    overclaimLevel,
    missingProof
  );

  return {
    coherence_score: toPercent(coherenceScore),
    intelligence_density: toPercent(intelligenceDensity),
    clarity: toPercent(clarity),
    internal_consistency: toPercent(internalConsistency),
    specificity: toPercent(specificity),
    causal_logic: toPercent(causalLogic),
    actionability: toPercent(actionability),
    thesis_alignment: toPercent(thesisAlignment),
    technical_credibility: toPercent(technicalCredibility),
    narrative_strength: toPercent(narrativeStrength),
    market_relevance: toPercent(marketRelevance),
    narrative_drift: driftLevel,
    contradiction_risk: contradictionLevel,
    overclaiming_risk: overclaimLevel,
    missing_proof: missingProof,
    contradictions,
    weak_points: weakPoints,
    risk_notes: riskNotes,
    recommended_revision: recommendedRevision,
    infopunks_angle: infopunksAngle(context.dominantTheme),
    decision
  };
}
