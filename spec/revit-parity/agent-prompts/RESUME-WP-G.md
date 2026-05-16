# WP-G Resume — Structural Completion & Conceptual Massing

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained.

---

## Repo orientation (WP-G relevant paths)

```
packages/web/src/tools/toolRegistry.ts               — ToolId union + TOOL_REGISTRY
packages/web/src/viewport/meshBuilders.ts             — 3D mesh dispatcher
packages/web/src/viewport/meshBuilders.brace.ts       — brace 3D mesh (done)
packages/web/src/viewport/meshBuilders.brace.test.ts  — brace tests (done)
packages/web/src/viewport/meshBuilders.beamSystem.ts  — beam system 3D mesh (exists!)
packages/web/src/viewport/meshBuilders.beamSystem.test.ts — beam system tests (exists!)
packages/web/src/viewport/meshBuilders.massBox.ts     — box mass mesh (done)
packages/web/src/viewport/meshBuilders.massExtrusion.ts — extrusion mass mesh (done)
packages/web/src/viewport/meshBuilders.massRevolution.ts — revolution mass mesh (done)
packages/web/src/viewport/meshBuilders.massVolumes.test.ts — mass volume tests (done)
packages/web/src/viewport/meshBuilders.ramp.ts        — ramp mesh (belongs to WP-C)
packages/web/src/plan/bracePlanSymbol.ts              — brace plan symbol (done)
packages/web/src/plan/beamSystemPlanSymbol.ts         — beam system plan symbol (exists!)
packages/web/src/plan/massVolumePlanSymbol.ts         — mass volume plan symbol (done)
packages/web/src/plan/curtainWallPlanSymbol.ts        — curtain wall plan symbol (done)
packages/web/src/plan/columnAtGrids.ts                — column-at-grid helper (untracked!)
packages/web/src/plan/columnAtGrids.test.ts           — column-at-grid tests (untracked!)
packages/web/src/tools/massByFace.ts                  — roof/wall by face utilities (done)
packages/web/src/tools/massByFace.test.ts             — by-face tests (done)
packages/web/src/tools/massFloorsByLevel.ts           — floor-by-level utility (done)
packages/core/src/index.ts                            — Element union + ElemKind
```

Architecture patterns:
- All element types follow: define `kind` in core → implement 3D mesh builder
  in `viewport/meshBuilders.<type>.ts` → dispatch from `meshBuilders.ts` → add
  plan symbol in `plan/<type>PlanSymbol.ts` → call from `planProjection.ts`.
- Semantic commands: study `{ type: 'createWall', ... }` for shape conventions.
- Tests: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically.

---

## What was done before the crash

| Sub-task | Status | Notes |
|---|---|---|
| G1 Brace | **Done** | `'brace'` ToolId in registry; `meshBuilders.brace.ts`; `bracePlanSymbol.ts`; tests. Tracker: "Implemented — G1". |
| G2 Beam System | **Partial** | `meshBuilders.beamSystem.ts` + `beamSystemPlanSymbol.ts` + tests exist. `'beam-system'` ToolId NOT in `toolRegistry.ts`. `beam_system` kind IS in `core/index.ts`. Needs wiring. |
| G3 Column at Grids | **Partial** | `plan/columnAtGrids.ts` + `plan/columnAtGrids.test.ts` exist as **untracked files** (not committed). Options-bar "At Grids" button not wired. |
| G4 Sloped Columns | **Not Started** | Tracker: "Not Started — P2" |
| G5 Mass Volumes | **Done** | `mass_box`, `mass_extrusion`, `mass_revolution` in core + mesh builders + plan symbol. ToolIds `mass-box`, `mass-extrusion`, `mass-revolution` in toolRegistry (staged, not committed). Tracker: "Implemented". |
| G6 Roof by Face | **Done** | `massByFace.ts` utilities + `MassFaceRef` type. Tracker: "Implemented (G6)". |
| G7 Wall by Face | **Done** | `massByFace.ts` side-face utilities. Tracker: "Implemented (G7)". |
| G8 Floor by Level | **Done** | `massFloorsByLevel.ts` + tests. Tracker: "Implemented (G8)". |
| G9 Curtain Wall | **Partial** | `curtainWallData` compound type in core; `curtainWallPlanSymbol.ts`. No interactive grid editing UI. |

---

## Step 0 — commit staged + untracked work FIRST

There are **staged changes** not yet committed:
- `packages/core/src/index.ts` — `mass_box`, `mass_extrusion`, `mass_revolution` in ElemKind
- `packages/web/src/tools/toolRegistry.ts` — `'brace'` tool entry
- `spec/revit-parity/revit2026-parity-tracker.md` — tracker updates

There are **untracked new files** to stage as well:
- `packages/web/src/plan/columnAtGrids.ts`
- `packages/web/src/plan/columnAtGrids.test.ts`

Verify, test, then commit:
```bash
git pull --rebase origin main
pnpm test --filter @bim-ai/web -- columnAtGrids
git add packages/core/src/index.ts \
        packages/web/src/tools/toolRegistry.ts \
        spec/revit-parity/revit2026-parity-tracker.md \
        packages/web/src/plan/columnAtGrids.ts \
        packages/web/src/plan/columnAtGrids.test.ts
git commit -m "feat(structural): brace tool + mass ElemKind types + columnAtGrids helper (WP-G)"
git push origin main
```

---

## What still needs to be done

### G2 — Wire the Beam System tool

The 3D mesh and plan symbol exist. The `beam_system` element kind is in core.
Still needed:

1. **Add `'beam-system'` ToolId** to `toolRegistry.ts` (hotkey `BS`, modes:
   plan + 3D) — rebase first since `toolRegistry.ts` is shared.

2. **Grammar** in `tools/beam-system.ts` (or `toolGrammar.ts`):
   - Draw a closed boundary polygon (click points, double-click/Enter to close)
   - Options bar: spacing (default 1200mm), direction (angle, default: longest
     boundary edge), profile picker
   - On complete: dispatch `{ type: 'createBeamSystem', boundaryPoints, spacingMm, beamDirection, profileId, levelId }`

3. **Inspector** for `beam_system` elements: spacing, direction, profile,
   boundary vertex grips.

4. **Verify existing tests** in `meshBuilders.beamSystem.test.ts` pass after
   wiring. Add grammar tests if missing.

5. **Update tracker** §9.3 from "Not Started" to at least "Partial".

### G3 — Wire "At Grids" button for column placement

`columnAtGrids.ts` logic exists (just committed). Still needed:

1. When the `'column'` tool is active, add an **"At Grids" button** to the
   options bar (`tools/OptionsBar.tsx`).

2. **Grammar extension**: clicking "At Grids" switches the column tool into
   a grid-selection mode:
   - User clicks/box-selects grid lines
   - Enter triggers: compute all pairwise intersections (reuse `columnAtGrids.ts`)
   - Dispatch N `createColumn` commands for each intersection point

3. Options bar: column type, base level, top level (same for all batch placements).

4. Tests: 3 horizontal × 3 vertical grids → verify 9 columns at correct XY positions.

5. **Update tracker** §9.1.2 from "Not Started" to at least "Partial".

### G4 — Sloped / Inclined Columns

Not started. Add support for non-vertical columns:

1. **Data model** — add to column element in `core/index.ts`:
   - `topOffsetXMm?: number` — horizontal X offset of column top from base
   - `topOffsetYMm?: number` — horizontal Y offset of column top from base

2. **3D mesh** — update the column case in `meshBuilders.ts`: when
   `topOffsetXMm` or `topOffsetYMm` is non-zero, extrude along the inclined
   axis instead of straight up.

3. **Plan symbol** — show base footprint (solid) + top footprint (dashed, offset)
   connected by a diagonal line.

4. **Inspector** — top offset X/Y fields; read-only computed inclination angle.

Tests: column with `topOffsetXMm: 500`, verify 3D mesh top vertices are offset
correctly from base.

### G9 — Curtain Wall interactive grid editing

`curtainWallData` type and plan symbol exist. Add the authoring UI:

1. **Wall type picker**: add a "Curtain Wall" category with preset types
   ("Storefront", "Curtain Wall", "Exterior Glazing") distinguished by their
   `curtainWallData` defaults.

2. **Inspector** when a curtain wall is selected: H grid (count/spacing),
   V grid (count/spacing), panel type dropdown, mullion type dropdown.

3. **"Edit Grid" mode**: in plan view, clicking a curtain wall enters grid-edit
   mode. The user can click to add/remove grid lines at exact positions along
   the wall. Click outside to exit.

4. **3D rendering**: route curtain walls to the curtain panel builder in
   `meshBuilders.ts` instead of the solid wall builder. The test file
   `meshBuilders.curtainPanels.test.ts` should guide this.

5. **Plan rendering**: curtain walls show as thin line with short perpendicular
   tick marks for each grid division (update `curtainWallPlanSymbol.ts` or
   `planProjection.ts`).

Tests:
- `meshBuilders.curtainWall.test.ts`: 4m × 3m curtain wall, 3 vertical + 2
  horizontal divisions → 6 glass panels rendered
- `curtainWallPlanSymbol.test.ts`: verify plan projection shows grid tick marks

---

## Rules

- `git pull --rebase origin main` before every major sub-task
- Commit + push after each completed sub-task
- Do NOT touch annotation/dimension, stair/ramp (WP-C), export (WP-E),
  phase dialogs (WP-F), groups (WP-B), view/sheet rendering (WP-D)
- `toolRegistry.ts` is shared — always rebase before editing
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
