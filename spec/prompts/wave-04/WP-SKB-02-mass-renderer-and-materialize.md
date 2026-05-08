# WP-SKB-02 — Mass Renderer + materializeMassToWalls (closeout)

## Branch

`feat/wave-04-skb-02-mass-renderer`

## Goal

Render `MassElem` as a translucent volume in the 3D viewport, and ship a `materializeMassToWalls` engine command that auto-extracts walls + a floor + a roof-stub from each mass. Today the data model exists (`MassElem` is in the discriminated union and `'mass'` is in the kind list); nothing renders and nothing converts. After this WP, the SKB-12 cookbook's massing → skeleton transition is fully automatic.

## Done rule

(a) A `mass` element renders as a translucent box (or extruded polygon for non-rectangular footprints) in the 3D viewport, coloured by `materialKey` if set, with an outline.
(b) `materializeMassToWalls` engine command takes a `massId`; its apply emits `createWall` × N (one per footprint segment), one `createFloor` matching the footprint at level base, and one `createRoof` flat at level base + heightMm; deletes the mass; preserves `phaseId` on emitted elements (auto-promoted to `skeleton`).
(c) Tests cover renderer mesh build, axis-aligned + non-axis-aligned footprints, and the materialise command's full output.
(d) Tracker row for SKB-02 flips from `partial` → `done`.

---

## File 1 — `packages/web/src/viewport/meshBuilders.mass.ts` (new)

```ts
export function buildMassMesh(
  mass: MassElement,
  level: LevelElement,
  materials: MaterialRegistry,
): { mesh: THREE.Mesh; outline: THREE.LineSegments };
```

- Build extruded geometry from the footprint polygon (use the existing extrusion helper if one is shared; otherwise THREE.ExtrudeGeometry with `depth = mass.heightMm`).
- Translucent material: `opacity: 0.35`, `transparent: true`, `side: THREE.DoubleSide`. Diffuse colour = material lookup if `materialKey` set, else neutral grey.
- Outline: `THREE.LineSegments` with `EdgesGeometry` over the volume.
- Position at `(0, 0, level.elevationMm)` and rotate by `rotationDeg`.

Test (`meshBuilders.mass.test.ts`): build a 4-vertex axis-aligned mass; assert mesh bounds; build a 5-vertex L-shape mass; assert vertex count > 8.

## File 2 — `packages/web/src/Viewport.tsx`

Where existing kinds are routed to their builders, add a branch that calls `buildMassMesh` for `kind === 'mass'`. Clean up on element delete via the existing dispose pattern. Respect `viewerPhaseFilter` (the `applyPhaseFilter` helper from SKB-23).

## File 3 — `app/bim_ai/engine.py`

Add `MaterializeMassToWallsCmd` Pydantic class with one field `massId`. Add a `case MaterializeMassToWallsCmd():` branch in `try_commit_bundle`. Logic:

1. Look up the mass by id; raise if missing.
2. For each adjacent vertex pair `(footprint[i], footprint[i+1 % n])`, emit a wall: `start=p_i`, `end=p_{i+1}`, `levelId=mass.levelId`, `heightMm=mass.heightMm`, default wall_type. Generate stable ids `${massId}-w${i}`.
3. Emit one floor at the same footprint, level base, default floor_type, id `${massId}-f`.
4. Emit one roof: flat, footprint == mass footprint, base elevation = level.elevationMm + mass.heightMm, id `${massId}-r`.
5. Promote `phaseId` on emitted elements to `'skeleton'` (carry user material assignments forward via `materialKey`).
6. Delete the mass.
7. Each emitted element carries an `agentDeviation` reference back to the source mass id (use the existing `AgentDeviationElem` shape).

## File 4 — `packages/core/src/index.ts`

Mirror: append `MassElement` shape (kind, levelId, footprintMm, heightMm, rotationDeg, materialKey, phaseId, pinned) to the Element union; append `MaterializeMassToWallsCmd { type: 'materializeMassToWalls'; massId: string }` to the EngineCommand union.

## Tests

`app/tests/test_materialize_mass_to_walls.py` (new):

- `test_axis_aligned_rectangle_emits_4_walls_1_floor_1_roof`
- `test_l_shape_footprint_emits_n_walls_for_n_segments`
- `test_emitted_elements_carry_skeleton_phase_id`
- `test_mass_is_deleted_after_materialise`
- `test_unknown_mass_id_raises`

`packages/web/src/viewport/meshBuilders.mass.test.ts` (new): mesh-build tests as above.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_materialize_mass_to_walls.py tests/test_skb_mass_element.py
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/viewport/meshBuilders.mass.test.ts
```

## Tracker

Flip SKB-02 row from `partial` → `done`. Replace deferred-scope text with the as-shipped renderer + materialiser. Note the auto-promotion to `skeleton` phase.

## Dependency

Depends on EDT-03 having merged to main first only because `Viewport.tsx` will be touched concurrently — coordinate the merge order so both branches land cleanly. There is no functional dependency.

## Non-goals

- No interactive massing tool (drawing a mass directly on the canvas). Masses are authored by archetype bundles or by direct command.
- No multi-storey mass slicing into per-level walls — the mass is single-level by spec; tall masses become tall walls.
