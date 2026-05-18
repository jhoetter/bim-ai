# Wave 34 — WP-C: Import/Export, Rendering, Family Editor Tracker Decisions

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other Wave 34 agents may edit different tracker ranges. Do not revert changes you did not make.

## Context

The user explicitly called out tracker correctness for decisions like ray tracing being out of scope and cloud/web-native behavior. This WP owns the later tracker sections where those decisions live.

## Ownership

Primary write scope:

- `spec/revit-parity/revit2026-parity-tracker.md`, roughly Chapters 12-15 / lines 930-1125.

Do not edit product code.

## Required Work

1. Inspect your range:
   - `sed -n '930,1125p' spec/revit-parity/revit2026-parity-tracker.md`
   - `rg -n "ray.?trac|raytrac|Not Started|Partial|Implemented|out of scope|cloud" spec/revit-parity/revit2026-parity-tracker.md`

2. Ensure §14.3 clearly remains `N/A`:
   - Ray-traced photorealistic rendering is out of scope for bim-ai.
   - Three.js real-time rendering remains the intended path.

3. Reconcile import/export prose with cloud/web-native decisions:
   - Do not promise desktop-only binary formats or physical printer workflows if out of scope.
   - If a workflow is boundary import/export only, say so explicitly.

4. Normalize `Implemented` statuses to `Done` where implementation notes and tests exist.

5. Keep family editor sections accurate: do not claim RFA compatibility unless it exists.

## Acceptance

- Ray tracing is unambiguously out of scope.
- Cloud/web-native import/export boundaries are clear.
- Later tracker sections have no stale status wording that conflicts with the implementation notes.
