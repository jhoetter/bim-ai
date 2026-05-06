# WP-V2-03a — Visibility/Graphics (VV) Dialog

**Branch:** `feat/wp-v2-03a-vv-dialog`
**Wave:** 2, Batch A (parallel with WP-V2-02)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-03a → `done` when merged.

---

## Context

BIM AI is a browser-first BIM authoring tool. Stack: React 19 + Vite + TypeScript, Tailwind, Zustand, Three.js. pnpm workspace; web package is `packages/web/`.

Revit's Visibility/Graphics dialog (keyboard shortcut `VV` or `VG`) lets users override per-category display settings per view: line weight, line color, line pattern, fill color, fill pattern, halftone toggle, cut vs projection independent overrides. This WP adds the dialog and wires the overrides into the plan canvas rendering.

---

## Existing hooks to use

| Path | Role |
|---|---|
| `packages/web/src/plan/planProjection.ts` | `resolvePlanCategoryGraphics(elementsById, planViewId)` — already resolves category line weight/pattern from view template; VV overrides sit on top |
| `packages/web/src/plan/planProjectionWire.ts` | `PlanCategoryGraphicHintRowWire` type — the shape of per-category hints |
| `packages/web/src/state/store.ts` | `plan_view` element parsing — add `categoryOverrides` field |
| `packages/web/src/workspace/AppShell.tsx` | Global keyboard handler location — add `VV`/`VG` shortcut |

The `plan_view` element already stores: `viewRangeBottomMm`, `viewRangeTopMm`, `cutPlaneOffsetMm`, `underlayLevelId`, `categoriesHidden`, `cropMinMm`, `cropMaxMm`. This WP adds `categoryOverrides`.

---

## 1 — Data model: `categoryOverrides` on `plan_view`

### Add to `store.ts` `plan_view` parsing:

```ts
export type CategoryOverride = {
  projection?: {
    lineWeightFactor?: number;   // e.g. 2 = double the default weight
    lineColor?: string | null;   // CSS hex or null (= use default)
    linePattern?: string | null; // pattern token or null
    fillColor?: string | null;
    halftone?: boolean;
  };
  cut?: {
    lineWeightFactor?: number;
    lineColor?: string | null;
    linePattern?: string | null;
    fillColor?: string | null;
    halftone?: boolean;
  };
  visible?: boolean;             // false = hidden in this view
};

export type CategoryOverrides = Record<string, CategoryOverride>;
```

In the `plan_view` branch of `parseElement`:
```ts
const coRaw = raw.categoryOverrides ?? raw.category_overrides;
const categoryOverrides: CategoryOverrides =
  coRaw && typeof coRaw === 'object' && !Array.isArray(coRaw)
    ? (coRaw as CategoryOverrides)
    : {};
```

Add `categoryOverrides` to the returned element object. Export `CategoryOverride` and `CategoryOverrides` types.

Add a Zustand action `setCategoryOverride(planViewId: string, categoryKey: string, override: CategoryOverride)` that patches `elementsById[planViewId].categoryOverrides[categoryKey]` and also calls `patchElement(planViewId, { categoryOverrides: ... })` to sync to the backend (look at how other `patchElement` calls are structured in store.ts).

---

## 2 — Apply overrides in `planProjection.ts`

`resolvePlanCategoryGraphics(elementsById, planViewId)` already returns per-category `lineWeightFactor` and `linePatternToken` by merging template + view-level hints. After this merge, apply `categoryOverrides` from the active plan view:

```ts
const pv = elementsById[planViewId];
const overrides: CategoryOverrides = pv?.kind === 'plan_view' ? (pv.categoryOverrides ?? {}) : {};

for (const [catKey, ovr] of Object.entries(overrides)) {
  if (!resolved[catKey]) continue;
  if (ovr.visible === false) {
    resolved[catKey].visible = false;
  }
  if (ovr.projection?.lineWeightFactor != null) {
    resolved[catKey].lineWeightFactor = ovr.projection.lineWeightFactor;
  }
  if (ovr.projection?.lineColor) {
    resolved[catKey].lineColor = ovr.projection.lineColor;
  }
  // etc.
}
```

Add `visible: boolean`, `lineColor: string | null` to the resolved category type so PlanCanvas can use it.

---

## 3 — VVDialog component

Create `packages/web/src/workspace/VVDialog.tsx`.

### Layout

A modal dialog (use a `<dialog>` element or a `div` with `role="dialog"` + `aria-modal="true"`, positioned as a centered overlay). Two tabs: **Model Categories** and **Annotation Categories**.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Visibility/Graphics Overrides — Level 1 Floor Plan            [X]  │
│  ┌───────────────────┐  ┌────────────────────────────────────────┐  │
│  │ Model Categories  │  │ Annotation Categories                  │  │
│  └───────────────────┘  └────────────────────────────────────────┘  │
│                                                                      │
│  Category         Projection              Cut                        │
│                   Lines  Pattern  Fill    Lines  Pattern  Fill       │
│  ─────────────────────────────────────────────────────────────────   │
│  Walls       [ ] ──┤╱├──  ─ ─    ░░      [ ] ──┤╱├──  ─ ─    ▒▒   │
│  Floors      [✓] ──┤╱├──  ─ ─    ░░      [✓] ──┤╱├──  ─ ─    ▒▒   │
│  Roofs       [✓] ...                                                 │
│  Doors       [✓] ...                                                 │
│  Windows     [✓] ...                                                 │
│  Rooms       [✓] ...                                                 │
│  Grids       [✓] ...    (Annotation tab)                             │
│  Levels      [✓] ...    (Annotation tab)                             │
│  ─────────────────────────────────────────────────────────────────   │
│                           [OK]   [Cancel]   [Apply]                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Category list

Model categories (tab 1): `['wall', 'floor', 'roof', 'door', 'window', 'stair', 'railing', 'room', 'column', 'beam', 'ceiling', 'site']`

Annotation categories (tab 2): `['grid_line', 'level_datum', 'dimension', 'room_tag', 'door_tag', 'window_tag', 'section_mark']`

Map each key to a display name via an inline lookup:
```ts
const CATEGORY_LABELS: Record<string, string> = {
  wall: 'Walls', floor: 'Floors', roof: 'Roofs', door: 'Doors',
  window: 'Windows', stair: 'Stairs', railing: 'Railings', room: 'Rooms',
  column: 'Columns', beam: 'Beams', ceiling: 'Ceilings', site: 'Site',
  grid_line: 'Grids', level_datum: 'Levels', dimension: 'Dimensions',
  room_tag: 'Room Tags', door_tag: 'Door Tags', window_tag: 'Window Tags',
  section_mark: 'Section Marks',
};
```

### Per-row controls

For each category row show:
1. **Visibility checkbox** — unchecked = category hidden in this view.
2. **Projection Lines** — a small color swatch (clickable, opens a 6-color popover: black, gray, blue, red, green, custom) + a line weight dropdown (By Category, 1–5).
3. **Projection Pattern** — a dropdown: Solid, Dashed, Dotted, Center.
4. **Cut Lines / Cut Pattern** — same controls but for cut overrides.

Keep it simple: no fill pattern swatch for now (future WP). Show all controls even if the category is annotation-only (they may not all apply in the renderer — that's fine).

### State

VVDialog is uncontrolled internally — it keeps a local `draft: CategoryOverrides` state copy. On **Apply** or **OK**, call `setCategoryOverride` (from store) for each changed category. On **Cancel**, discard. On **OK**, close the dialog.

Read the initial values from `elementsById[activePlanViewId].categoryOverrides`.

### Export

```ts
export function VVDialog(props: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null;
```

Add a companion test file `VVDialog.test.tsx` with at least:
- Dialog renders with 12+ model category rows.
- Unchecking a visibility checkbox sets `draft[cat].visible = false`.
- Clicking Apply calls `setCategoryOverride` once per changed category.

---

## 4 — Wire into AppShell

### Zustand state

Add to `store.ts`:
```ts
vvDialogOpen: boolean;
openVVDialog: () => void;
closeVVDialog: () => void;
```

### AppShell keyboard shortcut

In `packages/web/src/workspace/AppShell.tsx`, add a keydown listener. Revit uses `VV` or `VG` (two-key sequence). For now implement as single keystroke `V` when no input is focused, opening the dialog. Note: the existing modeController handles global hotkeys — check if there's a clean hook point there; if so, add `V` → `openVVDialog` there instead.

Render `<VVDialog open={vvDialogOpen} onClose={closeVVDialog} />` in AppShell.

---

## Constraints

- Do not change `resolvePlanCategoryGraphics`'s signature — only add override application at the end.
- Do not introduce color picker dependencies — use a simple swatch popover with 6 preset colors.
- Tokens only for colours (use `bg-surface`, `border-border`, etc.).
- `make verify` must pass.

---

## Commit format

```
feat(view): WP-V2-03a — Visibility/Graphics dialog + category overrides

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
