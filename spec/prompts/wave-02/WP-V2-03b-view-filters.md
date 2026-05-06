# WP-V2-03b — View Filters + View Range / Underlay UI

**Branch:** `feat/wp-v2-03b-view-filters`
**Wave:** 2, Batch B (parallel with WP-V2-04; start after Batch A is merged)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-03b → `done` when merged.

---

## Context

BIM AI is a browser-first BIM authoring tool. Stack: React 19 + Vite + TypeScript, Tailwind, Zustand, Three.js. pnpm workspace; web package is `packages/web/`.

This WP adds two things:

1. **View Filters** — rule-based filters that hide or override display of elements matching a criterion (e.g. all walls with materialKey = 'concrete'). Revit equivalent: Filters tab in the VV dialog.
2. **View Range / Underlay / Crop UI** — the data for these already exists in `plan_view` element (viewRangeBottomMm, viewRangeTopMm, cutPlaneOffsetMm, underlayLevelId, cropMinMm, cropMaxMm) but there is no editable UI. This WP adds an Inspector panel to edit them.

**Depends on WP-V2-03a** (the VVDialog) being merged first, because this WP adds a third tab ("Filters") to VVDialog and extends `planProjection.ts` which WP-V2-03a also touches.

---

## Part A — View Filters

### Data model

Add to `store.ts` `plan_view` element parsing:

```ts
export type FilterRule = {
  field: string;                  // element property key, e.g. 'materialKey', 'categoryKey'
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains';
  value: string;
};

export type ViewFilter = {
  id: string;                     // UUID
  name: string;
  rules: FilterRule[];            // all rules must match (AND logic)
  override: {
    visible?: boolean;
    projection?: {
      lineColor?: string | null;
      lineWeightFactor?: number;
      fillColor?: string | null;
    };
  };
};
```

In the `plan_view` branch:
```ts
const viewFiltersRaw = raw.viewFilters ?? raw.view_filters;
const viewFilters: ViewFilter[] = Array.isArray(viewFiltersRaw)
  ? (viewFiltersRaw as ViewFilter[])
  : [];
```

Add `viewFilters` to the returned element. Export `ViewFilter` and `FilterRule` types.

Add Zustand actions:
- `addViewFilter(planViewId: string, filter: ViewFilter)` — appends to `elementsById[planViewId].viewFilters` and calls `patchElement`.
- `updateViewFilter(planViewId: string, filterId: string, patch: Partial<ViewFilter>)` — patches a single filter.
- `removeViewFilter(planViewId: string, filterId: string)` — removes a filter by id.

### Filter evaluation in `planProjection.ts`

After applying VV category overrides (from WP-V2-03a), apply view filters. Add a function:

```ts
export function evaluateViewFilters(
  element: Element,
  filters: ViewFilter[],
): { visible: boolean; lineColor?: string | null; lineWeightFactor?: number; fillColor?: string | null } {
  let visible = true;
  let lineColor: string | null = null;
  let lineWeightFactor: number | undefined;
  let fillColor: string | null = null;

  for (const filter of filters) {
    const matches = filter.rules.every((rule) => {
      const val = (element as Record<string, unknown>)[rule.field];
      const strVal = val != null ? String(val) : '';
      switch (rule.operator) {
        case 'equals': return strVal === rule.value;
        case 'not-equals': return strVal !== rule.value;
        case 'contains': return strVal.includes(rule.value);
        case 'not-contains': return !strVal.includes(rule.value);
      }
    });
    if (matches) {
      if (filter.override.visible === false) visible = false;
      if (filter.override.projection?.lineColor) lineColor = filter.override.projection.lineColor;
      if (filter.override.projection?.lineWeightFactor != null)
        lineWeightFactor = filter.override.projection.lineWeightFactor;
      if (filter.override.projection?.fillColor) fillColor = filter.override.projection.fillColor;
    }
  }
  return { visible, lineColor, lineWeightFactor, fillColor };
}
```

Call this function in `PlanCanvas.tsx` when building plan mesh per element — elements where `visible === false` should be skipped (or have opacity set to 0). This is a PlanCanvas concern, not a planProjection concern — PlanCanvas iterates elements to build meshes and can call `evaluateViewFilters` per element.

### Filters tab in VVDialog

Add a **Filters** tab (third tab) to `VVDialog.tsx` (from WP-V2-03a).

```
┌────────────────────────────────────────────────────────────────────┐
│  Filters Tab                                                        │
│                                                                     │
│  [+ Add Filter]                                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Concrete Walls              [Edit] [Remove]                  │   │
│  │   materialKey equals "concrete"                             │   │
│  │   → Projection: lineColor=#d48800, hidden=false             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Hidden Windows              [Edit] [Remove]                  │   │
│  │   categoryKey equals "window"                               │   │
│  │   → visible=false                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

**Add/Edit filter flow:**
1. A sub-panel slides in with a name field, a rule builder (field dropdown + operator dropdown + value input), and an override builder (visibility checkbox + optional line color swatch).
2. Multiple rules can be added (AND logic).
3. Save adds/updates the filter in the draft state; Apply/OK syncs to store.

**Field dropdown options:** `categoryKey`, `materialKey`, `discipline`, `levelId`, `typeId`.

---

## Part B — View Range / Underlay / Crop Inspector Panel

### What to add

Create `packages/web/src/workspace/ViewRangePanel.tsx` — a compact Inspector panel that appears when a plan view is selected (or always visible in plan mode in a dedicated section of InspectorContent).

```
View Range
─────────────────────────────────
Top of Range      [+3000 mm] (from level)
Cut Plane         [-500 mm]
Bottom of Range   [-300 mm]

Underlay
─────────────────────────────────
Level             [Ground Floor ▾]  (dropdown of levels, + None)

Crop Region
─────────────────────────────────
Active            [ ] Enable
```

Fields:
- `cutPlaneOffsetMm` — number input (mm from level datum, negative = below)
- `viewRangeTopMm` — number input
- `viewRangeBottomMm` — number input
- `underlayLevelId` — `<select>` over levels from `elementsById` (kind = 'level'), + "None" option
- Crop Region enable/disable — checkbox that sets/clears `cropMinMm`/`cropMaxMm`

On change, call `patchElement(activePlanViewId, { cutPlaneOffsetMm: value })` etc. (look at how other `patchElement` calls are structured in the store).

### Wire into InspectorContent

In `packages/web/src/workspace/InspectorContent.tsx`, when the active plan view is selected (or in plan mode where inspector shows view properties), add a `<ViewRangePanel />` section.

Find the section that already renders `PlanViewGraphicsMatrix` — add `<ViewRangePanel />` just above it.

---

## Key file locations

| Path | Role |
|---|---|
| `packages/web/src/state/store.ts` | Add `ViewFilter`, `FilterRule` types; `viewFilters` on plan_view |
| `packages/web/src/plan/planProjection.ts` | `evaluateViewFilters` function |
| `packages/web/src/workspace/VVDialog.tsx` | Add Filters tab (depends on WP-V2-03a) |
| `packages/web/src/plan/PlanCanvas.tsx` | Call `evaluateViewFilters` per element when building meshes |
| New: `packages/web/src/workspace/ViewRangePanel.tsx` | View Range / Underlay / Crop UI |
| `packages/web/src/workspace/InspectorContent.tsx` | Add `<ViewRangePanel />` |

---

## Tests

Add to a new `packages/web/src/plan/planProjection.viewFilters.test.ts`:

```ts
describe('evaluateViewFilters', () => {
  it('returns visible=true when no filters match', ...)
  it('returns visible=false when a matching filter has visible=false', ...)
  it('applies lineWeightFactor from matching filter', ...)
  it('AND logic: all rules must match for filter to apply', ...)
  it('later filters win over earlier filters (last match wins)', ...)
})
```

Add render tests for `ViewRangePanel`:
- Renders cutPlaneOffsetMm input with current value.
- Changing cutPlaneOffsetMm input calls `patchElement` with new value.

---

## Constraints

- `evaluateViewFilters` must be a pure function (no side effects, no store reads) — takes element + filters[] as params.
- Do not change `planProjection.ts` signature of existing exported functions.
- `make verify` must pass.

---

## Commit format

```
feat(view): WP-V2-03b — View Filters + View Range / Underlay UI

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
