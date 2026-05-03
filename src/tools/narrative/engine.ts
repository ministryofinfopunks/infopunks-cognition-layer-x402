import { clamp } from "../common.js";
import type {
  NarrativeRiskTolerance,
  NarrativeSimulationPath,
  SimulateNarrativeInput,
  SimulateNarrativeOutput
} from "./schema.js";

type ArchetypeName =
  | "Infrastructure Pull"
  | "Spec Confusion"
  | "Viral Proof Moment"
  | "Trust Bottleneck"
  | "Narrative Exhaustion"
  | "Developer Adoption"
  | "Market Reflexivity";

interface SimulationContext {
  narrative: string;
  timeHorizon: string;
  perspectiveLabel: string;
  riskTolerance: NarrativeRiskTolerance;
  lower: string;
  proofPresent: boolean;
  proofMentions: number;
  infrastructureMentions: number;
  protocolMentions: number;
  launchMentions: number;
  trustMentions: number;
  developerMentions: number;
  marketMentions: number;
  overclaimMentions: number;
  ambiguityMentions: number;
  multiEcosystem: boolean;
}

interface RankedArchetype {
  name: ArchetypeName;
  order: number;
  rawScore: number;
  evidenceCount: number;
  probability?: number;
}

const INFRASTRUCTURE_TERMS = [
  "x402", "agent", "agents", "base", "api", "apis", "endpoint", "endpoints", "payment", "payments",
  "paid", "marketplace", "marketplaces", "bazaar", "routing", "route", "routes"
] as const;

const SPEC_TERMS = [
  "protocol", "protocols", "discovery", "metadata", "standard", "standards", "wallet", "wallets",
  "settlement", "schema", "schemas", "spec", "specs", "ecosystem", "ecosystems"
] as const;

const VIRAL_TERMS = [
  "receipt", "receipts", "screenshot", "screenshots", "war room", "proof", "public proof",
  "launch", "twitter", "attention", "viral", "shareable", "paid call", "bazaar metadata", "x "
] as const;

const TRUST_TERMS = [
  "trust", "verify", "verification", "reputation", "claims", "claim", "routing", "execution",
  "capital", "buyer", "buyers", "marketplace", "marketplaces", "agent", "agents"
] as const;

const EXHAUSTION_TERMS = [
  "hype", "unstoppable", "guaranteed", "everyone", "inevitable", "revolutionary", "world-changing",
  "changes everything", "replaces everything", "massive", "breakthrough", "default layer", "cannot fail"
] as const;

const DEVELOPER_TERMS = [
  "sdk", "sdks", "docs", "documentation", "example", "examples", "openapi", "integration",
  "integrations", "github", "curl", "schema", "schemas", "plugin", "plugins", "builder", "builders"
] as const;

const MARKET_TERMS = [
  "token", "liquidity", "price", "ct", "memecoin", "launch", "trading", "volume", "speculation",
  "ticker", "fdv", "attention"
] as const;

const AMBIGUITY_TERMS = [
  "unclear", "confusing", "ambiguous", "maybe", "might", "could", "sort of", "kind of", "broadly"
] as const;

const PROOF_TERMS = [
  "receipt", "receipts", "proof", "screenshot", "screenshots", "war room", "paid call",
  "bazaar metadata", "proof page", "event", "events", "hash"
] as const;

const ECOSYSTEM_TERMS = [
  "base", "ethereum", "solana", "bitcoin", "evm", "wallet", "wallets", "marketplace", "marketplaces"
] as const;

const WATCH_SIGNALS = [
  "marketplace indexing",
  "paid call receipts",
  "developer integrations",
  "repeated language on X",
  "forks/copycats",
  "failed settlement complaints",
  "confusion about metadata",
  "growth of agent-callable endpoints"
] as const;

function countHits(text: string, terms: readonly string[]): number {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function shortNarrative(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 120) {
    return collapsed;
  }
  return `${collapsed.slice(0, 117)}...`;
}

function perspectiveLabel(value: string | undefined): string {
  if (!value) {
    return "operator";
  }
  const lower = value.toLowerCase();
  if (lower.includes("builder") || lower.includes("developer")) {
    return "builder";
  }
  if (lower.includes("investor") || lower.includes("trader") || lower.includes("market")) {
    return "market";
  }
  if (lower.includes("community") || lower.includes("creator")) {
    return "community";
  }
  if (lower.includes("founder") || lower.includes("operator")) {
    return "operator";
  }
  return value.trim();
}

function buildContext(input: SimulateNarrativeInput): SimulationContext {
  const corpus = [input.narrative, input.market_context ?? "", input.perspective ?? ""]
    .filter((value) => value.length > 0)
    .join(" ");
  const lower = corpus.toLowerCase();
  const ecosystemHits = ECOSYSTEM_TERMS.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);

  return {
    narrative: input.narrative.trim(),
    timeHorizon: input.time_horizon,
    perspectiveLabel: perspectiveLabel(input.perspective),
    riskTolerance: input.risk_tolerance,
    lower,
    proofPresent: PROOF_TERMS.some((term) => lower.includes(term)),
    proofMentions: countHits(lower, PROOF_TERMS),
    infrastructureMentions: countHits(lower, INFRASTRUCTURE_TERMS),
    protocolMentions: countHits(lower, SPEC_TERMS),
    launchMentions: countHits(lower, VIRAL_TERMS),
    trustMentions: countHits(lower, TRUST_TERMS),
    developerMentions: countHits(lower, DEVELOPER_TERMS),
    marketMentions: countHits(lower, MARKET_TERMS),
    overclaimMentions: countHits(lower, EXHAUSTION_TERMS),
    ambiguityMentions: countHits(lower, AMBIGUITY_TERMS),
    multiEcosystem: ecosystemHits >= 2
  };
}

function riskBias(context: SimulationContext, lowDelta: number, highDelta: number): number {
  if (context.riskTolerance === "low") {
    return lowDelta;
  }
  if (context.riskTolerance === "high") {
    return highDelta;
  }
  return 0;
}

function rawArchetypeScores(context: SimulationContext): RankedArchetype[] {
  const proofAbsentPenalty = context.proofPresent ? 0 : 0.16;
  const infrastructure = 0.2
    + context.infrastructureMentions * 0.09
    + context.launchMentions * 0.02
    + riskBias(context, 0.04, -0.01);
  const spec = 0.16
    + context.protocolMentions * 0.1
    + context.ambiguityMentions * 0.06
    + (context.multiEcosystem ? 0.16 : 0)
    + (context.infrastructureMentions > 0 && context.protocolMentions > 0 ? 0.04 : 0);
  const viral = 0.14
    + context.launchMentions * 0.09
    + context.proofMentions * 0.1
    + (context.proofPresent ? 0.08 : 0)
    - proofAbsentPenalty
    + riskBias(context, -0.05, 0.05);
  const trust = 0.18
    + context.trustMentions * 0.08
    + context.infrastructureMentions * 0.03
    + riskBias(context, 0.03, -0.01);
  const exhaustion = 0.1
    + context.overclaimMentions * 0.12
    + context.ambiguityMentions * 0.04
    + (!context.proofPresent && context.overclaimMentions > 0 ? 0.12 : 0)
    + riskBias(context, 0.02, 0.04);
  const developer = 0.16
    + context.developerMentions * 0.1
    + context.infrastructureMentions * 0.03
    + context.proofMentions * 0.02
    + riskBias(context, 0.03, -0.01);
  const market = 0.11
    + context.marketMentions * 0.11
    + context.launchMentions * 0.04
    + context.overclaimMentions * 0.02
    + riskBias(context, -0.05, 0.07);

  return [
    {
      name: "Infrastructure Pull",
      order: 0,
      rawScore: infrastructure,
      evidenceCount: context.infrastructureMentions
    },
    {
      name: "Spec Confusion",
      order: 1,
      rawScore: spec,
      evidenceCount: context.protocolMentions + context.ambiguityMentions + (context.multiEcosystem ? 1 : 0)
    },
    {
      name: "Viral Proof Moment",
      order: 2,
      rawScore: viral,
      evidenceCount: context.launchMentions + context.proofMentions
    },
    {
      name: "Trust Bottleneck",
      order: 3,
      rawScore: trust,
      evidenceCount: context.trustMentions
    },
    {
      name: "Narrative Exhaustion",
      order: 4,
      rawScore: exhaustion,
      evidenceCount: context.overclaimMentions + context.ambiguityMentions
    },
    {
      name: "Developer Adoption",
      order: 5,
      rawScore: developer,
      evidenceCount: context.developerMentions
    },
    {
      name: "Market Reflexivity",
      order: 6,
      rawScore: market,
      evidenceCount: context.marketMentions
    }
  ];
}

function selectArchetypes(context: SimulationContext): RankedArchetype[] {
  const ranked = rawArchetypeScores(context)
    .map((entry) => ({ ...entry, rawScore: clamp(entry.rawScore, 0.05, 5) }))
    .sort((left, right) => (right.rawScore - left.rawScore) || (left.order - right.order));

  let selected = ranked
    .filter((entry) => entry.evidenceCount > 0 || entry.rawScore >= 0.33)
    .slice(0, 5);

  if (selected.length < 3) {
    selected = ranked.slice(0, 3);
  }

  if (selected.length > 5) {
    selected = selected.slice(0, 5);
  }

  const total = selected.reduce((sum, entry) => sum + entry.rawScore, 0);
  const rounded = selected.map((entry) => Number((entry.rawScore / total).toFixed(4)));
  const remainder = Number((1 - rounded.reduce((sum, value) => sum + value, 0)).toFixed(4));
  rounded[0] = Number(((rounded[0] ?? 0) + remainder).toFixed(4));

  return selected.map((entry, index) => {
    const probability = rounded[index] ?? 0;
    return {
      ...entry,
      probability
    };
  });
}

function pathDrivers(name: ArchetypeName, context: SimulationContext): string[] {
  const drivers: string[] = [];

  if (name === "Infrastructure Pull") {
    pushUnique(drivers, "x402 paid routing");
    pushUnique(drivers, "agent-callable endpoints");
    if (context.lower.includes("base")) {
      pushUnique(drivers, "Base settlement");
    }
    pushUnique(drivers, "repeatable API behavior");
    if (context.lower.includes("marketplace") || context.lower.includes("bazaar")) {
      pushUnique(drivers, "marketplace distribution");
    }
  }

  if (name === "Spec Confusion") {
    pushUnique(drivers, "multiple protocol interpretations");
    pushUnique(drivers, "metadata ambiguity");
    if (context.multiEcosystem) {
      pushUnique(drivers, "cross-ecosystem language drift");
    }
    pushUnique(drivers, "unclear settlement or discovery expectations");
  }

  if (name === "Viral Proof Moment") {
    pushUnique(drivers, "public proof artifacts");
    pushUnique(drivers, "shareable paid-call receipts");
    pushUnique(drivers, "launch attention");
    if (context.lower.includes("war room")) {
      pushUnique(drivers, "War Room visibility");
    }
  }

  if (name === "Trust Bottleneck") {
    pushUnique(drivers, "trust-sensitive routing");
    pushUnique(drivers, "payment verification");
    pushUnique(drivers, "reputation effects");
    if (context.lower.includes("claim")) {
      pushUnique(drivers, "claim verification pressure");
    }
  }

  if (name === "Narrative Exhaustion") {
    pushUnique(drivers, "hype-heavy framing");
    pushUnique(drivers, "claim/proof mismatch");
    pushUnique(drivers, "audience fatigue");
    if (!context.proofPresent) {
      pushUnique(drivers, "missing public evidence");
    }
  }

  if (name === "Developer Adoption") {
    pushUnique(drivers, "OpenAPI clarity");
    pushUnique(drivers, "copy-paste examples");
    pushUnique(drivers, "integration references");
    if (context.lower.includes("github")) {
      pushUnique(drivers, "GitHub implementation trails");
    }
  }

  if (name === "Market Reflexivity") {
    pushUnique(drivers, "attention-price feedback loops");
    pushUnique(drivers, "trader repetition on CT");
    pushUnique(drivers, "launch volatility");
    pushUnique(drivers, "speculative positioning");
  }

  return drivers.slice(0, 4);
}

function pathRisks(name: ArchetypeName, context: SimulationContext): string[] {
  const risks: string[] = [];

  if (!context.proofPresent && (name === "Viral Proof Moment" || name === "Developer Adoption" || name === "Infrastructure Pull")) {
    pushUnique(risks, "proof is too thin for a high-conviction path");
  }

  if (name === "Infrastructure Pull") {
    pushUnique(risks, "marketplace metadata can drift");
    pushUnique(risks, "trust breaks if settlement complaints rise");
    pushUnique(risks, "distribution stalls if the endpoint is not visibly useful");
  }

  if (name === "Spec Confusion") {
    pushUnique(risks, "fragmentation slows understanding");
    pushUnique(risks, "different ecosystems tell different versions of the story");
    pushUnique(risks, "buyers hesitate if metadata is inconsistent");
  }

  if (name === "Viral Proof Moment") {
    pushUnique(risks, "attention outruns integration depth");
    pushUnique(risks, "screenshots age faster than infrastructure");
    pushUnique(risks, "copycats strip away the payment or proof layer");
  }

  if (name === "Trust Bottleneck") {
    pushUnique(risks, "claims outrun verification");
    pushUnique(risks, "failed settlement complaints block trust");
    pushUnique(risks, "reputation takes longer to compound than attention");
  }

  if (name === "Narrative Exhaustion") {
    pushUnique(risks, "audience rejects the thesis as overclaimed");
    pushUnique(risks, "skeptics define the narrative before proof lands");
    pushUnique(risks, "future launches inherit credibility debt");
  }

  if (name === "Developer Adoption") {
    pushUnique(risks, "docs drift from runtime behavior");
    pushUnique(risks, "integration friction reduces follow-through");
    pushUnique(risks, "proof stays anecdotal without real builders shipping");
  }

  if (name === "Market Reflexivity") {
    pushUnique(risks, "price leads utility");
    pushUnique(risks, "volatility rewrites the story faster than product progress");
    pushUnique(risks, "speculative demand masks settlement or trust failures");
  }

  return risks.slice(0, 4);
}

function pathOpportunity(name: ArchetypeName): string {
  if (name === "Infrastructure Pull") {
    return "Package the narrative as a stable paid primitive that agents can call, verify, and route without reinterpretation.";
  }
  if (name === "Spec Confusion") {
    return "Win by collapsing the story into one canonical interface, one proof surface, and one metadata layer.";
  }
  if (name === "Viral Proof Moment") {
    return "Turn one high-signal paid call into a proof object that compresses understanding for both humans and agents.";
  }
  if (name === "Trust Bottleneck") {
    return "Use trust artifacts to make adoption safer before asking the market for amplification.";
  }
  if (name === "Narrative Exhaustion") {
    return "Reset the story around evidence so the primitive survives even if the original hype frame dies.";
  }
  if (name === "Developer Adoption") {
    return "Convert narrative curiosity into implementation throughput with examples that are trivial to test.";
  }
  return "Separate utility from price and use proof to keep speculative attention from becoming the whole story.";
}

function pathPositioning(name: ArchetypeName, context: SimulationContext): string {
  const lens = context.perspectiveLabel;
  if (name === "Infrastructure Pull") {
    return `For the ${lens} lens, lead with the endpoint, price, receipt flow, and one canonical explanation of why the behavior becomes easier.`;
  }
  if (name === "Spec Confusion") {
    return `For the ${lens} lens, simplify the language, pin one vocabulary, and publish canonical metadata plus proof before expanding the claim surface.`;
  }
  if (name === "Viral Proof Moment") {
    return `For the ${lens} lens, show the paid call, the output, and the War Room artifact in one shareable frame.`;
  }
  if (name === "Trust Bottleneck") {
    return `For the ${lens} lens, keep claims narrow and route the highest-stakes assertions through the Trust Layer.`;
  }
  if (name === "Narrative Exhaustion") {
    return `For the ${lens} lens, lower the claim temperature and replace slogans with receipts, integrations, and exact behavior.`;
  }
  if (name === "Developer Adoption") {
    return `For the ${lens} lens, treat the story as a developer primitive first: docs, examples, exact request body, and stable receipts.`;
  }
  return `For the ${lens} lens, separate narrative utility from price action and avoid letting speculation become the primary explanation.`;
}

function pathDescription(name: ArchetypeName, context: SimulationContext): string {
  const subject = shortNarrative(context.narrative);
  if (name === "Infrastructure Pull") {
    return `Over ${context.timeHorizon}, "${subject}" compounds because practical infrastructure makes the behavior operationally easier to repeat.`;
  }
  if (name === "Spec Confusion") {
    return `Over ${context.timeHorizon}, "${subject}" slows because competing standards, discovery frames, or metadata assumptions fragment understanding.`;
  }
  if (name === "Viral Proof Moment") {
    return `Over ${context.timeHorizon}, "${subject}" gets a step-change in attention if one visible proof artifact makes the behavior socially legible.`;
  }
  if (name === "Trust Bottleneck") {
    return `Over ${context.timeHorizon}, "${subject}" remains gated by whether buyers, agents, and marketplaces trust the claim surface and verification flow.`;
  }
  if (name === "Narrative Exhaustion") {
    return `Over ${context.timeHorizon}, "${subject}" decays if audience energy turns against claims that feel larger than the available proof.`;
  }
  if (name === "Developer Adoption") {
    return `Over ${context.timeHorizon}, "${subject}" grows when builders can integrate it from docs, examples, and GitHub-visible implementation trails.`;
  }
  return `Over ${context.timeHorizon}, "${subject}" becomes reflexive if attention, price action, or speculative chatter start reinforcing the narrative faster than the product can ground it.`;
}

function buildPath(entry: RankedArchetype, context: SimulationContext): NarrativeSimulationPath {
  return {
    name: entry.name,
    probability: entry.probability ?? 0,
    description: pathDescription(entry.name, context),
    drivers: pathDrivers(entry.name, context),
    risks: pathRisks(entry.name, context),
    opportunity: pathOpportunity(entry.name),
    recommended_positioning: pathPositioning(entry.name, context)
  };
}

function recommendedAction(name: ArchetypeName): string {
  if (name === "Infrastructure Pull") {
    return "Ship the endpoint, publish docs, and show a paid receipt.";
  }
  if (name === "Spec Confusion") {
    return "Simplify the language and publish canonical metadata plus proof.";
  }
  if (name === "Viral Proof Moment") {
    return "Create shareable proof cards and War Room screenshots.";
  }
  if (name === "Trust Bottleneck") {
    return "Route the narrative through Trust Layer.";
  }
  if (name === "Narrative Exhaustion") {
    return "Reduce claims and increase evidence.";
  }
  if (name === "Developer Adoption") {
    return "Publish SDK examples and copy-paste curl commands.";
  }
  return "Separate utility from price, publish proof early, and monitor settlement complaints closely.";
}

function infopunksAngle(name: ArchetypeName, context: SimulationContext): string {
  if (name === "Infrastructure Pull") {
    return "The narrative wins when it becomes a machine-usable primitive: stable endpoint, canonical metadata, paid receipts, and proof that agents can route without reinterpretation.";
  }
  if (name === "Spec Confusion") {
    return "The leverage is not louder language; it is one canonical metadata surface, one proof trail, and one vocabulary that both humans and agents can call consistently.";
  }
  if (name === "Viral Proof Moment") {
    return "Infopunks should turn proof into distribution: the best narrative artifact is a receipt-backed output that compresses belief into one glance.";
  }
  if (name === "Trust Bottleneck") {
    return "Trust is the routing layer. If the claim matters, the narrative should inherit verification, reputation, and receipt discipline before amplification.";
  }
  if (name === "Narrative Exhaustion") {
    return "Kill the hype, keep the primitive. Agents reward deterministic evidence more than expansive positioning language.";
  }
  if (name === "Developer Adoption") {
    return "Agent adoption compounds when the story collapses into docs, examples, and stable receipts instead of staying at the slogan layer.";
  }
  return context.marketMentions > 0
    ? "When the narrative turns price-adjacent, keep the machine-usable proof surface ahead of speculation so agents route utility instead of momentum."
    : "When attention outruns the product, keep receipts, proof, and canonical metadata ahead of the chatter.";
}

function riskNotes(context: SimulationContext, winningPath: ArchetypeName): string[] {
  const notes: string[] = [];

  if (!context.proofPresent) {
    pushUnique(notes, "Proof-sensitive paths are discounted because the narrative does not mention receipts, screenshots, War Room evidence, paid calls, or Bazaar metadata.");
  }

  if (context.multiEcosystem || context.protocolMentions > 1) {
    pushUnique(notes, "Multiple protocol, metadata, or settlement layers increase confusion risk unless one canonical interpretation is published.");
  }

  if (context.overclaimMentions > 0) {
    pushUnique(notes, "Hype-heavy or absolute language raises rejection risk when claims outrun visible evidence.");
  }

  if (context.marketMentions > 0) {
    pushUnique(notes, "Price-led attention can reverse quickly and may obscure whether the underlying behavior is actually repeatable.");
  }

  if (context.riskTolerance === "low") {
    pushUnique(notes, "Low risk tolerance favors infrastructure, proof, and trust surfaces over virality or speculative momentum.");
  }

  if (context.riskTolerance === "high") {
    pushUnique(notes, "High risk tolerance can increase the chance that attention compounds, but it also magnifies copycat and trust-failure risk.");
  }

  pushUnique(notes, `Deterministic simulation is directional rather than prophetic; validate the ${winningPath} thesis against live receipts, integrations, and settlement quality.`);

  return notes.slice(0, 5);
}

export function simulateNarrative(input: SimulateNarrativeInput): SimulateNarrativeOutput {
  const context = buildContext(input);
  const ranked = selectArchetypes(context);
  const paths = ranked.map((entry) => buildPath(entry, context));
  const highestProbabilityPath = (paths[0]?.name ?? "Infrastructure Pull") as ArchetypeName;

  return {
    paths,
    highest_probability_path: highestProbabilityPath,
    recommended_action: recommendedAction(highestProbabilityPath),
    infopunks_angle: infopunksAngle(highestProbabilityPath, context),
    watch_signals: [...WATCH_SIGNALS],
    risk_notes: riskNotes(context, highestProbabilityPath)
  };
}

export function summarizeNarrativeSimulation(input: SimulateNarrativeInput): string[] {
  const result = simulateNarrative(input);
  return result.paths.map((path) => `${path.name}:${path.probability.toFixed(4)}`);
}
