import type { z } from "zod";

export type JsonSchema = Record<string, unknown>;

export interface ToolSchemaBundle<TRequest, TResponse> {
  inputSchema: z.ZodTypeAny;
  inputJsonSchema: JsonSchema;
  outputJsonSchema: JsonSchema;
  exampleRequest: TRequest;
  exampleResponse: Omit<TResponse, "receipt">;
}
