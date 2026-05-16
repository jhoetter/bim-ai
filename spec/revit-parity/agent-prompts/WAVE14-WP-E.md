# Wave 14 — WP-E: Color Fill Legend on Plan Canvas (§13.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/ColorSchemeDialog.tsx          — existing color scheme dialog
packages/web/src/plan/PlanViewHeader.tsx             — plan view header + color scheme wiring
packages/web/src/plan/roomSchemeColor.ts             — resolveRoomSchemeColor helper
packages/web/src/schedules/roomColorSchemeLegendReadout.ts — legend row computation
packages/web/src/plan/PlanCanvas.tsx                 — plan canvas overlay
packages/core/src/index.ts                           — plan_view element type (colorScheme field)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `roomColorSchemeLegendReadout.ts` — read what `buildRoomColorSchemeLegend` returns. Understand the `LegendRow` shape (colorHex, label, count or area).
- `ColorSchemeDialog.tsx` — read how the color scheme is stored (on `plan_view.colorScheme`). Understand the scheme data structure.
- `PlanViewHeader.tsx` — find where `onColorSchemeApply` is called. Find how the active plan_view's `colorScheme` is accessed.
- `PlanCanvas.tsx` — find where overlay elements are rendered (existing overlays like the hidden-elements badge). This is where you will render the legend panel.
- `roomSchemeColor.ts` — read `resolveRoomSchemeColor`. Understand how a room element + scheme → colorHex.

---

## Tasks

### A — `ColorSchemeLegend.tsx` component

Create `packages/web/src/plan/ColorSchemeLegend.tsx`:

```tsx
interface ColorSchemeLegendProps {
  rows: Array<{ colorHex: string; label: string; count?: number; areaSqm?: number }>;
  title: string;
  visible: boolean;
  onClose: () => void;
}

export function ColorSchemeLegend({ rows, title, visible, onClose }: ColorSchemeLegendProps) {
  if (!visible || rows.length === 0) return null;
  return (
    <div
      data-testid="color-scheme-legend"
      className="absolute bottom-12 right-2 z-10 rounded bg-surface/95 border border-border shadow-md p-2 min-w-[140px]"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" data-testid="color-scheme-legend-title">{title}</span>
        <button type="button" className="text-xs text-muted" onClick={onClose} data-testid="color-scheme-legend-close">✕</button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          <div
            className="w-3 h-3 rounded-sm shrink-0 border border-border/60"
            style={{ background: row.colorHex }}
            data-testid={`legend-swatch-${i}`}
          />
          <span className="text-xs truncate" data-testid={`legend-label-${i}`}>{row.label}</span>
          {row.count != null && (
            <span className="text-xs text-muted ml-auto" data-testid={`legend-count-${i}`}>{row.count}</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

### B — Toggle button in `PlanViewHeader.tsx`

In `PlanViewHeader.tsx`, add a **"Legend"** toggle button next to the color scheme button (wherever the color scheme UI is wired). This button shows/hides the legend panel.

- Button `data-testid="plan-view-legend-toggle"`.
- Only visible when the active plan_view has a `colorScheme` set.

Pass a `legendVisible` boolean state (local to `PlanViewHeader` or in Workspace state) and an `onLegendToggle` callback down.

### C — Wire `ColorSchemeLegend` into the plan view

In `PlanCanvas.tsx` (or in the plan view wrapper in `Workspace.tsx`), render the `ColorSchemeLegend` as an overlay:

1. Compute the legend rows by calling `buildRoomColorSchemeLegend(elementsById, activePlanView.colorScheme)` (from `roomColorSchemeLegendReadout.ts`).
2. Derive `title` from the scheme category (e.g. `"By Name"`, `"By Department"`, `"By Area"`).
3. Render `<ColorSchemeLegend rows={...} title={...} visible={legendVisible} onClose={() => setLegendVisible(false)} />`.

### D — Tests

`packages/web/src/plan/colorSchemeLegend.test.tsx`:
```ts
describe('color fill legend — §13.1.3', () => {
  it('renders legend rows with swatches and labels', () => { ... });
  it('does not render when visible=false', () => { ... });
  it('calls onClose when close button clicked', () => { ... });
  it('does not render when rows is empty', () => { ... });
  it('shows count badge when count is provided', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/E): color fill legend panel on plan canvas (§13.1.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
