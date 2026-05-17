# Wave 15 — WP-E: Per-View Category Visibility Override (§1.6.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — plan_view element type; CategoryVisualOverride type
packages/web/src/plan/PlanViewHeader.tsx            — view toolbar (add button here)
packages/web/src/plan/symbology.ts                  — rebuildPlanMeshes — applies category overrides
packages/web/src/workspace/VisibilityGraphicsDialog.tsx (or similar) — global VG dialog (read + re-use)
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: Find `CategoryVisualOverride` type — it has fields like `category`, `visible`, `colorHex`, `lineWeightPx`. Find the `plan_view` element type and check if it already has a `categoryOverrides` or `viewCategoryOverrides` field.
2. Look for `VisibilityGraphicsDialog` in workspace/ — understand how it works (per-category table with visible toggle, color override, line weight). Read it fully before building the per-view variant.
3. `symbology.ts`: find `rebuildPlanMeshes` and how it applies `categoryOverrides` from global `project_settings`. Understand the hook — you will add a second pass using per-view overrides.

---

## Tasks

### A — Add `viewCategoryOverrides` to `plan_view` in `core/index.ts`

Find the `plan_view` kind in `core/index.ts`. If it doesn't already have `viewCategoryOverrides`, add:
```ts
viewCategoryOverrides?: CategoryVisualOverride[] | null;
```

---

### B — Create `PerViewVGDialog.tsx`

Create `packages/web/src/workspace/PerViewVGDialog.tsx`:

This dialog is identical in structure to the global `VisibilityGraphicsDialog` but operates on a specific plan view's `viewCategoryOverrides` field instead of global `project_settings.categoryOverrides`.

```tsx
interface Props {
  open: boolean;
  onClose: () => void;
  activePlanViewId: string | null;
  elementsById: Record<string, Element | undefined>;
  onApply: (viewId: string, overrides: CategoryVisualOverride[]) => void;
}
```

The dialog should:
1. Read the active plan view's `viewCategoryOverrides` (or default to all visible).
2. Show the same per-category table (wall/floor/roof/ceiling/door/window/column/stair/room/dimension/text).
3. On apply, call `onApply(viewId, overrides)`.

The same categories and UI as the global dialog suffice — no need to build anything fancier. Reuse `CategoryVisualOverride[]` type directly.

---

### C — Wire into `PlanViewHeader.tsx`

Add props:
```ts
onPerViewVGOpen?: () => void;
```

Add a "VG" (per-view visibility) button in the toolbar:
```tsx
{onPerViewVGOpen ? (
  <button type="button" data-testid="plan-view-per-view-vg-btn" onClick={onPerViewVGOpen}
    title="Per-View Visibility/Graphics Override"
    style={{ padding: '2px 8px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--color-foreground)' }}>
    VG
  </button>
) : null}
```

---

### D — Wire dialog in `Workspace.tsx` (or wherever PlanViewHeader is rendered)

1. Add state: `const [perViewVGOpen, setPerViewVGOpen] = useState(false)`.
2. Pass `onPerViewVGOpen={() => setPerViewVGOpen(true)}` to `<PlanViewHeader>`.
3. Render `<PerViewVGDialog open={perViewVGOpen} onClose={() => setPerViewVGOpen(false)} activePlanViewId={activePlanViewId} elementsById={elementsById} onApply={(viewId, overrides) => void onSemanticCommand({ type: 'updateElementProperty', elementId: viewId, key: 'viewCategoryOverrides', value: overrides })} />`.

---

### E — Apply per-view overrides in `symbology.ts`

In `rebuildPlanMeshes` (or wherever category overrides are applied), after reading global overrides from `project_settings.categoryOverrides`, also read the active plan view's `viewCategoryOverrides`. The view-level override takes priority:

```ts
const globalOverrides = opts.categoryOverrides ?? [];
const viewOverrides = opts.viewCategoryOverrides ?? [];

// Merge: viewOverrides shadow globalOverrides by category name.
const effectiveOverrides = mergeOverrides(globalOverrides, viewOverrides);
// Apply effectiveOverrides to determine visibility/color/lineWeight per element kind.
```

Implement `mergeOverrides(global, view)` as a pure function: for each category, view override wins if present.

Pass `viewCategoryOverrides` into `rebuildPlanMeshes` opts from `PlanCanvas.tsx` (read from the active plan view element).

---

### F — Tests

`packages/web/src/workspace/perViewVGDialog.test.tsx`:
```ts
describe('per-view visibility/graphics dialog — §1.6.10', () => {
  it('renders per-view-vg-btn in plan view header when prop provided', () => { ... });
  it('dialog does not render when closed', () => { ... });
  it('dialog renders category rows when open', () => { ... });
  it('calls onApply with updated overrides', () => { ... });
});
```

`packages/web/src/plan/perViewVGMerge.test.ts`:
```ts
describe('mergeOverrides — §1.6.10', () => {
  it('view override shadows global for same category', () => { ... });
  it('global override survives when view has no entry for that category', () => { ... });
  it('empty view overrides returns global overrides unchanged', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/E): per-view category visibility override dialog (§1.6.10)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new VG and merge tests.
