# Wave 4 — WP-D: Excavation Cut (Baugrube) Mesh + Tool (§5.1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — toposolid_excavation type (TOP-V3-05)
packages/web/src/viewport/meshBuilders.ts               — 3D mesh builders
packages/web/src/plan/symbology.ts                      — plan symbol renderers
packages/web/src/tools/toolRegistry.ts                  — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts                   — per-tool grammar state machines
packages/web/src/plan/PlanCanvas.tsx                    — plan pointer handlers
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `toposolid_excavation` element type in `core/index.ts` (TOP-V3-05):
  ```ts
  kind: 'toposolid_excavation';
  id: string;
  parentToposolidId: string;
  boundaryMm: XY[];   // closed polygon in plan
  depthMm: number;
  ```
  Read the actual definition before assuming — the fields above may vary slightly.
- `storeCoercion.ts` can coerce `toposolid_excavation` elements already
- Toposolid (terrain surface) mesh builder already exists — the excavation must carve into it

---

## Tasks

### A — 3D mesh: excavation pit

In `meshBuilders.ts`, add:
```ts
export function buildExcavationMesh(excav: ToposolidExcavation): THREE.Group
```

The excavation is a vertical pit: a closed polygon footprint (`boundaryMm`) cut downward by
`depthMm`. Build:
1. **Walls**: extruded polygon boundary, height = `depthMm / 1000` m, pointing downward.
   Use `THREE.Shape` from the boundary points + `ExtrudeGeometry` with `depth: depthMm / 1000`.
2. **Floor**: flat `ShapeGeometry` from the boundary, positioned at `−depthMm / 1000` m.
3. Apply a `MeshStandardMaterial` with colour `#8B6914` (brown earth) to all surfaces.
4. Return both geometries in a `THREE.Group`.

The excavation sits at the level of the parent toposolid's surface (y = 0 or the toposolid
reference elevation) and carves downward.

---

### B — 3D: clip terrain mesh under excavation footprint

When a `toposolid_excavation` element exists, the terrain mesh (toposolid) should have a hole
punched through it at the boundary footprint. Use Three.js ClippingPlanes or a simple approach:
**toggle the terrain mesh segments inside the boundary to invisible** by checking which terrain
triangles have all three vertices inside the excavation boundary polygon (use a point-in-polygon
test on the XZ plane). This is an approximation — exact CSG is out of scope.

Alternatively, simply render the excavation mesh on top of the terrain and let the depth-buffer
handle occlusion (the pit walls cover the terrain inside). This is acceptable if full terrain
subtraction is too complex.

---

### C — Plan symbol

In `symbology.ts`, add `excavationPlanThree()` for `toposolid_excavation` elements:
- Draw the boundary polygon as a **dashed** closed polyline (same dash style as demolished
  elements) in `#8B6914` (brown)
- Add diagonal cross-hatching inside the boundary (4–6 evenly spaced parallel lines at 45°
  clipped to the boundary polygon)
- data-testid on the resulting object: `"plan-excavation-${id}"`

---

### D — Tool: excavation sketch

Add to `toolRegistry.ts`:
```ts
{
  id: 'excavation',
  label: 'Excavation',
  hotkey: 'EX',
  modes: ['plan'],
  icon: 'excavation',
}
```

Add `ExcavationState` + `reduceExcavation` to `toolGrammar.ts` following the pattern of other
polygon-sketch tools (e.g. `reduceRoom` or `reduceFloor`):
- `idle` → click adds vertex → double-click or Enter closes polygon → `createExcavationEffect`
  with `{ boundaryMm: vertices, depthMm: 1500 }` (default 1500 mm depth)
- Escape cancels

In `PlanCanvas.tsx`, wire `case 'excavation':` click/dblclick/Enter/Escape handlers that call
`reduceExcavation` and dispatch `{ type: 'create_toposolid_excavation', ... }` on commit.

Add `create_toposolid_excavation` to the command type union in `core/index.ts` if not already
present.

---

### E — Inspector

In `InspectorContent.tsx`, add `case 'toposolid_excavation':`:
- **Depth (mm)** — number input; dispatches `{ type: 'updateElement', id, patch: { depthMm } }`;
  clamp to [100, 50000]; data-testid `"inspector-excavation-depth"`
- **Area** — read-only; computed from `boundaryMm` using shoelace formula; displayed as m²

---

## Tests

Add to `packages/web/src/plan/excavation.test.ts` (new file):
1. `reduceExcavation` idle → 3 vertex clicks + Enter → `createExcavationEffect` with correct boundaryMm
2. Escape clears vertices and returns to idle
3. Double-click closes polygon (same as Enter after ≥3 vertices)

Add to `packages/web/src/viewport/excavationMesh.test.ts` (new file):
4. `buildExcavationMesh()` returns a Group with 2 children (walls + floor)
5. Floor mesh y-position = `−depthMm / 1000` metres
6. Zero-area boundary → returns empty Group without crash

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §5.1.5 description — append:
```
`buildExcavationMesh()` builds pit walls + floor (ExtrudeGeometry + ShapeGeometry, brown material).
Plan symbol: dashed boundary + cross-hatch fill. `'excavation'` tool (hotkey EX, plan mode):
polygon-sketch grammar `reduceExcavation`, PlanCanvas wired. Inspector: depth input + area readout.
9 tests.
```
Change status to `Done — P1`.

Update summary table row for Chapter 5.
