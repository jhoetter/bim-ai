# Wave 34 — WP-B: Mid-Tracker Implemented/Partial Wording Audit

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other Wave 34 agents may edit different tracker ranges. Do not revert changes you did not make.

## Context

After Wave 33, the tracker still contains many old `Implemented` statuses and prose mentions of `Partial` or `Not Started` inside sections whose implementation notes say the work exists. This wave is tracker hygiene, not feature implementation.

## Ownership

Primary write scope:
- `spec/revit-parity/revit2026-parity-tracker.md`, roughly Chapters 2-11 / lines 180-930.

Do not edit product code.

## Required Work

1. Inspect statuses in your range with:
   - `sed -n '180,930p' spec/revit-parity/revit2026-parity-tracker.md`
   - `rg -n "\\*\\*Status: Implemented|Partial|Not Started" spec/revit-parity/revit2026-parity-tracker.md`

2. Convert `**Status: Implemented ...**` to `**Status: Done ...**` where the section text already describes a concrete implementation and tests.

3. Do not falsely mark actual missing product engines Done. If a section says a sub-engine is still partial, keep the canonical status honest, but clarify whether the missing item is out of scope, lower priority, or tracked elsewhere.

4. Pay special attention to massing wording:
   - The product has mass primitives and mass-to-BIM generation.
   - Do not claim a Revit desktop conceptual mass environment if it does not exist.
   - Phrase remaining gaps as out-of-scope or tracked in canonical modeling sections only if justified by existing tracker decisions.

## Acceptance

- No misleading `Implemented` status remains in the assigned range when `Done` is more accurate.
- No stale `Not Started` prose contradicts an implemented feature note.

