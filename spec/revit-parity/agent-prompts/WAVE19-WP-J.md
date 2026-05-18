# Wave 19 — WP-J: Stair Edit Mode — Inspector Toggle + Component Edit Panel (§8.6.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

Wave 16 WP-F added stair grips (`stairGripProvider.ts`) for riser-count and run-width drag editing. Inspector inputs for `riserCount`, `runWidthMm`, `landingDepthMm`, `totalHeightMm`, `riserHeightMm`, `multiStorey` exist. But there is no dedicated "Edit Stair" mode analogous to Revit's component-level stair editor.

**This wave adds:**

- `editStairActive` field on `stair` element in `core/index.ts`
- `enterStairEditMode` + `exitStairEditMode` command types
- `Workspace.tsx` handlers
- Inspector "Edit Stair" button that activates edit mode
- Inspector component edit panel (runs list with riser count + width per run) shown when `editStairActive: true`
- Palette command `modify.edit-stair` + capability graph entry

---

## Repo orientation

```
packages/core/src/index.ts                          — stair element type
packages/web/src/workspace/Workspace.tsx
packages/web/src/workspace/inspector/InspectorContent.tsx  — case 'stair':
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `InspectorContent.tsx` `case 'stair':` — understand what fields are already shown (`riserCount`, `runWidthMm`, etc.). Read `core/index.ts` for the complete `stair` element type definition.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Stair element additions in `core/index.ts`

Add if not present on the `stair` element:

```ts
editStairActive?: boolean;
runs?: { runIndex: number; riserCount: number; runWidthMm: number; startMm?: { xMm: number; yMm: number }; endMm?: { xMm: number; yMm: number } }[];
```

Add command types:

```ts
| { type: 'enterStairEditMode'; stairId: string }
| { type: 'exitStairEditMode'; stairId: string }
| { type: 'updateStairRun'; stairId: string; runIndex: number; riserCount?: number; runWidthMm?: number }
```

---

### B — `Workspace.tsx` handlers

```ts
case 'enterStairEditMode': {
  const stair = elementsById[cmd.stairId];
  if (stair?.kind === 'stair') {
    (stair as any).editStairActive = true;
  }
  break;
}
case 'exitStairEditMode': {
  const stair = elementsById[cmd.stairId];
  if (stair?.kind === 'stair') {
    (stair as any).editStairActive = false;
  }
  break;
}
case 'updateStairRun': {
  const stair = elementsById[cmd.stairId];
  if (stair?.kind === 'stair') {
    const runs: any[] = (stair as any).runs ?? [{ runIndex: 0, riserCount: (stair as any).riserCount ?? 10, runWidthMm: (stair as any).runWidthMm ?? 1200 }];
    const run = runs.find((r: any) => r.runIndex === cmd.runIndex) ?? { runIndex: cmd.runIndex, riserCount: 10, runWidthMm: 1200 };
    if (cmd.riserCount !== undefined) run.riserCount = cmd.riserCount;
    if (cmd.runWidthMm !== undefined) run.runWidthMm = cmd.runWidthMm;
    const idx = runs.findIndex((r: any) => r.runIndex === cmd.runIndex);
    if (idx >= 0) runs[idx] = run; else runs.push(run);
    (stair as any).runs = runs;
  }
  break;
}
```

---

### C — Inspector additions in `InspectorContent.tsx`

In `case 'stair':`, add after the existing stair property inputs:

```tsx
{
  /* Edit Stair Mode */
}
<div style={{ marginTop: 8, borderTop: '1px solid #ddd', paddingTop: 8 }}>
  {!(el as any).editStairActive ? (
    <button
      data-testid="inspector-stair-edit-btn"
      onClick={() => void onSemanticCommand?.({ type: 'enterStairEditMode', stairId: el.id })}
    >
      Edit Stair
    </button>
  ) : (
    <>
      <strong data-testid="inspector-stair-edit-mode-active">Edit Mode</strong>
      {/* Per-run editors */}
      {(
        (el as any).runs ?? [
          {
            runIndex: 0,
            riserCount: (el as any).riserCount ?? 10,
            runWidthMm: (el as any).runWidthMm ?? 1200,
          },
        ]
      ).map((run: any) => (
        <div
          key={run.runIndex}
          data-testid={`inspector-stair-run-${run.runIndex}`}
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}
        >
          <span>Run {run.runIndex + 1}</span>
          <label>
            Risers
            <input
              type="number"
              data-testid={`inspector-stair-run-risers-${run.runIndex}`}
              value={run.riserCount}
              min={1}
              onChange={(e) =>
                void onSemanticCommand?.({
                  type: 'updateStairRun',
                  stairId: el.id,
                  runIndex: run.runIndex,
                  riserCount: +e.target.value,
                })
              }
            />
          </label>
          <label>
            Width (mm)
            <input
              type="number"
              data-testid={`inspector-stair-run-width-${run.runIndex}`}
              value={run.runWidthMm}
              min={600}
              onChange={(e) =>
                void onSemanticCommand?.({
                  type: 'updateStairRun',
                  stairId: el.id,
                  runIndex: run.runIndex,
                  runWidthMm: +e.target.value,
                })
              }
            />
          </label>
        </div>
      ))}
      <button
        data-testid="inspector-stair-finish-edit-btn"
        style={{ marginTop: 8 }}
        onClick={() => void onSemanticCommand?.({ type: 'exitStairEditMode', stairId: el.id })}
      >
        Finish Editing
      </button>
    </>
  )}
</div>;
```

---

### D — Palette command + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'modify.edit-stair', label: 'Edit Stair',
  keywords: ['stair', 'edit', 'component', 'run', 'landing', 'modify'],
  category: 'command', invoke: (ctx) => {
    const stair = ctx.selectedElements?.find(e => e.kind === 'stair');
    if (stair) void ctx.onSemanticCommand?.({ type: 'enterStairEditMode', stairId: stair.id });
  } }
```

In `commandCapabilities.ts`:

```ts
{ id: 'modify.edit-stair', scope: 'selection', intendedModes: ['plan', '3d'], precondition: 'selected-stair' },
```

---

### E — Tests

`packages/web/src/workspace/inspector/stairEditModeInspector.test.tsx`:

```tsx
describe('stair edit mode inspector — §8.6.4', () => {
  it('renders Edit Stair button when not in edit mode', () => { ... });
  it('shows Edit Mode label when editStairActive is true', () => { ... });
  it('shows run editor with riser count input when in edit mode', () => { ... });
  it('shows Finish Editing button when in edit mode', () => { ... });
  it('does not show Finish Editing button when not in edit mode', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/J): stair edit mode — enterStairEditMode command + inspector component edit panel (§8.6.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
