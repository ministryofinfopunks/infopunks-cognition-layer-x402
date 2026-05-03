import { normalizeText } from "../common.js";
import { scoreCoherence } from "../coherence/engine.js";
import type {
  DetectedTheme,
  ExtractSignalInput,
  ExtractSignalOutput,
  ExtractSignalOutputType,
  ExtractSignalTone
} from "./schema.js";

type SignalCluster =
  | "paid_distribution"
  | "trust_measurement"
  | "narrative_intelligence"
  | "private_coordination"
  | "launch_coordination";

interface ThemeSpec {
  name: DetectedTheme;
  aliases: string[];
  weight: number;
}

interface ClusterSpec {
  id: SignalCluster;
  themes: DetectedTheme[];
}

interface NoiseRule {
  name: string;
  pattern: RegExp;
}

interface NormalizedSource {
  original: string;
  clean: string;
  normalized: string;
}

const THEME_ORDER: readonly DetectedTheme[] = [
  "x402",
  "agent payments",
  "Base",
  "Bazaar",
  "Agentic.Market",
  "trust",
  "coherence",
  "signal",
  "narrative",
  "proof",
  "receipts",
  "War Room",
  "token launch",
  "privacy",
  "Zcash",
  "Solana",
  "AI agents",
  "marketplaces",
  "routing"
];

const THEME_SPECS: readonly ThemeSpec[] = [
  { name: "x402", aliases: ["x402", "402 paid", "402-paid"], weight: 1.4 },
  { name: "agent payments", aliases: ["agent payments", "payable doors", "paid doors", "paid endpoint", "paid endpoints", "payment rails"], weight: 1.3 },
  { name: "Base", aliases: ["base", "base mainnet"], weight: 1.1 },
  { name: "Bazaar", aliases: ["bazaar", "x402 bazaar"], weight: 1.2 },
  { name: "Agentic.Market", aliases: ["agentic.market", "agentic market"], weight: 1.3 },
  { name: "trust", aliases: ["trust", "trusted", "reliable"], weight: 0.9 },
  { name: "coherence", aliases: ["coherence", "coherent"], weight: 1.0 },
  { name: "signal", aliases: ["signal", "noise", "amplify", "amplifier"], weight: 0.8 },
  { name: "narrative", aliases: ["narrative", "story", "frame", "thesis", "positioning"], weight: 0.9 },
  { name: "proof", aliases: ["proof", "evidence", "verified", "verifiable"], weight: 1.0 },
  { name: "receipts", aliases: ["receipt", "receipts"], weight: 1.1 },
  { name: "War Room", aliases: ["war room", "war-room"], weight: 1.0 },
  { name: "token launch", aliases: ["token launch", "launch", "launch thread", "token rollout"], weight: 0.9 },
  { name: "privacy", aliases: ["privacy", "private", "confidential"], weight: 0.9 },
  { name: "Zcash", aliases: ["zcash", "zec"], weight: 1.2 },
  { name: "Solana", aliases: ["solana", "sol"], weight: 1.0 },
  { name: "AI agents", aliases: ["ai agents", "agents", "agent economy", "agent builders", "agent outputs"], weight: 1.1 },
  { name: "marketplaces", aliases: ["marketplace", "marketplaces", "distribution layer", "listing", "index"], weight: 0.9 },
  { name: "routing", aliases: ["route", "routing", "router", "distribute", "distribution"], weight: 0.9 }
];

const CLUSTER_SPECS: readonly ClusterSpec[] = [
  {
    id: "paid_distribution",
    themes: ["x402", "agent payments", "Base", "Bazaar", "Agentic.Market", "AI agents", "marketplaces", "routing", "receipts", "proof"]
  },
  {
    id: "trust_measurement",
    themes: ["trust", "coherence", "proof", "receipts", "War Room", "signal"]
  },
  {
    id: "narrative_intelligence",
    themes: ["signal", "narrative", "routing", "AI agents", "coherence"]
  },
  {
    id: "private_coordination",
    themes: ["privacy", "Zcash", "trust", "proof", "coherence"]
  },
  {
    id: "launch_coordination",
    themes: ["token launch", "Solana", "narrative", "marketplaces", "routing", "signal"]
  }
];

const NOISE_RULES: readonly NoiseRule[] = [
  {
    name: "generic AI hype",
    pattern: /\b(ai will change everything|ai revolution|superintelligence|agents will replace|future of ai|agentic future)\b/i
  },
  {
    name: "unsupported adoption claims",
    pattern: /\b(everyone is using|mass adoption|widely adopted|all builders|the market has decided|exploding adoption|going mainstream|indexed everywhere|used by everyone)\b/i
  },
  {
    name: "low-signal price talk",
    pattern: /\b(price action|pump|moon|chart|ath|floor price|token price|up only)\b/i
  },
  {
    name: "vague infra language",
    pattern: /\b(next-gen|world-class|scalable infra|modular infra|composable stack|seamless infrastructure|platform layer|infra layer)\b/i
  },
  {
    name: "empty community language",
    pattern: /\b(community vibes|we are so early|movement|culture wave|builders building|good vibes)\b/i
  },
  {
    name: "excessive superlatives",
    pattern: /\b(best|biggest|unprecedented|revolutionary|unmatched|massive|category-defining)\b/i
  }
];

const ADOPTION_CLAIM_PATTERN = /\b(adoption|adopted|widely used|used by|mainstream|integrations?|partners?|indexed|listed|live on|production|mainnet)\b/i;
const PROOF_MARKER_PATTERN = /\b(receipt|receipts|proof|screenshot|metadata|event|hash|log|logs|openapi|test|tests|transaction|tx|callable|response|war room|war-room|integration test)\b/i;
const PRICE_TALK_PATTERN = /\b(price|pump|moon|ath|chart|speculation|token ticker)\b/i;
const ACRONYM_PATTERN = /\b[A-Z]{2,6}\b/g;
const ACRONYM_WHITELIST = new Set(["AI", "API", "USDC", "X402"]);

const CLUSTER_NOISE_DEFAULTS: Record<SignalCluster, string[]> = {
  paid_distribution: ["generic AI hype", "vague infra language"],
  trust_measurement: ["excessive superlatives", "confusing acronyms without context"],
  narrative_intelligence: ["generic AI hype", "empty community language"],
  private_coordination: ["generic AI hype", "low-signal price talk"],
  launch_coordination: ["low-signal price talk", "unsupported adoption claims"]
};

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function asInputArray(value: ExtractSignalInput["input"]): string[] {
  return Array.isArray(value) ? value : [value];
}

function normalizeSources(input: ExtractSignalInput): NormalizedSource[] {
  return asInputArray(input.input).map((entry) => {
    const clean = entry.trim().replace(/\s+/g, " ");
    return {
      original: entry,
      clean,
      normalized: normalizeText(clean)
    };
  });
}

function countOccurrences(text: string, phrase: string): number {
  if (phrase.length === 0) {
    return 0;
  }
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length) {
    const next = text.indexOf(phrase, cursor);
    if (next === -1) {
      break;
    }
    count += 1;
    cursor = next + phrase.length;
  }
  return count;
}

function scoreTheme(spec: ThemeSpec, sources: readonly NormalizedSource[], normalizedContext: string): number {
  let sourceMatches = 0;
  let aliasHits = 0;

  for (const source of sources) {
    let matchedSource = false;
    for (const alias of spec.aliases.map((value) => normalizeText(value))) {
      const hits = countOccurrences(source.normalized, alias);
      if (hits > 0) {
        matchedSource = true;
        aliasHits += hits;
      }
    }
    if (matchedSource) {
      sourceMatches += 1;
    }
  }

  const contextHits = spec.aliases
    .map((value) => normalizeText(value))
    .reduce((total, alias) => total + countOccurrences(normalizedContext, alias), 0);

  if (sourceMatches === 0 && contextHits === 0) {
    return 0;
  }

  return Number((sourceMatches * 2 + aliasHits * 0.45 + contextHits * 1.15 + spec.weight).toFixed(3));
}

function detectThemes(sources: readonly NormalizedSource[], context: string | undefined): DetectedTheme[] {
  const normalizedContext = normalizeText(context ?? "");
  const scores = new Map<DetectedTheme, number>();

  for (const spec of THEME_SPECS) {
    scores.set(spec.name, scoreTheme(spec, sources, normalizedContext));
  }

  const ranked = [...THEME_ORDER]
    .filter((theme) => (scores.get(theme) ?? 0) > 0)
    .sort((left, right) => {
      const scoreDelta = (scores.get(right) ?? 0) - (scores.get(left) ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return THEME_ORDER.indexOf(left) - THEME_ORDER.indexOf(right);
    });

  return ranked.slice(0, 6);
}

function detectNoiseCategories(sources: readonly NormalizedSource[], cluster: SignalCluster, detectedThemes: readonly DetectedTheme[]): string[] {
  const combined = sources.map((source) => source.clean).join(" ");
  const found = new Set<string>();

  for (const rule of NOISE_RULES) {
    if (rule.pattern.test(combined)) {
      found.add(rule.name);
    }
  }

  if (ADOPTION_CLAIM_PATTERN.test(combined) && !PROOF_MARKER_PATTERN.test(combined)) {
    found.add("unsupported adoption claims");
  }

  const acronyms = combined.match(ACRONYM_PATTERN) ?? [];
  const confusingAcronyms = acronyms.filter((value) => !ACRONYM_WHITELIST.has(value));
  if (confusingAcronyms.length >= 2) {
    found.add("confusing acronyms without context");
  }

  const orderedNoise = [
    "generic AI hype",
    "unsupported adoption claims",
    "low-signal price talk",
    "vague infra language",
    "empty community language",
    "excessive superlatives",
    "confusing acronyms without context"
  ].filter((category) => found.has(category));

  if (orderedNoise.length > 0) {
    return orderedNoise.slice(0, 3);
  }

  const defaults = [...CLUSTER_NOISE_DEFAULTS[cluster]];
  if (detectedThemes.includes("AI agents") && !defaults.includes("generic AI hype")) {
    defaults.unshift("generic AI hype");
  }
  return defaults.slice(0, 2);
}

function selectCluster(detectedThemes: readonly DetectedTheme[]): SignalCluster {
  if (detectedThemes.length === 0) {
    return "narrative_intelligence";
  }

  const firstCluster = CLUSTER_SPECS[0];
  let bestCluster: SignalCluster = firstCluster ? firstCluster.id : "narrative_intelligence";
  let bestScore = -1;

  for (const cluster of CLUSTER_SPECS) {
    const score = cluster.themes.reduce((total, theme) => total + (detectedThemes.includes(theme) ? 1 : 0), 0);
    if (score > bestScore) {
      bestCluster = cluster.id;
      bestScore = score;
    }
  }

  return bestCluster;
}

function buildCoreSignal(cluster: SignalCluster, themes: readonly DetectedTheme[]): string {
  const themeSet = new Set(themes);

  switch (cluster) {
    case "paid_distribution":
      if (themeSet.has("Agentic.Market") || themeSet.has("Bazaar") || themeSet.has("marketplaces") || themeSet.has("routing")) {
        return "agent payments are moving from demo primitive to live distribution layer";
      }
      if (themeSet.has("proof") || themeSet.has("receipts") || themeSet.has("trust")) {
        return "paid endpoints become durable when receipts and trust travel with the call";
      }
      return "agents need payable doors, not subscription-shaped workflows";
    case "trust_measurement":
      if (themeSet.has("War Room") || themeSet.has("receipts") || themeSet.has("proof")) {
        return "coherence becomes credible when proof, receipts, and routing stay machine-readable";
      }
      return "coherence and proof are becoming the trust layer for machine output";
    case "narrative_intelligence":
      return "the edge is cleaner signal extraction, not more narrative noise";
    case "private_coordination":
      if (themeSet.has("Zcash")) {
        return "privacy-backed coordination matters when proof must travel without exposing the full graph";
      }
      return "privacy matters when intelligence needs proof without full disclosure";
    case "launch_coordination":
      if (themeSet.has("Solana")) {
        return "launch attention compounds when distribution is fast, legible, and proof-backed";
      }
      return "token launches win when narrative discipline outruns speculative noise";
  }
}

function buildCausalSpine(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "distribution becomes native once payment, proof, and routing are machine-readable";
    case "trust_measurement":
      return "trust compounds when coherence can be checked instead of inferred";
    case "narrative_intelligence":
      return "agents route what they can parse and reject what feels noisy";
    case "private_coordination":
      return "verifiable privacy outperforms total opacity or total exposure";
    case "launch_coordination":
      return "narrative discipline survives longer than speculative attention";
  }
}

function buildProofHook(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "Receipts make the claim legible enough for the agent economy to route it.";
    case "trust_measurement":
      return "Proof turns trust from a vibe into machinery.";
    case "narrative_intelligence":
      return "Compression matters because agents only route what they can parse quickly.";
    case "private_coordination":
      return "The proof surface has to stay usable without exposing the full graph.";
    case "launch_coordination":
      return "Narrative only compounds when proof survives first contact.";
  }
}

function buildRisk(cluster: SignalCluster, riskNotes: readonly string[]): string {
  const firstRisk = riskNotes[0];
  if (firstRisk) {
    return firstRisk;
  }

  switch (cluster) {
    case "paid_distribution":
      return "Distribution claims can outrun proof if listings, paid calls, or buyer activity are not visible.";
    case "trust_measurement":
      return "Trust language gets ignored when proof and receipts stay abstract.";
    case "narrative_intelligence":
      return "The message can drift into content volume instead of usable signal.";
    case "private_coordination":
      return "Privacy claims can read as opacity if the proof path is not explicit.";
    case "launch_coordination":
      return "Launch energy can collapse into price chatter before the product claim lands.";
  }
}

function buildMitigation(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "Ship a receipt-backed proof surface, cite the distribution venue, and name the exact paid call.";
    case "trust_measurement":
      return "Anchor the claim in coherence scoring, receipts, and a visible proof page before amplification.";
    case "narrative_intelligence":
      return "Compress the thesis into one live signal, then route it with proof instead of commentary volume.";
    case "private_coordination":
      return "Show what is verifiable, what stays private, and how the proof boundary works.";
    case "launch_coordination":
      return "Lead with product behavior, proof, and next action before anyone reaches for price language.";
  }
}

function buildOpportunity(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "Turn a callable endpoint into a distribution surface that buyers and agents can both verify.";
    case "trust_measurement":
      return "Make trust measurable enough for operators and agents to route the claim mechanically.";
    case "narrative_intelligence":
      return "Strip the message to one high-density claim that survives fast routing environments.";
    case "private_coordination":
      return "Offer privacy without losing legibility, which is rare in machine-callable systems.";
    case "launch_coordination":
      return "Convert attention into durable positioning before speculation sets the frame.";
  }
}

function buildNextAction(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "Publish one paid call, attach the receipt, and route the proof into the highest-signal distribution channel.";
    case "trust_measurement":
      return "Score the artifact, publish the receipt surface, and use the result in the next War Room update.";
    case "narrative_intelligence":
      return "Ship the compressed thesis, test it in one channel, and keep only the version that stays legible.";
    case "private_coordination":
      return "Publish the proof boundary in plain language before making stronger privacy claims.";
    case "launch_coordination":
      return "Lead the launch with proof, positioning, and a clear next action before broader amplification.";
  }
}

function buildMemePhrase(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "paid doors, not dashboards";
    case "trust_measurement":
      return "proof beats vibes";
    case "narrative_intelligence":
      return "signal is the product";
    case "private_coordination":
      return "proof without leakage";
    case "launch_coordination":
      return "narrative before candles";
  }
}

function buildVisualDirection(cluster: SignalCluster): string {
  switch (cluster) {
    case "paid_distribution":
      return "A steel service door with a receipt printer where the keyhole should be, feeding into routing arrows.";
    case "trust_measurement":
      return "A signal meter snapping from static into a stamped receipt and proof badge.";
    case "narrative_intelligence":
      return "A dense wall of posts collapsing into one clean signal line that machines can route.";
    case "private_coordination":
      return "A privacy screen with a narrow proof aperture showing only the verified edge.";
    case "launch_coordination":
      return "A launchpad where charts fade into a clean thesis card with one verified indicator.";
  }
}

function buildDistributionAngle(
  outputType: ExtractSignalOutputType,
  themes: readonly DetectedTheme[]
): string {
  const themeSet = new Set(themes);

  switch (outputType) {
    case "founder_post":
      if (themeSet.has("War Room")) {
        return "X post with a War Room screenshot and a paid-call receipt.";
      }
      if (themeSet.has("Agentic.Market") || themeSet.has("Bazaar")) {
        return "X post with Bazaar or Agentic.Market metadata plus a paid-call receipt.";
      }
      return "X post with a paid-call receipt or proof screenshot.";
    case "thesis":
      if (themeSet.has("Agentic.Market") || themeSet.has("Bazaar")) {
        return "Docs page or Bazaar metadata block backed by proof.";
      }
      return "Docs page or launch thread opener backed by proof.";
    case "risk_signal":
      return "War Room event or founder reply that states the mitigation before wider distribution.";
    case "meme_angle":
      return "Launch thread visual or founder reply card with one proof-backed caption.";
    case "briefing":
      return "War Room event with receipt context and a next-action checklist.";
    case "launch_copy":
      return "Docs page, Bazaar metadata, or launch thread with proof attached.";
  }
}

function buildRecommendedUse(
  outputType: ExtractSignalOutputType,
  riskNotes: readonly string[],
  audience: string | undefined
): string {
  const audienceSuffix = audience ? ` for ${audience}` : "";
  const proofQualifier = riskNotes.length > 0 ? " after adding proof" : "";

  switch (outputType) {
    case "founder_post":
      return `Use as an X post${audienceSuffix}${proofQualifier} and after proving the endpoint is callable.`;
    case "thesis":
      return `Use in a memo, docs page, or deck opener${audienceSuffix}${proofQualifier}.`;
    case "risk_signal":
      return `Use in an internal operator brief${audienceSuffix} before making stronger public claims.`;
    case "meme_angle":
      return `Use as creative direction${audienceSuffix} for a launch visual or reply asset${proofQualifier}.`;
    case "briefing":
      return `Use in the next War Room or launch review${audienceSuffix}.`;
    case "launch_copy":
      return `Use on the docs page, Bazaar metadata, or launch thread${audienceSuffix}${proofQualifier}.`;
  }
}

function buildArtifactPair(
  outputType: ExtractSignalOutputType,
  tone: ExtractSignalTone,
  coreSignal: string,
  cluster: SignalCluster,
  riskNotes: readonly string[]
): Pick<ExtractSignalOutput, "artifact" | "amplified_artifact"> {
  const proofHook = buildProofHook(cluster);
  const capitalizedSignal = capitalize(coreSignal);
  const thesisSpine = buildCausalSpine(cluster);
  const risk = buildRisk(cluster, riskNotes);
  const mitigation = buildMitigation(cluster);
  const memePhrase = buildMemePhrase(cluster);
  const visualDirection = buildVisualDirection(cluster);
  const opportunity = buildOpportunity(cluster);
  const nextAction = buildNextAction(cluster);

  if (outputType === "founder_post") {
    if (tone === "infopunks") {
      return {
        artifact: `agents do not need subscriptions. they need paid doors. ${coreSignal}.`,
        amplified_artifact: `agents do not need subscriptions. they need paid doors. ${coreSignal}. ${proofHook.toLowerCase()}`
      };
    }
    if (tone === "technical") {
      return {
        artifact: `${capitalizedSignal}. Keep the receipt path and routing metadata explicit.`,
        amplified_artifact: `${capitalizedSignal}. Keep the receipt path and routing metadata explicit. ${proofHook}`
      };
    }
    if (tone === "market") {
      return {
        artifact: `${capitalizedSignal}. Markets reward the proof layer, not vague infra language.`,
        amplified_artifact: `${capitalizedSignal}. Markets reward the proof layer, not vague infra language. ${proofHook}`
      };
    }
    return {
      artifact: `${capitalizedSignal}. Ship the proof and let distribution compound.`,
      amplified_artifact: `${capitalizedSignal}. Ship the proof and let distribution compound. ${proofHook}`
    };
  }

  if (outputType === "thesis") {
    return {
      artifact: `Thesis: ${capitalizedSignal} because ${thesisSpine}.`,
      amplified_artifact: `Thesis: ${capitalizedSignal} because ${thesisSpine}. ${proofHook}`
    };
  }

  if (outputType === "risk_signal") {
    return {
      artifact: `Risk: ${risk} Mitigation: ${mitigation}`,
      amplified_artifact: `Signal: ${capitalizedSignal}. Risk: ${risk} Mitigation: ${mitigation}`
    };
  }

  if (outputType === "meme_angle") {
    return {
      artifact: `Phrase: "${memePhrase}". Visual: ${visualDirection}`,
      amplified_artifact: `Phrase: "${memePhrase}". Caption: ${capitalizedSignal}. Visual direction: ${visualDirection}`
    };
  }

  if (outputType === "briefing") {
    return {
      artifact: `Situation: ${capitalizedSignal}. Opportunity: ${opportunity} Risk: ${risk} Next action: ${nextAction}`,
      amplified_artifact: `Situation: ${capitalizedSignal}. Opportunity: ${opportunity} Risk: ${risk} Mitigation: ${mitigation} Next action: ${nextAction}`
    };
  }

  if (tone === "infopunks") {
    return {
      artifact: "POST /v1/extract-signal strips noise, names the live signal, and returns an artifact you can actually route.",
      amplified_artifact: `POST /v1/extract-signal strips noise, names the live signal, and returns an artifact you can actually route. ${capitalizedSignal}. ${proofHook}`
    };
  }

  return {
    artifact: "POST /v1/extract-signal turns raw noise into usable cultural intelligence and returns an artifact you can publish, route, or ship.",
    amplified_artifact: `POST /v1/extract-signal turns raw noise into usable cultural intelligence and returns an artifact you can publish, route, or ship. ${capitalizedSignal}. ${proofHook}`
  };
}

function buildRiskNotes(
  sources: readonly NormalizedSource[],
  detectedThemes: readonly DetectedTheme[],
  cluster: SignalCluster
): string[] {
  const combined = sources.map((source) => source.clean).join(" ");
  const notes: string[] = [];
  const themeSet = new Set(detectedThemes);

  if (ADOPTION_CLAIM_PATTERN.test(combined) && !PROOF_MARKER_PATTERN.test(combined)) {
    notes.push("Adoption or listing claims need proof such as receipt volume, listing metadata, or named integrations.");
  }

  if (PRICE_TALK_PATTERN.test(combined)) {
    notes.push("Price chatter weakens the usable claim; lead with product behavior, routing, or proof instead.");
  }

  const acronyms = combined.match(ACRONYM_PATTERN) ?? [];
  const confusingAcronyms = acronyms.filter((value) => !ACRONYM_WHITELIST.has(value));
  if (confusingAcronyms.length >= 2) {
    notes.push("Expand ambiguous acronyms before distribution so agents and non-insiders can route the claim safely.");
  }

  if ((themeSet.has("x402") || themeSet.has("Agentic.Market") || themeSet.has("Bazaar")) && !PROOF_MARKER_PATTERN.test(combined)) {
    notes.push("If this claim is meant for external distribution, attach a receipt, proof screenshot, or War Room event.");
  }

  if (detectedThemes.length <= 1) {
    notes.push("The theme cluster is thin; tighten the artifact around one stronger live signal before wider distribution.");
  }

  if (cluster === "launch_coordination" && !PRICE_TALK_PATTERN.test(combined)) {
    notes.push("Keep launch language anchored in product behavior so speculative attention does not set the frame.");
  }

  return notes.slice(0, 3);
}

function buildCoherenceArtifact(result: Pick<ExtractSignalOutput, "core_signal" | "artifact" | "amplified_artifact" | "distribution_angle" | "recommended_use">): string {
  return [
    ensureSentence(result.core_signal),
    ensureSentence(result.artifact),
    ensureSentence(result.amplified_artifact),
    ensureSentence(result.distribution_angle),
    ensureSentence(result.recommended_use)
  ].join(" ");
}

export function extractSignal(input: ExtractSignalInput): ExtractSignalOutput {
  const sources = normalizeSources(input);
  const detectedThemes = detectThemes(sources, input.context);
  const cluster = selectCluster(detectedThemes);
  const coreSignal = buildCoreSignal(cluster, detectedThemes);
  const noiseRemoved = detectNoiseCategories(sources, cluster, detectedThemes);
  const riskNotes = buildRiskNotes(sources, detectedThemes, cluster);
  const artifactPair = buildArtifactPair(input.output_type, input.tone, coreSignal, cluster, riskNotes);
  const distributionAngle = buildDistributionAngle(input.output_type, detectedThemes);
  const recommendedUse = buildRecommendedUse(input.output_type, riskNotes, input.audience);

  const coherence = scoreCoherence({
    artifact: buildCoherenceArtifact({
      core_signal: coreSignal,
      artifact: artifactPair.artifact,
      amplified_artifact: artifactPair.amplified_artifact,
      distribution_angle: distributionAngle,
      recommended_use: recommendedUse
    }),
    context: input.context,
    audience: input.audience,
    intended_action: recommendedUse
  });

  return {
    core_signal: coreSignal,
    noise_removed: noiseRemoved,
    recommended_artifact: input.output_type,
    artifact: artifactPair.artifact,
    amplified_artifact: artifactPair.amplified_artifact,
    distribution_angle: distributionAngle,
    recommended_use: recommendedUse,
    coherence_score: coherence.coherence_score,
    risk_notes: riskNotes,
    detected_themes: detectedThemes
  };
}
