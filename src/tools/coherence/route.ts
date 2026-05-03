import { scoreCoherence } from "./engine.js";
import { coherenceSchemaBundle } from "./schema.js";

export const coherenceToolRuntime = {
  ...coherenceSchemaBundle,
  execute: scoreCoherence,
  summarize(result: { coherence_score: number; decision: string; contradiction_risk: string }): string {
    return `Coherence score ${String(result.coherence_score)} with decision ${String(result.decision)} and contradiction risk ${String(result.contradiction_risk)}.`;
  }
};
