# Wave 10 — WP-E: Options Bar Completion — Floor, Column, Stair, Room (§1.6.8)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/workspace/authoring/OptionsBar.tsx      — per-tool options bar (read fully first)
packages/web/src/state/store.ts                          — active level, wall type, floor type etc.
packages/core/src/index.ts                               — element types (floor, column, stair, room)
packages/web/src/plan/PlanCanvas.tsx                     — where options bar values feed into placed elements
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `OptionsBar.tsx` — read the FULL file. It already has a section for `wall` (location line, offset, chain mode). Understand the prop/store pattern before adding new sections.
- `PlanCanvas.tsx` — find where the wall tool reads options bar values when creating wall elements. Use the same pattern for floor/column/stair/room.
- `store.ts` — find what active-tool state is already tracked (activeWallTypeId, activeLevelId, wallDrawHeightMm etc). Add equivalent fields for floor/column/stair where missing.

---

## Tasks

### A — Floor tool options bar

In `OptionsBar.tsx`, add a section for `planTool === 'floor'` and `'floor-sketch'`:

- **Floor type** (`data-testid="options-bar-floor-type"`): `<select>` listing all `floor_type` elements sorted by name + "— None —". Default = first floor_type or none. Store in `activeFloorTypeId` in store.
- **Level** (`data-testid="options-bar-floor-level"`): `<select>` listing all levels. Default = activeLevelId.
- **Offset (mm)** (`data-testid="options-bar-floor-offset"`): number input, default 0. Adds vertical offset to placed floor `baseElevationMm`.

In `PlanCanvas.tsx`, when creating a floor element, read `activeFloorTypeId` from store and include it as `floorTypeId` on the created element.

### B — Column tool options bar

In `OptionsBar.tsx`, add a section for `planTool === 'column'`:

- **Level** (`data-testid="options-bar-column-level"`): `<select>` listing all levels. Default = activeLevelId.
- **Height (mm)** (`data-testid="options-bar-column-height"`): number input, default 3000.
- **Width (mm)** (`data-testid="options-bar-column-width"`): number input, default 300.
- **Depth (mm)** (`data-testid="options-bar-column-depth"`): number input, default 300.

Store these in Zustand slices (`columnDrawHeightMm`, `columnDrawWidthMm`, `columnDrawDepthMm`). Wire into `PlanCanvas.tsx` column placement.

### C — Stair tool options bar

In `OptionsBar.tsx`, add a section for `planTool === 'stair'`:

- **Base level** (`data-testid="options-bar-stair-base-level"`): `<select>` — default = activeLevelId.
- **Top level** (`data-testid="options-bar-stair-top-level"`): `<select>` — default = level above base.
- **Width (mm)** (`data-testid="options-bar-stair-width"`): number input, default 1200.
- **Run width (mm)** (`data-testid="options-bar-stair-run-width"`): number input, default 250.

Wire into stair placement in `PlanCanvas.tsx`.

### D — Room tool options bar

In `OptionsBar.tsx`, add a section for `planTool === 'room'`:

- **Name** (`data-testid="options-bar-room-name"`): text input, default "Room". Used as the placed room's `name`.
- **Number** (`data-testid="options-bar-room-number"`): text input, default "". Used as `numberLabel`.
- **Upper limit level** (`data-testid="options-bar-room-upper-level"`): `<select>` listing levels above active. Default = level above active.

Wire into room placement in `PlanCanvas.tsx`.

### E — Tests

Write `packages/web/src/workspace/authoring/optionsBarFloor.test.tsx`:

```ts
describe('options bar — floor tool (§1.6.8)', () => {
  it('renders options-bar-floor-type select when planTool=floor', () => { ... });
  it('renders options-bar-floor-level select', () => { ... });
  it('renders options-bar-floor-offset input', () => { ... });
});
```

Write `packages/web/src/workspace/authoring/optionsBarColumn.test.tsx`:

```ts
describe('options bar — column tool (§1.6.8)', () => {
  it('renders options-bar-column-height when planTool=column', () => { ... });
  it('renders options-bar-column-width', () => { ... });
  it('renders options-bar-column-depth', () => { ... });
});
```

Write `packages/web/src/workspace/authoring/optionsBarStair.test.tsx`:

```ts
describe('options bar — stair tool (§1.6.8)', () => {
  it('renders options-bar-stair-base-level when planTool=stair', () => { ... });
  it('renders options-bar-stair-top-level', () => { ... });
  it('renders options-bar-stair-width', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave10/E): options bar — floor/column/stair/room tool sections (§1.6.8)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
