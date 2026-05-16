# Wave 4 — WP-A: Sloped + Tapered Walls Inspector + Mesh (§3.5.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — Element union (WallElem has slopeDeg + taperRatio)
packages/web/src/viewport/meshBuilders.ts                — 3D mesh builders
packages/web/src/viewport/meshBuilders.layeredWall.ts    — layered wall mesh (if separate file)
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/plan/symbology.ts                       — plan symbol renderers
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `slopeDeg?: number | null` on the `wall` element type in `core/index.ts`
- `taperRatio?: number | null` on the `wall` element type (KRN-V3-07: top/base thickness ratio;
  1 = prismatic, valid range (0.1, 10))
- Partial mesh builder support in `meshBuilders.ts` / `meshBuilders.layeredWall.ts` — read the
  actual code before adding anything
- Inspector shows `slopeDeg` as a **read-only** `<FieldRow>` (not an editable input)

---

## Tasks

### A — Inspector: editable slope + taper inputs

In `InspectorContent.tsx`, find the `case 'wall':` block. Replace the read-only slope `<FieldRow>`
with an editable `<input type="number">`:
- **Slope (°)** — dispatches `{ type: 'updateElement', id, patch: { slopeDeg: v } }` on blur;
  clamp to [−45, 45]; step 0.5; data-testid `"inspector-wall-slope-deg"`
- **Taper ratio** — new input below slope; dispatches `{ type: 'updateElement', id, patch: { taperRatio: v } }`;
  clamp to [0.1, 10]; default display "1.0 (prismatic)"; data-testid `"inspector-wall-taper-ratio"`

Show both inputs only for walls (not for curtain walls where `isCurtainWall === true`).

---

### B — 3D mesh: apply slopeDeg

In the wall mesh builder (whichever file handles wall 3D geometry — read it first):

When `wall.slopeDeg` is set and non-zero:
1. Compute `slopeRad = (slopeDeg * Math.PI) / 180`.
2. After building the wall box/extrusion, apply a shear transform to the top face:
   `topXOffset = wallHeightM * Math.tan(slopeRad)` along the wall's X axis.
   This tilts the wall so the top shifts forward/backward relative to the base.
3. Rebuild normals after shearing (`geometry.computeVertexNormals()`).

This is a geometric shear of the top face only — not a rotation of the whole wall.

If shear logic already exists and is partially correct, fix rather than replace.

---

### C — 3D mesh: apply taperRatio

When `wall.taperRatio` is set and !== 1:
- Base thickness = `wall.thicknessMm / 1000` (in metres).
- Top thickness = `baseThickness * taperRatio`.
- Build the wall as a **trapezoid extrusion** (a `BufferGeometry` with a trapezoidal cross-section)
  instead of a box. The top two vertices are inset/outset by `(topThickness − baseThickness) / 2`
  relative to the bottom vertices along the wall's local Y axis (thickness direction).
- Normals must be recomputed after.

Keep zero-tolerance guard: if `|taperRatio - 1| < 0.01`, use the standard box path.

---

### D — Plan symbol: dashed top-face outline for sloped walls

In `symbology.ts`, when rendering a wall with `slopeDeg` non-zero, add a **dashed** rectangle at the
top face projection (offset in X by `wallHeightM * tan(slopeDeg) * scaleFactor`). Use the same
pattern as the dashed top-footprint for sloped columns (`topOffsetXMm` / `topOffsetYMm`).

For tapered walls, draw the top outline thinner (proportional to `taperRatio`) overlaid on the
base outline.

---

## Tests

Add to `packages/web/src/viewport/wallSlopeTaper.test.ts` (new file):
1. `slopeDeg: 10` shifts top vertices: `topX ≠ baseX`, `bottomX === baseX`
2. `slopeDeg: 0` produces same geometry as no-slope wall (regression)
3. `taperRatio: 0.5` makes top thickness half of base thickness
4. `taperRatio: 1` produces a box (within float epsilon)
5. `taperRatio: 10` clamps to valid range without crash

Add to inspector tests:
6. Slope input present for a regular wall (not curtain wall)
7. Slope input absent for curtain wall (isCurtainWall: true)
8. Dispatches correct updateElement patch on blur

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §3.5.7 description — append:
```
Inspector: editable slope (°) and taper ratio inputs (data-testids inspector-wall-slope-deg,
inspector-wall-taper-ratio). Mesh builder: slopeDeg shears top face; taperRatio builds
trapezoidal extrusion. Plan symbol: dashed top outline for sloped/tapered walls. 8 tests.
```
Change status to `Done — P1`.

Update summary table row for Chapter 3.
