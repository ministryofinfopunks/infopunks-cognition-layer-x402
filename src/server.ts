import Fastify, { type FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { loadEnv, type AppConfig } from "./config/env.js";
import { registerDiscoveryRoutes } from "./discovery/route.js";
import { EventStore } from "./events/eventStore.js";
import { registerEventRoutes } from "./events/route.js";
import { registerOpenApiRoutes } from "./openapi/route.js";
import { registerProofRoutes } from "./proof/route.js";
import { ReceiptStore } from "./receipts/receiptStore.js";
import { registerReceiptRoutes } from "./receipts/route.js";
import { listTools } from "./registry/tools.js";
import { registerPaidToolRoute } from "./x402/paymentMiddleware.js";
import { PaymentVerifier } from "./x402/verify.js";

export interface ServerContext {
  app: FastifyInstance;
  config: AppConfig;
  receiptStore: ReceiptStore;
  eventStore: EventStore;
}

export async function buildServer(config: AppConfig = loadEnv()): Promise<ServerContext> {
  const app = Fastify({ logger: false });
  const receiptStore = new ReceiptStore(config);
  const eventStore = new EventStore(config);
  const verifier = new PaymentVerifier(config);

  app.get("/health", async () => ({
    status: "ok",
    service: config.serviceName,
    version: config.serviceVersion,
    environment: config.environment,
    payment_mode: config.x402VerifierMode,
    tools: listTools().map((tool) => tool.tool_id)
  }));

  await registerOpenApiRoutes(app, config);
  await registerDiscoveryRoutes(app, config);
  await registerEventRoutes(app, config, eventStore);
  await registerReceiptRoutes(app, receiptStore);
  await registerProofRoutes(app, config, receiptStore);

  for (const tool of listTools()) {
    await registerPaidToolRoute({
      app,
      config,
      verifier,
      receiptStore,
      eventStore,
      tool
    });
  }

  return { app, config, receiptStore, eventStore };
}

async function start(): Promise<void> {
  const config = loadEnv();
  const { app } = await buildServer(config);
  try {
    await app.listen({
      host: "0.0.0.0",
      port: config.port
    });
    console.log(`${config.serviceName} listening on ${config.publicBaseUrl}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const executedAsEntryPoint = process.argv[1] != null
  && fileURLToPath(import.meta.url) === process.argv[1];

if (executedAsEntryPoint) {
  await start();
}
