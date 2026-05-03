import { buildDiscoveryManifest } from "../src/discovery/manifest.js";
import { loadEnv } from "../src/config/env.js";

const config = loadEnv();
const manifest = buildDiscoveryManifest(config);

console.log(JSON.stringify({
  status: "ready",
  service: config.serviceName,
  version: config.serviceVersion,
  public_base_url: config.publicBaseUrl,
  tool_count: Array.isArray(manifest.tools) ? manifest.tools.length : 0,
  payment_mode: config.x402VerifierMode
}, null, 2));
