# Wave 10 — WP-B: View Range Dialog with Visual Diagram (§2.1.5 + §3.5.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — plan_view element (viewRangeTopMm, viewRangeBottomMm, cutPlaneOffsetMm)
packages/web/src/workspace/Workspace.tsx                 — modal dialog state pattern
packages/web/src/workspace/ManageGlobalParamsDialog.tsx  — reference dialog pattern
packages/web/src/plan/symbology.ts                       — plan rendering (uses cutPlaneOffsetMm)
packages/web/src/workspace/inspector/InspectorContent.tsx — plan_view inspector
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `plan_view` element in `core/index.ts` — find `viewRangeTopMm`, `viewRangeBottomMm`, `cutPlaneOffsetMm`. These already exist; you are building the dialog UI around them.
- `ManageGlobalParamsDialog.tsx` — exact pattern to follow for opening/closing a manage-tab dialog.
- `InspectorContent.tsx` plan_view section — check what already exists for view range inputs. Do NOT remove existing inputs; the dialog complements them.
- `Workspace.tsx` — find where `dimStyleOpen` or other dialog states are managed. Follow the same pattern.

---

## Tasks

### A — ViewRangeDialog component

Create `packages/web/src/workspace/ViewRangeDialog.tsx`:

```tsx
interface ViewRangeDialogProps {
  open: boolean;
  onClose: () => void;
  planView: Extract<Element, { kind: 'plan_view' }>;
  levelElevationsMm: Record<string, number>; // levelId → elevationMm
  onSave: (patch: { viewRangeTopMm: number; viewRangeBottomMm: number; cutPlaneOffsetMm: number }) => void;
}
export function ViewRangeDialog(props: ViewRangeDialogProps): JSX.Element | null
```

- `data-testid="view-range-dialog"` on container; return `null` when `open === false`
- Three numeric inputs:
  - **Top of Range** (`data-testid="vr-top-mm"`) — mm above level datum; default 4000
  - **Cut Plane** (`data-testid="vr-cut-mm"`) — mm above level datum; default 1200
  - **Bottom of Range** (`data-testid="vr-bottom-mm"`) — mm, can be negative; default 0
- Validation: cut plane must be between bottom and top. Show inline error `data-testid="vr-error"` if invalid.
- **Visual diagram** (SVG, `data-testid="vr-diagram"`): a simple vertical cross-section schematic showing:
  - A horizontal dashed line for Top of Range (labelled "Top")
  - A solid horizontal line for Cut Plane (labelled "Cut") with a scissors icon
  - A horizontal dashed line for Bottom (labelled "Bottom")
  - Heights scaled proportionally within the SVG (height 200 px)
  - Updates live as inputs change
- **Save** button (`data-testid="vr-save"`) → `onSave(draft)` + `onClose()`
- **Cancel** button (`data-testid="vr-cancel"`) → `onClose()`

### B — Wire into Workspace

In `Workspace.tsx`:
- Add `viewRangeOpen` state and the active plan view id
- Resolve `plan_view` element from `elementsById` using `activePlanViewId`
- `onSave`: dispatch `update_element_property` for `viewRangeTopMm`, `viewRangeBottomMm`, `cutPlaneOffsetMm` in sequence (or use `update_element_property` with a patch object if the command supports it)
- Add a **"View Range…"** button in the plan view inspector or header (`data-testid="ribbon-view-range"`) that opens the dialog

### C — Palette command

In `defaultCommands.ts`:
```ts
registerCommand({
  id: 'view.view-range',
  label: 'View Range…',
  keywords: ['view range', 'cut plane', 'top', 'bottom', 'section height'],
  category: 'command',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => ctx.openViewRange?.(),
});
```

Add `openViewRange?: () => void` to `PaletteContext` in `registry.ts`.

### D — Tests

Write `packages/web/src/workspace/ViewRangeDialog.test.tsx`:
```ts
describe('ViewRangeDialog — §2.1.5', () => {
  it('renders view-range-dialog when open=true', () => { ... });
  it('does not render when open=false', () => { ... });
  it('shows vr-top-mm, vr-cut-mm, vr-bottom-mm inputs', () => { ... });
  it('shows vr-error when cut plane is above top', () => { ... });
  it('save button calls onSave with correct values', () => { ... });
  it('cancel calls onClose without saving', () => { ... });
  it('renders vr-diagram SVG element', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave10/B): view range dialog with visual diagram (§2.1.5 + §3.5.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
