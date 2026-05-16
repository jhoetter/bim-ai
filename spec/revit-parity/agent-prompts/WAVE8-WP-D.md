# Wave 8 — WP-D: Sloped + Tapered Wall Inspector + Mesh (§3.5.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — wall element type
packages/web/src/viewport/meshBuilders.ts               — wall mesh entry point
packages/web/src/viewport/meshBuilders.layeredWall.ts   — layered wall geometry (read this carefully)
packages/web/src/viewport/csgWallBaseGeometry.ts        — base geometry for walls
packages/web/src/workspace/inspector/InspectorContent.tsx — wall inspector panel
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `wall` element in `core/index.ts` — find ALL existing fields including optional ones. Read the full element shape.
- `meshBuilders.layeredWall.ts` — the key file. Understand how it currently builds the wall box geometry. Find where the top face vertices are defined — that's where slope/taper are applied.
- `csgWallBaseGeometry.ts` — if the base geometry box is built here, read it.
- `InspectorContent.tsx` — find the section for `el.kind === 'wall'`. Existing inputs include heightMm, typeId, etc. Add new inputs AFTER without removing anything.

---

## Tasks

### A — Data model

Add to the `wall` element type in `core/index.ts`:
```ts
/** Wall lean angle in degrees. Positive = top shifts in +X direction of wall local frame. Default 0 (plumb). */
slopeAngleDeg?: number | null;
/** If set, wall top is narrower than base. Top thickness = this value (mm). 0 or null = no taper. */
topThicknessMm?: number | null;
```

### B — Sloped wall mesh

In the wall mesh builder (find it in `meshBuilders.layeredWall.ts` or `csgWallBaseGeometry.ts`):

When `wall.slopeAngleDeg` is set and non-zero:
- The wall runs from `startMm` to `endMm` in plan
- In the local wall frame (X = along length, Y = vertical, Z = thickness direction):
  - Top vertices shift in +X by `Math.tan(slopeAngleDeg * Math.PI/180) * heightMm`
  - This makes the wall lean along its length axis
- Apply the shift to the 4 top vertices of the wall box before any CSG or layer processing

When `wall.topThicknessMm` is set and > 0:
- The wall box normally has uniform thickness `thicknessMm`
- With taper: bottom face has full thickness, top face is narrower by `(thicknessMm - topThicknessMm) / 2` on each side
- Move top vertices inward on both Z faces to create the taper

Only override geometry when these values differ from default. No-op if `slopeAngleDeg === 0` or `topThicknessMm === null`.

### C — Inspector inputs

In `InspectorContent.tsx`, for `el.kind === 'wall'`, add:

**Slope angle** (`data-testid="inspector-wall-slope-angle"`):
- Number input, step 0.5, min -45, max 45, value = `el.slopeAngleDeg ?? 0`
- Label: "Slope (°)"
- On change: dispatch `update_element_property` for `slopeAngleDeg`

**Top thickness** (`data-testid="inspector-wall-top-thickness"`):
- Number input (mm), step 10, min 0, value = `el.topThicknessMm ?? ''`, placeholder = "Same as base"
- Label: "Top thickness (mm)"
- On change: dispatch `update_element_property` for `topThicknessMm`

Only show these inputs when the wall has no `typeId` set (freeform wall), or always show — your choice. Keep it simple.

### D — Tests

Write `packages/web/src/viewport/slopedWall.test.ts`:
```ts
describe('sloped wall geometry — §3.5.7', () => {
  it('plumb wall (slopeAngleDeg=0) top vertices are directly above base', () => { ... });
  it('positive slopeAngleDeg shifts top vertices along wall direction', () => { ... });
  it('tapered wall: top thickness < base thickness', () => { ... });
  it('taper is symmetric: both Z faces shrink equally', () => { ... });
  it('no-op when slopeAngleDeg is null', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/slopedWallInspector.test.tsx`:
```ts
describe('sloped wall inspector — §3.5.7', () => {
  it('renders inspector-wall-slope-angle input', () => { ... });
  it('renders inspector-wall-top-thickness input', () => { ... });
  it('changing slope angle dispatches update_element_property for slopeAngleDeg', () => { ... });
  it('changing top thickness dispatches update_element_property for topThicknessMm', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
