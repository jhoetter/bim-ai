# Wave 8 — WP-C: Room Tag Area Display + Net Area (§13.1.2 + §13.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — room element type (outlineMm, numberLabel, name, targetAreaM2)
packages/web/src/plan/planElementMeshBuilders.ts        — roomMesh(), room label rendering
packages/web/src/workspace/inspector/InspectorContent.tsx — room inspector panel
packages/web/src/plan/symbology.ts                       — room rendering loop
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `room` element in `core/index.ts`: has `name`, `numberLabel?: string | null`, `outlineMm: XY[]`, `targetAreaM2?: number | null`, `department?`, `programmeCode?`.
- `roomMesh()` in `planElementMeshBuilders.ts` — read the full function. It already accepts `name` and `numberLabel`. Find where the label sprite is created.
- `InspectorContent.tsx` — find the section for `el.kind === 'room'`. Read all existing inputs before adding new ones.
- `buildLevelAreaReport` in `scheduleLevelDatumEvidenceReadout.ts` — uses shoelace formula on floor boundaries. Use the same pattern for room area.
- `update_element_property` command — dispatches property changes.

---

## Tasks

### A — Room area utility

Create `packages/web/src/plan/roomArea.ts`:

```ts
/** Shoelace formula on room outlineMm (closed polygon). Returns m². */
export function roomAreaM2(outlineMm: ReadonlyArray<{ xMm: number; yMm: number }>): number;

/** Net room area: gross minus sum of column footprint areas inside the room. */
export function roomNetAreaM2(
  outlineMm: ReadonlyArray<{ xMm: number; yMm: number }>,
  columns: ReadonlyArray<Extract<Element, { kind: 'column' }>>,
): number;
```

- Gross area: shoelace on `outlineMm`, convert mm² → m²
- Net area: subtract area of each column whose centre-point is inside the room polygon (use point-in-polygon test). Column footprint = `(column.widthMm ?? 300) * (column.depthMm ?? 300)` in mm².
- Return 0 if outlineMm has < 3 points.

### B — Room label: area in plan sprite

In `planElementMeshBuilders.ts`, in the room label rendering, add the computed gross area (m²) below the name/number:

- Format: `"${area.toFixed(1)} m²"`
- Only show area when `outlineMm.length >= 3`
- Append as a third line in the room label sprite (below name, below numberLabel if present)
- `data-testid` is not applicable to Three.js sprites; instead expose `userData.roomAreaM2` on the mesh group

### C — Inspector: room number + area inputs

In `InspectorContent.tsx`, for `el.kind === 'room'`, add after the existing inputs:

**Room number** (`data-testid="inspector-room-number"`):

- Text input, value = `el.numberLabel ?? ''`
- On change: dispatch `update_element_property` for `numberLabel`
- Label: "Room No."

**Computed area** (`data-testid="inspector-room-area-gross"`):

- Read-only: `"${roomAreaM2(el.outlineMm).toFixed(1)} m²"` or `"—"` if <3 points
- Label: "Gross Area"

**Target area** (`data-testid="inspector-room-target-area"`):

- Number input (m²), value = `el.targetAreaM2 ?? ''`, step 0.1
- On change: dispatch `update_element_property` for `targetAreaM2`
- Label: "Target Area (m²)"

### D — Tests

Write `packages/web/src/plan/roomArea.test.ts`:

```ts
describe('roomAreaM2 — §13.1.4', () => {
  it('returns 0 for fewer than 3 points', () => { ... });
  it('computes correct area for a 10m × 5m rectangle', () => { ... });
  it('computes correct area for a non-rectangular polygon', () => { ... });
  it('handles clockwise and counterclockwise winding (absolute value)', () => { ... });
});

describe('roomNetAreaM2 — §13.1.4', () => {
  it('returns same as gross when no columns inside', () => { ... });
  it('subtracts column footprint area for columns inside room', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/roomInspector.test.tsx`:

```ts
describe('room inspector — §13.1.2 + §13.1.4', () => {
  it('renders inspector-room-number input', () => { ... });
  it('renders inspector-room-area-gross with computed area', () => { ... });
  it('renders inspector-room-target-area input', () => { ... });
  it('changing numberLabel dispatches update_element_property', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
