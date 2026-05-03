import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { buildOpenApiPaths, getToolById, listTools } from "../src/registry/tools.js";
import { buildOpenApi } from "../src/openapi/buildOpenApi.js";
import { loadEnv } from "../src/config/env.js";
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
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "infopunks-cognition-layer-openapi-"));
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

test("every public tool has schema metadata", () => {
  for (const tool of listTools()) {
    assert.ok(tool.input_schema);
    assert.ok(tool.output_schema);
    assert.ok(tool.openapi.summary);
    assert.ok(tool.public_description);
    assert.ok(tool.discovery_description);
    assert.ok(tool.event_type);
  }
});

test("every public tool appears in OpenAPI generation", () => {
  const paths = buildOpenApiPaths(createConfig()) as Record<string, unknown>;
  for (const tool of listTools()) {
    assert.ok(paths[tool.route]);
  }
});

test("openapi document includes all required routes", () => {
  const document = buildOpenApi(createConfig()) as { paths: Record<string, unknown> };
  for (const tool of listTools()) {
    assert.ok(document.paths[tool.route]);
  }
  assert.ok(document.paths["/health"]);
  assert.ok(document.paths["/v1/events/recent"]);
  assert.ok(document.paths["/receipts/{receipt_id}"]);
  assert.ok(document.paths["/proof"]);
  assert.ok(document.paths["/proof/{receipt_id}"]);
});

test("openapi route exists and includes all three tools", async () => {
  const { app, runtimeDir } = await createTestServer();
  try {
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    assert.equal(response.statusCode, 200);
    const body = response.json() as { paths: Record<string, unknown> };
    assert.ok(body.paths[getToolById("score_coherence")?.route ?? ""]);
    assert.ok(body.paths[getToolById("extract_signal")?.route ?? ""]);
    assert.ok(body.paths[getToolById("simulate_narrative")?.route ?? ""]);
  } finally {
    await app.close();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
