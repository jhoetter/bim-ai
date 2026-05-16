# Wave 2 — WP-A: Annotation Completion (Interior Elevation Inspector + EQ Dims)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — Element union + ElemKind
packages/web/src/plan/PlanCanvas.tsx                — main plan interaction handler
packages/web/src/plan/gripProtocol.ts               — grip interaction protocol
packages/web/src/plan/GripLayer.tsx                 — grip rendering
packages/web/src/plan/planElementMeshBuilders.ts    — dispatches plan symbols per element
packages/web/src/plan/symbology.ts                  — plan symbol primitives
packages/web/src/tools/toolRegistry.ts              — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts               — per-tool grammar state machines
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `interior_elevation_marker` element type in `@bim-ai/core` with fields:
  `positionMm`, `levelId`, `radiusMm`, `elevationViewIds` (N/S/E/W)
- `'interior-elevation'` tool (hotkey `IE`) in toolRegistry.ts, wired in PlanCanvas.tsx
- Plan symbol: 4-quadrant circle with inward arrows in `symbology.ts` (D2)
- A1–A12 grammar shells complete in `toolGrammar.ts`
- `permanent_dimension` element type in `core/index.ts` with `witnessPoints`, `valueMm`

---

## Tasks

### A — Interior elevation marker inspector + drag grip

**A1. Inspector panel**: When an `interior_elevation_marker` element is selected, the
Inspector panel should render:
- `radiusMm` — number input (mm), dispatches `{ type: 'updateElement', id, patch: { radiusMm } }`
- `levelId` — dropdown from project levels (study how other element inspectors do this)

Study how `text_note` or `spot_elevation` inspector panels are structured (search the
Inspector component for existing annotation inspectors added in wave 1).

**A2. Drag grip**: In `gripProtocol.ts` (or the grip registration pattern used by wave-1
A1/A2 grips), register a grip for `interior_elevation_marker` that:
- Shows a centre-point drag handle at `positionMm` in plan
- On drag-end dispatches `{ type: 'moveElement', id, positionMm: newPos }`
  (or whatever the canonical move command is — study `moveTool.ts`)

Tests:
- Inspector renders radiusMm input for interior_elevation_marker
- Grip provider returns a centre handle at the correct position
- Dragging the grip emits the correct move command

Update tracker §6.1.5: interior elevation markers now have inspector + grip → "Partial — D2
(inspector+grip done; full elevation-view rendering is separate)"

---

### B — EQ condition on aligned dimensions (Ch. 4.2.2, P2)

**B1. Data model**: Add `eqEnabled?: boolean` to the `permanent_dimension` element type
in `core/index.ts`.

**B2. Plan rendering**: In the plan dimension renderer (find where `permanent_dimension`
elements are drawn — search `planElementMeshBuilders.ts` or `planProjection.ts`):
- When a selected `permanent_dimension` has ≥3 witness lines, render a small "EQ"
  button/label above the midpoint of the full dimension span
- When `eqEnabled: true`, display "EQ" instead of individual segment values, and
  distribute witness spacings equally (recompute positions for visual display only —
  do not move actual geometry)

**B3. Interaction**: Clicking the "EQ" label toggles `eqEnabled` via
`{ type: 'updateElement', id, patch: { eqEnabled: !current } }`.

Tests:
- EQ label appears on a permanent_dimension with 3 segments, not 2
- When eqEnabled=true, rendered text shows "EQ" not individual values

Update tracker §4.2.2: "Partial — EQ toggle and visual display implemented"

---

## Rules

- `git pull --rebase origin main` before starting
- Commit + push after each completed task
- DO NOT touch toolRegistry.ts, IFC/DXF export, curtain wall, group renderer
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
