import { z } from "zod";
import type { ToolSchemaBundle } from "../../registry/schemas.js";

const optionalText = z.string().trim().min(1).max(1600);

export const riskToleranceSchema = z.enum(["low", "medium", "high"]);

export const simulateNarrativeInputSchema = z.object({
  narrative: z.string().trim().min(1).max(6000),
  time_horizon: z.string().trim().regex(/^\d{1,3}(d|w|m|q|y)$/i, "Use a compact horizon such as 30d, 6w, 3m, 1q, or 1y.").optional().default("30d"),
  market_context: optionalText.optional(),
  perspective: z.string().trim().min(1).max(160).optional(),
  risk_tolerance: riskToleranceSchema.optional().default("medium")
});

export type NarrativeRiskTolerance = z.infer<typeof riskToleranceSchema>;
export type SimulateNarrativeInput = z.infer<typeof simulateNarrativeInputSchema>;

export interface NarrativeSimulationPath {
  name: string;
  probability: number;
  description: string;
  drivers: string[];
  risks: string[];
  opportunity: string;
  recommended_positioning: string;
}

export interface SimulateNarrativeOutput {
  paths: NarrativeSimulationPath[];
  highest_probability_path: string;
  recommended_action: string;
  infopunks_angle: string;
  watch_signals: string[];
  risk_notes: string[];
  receipt?: unknown;
}

export const narrativeSchemaBundle: ToolSchemaBundle<SimulateNarrativeInput, SimulateNarrativeOutput> = {
  inputSchema: simulateNarrativeInputSchema,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["narrative"],
    properties: {
      narrative: { type: "string", minLength: 1, maxLength: 6000 },
      time_horizon: {
        type: "string",
        pattern: "^\\d{1,3}(d|w|m|q|y)$",
        default: "30d"
      },
      market_context: { type: "string", maxLength: 1600 },
      perspective: { type: "string", maxLength: 160 },
      risk_tolerance: {
        type: "string",
        enum: ["low", "medium", "high"],
        default: "medium"
      }
    }
  },
  outputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "paths",
      "highest_probability_path",
      "recommended_action",
      "infopunks_angle",
      "watch_signals",
      "risk_notes"
    ],
    properties: {
      paths: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "probability",
            "description",
            "drivers",
            "risks",
            "opportunity",
            "recommended_positioning"
          ],
          properties: {
            name: { type: "string" },
            probability: { type: "number" },
            description: { type: "string" },
            drivers: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
            opportunity: { type: "string" },
            recommended_positioning: { type: "string" }
          }
        }
      },
      highest_probability_path: { type: "string" },
      recommended_action: { type: "string" },
      infopunks_angle: { type: "string" },
      watch_signals: { type: "array", items: { type: "string" } },
      risk_notes: { type: "array", items: { type: "string" } }
    }
  },
  exampleRequest: {
    narrative: "Launch /v1/simulate-narrative as an x402-paid endpoint on Base for agents, with receipts, War Room proof, and Bazaar metadata so builders can test narratives before routing them.",
    time_horizon: "45d",
    market_context: "Agentic marketplaces are indexing paid tools and builders want deterministic primitives with proof.",
    perspective: "builder distribution",
    risk_tolerance: "medium"
  },
  exampleResponse: {
    paths: [
      {
        name: "Infrastructure Pull",
        probability: 0.35,
        description: "Over 45d, the narrative compounds because x402 payments, Base settlement, and agent-callable endpoints make the behavior operationally easier to repeat.",
        drivers: ["x402 paid routing", "agent-callable endpoints", "Base settlement", "repeatable API behavior"],
        risks: ["proof must stay visible", "marketplace metadata can drift", "trust breaks if settlement complaints rise"],
        opportunity: "Package the narrative as a stable paid primitive that agents can call, verify, and route without reinterpretation.",
        recommended_positioning: "Lead with the endpoint, price, receipt flow, and one canonical explanation of why agents benefit."
      },
      {
        name: "Viral Proof Moment",
        probability: 0.31,
        description: "A receipt, screenshot, or War Room artifact makes the story socially legible enough to spread beyond the initial builder audience.",
        drivers: ["public proof artifacts", "shareable paid-call receipts", "launch attention", "visible usage evidence"],
        risks: ["proof can go stale quickly", "attention outruns integration depth", "screenshots invite copycats without context"],
        opportunity: "Turn one high-signal paid call into a proof object that compresses understanding for both humans and agents.",
        recommended_positioning: "Ship proof cards and War Room screenshots that show the paid call, output, and why it matters."
      },
      {
        name: "Developer Adoption",
        probability: 0.2,
        description: "Builder uptake grows when the narrative collapses into copy-pasteable docs, examples, and integration references.",
        drivers: ["OpenAPI clarity", "curl examples", "GitHub references", "low integration friction"],
        risks: ["docs drift from runtime behavior", "SDK gaps slow follow-through", "proof is weaker without real integrations"],
        opportunity: "Convert narrative curiosity into implementation throughput with examples that are trivial to test.",
        recommended_positioning: "Treat the story as a developer primitive first: docs, examples, exact request body, and stable receipts."
      },
      {
        name: "Trust Bottleneck",
        probability: 0.14,
        description: "Adoption remains gated by whether buyers and agents trust the claim surface, verification flow, and settlement behavior.",
        drivers: ["trust-sensitive routing", "payment verification", "reputation effects"],
        risks: ["claims outrun verification", "failed settlement complaints", "buyers hesitate without reputation signals"],
        opportunity: "Use trust artifacts to make adoption safer before asking the market for amplification.",
        recommended_positioning: "Keep the narrative conservative and route the highest-stakes claims through the Trust Layer."
      }
    ],
    highest_probability_path: "Infrastructure Pull",
    recommended_action: "Ship the endpoint, publish docs, and show a paid receipt.",
    infopunks_angle: "The narrative wins when it becomes a machine-usable primitive: stable endpoint, canonical metadata, paid receipts, and proof that agents can route without reinterpretation.",
    watch_signals: [
      "marketplace indexing",
      "paid call receipts",
      "developer integrations",
      "repeated language on X",
      "forks/copycats",
      "failed settlement complaints",
      "confusion about metadata",
      "growth of agent-callable endpoints"
    ],
    risk_notes: [
      "Proof-sensitive paths rise when receipts, screenshots, or War Room evidence stay fresh and legible.",
      "Narratives that rely on infra claims still fail if marketplace metadata and settlement behavior drift apart.",
      "Deterministic outputs make the story stronger only if the proof surface remains public and machine-usable."
    ]
  }
};
