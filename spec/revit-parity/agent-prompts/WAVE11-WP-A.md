# Wave 11 — WP-A: Visibility/Graphics Override Dialog (§2.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — plan_view element type
packages/web/src/workspace/Workspace.tsx                 — modal dialog state pattern
packages/web/src/workspace/ManageGlobalParamsDialog.tsx  — reference table dialog pattern
packages/web/src/workspace/ViewRangeDialog.tsx           — reference simple dialog pattern
packages/web/src/plan/symbology.ts                       — rendering (uses plan_view fields)
packages/web/src/plan/planProjection.ts                  — lens / category visibility
packages/web/src/workspace/inspector/InspectorContent.tsx — plan_view inspector section
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `plan_view` element in `core/index.ts` — find all existing fields including `hiddenSemanticKinds`, `lensFilter`, any existing `categoryOverrides`. Read the full type.
- `planProjection.ts` — find `resolvePlanViewDisplay` and the lens/visibility system. Understand how element kinds are currently shown/hidden in plan.
- `symbology.ts` — find `rebuildPlanMeshes` and how it uses plan_view fields to decide element visibility and colour.
- `ManageGlobalParamsDialog.tsx` — full read. Use this exact pattern for table rows with inline editing.
- `Workspace.tsx` — find `viewRangeOpen` state (added by wave 10) and follow the exact same pattern for `vgOpen`.

---

## Tasks

### A — Core type: category visual overrides

In `core/index.ts`, add to the `plan_view` element (if not already present):

```ts
/** Per-category visual overrides for the plan view. */
categoryOverrides?: Record<string, CategoryVisualOverride> | null;

interface CategoryVisualOverride {
  hidden?: boolean;
  colorHex?: string | null;      // e.g. '#2563eb' — null = use default
  lineWeightPx?: number | null;  // 0.5–4; null = use default
}
```

The key is the element `kind` string (e.g. `'wall'`, `'floor'`, `'door'`, `'window'`, `'column'`, `'room'`, `'stair'`, `'railing'`, `'ceiling'`, `'roof'`, `'permanent_dimension'`, `'text_note'`).

Export `CategoryVisualOverride` from the index.

Also add command type:

```ts
export type UpdateCategoryOverrideCmd = {
  type: 'update_category_override';
  planViewId: string;
  category: string;
  patch: CategoryVisualOverride | null; // null = clear override
};
```

### B — VisibilityGraphicsDialog component

Create `packages/web/src/workspace/VisibilityGraphicsDialog.tsx`:

```tsx
interface VisibilityGraphicsDialogProps {
  open: boolean;
  onClose: () => void;
  planView: Extract<Element, { kind: 'plan_view' }>;
  onOverrideChange: (category: string, patch: CategoryVisualOverride | null) => void;
}
export function VisibilityGraphicsDialog(props): JSX.Element | null
```

- `data-testid="vg-dialog"` on container; return `null` when `open === false`
- Header: "Visibility/Graphics Overrides"
- A table with one row per category. Categories to show (hard-coded list, sorted):
  `wall, floor, roof, ceiling, door, window, column, stair, railing, room, permanent_dimension, text_note`
- Each row:
  - **Category name** (human-readable label, e.g. "Walls", "Floors")
  - **Visible** checkbox (`data-testid="vg-visible-{category}"`) — unchecked = hidden
  - **Color** color input (`data-testid="vg-color-{category}"`) — `<input type="color">` with current override or a default neutral
  - **Line weight** number input (`data-testid="vg-weight-{category}"`) — 0.5–4 step 0.5
  - **Reset** button (`data-testid="vg-reset-{category}"`) — clears override for that row (calls `onOverrideChange(category, null)`)
- Rows with no override show default values (greyed or italic)
- **Close** button (`data-testid="vg-close"`) — calls `onClose()`
- Changes apply immediately via `onOverrideChange` (no Save/Cancel — live preview)

### C — Wire into rendering

In `symbology.ts` / `rebuildPlanMeshes`, after existing lens/filter logic, apply `categoryOverrides`:

```ts
const override = planView.categoryOverrides?.[el.kind];
if (override?.hidden) { /* skip or hide mesh */ }
if (override?.colorHex) { /* apply color to mesh material */ }
if (override?.lineWeightPx) { /* apply line weight */ }
```

Read the existing lens/phase-style application code and extend it — do not rewrite it.

### D — Wire into Workspace

In `Workspace.tsx`:

- Add `vgOpen` state + `activePlanViewId` (check if it already exists from wave 10 ViewRange changes)
- `onOverrideChange`: dispatch `update_category_override`
- Add handler for `update_category_override` command: patch `plan_view.categoryOverrides` in `elementsById`
- Add **"Visibility/Graphics…"** button in the plan view toolbar or ribbon (`data-testid="ribbon-vg"`) that opens the dialog

### E — Palette command

In `defaultCommands.ts`:
```ts
registerCommand({
  id: 'view.visibility-graphics',
  label: 'Visibility/Graphics…',
  keywords: ['visibility', 'graphics', 'VG', 'category', 'override', 'hide', 'colour'],
  category: 'command',
  isAvailable: hasActivePlanView,
  invoke: (ctx) => ctx.openVisibilityGraphics?.(),
});
```

Add `openVisibilityGraphics?: () => void` to `PaletteContext`.

### F — Tests

Write `packages/web/src/workspace/VisibilityGraphicsDialog.test.tsx`:
```ts
describe('VisibilityGraphicsDialog — §2.1.4', () => {
  it('renders vg-dialog when open=true', () => { ... });
  it('returns null when open=false', () => { ... });
  it('renders vg-visible-wall checkbox', () => { ... });
  it('renders vg-color-wall input', () => { ... });
  it('unchecking vg-visible-wall calls onOverrideChange with hidden:true', () => { ... });
  it('clicking vg-reset-wall calls onOverrideChange with null', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave11/A): visibility/graphics override dialog (§2.1.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
