# Wave 17 — WP-C: Spot Coordinate + Slope Annotation Full Wiring (§4.8, §4.9)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — spot_coordinate + slope_annotation element types
packages/web/src/tools/toolRegistry.ts              — ToolId union
packages/web/src/tools/toolGrammar.ts               — tool state machines
packages/web/src/plan/PlanCanvas.tsx                — click/keyboard dispatch
packages/web/src/plan/symbology.ts                  — plan symbols
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
```

Search for `spot_coordinate`, `spot-coordinate`, `spotCoordinate`, `slope_annotation`, `slope-annotation`, `slopeAnnotation` in the codebase first. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `toolRegistry.ts`: confirm `'spot-coordinate'` (hotkey `SP`) and `'slope-annotation'` (hotkey `SL`) exist. Note exact IDs.
2. `toolGrammar.ts`: find `SpotCoordinateState`/`reduceSpotCoordinate` and `SlopeAnnotationState`/`reduceSlopeAnnotation` — read them fully.
3. `core/index.ts`: find `spot_coordinate` and `slope_annotation` element kinds. Read ALL fields.
4. `PlanCanvas.tsx`: search for these tool IDs — are they wired? If not, you will wire them.
5. `symbology.ts`: search for `spot_coordinate` and `slope_annotation` plan symbols. Read them.
6. `InspectorContent.tsx`: find `case 'spot_coordinate':` and `case 'slope_annotation':` — read them.

---

## Tasks

The goal is to push both annotation tools from "Partial" to "Done" by ensuring all components are fully wired and tested.

### A — Core types (if missing fields)

Ensure `spot_coordinate` has:
```ts
| {
    kind: 'spot_coordinate';
    id: string;
    positionMm: { xMm: number; yMm: number };
    elevationMm?: number;      // Z elevation at the point (optional, from terrain/slab)
    coordinateN?: number;      // real-world northing (mm)
    coordinateE?: number;      // real-world easting (mm)
    labelPrefix?: string;      // e.g. 'N' / 'E'
    levelId?: string | null;
  }
```

Ensure `slope_annotation` has:
```ts
| {
    kind: 'slope_annotation';
    id: string;
    startMm: { xMm: number; yMm: number };
    endMm: { xMm: number; yMm: number };
    slopePct: number;          // rise/run × 100, e.g. 8.33 for 1:12
    levelId?: string | null;
  }
```

Add command types if not present:
```ts
| { type: 'createSpotCoordinate'; element: Extract<Element, { kind: 'spot_coordinate' }> }
| { type: 'createSlopeAnnotation'; element: Extract<Element, { kind: 'slope_annotation' }> }
```

---

### B — Grammar completeness

For `spot_coordinate`:
- Grammar should be: idle → placing (single click → emit `createSpotCoordinate`, stay in placing for next click)
- Each click creates a new spot coordinate annotation at the clicked point
- Escape → idle

For `slope_annotation`:
- Grammar should be: idle → placing-start → placing-end (2 clicks → emit `createSlopeAnnotation` with slopePct computed from `deltaZ / dist(start, end)` — if terrain elevation data isn't available, default slopePct = 0 and make it editable in inspector)
- Escape → idle

If the grammars already exist and are correct, just confirm they're right.

---

### C — PlanCanvas wiring

In `PlanCanvas.tsx`, ensure these tools are wired (search for `case 'spot-coordinate':` and `case 'slope-annotation':`):

For `spot-coordinate`:
```ts
case 'spot-coordinate': {
  const result = reduceSpotCoordinate(spotCoordState, { type: 'click', ptMm });
  setSpotCoordState(result.state);
  for (const eff of result.effects) {
    if (eff.kind === 'createSpotCoordinate') {
      onSemanticCommand({ type: 'createElement', element: {
        kind: 'spot_coordinate', id: crypto.randomUUID(),
        positionMm: eff.positionMm, levelId: activeLevelId ?? null,
      }});
    }
  }
  break;
}
```

For `slope-annotation`: similar 2-click pattern emitting `createElement` for `slope_annotation`.

---

### D — Plan symbol completeness (`symbology.ts`)

Ensure both plan symbols exist and render correctly:

**Spot coordinate** plan symbol:
- A small cross/plus at `positionMm`
- Two text labels: N (northing) and E (easting), each with a short leader line
- Use `CSS2DObject` or `userData` for the text (or render as a `THREE.Mesh` with fixed pixel text via the existing text rendering pattern)
- `data-testid` via `userData.spotCoordAnnotation = true`

```ts
// Spot coordinate cross
const crossGeo = new THREE.BufferGeometry();
// ±50mm horizontal and vertical lines
crossGeo.setFromPoints([
  new THREE.Vector3(-0.05, PLAN_Y + 0.002, 0),
  new THREE.Vector3(0.05, PLAN_Y + 0.002, 0),
]);
const cross = new THREE.LineSegments(crossGeo, lineMat);
cross.position.set(el.positionMm.xMm / 1000, 0, el.positionMm.yMm / 1000);
cross.userData.spotCoordAnnotation = true;
grp.add(cross);
```

**Slope annotation** plan symbol:
- Arrow line from `startMm` to `endMm`
- Arrowhead at `endMm` (direction of slope rise)
- Text label showing `${el.slopePct.toFixed(1)}%` at midpoint
- `userData.slopeAnnotation = true`

---

### E — Inspector panel completeness

In `InspectorContent.tsx`:

**spot_coordinate inspector** (`case 'spot_coordinate':`):
```tsx
<div>
  <label>N (Northing)
    <input type="number" data-testid="inspector-spot-coord-n"
      value={el.coordinateN ?? 0}
      onChange={e => onPropertyChange('coordinateN', +e.target.value)} />
  </label>
  <label>E (Easting)
    <input type="number" data-testid="inspector-spot-coord-e"
      value={el.coordinateE ?? 0}
      onChange={e => onPropertyChange('coordinateE', +e.target.value)} />
  </label>
  <label>Elevation (mm)
    <span data-testid="inspector-spot-coord-elevation">{el.elevationMm ?? 0}</span>
  </label>
</div>
```

**slope_annotation inspector** (`case 'slope_annotation':`):
```tsx
<div>
  <label>Slope (%)
    <input type="number" step="0.1" data-testid="inspector-slope-annotation-pct"
      value={el.slopePct}
      onChange={e => onPropertyChange('slopePct', +e.target.value)} />
  </label>
  <span data-testid="inspector-slope-annotation-ratio">
    1:{(100 / Math.max(el.slopePct, 0.01)).toFixed(0)}
  </span>
</div>
```

---

### F — Grip providers

Create or confirm `spotCoordGripProvider.ts` and `slopeAnnotationGripProvider.ts` in `packages/web/src/plan/grip-providers/`:

Spot coord grip: single drag grip at `positionMm`, cursor `'move'`, drag updates `positionMm`.

Slope annotation grips: two drag grips at `startMm` and `endMm`, cursor `'crosshair'`, drag updates respective point.

Wire both into `grip-providers/index.ts` `gripsFor()` dispatch.

---

### G — Tests

`packages/web/src/plan/spotCoordAnnotation.test.ts`:
```ts
describe('spot coordinate annotation — §4.8', () => {
  it('grammar: single click emits createSpotCoordinate', () => { ... });
  it('grammar: Escape returns to idle', () => { ... });
  it('plan symbol has userData.spotCoordAnnotation = true', () => { ... });
  it('inspector renders inspector-spot-coord-n input', () => { ... });
  it('inspector renders inspector-spot-coord-e input', () => { ... });
});
```

`packages/web/src/plan/slopeAnnotation.test.ts`:
```ts
describe('slope annotation — §4.9', () => {
  it('grammar: two clicks emit createSlopeAnnotation', () => { ... });
  it('grammar: Escape from placing-start returns to idle', () => { ... });
  it('plan symbol has userData.slopeAnnotation = true', () => { ... });
  it('inspector renders inspector-slope-annotation-pct input', () => { ... });
  it('inspector renders slope ratio readout', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/C): spot coordinate + slope annotation — full wiring + inspector + grips (§4.8, §4.9)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new annotation tests.
