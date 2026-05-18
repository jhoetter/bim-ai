# Wave 10 — WP-A: Permanent Dimension Text Drag + Flip (§4.2.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — permanent_dimension element (witnessPointsMm, offsetMm, eqEnabled)
packages/web/src/plan/planElementMeshBuilders.ts        — permanentDimensionThree() renderer
packages/web/src/plan/grip-providers/                   — grip provider pattern (read an existing one)
packages/web/src/plan/symbology.ts                       — rendering loop
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `permanent_dimension` in `core/index.ts`: `{ witnessPointsMm: XY[], offsetMm: XY, eqEnabled? }`. `offsetMm` positions the dimension line relative to the witness chain centroid.
- `permanentDimensionThree()` in `planElementMeshBuilders.ts` — read fully. Find where the text label and dimension line are positioned. `userData.bimPickId` and `userData.dimOffsetDrag` are already tagged on the geometry.
- Existing grip providers in `grip-providers/` — read one end-to-end to understand the `GripProvider` interface (`getGrips`, `onCommit`, `onNumericOverride`).
- `update_element_property` command — how property changes are dispatched.

---

## Tasks

### A — Dimension text offset grip

Create `packages/web/src/plan/grip-providers/permanentDimGripProvider.ts`:

```ts
export function permanentDimGripProvider(
  dim: Extract<Element, { kind: 'permanent_dimension' }>,
): GripProvider;
```

Grips to expose:

1. **Text offset grip** — a small square handle positioned at `centroid(witnessPointsMm) + offsetMm`. Dragging it updates `offsetMm` by the drag delta. On commit: dispatch `update_element_property` for `offsetMm`.
2. **Witness point grips** — one handle per point in `witnessPointsMm`. Dragging moves that point. On commit: dispatch `update_element_property` for `witnessPointsMm`.

Each grip:

- `id`: `'dim-offset'` / `'dim-witness-{i}'`
- `positionMm`: computed as above
- `cursor`: `'move'`
- `userData.dimId = dim.id`

Register the provider in whichever file wires grip providers to element kinds (find it — likely `gripProviderForElement.ts` or similar).

### B — Flip dimension side

Add to `permanent_dimension` element in `core/index.ts` (if not present):

```ts
/** When true, dimension line is on the opposite side of the witness chain. */
flipped?: boolean | null;
```

In `permanentDimensionThree()`: when `dim.flipped`, negate the `offsetMm.y` component when computing the dimension line position.

In `InspectorContent.tsx`, for `el.kind === 'permanent_dimension'`, add:

- **"Flip"** button (`data-testid="inspector-dim-flip"`) — dispatches `update_element_property` for `flipped: !el.flipped`
- **Offset (mm)** read-only display (`data-testid="inspector-dim-offset"`) — `"${Math.round(Math.hypot(el.offsetMm.x, el.offsetMm.y))} mm from chain"`

### C — Segment label positions

In `permanentDimensionThree()`, ensure each segment text label's `userData.segmentIndex = i` is set, so future grip work can move individual labels. No behaviour change — just tag the geometry.

### D — Tests

Write `packages/web/src/plan/grip-providers/permanentDimGrip.test.ts`:

```ts
describe('permanentDimGripProvider — §4.2.5', () => {
  it('returns a text-offset grip at centroid + offsetMm', () => { ... });
  it('returns one witness grip per witnessPoint', () => { ... });
  it('dragging text-offset grip produces new offsetMm', () => { ... });
  it('dragging witness grip at index 1 updates witnessPointsMm[1]', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/permanentDimInspector.test.tsx`:

```ts
describe('permanent dimension inspector — §4.2.5', () => {
  it('renders inspector-dim-flip button', () => { ... });
  it('flip button dispatches update_element_property for flipped', () => { ... });
  it('renders inspector-dim-offset readout', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave10/A): permanent dim text drag grip + flip (§4.2.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
