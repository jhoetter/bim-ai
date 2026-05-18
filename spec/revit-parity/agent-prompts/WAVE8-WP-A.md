# Wave 8 — WP-A: Permanent Dimension Chain Placement Grammar (§4.2.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — permanent_dimension element (witnessPointsMm, offsetMm, eqEnabled)
packages/web/src/tools/toolGrammar.ts                    — grammar state machines (read DimState for existing pattern)
packages/web/src/tools/toolRegistry.ts                   — tool registration ('dimension' tool already exists)
packages/web/src/plan/PlanCanvas.tsx                     — canvas click/keyboard wiring for tools
packages/web/src/plan/planElementMeshBuilders.ts        — permanentDimensionThree() renderer
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `permanent_dimension` element in `core/index.ts`: `{ kind: 'permanent_dimension', id, levelId, witnessPointsMm: XY[], offsetMm: XY, eqEnabled? }`. Two or more witness points define a chain.
- `permanentDimensionThree()` in `planElementMeshBuilders.ts` — already renders permanent dims as witness lines + dimension line + text labels. Read the rendering to understand the data contract.
- `'dimension'` tool in `toolRegistry.ts` — hotkey `DI`, plan mode. DO NOT add another tool — improve the existing grammar.
- `create_permanent_dimension` command — check `core/index.ts` for existing shape. If absent, add it.
- Existing `DimState` or dimension grammar in `toolGrammar.ts` — find what already exists and extend it.

---

## Tasks

### A — create_permanent_dimension command

In `core/index.ts`, add if not present:

```ts
export type CreatePermanentDimensionCmd = {
  type: 'create_permanent_dimension';
  id: string;
  levelId: string;
  witnessPointsMm: XY[];
  offsetMm: XY;
};
```

Handle in `Workspace.tsx`: create element with `eqEnabled: false` and add to `elementsById`.

### B — Dimension grammar (multi-click placement)

In `toolGrammar.ts`, find the existing dimension state machine. Replace or extend it with:

```ts
type PermanentDimState =
  | { phase: 'idle' }
  | { phase: 'picking'; levelId: string; points: XY[]; cursorMm: XY | null };
```

Events:

- `activate(levelId)` → `picking` with empty points
- `moveMouse(xMm, yMm)` → updates `cursorMm` (for preview line); emits `previewDim` effect
- `click(xMm, yMm)` → appends point to `points`; requires ≥1 existing points to form segments
- `commit` (Enter or double-click) → if `points.length >= 2`: emits `createPermanentDim` effect with witnessPointsMm = points, offsetMm = `{ x: 0, y: -1000 }` (1 m above points); returns to `idle`
- `cancel` (Escape) → idle

Wire into `PlanCanvas.tsx`:

- `case 'dimension'`: click dispatches `click`; mousemove dispatches `moveMouse`; Enter dispatches `commit`; double-click dispatches `commit`; Escape dispatches `cancel`
- On `createPermanentDim` effect: dispatch `{ type: 'create_permanent_dimension', id: nanoid(), levelId, witnessPointsMm, offsetMm }`

### C — Preview rendering

In `PlanCanvas.tsx`, when `phase === 'picking'` and `points.length >= 1`:

- Draw a temporary dashed polyline through `points` + `cursorMm` using `THREE.Line` with dashed material
- Show a small snap circle at each picked point (radius 100 mm)
- Name the preview object `userData.preview = 'dim-chain'` so it's cleaned up on re-render

### D — Offset adjustment via drag

In `planElementMeshBuilders.ts`, add `data-testid`-friendly `userData.bimPickId = d.id` to the dimension line mesh and `userData.dimOffsetDrag = true` so grip providers can detect it. The actual drag grip implementation is out of scope — just tag the geometry.

### E — Tests

Write `packages/web/src/tools/permanentDimGrammar.test.ts`:

```ts
describe('permanent dimension chain grammar — §4.2.1', () => {
  it('activate moves to picking phase', () => { ... });
  it('click appends witness points', () => { ... });
  it('commit with 2+ points emits createPermanentDim', () => { ... });
  it('commit with <2 points does nothing', () => { ... });
  it('cancel returns to idle from picking', () => { ... });
  it('moveMouse updates cursorMm', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
