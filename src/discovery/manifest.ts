import type { AppConfig } from "../config/env.js";
import { buildDiscoveryResources } from "../registry/tools.js";

export function buildDiscoveryManifest(config: AppConfig): Record<string, unknown> {
  const tools = buildDiscoveryResources(config);
  return {
    service: config.serviceName,
    service_name: config.serviceTitle,
    version: config.serviceVersion,
    title: config.serviceTitle,
    description: config.serviceDescription,
    product_definition: {
      canonical_language: "Infopunks Cognition Layer is an x402-paid cultural intelligence API for agents and humans. It turns raw narrative, market noise, and agent output into coherent machine-usable intelligence.",
      core_primitives: [
        "/v1/coherence-score: measure whether an artifact is coherent enough to trust, route, amplify, or reject",
        "/v1/extract-signal: turn noise into usable cultural signal",
        "/v1/simulate-narrative: model how a narrative may evolve"
      ]
    },
    public_base_url: config.publicBaseUrl,
    openapi_url: `${config.publicBaseUrl}/openapi.json`,
    health_url: `${config.publicBaseUrl}/health`,
    war_room_url: `${config.publicBaseUrl}/war-room`,
    events_url: `${config.publicBaseUrl}/v1/events/recent`,
    recent_events_url: `${config.publicBaseUrl}/v1/events/recent`,
    proof_url: `${config.publicBaseUrl}/proof`,
    receipts_url: `${config.publicBaseUrl}/receipts`,
    receipt_url_template: `${config.publicBaseUrl}/receipts/{receipt_id}`,
    proof_url_template: `${config.publicBaseUrl}/proof/{receipt_id}`,
    x402: {
      required_by_default: config.x402RequiredDefault,
      verifier_mode: config.x402VerifierMode,
      facilitator_url: config.x402FacilitatorUrl,
      scheme: config.x402Scheme,
      network: config.x402Network,
      asset_symbol: config.x402AssetSymbol,
      asset_address: config.x402PaymentAssetAddress,
      pay_to: config.x402PayTo
    },
    resources: {
      openapi: `${config.publicBaseUrl}/openapi.json`,
      events: `${config.publicBaseUrl}/v1/events/recent`,
      receipts: `${config.publicBaseUrl}/receipts/{receipt_id}`,
      proof: `${config.publicBaseUrl}/proof/{receipt_id}`
    },
    tools,
    bazaar: {
      category: "cognition",
      compatibility: ["x402", "agentic-market", "bazaar"],
      deterministic: true,
      local_test_ready: true,
      requires_database_for_local_tests: false,
      receipt_support: true,
      proof_pages: config.proofPagesEnabled,
      descriptions: tools.map((tool) => ({
        tool_id: tool.tool_id,
        routeTemplate: tool.routeTemplate,
        bazaar_description: tool.bazaar_description
      }))
    }
  };
}

export function buildBazaarManifest(config: AppConfig): Record<string, unknown> {
  return {
    kind: "x402-bazaar-service",
    name: config.serviceTitle,
    slug: config.serviceName,
    version: config.serviceVersion,
    description: config.serviceDescription,
    discovery_url: `${config.publicBaseUrl}/.well-known/infopunks-cognition-layer.json`,
    openapi_url: `${config.publicBaseUrl}/openapi.json`,
    paid_endpoints: buildDiscoveryResources(config).map((tool) => ({
      tool_id: tool.tool_id,
      path: tool.route,
      method: tool.method,
      category: tool.category,
      price_usd: tool.price.amount_usd,
      event_type: tool.event_type
    })),
    metadata: {
      deterministic: true,
      receipt_support: true,
      proof_pages: config.proofPagesEnabled,
      event_feed: `${config.publicBaseUrl}/v1/events/recent`
    }
  };
}
