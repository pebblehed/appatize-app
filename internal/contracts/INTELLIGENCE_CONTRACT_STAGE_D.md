# Appatize — Intelligence Contract (Stage D)

**Status:** Active
**Applies from:** Stage D onward
**Audience:** Humans, Copilot, future contributors, future AI systems
**Enforcement level:** Hard (non-negotiable)

---

## 0. Purpose of This Contract

This document defines the **non-negotiable intelligence boundaries** of Appatize.

It exists to:

- Prevent drift
- Prevent hallucinated intelligence
- Prevent silent scope expansion
- Preserve the original mission, intent, and ethical posture of the product

If any future change conflicts with this contract, **the change is invalid**, even if it “works.”

---

## 1. Core Philosophy (North Star Alignment)

Appatize exists to help humans **read the room**, not invent it.

The system:

- Observes
- Aggregates
- Qualifies
- Surfaces confidence

It does **not**:

- Predict the future
- Invent cultural meaning
- Replace human judgment
- Pretend to know more than the evidence allows

> Intelligence in Appatize is restraint, not cleverness.

---

## 2. Intelligence Architecture Overview

Appatize intelligence is split into two distinct, isolated layers:

### 2.1 MSE — Moment Signal Engine

**Role:** Observation & qualification
**Function:** Decide _whether something is happening_

### 2.2 CIE — Cultural Intelligence Engine

**Role:** Interpretation & expression
**Function:** Decide _how to speak about what is happening_

These layers **must never be merged**, blurred, or shortcut.

---

## 3. MSE (Moment Signal Engine) — Contract

### 3.1 What MSE IS allowed to do

MSE may:

- Aggregate signals from deterministic sources (e.g. Reddit, feeds)
- Count signals
- Count sources
- Track timestamps (first seen, last confirmed)
- Compute recency, age, velocity
- Apply deterministic thresholds
- Surface:
  - DecisionState (ACT / WAIT / REFRESH)
  - SignalStrength (WEAK / MODERATE / STRONG)
  - ConfidenceTrajectory (ACCELERATING / STABLE / WEAKENING / VOLATILE)

MSE **may downgrade decisions** when evidence is insufficient.

---

### 3.2 What MSE is NOT allowed to do

MSE must **never**:

- Generate language beyond factual summaries
- Guess intent, meaning, or motivation
- Use LLMs or probabilistic reasoning
- Invent signals, sources, or confidence
- Promote ACT without corroboration rules being met
- Change outputs based on UI, user preference, or marketing goals

If data is missing, MSE must say:

> _“Insufficient evidence”_

---

### 3.3 MSE Output Rules

- Outputs must be reproducible from the same inputs
- No randomness
- No hidden state
- No memory beyond explicit evidence fields
- No silent upgrades

---

## 4. CIE (Cultural Intelligence Engine) — Contract

### 4.1 What CIE IS allowed to do

CIE may:

- Translate evidence into **human-readable insight**
- Shape tone and framing based on platform context
- Explain _why something matters_ **using only MSE evidence**
- Generate multiple angles from the same qualified moment
- Adapt expression without changing meaning

CIE operates **downstream** of MSE and may not contradict it.

---

### 4.2 What CIE is NOT allowed to do

CIE must **never**:

- Override DecisionState
- Invent evidence
- Upgrade weak signals into strong narratives
- Add urgency where MSE says WAIT or REFRESH
- Speak with certainty beyond the evidence
- Claim prediction or foresight

If MSE says WAIT, CIE must respect WAIT.

---

### 4.3 CIE Output Rules

- Insight must be traceable to evidence
- Language must include uncertainty where present
- No “trendwashing”
- No hype
- No fabricated cultural authority

---

## 5. Cross-Layer Rules (Absolute)

The following are **hard prohibitions**:

- ❌ No AI guessing upstream of qualification
- ❌ No collapsing MSE + CIE into one step
- ❌ No “helpful” intelligence that exceeds evidence
- ❌ No silent fallbacks that invent confidence
- ❌ No UI-driven intelligence changes

All intelligence must survive this question:

> “Could a skeptical human audit this and agree it’s fair?”

If not, it violates the contract.

---

## 6. Determinism & Failure Modes

When something fails:

- Return safe empty states
- Preserve last known-good data (if explicitly cached)
- Never fabricate replacements
- Never mask failure as intelligence

Silence is preferable to fiction.

---

## 7. Enforcement

This contract:

- Applies to all current and future code
- Applies to Copilot instructions
- Applies to prompts, helpers, and utilities
- Applies regardless of deadlines or pressure

Any contributor or tool violating this contract is **wrong by definition**, even if the output looks good.

---

## 8. Amendment Rule

This contract may only be changed if:

1. The change is written explicitly
2. The reason is documented
3. The risk of drift is acknowledged
4. The founder approves the change knowingly

No silent evolution.

---

## 9. Summary (Non-Technical)

Appatize does not try to be smart.

It tries to be **honest, disciplined, and useful**.

That is the moat.

---

**End of contract**
