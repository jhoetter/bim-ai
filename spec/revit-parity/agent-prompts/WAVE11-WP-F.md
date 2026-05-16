# Wave 11 — WP-F: Text Annotation Rich-Text Formatting (§4.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — text_note, leader_text element types
packages/web/src/plan/planElementMeshBuilders.ts         — text_note + leader_text renderers
packages/web/src/workspace/inspector/InspectorContent.tsx — text inspector panel
packages/web/src/tools/toolGrammar.ts                    — text tool grammar
packages/web/src/plan/grip-providers/                    — grip providers
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `text_note` element in `core/index.ts` — find all fields: `content`, `positionMm`, `fontSizeMm`, `rotationDeg`, and any bold/italic/underline fields. Read the full type.
- `leader_text` element in `core/index.ts` — similar fields; also `arrowStyle`.
- `planElementMeshBuilders.ts` — find `textNoteThree()` / the text_note renderer. Understand how `content` is turned into a `THREE.Sprite` or `CSS2DObject`. This determines what rich-text mechanism is feasible (sprites can't do bold; CSS objects can).
- `InspectorContent.tsx` — find the `text_note` inspector section. Read the existing `content` textarea and `fontSizeMm` input.

---

## Tasks

### A — Core type: rich-text fields

In `core/index.ts`, add to `text_note` and `leader_text` (only add missing fields):

```ts
bold?: boolean | null;
italic?: boolean | null;
underline?: boolean | null;
fontFamily?: string | null;     // e.g. 'Arial', 'Courier New' — null = default
colorHex?: string | null;       // e.g. '#1a1a1a' — null = default (foreground)
horizontalAlign?: 'left' | 'center' | 'right' | null;
```

### B — Inspector: formatting toolbar

In `InspectorContent.tsx`, in the `text_note` (and `leader_text`) inspector section, add a formatting toolbar **above** the content textarea:

```
[B] [I] [U]    [Left] [Center] [Right]    [Font size: ___]    [Color: ___]
```

- **Bold** button (`data-testid="inspector-text-bold"`): toggles `bold`. Visually active when `el.bold`.
- **Italic** button (`data-testid="inspector-text-italic"`): toggles `italic`.
- **Underline** button (`data-testid="inspector-text-underline"`): toggles `underline`.
- **Align** radio-like buttons (`data-testid="inspector-text-align-left/center/right"`): sets `horizontalAlign`.
- **Font size** input (`data-testid="inspector-text-font-size"`): already exists as `fontSizeMm` — verify it is there.
- **Color** picker (`data-testid="inspector-text-color"`): `<input type="color">` setting `colorHex`.

Each toggle/change dispatches `update_element_property` for the relevant field.

Apply the same toolbar to `leader_text` elements.

### C — Renderer: apply formatting

The text_note renderer in `planElementMeshBuilders.ts` currently produces a sprite or mesh from `content`. Update it to apply the new fields:

**Option A (CSS2DObject)**: if the renderer uses a `CSS2DObject` wrapping a DOM element, set `element.style.fontWeight`, `element.style.fontStyle`, `element.style.textDecoration`, `element.style.textAlign`, `element.style.color`.

**Option B (sprite / canvas texture)**: if it draws to a `<canvas>`, use `ctx.font = '${bold ? 'bold' : ''} ${italic ? 'italic' : ''} ${fontSizePx}px ${fontFamily}'`, set `ctx.fillStyle = colorHex ?? '#1a1a1a'`, and underline by drawing a line after the text.

Read which approach is used and apply the correct one. Do NOT switch rendering approach — extend what exists.

### D — Grip: text box rotation + resize

In the text note grip provider (find it in `grip-providers/` — likely `textNoteGripProvider.ts`), check if there is a **rotation handle** and a **resize handle**. If neither exists, add:

- **Rotation grip** (`id: 'text-rotate'`): positioned 500 mm above the text anchor. Dragging it sets `rotationDeg` relative to the anchor point. Cursor: `'crosshair'`.
- **Resize grip** (`id: 'text-resize'`): positioned at the bottom-right corner of the text bounding box. Dragging it updates `fontSizeMm` proportionally. Cursor: `'se-resize'`.

If either grip already exists, skip adding it and just write a test confirming it is there.

### E — Tests

Write `packages/web/src/workspace/inspector/textNoteInspector.test.tsx`:
```ts
describe('text note inspector formatting — §4.10', () => {
  it('renders inspector-text-bold button', () => { ... });
  it('renders inspector-text-italic button', () => { ... });
  it('renders inspector-text-underline button', () => { ... });
  it('bold button click dispatches update_element_property for bold:true', () => { ... });
  it('renders inspector-text-color input', () => { ... });
  it('renders inspector-text-align-center button', () => { ... });
});
```

Write `packages/web/src/plan/textNoteFormatting.test.ts`:
```ts
describe('text note rich-text fields — §4.10', () => {
  it('text_note type accepts bold field', () => { ... });
  it('text_note type accepts italic field', () => { ... });
  it('text_note type accepts colorHex field', () => { ... });
  it('text_note type accepts horizontalAlign field', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave11/F): text annotation rich-text formatting (§4.10)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
