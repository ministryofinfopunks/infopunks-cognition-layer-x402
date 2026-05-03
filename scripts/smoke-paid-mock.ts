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
    url: "/v1/extract-signal",
    headers: {
      "x402-mock-payment": "paid",
      "x402-mock-payer": "smoke-buyer"
    },
    payload: {
      input: [
        "x402 receipts are turning paid calls into something agents can trust.",
        "Agentic.Market indexing makes the endpoint easier to route.",
        "Base keeps the payment path close to where the buyers already are."
      ],
      context: "agent economy / Base",
      output_type: "founder_post",
      tone: "infopunks"
    }
  });

  console.log(JSON.stringify({
    statusCode: response.statusCode,
    body: response.json()
  }, null, 2));
} finally {
  await app.close();
}
