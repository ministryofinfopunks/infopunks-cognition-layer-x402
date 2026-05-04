import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { AppConfig } from "../config/env.js";
import type { JsonSchema } from "../registry/schemas.js";
import type { PaidToolRegistration } from "../registry/tools.js";

interface CognitionBazaarMetadata {
  description: string;
  inputExample: Record<string, unknown>;
  outputExample: Record<string, unknown>;
  tags: string[];
  category: "intelligence";
}

export interface X402ResourceMetadata {
  resource: string;
  url: string;
  routeTemplate: string;
  description: string;
  mimeType: "application/json";
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  tags: string[];
  category: "intelligence";
  extensions: {
    bazaar: Record<string, unknown>;
  };
}

const SHARED_TAGS = [
  "cognition",
  "coherence",
  "signal",
  "narrative",
  "x402",
  "ai-agents",
  "cultural-intelligence",
  "base"
] as const;

function normalizeRequestPath(requestPath: string): string {
  const pathWithoutQuery = requestPath.split("?")[0] ?? requestPath;
  return pathWithoutQuery.startsWith("/") ? pathWithoutQuery : `/${pathWithoutQuery}`;
}

function resolveBazaarExtensionObject(extensionLike: unknown): Record<string, unknown> {
  if (
    extensionLike != null
    && typeof extensionLike === "object"
    && !Array.isArray(extensionLike)
    && Object.hasOwn(extensionLike, "bazaar")
  ) {
    const nested = (extensionLike as { bazaar?: unknown }).bazaar;
    if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return extensionLike as Record<string, unknown>;
}

function buildMetadataByRoute(tool: PaidToolRegistration): CognitionBazaarMetadata {
  if (tool.route === "/v1/coherence-score") {
    return {
      description: "Scores whether a narrative artifact, agent output, or cultural signal is coherent enough to trust, route, amplify, or reject.",
      inputExample: {
        artifact: "Agents are beginning to pay for cognition before execution.",
        context: "{\"domain\":\"agentic_markets\",\"audience\":\"ai_agents\",\"intent\":\"route_or_amplify\"}",
        audience: "ai_agents",
        intended_action: "route_or_amplify"
      },
      outputExample: tool.runtime.exampleResponse,
      tags: [...SHARED_TAGS],
      category: "intelligence"
    };
  }
  if (tool.route === "/v1/extract-signal") {
    return {
      description: "Extracts machine-usable cultural signal from raw narrative, market noise, social chatter, or agent output.",
      inputExample: {
        input: "x402 lets agents pay APIs directly. The interesting unlock is receipts attached to cognition and routing.",
        context: "{\"domain\":\"agentic_commerce\",\"source\":\"social_post\",\"goal\":\"extract_actionable_signal\"}",
        output_type: "briefing",
        tone: "technical",
        audience: "ai_agents"
      },
      outputExample: tool.runtime.exampleResponse,
      tags: [...SHARED_TAGS],
      category: "intelligence"
    };
  }
  return {
    description: "Simulates how a narrative may evolve across agent markets, crypto networks, communities, and cultural distribution loops.",
    inputExample: {
      narrative: "Paid cognition APIs become a primitive for agentic markets.",
      time_horizon: "30d",
      market_context: "{\"domain\":\"agentic_economy\",\"audience\":\"builders_and_agents\"}",
      perspective: "builders_and_agents",
      risk_tolerance: "medium"
    },
    outputExample: tool.runtime.exampleResponse,
    tags: [...SHARED_TAGS],
    category: "intelligence"
  };
}

export function buildCognitionResourceMetadata(
  config: AppConfig,
  tool: PaidToolRegistration,
  requestPath: string
): X402ResourceMetadata {
  const path = normalizeRequestPath(requestPath);
  const url = `${config.publicBaseUrl}${path}`;
  const metadata = buildMetadataByRoute(tool);
  const declared = resolveBazaarExtensionObject(declareDiscoveryExtension({
    input: metadata.inputExample,
    inputSchema: tool.input_schema as unknown as Record<string, unknown>,
    bodyType: "json",
    output: {
      example: metadata.outputExample,
      schema: tool.output_schema as unknown as Record<string, unknown>
    }
  }));
  const enriched = resolveBazaarExtensionObject(
    bazaarResourceServerExtension.enrichDeclaration?.(declared, {
      method: tool.method,
      routePattern: tool.route,
      adapter: { getPath: () => path },
      contentType: "application/json"
    }) ?? declared
  );

  return {
    resource: url,
    url,
    routeTemplate: tool.route,
    description: metadata.description,
    mimeType: "application/json",
    inputSchema: tool.input_schema,
    outputSchema: tool.output_schema,
    tags: metadata.tags,
    category: metadata.category,
    extensions: {
      bazaar: enriched
    }
  };
}
