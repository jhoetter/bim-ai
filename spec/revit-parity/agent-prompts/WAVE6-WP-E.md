# Wave 6 — WP-E: View Range Dialog + Room Tag Detail (§2.1.5 + §13.1.2 + §13.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — plan_view type (viewRangeTopMm, viewRangeBottomMm, cutPlaneOffsetMm, viewDepth)
packages/web/src/plan/planProjection.ts                  — VIEW_RANGE_DEFAULTS, resolvePlanViewDisplay
packages/web/src/workspace/inspector/InspectorContent.tsx — plan_view inspector (already has basic number inputs at lines ~3122-3140)
packages/web/src/workspace/Workspace.tsx                 — modal state management
packages/web/src/plan/planElementMeshBuilders.ts        — roomMesh — userData.roomLabel has cx, cz, name, areaMm2
packages/web/src/plan/symbology.ts                       — room rendering loop (search for 'room' label)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `plan_view` in `core/index.ts` already has `viewRangeTopMm?`, `viewRangeBottomMm?`, `cutPlaneOffsetMm?`, `viewDepth?`
- `InspectorContent.tsx` already shows these as basic number inputs for plan_view (~lines 3122–3140) — keep them, the dialog is an ADDITIONAL way to set them
- `roomMesh()` in `planElementMeshBuilders.ts` already computes `userData.roomLabel = { cx, cz, name, areaMm2 }` — the label text is already available
- `VIEW_RANGE_DEFAULTS` in `planProjection.ts` has `viewRangeTopMm: 3000`, `viewRangeBottomMm: 0`, `cutPlaneOffsetMm: 1200`

---

## Tasks

### A — ViewRangeDialog component (§2.1.5)

Create `packages/web/src/workspace/ViewRangeDialog.tsx`:

```tsx
interface ViewRangeDialogProps {
  open: boolean;
  onClose: () => void;
  view: Extract<Element, { kind: 'plan_view' }>;
  onPropertyChange: (key: string, value: number) => void;
}
export function ViewRangeDialog({ open, onClose, view, onPropertyChange }: ViewRangeDialogProps): JSX.Element
```

The dialog:
- `data-testid="view-range-dialog"` on container
- Four labeled number inputs (all in mm):
  - **Top** (`data-testid="vr-top"`) — `viewRangeTopMm`, default 3000
  - **Cut Plane** (`data-testid="vr-cut"`) — `cutPlaneOffsetMm`, default 1200
  - **Bottom** (`data-testid="vr-bottom"`) — `viewRangeBottomMm`, default 0
  - **View Depth** (`data-testid="vr-depth"`) — `viewDepth`, default 0 (0 = same as bottom)
- On change for each: call `onPropertyChange(key, value)`
- "OK" button (`data-testid="vr-ok"`) → calls `onClose()`
- Validation: Top > Cut > Bottom (show a warning string `data-testid="vr-warning"` if violated, but don't block)

Wire into `Workspace.tsx`:
- Add `viewRangeDialogOpen` state and the active `plan_view` element
- Add a "View Range…" button to the plan view header controls (`data-testid="open-view-range-dialog"`)
  — add this to `PlanViewHeader.tsx` or wherever the plan view toolbar controls live
- `onPropertyChange` dispatches `update_element_property` for the active plan view id

### B — Room tag: number + area display (§13.1.2 + §13.1.4)

Add `numberLabel?: string | null` to the `room` element type in `core/index.ts`:
```ts
/** User-assigned room number (e.g. "101", "K1"). Displayed in plan tag alongside name. */
numberLabel?: string | null;
```

In `planElementMeshBuilders.ts` `roomMesh()`, update `userData.roomLabel`:
```ts
mesh.userData.roomLabel = {
  cx: ux(c.xMm),
  cz: uz(c.yMm),
  name: room.name,
  numberLabel: room.numberLabel ?? null,
  areaMm2: polygonAreaMm2(room.outlineMm),
};
```

In `symbology.ts` (the room label rendering loop — search for where `roomLabel` userData is read),
update the label sprite text to include number and area:
- Format: `"{numberLabel}\n{name}\n{area} m²"` — show numberLabel row only when non-null/non-empty
- Area formatted to 2 decimal places in m²: `(areaMm2 / 1e6).toFixed(2)`

In `InspectorContent.tsx` for `el.kind === 'room'`, add:
- `data-testid="inspector-room-number"` — text input for `numberLabel`; dispatch `update_element_property` for `numberLabel`
- `data-testid="inspector-room-gross-area"` — read-only display: `(polygonAreaMm2(el.outlineMm) / 1e6).toFixed(2) + ' m²'`

### C — Tests

Write `packages/web/src/workspace/ViewRangeDialog.test.tsx`:
```ts
describe('ViewRangeDialog — §2.1.5', () => {
  it('renders view-range-dialog when open=true', () => { ... });
  it('does not render when open=false', () => { ... });
  it('vr-top input shows viewRangeTopMm value', () => { ... });
  it('changing vr-cut calls onPropertyChange with cutPlaneOffsetMm', () => { ... });
  it('shows vr-warning when top <= cut', () => { ... });
});
```

Write `packages/web/src/plan/roomTagDetail.test.ts`:
```ts
describe('room tag detail — §13.1.2 + §13.1.4', () => {
  it('roomMesh sets userData.roomLabel.areaMm2', () => { ... });
  it('roomMesh sets userData.roomLabel.numberLabel from room.numberLabel', () => { ... });
  it('roomMesh sets numberLabel=null when room.numberLabel is absent', () => { ... });
  it('area in m² = areaMm2 / 1e6', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
