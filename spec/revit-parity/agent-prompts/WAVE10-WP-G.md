# Wave 10 — WP-G: Beam System Inspector + Options Bar (§9.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — beam_system element type
packages/web/src/tools/toolRegistry.ts                   — ToolId union + registry
packages/web/src/tools/authoringCommandContract.ts       — AUTHORING_COMMAND_CONTRACTS
packages/web/src/cmdPalette/defaultCommands.ts           — palette entries
packages/web/src/workspace/authoring/OptionsBar.tsx      — per-tool options bar
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/state/store.ts                          — active tool state
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `beam_system` in `core/index.ts` — find the existing element type. It likely has `boundaryPointsMm`, `levelId`, possibly `spacingMm`, `directionDeg`. Read the FULL type definition before adding fields — only add what is missing.
- `OptionsBar.tsx` — read the FULL file. The `wall` section (location line, offset, chain mode) is the reference pattern. Use the exact same prop/store access pattern. The column section (if added by WP-E) also shows how numeric fields work.
- `InspectorContent.tsx` — find the `beam_system` section if it exists. If it does, extend it. If it does not, add one following the same pattern as `column` or `floor` sections.
- `store.ts` — find all active-tool state slices (e.g. `wallDrawHeightMm`, `columnDrawHeightMm`). Add equivalent beam-system slices only if they are not already there.
- `defaultCommands.ts` — check if `tool.beam-system` already exists. Do NOT add a duplicate.
- `toolRegistry.ts` — check if `'beam-system'` is already in the ToolId union. Do NOT add a duplicate.

---

## Tasks

### A — Core type: beam_system fields

In `core/index.ts`, ensure the `beam_system` element type has all of these fields. Add only the ones that are missing:

```ts
spacingMm: number;          // distance between beam runs, default 1500
directionDeg: number;       // angle of beam runs relative to element X axis, default 0
beamCount?: number | null;  // if set, overrides spacingMm with fixed count
beamTypeId?: string | null; // reference to a beam family/type element
justification?: 'beginning' | 'center' | 'end' | null; // spacing origin
```

Also add a command type if missing:

```ts
export type UpdateBeamSystemCmd = {
  type: 'update_beam_system';
  id: string;
  patch: Partial<Pick<Extract<Element, { kind: 'beam_system' }>,
    'spacingMm' | 'directionDeg' | 'beamCount' | 'beamTypeId' | 'justification'>>;
};
```

Export `UpdateBeamSystemCmd` from the index.

### B — Store slices for beam-system options bar

In `store.ts`, add the following slices if they are not already present:

```ts
beamSystemSpacingMm: number;        // default 1500
beamSystemDirectionDeg: number;     // default 0
setBeamSystemSpacingMm: (v: number) => void;
setBeamSystemDirectionDeg: (v: number) => void;
```

Follow the exact pattern of the existing wall/column draw-state slices.

### C — Tool registration (4-place rule)

Check `toolRegistry.ts`, `authoringCommandContract.ts`, and `defaultCommands.ts` — `'beam-system'` may already be registered from a prior wave. If any of the three places are missing, add them now:

**toolRegistry.ts** (if missing):
```ts
'beam-system': {
  hotkey: 'BS',
  label: 'Beam System',
  mode: 'plan',
  category: 'structure',
  surfaces: ['ribbon', 'cmd-k'],
},
```

**authoringCommandContract.ts** (if missing):
```ts
'beam-system': {
  kind: 'sketch',
  completionBehavior: 'explicit-finish',
},
```

**defaultCommands.ts** (if missing):
```ts
registerCommand({
  id: 'tool.beam-system',
  label: 'Beam System',
  keywords: ['beam system', 'structural beam', 'beam grid', 'framing'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'beam-system'),
});
```

### D — OptionsBar section for beam-system tool

In `OptionsBar.tsx`, add a section for `planTool === 'beam-system'`:

- **Spacing (mm)** (`data-testid="options-bar-beam-spacing"`): number input, min=100. Read from / write to `beamSystemSpacingMm` in store. Default 1500.
- **Direction (°)** (`data-testid="options-bar-beam-direction"`): number input, 0–359. Read from / write to `beamSystemDirectionDeg` in store. Default 0.
- **Justification** (`data-testid="options-bar-beam-justification"`): `<select>` with options `beginning`, `center`, `end`. Store in local React state (not Zustand) since it is less critical; default `center`.

### E — Inspector section for beam_system elements

In `InspectorContent.tsx`, for `el.kind === 'beam_system'`, add (or extend) an inspector panel:

- **Spacing (mm)** (`data-testid="inspector-beam-spacing"`): number input. On blur/enter: dispatch `update_element_property` for `spacingMm`.
- **Direction (°)** (`data-testid="inspector-beam-direction"`): number input. On blur/enter: dispatch `update_element_property` for `directionDeg`.
- **Beam count** (`data-testid="inspector-beam-count"`): number input, optional. On blur: dispatch for `beamCount`. A "—" value (empty) clears the override.
- **Justification** (`data-testid="inspector-beam-justification"`): `<select>` with `beginning` | `center` | `end`. On change: dispatch for `justification`.
- **Level** (`data-testid="inspector-beam-level"`): read-only display of the level name (look up by `el.levelId`).

### F — Workspace handler

In `Workspace.tsx`, add a handler for `update_beam_system`:

```ts
case 'update_beam_system': {
  const { id, patch } = cmd as UpdateBeamSystemCmd;
  updateElement(id, (el) => ({ ...el, ...patch }));
  break;
}
```

Read existing handlers (`update_toposolid`, `split_wall`) and follow the same pattern.

### G — Tests

Write `packages/web/src/workspace/authoring/optionsBarBeamSystem.test.tsx`:
```ts
describe('options bar — beam system tool (§9.3)', () => {
  it('renders options-bar-beam-spacing when planTool=beam-system', () => { ... });
  it('renders options-bar-beam-direction input', () => { ... });
  it('renders options-bar-beam-justification select', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/beamSystemInspector.test.tsx`:
```ts
describe('beam system inspector — §9.3', () => {
  it('renders inspector-beam-spacing input with element value', () => { ... });
  it('renders inspector-beam-direction input', () => { ... });
  it('renders inspector-beam-count input', () => { ... });
  it('spacing change dispatches update_element_property for spacingMm', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave10/G): beam system inspector + options bar (§9.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
