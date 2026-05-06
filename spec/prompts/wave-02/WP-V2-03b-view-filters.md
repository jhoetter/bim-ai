# WP-V2-03b — View Filters + evaluateViewFilters

**Branch:** `feat/wp-v2-03b-view-filters`
**Wave:** 2, Batch B (parallel with WP-V2-04; start after Batch A is merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-03b → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-03b-view-filters
git branch --show-current   # must print: feat/wp-v2-03b-view-filters
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/RedesignedWorkspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## Context

**What's already done (do not re-implement):**

- `InspectorContent.tsx` already has an editable View Range section (cutPlaneOffsetMm, viewRangeBottomMm, viewRangeTopMm) at line ~538.
- `plan_view` elements in the store already store `underlayLevelId`, `cropMinMm`, `cropMaxMm`.
- `CategoryOverride` / `CategoryOverrides` types and `vvDialogOpen` state are already in `storeTypes.ts`.
- `VVDialog.tsx` (from WP-V2-03a) already has Model + Annotation tabs.

**What this WP adds:**

1. `ViewFilter` / `FilterRule` types in `storeTypes.ts` + `viewFilters` field on `plan_view` in `store.ts`
2. Zustand actions: `addViewFilter`, `updateViewFilter`, `removeViewFilter`
3. Pure function `evaluateViewFilters` in `planProjection.ts`
4. A **Filters tab** in `VVDialog.tsx` (add after the existing Annotation tab)
5. Tests

---

## Files to touch

| File | Change |
|---|---|
| `packages/web/src/state/storeTypes.ts` | Add `ViewFilter`, `FilterRule` types; add actions to `StoreActions` |
| `packages/web/src/state/store.ts` | Parse `viewFilters` from raw plan_view; add 3 Zustand actions |
| `packages/web/src/plan/planProjection.ts` | Add `evaluateViewFilters` exported function |
| `packages/web/src/workspace/VVDialog.tsx` | Add Filters tab |
| `packages/web/src/plan/planProjection.viewFilters.test.ts` | New test file |

---

## Changes

Read all 5 files in a single parallel batch before making any edits.

### 1. `packages/web/src/state/storeTypes.ts`

**Add types after `CategoryOverrides`** — current line 94:
```ts
export type CategoryOverrides = Record<string, CategoryOverride>;

export type StoreState = {
```
Replace with:
```ts
export type CategoryOverrides = Record<string, CategoryOverride>;

export type FilterRule = {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains';
  value: string;
};

export type ViewFilter = {
  id: string;
  name: string;
  rules: FilterRule[];
  override: {
    visible?: boolean;
    projection?: {
      lineColor?: string | null;
      lineWeightFactor?: number;
      fillColor?: string | null;
    };
  };
};

export type StoreState = {
```

**Add actions to StoreActions** — the actions interface currently ends with:
```ts
  setCategoryOverride: (
    planViewId: string,
    categoryKey: string,
    override: CategoryOverride,
  ) => void;

  setActivity: (e: ActivityEvent[]) => void;
```
Replace with:
```ts
  setCategoryOverride: (
    planViewId: string,
    categoryKey: string,
    override: CategoryOverride,
  ) => void;
  addViewFilter: (planViewId: string, filter: ViewFilter) => void;
  updateViewFilter: (planViewId: string, filterId: string, patch: Partial<ViewFilter>) => void;
  removeViewFilter: (planViewId: string, filterId: string) => void;

  setActivity: (e: ActivityEvent[]) => void;
```

### 2. `packages/web/src/state/store.ts`

**Parse viewFilters in plan_view** — find the categoryOverrides parsing block (around line 750):
```ts
    const coRaw = raw.categoryOverrides ?? raw.category_overrides;
    const categoryOverrides: Record<string, unknown> =
      coRaw && typeof coRaw === 'object' && !Array.isArray(coRaw)
        ? (coRaw as Record<string, unknown>)
        : {};
    return {
```
Replace with:
```ts
    const coRaw = raw.categoryOverrides ?? raw.category_overrides;
    const categoryOverrides: Record<string, unknown> =
      coRaw && typeof coRaw === 'object' && !Array.isArray(coRaw)
        ? (coRaw as Record<string, unknown>)
        : {};
    const vfRaw = raw.viewFilters ?? raw.view_filters;
    const viewFilters = Array.isArray(vfRaw)
      ? (vfRaw as import('./storeTypes').ViewFilter[])
      : [];
    return {
```

**Add viewFilters to the returned object** — find the end of the plan_view return:
```ts
      categoryOverrides,
    };
  }
```
Replace with:
```ts
      categoryOverrides,
      viewFilters,
    };
  }
```

**Add 3 Zustand actions** — find the `setCategoryOverride` action (around line 1463):
```ts
    setCategoryOverride: (planViewId, categoryKey, override) => {
```
After the closing `},` of `setCategoryOverride`, add:
```ts
    addViewFilter: (planViewId, filter) => {
      const pv = get().elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const updated = [...(pv.viewFilters ?? []), filter];
      get().patchElement(planViewId, { viewFilters: updated });
    },
    updateViewFilter: (planViewId, filterId, patch) => {
      const pv = get().elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const updated = (pv.viewFilters ?? []).map((f) =>
        f.id === filterId ? { ...f, ...patch } : f,
      );
      get().patchElement(planViewId, { viewFilters: updated });
    },
    removeViewFilter: (planViewId, filterId) => {
      const pv = get().elementsById[planViewId];
      if (!pv || pv.kind !== 'plan_view') return;
      const updated = (pv.viewFilters ?? []).filter((f) => f.id !== filterId);
      get().patchElement(planViewId, { viewFilters: updated });
    },
```

### 3. `packages/web/src/plan/planProjection.ts`

Append to the **end of the file**:

```ts
/* ────────────────────────────────────────────────────────────────────── */
/* View filter evaluation                                                   */
/* ────────────────────────────────────────────────────────────────────── */

import type { ViewFilter } from '../state/storeTypes';

export function evaluateViewFilters(
  element: Element,
  filters: ViewFilter[],
): {
  visible: boolean;
  lineColor?: string | null;
  lineWeightFactor?: number;
  fillColor?: string | null;
} {
  let visible = true;
  let lineColor: string | null | undefined;
  let lineWeightFactor: number | undefined;
  let fillColor: string | null | undefined;

  for (const filter of filters) {
    const matches = filter.rules.every((rule) => {
      const val = (element as Record<string, unknown>)[rule.field];
      const strVal = val != null ? String(val) : '';
      switch (rule.operator) {
        case 'equals':
          return strVal === rule.value;
        case 'not-equals':
          return strVal !== rule.value;
        case 'contains':
          return strVal.includes(rule.value);
        case 'not-contains':
          return !strVal.includes(rule.value);
        default:
          return false;
      }
    });
    if (matches) {
      if (filter.override.visible === false) visible = false;
      if (filter.override.projection?.lineColor !== undefined)
        lineColor = filter.override.projection.lineColor;
      if (filter.override.projection?.lineWeightFactor != null)
        lineWeightFactor = filter.override.projection.lineWeightFactor;
      if (filter.override.projection?.fillColor !== undefined)
        fillColor = filter.override.projection.fillColor;
    }
  }
  return { visible, lineColor, lineWeightFactor, fillColor };
}
```

Note: `Element` is already imported at the top of this file (`import type { Element } from '@bim-ai/core'`). Add only the `ViewFilter` import.

### 4. `packages/web/src/workspace/VVDialog.tsx`

The file has two tabs. Find the tab header row — it will contain something like:

```tsx
          {(['model', 'annotation'] as const).map((tab) => (
```

or a similar tab-switching pattern. Read the current tab structure and add `'filters'` as a third tab.

For the filters tab body, render a minimal UI:
- A list of `viewFilters` from the active plan view (read via `useBimStore`)
- An "Add Filter" button that creates a new filter with a generated UUID (`crypto.randomUUID()`), name "New Filter", one empty rule
- Each filter row: name (editable input) + rule summary (read-only for now) + Remove button
- Call `addViewFilter`, `removeViewFilter` from store

Keep this simple — a functional list view with add/remove. Inline rule editing is a future WP.

---

## New file: `packages/web/src/plan/planProjection.viewFilters.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { evaluateViewFilters } from './planProjection';
import type { ViewFilter } from '../state/storeTypes';
import type { Element } from '@bim-ai/core';

const makeWall = (extra: Record<string, unknown> = {}): Element =>
  ({
    kind: 'wall',
    id: 'w1',
    name: 'Test',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 1000, yMm: 0 },
    heightMm: 3000,
    thicknessMm: 200,
    levelId: 'l1',
    ...extra,
  }) as unknown as Element;

describe('evaluateViewFilters', () => {
  it('returns visible=true with no filters', () => {
    expect(evaluateViewFilters(makeWall(), [])).toMatchObject({ visible: true });
  });

  it('returns visible=false when a matching filter hides the element', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Hide walls',
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { visible: false },
    };
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: false });
  });

  it('does not hide when the rule does not match', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Hide floors',
      rules: [{ field: 'kind', operator: 'equals', value: 'floor' }],
      override: { visible: false },
    };
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: true });
  });

  it('applies lineWeightFactor from matching filter', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Heavy walls',
      rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { projection: { lineWeightFactor: 2 } },
    };
    expect(evaluateViewFilters(makeWall(), [filter]).lineWeightFactor).toBe(2);
  });

  it('AND logic: all rules must match', () => {
    const filter: ViewFilter = {
      id: 'f1',
      name: 'Concrete walls',
      rules: [
        { field: 'kind', operator: 'equals', value: 'wall' },
        { field: 'materialKey', operator: 'equals', value: 'concrete' },
      ],
      override: { visible: false },
    };
    // Wall without materialKey — should NOT be hidden
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: true });
    // Wall with materialKey=concrete — should be hidden
    expect(evaluateViewFilters(makeWall({ materialKey: 'concrete' }), [filter])).toMatchObject({ visible: false });
  });

  it('later filters win (last match wins)', () => {
    const f1: ViewFilter = {
      id: 'f1', name: 'First', rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { projection: { lineWeightFactor: 2 } },
    };
    const f2: ViewFilter = {
      id: 'f2', name: 'Second', rules: [{ field: 'kind', operator: 'equals', value: 'wall' }],
      override: { projection: { lineWeightFactor: 3 } },
    };
    expect(evaluateViewFilters(makeWall(), [f1, f2]).lineWeightFactor).toBe(3);
  });

  it('not-equals operator matches correctly', () => {
    const filter: ViewFilter = {
      id: 'f1', name: 'Non-walls',
      rules: [{ field: 'kind', operator: 'not-equals', value: 'floor' }],
      override: { visible: false },
    };
    // wall kind != floor → matches → hidden
    expect(evaluateViewFilters(makeWall(), [filter])).toMatchObject({ visible: false });
  });
});
```

---

## Tests to run

```bash
pnpm --filter web exec vitest run \
  src/plan/planProjection.viewFilters.test.ts
```

All tests must pass.

## Typecheck

```bash
pnpm --filter web typecheck
```

---

## Commit format

```bash
git add packages/web/src/state/storeTypes.ts \
        packages/web/src/state/store.ts \
        packages/web/src/plan/planProjection.ts \
        packages/web/src/workspace/VVDialog.tsx \
        packages/web/src/plan/planProjection.viewFilters.test.ts
git commit -m "$(cat <<'EOF'
feat(view): WP-V2-03b — View Filters + evaluateViewFilters + VVDialog Filters tab

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-03b-view-filters
```
