# INTELLIGENCE_CONTRACT_STAGE_D

## Status

**ACTIVE — GOVERNANCE ONLY**

This contract defines the intelligence boundaries, sequencing rules, and non-negotiables for Appatize during Stage D development.

At this point in the build:

- This contract **guides behaviour**
- It does **not require implementation**
- It exists to prevent drift, scope creep, and premature intelligence layering

---

## Core Product Truth

Appatize is a **Cultural Intelligence Platform**, not:

- A copy generator
- A trend prediction engine
- A generic AI assistant
- A retrospective analytics dashboard

Its job is to:

> **Help humans read the room before they act.**

---

## Intelligence Layers (Canonical)

Appatize intelligence is split into **two distinct layers**.
They must **never be merged**.

### 1. MSE — Moment Sensing Engine

**Purpose:** Detect _what is happening_ in the world.

- Inputs:
  - Signals (e.g. Reddit, social, communities)
  - Counts, timestamps, density, breadth
- Outputs:
  - Candidate moments
  - Deterministic evidence primitives
- Rules:
  - No interpretation
  - No language generation
  - No creative output
  - No opinion

> MSE answers: _“Is something happening?”_

---

### 2. CIE — Cultural Intelligence Engine

**Purpose:** Interpret _why a moment matters_ and _how to act responsibly_.

- Inputs:
  - Moment evidence from MSE
  - Decision fields
  - Constraints (platform, tone, ethics)
- Outputs:
  - Why-this-matters
  - Action framing
  - Creative direction scaffolding
- Rules:
  - Never invent evidence
  - Never override truth
  - Never optimise for virality alone

> CIE answers: _“What does this mean for humans?”_

---

## Current Build Reality (Important)

In the **current working build**:

- ❌ MSE is **not yet modularised**
- ❌ CIE is **not yet implemented**
- ✅ Deterministic logic exists inline (Stage 3.x)
- ✅ Contracts exist to prevent mis-implementation

This is intentional.

**We do NOT recreate CIE/MSE folders until:**

- The live product is stable
- The intelligence boundary is enforced by contract
- We are explicitly starting the CIE/MSE stage

---

## Allowed Intelligence (Stage D – Now)

The following are **explicitly allowed** right now:

- Deterministic logic
- Evidence normalization
- Decision surfacing based on counts + timestamps
- Confidence trajectories
- Stop rules
- Minimal action hints
- Why-this-matters text **derived only from evidence**

The following are **explicitly forbidden**:

- Guessing missing data
- Predictive language
- “AI intuition”
- Creative generation inside intelligence
- Any logic that optimises for engagement alone

---

## UI Contract (Non-Negotiable)

UI may:

- Display intelligence
- Explain decisions
- Surface confidence and uncertainty
- Encourage restraint

UI must **never**:

- Present intelligence as fact when uncertain
- Hide uncertainty
- Override stop rules
- Force action

---

## Drift Prevention Rules

If any of the following appear, **STOP**:

- “We could just add a quick AI here…”
- “Let’s guess the intent…”
- “It’s probably about X…”
- “Users expect predictions…”

These are **anti-Appatize behaviours**.

---

## Sequencing Lock

Order of intelligence development is fixed:

1. Stable signal ingestion
2. Deterministic evidence
3. Decision surfacing
4. Stop rules
5. Minimal action hint
6. CEP (Creator Execution Pack)
7. ⛔ THEN — CIE modularisation
8. ⛔ THEN — MSE modularisation

Skipping steps breaks the product.

---

## Founder Intent (North Star Alignment)

Appatize exists to:

- Reduce cultural misfires
- Help brands act with timing and restraint
- Respect human context
- Value _not acting_ as much as acting

If a feature violates this:

> **It does not ship.**

---

## Enforcement

This contract:

- Is referenced before any intelligence change
- Overrides convenience and speed
- Exists to protect the product long-term

If there is ambiguity:

> Default to restraint.

---

**End of Contract — Stage D**
