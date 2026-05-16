# Wave 7 — WP-D: Sheet Viewport Scale Labels + Title Block Fields (§6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/workspace/sheets/SheetCanvas.tsx            — main sheet renderer
packages/web/src/workspace/sheets/sheetViewportAuthoring.tsx — SheetViewportMmDraft type (has scale: string)
packages/web/src/workspace/sheets/sheetTitleblockAuthoring.tsx — title block field editing
packages/web/src/workspace/sheets/SheetRevisionTableSvg.tsx  — revision table (reference pattern)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `SheetViewportMmDraft` in `sheetViewportAuthoring.tsx` — has `scale: string`, `label: string`, `xMm`, `yMm`, `widthMm`, `heightMm`, `viewRef`
- `SheetCanvas.tsx` already renders each viewport as a coloured rect on the sheet. Find the section that renders individual viewports — search for `vpDrafts.map` or similar.
- `sheetTitleblockAuthoring.tsx` already has `projectName`, `titleBlock` (symbol), and other managed keys — read the `MANAGED_TB_KEYS` array and `SheetTitleblockDraft` type before adding fields.
- `SheetRevisionTableSvg` pattern for SVG-based text on sheets.

---

## Tasks

### A — Viewport scale label

In `SheetCanvas.tsx`, where each `SheetViewportMmDraft` is rendered, add a scale label below the viewport rect:

- Render an SVG `<text>` element (or a positioned `<div>`) below the viewport rectangle:
  - Text: the `vp.scale` value (e.g. `"1:100"`) — or `"—"` if empty
  - Position: centered horizontally below the viewport, 6 mm below the bottom edge
  - Font size: 9 pt
  - `data-testid="sheet-viewport-scale-{vp.viewportId}"`

If `vp.label` is non-empty, also render the label text centered above the scale:
  - `data-testid="sheet-viewport-label-{vp.viewportId}"`

### B — Title block: checkedBy and issuedBy fields

In `sheetTitleblockAuthoring.tsx`, add `checkedBy` and `issuedBy` to the managed keys and `SheetTitleblockDraft` type:

```ts
export type SheetTitleblockDraft = {
  // ... existing fields ...
  checkedBy?: string;
  issuedBy?: string;
};
```

Add them to `MANAGED_TB_KEYS`. Wire their display in the title block SVG/HTML template — add two rows in the title block rendering area:
- "Checked by: {checkedBy}" — `data-testid="sheet-tb-checked-by"`
- "Issued by: {issuedBy}" — `data-testid="sheet-tb-issued-by"`

Also resolve these from `project_settings` when not overridden on the sheet: map `project_settings.authorName` → `checkedBy` fallback, `project_settings.clientName` → `issuedBy` fallback (read the existing resolution pattern in `sheetTitleblockAuthoring.tsx`).

### C — Scale input in SheetViewportEditor

In `sheetViewportAuthoring.tsx`, in the `SheetViewportEditor` component (read it first), add a scale input field:
- `data-testid="sheet-viewport-scale-input-{viewportId}"` — text input, value = `vp.scale ?? ''`
- On change: call the existing `onPatchDraft({ scale: value })` or equivalent patch function
- Placeholder: `"1:100"`

### D — Tests

Write `packages/web/src/workspace/sheets/sheetViewportScale.test.tsx`:
```ts
describe('sheet viewport scale label — §6.2', () => {
  it('renders sheet-viewport-scale-{id} for each viewport', () => { ... });
  it('displays vp.scale text in the label', () => { ... });
  it('shows "—" when scale is empty string', () => { ... });
  it('renders sheet-viewport-label-{id} when vp.label is non-empty', () => { ... });
});
```

Write `packages/web/src/workspace/sheets/sheetTitleblockFields.test.tsx`:
```ts
describe('title block checkedBy + issuedBy — §6.2', () => {
  it('renders sheet-tb-checked-by element', () => { ... });
  it('renders sheet-tb-issued-by element', () => { ... });
  it('falls back to project_settings.authorName for checkedBy', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
