# Reviewer summary — production parity batch (`e04c4bd`)

## Baseline

- **Commit:** `e04c4bd` on `main`.
- **Python CI:** green (ruff + pytest + IFC extras).
- **JS CI:** initially failed on `pnpm/action-setup@v4` (duplicate major `version` vs root `packageManager`); fixed in a follow-up commit by letting `pnpm/action-setup` infer pnpm from `package.json`'s `"packageManager": "pnpm@9.15.4"` (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## What shipped (high level)

- **Saved views:** Plan/orbit viewpoints editable and persisted via semantic property updates (`updateElementProperty`).
- **Sheets:** Replayable viewport authoring (`upsertSheetViewports`), `SheetCanvas` + authoring UI; keyed remount to keep viewport drafts in sync without invalid React patterns.
- **Sections / graphics:** Richer section-style SVG preview wiring; continued plan/projection and symbology work.
- **Schedules:** Optional grouping metadata on schedule filter upserts; toolbar sort/group; door/window `materialKey` in model + derivation + persisted column registry; property updates on doors/windows for type/material.
- **Validation:** Room programme consistency constraint (+ tests).
- **Open BIM:** IFC fills with optional material finish; export + read-back test when `ifcopenshell` is installed.
- **Agent / evidence:** Stronger mismatch notes where sheet/3D evidence rows lack expected PNG refs; Playwright/evidence correlation hints unchanged in CI.

## Collaboration flow (recommended)

- **Truth branch:** feature work landed on **`main`**; no separate PR is required unless your process mandates review-before-merge—then use **`main` as baseline** and open topic PRs forward.
- **Next features:** Branch from **`main` after CI is fully green**:

  ```bash
  git checkout main && git pull
  git checkout -b parity/<topic-short-name>
  ```

## Review focus

- Prefer behavior + regression tests touched in `app/tests/` for schedules, IFC, constraints, sheet viewports, and door material updates.
- Web: hooks correctness in [`packages/web/src/workspace/SheetCanvas.tsx`](../packages/web/src/workspace/SheetCanvas.tsx); sheet authoring in [`packages/web/src/workspace/sheetViewportAuthoring.tsx`](../packages/web/src/workspace/sheetViewportAuthoring.tsx).
