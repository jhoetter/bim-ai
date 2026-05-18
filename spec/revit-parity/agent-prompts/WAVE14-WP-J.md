# Wave 14 — WP-J: Set Work Plane Dialog + Thin Lines Toggle (§7.3.1 + §1.6.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — reference_plane element type, plan_view
packages/web/src/cmdPalette/defaultCommands.ts          — palette commands
packages/web/src/workspace/Workspace.tsx                — command handlers, state
packages/web/src/plan/PlanViewHeader.tsx                — plan view toolbar buttons
packages/web/src/plan/PlanCanvas.tsx                    — plan canvas, rendering
packages/web/src/plan/symbology.ts                      — plan mesh builders (line weights)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find `reference_plane` element type. Note its fields (name, positionMm, normalMm, etc.). Find `plan_view` — note if it has an `activeWorkPlaneId` or `activeRefPlaneId` field. If not, you will add it.
- `Workspace.tsx` — find how `plan_view` elements are updated (similar to how crop region or view range is updated). Read the `set_work_plane` command if it exists.
- `defaultCommands.ts` — check for existing `view.set-work-plane` command. Do NOT duplicate.
- `PlanViewHeader.tsx` — find the toolbar buttons. Find where the "thin lines" toggle might go. Read how existing toolbar buttons are structured.
- `symbology.ts` — find where `linewidth` / `lineWidth` is set on plan materials. Find `THREE.LineBasicMaterial` usage. All line widths are set here.

---

## Tasks

## Part 1: Set Work Plane (§7.3.1)

### A — Add `activeWorkPlaneId` to plan_view element in `core/index.ts`

Find the `plan_view` element type. If it doesn't have `activeWorkPlaneId?: string | null`, add it.

### B — `SetWorkPlaneDialog.tsx`

Create `packages/web/src/workspace/SetWorkPlaneDialog.tsx`:

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
  referencePlanes: Array<{ id: string; name: string }>;
  currentWorkPlaneId: string | null;
  onApply: (refPlaneId: string | null) => void;
}

export function SetWorkPlaneDialog({
  open,
  onClose,
  referencePlanes,
  currentWorkPlaneId,
  onApply,
}: Props) {
  if (!open) return null;
  return (
    <dialog open data-testid="set-work-plane-dialog" className="modal-base">
      <h2 className="text-sm font-medium mb-3">Set Work Plane</h2>
      <div className="mb-3">
        <label className="text-xs text-muted block mb-1">Reference Plane</label>
        <select
          data-testid="set-work-plane-select"
          defaultValue={currentWorkPlaneId ?? ''}
          className="w-full text-xs border border-border rounded px-2 py-1"
          onChange={(e) => onApply(e.currentTarget.value || null)}
        >
          <option value="">None</option>
          {referencePlanes.map((rp) => (
            <option key={rp.id} value={rp.id}>
              {rp.name || `Ref Plane ${rp.id.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          className="btn-secondary text-xs"
          onClick={onClose}
          data-testid="set-work-plane-cancel"
        >
          Cancel
        </button>
        <button className="btn-primary text-xs" onClick={onClose} data-testid="set-work-plane-ok">
          OK
        </button>
      </div>
    </dialog>
  );
}
```

### C — Wire into Workspace.tsx + palette command

1. In `Workspace.tsx`, add state `setWorkPlaneOpen: boolean` and handler that dispatches `set_work_plane { viewId, refPlaneId }` command which patches `activeWorkPlaneId` on the active plan_view element.

2. In `defaultCommands.ts`, register:

```ts
registerCommand({
  id: 'view.set-work-plane',
  label: 'Set Work Plane',
  keywords: ['work plane', 'reference plane', 'set plane'],
  category: 'command',
  invoke: (ctx) => {
    ctx.setWorkPlaneOpen?.(true);
  },
});
```

Add `setWorkPlaneOpen?: (open: boolean) => void` to `PaletteContext` if needed.

3. Show the active work plane name in `PlanViewHeader.tsx` when `activeWorkPlaneId` is set: a small badge `"Work Plane: {name}"` with an × button to clear.

---

## Part 2: Thin Lines Toggle (§1.6.10 remaining)

### D — Add `thinLines` field to `plan_view` in `core/index.ts`

If it doesn't exist, add `thinLines?: boolean | null` to the `plan_view` element type.

### E — Thin lines toggle button in `PlanViewHeader.tsx`

Add a button `"TL"` (or a thin-line icon) to the plan view toolbar:

```tsx
<button
  data-testid="plan-view-thin-lines-toggle"
  title="Thin Lines"
  className={cn('toolbar-btn', activePlanView?.thinLines && 'toolbar-btn-active')}
  onClick={() =>
    dispatch({
      type: 'update_plan_view',
      id: activePlanViewId,
      patch: { thinLines: !activePlanView?.thinLines },
    })
  }
>
  TL
</button>
```

### F — Apply thin lines in `symbology.ts`

In `symbology.ts`, find where `THREE.LineBasicMaterial` or `THREE.LineDashedMaterial` are created with `linewidth` > 1. Add a `thinLines` option parameter to `rebuildPlanMeshes` (or the equivalent top-level function).

When `thinLines === true`, override all `linewidth` values to `1` (the minimum — Three.js ignores linewidth > 1 in WebGL anyway on most platforms, but set it explicitly for correctness).

Tag all plan mesh materials with `userData.thinLines = true` when in thin-lines mode.

### G — Tests

`packages/web/src/workspace/setWorkPlaneDialog.test.tsx`:

```ts
describe('set work plane dialog — §7.3.1', () => {
  it('renders set-work-plane-dialog when open=true', () => { ... });
  it('does not render when open=false', () => { ... });
  it('lists reference planes in dropdown', () => { ... });
  it('calls onApply with selected ref plane id', () => { ... });
  it('shows None option', () => { ... });
});
```

`packages/web/src/plan/thinLinesToggle.test.ts`:

```ts
describe('thin lines toggle — §1.6.10', () => {
  it('thinLines=true on plan_view renders with linewidth=1', () => { ... });
  it('thinLines=false uses default line weights', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave14/J): set work plane dialog + thin lines toggle (§7.3.1 + §1.6.10)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
