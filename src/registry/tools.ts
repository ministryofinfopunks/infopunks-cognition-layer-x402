import type { AppConfig } from "../config/env.js";
import { resolveToolPrice, type ToolPrice } from "../config/pricing.js";
import type { JsonSchema } from "./schemas.js";
import type { z } from "zod";
import { coherenceToolRuntime } from "../tools/coherence/route.js";
import { signalToolRuntime } from "../tools/signal/route.js";
import { narrativeToolRuntime } from "../tools/narrative/route.js";

export type ToolCategory = "coherence" | "signal" | "narrative";

interface OpenApiOperationMetadata {
  summary: string;
  description: string;
  tags: string[];
}

interface ToolRuntime<TRequest, TResponse> {
  inputSchema: z.ZodTypeAny;
  inputJsonSchema: JsonSchema;
  outputJsonSchema: JsonSchema;
  exampleRequest: TRequest;
  exampleResponse: Omit<TResponse, "receipt">;
  execute: (input: TRequest) => TResponse;
  summarize: (result: TResponse) => string;
}

export interface PaidToolRegistration {
  tool_id: string;
  version: string;
  method: "POST";
  route: string;
  category: ToolCategory;
  public_description: string;
  discovery_description: string;
  openapi: OpenApiOperationMetadata;
  event_type: string;
  price: {
    envKey: string;
    defaultUsd: string;
  };
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  runtime: ToolRuntime<any, any>;
  getPrice: (config: AppConfig) => ToolPrice;
}

export interface DiscoveryToolResource {
  tool_id: string;
  version: string;
  method: "POST";
  route: string;
  routeTemplate: string;
  category: ToolCategory;
  bazaar_description: string;
  pricing: {
    scheme: "exact";
    amount_usd: string;
    amount_atomic: string;
  };
  network: {
    caip2: string;
  };
  asset: {
    symbol: string;
    address: string;
    pay_to: string;
  };
  price: {
    amount_usd: string;
    amount_atomic: string;
    asset_symbol: string;
    asset_address: string;
    network: string;
    pay_to: string;
  };
  public_description: string;
  discovery_description: string;
  event_type: string;
  input_schema: JsonSchema;
  output_schema: JsonSchema;
}

function createRegistration(
  value: Omit<PaidToolRegistration, "getPrice" | "input_schema" | "output_schema"> & {
    runtime: ToolRuntime<any, any>;
  }
): PaidToolRegistration {
  return {
    ...value,
    input_schema: value.runtime.inputJsonSchema,
    output_schema: value.runtime.outputJsonSchema,
    getPrice(config) {
      return resolveToolPrice(config, value.price.envKey, value.price.defaultUsd);
    }
  };
}

const paidTools: readonly PaidToolRegistration[] = [
  createRegistration({
    tool_id: "score_coherence",
    version: "1.0.0",
    method: "POST",
    route: "/v1/coherence-score",
    category: "coherence",
    public_description: "Measures whether an artifact is coherent enough to trust, amplify, route, or reject across message, strategy, narrative, and coordination use cases.",
    discovery_description: "Coherence Score is the measurement layer for machine-native cultural intelligence. It scores whether an artifact is internally coherent, credible, thesis-aligned, specific, actionable, and usable by agents or founders.",
    openapi: {
      summary: "Measure whether an artifact is coherent enough to trust or route",
      description: "Deterministically scores whether an artifact is internally coherent, technically credible, thesis-aligned, specific, actionable, and suitable for agent or founder use.",
      tags: ["cognition", "coherence"]
    },
    event_type: "cognition.score_coherence.paid",
    price: {
      envKey: "TOOL_PRICE_SCORE_COHERENCE_USD",
      defaultUsd: "0.01"
    },
    runtime: coherenceToolRuntime
  }),
  createRegistration({
    tool_id: "extract_signal",
    version: "1.0.0",
    method: "POST",
    route: "/v1/extract-signal",
    category: "signal",
    public_description: "Turns noisy inputs into coherent cultural signal and usable artifacts for founders, agents, and markets.",
    discovery_description: "Signal Amplifier becomes /v1/extract-signal. It turns raw market chatter, research noise, and agent output into usable cultural signal.",
    openapi: {
      summary: "Turn noise into usable cultural signal",
      description: "Turns noisy inputs into coherent cultural signal and usable artifacts for founders, agents, and markets.",
      tags: ["cognition", "signal"]
    },
    event_type: "cognition.extract_signal.paid",
    price: {
      envKey: "TOOL_PRICE_EXTRACT_SIGNAL_USD",
      defaultUsd: "0.01"
    },
    runtime: signalToolRuntime
  }),
  createRegistration({
    tool_id: "simulate_narrative",
    version: "1.0.0",
    method: "POST",
    route: "/v1/simulate-narrative",
    category: "narrative",
    public_description: "Simulates plausible future paths for a narrative, protocol, market thesis, launch, or cultural event.",
    discovery_description: "Narrative Simulator becomes /v1/simulate-narrative. It models how a narrative, protocol, launch, or market thesis may evolve.",
    openapi: {
      summary: "Model how a narrative may evolve",
      description: "Simulates plausible future paths for a narrative, protocol, market thesis, launch, or cultural event.",
      tags: ["cognition", "narrative"]
    },
    event_type: "cognition.simulate_narrative.paid",
    price: {
      envKey: "TOOL_PRICE_SIMULATE_NARRATIVE_USD",
      defaultUsd: "0.01"
    },
    runtime: narrativeToolRuntime
  })
] as const;

export function listTools(): readonly PaidToolRegistration[] {
  return paidTools;
}

export function getToolByRoute(route: string): PaidToolRegistration | undefined {
  return paidTools.find((tool) => tool.route === route);
}

export function getToolById(toolId: string): PaidToolRegistration | undefined {
  return paidTools.find((tool) => tool.tool_id === toolId);
}

export function buildDiscoveryResources(config: AppConfig): DiscoveryToolResource[] {
  return paidTools.map((tool) => {
    const price = tool.getPrice(config);
    return {
      tool_id: tool.tool_id,
      version: tool.version,
      method: tool.method,
      route: tool.route,
      routeTemplate: tool.route,
      category: tool.category,
      bazaar_description: tool.discovery_description,
      pricing: {
        scheme: config.x402Scheme,
        amount_usd: price.priceUsd,
        amount_atomic: price.priceAtomic
      },
      network: {
        caip2: config.x402Network
      },
      asset: {
        symbol: config.x402AssetSymbol,
        address: config.x402PaymentAssetAddress,
        pay_to: config.x402PayTo
      },
      price: {
        amount_usd: price.priceUsd,
        amount_atomic: price.priceAtomic,
        asset_symbol: config.x402AssetSymbol,
        asset_address: config.x402PaymentAssetAddress,
        network: config.x402Network,
        pay_to: config.x402PayTo
      },
      public_description: tool.public_description,
      discovery_description: tool.discovery_description,
      event_type: tool.event_type,
      input_schema: tool.input_schema,
      output_schema: tool.output_schema
    };
  });
}

function buildReceiptViewSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "receipt_id",
      "tool_id",
      "endpoint",
      "final_status",
      "x402_verified",
      "facilitator_provider",
      "network",
      "asset",
      "payTo",
      "result_hash",
      "created_at",
      "proof_url"
    ],
    properties: {
      receipt_id: { type: "string" },
      tool_id: { type: "string" },
      endpoint: { type: "string" },
      final_status: { type: "number" },
      x402_verified: { type: "boolean" },
      facilitator_provider: { type: "string" },
      network: { type: "string" },
      asset: { type: "string" },
      payTo: { type: "string" },
      result_hash: { type: "string" },
      created_at: { type: "string", format: "date-time" },
      proof_url: { type: "string", format: "uri" },
      settlement_reference: { type: "string" },
      settlement_status: { type: "string", enum: ["settled", "verified"] }
    }
  };
}

function buildPaymentRequiredSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["error", "message", "payment"],
    properties: {
      error: { type: "string", enum: ["payment_required"] },
      message: { type: "string" },
      payment: {
        type: "object",
        additionalProperties: false,
        required: [
          "version",
          "mode",
          "scheme",
          "network",
          "asset_symbol",
          "asset_address",
          "price_usd",
          "price_atomic",
          "pay_to",
          "required_header",
          "facilitator_url",
          "resource",
          "method"
        ],
        properties: {
          version: { type: "string", enum: ["x402"] },
          mode: { type: "string", enum: ["mock", "facilitator"] },
          scheme: { type: "string", enum: ["exact"] },
          network: { type: "string" },
          asset_symbol: { type: "string" },
          asset_address: { type: "string" },
          price_usd: { type: "string" },
          price_atomic: { type: "string" },
          pay_to: { type: "string" },
          required_header: { type: "string" },
          facilitator_url: { type: ["string", "null"] },
          resource: { type: "string" },
          method: { type: "string" }
        }
      }
    }
  };
}

function buildInvalidRequestSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["error", "issues"],
    properties: {
      error: { type: "string", enum: ["invalid_request"] },
      issues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "message"],
          properties: {
            path: { type: "string" },
            message: { type: "string" }
          }
        }
      }
    }
  };
}

function buildServerErrorSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: true,
    required: ["error"],
    properties: {
      error: { type: "string" }
    }
  };
}

function buildPaidOutputSchema(toolOutputSchema: JsonSchema): JsonSchema {
  const required = Array.isArray(toolOutputSchema.required) ? toolOutputSchema.required : [];
  const properties = typeof toolOutputSchema.properties === "object"
    && toolOutputSchema.properties != null
    ? toolOutputSchema.properties
    : {};
  return {
    type: "object",
    additionalProperties: false,
    required: [...required, "receipt"],
    properties: {
      ...properties,
      receipt: buildReceiptViewSchema()
    }
  };
}

export function buildOpenApiPaths(config: AppConfig): Record<string, unknown> {
  const receiptSchema = {
    receipt_id: "rcpt_example",
    tool_id: "score_coherence",
    endpoint: "/v1/coherence-score",
    final_status: 200,
    x402_verified: true,
    facilitator_provider: config.x402VerifierMode === "mock" ? "mock-header" : String(config.x402FacilitatorUrl ?? "facilitator"),
    network: config.x402Network,
    asset: `${config.x402AssetSymbol}:${config.x402PaymentAssetAddress}`,
    payTo: config.x402PayTo,
    result_hash: "5f1d7b9eb3ef1bb6d3f5b8121ee8a2d8f0f4e0a2d23f2af66582331ff4fd47f6",
    created_at: "2026-05-03T00:00:00.000Z",
    proof_url: `${config.publicBaseUrl}/proof/rcpt_example`
  };
  const paths: Record<string, unknown> = {};
  for (const tool of paidTools) {
    const price = tool.getPrice(config);
    paths[tool.route] = {
      post: {
        summary: tool.openapi.summary,
        description: tool.openapi.description,
        tags: tool.openapi.tags,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: tool.input_schema,
              example: tool.runtime.exampleRequest
            }
          }
        },
        parameters: [
          {
            name: "x402-payment",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Required in facilitator mode when retrying after a 402 challenge."
          },
          {
            name: "x402-mock-payment",
            in: "header",
            required: false,
            schema: { type: "string", enum: ["paid"] },
            description: "Mock-mode header for local/test payment verification."
          },
          {
            name: "x402-mock-payer",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Optional mock-mode payer identifier."
          }
        ],
        responses: {
          "200": {
            description: "Successful paid tool response",
            content: {
              "application/json": {
                schema: buildPaidOutputSchema(tool.output_schema),
                example: {
                  ...tool.runtime.exampleResponse,
                  receipt: {
                    ...receiptSchema,
                    tool_id: tool.tool_id,
                    endpoint: tool.route
                  }
                }
              }
            }
          },
          "402": {
            description: "Payment required",
            headers: {
              "payment-required": {
                description: "Signals x402 challenge requirements.",
                schema: { type: "string", example: "x402" }
              }
            },
            content: {
              "application/json": {
                schema: buildPaymentRequiredSchema(),
                example: {
                  error: "payment_required",
                  message: "x402 payment required for this endpoint.",
                  payment: {
                    version: "x402",
                    mode: config.x402VerifierMode,
                    scheme: config.x402Scheme,
                    network: config.x402Network,
                    asset_symbol: config.x402AssetSymbol,
                    asset_address: config.x402PaymentAssetAddress,
                    price_usd: price.priceUsd,
                    price_atomic: price.priceAtomic,
                    pay_to: config.x402PayTo,
                    required_header: config.x402VerifierMode === "mock" ? "x402-mock-payment: paid" : "x402-payment",
                    facilitator_url: config.x402FacilitatorUrl,
                    resource: tool.route,
                    method: tool.method
                  }
                }
              }
            }
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: buildInvalidRequestSchema(),
                example: {
                  error: "invalid_request",
                  issues: [
                    {
                      path: "artifact",
                      message: "String must contain at least 1 character(s)"
                    }
                  ]
                }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: buildServerErrorSchema(),
                example: {
                  error: "internal_error"
                }
              }
            }
          }
        }
      }
    };
  }
  return paths;
}
