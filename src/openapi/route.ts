import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import { buildOpenApi } from "./buildOpenApi.js";

export async function registerOpenApiRoutes(app: FastifyInstance, config: AppConfig): Promise<void> {
  app.get("/openapi.json", async () => buildOpenApi(config));
}
