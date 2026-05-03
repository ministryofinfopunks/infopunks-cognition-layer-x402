import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import { buildBazaarManifest, buildDiscoveryManifest } from "./manifest.js";

export async function registerDiscoveryRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get("/.well-known/infopunks-cognition-layer.json", async () => buildDiscoveryManifest(config));
  app.get("/.well-known/x402-bazaar.json", async () => buildBazaarManifest(config));
}
