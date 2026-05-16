# Wave 2 — WP-D: Sheet Revision Title Block + Locked 3D View + Walkthrough

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                    — Element union + ElemKind
packages/web/src/workspace/sheets/SheetCanvas.tsx             — sheet rendering component
packages/web/src/workspace/sheets/sheetTitleblockAuthoring.tsx — title block tokens + rendering
packages/web/src/workspace/project/ManageRevisionsDialog.tsx  — revision CRUD dialog (done)
packages/web/src/workspace/project/Save3dViewAsDialog.tsx     — save 3D view dialog (done)
packages/web/src/workspace/project/ProjectBrowser.tsx         — project browser tree
packages/web/src/viewport/ViewportCanvas.tsx                  — 3D viewport (or similar)
packages/web/src/tools/toolRegistry.ts                        — ToolId union + TOOL_REGISTRY
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `revision` element type in `@bim-ai/core`: `{ kind: 'revision', id, sequence, description, date }`
- `sheet_revision` element type: `{ kind: 'sheet_revision', id, sheetId, revisionId }`
- `ManageRevisionsDialog.tsx` — full CRUD for revisions + per-sheet assignment via checkboxes
- Commands: `create_revision`, `delete_revision`, `add_sheet_revision`, `remove_sheet_revision`
- `Save3dViewAsDialog.tsx` saves named `saved_view` elements with camera + clip state (D5)
- `saved_view` rows appear in ProjectBrowser
- `sheetTitleblockAuthoring.tsx` renders project info tokens (`{{projectName}}`, etc.)

---

## Tasks

### D1 — Sheet revision table in title block

Read `sheetTitleblockAuthoring.tsx` end-to-end. Understand how project_settings tokens
are resolved and rendered in the title block SVG/canvas.

Add a revision table section to the title block:
- Positioned in the bottom-right corner of the title block (standard Revit convention)
- Query all `sheet_revision` elements for the current sheet ID; join to `revision` elements
  to get description, sequence letter (A, B, C…), and date
- Render a table: columns "Rev", "Description", "Date" — one row per revision
- When no revisions are assigned to the sheet, show a single placeholder row with "—"
- The table should auto-grow upward as revisions are added

Also add a `{{revisionTable}}` token resolution so the title block template can include
the revision table at a configurable position.

Tests:
- sheetTitleblockAuthoring renders a revision row for each sheet_revision assigned to the sheet
- No sheet_revisions → renders placeholder "—" row
- Revisions are sorted by sequence number ascending

Update tracker §6.3: "Done — revision table rendered in title block"

---

### D2 — Named locked 3D view: lock toggle + sheet placement

**D2a. Lock toggle**: Add `isLocked?: boolean` to the `saved_view` element type in
`core/index.ts`. In the 3D viewport:
- When the active view is a `saved_view` with `isLocked: true`, disable all camera
  manipulation (pan, orbit, zoom, scroll) — still allow selection
- Show a padlock icon in the viewport header next to the view name
- In ProjectBrowser, `saved_view` rows get a right-click "Lock/Unlock" context menu item
  dispatching `{ type: 'updateElement', id, patch: { isLocked: !current } }`

**D2b. Viewport placement on sheet**: In `SheetCanvas.tsx`, allow dragging a `saved_view`
from the ProjectBrowser onto the sheet canvas:
- On drop, create a `sheet_viewport` element:
  `{ kind: 'sheet_viewport', id, sheetId, viewId, xMm, yMm, widthMm, heightMm, scaleDenom }`
  Add this type to core/index.ts if it doesn't exist.
- Render a placeholder rectangle labelled with the view name at the dropped position
- Inspector for selected sheet_viewport: scale denominator input (e.g. 100 for 1:100)

Tests:
- isLocked=true on a saved_view disables camera controls
- Creating a sheet_viewport with the correct fields works

Update tracker §6.1.3: "Partial — lock toggle done; sheet viewport placement done"

---

### D3 — Walkthrough path animation (Ch. 14.6) — highest priority in this WP

**D3a. Element type**: Add to `core/index.ts`:
```ts
export type WalkthroughKeyframe = {
  positionMm: { x: number; y: number; z: number };
  targetMm: { x: number; y: number; z: number };
  fovDeg: number;
  timeSec: number;
};
export interface CameraPathElem extends BaseElem {
  kind: 'camera_path';
  name: string;
  keyframes: WalkthroughKeyframe[];
}
```
Add `'camera_path'` to the ElemKind union.

**D3b. Tool**: Add `'walkthrough'` ToolId to toolRegistry.ts (hotkey WT, 3D mode).
Grammar: each click in the 3D viewport captures the current camera position + target as
a keyframe. Double-click or Enter finalises.
Dispatch `{ type: 'createCameraPath', name, keyframes }`.

**D3c. Playback controls**: Add a "Walkthrough" panel (or extend the 3D toolbar) with:
- "Play/Pause" button — animates camera through keyframes via `requestAnimationFrame`
  using linear interpolation of position + target between keyframes based on `timeSec`
- "Speed" dropdown (0.5×, 1×, 2×)
- "Reset" resets to the first keyframe
- Loop toggle

Apply camera interpolation directly to the Three.js camera object. No video export needed.

**D3d. ProjectBrowser**: List `camera_path` elements under a "Walkthroughs" tree node.
Double-clicking one activates it for playback.

Tests:
- Linear interpolation between 2 keyframes at t=0.5 gives correct midpoint position
- Grammar: 2 clicks + Enter emits createCameraPath with 2 keyframes

Update tracker §14.6: "Implemented — camera path element + playback controls done"

---

## Rules

- `git pull --rebase origin main` before editing `core/index.ts` or `toolRegistry.ts`
  (WP-E and WP-F also touch these files — rebase is critical)
- Commit + push after each completed task (D1, D2, D3 separately)
- DO NOT touch toolGrammar.ts (attach/array grammars), curtain wall, group renderers
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
