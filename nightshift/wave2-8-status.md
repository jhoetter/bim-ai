# Wave-2 Agent 8 — end-of-shift status

Branch `wave2-8`. Theme: **IFC depth + per-detail visibility** (IFC-03 + IFC-04 + VIE-02).

## Shipped

| WP     | Commit     | State    | Notes                                                                                          |
| ------ | ---------- | -------- | ---------------------------------------------------------------------------------------------- |
| VIE-02 | `c1a2504e` | `done`   | `visibilityByDetailLevel` on sweep / family_instance_ref / array nodes; resolver threads `detailLevel`; family editor 3-checkbox row. 11 new tests, 145 family + family-editor tests still pass. |
| IFC-03 | `0a1ff1df` | `done`   | `RoofOpeningElem` + `CreateRoofOpeningCmd` parallel to slab opening; full engine + IFC export + re-parse + round-trip count check. 9 new tests; 36 existing IFC tests still pass. |
| IFC-04 | `93e1e46e` | `partial`| Materials with `Pset_MaterialCommon`, single-material rel-associates, broader QTO (wall GrossSideArea/NetSideArea, roof Qto_SlabBaseQuantities, door/window Area), `IfcClassificationReference`. 8 new tests. Deferred items called out in tracker note. |

Each WP committed on `wave2-8` from latest `main` (`902abab2`).

## Quality gates

- `pnpm typecheck` — green (11 packages).
- `cd app && .venv/bin/pytest -q --no-cov tests/` — **1315 passed, 7 skipped, 0 failed** (~10s).
- New families + familyEditor vitest suites — **145 tests passed**.
- All 53 IFC export / replay / classifications / round-trip tests pass.

`make verify` not run inside the worktree (the harness ran the full python+ts suites which cover the same surface; flag if a CI-only step fails).

## Files touched

- `packages/web/src/families/types.ts`, `familyResolver.ts`, `familyResolver.detailLevel.test.ts` (new)
- `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`, `FamilyEditorWorkbench.detailLevelVisibility.test.tsx` (new)
- `packages/web/src/i18n.ts` — added `visibilityByDetailHeading` + per-level labels (en/de)
- `packages/web/src/viewport/meshBuilders.ts` — passes `detailLevel` to family resolver
- `packages/core/src/index.ts` — adds `roof_opening` element kind + `ifcClassificationCode` on wall/floor/roof/door/window/room
- `app/bim_ai/elements.py` — adds `RoofOpeningElem` + `ifc_classification_code` field on six element kinds
- `app/bim_ai/commands.py` — adds `CreateRoofOpeningCmd`
- `app/bim_ai/engine.py` — handler + authoritative-replay preflight branch + `known_roofs` tracking
- `app/bim_ai/export_ifc.py` — roof-opening emit/replay, broader QTO, classification helper
- `app/bim_ai/ifc_material_layer_exchange_v0.py` — `Pset_MaterialCommon` per layer + new `try_attach_kernel_ifc_single_material`
- `spec/workpackage-master-tracker.md` — VIE-02 done, IFC-03 done, IFC-04 partial
- `app/tests/test_ifc03_roof_hosted_void_replay.py`, `test_create_roof_opening.py`, `test_ifc_classifications.py`, `test_ifc04_materials_and_qto.py` (new)

## Known gaps / observations

- The shell's mid-session worktree was deleted once during this run; rebuilt fresh from latest `main` and re-applied. Re-confirms the wave-2 worktree pre-flight pattern is the right way to go.
- IFC-04 `IfcRelAssociatesClassification` count is sometimes higher than the unique-code count due to the cached "shared reference" path falling back to per-product references when `add_reference(reference=…)` isn't supported. Behaviour is a no-op for downstream consumers — both forms produce a valid classification — but it does mean IFC byte counts vary across ifcopenshell builds. Worth a follow-up if a downstream parser becomes strict.
- VIE-02 plan-projection wiring: today no plan-side caller invokes the family resolver (curtain panels in plan are still placeholders). The new `detailLevel` parameter is therefore exercised from the 3D viewport's curtain-panel path and from tests, not from plan view. The hook is in place for whenever plan-side family resolution lands.
- Did **not** push the branch to `origin` or fast-forward `main`. Three commits are local on `wave2-8` (off `902abab2`); user can review + merge as a single chunk or per-WP.

## Next-up suggestions

- A follow-up could implement the IFC-04 deferred items: full Pset_*Common for stairs/columns/beams, material category mapping to IFC-standard categories, and migrating element-occurrence classification to a bulk path so the rel-associate count is deterministic across ifcopenshell builds.
