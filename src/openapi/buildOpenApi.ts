import type { AppConfig } from "../config/env.js";
import { buildOpenApiPaths } from "../registry/tools.js";

export function buildOpenApi(config: AppConfig): Record<string, unknown> {
  const receiptSchema = {
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

  return {
    openapi: "3.1.0",
    info: {
      title: config.serviceTitle,
      version: config.serviceVersion,
      description: `${config.serviceDescription} Core primitives: /v1/coherence-score, /v1/extract-signal, /v1/simulate-narrative.`
    },
    servers: [{ url: config.publicBaseUrl }],
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          responses: {
            "200": {
              description: "Service is healthy.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["status", "service", "version", "environment", "payment_mode", "tools"],
                    properties: {
                      status: { type: "string" },
                      service: { type: "string" },
                      version: { type: "string" },
                      environment: { type: "string" },
                      payment_mode: { type: "string", enum: ["mock", "facilitator"] },
                      tools: {
                        type: "array",
                        items: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v1/events/recent": {
        get: {
          summary: "Recent paid execution events",
          responses: {
            "200": {
              description: "Recent event feed.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "event_id",
                        "event_type",
                        "tool_id",
                        "endpoint",
                        "payment_status",
                        "x402_verified",
                        "network",
                        "receipt_id",
                        "result_summary",
                        "created_at"
                      ],
                      properties: {
                        event_id: { type: "string" },
                        event_type: { type: "string" },
                        tool_id: { type: "string" },
                        endpoint: { type: "string" },
                        payment_status: { type: "string", enum: ["verified", "unpaid", "mock_verified"] },
                        x402_verified: { type: "boolean" },
                        network: { type: "string" },
                        receipt_id: { type: "string" },
                        result_summary: { type: "string" },
                        created_at: { type: "string", format: "date-time" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/receipts/{receipt_id}": {
        get: {
          summary: "Fetch a public receipt",
          parameters: [{ name: "receipt_id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Receipt found.",
              content: {
                "application/json": {
                  schema: receiptSchema
                }
              }
            },
            "404": { description: "Receipt not found." }
          }
        }
      },
      "/proof": {
        get: {
          summary: "Render recent proof pages",
          responses: {
            "200": {
              description: "Proof index page.",
              content: {
                "text/html": {
                  schema: { type: "string" }
                }
              }
            },
            "404": { description: "Proof pages are disabled." }
          }
        }
      },
      "/proof/{receipt_id}": {
        get: {
          summary: "Render a proof page for a paid call",
          parameters: [{ name: "receipt_id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Proof page HTML.",
              content: {
                "text/html": {
                  schema: { type: "string" }
                }
              }
            },
            "404": { description: "Receipt not found." }
          }
        }
      },
      ...buildOpenApiPaths(config)
    }
  };
}
