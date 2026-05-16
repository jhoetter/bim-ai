# Wave 2 — WP-F: Global Parameters + Decal Tool + Sloped Columns

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                   — Element union + ElemKind
packages/web/src/osm/project.ts                              — project settings Zustand store
packages/web/src/workspace/Workspace.tsx                     — app shell (where dialogs mount)
packages/web/src/workspace/project/ProjectSetupDialog.tsx    — project setup (see phase wiring)
packages/web/src/phases/PhaseManagerDialog.tsx               — pattern for a settings dialog
packages/web/src/tools/toolRegistry.ts                       — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts                        — per-tool grammar state machines
packages/web/src/viewport/meshBuilders.ts                    — 3D mesh dispatcher
packages/web/src/plan/planElementMeshBuilders.ts             — plan symbol dispatcher
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `project_settings` element type exists in `@bim-ai/core` with `projectUnits`, `georeference`
- `PhaseManagerDialog.tsx` (574 lines) — fully wired in Workspace.tsx — use as pattern
- `DecalElem` element type exists in `@bim-ai/core` (search `kind: 'decal'`)
- `buildDecalMesh()` exists in `meshBuilders.ts` for 3D rendering of decals
- Column element type exists in `@bim-ai/core` with `heightMm`, `widthMm`, `positionMm`
- Column mesh builder exists in `meshBuilders.ts`

---

## Tasks

### F1 — Global parameters dialog (Ch. 3.8)

**F1a. Data model**: Add to `project_settings` in `core/index.ts`:
```ts
globalParams?: Array<{
  id: string;
  name: string;
  formula: string;   // e.g. "3000 + 500" or "2 * floorHeight" — stored as string
  valueMm: number;   // evaluated result, cached on save
}>;
```

**F1b. Commands**:
- `{ type: 'addGlobalParam', name: string, formula: string }`
- `{ type: 'updateGlobalParam', id: string, formula: string, valueMm: number }`
- `{ type: 'deleteGlobalParam', id: string }`

**F1c. Dialog**: Create `packages/web/src/workspace/project/GlobalParamsDialog.tsx`:
- Renders a table: columns "Name", "Formula", "Value (mm)"
- Each row is editable inline; formula field validates as a numeric expression
- "Add Parameter" button appends a new row
- "Delete" button on each row
- Simple formula evaluator: use `Function('return ' + formula)()` or a safe expression
  parser (avoid arbitrary code exec — strip non-numeric chars except +−*/() and spaces)
- On any change, dispatch the appropriate command + recompute `valueMm`

**F1d. Workspace wiring**: In `Workspace.tsx`, add `globalParamsOpen` state + menu entry
the same way `phaseManagerOpen` and `PhaseManagerDialog` are wired. Study lines ~1041
and ~4148–4194 in Workspace.tsx for the exact pattern.

Tests:
- addGlobalParam command stores the param in project_settings
- Formula "3000 + 500" evaluates to valueMm=3500
- Dialog renders a row for each globalParam

Update tracker §3.8: "Implemented — global params table + dialog + commands"

---

### F2 — Decal placement tool

**F2a. ToolId**: Add `'decal'` to `toolRegistry.ts` (hotkey `DC`, 3D mode only).

**F2b. Grammar**: Add `DecalState` / `reduceDecal` to `toolGrammar.ts`:
```
idle
  → 3D click on a face → picking-image (store position + face normal)
picking-image
  → image chosen (via file picker or URL input in options bar) → done
  → Escape → idle
```
Effect on done: `{ kind: 'createDecal', positionMm, normalVec, imageSrc, widthMm: 1000, heightMm: 1000 }`

**F2c. PlanCanvas / viewport wiring**: Wire `case 'decal':` in PlanCanvas.tsx (or in the
3D viewport event handler — `DecalElem` is a 3D-only tool). On the effect, dispatch:
`{ type: 'createElement', elem: { kind: 'decal', ...effect } }`

**F2d. Inspector for selected decal**: Image URL field, width (mm) + height (mm) number
inputs. Dispatches `{ type: 'updateElement', id, patch: { imageSrc, widthMm, heightMm } }`.

The 3D mesh builder (`buildDecalMesh`) already exists — just ensure it's dispatched from
`meshBuilders.ts` for `kind === 'decal'`.

Tests:
- Grammar: 3D face click produces createDecal effect with correct normalVec
- Inspector renders imageSrc, widthMm, heightMm fields

Update tracker §8.1.5: "Implemented — 'decal' ToolId + grammar + inspector"

---

### F3 — Sloped / inclined columns (Ch. 9.1.4)

**F3a. Data model**: Add to the column element type in `core/index.ts`:
```ts
topOffsetXMm?: number;   // horizontal X shift of column top from base (default 0)
topOffsetYMm?: number;   // horizontal Y shift of column top from base (default 0)
```

**F3b. 3D mesh**: In `meshBuilders.ts` (column case), when `topOffsetXMm` or `topOffsetYMm`
is non-zero:
- Compute the inclined axis vector: `(topOffsetXMm, topOffsetYMm, heightMm)` — normalized
- Extrude the column profile along this axis instead of straight up
- The base profile stays at `positionMm` (XY); the top profile is offset by
  `(topOffsetXMm, topOffsetYMm)` at height `heightMm`

**F3c. Plan symbol**: In the column plan symbol renderer, when column has non-zero offsets:
- Draw the base footprint solid (existing)
- Draw the top footprint dashed, shifted by `(topOffsetXMm, topOffsetYMm)` in plan space
- Draw a diagonal line connecting the two footprint centres

**F3d. Inspector**: Add "Top Offset X (mm)" and "Top Offset Y (mm)" number inputs to the
column inspector panel. Add a read-only "Inclination angle" field computed as:
`Math.atan2(Math.hypot(topOffsetXMm, topOffsetYMm), heightMm) * (180 / Math.PI)`.

Tests:
- Column with `topOffsetXMm: 500, heightMm: 3000`: verify top vertices in 3D mesh
  are shifted by 500mm in X relative to base vertices
- Zero offsets produces same output as before (no regression)

Update tracker §9.1.4: "Implemented — sloped column data model + mesh + plan symbol + inspector"

---

## Rules

- `git pull --rebase origin main` before editing `core/index.ts`, `toolRegistry.ts`,
  or `toolGrammar.ts` — WP-B, WP-C, WP-D, WP-E all touch these files
- Commit + push after each completed task (F1, F2, F3 separately)
- DO NOT touch curtain wall, group renderers, IFC export menu, attach grammar, annotation grips
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
