# Wave 3 — WP-C: Wall Parts Per-Part Plan + 3D Rendering (§8.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — Element union + ElemKind (WallElem.parts)
packages/web/src/plan/symbology.ts                      — plan symbol renderers
packages/web/src/plan/planElementMeshBuilders.ts        — plan-view per-element mesh dispatch
packages/web/src/viewport/meshBuilders.ts               — 3D mesh builders
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/plan/PlanCanvas.tsx                    — plan pointer handlers
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

- `parts?: Array<{ id: string; startT: number; endT: number; materialId?: string }>` on `WallElem`
  in `core/index.ts` — `startT`/`endT` are fractions of wall length in [0, 1].
- `buildEqualParts(n)` helper (4 tests in `wallParts.test.ts`) — splits a wall into n equal
  segments by generating the parts array.
- `'wall-create-parts'` RibbonActionId in the Modify | Wall contextual tab — triggers
  `buildEqualParts(4)` and patches the wall.
- Wall 3D mesh builder: `buildLayeredWallMesh()` in `meshBuilders.ts` — extrudes the full wall;
  does NOT yet split by parts.
- Wall plan symbol in `symbology.ts` — draws the full wall outline; does NOT yet shade parts.

---

## Tasks

### A — Plan rendering: shade each part

In `symbology.ts`, find the function that renders a `wall` element in plan view (search for
`wallPlanThree` or the wall branch in `planElementMeshBuilders.ts`). When `wall.parts` is defined
and non-empty, **for each part** draw a filled rectangle covering the part's longitudinal span:

- X extent: `startT * wallLengthMm` → `endT * wallLengthMm` along the wall axis
- Y extent: full wall thickness (same as the wall outline)
- Fill colour: look up `part.materialId` in a material colour map (study how other elements look up
  material colours — the pattern is `materialColorMap[materialId] ?? '#cccccc'`). Use 40 % opacity
  so the wall outline is still visible beneath.
- Each part rectangle should carry `userData.partId = part.id` for raycasting.

If `wall.parts` is undefined or empty, render the wall normally (no change to existing behaviour).

---

### B — 3D rendering: split mesh per part

In `meshBuilders.ts`, in `buildLayeredWallMesh()` (or whichever function builds the wall solid):
When `wall.parts` is defined and non-empty, instead of a single mesh for the full wall:
1. Compute `wallLengthM` as the distance between the two wall endpoints in metres.
2. For each part, build a **BoxGeometry** (or slice of the existing layered geometry) spanning
   `startT * wallLengthM` → `endT * wallLengthM` along the wall's local X axis, with full wall
   height and thickness.
3. Apply a `MeshStandardMaterial` using the part's `materialId` colour (same lookup as plan).
4. Name each mesh `wall-part-${part.id}` and add it to a `Group` returned as the wall mesh.

If `wall.parts` is empty, return the existing single mesh unchanged. There must be zero regression
on the existing wall mesh tests.

---

### C — Inspector: part list

In `InspectorContent.tsx`, inside the `case 'wall':` panel (near the existing wall inspector
fields), add a **Parts** section that appears only when `el.parts?.length > 0`:

```
Parts (4)
  [Part 1]  0%–25%  [Material dropdown]  [Delete]
  [Part 2] 25%–50%  [Material dropdown]  [Delete]
  ...
```

- Material dropdown: lists available material ids from the project; dispatches
  `{ type: 'updateElement', id: wallId, patch: { parts: updatedParts } }` on change.
- Delete button: removes the part from the array (merges it into adjacent part or drops it).
- **Add Part** button at the bottom: appends a new part splitting the last part in half.

Keep the UI minimal — `<select>` dropdowns are fine; no complex drag-to-resize yet.

---

### D — PlanCanvas: part click selection

In `PlanCanvas.tsx`, when the user clicks a wall that has parts and the raycaster hit has
`userData.partId`, set a small local state or store field `selectedWallPartId: string | null`
so the inspector can highlight the active part. This is optional if it would require significant
store changes — skip if risky; just ensure part selection doesn't break existing wall selection.

---

## Tests

Add to `packages/web/src/plan/wallPartsRendering.test.ts`:
1. `wallPlanThree()` with 2-part wall returns 2 filled rects with correct x extents (startT/endT)
2. Part fill colour matches materialId lookup; falls back to `#cccccc` for unknown materialId
3. Zero-part wall renders exactly as before (regression)
4. `buildLayeredWallMesh()` with 4-part wall returns a Group with 4 named children

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §8.1.3 description — append:
```
Per-part plan rendering: each part shaded with `materialId` colour at 40 % opacity.
Per-part 3D rendering: wall with parts returns a `Group` of BoxGeometry meshes, one per segment.
Inspector: Parts section shows segment list with material picker and delete. 4 new tests.
```

Change status from `Partial — P1` to `Done — P1`.

Remove this line from the P1 gap list (~line 1152):
```
- Wall parts / Create Parts (Ch. 8.1.3) — ...
```

Update the summary table row for Chapter 8.
