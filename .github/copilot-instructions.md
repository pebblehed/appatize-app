# Copilot Instructions Appatize (anti-drift)

You are working inside the Appatize codebase.

## Non-negotiables

- Do NOT invent files, routes, types, or APIs. If unsure, ask for the file contents or search within the repo.
- Do NOT introduce `any` unless explicitly requested. Prefer `unknown` + type guards.
- Do NOT fake intelligence. Deterministic only unless a specific LLM route is being implemented.
- API routes must be **never-500** and return safe empty states.
- Keep contracts stable. If a change impacts contracts, state it explicitly and update the contract files.

## Source of truth (read these first when making changes)

- internal/contracts/NORTH_STAR.md
- internal/contracts/ (any other contract docs you add)
- src/context/BriefContext.tsx (core Trend/Brief types)
- src/context/TrendContext.tsx (pin/save behavior)

## Engineering style

- Prefer small, explicit helper functions (type guards) over broad casts.
- Preserve existing file names and public exports.
- When editing a file: provide a full-file replacement unless asked for a diff.

## Appatize truth-only principles

- No time-now volatile fields in API payloads if it can cause client refetch loops.
- If upstream is unavailable, return `{ status: "unavailable", trends: [] }` with HTTP 200 (never-500 pattern).

## Working method

- One file at a time.
- Start by stating what warnings/errors you are fixing (line refs), then implement.
