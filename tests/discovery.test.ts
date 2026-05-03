import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { loadEnv } from "../src/config/env.js";
import { buildDiscoveryManifest } from "../src/discovery/manifest.js";
import { buildDiscoveryResources, getToolById, listTools } from "../src/registry/tools.js";
import { buildServer } from "../src/server.js";

function createConfig() {
  return loadEnv({
    ...process.env,
    APP_ENVIRONMENT: "test",
    NODE_ENV: "test",
    PUBLIC_BASE_URL: "http://127.0.0.1:4024"
  });
}

async function createTestServer() {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "infopunks-cognition-layer-discovery-"));
  const config = loadEnv({
    ...process.env,
    APP_ENVIRONMENT: "test",
    NODE_ENV: "test",
    PORT: "4024",
    PUBLIC_BASE_URL: "http://127.0.0.1:4024",
    RUNTIME_DIR: runtimeDir,
    X402_VERIFIER_MODE: "mock",
    X402_REQUIRED_DEFAULT: "true"
  });
  const context = await buildServer(config);
  return { ...context, runtimeDir };
}

test("every public tool appears in discovery metadata", () => {
  const resources = buildDiscoveryResources(createConfig());
  assert.equal(resources.length, listTools().length);
  for (const tool of listTools()) {
    assert.ok(resources.find((resource) => resource.tool_id === tool.tool_id));
  }
});

test("discovery manifest includes canonical metadata and all three tools", () => {
  const manifest = buildDiscoveryManifest(createConfig()) as {
    service_name: string;
    description: string;
    product_definition: { core_primitives: string[] };
    tools: Array<{ tool_id: string }>;
    openapi_url: string;
    events_url: string;
    receipts_url: string;
    proof_url: string;
  };
  assert.equal(manifest.service_name, "Infopunks Cognition Layer");
  assert.match(manifest.description, /x402-paid cultural intelligence API/);
  assert.equal(manifest.product_definition.core_primitives.length, 3);
  assert.ok(manifest.tools.find((tool) => tool.tool_id === getToolById("score_coherence")?.tool_id));
  assert.ok(manifest.tools.find((tool) => tool.tool_id === getToolById("extract_signal")?.tool_id));
  assert.ok(manifest.tools.find((tool) => tool.tool_id === getToolById("simulate_narrative")?.tool_id));
  assert.match(manifest.openapi_url, /\/openapi\.json$/);
  assert.match(manifest.events_url, /\/v1\/events\/recent$/);
  assert.match(manifest.receipts_url, /\/receipts$/);
  assert.match(manifest.proof_url, /\/proof$/);
});

test("discovery manifest route exists and includes all three tools", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/.well-known/infopunks-cognition-layer.json"
    });
    assert.equal(response.statusCode, 200);
    const manifest = response.json() as { tools: Array<{ tool_id: string }> };
    assert.ok(manifest.tools.find((tool) => tool.tool_id === "score_coherence"));
    assert.ok(manifest.tools.find((tool) => tool.tool_id === "extract_signal"));
    assert.ok(manifest.tools.find((tool) => tool.tool_id === "simulate_narrative"));
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
