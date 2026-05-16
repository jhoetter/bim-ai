# Wave 4 — WP-C: Section Box Drag Handles in 3D Viewport (§3.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/Viewport.tsx                         — 3D viewport (sectionBoxRef, sectionBoxCageRef, SectionBox import)
packages/web/src/viewport/sectionBox.ts               — SectionBox class with clippingPlanes()
packages/web/src/state/store.ts                       — viewerSectionBoxActive in store
packages/web/src/state/storeTypes.ts                  — store type declarations
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `SectionBox` class in `viewport/sectionBox.ts` — maintains 6 clip plane values and exposes
  `.clippingPlanes()` returning `THREE.Plane[]`
- `sectionBoxRef` + `sectionBoxCageRef` in `Viewport.tsx` — the cage is a `THREE.LineSegments`
  wire box already rendered when `viewerSectionBoxActive` is true
- `viewerSectionBoxActive` boolean in Zustand store — toggled by an existing UI control
- Clip planes applied to the Three.js renderer when active (lines ~4790–4846 in Viewport.tsx)

What is missing: the box is **not draggable**. The user cannot resize it.

---

## Tasks

### A — SectionBox: extent state + resize API

Read `viewport/sectionBox.ts` in full. Add mutable extent state if not already present:

```ts
export type SectionBoxExtent = {
  minX: number; maxX: number;
  minY: number; maxY: number;   // Y = up axis in Three.js
  minZ: number; maxZ: number;
};
```

Add methods:
```ts
setExtent(ext: Partial<SectionBoxExtent>): void   // merges into current extent
getExtent(): SectionBoxExtent
```

Ensure `clippingPlanes()` is derived from the current extent. Initialize the extent from the scene
bounding box the first time the section box is activated (study how the cage LineSegments is built
to find the initial extent).

---

### B — Drag handles: Six face handles

When `sectionBoxActive` is true, add 6 flat disc/square **drag handle meshes** to the Three.js
scene — one centred on each face of the section box cage:

- `+X face`, `−X face`, `+Y face`, `−Y face`, `+Z face`, `−Z face`
- Use a small `PlaneGeometry (0.15m × 0.15m)` with a bright orange `MeshBasicMaterial`
  (colour `0xf97316`, `depthTest: false`, `transparent: true`, `opacity: 0.8`)
- Each handle mesh carries `userData.sectionBoxHandle = 'maxX' | 'minX' | 'maxY' | 'minY' | 'maxZ' | 'minZ'`

Update handle positions whenever the extent changes. Add all handles to a `handleGroupRef` Group
that is added to the scene alongside the cage.

---

### C — Pointer interaction: drag a handle

In `Viewport.tsx`, in the `onDown` / `onMove` / `onUp` pointer handler chain:

**onDown**: if a raycast hit has `userData.sectionBoxHandle` and `sectionBoxActive`, enter
`sectionBoxDragMode`:
```ts
const sectionBoxDragRef = useRef<{ face: string; startPt: THREE.Vector3 } | null>(null);
```
Store the intersection point on a fixed axis-aligned plane through the handle centre.

**onMove**: while `sectionBoxDragMode` is active, project the pointer ray onto the same plane to
get the new world-space point. Call `sectionBox.setExtent({ [face]: newValue })` with the
delta. The camera orbit must be suppressed while dragging a handle (set `orbitSuppressedRef.current = true` if such a ref exists, or just skip the orbit path).

**onUp**: clear `sectionBoxDragMode`.

Use a **secondary raycast plane** (a `THREE.Plane` aligned to the dragged face's normal, through
the handle centre) for the drag math. Each frame during drag: `raycaster.ray.intersectPlane(dragPlane, hitPoint)`.

---

### D — Store: persist extent

Add to `storeTypes.ts`:
```ts
viewerSectionBoxExtent: SectionBoxExtent | null;
setViewerSectionBoxExtent: (ext: SectionBoxExtent) => void;
```

When a drag ends in `onUp`, write the final extent to the store so it survives re-renders.
On section box activation, if `viewerSectionBoxExtent` is non-null in the store, restore it;
otherwise initialise from the scene bounding box.

---

## Tests

Add to `packages/web/src/viewport/sectionBox.test.ts` (new or extend):
1. `getExtent()` returns the initial extent
2. `setExtent({ maxX: 5 })` updates only maxX; other faces unchanged
3. `clippingPlanes()` returns 6 planes matching current extent
4. Handles derived from extent: face at `maxX` centre = `{ x: extent.maxX, y: midY, z: midZ }`

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §3.1 description — append:
```
Section box drag handles: 6 orange disc meshes (userData.sectionBoxHandle face IDs) centred on
box faces; pointer drag resizes via secondary raycast plane. `SectionBoxExtent` persisted to store
(`viewerSectionBoxExtent`). 4 sectionBox tests.
```
Change status to `Done — P1`.

Update summary table row for Chapter 3.
