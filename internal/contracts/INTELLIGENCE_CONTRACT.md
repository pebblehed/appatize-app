# Appatize — Intelligence Contract

## Purpose

This contract defines the non-negotiable rules governing Appatize’s intelligence layer.

It exists to:

- Prevent drift
- Prevent fake intelligence
- Enforce deterministic, explainable behaviour
- Protect the product’s mission over time

## Core Rules

1. Intelligence must be truth-first

- No guessing
- No hallucination
- No invented confidence

2. Deterministic before generative

- Signals → Evidence → Decisions must be explainable
- LLMs may express, never decide

3. Never break the UI–Engine contract

- APIs must be stable
- Empty states are valid states
- Never return 500s for intelligence failure

4. Governance beats convenience

- If behaviour is unclear, stop
- If meaning is ambiguous, label it as such
- If evidence is weak, say so

## Scope

This contract governs:

- MSE
- CIE
- Decision surfacing
- Script generation logic

It does NOT govern:

- UI styling
- Animation
- Presentation-only concerns

---

This file is intentionally human-readable.
It is enforced socially, structurally, and eventually programmatically.
