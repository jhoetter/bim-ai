# Wave 11 — WP-D: Sloped + Tapered Wall Inspector Exposure (§3.5.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — wall element type (slopeAngleDeg, topThicknessMm)
packages/web/src/workspace/inspector/InspectorContent.tsx — wall inspector section
packages/web/src/plan/meshBuilders/meshBuilders.layeredWall.ts  — wall 3D mesh builder
packages/web/src/plan/symbology.ts                       — plan rendering
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `wall` element in `core/index.ts` — find `slopeAngleDeg` and `topThicknessMm` (added by wave 8 WP-D or similar). Read the full wall type definition including base/top constraints.
- `InspectorContent.tsx` — find the wall inspector section. Read its full implementation: how property inputs are rendered, how `update_element_property` is dispatched. You will add new fields here.
- `meshBuilders.layeredWall.ts` — check if `slopeAngleDeg` and `topThicknessMm` are already read and applied to the 3D geometry. If they are read but clamped/ignored, fix the clamping. If they are not read, add the geometry logic.
- The wall mesh builder may use `heightMm` or `topConstraintLevelId`/`topConstraintOffsetMm` — understand the full height resolution chain before touching it.

---

## Tasks

### A — Core type: verify + add missing wall fields

In `core/index.ts`, ensure the `wall` element type has these fields. Add only what is missing:

```ts
/** Slope of the wall (degrees from vertical). 0 = plumb. Positive = leans outward. */
slopeAngleDeg?: number | null;

/** Thickness at top of wall (mm). If set and differs from base thickness, wall is tapered.
 *  Computed from the wall type's total layer thickness when null. */
topThicknessMm?: number | null;

/** Cross-section profile override points (for non-rectangular wall profiles). */
profilePoints?: { x: number; y: number }[] | null;
```

### B — Inspector: sloped wall controls

In `InspectorContent.tsx`, in the wall inspector section, add a collapsible sub-section **"Profile & Slope"**:

- **Slope angle (°)** (`data-testid="inspector-wall-slope-angle"`): number input, step 0.5, range -45 to 45. Default 0. On change: dispatch `update_element_property` for `slopeAngleDeg`. Show "0° (plumb)" as placeholder.
- **Top thickness (mm)** (`data-testid="inspector-wall-top-thickness"`): number input, min 1. Empty = same as base. On change: dispatch `update_element_property` for `topThicknessMm`. Show "(same as base)" as placeholder when null.
- **Reset to plumb/rectangular** button (`data-testid="inspector-wall-reset-slope"`): sets both `slopeAngleDeg = 0` and `topThicknessMm = null` via two dispatches.

Wrap this sub-section in a `<details>` element so it does not clutter the inspector. Default: open if `slopeAngleDeg !== 0 && slopeAngleDeg != null`.

### C — 3D mesh: apply slope and taper

In `meshBuilders.layeredWall.ts` (or equivalent wall mesh builder), update the wall geometry to use `slopeAngleDeg` and `topThicknessMm`:

**Sloped wall** (`slopeAngleDeg !== 0`): The top edge of the wall shifts laterally by `tan(slopeAngleDeg) * heightMm`. Apply this as a shear transform on the top vertices of the extruded wall shape.

**Tapered wall** (`topThicknessMm !== baseThicknessMm`): Build a trapezoidal cross-section instead of rectangular. The base thickness = sum of layer thicknesses; the top thickness = `topThicknessMm`. Interpolate layer proportions proportionally.

Implementation hints:

- If the geometry is built as a `THREE.ExtrudeGeometry` or `THREE.BufferGeometry` with explicit vertices, adjust the top vertices after extrusion.
- Keep the existing rectangular path for the 99% case — only branch when `slopeAngleDeg != null && slopeAngleDeg !== 0` or `topThicknessMm != null`.
- Do NOT change the plan symbol (plan view always shows base footprint for sloped/tapered walls — same as Revit).

### D — Plan symbol: slope indicator

In the plan symbol renderer (find the wall plan symbol in `planElementMeshBuilders.ts` or `symbology.ts`):

When `wall.slopeAngleDeg != null && wall.slopeAngleDeg !== 0`:

- Draw a small slope-direction arrow on the wall centerline in plan
- Arrow direction: toward the thinner end (for tapered) or toward the lean direction (for sloped)
- `userData.slopeIndicator = true` on the arrow mesh so tests can query it

This is a small enhancement — a single `THREE.ArrowHelper` or simple line is sufficient.

### E — Tests

Write `packages/web/src/workspace/inspector/slopedWallInspector.test.tsx`:

```ts
describe('sloped wall inspector — §3.5.7', () => {
  it('renders inspector-wall-slope-angle input', () => { ... });
  it('renders inspector-wall-top-thickness input', () => { ... });
  it('slope angle change dispatches update_element_property for slopeAngleDeg', () => { ... });
  it('reset button sets slopeAngleDeg to 0', () => { ... });
  it('details section is open when slopeAngleDeg is non-zero', () => { ... });
});
```

Write `packages/web/src/plan/meshBuilders/slopedWall.test.ts`:

```ts
describe('sloped wall mesh — §3.5.7', () => {
  it('plumb wall (slopeAngleDeg=0) produces rectangular cross-section', () => { ... });
  it('sloped wall top vertices are offset by tan(angle)*height', () => { ... });
  it('tapered wall top face width equals topThicknessMm', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave11/D): sloped + tapered wall inspector + 3D mesh (§3.5.7)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
