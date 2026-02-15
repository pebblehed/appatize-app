# APPATIZE — INTELLIGENCE ENGINE ARCHITECTURE (Canonical)

This document defines the operational doctrine of the Appatize Intelligence Layer.

It is the enforcement core of the system and overrides feature-driven implementation decisions.

Mission Alignment:
Appatize exists to provide decision-grade cultural intelligence for strategic operators.
The Intelligence Layer must support human decision sovereignty, auditability, determinism, and long-horizon coherence.

This document defines how that is achieved.

---

# 1. Intelligence Layer Purpose

The Intelligence Layer transforms cultural signals into qualified, scored, risk-aware decision surfaces.

It does NOT:

- Generate arbitrary creative outputs
- Act autonomously
- Execute campaigns
- Replace human judgment

It DOES:

- Qualify moments
- Score signal quality
- Evaluate risk
- Enforce decision gates
- Provide rationale
- Preserve provenance
- Enable replay and audit

---

# 2. Moment Lifecycle Model

Every surfaced moment must move through explicit states:

1. DETECTED
2. QUALIFIED
3. SCORED
4. DECISIONED (ACT / WAIT / REFRESH)
5. ARCHIVED (memory persistence)

No moment may skip a state.

Lifecycle transitions must be deterministic.

---

# 3. Signal Qualification Rules

A signal becomes a "moment" only if:

- It originates from a valid source
- Timestamp is valid
- Signal count is measurable
- Source count is measurable
- Duplicate signals are deduplicated
- Volatile time-now values are excluded from evaluation

Single-source signals are automatically constrained to WAIT unless corroborated.

Qualification is rule-based, not model-opinion-based.

---

# 4. Quality Scoring Model

Each moment receives a deterministic Quality Score composed of:

- Signal Density (signalCount)
- Source Breadth (sourceCount)
- Velocity Stability (change over evaluation window)
- Temporal Recency (bounded, not time-now drift)
- Corroboration Level
- Signal Consistency

Weights must be versioned.
Score must be reproducible.

Quality score is advisory.
It does not override decision gates.

---

# 5. Velocity Model

Velocity is defined as rate-of-confirmed-signal-change over a bounded time window.

Velocity must:

- Use discrete evaluation windows
- Avoid time-now continuous recalculation
- Be reproducible
- Be independent of UI refresh cycles

Velocity cannot exist without at least two time points.

---

# 6. Risk Model

Risk evaluation includes:

- Volatility score
- Saturation score
- Negative sentiment indicator
- Single-source risk flag
- Unverified amplification flag

Risk cannot be inferred from single datapoints.
Risk must be explicit, not implied.

---

# 7. Decision Gating Logic

Decision states are constrained:

ACT:

- Requires minimum corroboration threshold
- Requires minimum quality score
- Must pass risk guard

WAIT:

- Default state when thresholds unmet

REFRESH:

- Used when signals are incomplete but promising

Decision state must include rationale.
Decision state must be reproducible.

No decision may be produced without documented evidence.

---

# 8. Human Sovereignty Guarantee

The system must:

- Surface decision rationale
- Expose provenance
- Expose scoring factors
- Allow override
- Log override events (future phase)

The system advises.
The human decides.

---

# 9. Audit Envelope Requirements

Every surfaced moment must include:

- trendId (deterministic)
- contractVersion
- provenance object
- decisionState
- decisionRationale
- quality metrics
- risk flags

Audit envelope must contain only stable primitives.

---

# 10. Memory Layer Interaction

Upon lifecycle completion:

- Moment must be archived
- Score snapshot must be stored
- Decision snapshot must be stored
- Contract version must be stored
- Provenance must be stored

Re-evaluation must create a new snapshot, not overwrite history.

---

# 11. Drift Resistance (HCIS Compliance)

The Intelligence Layer must:

- Version scoring weights
- Version decision thresholds
- Version risk logic
- Maintain deterministic evaluation
- Prevent silent behavioural changes
- Allow historical replay under original contract

No silent logic changes permitted.

---

# 12. Determinism Requirements

The Intelligence Layer must:

- Never depend on volatile time-now calculations
- Never fetch itself recursively
- Never produce non-reproducible results
- Always degrade gracefully (never 500)

Failure must return structured "unavailable" states.

---

# 13. Enforcement Principle

Feature expansion is prohibited unless:

- Intelligence enforcement is complete
- Decision gates are non-bypassable
- Memory persistence exists
- Risk scoring is implemented

Breadth without depth violates the architecture.

---

# Outcome

When fully implemented, the Intelligence Layer becomes:

A deterministic, auditable, human-aligned cultural decision engine capable of supporting enterprise-grade strategic operators.
