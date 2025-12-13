# Appatize Stage D Intelligence Contract v1

This document is the canonical contract for the Appatize intelligence core.

- MSE (Moment Signal Extraction): internal/mse
- CIE (Cultural Intelligence Engine): internal/cie
- Adapters: src/lib/intelligence (thin wrappers only)
- API entrypoint: src/app/api/scripts/intelligence (delegates only)

Non-negotiables:
- Strict JSON output
- Stable response shape (ScriptGenerationResult)
- Behaviour controls are soft shaping, not truth overrides
- No other layer talks to OpenAI directly
