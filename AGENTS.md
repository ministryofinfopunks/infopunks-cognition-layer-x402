# AGENTS

## Purpose

This repo implements the standalone Infopunks Cognition Layer. Keep it operationally separate from the Trust Layer repo and avoid cross-repo runtime coupling.

## Canonical language

Infopunks Cognition Layer is an x402-paid cultural intelligence API for agents and humans.

It turns raw narrative, market noise, and agent output into coherent machine-usable intelligence.

Core primitives:

- `/v1/coherence-score`: score whether an artifact makes sense
- `/v1/extract-signal`: turn noise into usable cultural signal
- `/v1/simulate-narrative`: model how a narrative may evolve

Public tools become callable by agents through x402.
Signal Amplifier becomes `/v1/extract-signal`.
Narrative Simulator becomes `/v1/simulate-narrative`.
Coherence Score becomes the missing measurement layer.

## Guardrails

- Preserve deterministic behavior for all cognition engines.
- Do not introduce external LLM providers.
- Do not require a database for local tests.
- Do not hardcode secrets or private keys.
- Keep the HTTP API stable and agent-friendly.
- Every paid success path must continue to follow this pipeline:
  validate input, require x402 payment, execute deterministic engine, hash result, create receipt, emit event, return output.
- Preserve `.well-known` discovery, OpenAPI, War Room feed, receipt JSON, and proof page surfaces.

## Payment model

- Local and test environments use `X402_VERIFIER_MODE=mock`.
- Production must use `X402_VERIFIER_MODE=facilitator`.
- Keep shared paid-route behavior centralized under `src/x402/`.

## Testing expectations

Before handing off changes, run:

```bash
npm run typecheck
npm test
npm run build
```

If you touch endpoint contracts, also inspect:

- `GET /openapi.json`
- `GET /.well-known/infopunks-cognition-layer.json`
- `GET /.well-known/x402-bazaar.json`
