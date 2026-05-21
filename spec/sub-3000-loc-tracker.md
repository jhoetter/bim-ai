# BIM AI - Sub-3000 LOC God File Tracker

Last updated: 2026-05-22

Purpose: take the remaining hand-written source files below **3,000 LOC**
(ideally well under). The predecessor `spec/god-file-reduction-tracker.md`
closed at a 4,000 LOC A-territory bar; this tracker raises the standard.

This tracker is the active successor for ongoing god-file reduction. The main
`spec/code-quality-tracker.md` remains at B / 8.0 with all CQ rows Done.

Source-of-truth size query:

```bash
node scripts/code-quality-report.mjs --json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'{r[\"lines\"]:>5}  {r[\"path\"]}') for r in d['maintainability']['largestFiles'][:25]]"
```

## Current Baseline (2026-05-22)

The generated scorecard now flags a regression:

```
largest source file app/bim_ai/routes_api.py has 4745 lines and exceeds the 3950 line growth cap
```

This was caused by ~20 recent reverse-BIM commits adding routes to
`routes_api.py` directly instead of extending the extracted
`routes_query_resolve.py` / `routes_presentation.py` pattern.

Files at or above 3,000 LOC at tracker start:

| Rank | File                                                         | Lines | Notes                                                                            |
| ---: | :----------------------------------------------------------- | ----: | :------------------------------------------------------------------------------- |
|    1 | `app/bim_ai/routes_api.py`                                   | 4,745 | Reverse-BIM/source/QA cluster grew this back from 3,753.                         |
|    2 | `packages/web/src/Viewport.tsx`                              | 3,830 | 3D viewport shell.                                                               |
|    3 | `packages/web/src/plan/PlanCanvas.tsx`                       | 3,798 | Plan interaction shell.                                                          |
|    4 | `packages/web/src/viewport/meshBuilders.ts`                  | 3,777 | Mesh builder collection.                                                         |
|    5 | `packages/cli/cli.mjs`                                       | 3,723 | CLI dispatch entrypoint.                                                         |
|    6 | `app/bim_ai/elements.py`                                     | 3,715 | Element model aggregator.                                                        |
|    7 | `packages/web/src/workspace/inspector/InspectorContent.tsx`  | 3,679 | Inspector switchboard.                                                           |
|    8 | `scripts/audit-ui-mcp-parity.mjs`                            | 3,623 | Audit orchestration.                                                             |
|    9 | `packages/web/src/cmdPalette/defaultCommands.ts`             | 3,621 | Default command catalogue (registry).                                            |
|   10 | `packages/web/src/tools/toolGrammar.ts`                      | 3,603 | Tool grammar reducer module.                                                     |
|   11 | `packages/web/src/workspace/commandCapabilities.ts`          | 3,560 | Workspace command capability map (registry).                                     |
|   12 | `packages/web/src/workspace/project/ProjectBrowser.tsx`      | 3,546 | Project browser shell.                                                           |
|   13 | `app/bim_ai/commands.py`                                     | 3,510 | Command schema aggregator.                                                       |
|   14 | `packages/core/src/index.ts`                                 | 3,387 | Public barrel (re-export facade).                                                |
|   15 | `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`    | 3,341 | Family editor shell.                                                             |
|   16 | `packages/web/src/workspace/Workspace.tsx`                   | 3,293 | Workspace shell.                                                                 |
|   17 | `app/bim_ai/api/registry.py`                                 | 3,268 | API descriptor registry.                                                         |
|   18 | `app/bim_ai/model_integrity.py`                              | 3,149 | Model integrity validation.                                                      |
|   19 | `packages/web/src/workspace/WorkspaceRightRail.tsx`          | 3,015 | Workspace side rail.                                                             |

Watch zone (2,500-3,000 LOC) so they do not cross 3,000:

- `packages/cli/lib/sketch-initiation.mjs` 2,926
- `app/bim_ai/folder_output.py` 2,821
- `packages/web/src/plan/symbology.ts` 2,721
- `packages/web/src/plan/planElementMeshBuilders.ts` 2,563
- `app/bim_ai/export_gltf.py` 2,503

## Operating Rules

- One file at a time. Narrow, focused extractions.
- Before staging, check `git status` and only add the files you touched; never
  `git add -A` or `git add .` (parallel agents may have unrelated changes).
- For each slice:
  1. Identify a cohesive, stable cluster (route group, reducer family,
     inspector branch, render pass, etc.).
  2. Extract to a new sibling module.
  3. Preserve the original public surface via re-exports where downstream
     callers might depend on the original location.
  4. Run focused tests for the affected area.
  5. Commit specific file paths.
- Preserve existing public API paths exactly (URLs, function names,
  type exports). Internal refactors only.
- Update the tracker work-package status as each slice lands.

## Targets

Slice-level exit signal: file below **3,000 LOC**.

A-territory bar after the sweep:

- no hand-written source file above **3,000 LOC** (any kind).
- watch-zone files do not grow above 3,000 LOC.
- after the sweep, tighten `sourceGrowthBudget.maxLargestSourceLines` in
  `spec/code-quality-budgets.json` to `2,950`.

## Work Packages

| ID            | Priority | Status  | File                                                         | Target slice                                                          | Exit signal                                                |
| :------------ | :------- | :------ | :----------------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------- |
| SLC-2026-01   | P0       | Done    | `app/bim_ai/routes_api.py`                                   | Extract reverse-BIM + source + reverse-BIM-QA routes                 | Routes API below 3,500 LOC.                                |
| SLC-2026-02   | P0       | Done    | `app/bim_ai/routes_api.py`                                   | Extract IFC/DXF, sharing, and v3-meta routes                          | Routes API below 3,000 LOC.                                |
| SLC-2026-03   | P1       | Open   | `packages/web/src/Viewport.tsx`                              | Extract another viewport hook cluster                                 | Viewport below 3,000 LOC.                                  |
| SLC-2026-04   | P1       | Open   | `packages/web/src/plan/PlanCanvas.tsx`                       | Extract another plan canvas slice                                     | PlanCanvas below 3,000 LOC.                                |
| SLC-2026-05   | P1       | Open   | `packages/web/src/viewport/meshBuilders.ts`                  | Extract another mesh-builder family                                   | meshBuilders below 3,000 LOC.                              |
| SLC-2026-06   | P1       | Open   | `packages/cli/cli.mjs`                                       | Extract another CLI command family                                    | cli.mjs below 3,000 LOC.                                   |
| SLC-2026-07   | P1       | Open   | `app/bim_ai/elements.py`                                     | Extract another element family                                        | elements.py below 3,000 LOC.                               |
| SLC-2026-08   | P1       | Open   | `packages/web/src/workspace/inspector/InspectorContent.tsx`  | Extract another inspector cluster                                     | InspectorContent below 3,000 LOC.                          |
| SLC-2026-09   | P2       | Open   | `scripts/audit-ui-mcp-parity.mjs`                            | Extract another audit module                                          | Audit script below 3,000 LOC.                              |
| SLC-2026-10   | P1       | Open   | `packages/web/src/cmdPalette/defaultCommands.ts`             | Split command catalogue by family                                     | defaultCommands below 3,000 LOC.                           |
| SLC-2026-11   | P1       | Open   | `packages/web/src/tools/toolGrammar.ts`                      | Extract another reducer cluster                                       | toolGrammar below 3,000 LOC.                               |
| SLC-2026-12   | P1       | Open   | `packages/web/src/workspace/commandCapabilities.ts`          | Split capability map by family                                        | commandCapabilities below 3,000 LOC.                       |
| SLC-2026-13   | P1       | Open   | `packages/web/src/workspace/project/ProjectBrowser.tsx`      | Extract another browser group                                         | ProjectBrowser below 3,000 LOC.                            |
| SLC-2026-14   | P1       | Open   | `app/bim_ai/commands.py`                                     | Extract another command schema family                                 | commands.py below 3,000 LOC.                               |
| SLC-2026-15   | P2       | Open   | `packages/core/src/index.ts`                                 | Extract another type cluster                                          | core/index below 3,000 LOC.                                |
| SLC-2026-16   | P1       | Open   | `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`    | Extract another panel cluster                                         | Workbench below 3,000 LOC.                                 |
| SLC-2026-17   | P1       | Open   | `packages/web/src/workspace/Workspace.tsx`                   | Extract another workspace hook cluster                                | Workspace below 3,000 LOC.                                 |
| SLC-2026-18   | P1       | Open   | `app/bim_ai/api/registry.py`                                 | Extract another descriptor group                                      | registry.py below 3,000 LOC.                               |
| SLC-2026-19   | P1       | Open   | `app/bim_ai/model_integrity.py`                              | Extract a validation family                                           | model_integrity below 3,000 LOC.                           |
| SLC-2026-20   | P2       | Open   | `packages/web/src/workspace/WorkspaceRightRail.tsx`          | Extract another right-rail cluster                                    | WorkspaceRightRail below 3,000 LOC.                        |
| SLC-2026-21   | P3       | Open   | `spec/code-quality-budgets.json`                             | Tighten `maxLargestSourceLines` to 2950                               | Budget config reflects the new sub-3000 bar.               |

## Progress Log

- 2026-05-22: tracker created. The committed baseline shows 19 hand-written
  files at or above 3,000 LOC, with `app/bim_ai/routes_api.py` at 4,745 LOC
  exceeding the existing 3,950 LOC growth cap and triggering a
  blockersToNextGrade entry in the generated scorecard.
- 2026-05-22: `SLC-2026-01` moved to Partial. The first slice extracted the
  source ingestion (`/api/v3/source/*`) and the non-hybrid-execute reverse-BIM
  (`/api/v3/reverse-bim/*`, `/api/v3/qa/*`) routes into
  `app/bim_ai/routes_reverse_bim.py`. Unused imports left over from the moved
  routes were trimmed in `routes_api.py`. Local `wc -l` reports
  `routes_api.py` at `3,915` lines, down from `4,745`. Python compile, ruff,
  and the focused `test_reverse_bim_source_ingestion`,
  `test_reverse_bim_acceptance_evidence`, `test_source_coordinate_frames`, and
  `test_hybrid_reverse_bim` suites all pass. The hybrid-slice-execute and
  hybrid-run-execute routes remain in `routes_api.py` because they call into
  the bundle apply path defined later in the same file; they will move when
  the bundle apply path is itself extracted.
- 2026-05-22: `SLC-2026-01` and `SLC-2026-02` are Done. Three more route
  modules were extracted from `routes_api.py`:
  - `routes_imports.py` owns IFC/DXF/DWG import + upload + material-asset
    validation (~496 lines moved).
  - `routes_sharing.py` owns role management, public-link, and shared-token
    routes (~352 lines moved); the cross-module helpers `resolve_caller_role`
    and `resolve_token_role` migrated to `routes_deps.py`.
  - `routes_v3_meta.py` owns v3 visual compare, SKB checkpoint, tool registry,
    advisor rules, command schema, and version routes (~120 lines moved).
  Local `wc -l` reports `routes_api.py` at `2,909` lines, below the 3,000
  ceiling. Python compile and ruff are clean across all touched modules.
  Focused tests pass for `test_ifc_shadow_import`,
  `test_material_image_assets`, `test_permissions`, `test_out_v3_01`,
  `test_public_links_route`, `test_api_v3_registry` (the descriptor parity
  failure for `reverse_bim.exterior_view_create` and three siblings is
  pre-existing parallel-agent work — those descriptors were declared without
  matching routes before this slice), `test_command_schemas`, and
  `test_vg_v3_01`.
