# Wave 4 — WP-B: VV/VG Filters Tab — Parameter Filters + Graphic Overrides (§2.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — Element union + plan_view type (categoryOverrides)
packages/web/src/workspace/project/VVDialog.tsx         — 1409-line VV/VG dialog (tabs: model, annotation, filters, links)
packages/web/src/workspace/project/VVDialog.test.tsx    — VVDialog tests
packages/web/src/plan/planProjection.ts                 — applies categoryOverrides to plan rendering
packages/web/src/state/store.ts                         — store: CategoryOverrides type, openVVDialog, vvDialogOpen
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `VVDialog.tsx` with tabs: `'model' | 'annotation' | 'filters' | 'links'`
- Model + annotation tabs: category-level show/hide + line weight + transparency + pattern overrides
  — all working, with `CategoryRow` component and `CategoryOverride` type
- `planProjection.ts` already reads `categoryOverrides` from `plan_view` element and applies them
- The `'filters'` tab is the tab type defined but its UI is likely a stub — read the code first

---

## Tasks

### A — Data model: VG filter rule

In `core/index.ts`, add a VG filter type to the `plan_view` element (alongside the existing
`categoryOverrides` field):

```ts
vgFilters?: VGFilter[];
```

Define:
```ts
export type VGFilterRule = {
  field: string;        // e.g. 'kind', 'levelId', 'materialId', 'thicknessMm'
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string;        // always string — coerce numerics
};

export type VGFilter = {
  id: string;
  name: string;
  categories: string[];           // element kind strings this filter applies to
  rules: VGFilterRule[];          // all rules must match (AND)
  override: {
    visible?: boolean;
    color?: string;               // CSS hex
    lineWeightFactor?: number;
    transparencyPct?: number;     // 0–90
  };
};
```

---

### B — Filters tab UI in VVDialog

Replace the stub content of the `'filters'` tab with:

**Filter list** (left column, ~40% width):
- Rows: filter name + enabled checkbox
- "New filter" button (data-testid: `"vv-new-filter"`)
- "Delete" button on each row (data-testid: `"vv-delete-filter-${id}"`)

**Filter editor** (right column, ~60% width — shown when a filter is selected):
- **Name** text input
- **Categories** — multi-checkbox list of element kind strings (wall, floor, door, window, column,
  beam, room, etc.)
- **Rules** — up to 4 rules, each: field dropdown + operator dropdown + value input
- **Override** section: visible toggle, color picker (`<input type="color">`), line weight select,
  transparency slider

When the user edits a filter, dispatch:
`{ type: 'updateElement', id: activePlanViewId, patch: { vgFilters: updatedFilters } }`

Study how the model tab dispatches `categoryOverrides` changes and follow the same pattern.

---

### C — Apply filters in planProjection.ts

In `planProjection.ts`, after applying `categoryOverrides`, apply `vgFilters`:

```ts
for (const filter of (planView.vgFilters ?? [])) {
  if (!elementMatchesFilter(el, filter)) continue;
  // apply filter.override the same way categoryOverrides overrides are applied
}
```

Implement `elementMatchesFilter(el: Element, filter: VGFilter): boolean`:
- Element `kind` must be in `filter.categories` (if categories is non-empty)
- All rules must match:
  - `'equals'`: `String(el[field]) === rule.value`
  - `'not_equals'`: inverse
  - `'greater_than'` / `'less_than'`: numeric comparison of `Number(el[field])`
  - `'contains'`: `String(el[field]).includes(rule.value)` (case-insensitive)

Filters override `categoryOverrides` (filters take precedence).

---

### D — 3D viewport filter override

In `Viewport.tsx`, when a VG filter has `visible: false`, hide the matching element's mesh from
the Three.js scene (set `mesh.visible = false`). Study how `categoryOverrides.visible` is already
applied to 3D meshes and follow the same pattern.

---

## Tests

Add to `packages/web/src/workspace/project/VVDialog.filters.test.tsx` (new file):
1. "New filter" button adds a row to the filter list
2. Deleting a filter removes it from the list and dispatches updateElement
3. Selecting a filter shows its name/categories/rules in the editor
4. Changing filter name dispatches updated vgFilters array

Add to `packages/web/src/plan/planProjection.vgFilters.test.ts` (new file):
5. `elementMatchesFilter` — `equals` rule matches exact string
6. `elementMatchesFilter` — `greater_than` rule filters by numeric threshold
7. `elementMatchesFilter` — empty categories array matches all element kinds
8. Element with `visible: false` override excluded from plan render output

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §2.1.4 description — append:
```
VGFilter data model (`vgFilters` on plan_view): filter rules (field/operator/value, AND logic),
per-category scope, graphic override (visible/color/lineWeight/transparency). VVDialog filters tab:
filter list, editor (categories + rules + override), dispatches updateElement. planProjection.ts
applies filters after categoryOverrides. 8 tests.
```
Change status to `Done — P1`.

Update summary table row for Chapter 2.
