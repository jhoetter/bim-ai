# WP-C Resume — Vertical Circulation, Ramp & Level Management

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained.

---

## Repo orientation (WP-C relevant paths)

```
packages/web/src/plan/StairBySketchCanvas.tsx        — stair-by-sketch UI
packages/web/src/plan/StairSketchEditor.tsx           — stair sketch editor
packages/web/src/plan/stairAutobalance.ts             — auto-balance run widths
packages/web/src/plan/stairPlanSymbol.ts              — stair plan symbol
packages/web/src/plan/rampPlanSymbol.ts               — ramp plan symbol (exists!)
packages/web/src/viewport/meshBuilders.ramp.ts        — ramp 3D mesh (exists!)
packages/web/src/viewport/meshBuilders.multiRunStair.ts — multi-run/multi-storey stair mesh
packages/web/src/levels/LevelStack.tsx                — level management UI
packages/web/src/clipboard/copyToLevels.ts            — paste-to-levels command (done)
packages/web/src/clipboard/copyPaste.ts               — Ctrl+C/V clipboard
packages/core/src/index.ts                            — shared Element types
```

Architecture patterns:
- Elements stored as plain objects with a `kind` discriminator (`'stair'`,
  `'ramp'`, `'level'`).
- Semantic commands dispatched via `onSemanticCommand`: `{ type: 'createRamp', ... }`.
- 3D meshes: `viewport/meshBuilders.ts` dispatches by element kind to sub-builders.
  Study `meshBuilders.multiRunStair.ts` for the builder interface.
- Plan symbols: separate file per element type, called from `plan/planElementMeshBuilders.ts`.
- Tests: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically.

---

## What was done before the crash

| Sub-task | Status | Files |
|---|---|---|
| C1 Ramp — core type + 3D mesh + plan symbol | **Partial** | `core/index.ts` has ramp kind; `meshBuilders.ramp.ts` + `rampPlanSymbol.ts` + tests exist; `'ramp'` ToolId is in toolRegistry. Grammar/wiring completeness unknown — verify before adding. |
| C6 copyToLevels command | **Done** | `clipboard/copyToLevels.ts` + tests |
| C2 Multi-storey stair | **Partial** | `meshBuilders.multiRunStair.ts` has multiStorey support; `meshBuilders.multiStoreyStair.test.ts` exists |

C3, C4, C5, C7 have no visible committed work — assume not started.

---

## How to start

**Before writing any code**, run:
```bash
git pull --rebase origin main
pnpm test --filter @bim-ai/web -- ramp
pnpm test --filter @bim-ai/web -- multiStorey
```

Read these files to understand the current state:
- `plan/rampPlanSymbol.ts` — check what plan symbol geometry it produces
- `viewport/meshBuilders.ramp.ts` — check if the mesh is complete
- `tools/toolGrammar.ts` — search for `'ramp'` to see if grammar exists
- `levels/LevelStack.tsx` — understand the current level UI before C5

Then start with the sub-tasks that have the most partial work.

---

## What still needs to be done

### C1 — Ramp Tool: complete the grammar + inspector

Files exist. Verify and complete:
1. Does `tools/toolGrammar.ts` have a ramp grammar? If not, add it:
   - Mode "By Length": click insertion point → click endpoint. Rise = topLevel.elevationMm − baseLevel.elevationMm.
   - Mode "By Sketch": boundary polygon + run line inside it.
   - Options bar: mode toggle, widthMm, topLevelId picker.
2. Inspector: widthMm, runMm, slopePercent (read-only), material, hasRailingLeft/Right, topLevelId.
3. Advisor integration: if `slopePercent > 8.33` (1:12 accessibility), emit a warning.
4. If `rampPlanSymbol.ts` or `meshBuilders.ramp.ts` have TODOs/stubs, fill them in.
5. Verify `ramp.test.ts` and `meshBuilders.ramp.test.ts` pass.

### C2 — Multi-Storey Stair: complete and test

`meshBuilders.multiRunStair.ts` has the logic. Verify and complete:
1. `stair` element has `topLevelId` and `multiStorey: true` fields in `core/index.ts`
2. Grammar: after first-floor stair is sketched, an "Extend to level?" option
   appears in the options bar. User picks a top level.
3. Plan symbol: on each intermediate level's plan view, the stair symbol is
   clipped to that level's run segment.
4. Schedule: `schedules/stairScheduleEvidenceReadout.ts` shows full height for
   multi-storey stairs.
5. Tests: 3-storey stair — verify mesh vertex count matches 3 × single-storey,
   verify plan symbol appears on each intermediate level.

### C3 — Complex Stair Configurations

Audit `StairBySketchCanvas.tsx` and `stairAutobalance.ts`:
1. **L-shape** (2 runs + 90° landing): verify the sketch editor accepts an
   L-shaped boundary and generates correct 3D geometry. The mesh builder must
   handle non-rectangular landings.
2. **U-shape** (3 runs + 2 landings): same audit.
3. **Winder stairs**: add `winderAtCorner: boolean` to the stair element. When
   true, generate triangular treads at the corner instead of a landing.
4. **Spiral stair**: new element type `stair_spiral` with `centrePtXMm`,
   `centrePtYMm`, `innerRadiusMm`, `outerRadiusMm`, `totalAngleDeg`,
   `treadCount`. Plan symbol: concentric arcs + radial lines. 3D mesh:
   `meshBuilders.spiralStair.ts` — rotate each tread platform by
   `totalAngleDeg / treadCount` around the centre with incremental Z.

Tests for each: verify no geometry gaps (correct normals, no open mesh edges).

### C4 — Attach Top/Base of Walls to Roof or Floor

Not started. Implement:
1. Selection action "Attach Top" (shown when ≥1 wall is selected):
   Step 1 = walls selected; Step 2 = click the roof or floor to attach to.
2. Semantic command: `{ type: 'attachWallTop', wallId, hostId }`. Handler
   sets `topConstraint: { hostId, hostFace: 'bottom' }` on the wall element.
   The CSG system (`csgWallBaseGeometry.ts`) already handles trimming — this
   command just sets the relationship.
3. "Detach Top/Base" selection action: clears the constraint.
4. 3D: wall silhouette follows roof slope. Plan: wall top line is dashed.

Tests: attach a gable-end wall to a hip roof, verify mesh top vertices lie on
the roof surface.

### C5 — Add Multiple Levels

Not started. In `levels/LevelStack.tsx` add:
- "Add Multiple…" button (or right-click context on a level: "Add N Levels Above")
- Small dialog: count (default 3), spacing (default 3000mm), name prefix (default "Ebene")
- Dispatches N `createLevel` commands sequentially

Tests: add 4 levels at 2800mm spacing, verify all 4 created at correct elevations.

### C6 — Clipboard UI (complete)

`copyToLevels.ts` command is done. Wire the UI:
- `Ctrl+C` on a selection stores element IDs + current level in `clipboardStore`
- `Ctrl+V` pastes at cursor — check `clipboard/copyPaste.ts` for existing logic
- "Paste Aligned to Selected Levels" button in the selection toolbar → level
  picker modal → dispatches `copyToLevels`

### C7 — Stair Railing Completeness Pass

Verify and complete:
1. When a stair is created, auto-create `railing` elements for each open side
   with `hostStairId` set to the stair's ID
2. Stair move → railings move with it; stair delete → railings are also deleted
3. Inspector on a railing: `hostStairId` (read-only), `railingHeight`,
   `topRailProfile`, `balustradeSpacingMm`

Tests: create stair, verify railings auto-created; delete stair, verify
railings are also removed.

---

## Rules

- `git pull --rebase origin main` before every major sub-task
- Commit + push after each completed sub-task
- Do NOT touch annotation/dimension, export, phase dialogs, groups,
  structural beam/brace, or massing files
- `toolRegistry.ts` is shared — always rebase before adding entries
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
