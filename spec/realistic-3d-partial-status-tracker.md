# Realistic 3D — "partial" Status Audit & Fix Tracker

Last updated: 2026-05-22

## Summary

The `Render status` chip in the right inspector panel
(`packages/web/src/viewport/ElementRenderStatusPanel.tsx`) shows
`implementation.state` ∈ `supported | partial | unsupported`. Users have
reported that in **realistic 3D** the chip says **"partial"** for almost every
element they click on, even when the element clearly renders correctly with
all materials.

Root cause — `packages/web/src/viewport/elementRenderFeatureStatus.ts`
classifies several whole element categories as `partial` by **static label**
rather than by **evidence**. The renderer actually supports them (mesh
builders exist and produce correct geometry), but the status function
unconditionally tags a `geometry.<kind>_parity_partial` skip flag and downgrades
the state. The 3D viewport-3d implementation state is then the strongest-of
(geometry, material, family, asset), so any one of these downgrades drags the
badge down even when the visible render is fine.

This tracker enumerates each over-pessimistic classification and the planned
fix. Items marked **fix** are real bugs (renderer supports it, status lies);
items marked **keep** are correct partial states (renderer has a genuine
limitation).

## Scope of "partial" Sources

Found in `packages/web/src/viewport/elementRenderFeatureStatus.ts`:

| # | Element / case | Current state | Trigger line | Verdict | Notes |
| - | -------------- | ------------- | ------------ | ------- | ----- |
| 1 | Hosted opening cut (`door` / `window` / `wall_opening`) | always `partial` | 500–507 | **fix** | CSG/analytic cut succeeds for the common case; only `markers.length > 0` should drive `unsupported`. |
| 2 | Non-flat roof (gable, hip, mono-slope, shed, terrace, sketch, etc.) | always `partial` | 509–533 | **fix** | All known roof modes have working mesh builders (`meshBuilders.hipRoof`, `lShapeRoof`, `coneRoof`, `asymmetricRoof`, etc.). |
| 3 | Roof opening cut | always `partial` | 535–543 | **fix** | `dormerRoofCut.ts` + `roofOpeningCut.test.ts` show the cut works. |
| 4 | Slab opening cut | always `partial` | 545–553 | **fix** | Slab CSG path exists and is tested. |
| 5 | Stair (known shape) | always `partial` | 555–572 | **fix** | `meshBuilders.multiRunStair.ts` builds all known shapes. |
| 6 | Railing (known baluster, valid host edge) | always `partial` | 575–603 | **fix** | Railing mesh builder produces output. |
| 7 | Room with `render3dVolume` flag | `partial` | 606–622 | **keep** | Rooms are diagnostic overlays by design, not volumetric solids. |
| 8 | Placed asset with `assetKind !== 'family_instance'` and a `renderProxyKind` | `partial` | 442–471 | **fix** | A procedural proxy with a render kind renders correctly (`familyInstance3d.ts` proxy fallback). The "procedural_proxy_render" label alone shouldn't degrade. |
| 9 | Hosted opening with missing material slot | `family.state = partial` | 360–397 | **partial-fix** | Overlaps with `material.state = fallback`. Stop double-counting on the family axis. |
| 10 | Window `gable_trapezoid` outline with no attached roof | `family.state = partial` | 377–382 | **keep** | Real fallback to rectangular outline. |
| 11 | Family instance missing `def.symbolicLines` (plan symbol) | `family.state = partial` | 419 | **fix** | Plan symbols only matter on the plan surface, not in 3D. Should not degrade the 3D viewport badge. |
| 12 | Family instance missing `def.geometry` (model geometry) | `family.state = partial` | 418 | **keep** | Renderer truly falls back to a proxy box in 3D — partial is correct. |
| 13 | Family instance with no authored material slots | `family.state = partial` | 426 | **keep** | Real authoring limitation; defaults apply. |
| 14 | Material with `category-fallback` / `family-default` / `subcomponent-default` source | `material.state = fallback` → `materialFeatureState = partial` | 314–320, 734–739 | **partial-fix** | If the fallback **resolves to a real material that renders**, we should not say "partial" in 3D — the user sees a real surface. Only `unresolved` should degrade. |
| 15 | "material-not-audited" sentinel | `material.state = fallback` | 271–281 | **fix** | If we lack an audit entry but the element has a real `materialKey`, we should not call it partial just because the auditor didn't run. Audit must produce an entry; otherwise default to `supported`/`not_applicable` rather than `fallback`. |
| 16 | Export status leaking into UI badge | n/a | 686–716 | **investigate** | The chip uses `implementation.state` (which is viewport3d-focused), so this is probably fine — but verify nothing else surfaces export partial in the 3D viewport. |

## Design

The new contract for `implementation.state` (the chip in the 3D viewport):

- `supported` — the realistic 3D renderer produces a correct, complete
  representation for this element. Material is resolved (even via a sensible
  fallback chain to a real material). Geometry comes from a real mesh builder
  with no diagnostic flags.
- `partial` — the renderer produces something, but with a known
  visible limitation: a fallback proxy mesh, an unresolved material, or a
  diagnostic-overlay representation rather than a real solid (e.g. room
  volumes).
- `unsupported` — the renderer cannot produce a representation; or the
  element carries an `unsupportedRenderFeatures` marker; or geometry inputs
  are degenerate.

Concretely: stop emitting `geometry.<kind>_parity_partial` flags that exist
solely to enforce a conservative blanket. They were artifacts of the BIR-I
support-matrix contract, which is a separate surface (plan / section / sheet
/ export). Move those parity-loss claims to `exportSupport.skippedSubfeatures`
where they remain correct, and let the 3D viewport state reflect what the
renderer actually does.

## Implementation Plan

Phased so we can land and verify each piece independently:

1. **Tracker** — this document. ✅
2. **Hosted-opening cut** — drop the `'geometry.hosted_opening_cut_parity_partial'`
   skip flag in 3D geometry status; downgrade only on `markers.length`.
   Keep the parity claim on `exportSupport`.
3. **Roof modes** — accept all `knownRoofGeometryMode` values as
   `supported` (not only `flat`). Move the `_parity_partial` claim into
   `exportSupport`.
4. **Roof opening + slab opening cut** — same pattern as #2.
5. **Stair (known shape)** — same pattern.
6. **Railing (known baluster, valid host edge)** — same pattern.
7. **Placed asset procedural proxy** — when `renderProxyKind` is present,
   `'asset.procedural_proxy_render'` should not degrade to `partial`.
8. **Family instance missing plan symbol** — restrict
   `'family.plan_symbol_footprint_fallback'` from contributing to 3D state;
   it still contributes to plan/export status.
9. **Material fallback** — split `fallback` into two states: `fallback-resolved`
   (renders fine, treat as `supported` in 3D) and `fallback-unresolved`
   (treat as `partial`).
10. **Material-not-audited** — when an audit entry is absent but the element
    declares a `materialKey`, default to `supported`. Only mark `fallback`
    when audit ran and reported a fallback source.
11. **Tests** — update `elementRenderFeatureStatus.test.ts` to match the new
    semantics. Each test that asserts `'partial'` for a clean hosted opening,
    full gable roof, regular railing, etc., flips to `'supported'`.
12. **Typecheck + test** — run `pnpm typecheck` and the `@bim-ai/web` test
    suite; fix any callers of the status shape that hard-code the old
    classification.

Out of scope (do not touch in this pass):

- The `RENDERER_SUPPORT_MATRIX` static table in `rendererDiagnostics.ts`.
  Its surface columns describe the BIR-I contract for plan/section/sheet/
  export parity; those legitimately remain `partial`. The chip we are fixing
  reads from a different code path.
- The `collectRendererDiagnostics` output, except where it incidentally fans
  out from a `partial` geometry state.

## Validation

After each batch, verify:

- `pnpm --filter @bim-ai/web test -- elementRenderFeatureStatus` passes.
- `pnpm typecheck` is green.
- Launch the dev viewport (per AGENTS.md), open a model with at least a
  cut door, a gable roof, a stair, a railing, and a placed asset. The
  inspector chip should now say `supported` for each, with the
  `Diagnostics` row still showing the export-parity notes for context.
