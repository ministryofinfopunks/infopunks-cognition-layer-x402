#!/usr/bin/env node
import { x402Client, x402HTTPClient } from "@x402/core/client";

const TARGETS = {
  coherence: {
    route: "/v1/coherence-score",
    body: {
      artifact: "Infopunks should validate input, require x402 payment, execute deterministic engines, hash results, create receipts, emit events, and return output."
    }
  },
  signal: {
    route: "/v1/extract-signal",
    body: {
      input: "x402 paid cognition endpoints are becoming routable primitives for agents.",
      output_type: "briefing",
      context: "agentic markets"
    }
  },
  narrative: {
    route: "/v1/simulate-narrative",
    body: {
      narrative: "Paid cognition APIs with receipts and proof surfaces become reliable routing infrastructure for agents.",
      time_horizon: "30d"
    }
  }
};

function normalizeBaseUrl(raw) {
  const base = String(raw ?? "https://infopunks-cognition-layer-x402.onrender.com").trim().replace(/\/$/, "");
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    throw new Error(`Invalid base URL: ${base}`);
  }
  return base;
}

function parseMode(argv) {
  const mode = String(argv[2] ?? "coherence").trim().toLowerCase();
  if (!(mode in TARGETS)) {
    throw new Error(`Unknown mode: ${mode}. Use one of: coherence, signal, narrative`);
  }
  return mode;
}

function decodePaymentRequiredHeader(rawHeader) {
  if (!rawHeader) {
    throw new Error("Missing payment-required header on unpaid 402 response.");
  }

  const decodedText = Buffer.from(rawHeader, "base64").toString("utf8");
  return JSON.parse(decodedText);
}

async function maybeBuildSdkPaymentHeaders(paymentRequiredResponse) {
  const privateKey = process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    return null;
  }

  const paymentClient = new x402Client();
  const paymentHttpClient = new x402HTTPClient(paymentClient);

  try {
    const evmClientModule = await import("@x402/evm/exact/client");
    const accounts = await import("viem/accounts");
    const signer = accounts.privateKeyToAccount(privateKey);

    if (typeof evmClientModule.registerExactEvmScheme === "function") {
      evmClientModule.registerExactEvmScheme(paymentClient, { signer });
    } else if (typeof evmClientModule.ExactEvmScheme === "function") {
      paymentClient.register("eip155:*", new evmClientModule.ExactEvmScheme(signer));
    } else {
      throw new Error("Unsupported @x402/evm client module exports.");
    }

    const paymentPayload = await paymentClient.createPaymentPayload(paymentRequiredResponse);
    return paymentHttpClient.encodePaymentSignatureHeader(paymentPayload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to build SDK payment payload: ${reason}`);
  }
}

function parseFallbackPaymentHeaderFromEnv() {
  const directHeader = process.env.X402_PAYMENT_HEADER_B64;
  if (directHeader) {
    return {
      "x-payment": directHeader
    };
  }

  const fallbackJson = process.env.FACILITATOR_PAYMENT_JSON;
  if (!fallbackJson) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(fallbackJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`FACILITATOR_PAYMENT_JSON is not valid JSON: ${message}`);
  }

  const encoded = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64");
  return {
    "x-payment": encoded
  };
}

async function main() {
  const mode = parseMode(process.argv);
  const selected = TARGETS[mode];
  const baseUrl = normalizeBaseUrl(process.env.PUBLIC_BASE_URL ?? process.env.TARGET_BASE_URL);
  const url = `${baseUrl}${selected.route}`;

  console.log(`[pay-cognition] mode=${mode}`);
  console.log(`[pay-cognition] endpoint=${url}`);

  const unpaidResponse = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(selected.body)
  });

  if (unpaidResponse.status !== 402) {
    const text = await unpaidResponse.text();
    console.log(`[pay-cognition] initial_status=${unpaidResponse.status}`);
    console.log(text);
    return;
  }

  const paymentRequiredHeader = unpaidResponse.headers.get("payment-required");
  const paymentRequiredResponse = decodePaymentRequiredHeader(paymentRequiredHeader);

  const accepts0 = paymentRequiredResponse?.accepts?.[0] ?? {};
  console.log(`[pay-cognition] payment_required_header_length=${paymentRequiredHeader?.length ?? 0}`);
  console.log(`[pay-cognition] x402Version=${String(paymentRequiredResponse?.x402Version ?? "")}`);
  console.log(`[pay-cognition] accepts[0].network=${String(accepts0.network ?? "")}`);
  console.log(`[pay-cognition] accepts[0].maxAmountRequired=${String(accepts0.maxAmountRequired ?? "")}`);
  console.log(`[pay-cognition] accepts[0].resource=${String(accepts0.resource ?? "")}`);

  let paymentHeaders = parseFallbackPaymentHeaderFromEnv();
  if (!paymentHeaders) {
    paymentHeaders = await maybeBuildSdkPaymentHeaders(paymentRequiredResponse);
  }

  if (!paymentHeaders) {
    throw new Error(
      "No payment credentials found. Set X402_PAYMENT_HEADER_B64 or FACILITATOR_PAYMENT_JSON, or provide EVM_PRIVATE_KEY with @x402/evm support."
    );
  }

  const paidResponse = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...paymentHeaders
    },
    body: JSON.stringify(selected.body)
  });

  const paidBodyText = await paidResponse.text();
  console.log(`[pay-cognition] paid_status=${paidResponse.status}`);
  console.log(paidBodyText);
}

main().catch((error) => {
  console.error("[pay-cognition] failed");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
