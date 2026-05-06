# BIM AI — Workpackage Tracker

Single source of truth for outstanding implementation work. Waves 0–6 are merged to main; their prompt files have been deleted per protocol. Earlier wave-by-wave specs and the screenshot-driven PRD have been consolidated here.

Verified against code on 2026-05-07; everything not listed here is shipped.

## Status Legend

| Symbol     | Meaning                                                         |
| ---------- | --------------------------------------------------------------- |
| `done`     | Meets the done rule — tested, type-clean, merged to main        |
| `partial`  | Some slice exists; measurable progress; spec requirements unmet |
| `open`     | Not started                                                     |
| `deferred` | Explicitly out of scope for current roadmap                     |

## Done Rule

A workpackage is `done` when all of: (a) `pnpm exec tsc --noEmit` clean; (b) new logic has vitest / pytest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

---

## Exchange Formats

| ID     | Item                                                | Note                                                                    | State  |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| IFC-01 | `roofTypeId` round-trip through IFC                 | Kernel has the field; `app/bim_ai/export_ifc.py` doesn't write it       | `open` |
| IFC-02 | Distinguish `gable_pitched_rectangle` in IFC body   | Currently always emits prism mass                                       | `open` |
| IFC-03 | Roof-hosted void replay                             | Today rolled up as `slabRoofHostedVoidReplaySkipped_v0` only            | `open` |
| IFC-04 | Broader QTO + materials + classifications + composites | Narrow QTO slice shipped; full takeoff pending                       | `open` |
| GLT-01 | Draco / mesh compression on glTF export             | Tracked previously under WP-X02                                         | `open` |

## CLI / Agent Loop

| ID     | Item                                                | Note                                                                    | State  |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| CLI-01 | `bim-ai export json`                                | Stub at `packages/cli/cli.mjs:404`; ifc / gltf / glb already shipped    | `open` |
| CLI-02 | `bim-ai diff --from … --to …`                       | Stub at `packages/cli/cli.mjs:372`                                      | `open` |
| AGT-01 | Closed iterative-correction agent loop              | `evidence-package` + `apply-bundle --dry-run` ship; loop wiring manual  | `open` |

## Kernel + Validation + Plan Views

| ID     | Item                                                | Note                                                                    | State  |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| KRN-01 | `property_line` element kind                        | `SiteElem.uniform_setback_mm` exists; no line element yet               | `open` |
| KRN-02 | Concave / L-shaped roof footprint 3D mesh           | Today: `valley_candidate_deferred` placeholder; section view OK         | `open` |
| KRN-03 | Hip roof (convex polygon >4 corners) 3D mesh        | Today: `hip_candidate_deferred` placeholder; section view OK            | `open` |
| VAL-01 | Topological room enclosure (wall-graph closure)     | Replaces the `room_no_door` centroid heuristic                          | `open` |
| PLN-01 | Dimension / tag automation                          | Manual placement works; auto-dimension / auto-tag missing               | `open` |

---

## Locked Decisions

These answers to PRD §17 govern implementation defaults. Revisit quarterly or when IFC scope expands.

| Topic                    | Decision                                                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regional building code   | **EU residential proxy** — mm dimensions; staircase comfort `tread ≥ 260 mm × riser ≤ 190 mm` as advisory only; egress not enforced in v1.                                                                                                     |
| Residential vs cleanroom | **Residential reference house first**; cleanroom class / pressure / interlock metadata supported in schema; **IDS fixtures** phased after IFC subset.                                                                                          |
| Titleblock / sheet sizes | First-class layout: **A1 landscape metaphor** (`594×841` mm portrait stored as ×1000 coords in existing `sheet`/`viewportsMm` convention — keep mm paper space); titleblock strings: project name, sheet number, revision, drawn/checked/date. |
| AI vision automation     | **Assumptions-first** — agent MUST log assumptions JSON before apply; automated screenshot comparison is CI opt-in (`compare` PNG diff tolerances), not silent vision-from-screenshot in core product.                                         |

## OpenBIM Stance

Integration ladder (priority order): (1) JSON command bundles + snapshots → (2) IFC import/export → (3) BCF → (4) IDS → (5) glTF → (6) RVT bridge. **Native RVT I/O is explicitly deferred** until OpenBIM semantics stabilise; safest delivery would be plugin / Autodesk cloud conversion / customer-specific pipeline, not opaque-binary import.

Engineering invariants: (a) Web + CLI must stay symmetric — anything the UI edits must be reproducible via API commands logged in undo stacks; (b) authoring-side IDS checks live in `constraints.evaluate`; exported IFC semantics summarised by `inspect_kernel_ifc_semantics()` / `summarize_kernel_ifc_semantic_roundtrip()` in `app/bim_ai/export_ifc.py`.

---

## Reference Files

`spec/` only contains:

- `workpackage-master-tracker.md` — **this file, single source of truth**.
- `target-house-seed.md` — architect-quality description of the demo seed house (kept as reference data, not backlog).

The actual product behaviour is the source of truth for everything else: code (`app/`, `packages/`), CLI `--help`, API schemas, and tests. The validation taxonomy formerly anchored in a markdown PRD now lives in code at `app/bim_ai/prd_blocking_advisor_matrix.py` (each row's `prdNeedle` field).

## Update Protocol

1. When a backlog item ships: change `open` / `partial` → `done` in the relevant table.
2. Once a category is fully drained (all rows `done`), drop the table.
3. New work starts as a row here; only spin up a fresh wave / prompt directory if a coordinated multi-WP batch is needed.
