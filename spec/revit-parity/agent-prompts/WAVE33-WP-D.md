# Wave 33 — WP-D: Parity Tracker Cleanup for Ribbon Completion (§1.6.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other agents may complete Wave 33 implementation while you work. Do not revert their changes.

## Context

The tracker currently has only one explicit `Partial — P1`: §1.6.5 ribbon. It also contains stale dashboard "Top Gaps" text from earlier waves; several listed gaps are now Done/N/A in their canonical sections.

Your job is documentation/tracker hygiene for Wave 33. Do not claim implementation is complete until the code/tests from the other WPs exist.

## Ownership

Primary write scope:
- `spec/revit-parity/revit2026-parity-tracker.md`
- Optionally `spec/revit-parity/agent-prompts/WAVE33-README.md` if useful.

Do not edit product code.

## Orientation

Run:
- `perl -ne 'if(/^#{3,4} (.*)/){$h=$1;$l=$.;} if(/\\*\\*Status: (Partial|Not Started|N\\/A \\/ Partial)/){print "$l:$h => $&\\n"}' spec/revit-parity/revit2026-parity-tracker.md`
- `sed -n '70,95p' spec/revit-parity/revit2026-parity-tracker.md`
- `sed -n '1120,1230p' spec/revit-parity/revit2026-parity-tracker.md`

## Required Work

1. Add a Wave 33 scheduled note near the Summary Dashboard:
   - Topic: §1.6.5 ribbon completion.
   - WPs A-E: implementation, metadata, tests, tracker cleanup, QA/fix pass.

2. Clean stale "Top P1/P2 gaps" bullets only when their canonical section is already Done/N/A. Do not mark uncertain feature areas Done just because the dashboard list is stale.

3. After other agents land implementation, update §1.6.5:
   - Change status to Done only if the code and tests actually support the remaining tab coverage.
   - Add a concise Wave 33 note with files and test counts.

4. Preserve Wave 32 notes and test counts.

## Acceptance

- The tracker has no stale top-gap bullet contradicting a canonical Done/N/A section.
- §1.6.5 remains truthful: scheduled/in progress if code is not merged, Done only after verified completion.

