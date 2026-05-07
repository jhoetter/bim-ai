# wave3-6 status — KRN-10 + KRN-08

Both work-packages shipped to `main`.

## Commits

- `8f0b62cf feat(kernel): KRN-10 masking_region + area scaffolding (wave3-6)`
- `0d3b72d1 feat(kernel): KRN-08 area schedule + Architecture ribbon Area Boundary tool`

Both pushed via `wave3-6 -> main` direct-push protocol; KRN-08 commit
needed a one-conflict rebase against `KRN-07` (wave3-5 had updated the
adjacent row to `partial`) — resolution was trivial: kept the wave3-5
KRN-07 partial line and the new KRN-08 done line side by side.

## KRN-10 — masking region

- `masking_region` element kind in `packages/core/src/index.ts` and
  `app/bim_ai/elements.py`.
- Engine commands: `createMaskingRegion`, `updateMaskingRegion`,
  `deleteMaskingRegion` (validate host view kind ∈ {plan_view,
  section_cut, elevation_view} + ≥3-vertex boundary).
- Pure `extractMaskingRegionPrimitives` extractor +
  `PlanCanvas` render pass that paints the polygon at
  `SLICE_Y + 0.0015` — above element wires, below detail-component /
  dimension / tag z-bands so annotations stay visible.
- "Masking Region" button on the Annotate ribbon (load-bearing fallback
  while Agent 4 propagates SKT-01 sketch sessions to this kind) and
  first-class palette tool with hotkey `MR`, plus a two-click
  rectangular authoring path in `PlanCanvas`.
- Tests:
  - `app/tests/test_create_masking_region.py` — engine validation +
    update / delete lifecycle
  - `packages/web/src/plan/planProjection.maskingRegion.test.ts` —
    view-scoped extraction + default fillColor

**Acceptance:** masking region polygon obscures element linework
beneath it while detail components / tags / dimensions render on top;
not present in 3D views.

## KRN-08 — `area` element kind

- `area` element kind in core + `bim_ai/elements.py`
  (`AreaElem` with `boundaryMm`, `ruleSet`, `computedAreaSqMm`).
- Commands: `createArea`, `updateArea`, `deleteArea`.
- New `app/bim_ai/area_calculation.py`:
  - `gross` / `no_rules` → shoelace polygon area
  - `net` → polygon area minus any contained `slab_opening` shafts
    (vertex-in-polygon containment test)
- `recompute_all_areas` hook called at the end of every
  `apply_inplace`, so `computedAreaSqMm` always tracks the boundary +
  the current set of shafts.
- Plan rendering: dashed-red boundary stroke + canvas-texture sprite tag
  at the polygon centroid showing `<name> · X.XX m²`. Centroid uses the
  signed-area formula with a degenerate fallback to the arithmetic mean.
- Tool registry: `area-boundary` palette tool (hotkey `AR`) + two-click
  rectangular authoring fallback in `PlanCanvas` (sketch session path
  waits on Agent 4's SKT-01 propagation).
- `Area Schedule` category (cat="area") in `schedule_derivation`:
  rows expose `name`, `level`, `perimeterM`, `computedAreaM2`,
  `ruleSet`.
- Tests:
  - `app/tests/test_create_area.py` — engine + recompute integration
  - `app/tests/test_area_calculation.py` — every rule-set variant
  - `packages/web/src/plan/planProjection.area.test.ts` — extraction +
    centroid + tag-label format

**Acceptance:** 4m × 5m gross-rule area on a level produces
`computedAreaSqMm: 20_000_000` and the canvas tag reads
"Porch · 20.00 m²" at the centroid (verified by both the python
`test_create_area_succeeds_and_recomputes_gross` test and the web
`tagLabel` test).

## Quality gates

- `pnpm -F @bim-ai/web typecheck` — green after both commits.
- `python -m pytest` (full app suite) — 1354 passed, 7 skipped before
  rebase. Re-run not needed after rebase since the conflict was a
  spec-only markdown line.
- `pnpm -F @bim-ai/web test` — 191 files / 1988 tests passing on the
  KRN-08 commit base.

## File ownership / collisions

Owned: `app/bim_ai/area_calculation.py`,
`packages/web/src/plan/areaRender.ts`,
`packages/web/src/plan/maskingRegionRender.ts` and the matching
`*.test.ts(x)`/`test_*.py` files. All shared-territory edits
(`core/index.ts`, `elements.py`, `commands.py`, `engine.py`,
`PlanCanvas.tsx`, `toolRegistry.ts`, the i18n bundle, and the master
tracker) were strict appends to existing unions / lists. Only one
conflict (tracker KRN-07 row) on the second push, resolved cleanly.
