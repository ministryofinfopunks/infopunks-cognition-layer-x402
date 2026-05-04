# infopunks-cognition-layer

Infopunks Cognition Layer is an x402-paid cultural intelligence API for agents and humans.

It turns raw narrative, market noise, and agent output into coherent machine-usable intelligence.

Core primitives:

- `/v1/coherence-score`: measure whether an artifact is coherent enough to trust, route, amplify, or reject
- `/v1/extract-signal`: turn noise into usable cultural signal
- `/v1/simulate-narrative`: model how a narrative may evolve

Public tools become callable by agents through x402.
Signal Amplifier becomes `/v1/extract-signal`.
Narrative Simulator becomes `/v1/simulate-narrative`.
Coherence Score becomes the missing measurement layer.

## Mainnet Proof Archive

Canonical Infopunks v0 proof archive:
https://github.com/ministryofinfopunks/infopunks-v0-mainnet-proof

## Live x402 Cognition Layer

Base URL: https://infopunks-cognition-layer-x402.onrender.com

Infopunks Cognition Layer is an x402-paid cultural intelligence API for agents and humans on Base.

Paid endpoints:

- `POST /v1/coherence-score`
- `POST /v1/extract-signal`
- `POST /v1/simulate-narrative`

Public surfaces:

- OpenAPI: https://infopunks-cognition-layer-x402.onrender.com/openapi.json
- Discovery manifest: https://infopunks-cognition-layer-x402.onrender.com/.well-known/infopunks-cognition-layer.json
- Bazaar metadata: https://infopunks-cognition-layer-x402.onrender.com/.well-known/x402-bazaar.json
- Events feed: https://infopunks-cognition-layer-x402.onrender.com/v1/events/recent
- Proof index: https://infopunks-cognition-layer-x402.onrender.com/proof

Verified CDP x402 settled receipts:

- Coherence: https://infopunks-cognition-layer-x402.onrender.com/proof/rcpt_9d334cc2-af87-4187-8288-3a2b92077cde
- Signal: https://infopunks-cognition-layer-x402.onrender.com/proof/rcpt_d2647bd7-9450-4412-87a4-24de0d088398
- Narrative: https://infopunks-cognition-layer-x402.onrender.com/proof/rcpt_b690a47c-04a9-46fc-8715-94d0dcfe0a86

## Service surface

- `GET /health`
- `GET /openapi.json`
- `GET /.well-known/infopunks-cognition-layer.json`
- `GET /.well-known/x402-bazaar.json`
- `GET /war-room`
- `GET /war-room/recent`
- `GET /receipts/:id`
- `GET /proof/:id`
- `POST /v1/coherence-score`
- `POST /v1/extract-signal`
- `POST /v1/simulate-narrative`

## Paid endpoint pipeline

Every paid endpoint passes through the same pipeline:

1. validate input
2. require x402 payment
3. execute deterministic engine
4. hash result
5. create receipt
6. emit event
7. return output

## Local development

```bash
npm install
npm run dev
```

Default local mode uses mock payment verification and listens on `http://127.0.0.1:4024`.

## Mock payment flow

Unpaid requests return `402` with an x402-style challenge payload. Paid mock requests add:

```http
x402-mock-payment: paid
x402-mock-payer: local-buyer
```

## Environment

- `PORT`
- `PUBLIC_BASE_URL`
- `RUNTIME_DIR`
- `X402_REQUIRED_DEFAULT`
- `X402_VERIFIER_MODE=mock|facilitator`
- `X402_FACILITATOR_URL`
- `X402_NETWORK`
- `X402_ASSET_SYMBOL`
- `X402_PAYMENT_ASSET_ADDRESS`
- `X402_PAY_TO`
- `RECEIPT_HMAC_SECRET`
- `TOOL_PRICE_SCORE_COHERENCE_USD`
- `TOOL_PRICE_EXTRACT_SIGNAL_USD`
- `TOOL_PRICE_SIMULATE_NARRATIVE_USD`

Default public tool price is `0.01` USDC per call.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run readiness`
- `npm run smoke:unpaid`
- `npm run smoke:paid-mock`

## Testing

Tests are fully local:

- no database required
- no external LLM providers
- no facilitator dependency in mock mode
- deterministic engine assertions
- HTTP integration tests via Fastify injection
