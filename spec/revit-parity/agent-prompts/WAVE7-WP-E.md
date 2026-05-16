# Wave 7 — WP-E: Dimension Style Editor Dialog (§4.2.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — project_settings element type
packages/web/src/plan/draftingStandards.ts               — LINE_WEIGHT_PX_AT_1_50, color tokens (read-only reference)
packages/web/src/plan/planElementMeshBuilders.ts        — permanentDimensionThree() hardcodes text size + witness gap
packages/web/src/workspace/Workspace.tsx                 — command dispatch, manage-tab modal state
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/cmdPalette/defaultCommands.ts           — palette command registration
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `project_settings` element type in `core/index.ts` — read its shape. It has `globalParams?`, `lengthUnit?`, etc. The `dimensionStyle?` field does NOT yet exist — you will add it.
- `permanentDimensionThree()` in `planElementMeshBuilders.ts` — find where it hardcodes text size and witness line extension. Read these values to know what's configurable.
- `ManageGlobalParamsDialog.tsx` — use it as a reference for the pattern of manage-tab dialogs (state boolean + open/close in Workspace.tsx).

---

## Tasks

### A — DimensionStyle data model

Add to `project_settings` element type in `core/index.ts`:
```ts
dimensionStyle?: {
  textHeightMm?: number;        // default: 2.5
  witnessLineExtensionMm?: number;  // default: 2
  witnessLineGapMm?: number;    // default: 1
  arrowStyle?: 'arrow' | 'dot' | 'tick' | 'none';  // default: 'arrow'
  showUnit?: boolean;           // default: false (show e.g. "mm" suffix)
} | null;
```

### B — DimensionStyleDialog component

Create `packages/web/src/workspace/DimensionStyleDialog.tsx`:

```tsx
interface DimensionStyleDialogProps {
  open: boolean;
  onClose: () => void;
  currentStyle: NonNullable<Extract<Element, {kind:'project_settings'}>['dimensionStyle']>;
  onSave: (style: NonNullable<Extract<Element, {kind:'project_settings'}>['dimensionStyle']>) => void;
}
export function DimensionStyleDialog({ open, onClose, currentStyle, onSave }: DimensionStyleDialogProps): JSX.Element
```

The dialog:
- `data-testid="dimension-style-dialog"` on container; returns `null` when `open === false`
- Text height input (mm) `data-testid="dim-style-text-height"` — number, step 0.5, range 1–10
- Witness line extension (mm) `data-testid="dim-style-witness-extension"` — number, step 0.5
- Witness line gap (mm) `data-testid="dim-style-witness-gap"` — number, step 0.5
- Arrow style select `data-testid="dim-style-arrow-style"` — arrow / dot / tick / none
- Show unit checkbox `data-testid="dim-style-show-unit"`
- "Save" button `data-testid="dim-style-save"` → calls `onSave(draft)` + `onClose()`
- "Cancel" button `data-testid="dim-style-cancel"` → `onClose()`

Wire into `Workspace.tsx`:
- Add `dimStyleOpen` state
- When `dimStyleOpen`: resolve `project_settings` from `elementsById` (find element with `kind === 'project_settings'`)
- `onSave`: dispatch `update_element_property` on the project_settings element for key `dimensionStyle`
- Add to Manage tab ribbon or Annotate tab: "Dimension Style…" button (`data-testid="ribbon-dimension-style"`)

### C — Apply style in permanentDimensionThree

In `planElementMeshBuilders.ts`, `permanentDimensionThree()` (or wherever permanent dims are rendered), accept an optional `dimStyle` parameter and use it:
- Text height: `dimStyle?.textHeightMm ?? 2.5` mm (convert to world units: / 1000)
- Witness extension: `dimStyle?.witnessLineExtensionMm ?? 2` mm
- Arrow style: `dimStyle?.arrowStyle ?? 'arrow'`
- Show unit: when `dimStyle?.showUnit` append `" mm"` to segment labels

Pass `dimStyle` from `symbology.ts` → resolve from `project_settings` element in `elementsById`.

### D — Palette command

In `defaultCommands.ts`:
```ts
registerCommand({
  id: 'annotate.dimension-style',
  label: 'Dimension Style…',
  keywords: ['dimension', 'style', 'text', 'arrow', 'witness'],
  category: 'command',
  invoke: (ctx) => ctx.openDimensionStyle?.(),
});
```

Add `openDimensionStyle?: () => void` to `PaletteContext` in `registry.ts`.
Add `annotate.dimension-style` to `commandCapabilities.ts` with `surfaces: ['cmd-k', 'ribbon']`, `executionSurface: 'ribbon'`.

### E — Tests

Write `packages/web/src/workspace/DimensionStyleDialog.test.tsx`:
```ts
describe('DimensionStyleDialog — §4.2.4', () => {
  it('renders dimension-style-dialog when open=true', () => { ... });
  it('does not render when open=false', () => { ... });
  it('text height input shows current textHeightMm', () => { ... });
  it('arrow style select has arrow/dot/tick/none options', () => { ... });
  it('save button calls onSave with updated style', () => { ... });
  it('cancel button calls onClose without saving', () => { ... });
});
```

Write `packages/web/src/plan/dimensionStyleRender.test.ts`:
```ts
describe('permanentDimensionThree with dimStyle — §4.2.4', () => {
  it('uses default textHeightMm=2.5 when no style set', () => { ... });
  it('uses custom textHeightMm from dimStyle', () => { ... });
  it('showUnit=true appends " mm" to segment label', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
