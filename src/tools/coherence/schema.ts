import { z } from "zod";
import type { ToolSchemaBundle } from "../../registry/schemas.js";

const optionalText = z.string().trim().min(1).max(2400);

export const coherenceScoreInputSchema = z.object({
  artifact: z.string().trim().min(1).max(12000),
  context: optionalText.optional(),
  criteria: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  audience: z.string().trim().min(1).max(120).optional(),
  intended_action: z.string().trim().min(1).max(160).optional()
});

export type CoherenceScoreInput = z.infer<typeof coherenceScoreInputSchema>;

export type RiskLevel = "low" | "medium" | "high";
export type CoherenceDecision = "publishable" | "revise" | "high_risk";

export interface CoherenceScoreOutput {
  coherence_score: number;
  intelligence_density: number;
  clarity: number;
  internal_consistency: number;
  specificity: number;
  causal_logic: number;
  actionability: number;
  thesis_alignment: number;
  technical_credibility: number;
  narrative_strength: number;
  market_relevance: number;
  narrative_drift: RiskLevel;
  contradiction_risk: RiskLevel;
  overclaiming_risk: RiskLevel;
  missing_proof: string[];
  contradictions: string[];
  weak_points: string[];
  risk_notes: string[];
  recommended_revision: string;
  infopunks_angle: string;
  decision: CoherenceDecision;
  receipt?: unknown;
}

export const coherenceSchemaBundle: ToolSchemaBundle<CoherenceScoreInput, CoherenceScoreOutput> = {
  inputSchema: coherenceScoreInputSchema,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["artifact"],
    properties: {
      artifact: { type: "string", minLength: 1 },
      context: { type: "string" },
      criteria: {
        type: "array",
        maxItems: 12,
        items: { type: "string" }
      },
      audience: { type: "string" },
      intended_action: { type: "string" }
    }
  },
  outputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "coherence_score",
      "intelligence_density",
      "clarity",
      "internal_consistency",
      "specificity",
      "causal_logic",
      "actionability",
      "thesis_alignment",
      "technical_credibility",
      "narrative_strength",
      "market_relevance",
      "narrative_drift",
      "contradiction_risk",
      "overclaiming_risk",
      "missing_proof",
      "contradictions",
      "weak_points",
      "risk_notes",
      "recommended_revision",
      "infopunks_angle",
      "decision"
    ],
    properties: {
      coherence_score: { type: "number" },
      intelligence_density: { type: "number" },
      clarity: { type: "number" },
      internal_consistency: { type: "number" },
      specificity: { type: "number" },
      causal_logic: { type: "number" },
      actionability: { type: "number" },
      thesis_alignment: { type: "number" },
      technical_credibility: { type: "number" },
      narrative_strength: { type: "number" },
      market_relevance: { type: "number" },
      narrative_drift: { type: "string", enum: ["low", "medium", "high"] },
      contradiction_risk: { type: "string", enum: ["low", "medium", "high"] },
      overclaiming_risk: { type: "string", enum: ["low", "medium", "high"] },
      missing_proof: { type: "array", items: { type: "string" } },
      contradictions: { type: "array", items: { type: "string" } },
      weak_points: { type: "array", items: { type: "string" } },
      risk_notes: { type: "array", items: { type: "string" } },
      recommended_revision: { type: "string" },
      infopunks_angle: { type: "string" },
      decision: { type: "string", enum: ["publishable", "revise", "high_risk"] }
    }
  },
  exampleRequest: {
    artifact: "POST /v1/coherence-score as an x402-paid endpoint on Base. Every paid call returns a receipt, emits a war-room event, and preserves a proof page. Publish the OpenAPI contract, keep X402_VERIFIER_MODE=facilitator in production, and run typecheck, tests, and build before rollout because agents need stable routing and auditable payment evidence.",
    context: "Audience is agent builders deciding whether to trust, route, or amplify the endpoint.",
    criteria: ["technical credibility", "thesis alignment", "actionability"],
    audience: "agents and founders",
    intended_action: "publish and route the endpoint"
  },
  exampleResponse: {
    coherence_score: 88,
    intelligence_density: 87,
    clarity: 84,
    internal_consistency: 92,
    specificity: 90,
    causal_logic: 82,
    actionability: 86,
    thesis_alignment: 93,
    technical_credibility: 91,
    narrative_strength: 78,
    market_relevance: 85,
    narrative_drift: "low",
    contradiction_risk: "low",
    overclaiming_risk: "low",
    missing_proof: [],
    contradictions: [],
    weak_points: [],
    risk_notes: [],
    recommended_revision: "Keep the proof-backed language, then lead with the paid endpoint, receipt surface, and exact rollout action in the opening line.",
    infopunks_angle: "Make the payment primitive explicit: name the x402 path, pricing surface, and receipt flow so paid usage is machine-actionable.",
    decision: "publishable"
  }
};
