# Wave 4 — WP-G: Steel Connections (§9.5.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — Element union + ElemKind
packages/web/src/viewport/meshBuilders.ts                — 3D mesh builders
packages/web/src/plan/symbology.ts                       — plan symbol renderers
packages/web/src/tools/toolRegistry.ts                   — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts                    — per-tool grammar state machines
packages/web/src/plan/PlanCanvas.tsx                     — plan pointer handlers
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `beam` and `column` element types in `core/index.ts` — connections attach to these
- Structural 3D mesh builders for beams and columns — study them to understand coordinate conventions
- No steel connection modeling exists — this is new

---

## Tasks

### A — Data model: SteelConnectionElem

In `core/index.ts`, add to the Element union:
```ts
{
  kind: 'steel_connection';
  id: string;
  connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab';
  hostElementId: string;          // beam or column id this connection is applied to
  targetElementId?: string;       // secondary element (beam framing into column, etc.)
  positionT?: number;             // fractional position along host element [0, 1]; default 1.0 (end)
  plateSizeMm?: { width: number; height: number; thickness: number }; // default 150×200×10
  boltRows?: number;              // default 2
  boltCols?: number;              // default 2
  boltDiameterMm?: number;        // default 20
}
```

Add `'steel_connection'` to the `ElemKind` union.

Add commands:
```ts
type CreateSteelConnectionCmd = {
  type: 'create_steel_connection';
  hostElementId: string;
  connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab';
};
type UpdateSteelConnectionCmd = {
  type: 'update_steel_connection';
  id: string;
  patch: Partial<Omit<SteelConnectionElem, 'kind' | 'id'>>;
};
```

---

### B — 3D mesh builder

In `meshBuilders.ts`, add:
```ts
export function buildSteelConnectionMesh(conn: SteelConnectionElem): THREE.Group
```

**End plate** (`end_plate`):
- A flat `BoxGeometry` for the plate: `width × height × thickness` in metres
- A grid of `boltRows × boltCols` small `CylinderGeometry` (diameter `boltDiameterMm / 1000`, height `thickness * 1.5`) arranged on the plate face
- `MeshStandardMaterial` colour `#5a5a5a` (steel grey)

**Bolted flange** (`bolted_flange`):
- Two overlapping `BoxGeometry` plates (top flange + bottom flange) at a right angle
- Bolts on both flange faces

**Shear tab** (`shear_tab`):
- Single flat plate oriented parallel to the beam web
- Single column of bolts

All geometries returned in a `THREE.Group`. The group's origin is at the connection's local (0,0,0)
— callers position it at `positionT` along the host element.

---

### C — 3D: position connection on host element

In the 3D scene rebuild (where beam and column meshes are built), after building a beam mesh,
check whether any `steel_connection` element references this beam as `hostElementId`. If so:
1. Compute the world position along the beam at `positionT` (lerp between beam start + end points).
2. Build the connection mesh via `buildSteelConnectionMesh`.
3. Orient the mesh to face the end of the beam (align plate normal to beam axis).
4. Add the connection mesh to the scene (or attach as a child of the beam Group).

Study how `column` positions are computed from their element data to understand the coordinate
system.

---

### D — Plan symbol

In `symbology.ts`, add `steelConnectionPlanThree()` for `steel_connection` elements:

**End plate**: small filled rectangle at the connection position, with a `×` (bolt pattern) inside
- Size: `plateSizeMm.width × plateSizeMm.height` in plan scale
- `×` lines: `boltRows × boltCols` cross marks arranged in a grid

**Bolted flange**: two overlapping small rectangles at 90°.

**Shear tab**: single thin rectangle parallel to beam axis.

All use `#5a5a5a` fill at 70 % opacity.

---

### E — Tool: add connection

Add to `toolRegistry.ts`:
```ts
{
  id: 'steel-connection',
  label: 'Steel Connection',
  hotkey: 'SC',
  modes: ['plan', '3d'],
  icon: 'steel-connection',
}
```

Add `SteelConnectionState` + `reduceSteelConnection` to `toolGrammar.ts`:
- `idle` → click on a beam → `connectType` prompt (or default to `end_plate`) → commit
  → `createSteelConnectionEffect`
- Grammar is simple: one-click on a beam element → get its id → create the connection at
  `positionT: 1.0` by default

Wire `case 'steel-connection':` in `PlanCanvas.tsx`: click picks the nearest beam element via
raycaster, then dispatches `{ type: 'create_steel_connection', hostElementId: beam.id, connectionType: 'end_plate' }`.

---

### F — Inspector

In `InspectorContent.tsx`, add `case 'steel_connection':`:
- **Type** — `<select>` for `connectionType`; dispatches update_steel_connection patch
- **Plate width / height / thickness** — 3 number inputs (mm)
- **Bolt rows / cols** — 2 number inputs
- **Bolt diameter** — number input (mm)
- **Host element** — read-only text (hostElementId)

---

## Tests

Add to `packages/web/src/viewport/steelConnectionMesh.test.ts` (new file):
1. `buildSteelConnectionMesh({ connectionType: 'end_plate', ... })` returns a Group
2. Group contains a plate mesh and bolt meshes (children.length >= 2)
3. `connectionType: 'bolted_flange'` returns Group with 2 plate children
4. Zero bolt rows/cols → no bolt children; no crash

Add to `packages/web/src/plan/steelConnectionPlan.test.ts` (new file):
5. `steelConnectionPlanThree({ connectionType: 'end_plate', ... })` returns an object with
   `userData.elementId === conn.id`
6. Plan symbol is positioned at the correct XZ coordinates

Add to grammar tests (extend `toolGrammar.*.test.ts` pattern):
7. `reduceSteelConnection` idle → `pick-beam` event → effect contains `hostElementId`
8. Escape returns to idle

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §9.5.1 description — append:
```
`steel_connection` element type: end_plate / bolted_flange / shear_tab; `hostElementId` + positionT.
`buildSteelConnectionMesh()`: plate + bolt grid Group. Plan symbol: filled rect + bolt cross marks.
`'steel-connection'` tool (hotkey SC): one-click on beam → create_steel_connection command.
Inspector: type, plate dimensions, bolt layout. 8 tests.
```
Change status to `Partial — P1` (connection schedules §9.5.2 and fabrication parts §9.5.3 remain
Not Started).

Update summary table row for Chapter 9.
