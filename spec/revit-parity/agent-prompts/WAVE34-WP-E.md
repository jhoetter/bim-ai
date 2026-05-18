# Wave 34 — WP-E: Tracker QA and Final Scan

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other Wave 34 agents may edit the tracker. Do not revert changes you did not make.

## Context

This is the QA pass for the tracker finalization wave. Focus on consistency checks, not product code.

## Ownership

Primary write scope:
- `spec/revit-parity/revit2026-parity-tracker.md` only for small consistency fixes.

Do not edit product code.

## Required Checks

Run these after other Wave 34 changes are available, or run once and report what remains:

```sh
perl -ne 'if(/^#{3,4} (.*)/){$h=$1;$l=$.;} if(/\\*\\*Status: (Partial|Not Started|N\\/A \\/ Partial)/){print "$l:$h => $&\\n"}' spec/revit-parity/revit2026-parity-tracker.md
rg -n "ray.?trac|raytrac|existing ribbon|mode-aware ribbon|Not Started|Partial|Implemented|out of scope|cloud-native|cloud/web-native" spec/revit-parity/revit2026-parity-tracker.md
git diff --check -- spec/revit-parity/revit2026-parity-tracker.md
```

## Required Work

1. Verify the tracker says:
   - Wave 33 completed by building on the existing mode-aware ribbon.
   - Ray tracing is N/A/out of scope.
   - Cloud-native save/version-history framing remains intact.
   - Desktop-only workflows are not presented as required cloud BIM parity.

2. If only stale wording remains, fix it.

3. If a real product gap remains, report it with exact section/line and do not silently mark it Done.

## Acceptance

- Final report lists remaining non-final statuses, if any.
- `git diff --check` passes for the tracker.

