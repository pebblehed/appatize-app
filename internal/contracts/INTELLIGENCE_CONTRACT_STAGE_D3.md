# Stage D.3 — Moment Quality Firewall (Contract)

This stage introduces a mandatory quality gate for all live fused moments.

A moment MUST pass `qualifyMoment()` before it can be returned from
`/api/trends/live`.

## Guarantees
- No moment bypasses the quality gate.
- Rejected moments do not propagate downstream.
- Quality evaluation is deterministic and explainable.
- Velocity is explicitly disabled until reliable timestamps exist upstream.

## Change Control
Any modification to:
- signal shape,
- quality weights,
- quality thresholds,
- gating logic,

must be treated as a new Stage D change and explicitly committed.
