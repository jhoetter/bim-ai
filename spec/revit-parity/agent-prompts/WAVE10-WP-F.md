# Wave 10 — WP-F: Paint Tool — Face Material Override (§3.3.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — element types (wall, floor, roof, etc.)
packages/web/src/tools/toolRegistry.ts                   — ToolId union + registry
packages/web/src/tools/authoringCommandContract.ts       — AUTHORING_COMMAND_CONTRACTS
packages/web/src/cmdPalette/defaultCommands.ts           — palette entries
packages/web/src/plan/PlanCanvas.tsx                     — canvas mouse handlers
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/state/store.ts                          — active tool state
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `toolRegistry.ts` — find the full `ToolId` union and registry object. Read the pattern: each tool needs an entry in the union AND in the registry object (hotkey, mode, category, surfaces). The `'split-wall'` entry is a good template for a single-click modify tool.
- `authoringCommandContract.ts` — every ToolId needs an entry here (`kind: 'sketch' | 'place'`, `completionBehavior`). Read 2–3 existing entries to understand the shape.
- `defaultCommands.ts` — every tool needs a palette entry. Find `tool.split-wall` or similar single-click modify tools and use the same pattern.
- `core/index.ts` — find `wall`, `floor`, `roof`, `ceiling` element types. Look for any existing `faceMaterialOverrides` or `materialOverride` field. Also read how `WallType` layers reference materials — the paint tool writes to the _element instance_ level, not the type.
- `InspectorContent.tsx` — read an element section (e.g. wall) to understand the dispatch/update_element_property pattern.

---

## Tasks

### A — Core type: face material overrides

In `core/index.ts`, add a `faceMaterialOverrides` field to the elements that support face painting. For each paintable element kind (`wall`, `floor`, `roof`, `ceiling`):

```ts
/** Per-face material overrides assigned by the Paint tool. Key = face identifier string. */
faceMaterialOverrides?: Record<string, string> | null; // faceId → materialId
```

Also add the command type:

```ts
export type PaintFaceCmd = {
  type: 'paint_face';
  elementId: string;
  faceId: string; // e.g. 'front' | 'back' | 'top' | 'bottom' | 'left-{i}' etc.
  materialId: string | null; // null = remove override (restore to type default)
};
```

Export `PaintFaceCmd` from the index.

### B — Tool registration (4-place rule)

**Place 1 — `toolRegistry.ts`**: Add `'paint'` to the `ToolId` union AND to the registry object:

```ts
paint: {
  hotkey: 'PT',
  label: 'Paint',
  mode: 'plan',      // paint works in plan view; extend to 3D later
  category: 'modify',
  surfaces: ['ribbon', 'cmd-k'],
},
```

**Place 2 — `authoringCommandContract.ts`**: Add:

```ts
paint: {
  kind: 'sketch',
  completionBehavior: 'explicit-finish',
},
```

**Place 3 — `defaultCommands.ts`**: Add:

```ts
registerCommand({
  id: 'tool.paint',
  label: 'Paint',
  keywords: ['paint', 'face', 'material override', 'color face'],
  category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'paint'),
});
```

**Place 4 — `toolGrammar.ts`** (if the file has a grammar switch/map): add a `PaintState` with:

- `status: 'idle' | 'active'`
- `hoveredFaceId: string | null`
- `hoveredElementId: string | null`

`reducePaint(state, event)`:

- `'activate'` → `{ status: 'active', hoveredFaceId: null, hoveredElementId: null }`
- `'hover'` with `faceId` + `elementId` → update hovered fields
- `'click'` with `faceId` + `elementId` + `materialId` → emit `PaintFaceCmd`; stay active
- `'cancel'` → `{ status: 'idle', ... }`

### C — Workspace handler

In `Workspace.tsx` (or wherever `split_wall`, `update_toposolid` commands are handled), add a handler for `paint_face`:

```ts
case 'paint_face': {
  const { elementId, faceId, materialId } = cmd as PaintFaceCmd;
  updateElement(elementId, (el) => {
    const overrides = { ...(el.faceMaterialOverrides ?? {}) };
    if (materialId === null) {
      delete overrides[faceId];
    } else {
      overrides[faceId] = materialId;
    }
    return { ...el, faceMaterialOverrides: Object.keys(overrides).length > 0 ? overrides : null };
  });
  break;
}
```

Read the existing command dispatch pattern in Workspace.tsx before writing — use the same helper/pattern.

### D — Active material state

In `store.ts`, add:

```ts
activePaintMaterialId: string | null;
setActivePaintMaterialId: (id: string | null) => void;
```

Default: `null` (paint tool will pick the first available material if unset).

### E — OptionsBar section for paint tool

In `OptionsBar.tsx`, add a section for `planTool === 'paint'`:

- **Material** (`data-testid="options-bar-paint-material"`): `<select>` listing all `material` elements sorted by name + "— None —". On change: `setActivePaintMaterialId(value)`. Default = first material.
- **Remove Override** button (`data-testid="options-bar-paint-remove"`): clicking sets `activePaintMaterialId = null` (signals that the next face-click removes the override).

Read the existing wall options-bar section in `OptionsBar.tsx` before adding — use the same prop/store access pattern.

### F — Inspector: show face overrides

In `InspectorContent.tsx`, for each paintable element kind (`wall`, `floor`, `roof`, `ceiling`), add a read-only section:

```
Face Material Overrides
  front  → [material name]  [× remove]
  back   → [material name]  [× remove]
```

- `data-testid="inspector-face-overrides"` on the section
- Each row: `data-testid="face-override-{faceId}"`, remove button `data-testid="face-override-remove-{faceId}"`
- Remove dispatches `paint_face` with `materialId: null`
- If `faceMaterialOverrides` is empty/null: show nothing (no empty section header)

### G — Tests

Write `packages/web/src/tools/paintTool.test.ts`:

```ts
describe('paint tool grammar — §3.3.4', () => {
  it('activate transitions to active status', () => { ... });
  it('hover updates hoveredFaceId and hoveredElementId', () => { ... });
  it('click emits PaintFaceCmd with correct elementId/faceId/materialId', () => { ... });
  it('stays active after click (does not auto-finish)', () => { ... });
  it('cancel transitions to idle', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/paintFaceInspector.test.tsx`:

```ts
describe('face material overrides inspector — §3.3.4', () => {
  it('renders inspector-face-overrides section when overrides exist', () => { ... });
  it('renders nothing when faceMaterialOverrides is null', () => { ... });
  it('remove button dispatches paint_face with materialId null', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave10/F): paint tool — face material override (§3.3.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
