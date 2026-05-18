# Wave 34 — WP-D: Summary Dashboard Consistency

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other Wave 34 agents may edit chapter sections. Do not revert changes you did not make.

## Context

The Summary Dashboard still contains old `Partial` chapter rows even though the Top P1/P2 gaps now say none confirmed after Wave 33. Your job is to make the dashboard consistent with canonical chapter decisions without hiding real gaps.

## Ownership

Primary write scope:

- `spec/revit-parity/revit2026-parity-tracker.md`, Summary Dashboard only, roughly lines 1125-end.

Do not edit product code.

## Required Work

1. Update the dashboard headline to include Wave 34 scheduled/in-progress if you start before other agents finish; otherwise prepare it for Wave 34 completion.

2. Make chapter summary rows consistent with canonical sections:
   - If a chapter row says `Partial`, there must be a current canonical Partial/Not Started gap or an explicit N/A/out-of-scope note.
   - Keep rows honest; do not flatten all chapters to Done if canonical sections still have real missing scope.

3. Keep Top P0/P1/P2 sections consistent with scans.

4. Add a Wave 34 scheduled note covering:
   - tracker finalization,
   - ray tracing out-of-scope confirmation,
   - existing ribbon foundation,
   - cloud/web-native boundary cleanup.

## Acceptance

- Dashboard does not contradict canonical sections.
- Top gaps list is generated from current tracker reality, not stale carryover.
