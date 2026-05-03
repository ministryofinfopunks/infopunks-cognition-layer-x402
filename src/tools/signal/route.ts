import { extractSignal } from "./engine.js";
import { signalSchemaBundle } from "./schema.js";

export const signalToolRuntime = {
  ...signalSchemaBundle,
  execute: extractSignal,
  summarize(result: { recommended_artifact: string; coherence_score: number; core_signal: string }): string {
    return `${result.recommended_artifact} scored ${String(result.coherence_score)}: ${result.core_signal}.`;
  }
};
