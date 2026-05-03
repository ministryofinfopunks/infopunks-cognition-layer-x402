import { simulateNarrative } from "./engine.js";
import { narrativeSchemaBundle } from "./schema.js";

export const narrativeToolRuntime = {
  ...narrativeSchemaBundle,
  execute: simulateNarrative,
  summarize(result: { highest_probability_path: string; recommended_action: string }): string {
    return `${String(result.highest_probability_path)} leads. ${String(result.recommended_action)}`;
  }
};
