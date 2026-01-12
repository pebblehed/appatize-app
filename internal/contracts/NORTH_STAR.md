# Appatize — North Star Contract (Repo Truth)

## Mission

Appatize helps brands and creative teams **read the room** by turning live cultural signals into **moment-ready guidance**.

## Product promise

Deliver **deterministic, truth-first** outputs that help a human decide:

- What’s happening
- Why it matters
- What to do next (minimal action)
  …without inventing evidence.

## Non-negotiables

1. **Never fake intelligence**
   - If uncertain or unavailable, return safe empty states.
2. **Never 500**
   - API routes must degrade gracefully.
3. **Deterministic by default**
   - No LLM calls in signal/decision layers.
4. **Separation of concerns**
   - MSE = signal + evidence primitives
   - CIE = intelligence/expression (only when enabled, explicitly)
5. **Stable contracts**
   - UI consumes typed, stable payloads.
   - No “time-now” derived fields that change every request unless explicitly required and protected from refetch loops.

## Stage discipline

- Build one stage at a time.
- Each stage must be shippable.
- No side-quests unless explicitly scheduled.

## Definition of Done (for any change)

- Types pass
- ESLint clean
- No new drift fields
- Outputs still match “truth-only” rules
