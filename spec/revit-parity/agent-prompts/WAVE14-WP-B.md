# Wave 14 — WP-B: Beam Section Profiles (§9.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — beam element type (kind: 'beam')
packages/web/src/viewport/meshBuilders.ts               — beam 3D mesh builder
packages/web/src/plan/planElementMeshBuilders.ts        — beam plan symbol
packages/web/src/workspace/inspector/InspectorContent.tsx — beam inspector case
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find the `beam` element type (kind: 'beam'). Note existing fields: `startMm`, `endMm`, `widthMm`, `heightMm`, `materialKey`, `loadBearing`, `structuralRole`, etc. The `beamProfileType` field does NOT exist yet — add it.
- `meshBuilders.ts` — find `buildBeamMesh` or similar. Understand how it currently uses `widthMm` and `heightMm` to build a rectangular BoxGeometry. You will extend this to handle I/H profiles.
- `planElementMeshBuilders.ts` or `symbology.ts` — find where beam plan symbols are drawn. Understand the current rectangular cross-section plan rendering.
- `InspectorContent.tsx` — find `case 'beam':`. Read what properties are already shown. Add the new profile section after reading.

---

## Tasks

### A — Extend beam element type in `core/index.ts`

Add optional fields to the `beam` element type (inside the `{ kind: 'beam'; ... }` union member):

```ts
beamProfileType?: 'rectangular' | 'I-beam' | 'H-beam' | 'HSS-round' | 'HSS-square' | null;
flangeWidthMm?: number | null;      // for I-beam / H-beam — default same as widthMm
flangeThicknessMm?: number | null;  // for I-beam / H-beam — default ~15mm
webThicknessMm?: number | null;     // for I-beam / H-beam — default ~10mm
wallThicknessMm?: number | null;    // for HSS profiles — default ~8mm
```

### B — 3D mesh builder

In `meshBuilders.ts`, update (or create a helper called from) the beam mesh builder:

- **rectangular** (default if beamProfileType is null/undefined): existing BoxGeometry behaviour — no change.
- **I-beam / H-beam**: Build the cross-section using THREE.Shape + ExtrudeGeometry:
  - Two flanges (horizontal rectangles: flangeWidthMm × flangeThicknessMm)
  - One web (vertical rectangle: webThicknessMm × (heightMm - 2×flangeThicknessMm))
  - Extrude along the beam axis from startMm to endMm (length = distance between points).
  - Use defaults: flangeWidthMm = widthMm, flangeThicknessMm = 15, webThicknessMm = 10 when fields are null.
- **HSS-round**: THREE.TubeGeometry along beam axis, outer radius = widthMm/2, inner radius = widthMm/2 - wallThicknessMm (default wallThicknessMm=8).
- **HSS-square**: BoxGeometry outer shell (widthMm × heightMm) minus hollow inner (using EdgesGeometry or a CSG-subtract approach — if CSG is complex, just render as solid with a different material color (#888) to indicate hollow; that is acceptable).

### C — Plan symbol

In `planElementMeshBuilders.ts` (or wherever beam plan symbols are rendered), update the beam plan cross-section symbol:

- **I-beam / H-beam**: Draw the I cross-section as three `THREE.LineSegments` rectangles (top flange, bottom flange, web) instead of a single rectangle.
- **HSS-round**: Draw an ellipse/circle outline.
- **HSS-square**: Existing rectangle outline (no change).
- **rectangular**: Existing rectangle outline (no change).

Keep changes minimal — only the cross-section shape changes; the beam axis line stays the same.

### D — Inspector

In `InspectorContent.tsx`, find `case 'beam':` and add a new collapsible section **"Profile"**:

```tsx
<select
  data-testid="inspector-beam-profile-type"
  value={el.beamProfileType ?? 'rectangular'}
  onChange={(e) => onPropertyChange?.('beamProfileType', e.currentTarget.value)}
>
  <option value="rectangular">Rectangular</option>
  <option value="I-beam">I-Beam</option>
  <option value="H-beam">H-Beam (Wide Flange)</option>
  <option value="HSS-round">HSS Round</option>
  <option value="HSS-square">HSS Square</option>
</select>
```

When `I-beam` or `H-beam` is selected, show:

- Flange Width (mm): `data-testid="inspector-beam-flange-width"`
- Flange Thickness (mm): `data-testid="inspector-beam-flange-thickness"`
- Web Thickness (mm): `data-testid="inspector-beam-web-thickness"`

When `HSS-round` or `HSS-square`:

- Wall Thickness (mm): `data-testid="inspector-beam-wall-thickness"`

### E — Tests

`packages/web/src/viewport/beamProfileMesh.test.ts`:

```ts
describe('beam section profiles — §9.2', () => {
  it('rectangular beam builds BoxGeometry', () => { ... });
  it('I-beam builds ExtrudeGeometry group with 3 parts', () => { ... });
  it('HSS-round builds TubeGeometry', () => { ... });
  it('I-beam uses widthMm as default flangeWidthMm when field is null', () => { ... });
  it('rectangular has no beamProfileType regression', () => { ... });
});
```

`packages/web/src/workspace/inspector/beamProfileInspector.test.tsx`:

```ts
describe('beam profile inspector — §9.2', () => {
  it('renders profile type select with rectangular default', () => { ... });
  it('shows flange/web inputs when I-beam selected', () => { ... });
  it('shows wall thickness input when HSS-round selected', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave14/B): beam section profiles — I/H/HSS + inspector (§9.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
