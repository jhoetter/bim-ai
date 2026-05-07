# Wave-3 Agent 7 — status

Branch: `wave3-7`. Both WPs shipped to `main`.

## Shipped

### FAM-01 polish (commit `835b434f`)

- New `LoadedFamiliesSidebar` component lists catalog families filtered
  by host discipline; supports HTML5 drag-drop + click-to-add. The
  drag payload uses `application/x-bim-ai-family-id` + `text/plain`
  fallback so future canvas drop targets can read either.
- New `NestedInstanceInspector` component edits position / rotation +
  per-parameter binding rows (literal / host_param / formula via the
  FAM-04 `evaluateFormulaOrThrow` evaluator). Visibility binding
  (FAM-03) integrates when host has boolean params; otherwise shows a
  "add a host boolean param" placeholder.
- `FamilyEditorWorkbench` extended: nested-instance state, drop-target
  canvas region, two-column layout with sidebar + canvas, inline
  inspector for the selected nested instance. Host discipline now
  filters the loaded-families list.
- `thumbnailCache.getFamilyComposedThumbnail(familyId, catalog)` walks
  `resolveFamilyGeometry` so FL-06 thumbnails show composed nested
  geometry.
- Tests: `LoadedFamiliesSidebar.test.tsx` (5 tests) and
  `NestedInstanceInspector.test.tsx` (7 tests). All 157 family-area
  tests pass.

### EDT-01 propagation (commit `<this-commit>`)

- New directory `packages/web/src/plan/grip-providers/` with one
  provider per kind:
  - `doorGripProvider` — alongT slide grip on host wall. Drag → 
    `updateElementProperty` on `alongT` clamped to [0, 1]. Numeric
    override = distance from wall start.
  - `windowGripProvider` — same shape as door (sill height deferred to
    EDT-03 elevation view).
  - `floorGripProvider` — vertex grips at every `boundaryMm` corner;
    drag commits an immutable boundary replacement via
    `updateElementProperty` with JSON-encoded array.
  - `columnGripProvider` — position grip + rotation grip (rotation
    handle only on non-square columns).
  - `beamGripProvider` — start + end endpoint grips emitting a new
    `moveBeamEndpoints` command.
  - `sectionCutGripProvider` — start + end grips on `lineStartMm` /
    `lineEndMm`.
  - `dimensionGripProvider` — anchor + offset grips; offset grip
    projects drag onto the unit normal of the measured segment.
  - `referencePlaneGripProvider` — endpoint grips on KRN-05
    project-scope ref planes; family-editor variant returns no grips.
- New `grip-providers/index.ts` exports a propagation-aware
  `gripsFor(element, ctx)` dispatcher; PlanCanvas now calls into this
  with `{ elementsById }` so kinds that need a host (door / window)
  can resolve it.
- `gripProtocol.PlanContext` extended with `elementsById?` so
  providers can resolve hosts without an extra prop.
- New `MoveBeamEndpointsCmd` Pydantic schema in `app/bim_ai/commands.py`
  + an explicit reject in `engine.py` (BeamElem isn't yet seeded in
  Python; the schema is forward-compatible so the kernel slice can
  land without a TS rebuild).
- Tests: `grip-providers/gripProviders.test.tsx` (24 tests) verifying
  drag-commit and numeric-override shapes for every kind. All 338
  plan-area tests pass.
- One pre-existing lint warning in `PlanCanvas.tsx` (an unused import
  `sectionCutFromWall`) blocked CI; cleaned it up since shipping with
  CI red would block downstream waves.

## Visual verification

Build + typecheck + 24 grip-provider unit tests + 338 plan-area tests
all pass. **Interactive browser verification was not performed in this
shift** — I'm running headless and can't drive a real cursor through
drag flows. The grip-provider shapes are unit-tested; PlanCanvas
integration compiles cleanly. Recommend a 5-minute eyes-on test before
EDT-02 / EDT-03 builds on top, especially:

- Select a door in plan view → confirm the alongT grip appears on the
  host wall midpoint.
- Drag the alongT grip → confirm the door slides smoothly (0..1 clamped).
- Select a floor → confirm vertex grips at every corner; drag one and
  confirm boundary updates.
- Select a column → confirm position grip; for a non-square column,
  confirm the rotation handle appears.

## File ownership

Owned files (no conflicts expected with other wave-3 agents):

- `packages/web/src/familyEditor/LoadedFamiliesSidebar.{tsx,test.tsx}`
- `packages/web/src/familyEditor/NestedInstanceInspector.{tsx,test.tsx}`
- `packages/web/src/plan/grip-providers/*` (new directory)
- `app/bim_ai/commands.py` — appended `MoveBeamEndpointsCmd`
- `app/bim_ai/engine.py` — appended import + `case MoveBeamEndpointsCmd`

Shared:
- `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx` — added
  nested-instance state + sidebar/canvas layout.
- `packages/web/src/families/thumbnailCache.ts` — added
  `getFamilyComposedThumbnail`.
- `packages/web/src/i18n.ts` — added strings under `familyEditor.*`.
- `packages/web/src/plan/PlanCanvas.tsx` — switched `gripsFor` import
  to `grip-providers/index.ts` and threaded `elementsById` context.
- `packages/web/src/plan/gripProtocol.ts` — extended `PlanContext`
  with `elementsById?`.
- `spec/workpackage-master-tracker.md` — flipped FAM-01 + EDT-01 to
  `done`.

## Push protocol

- `git push origin wave3-7` (branch)
- `git push origin wave3-7:main` (fast-forward main)

Per the wave3 README: branch + main pushed BEFORE writing this status
file. Both commits landed on `main`.
