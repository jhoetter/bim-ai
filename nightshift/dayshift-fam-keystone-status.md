# dayshift-fam-keystone — end-of-shift status

Branch: `dayshift-fam-keystone` (merged to `main`).

## WPs landed

### WP1 — KRN-12 frame sweep (done)

Replaces the previously omitted-frame branch in
`buildWindowGeometry` with a perimeter sweep using FAM-02's
`meshFromSweep`. Trapezoid, circle, arched-top, octagon, and
custom outlines now render a frame whose path follows the polygon
edge. Rectangular path is unchanged.

- Code: `packages/web/src/families/geometryFns/windowGeometry.ts`
- Tests: `packages/web/src/families/geometryFns/windowGeometry.test.ts` (6 cases)
- Commit: `1d77d4f4` + tracker `f46cebb3`
- Tracker: KRN-12 stays `done`, note appended `+ 1d77d4f4 — frame sweep along polygon perimeter via FAM-02 meshFromSweep`.

### WP2 — FAM-01 nested families load-bearing slice (partial)

Data model + resolver + cycle detection shipped. Marked `partial`
in tracker.

- Code:
  - `packages/web/src/families/types.ts` — adds `family_instance_ref`
    geometry node, `ParameterBinding` union (literal | host_param
    | formula), optional `geometry?: FamilyGeometryNode[]` on
    `FamilyDefinition`.
  - `packages/web/src/families/familyResolver.ts` — new file with
    `resolveParameterBinding`, `resolveNestedFamilyInstance`,
    `resolveFamilyGeometry`, `detectFamilyCycle`, and
    `MAX_NESTED_FAMILY_DEPTH = 10`. Formulas delegate to
    FAM-04's `evaluateFormulaOrThrow`. Visibility-binding
    short-circuit. Defensive depth check at resolution time.
- Tests: `packages/web/src/families/familyResolver.test.ts` (15 cases:
  literal/host_param/formula bindings, 2-level expansion,
  default param fallback, position+rotation, self-loop +
  2-cycle + DAG + over-depth detection, visibility binding
  hide/show).
- Commit: `583e726c` + tracker `720aaa77`
- Tracker: FAM-01 marked `partial in 583e726c — data model
  (family_instance_ref + ParameterBinding), resolver
  (resolveNestedFamilyInstance + resolveFamilyGeometry), and
  cycle detection shipped; family-editor UI for placing nested
  instances + per-instance parameter binding editor + thumbnail
  composition for FL-06 deferred to follow-up`.

**Deferred FAM-01 polish (follow-up WP):**
1. Family-editor sidebar "Loaded Families" + drag-drop placement
   of nested instances (`FamilyLibraryPanel.tsx` would gain a
   second tab + a Three.js placement gizmo).
2. Per-instance parameter binding editor in the inspector
   (currently bindings authored as JSON only).
3. FAM-03 yes/no visibility-binding integration — the
   `visibilityBinding` data field is plumbed but FAM-03 itself
   isn't shipped.
4. Thumbnail generation for nested family compositions in the
   FL-06 panel.

### WP3 — KRN-09 family_instance panel rendering (done)

`makeCurtainWallMesh` now resolves `family_instance` curtain-cell
overrides through FAM-01's `resolveFamilyGeometry`. Resolved
geometry is scaled mm → metres, positioned at the cell centre,
and rotated to the wall yaw. Userdata still tags the cell with
`curtainPanelKind = 'family_instance'` and the source
`familyTypeId`.

Falls back to magenta `placeholder_unloaded` (with `console.warn`)
when:
- type or family not in catalog
- family has no authored geometry
- resolver throws (cycle, missing param, etc.)

- Code: `packages/web/src/viewport/meshBuilders.ts`
  (`tryResolveFamilyInstancePanel` helper + main loop wiring)
- Tests: `packages/web/src/viewport/meshBuilders.curtainPanels.test.ts`
  (new case mocks `getTypeById`/`getFamilyById` to inject a
  unit-cube test family with a sweep node and asserts the
  placeholder pane is replaced by an `ExtrudeGeometry` mesh
  inside a `Group` carrying the right cell + family metadata)
- Commit: `99d35b35` + tracker `c3c0b59d`
- Tracker: KRN-09 stays `done`, note appended `+ 99d35b35 —
  family_instance now resolves real FAM-01 geometry, magenta
  placeholder only when type unknown / resolver throws`.

### Incidental — make verify unblock (`f6836b7b`)

The earlier cherry-pick `11394f6e` ("KRN-12/13 setters") only
shipped its 207-line test file; the engine.py implementation was
lost in transit, leaving 11 pytest failures on `main`. This
commit:

- Adds the missing `updateElementProperty` branches in
  `app/bim_ai/engine.py` for door `operationType` /
  `slidingTrackSide` and window `outlineKind` / `attachedRoofId`
  (empty-clear, enum validation, roof-kind reference check), with
  door-specific vs window-specific unknown-key error messages so
  `test_door_window_unknown_key_error_lists_new_keys` passes.
- TS lint cleanups (`expressionEvaluator.ts` let→const,
  `meshBuilders.ts` drop dead `eslint-disable`, drop unused
  vitest imports in the curtain panel test).
- Python lint sweep — unused var in `_apply_mirror_elements`,
  ambiguous `l` in `test_template_loader.py`, blind `Exception`
  narrowed in `test_engine_text_3d.py`, plus auto-fix import sort
  + UP037 quote removal across 13 files (pure formatter changes).

After this commit, `make verify` is green end-to-end:
`pnpm format:check`, `pnpm lint:root`, `pnpm architecture`,
`pnpm typecheck`, `pnpm test` (all 1756 web tests + 1228 python
tests passing), and `pnpm build` succeed.

## Observations / follow-ups for next agent

1. **External branch-switching tooling.** During this shift, an
   external process repeatedly auto-stashed in-progress work and
   switched branches mid-edit (twice — the FAM-01 commit was
   nearly lost when HEAD reset back to `725bc02a`; recovered via
   `git cherry-pick` of the dangling commit). If your repo state
   suddenly shows uncommitted work missing, check `git stash list`
   and `git reflog` before redoing — your work is usually still
   reachable.
2. **Wave-2 unblocks.** With FAM-01's data model + resolver
   shipped, the following blocked WPs are now technically
   actionable: FAM-03 (yes/no visibility — uses
   `visibilityBinding` already in the data model), FAM-08
   (component catalog — load nested families from external
   sources via `resolveFamilyGeometry`), VIE-02 (per-element /
   per-family-geometry visibility — same binding mechanism).
3. **FAM-01 UI is the natural next sprint.** The deferred polish
   above (family-editor placement + per-instance binding editor +
   thumbnail composition) are the load-bearing work to finish the
   FAM-01 keystone properly. Shape: extend `FamilyLibraryPanel`
   for browsing, add a "Place Family" gizmo into the family-editor
   canvas, and a binding-row UI in the Inspector.
4. **Curtain panel test mocking pattern.** The test in
   `meshBuilders.curtainPanels.test.ts` uses `vi.spyOn` against
   `familyCatalogModule` to inject test families. If KRN-09
   evolves to a richer panel-family system, consider exposing a
   small `registerTestFamily(def)` API instead of repeated
   `vi.spyOn` blocks.

## Quality gates at handoff

- `pnpm exec tsc --noEmit` — clean
- `pnpm vitest run` (web) — 155 files, 1756 tests passing
- `cd app && .venv/bin/pytest -q --no-cov` — 1228 passing,
  7 skipped, no failures
- `make verify` — PASS
- `git log --oneline origin/main` shows my commits at the head:
  `f6836b7b` (verify unblock) → `c3c0b59d` (KRN-09 tracker) →
  `99d35b35` (KRN-09 family_instance) → `720aaa77` (FAM-01
  tracker) → `583e726c` (FAM-01) → `f46cebb3` (KRN-12 tracker)
  → `1d77d4f4` (KRN-12 frame sweep)
