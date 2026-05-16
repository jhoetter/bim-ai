# Wave 3 — WP-B: Locked 3D View → Sheet Viewport Placement (§6.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                   — Element union + ElemKind
packages/web/src/workspace/WorkspaceLeftRail.tsx             — production left-rail (SavedViews listed here)
packages/web/src/workspace/sheets/SheetCanvas.tsx            — sheet paper-space renderer
packages/web/src/workspace/sheets/sheetTitleblockAuthoring.tsx — titleblock + SheetRevisionTableSvg
packages/web/src/workspace/sheets/sheetViewRef.ts            — resolveViewportTitleFromRef helper
packages/web/src/state/store.ts                              — Zustand store root
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

- `SavedViewElem` in `core/index.ts` with `isLocked?: boolean` flag
- Lock/Unlock Camera context-menu button in `WorkspaceLeftRail.tsx` (right-click on saved_view row)
  — dispatches `{ type: 'update_saved_view', id, isLocked: !sv.isLocked }`
- `SavedViewElem.isLocked` on `UpdateSavedViewCmd` (server command)
- `SheetCanvas.tsx`: renders sheets; reads `sh.viewportsMm` (Array) and renders viewport frames
  (line ~211: `const vps = (sh.viewportsMm ?? []) as Array<Record<string, unknown>>`)
- `resolveViewportTitleFromRef` in `sheetViewRef.ts` — resolves view title from a ref string
- `SheetRevisionTableSvg` component imported and rendered in SheetCanvas.tsx

---

## Tasks

### A — Extend the viewport record type in core/index.ts

In `core/index.ts`, find the `sheet` element type and its `viewportsMm` field. Define or extend
the viewport record shape to include:
```ts
viewportsMm?: Array<{
  viewRef: string;         // e.g. 'saved_view:<id>'  or existing format
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  title?: string;
}>;
```

If `viewportsMm` already has a typed array element shape, extend it — don't replace. If it's
typed as `unknown[]` or `Record<string, unknown>[]`, give it a proper named type `SheetViewportRef`
and export it.

Also add an `update_sheet` command type (if one doesn't exist) or extend the existing one to
allow patching `viewportsMm`:
```ts
type UpdateSheetCmd = { type: 'update_sheet'; id: string; viewportsMm: SheetViewportRef[] };
```

---

### B — "Place on Sheet" action in WorkspaceLeftRail

In `WorkspaceLeftRail.tsx`, inside the saved_view context menu (where Lock Camera / Unlock Camera
already appears), add a **"Place on Sheet…"** menu item (data-testid: `"primary-nav-ctx-place-on-sheet"`).

When clicked:
1. Open a simple sheet-picker modal (inline `<dialog>` or a small floating panel — keep it minimal).
   The picker lists all `sheet` elements from `elementsById` by their `title` or `name`.
2. The user clicks a sheet name to confirm.
3. Dispatch `{ type: 'update_sheet', id: <sheetId>, viewportsMm: [...existing, newViewport] }`
   where `newViewport` is:
   ```ts
   {
     viewRef: `saved_view:${sv.id}`,
     xMm: 20,        // default position — 20 mm from left edge
     yMm: 20,        // 20 mm from top edge
     widthMm: 200,   // default 200 × 150 mm frame
     heightMm: 150,
     title: sv.name ?? 'Camera View',
   }
   ```
4. Close the context menu and the picker.

If `onSemanticCommand` is not available (the prop is optional), disable the menu item gracefully.

---

### C — Render placed saved_view viewports in SheetCanvas

In `SheetCanvas.tsx`, in the section that iterates `sh.viewportsMm`:
- For entries where `vp.viewRef` starts with `'saved_view:'`, render a viewport frame SVG rect
  (dashed border, grey fill at 10 % opacity) at the specified position + size.
- Inside the frame, render a viewport title bar at the bottom edge:
  ```
  [view title] — Scale: 1:100
  ```
  Use the same title font/size as existing viewport title rendering (study how plan viewport titles
  are drawn elsewhere in SheetCanvas).
- If the source `SavedViewElem` has `isLocked: true`, render a small lock icon (🔒 or a simple
  padlock SVG path — 12 × 12 px) in the top-right corner of the frame.

The actual 3D thumbnail is out of scope — a grey fill placeholder is correct.

---

### D — Command handler (Python side — skip if no Python in scope)

If the repo has a Python command dispatch layer (`engine_dispatch_*.py`), add a minimal handler
for `update_sheet` that patches `viewportsMm` on the sheet element. Otherwise, handle it on the
client side in the Zustand `applyCommand` reducer — patch the sheet element in `elementsById`.

Study how `update_saved_view` is handled to follow the same pattern.

---

## Tests

Add to `packages/web/src/workspace/sheets/SheetCanvas.test.tsx`:
1. When `viewportsMm` contains a `saved_view:` entry, the canvas renders a viewport rect with
   the correct data-testid (use `data-testid="sheet-canvas-saved-view-viewport"`)
2. Locked saved_view shows lock indicator inside the frame
3. No crash when `viewportsMm` is empty or missing

Add to `packages/web/src/workspace/project/ProjectBrowser.test.tsx` (or WorkspaceLeftRail test):
4. "Place on Sheet…" menu item appears in context menu for a saved_view row
5. Clicking a sheet in the picker dispatches `update_sheet` with a `viewRef` starting with
   `'saved_view:'`

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §6.1.3 status block — append after the existing description:
```
"Place on Sheet…" context-menu action added to saved_view rows in WorkspaceLeftRail. Dispatches
`update_sheet` with a `SheetViewportRef` entry (`viewRef: 'saved_view:<id>'`). SheetCanvas renders
a dashed placeholder frame with view title and lock indicator. 5 tests.
```

Change status from `Partial` to `Done — P1`.

Remove this line from the P1 gap list (~line 1146):
```
- **Named locked 3D view sheet placement** (Ch. 6.1.3) — ...
```

Update the summary table row for Chapter 6 to reflect §6.1.3 is now Done.
