# WP-V2-03a — Visibility/Graphics (VV) Dialog

**Branch:** `feat/wp-v2-03a-vv-dialog`
**Wave:** 2, Batch A (parallel with WP-V2-02)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-03a → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-03a-vv-dialog
git branch --show-current   # must print: feat/wp-v2-03a-vv-dialog
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/RedesignedWorkspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## What's already done on `main` (do not re-implement)

The previous agent implemented most of this WP directly on `main`. These are already in place:

| What | Where |
|---|---|
| `CategoryOverride`, `CategoryOverrides` types | `storeTypes.ts` lines 76–94 |
| `vvDialogOpen`, `openVVDialog`, `closeVVDialog`, `setCategoryOverride` state + actions | `store.ts` lines 1457–1476, `storeTypes.ts` lines 184–191 |
| `VVDialog` imported + rendered + `V` key shortcut | `RedesignedWorkspace.tsx` lines 117, 233–235, 756, 785, 1143 |
| `VVDialog.tsx` + `VVDialog.test.tsx` | Untracked files in `packages/web/src/workspace/` — just need committing |

---

## What this WP still needs

### 1. Apply `categoryOverrides` in `planProjection.ts`

`resolvePlanCategoryGraphics` (line 228) resolves per-category graphics from template + plan_view hints but does NOT yet apply `plan_view.categoryOverrides`.

**File:** `packages/web/src/plan/planProjection.ts`

Find the `return out;` at the end of `resolvePlanCategoryGraphics` (the function ends around line 283 with the closing brace). The function builds `out` as `Record<PlanCategoryGraphicCategoryKey, ResolvedPlanCategoryGraphic>`.

**Add `visible` and `lineColor` fields to `ResolvedPlanCategoryGraphic`** — find the type definition near line 212:
```ts
  lineWeightFactor: number;
```
Read the full `ResolvedPlanCategoryGraphic` type to see all fields, then add:
```ts
  lineWeightFactor: number;
  visible: boolean;
  lineColor: string | null;
```

**After the `for (const key of PLAN_CATEGORY_GRAPHIC_KEYS)` loop, before `return out;`** — add:

```ts
  // Apply per-view category overrides (VV dialog overrides)
  const overrides = el.categoryOverrides as import('../state/storeTypes').CategoryOverrides | undefined;
  if (overrides) {
    for (const [catKey, ovr] of Object.entries(overrides)) {
      const k = catKey as PlanCategoryGraphicCategoryKey;
      if (!out[k]) continue;
      if (ovr.visible === false) out[k].visible = false;
      if (ovr.projection?.lineWeightFactor != null)
        out[k].lineWeightFactor = ovr.projection.lineWeightFactor;
      if (ovr.projection?.lineColor !== undefined)
        out[k].lineColor = ovr.projection.lineColor ?? null;
    }
  }
```

And initialise `visible: true, lineColor: null` in each key's `out[key] = { ... }` assignment inside the loop.

### 2. Commit the untracked files

The files `packages/web/src/workspace/VVDialog.tsx` and `packages/web/src/workspace/VVDialog.test.tsx` exist on disk but are untracked. Add them to the branch commit.

Check: `git status --short` should show `?? packages/web/src/workspace/VVDialog.tsx`.

If the VVDialog tests fail, investigate and fix. The tests cover:
- Dialog renders with 12+ model category rows.
- Unchecking a visibility checkbox sets `draft[cat].visible = false`.
- Clicking Apply calls `setCategoryOverride` once per changed category.

---

## Files to touch

| File | Change |
|---|---|
| `packages/web/src/plan/planProjection.ts` | Add `visible`/`lineColor` to `ResolvedPlanCategoryGraphic`; apply `categoryOverrides` in `resolvePlanCategoryGraphics` |
| `packages/web/src/workspace/VVDialog.tsx` | Already written — just commit |
| `packages/web/src/workspace/VVDialog.test.tsx` | Already written — fix any failures, then commit |

---

## Tests to run

```bash
pnpm --filter web exec vitest run src/workspace/VVDialog.test.tsx src/plan/planProjection.test.ts
```

All tests must pass.

## Typecheck

```bash
pnpm --filter web typecheck
```

---

## Commit format

```bash
git add packages/web/src/plan/planProjection.ts \
        packages/web/src/workspace/VVDialog.tsx \
        packages/web/src/workspace/VVDialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(view): WP-V2-03a — VV dialog + categoryOverrides in planProjection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-03a-vv-dialog
```
