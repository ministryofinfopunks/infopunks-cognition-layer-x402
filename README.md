# Infopunks Cognition Layer

An x402-paid cultural intelligence API for agents and humans on Base.

## Live Service

Base URL:

```text
https://infopunks-cognition-layer-x402.onrender.com
```

Health:

```text
GET /health
```

Public event feed:

```text
GET /v1/events/recent
```

## Paid Resources

The Cognition Layer exposes three paid resources:

```text
POST /v1/coherence-score
POST /v1/extract-signal
POST /v1/simulate-narrative
```

Resource map:

- `/v1/coherence-score` measures whether an artifact is coherent enough to trust, route, amplify, or reject.
- `/v1/extract-signal` turns raw narrative, market noise, and agent output into usable cultural signal.
- `/v1/simulate-narrative` models how a narrative, protocol, launch, or market thesis may evolve.

## Live Proof

Fresh paid receipts are available from the public proof index:

```text
https://infopunks-cognition-layer-x402.onrender.com/proof
```

Recent paid events:

```text
https://infopunks-cognition-layer-x402.onrender.com/v1/events/recent
```

Receipt lookup template:

```text
https://infopunks-cognition-layer-x402.onrender.com/receipts/{receipt_id}
```

Receipt IDs are generated per paid call and may rotate after redeploy while v0 uses in-memory proof storage.

Receipts expose public metadata only: receipt id, paid endpoint, final status, x402 verification status, facilitator provider, network, asset, payTo, result hash, created timestamp, proof URL, and settlement reference when available.

## x402 / Base Configuration

Current public configuration:

```text
Facilitator: CDP x402
Network: Base mainnet
Network CAIP-2: eip155:8453
Asset: USDC
Payment scheme: exact
Default price: 0.01 USDC per paid call
```

The service returns a `402 Payment Required` challenge when a paid resource is called without a valid x402 payment header. A successful paid call returns `200` and attaches a public receipt object to the response.

## Discovery

Infopunks discovery manifest:

```text
https://infopunks-cognition-layer-x402.onrender.com/.well-known/infopunks-cognition-layer.json
```

x402 Bazaar metadata:

```text
https://infopunks-cognition-layer-x402.onrender.com/.well-known/x402-bazaar.json
```

The discovery metadata advertises all three paid resources, their route templates, pricing, Base network configuration, and Bazaar-compatible resource descriptions.

## OpenAPI

OpenAPI contract:

```text
https://infopunks-cognition-layer-x402.onrender.com/openapi.json
```

The OpenAPI document includes request and response schemas for:

```text
/v1/coherence-score
/v1/extract-signal
/v1/simulate-narrative
/receipts/{receipt_id}
/v1/events/recent
```

## Example Paid Call

Example paid request shape for `/v1/coherence-score`:

```bash
curl -i 'https://infopunks-cognition-layer-x402.onrender.com/v1/coherence-score' \
  -X POST \
  -H 'content-type: application/json' \
  -H 'x402-payment: <x402-payment-payload>' \
  -d '{
    "artifact": "Agents need paid cognition before they route capital, trust, or narrative amplification.",
    "context": "Evaluate this as a launch claim for an agent-facing cultural intelligence API.",
    "criteria": ["technical credibility", "thesis alignment", "actionability"],
    "audience": "agents and founders",
    "intended_action": "publish and route"
  }'
```

Expected paid result:

```text
HTTP 200
```

The response includes the cognition result and a `receipt` object.

## Local Development

Install dependencies:

```bash
npm install
```

Run the service locally:

```bash
npm run dev
```

Build and test:

```bash
npm run typecheck
npm test
npm run build
```

Local development can use mock payment verification. Production deployments should use facilitator verification through CDP x402.

## Environment Variables

Core runtime:

```text
PORT
PUBLIC_BASE_URL
RUNTIME_DIR
NODE_ENV
```

x402 configuration:

```text
X402_REQUIRED_DEFAULT
X402_VERIFIER_MODE
X402_FACILITATOR_URL
X402_NETWORK
X402_ASSET_SYMBOL
X402_PAYMENT_ASSET_ADDRESS
X402_PAY_TO
X402_SCHEME
```

Receipt and pricing configuration:

```text
RECEIPT_HMAC_SECRET
TOOL_PRICE_SCORE_COHERENCE_USD
TOOL_PRICE_EXTRACT_SIGNAL_USD
TOOL_PRICE_SIMULATE_NARRATIVE_USD
```

CDP facilitator credentials, when facilitator mode is enabled:

```text
CDP_API_KEY_ID
CDP_API_KEY_SECRET
```

## Status

Phase 2: Coherence + Signal is confirmed as a v0 mainnet proof.

Fresh paid receipts:

- `/v1/coherence-score`: `rcpt_263b4835-42ad-46a2-923b-a1369560cd2e`
- `/v1/extract-signal`: `rcpt_f9b215d4-b39a-4217-8660-72329493adc8`
- `/v1/simulate-narrative`: `rcpt_8a132191-7cc2-4fda-9f88-0215b5d76885`

All three calls returned `200`, were x402 verified through CDP, and include settled receipt references.
