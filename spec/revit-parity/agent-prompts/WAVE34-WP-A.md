# Wave 34 — WP-A: Chapter 1 Tracker Finalization

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other Wave 34 agents may edit different tracker ranges. Do not revert changes you did not make.

## Context

Wave 33 completed §1.6.5 ribbon coverage by building on the existing `RibbonBar.tsx`, not by replacing the UI architecture. The tracker should now clearly reflect that decision.

## Ownership

Primary write scope:
- `spec/revit-parity/revit2026-parity-tracker.md`, Chapter 1 only, roughly lines 1-180.

Do not edit product code.

## Required Work

1. Normalize Chapter 1 statuses:
   - §1.6.5 must remain `Done — P1` and explicitly say bim-ai builds on the existing mode-aware ribbon.
   - §1.9 should not remain `N/A / Partial` if the Autodesk-specific portion is out of scope and bim-ai help/onboarding exists. Mark it `N/A` or `Done/N/A` with a clear explanation.

2. Remove stale text that says the ribbon is just a compact vertical palette/minimal top menu if that contradicts Wave 33.

3. Keep the ray tracing decision untouched here unless it is referenced in Chapter 1.

4. Run a tracker scan:
   - `perl -ne 'if(/^#{3,4} (.*)/){$h=$1;$l=$.;} if(/\\*\\*Status: (Partial|Not Started|N\\/A \\/ Partial)/){print "$l:$h => $&\\n"}' spec/revit-parity/revit2026-parity-tracker.md`

## Acceptance

- Chapter 1 has no stale Partial/Not Started status unless explicitly justified as non-blocking and canonical.
- The ribbon note says Wave 33 built on the existing ribbon surface.

