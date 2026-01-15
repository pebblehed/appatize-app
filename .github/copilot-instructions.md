# Copilot Instructions — Appatize (anti-drift)

You are working inside the Appatize codebase.

## Non-negotiables (always)

- Do NOT invent files, routes, types, APIs, or environment variables.
- If a referenced file is not provided, ask for its contents or use the repo search.
- Do NOT rename existing routes, folders, or exports.
- Do NOT introduce `any` unless explicitly requested.
- Prefer explicit types and stable contracts.
- Preserve the "never-500, never-hang, truth-only" approach for API routes.
- Do NOT add time-now derived fields (e.g., ageHours/recencyMins/velocityPerHour) to API responses unless explicitly requested.
- Do NOT change API response shapes unless explicitly instructed.

## Output rules

- If the user asks for “full file”, output a FULL FILE replacement only.
- If the user asks for a small change, output a minimal diff or the smallest safe snippet.
- Never output partial edits that require guessing surrounding code.
- Never add dependencies unless the user explicitly asks.

## Appatize architecture constraints (Stage D)

- `internal/` is for contracts, engines, evaluation, and provenance.
- Do NOT move application UI code into `internal/`.
- Contracts in `internal/contracts/` may define future-facing types; do not delete them for lint cleanliness.
- Avoid adding new intelligence in routes; keep routes deterministic and truth-only.

## Safety + quality

- No hallucinated "data", "metrics", or "citations".
- No placebo features.
- Prefer conservative, debuggable implementations.
- If uncertain, ask a single focused question rather than guessing.
