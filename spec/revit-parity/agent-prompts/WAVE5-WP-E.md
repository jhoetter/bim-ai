# Wave 5 — WP-E: EQ Dimension Constraint + Global Parameters (§4.2.2 + §3.8)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — Element union + command types
packages/web/src/plan/planElementMeshBuilders.ts        — permanent dimension plan symbol
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/workspace/Workspace.tsx                — command queue / dispatch
packages/web/src/plan/columnAtGrids.ts                  — grid column helpers (reference)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `permanent_dimension` element type in `core/index.ts` with `segmentsMm: number[]` — read shape
- Plan symbol for permanent dimensions already renders segment labels in `planElementMeshBuilders.ts`
- `project_settings` element type exists in `core/index.ts` — read it

---

## Tasks

### A — EQ dimension: data model (§4.2.2)

Add `eqEnabled?: boolean` to the `permanent_dimension` type in `core/index.ts`.

### B — EQ dimension: plan symbol

In `planElementMeshBuilders.ts`, where the permanent dimension is rendered:
- When `dim.eqEnabled === true`, replace each segment label with "EQ" text (use the same text
  rendering approach as other labels)
- Add an "EQ" toggle button rendered at the midpoint of the dimension string — a small circle with
  "EQ" label, `userData.bimPickId = dim.id`, `userData.eqToggle = true`
- Color the EQ button blue when active (`#2563eb`), grey when inactive

Add a command: `{ type: 'toggle_dim_eq'; dimensionId: string }` — handles toggling `eqEnabled`.

Handle it in `Workspace.tsx`.

### C — Global parameters: data model (§3.8)

Add to `project_settings` element in `core/index.ts`:
```ts
globalParams?: Array<{
  id: string;
  name: string;
  value: number;
  unit: 'mm' | 'm' | 'deg' | 'unitless';
}>;
```

Add command: `{ type: 'upsert_global_param'; param: GlobalParam }` and
`{ type: 'delete_global_param'; paramId: string }`.

### D — Global parameters: dialog

Create `packages/web/src/workspace/ManageGlobalParamsDialog.tsx`:
- `data-testid="global-params-dialog"`
- A table of global parameters with columns: Name, Value, Unit
- "Add Parameter" button (`data-testid="global-params-add"`) → appends a row with a generated id
- Each row has editable name/value/unit fields
- "Delete" button per row dispatches `delete_global_param`
- Save dispatches `upsert_global_param` for each modified row

Wire it into `Workspace.tsx` similarly to `ManagePhasesDialog` (a state boolean + open/close).
Add a "Global Parameters" entry to the Manage tab in the ribbon (alongside "Phases").

### E — Tests

Write `packages/web/src/plan/eqDimension.test.ts`:
```ts
describe('EQ dimension symbol — §4.2.2', () => {
  it('eqEnabled=true replaces segment labels with "EQ" text userData', () => { ... });
  it('eqEnabled=false renders numeric segment labels', () => { ... });
  it('toggle_dim_eq command flips eqEnabled flag', () => { ... });
});
```

Write `packages/web/src/workspace/globalParams.test.ts`:
```ts
describe('global parameters — §3.8', () => {
  it('upsert_global_param adds new param to project_settings', () => { ... });
  it('delete_global_param removes param by id', () => { ... });
  it('ManageGlobalParamsDialog renders params from store', () => { ... });
  it('Add Parameter button appends a new row', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
