import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/config/env.js";

const config = loadEnv({
  ...process.env,
  APP_ENVIRONMENT: "test",
  NODE_ENV: "test",
  X402_VERIFIER_MODE: "mock",
  X402_REQUIRED_DEFAULT: "true"
});

const { app } = await buildServer(config);

try {
  const response = await app.inject({
    method: "POST",
    url: "/v1/coherence-score",
    payload: {
      artifact: "Publish the x402-paid coherence endpoint, return receipts on every paid success path, and keep the proof surface stable for agents."
    }
  });

  console.log(JSON.stringify({
    statusCode: response.statusCode,
    body: response.json()
  }, null, 2));
} finally {
  await app.close();
}
