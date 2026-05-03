import { z } from "zod";
import type { ToolSchemaBundle } from "../../registry/schemas.js";

const signalInputValueSchema = z.union([
  z.string().trim().min(1).max(4000),
  z.array(z.string().trim().min(1).max(4000)).min(1).max(24)
]);

export const signalOutputTypeSchema = z.enum([
  "founder_post",
  "thesis",
  "risk_signal",
  "meme_angle",
  "briefing",
  "launch_copy"
]);

export const signalToneSchema = z.enum([
  "infopunks",
  "neutral",
  "founder",
  "technical",
  "market"
]);

export const extractSignalInputSchema = z.object({
  input: signalInputValueSchema,
  context: z.string().trim().min(1).max(1200).optional(),
  output_type: signalOutputTypeSchema,
  tone: signalToneSchema.optional().default("neutral"),
  audience: z.string().trim().min(1).max(120).optional()
});

export type ExtractSignalInput = z.infer<typeof extractSignalInputSchema>;
export type ExtractSignalOutputType = z.infer<typeof signalOutputTypeSchema>;
export type ExtractSignalTone = z.infer<typeof signalToneSchema>;

export type DetectedTheme =
  | "x402"
  | "agent payments"
  | "Base"
  | "Bazaar"
  | "Agentic.Market"
  | "trust"
  | "coherence"
  | "signal"
  | "narrative"
  | "proof"
  | "receipts"
  | "War Room"
  | "token launch"
  | "privacy"
  | "Zcash"
  | "Solana"
  | "AI agents"
  | "marketplaces"
  | "routing";

export interface ExtractSignalOutput {
  core_signal: string;
  noise_removed: string[];
  recommended_artifact: ExtractSignalOutputType;
  artifact: string;
  amplified_artifact: string;
  distribution_angle: string;
  recommended_use: string;
  coherence_score: number;
  risk_notes: string[];
  detected_themes: DetectedTheme[];
  receipt?: unknown;
}

export const signalSchemaBundle: ToolSchemaBundle<ExtractSignalInput, ExtractSignalOutput> = {
  inputSchema: extractSignalInputSchema,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["input", "output_type"],
    properties: {
      input: {
        oneOf: [
          { type: "string", minLength: 1 },
          {
            type: "array",
            minItems: 1,
            maxItems: 24,
            items: { type: "string", minLength: 1 }
          }
        ]
      },
      context: { type: "string" },
      output_type: {
        type: "string",
        enum: ["founder_post", "thesis", "risk_signal", "meme_angle", "briefing", "launch_copy"]
      },
      tone: {
        type: "string",
        enum: ["infopunks", "neutral", "founder", "technical", "market"]
      },
      audience: { type: "string" }
    }
  },
  outputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "core_signal",
      "noise_removed",
      "recommended_artifact",
      "artifact",
      "amplified_artifact",
      "distribution_angle",
      "recommended_use",
      "coherence_score",
      "risk_notes",
      "detected_themes"
    ],
    properties: {
      core_signal: { type: "string" },
      noise_removed: { type: "array", items: { type: "string" } },
      recommended_artifact: {
        type: "string",
        enum: ["founder_post", "thesis", "risk_signal", "meme_angle", "briefing", "launch_copy"]
      },
      artifact: { type: "string" },
      amplified_artifact: { type: "string" },
      distribution_angle: { type: "string" },
      recommended_use: { type: "string" },
      coherence_score: { type: "number" },
      risk_notes: { type: "array", items: { type: "string" } },
      detected_themes: {
        type: "array",
        items: {
          type: "string",
          enum: [
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
          ]
        }
      }
    }
  },
  exampleRequest: {
    input: "x402 tools are starting to get indexed on Agentic.Market",
    context: "crypto / agent economy / Base",
    output_type: "founder_post",
    tone: "infopunks",
    audience: "agent builders"
  },
  exampleResponse: {
    core_signal: "agent payments are moving from demo primitive to live distribution layer",
    noise_removed: ["unsupported adoption claims", "generic AI hype"],
    recommended_artifact: "founder_post",
    artifact: "agents do not need subscriptions. they need paid doors. x402 is becoming a distribution surface.",
    amplified_artifact: "agents do not need subscriptions. they need paid doors. agent payments are moving from demo primitive to live distribution layer. receipts make the claim legible enough for the agent economy to route it.",
    distribution_angle: "X post with a paid-call receipt or War Room screenshot.",
    recommended_use: "Use as an X post after proving the endpoint is callable and attaching proof.",
    coherence_score: 84,
    risk_notes: ["Adoption or listing claims need proof such as receipt volume, listing metadata, or named integrations."],
    detected_themes: ["x402", "Agentic.Market", "Base", "AI agents", "routing"]
  }
};
