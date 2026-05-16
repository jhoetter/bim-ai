# WP-A Resume — Annotations & Dimensions

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained — no other file needs to be read to orient yourself.

---

## Repo orientation (WP-A relevant paths)

```
packages/core/src/index.ts           — shared Element union + ElemKind type
packages/web/src/tools/toolRegistry.ts — ToolId union + TOOL_REGISTRY array
packages/web/src/tools/toolGrammar.ts  — per-tool grammar state machines
packages/web/src/tools/textAnnotationGrammar.test.ts — annotation grammar tests
packages/web/src/plan/autoDimension.ts   — existing auto-dimension chain (study for command shape)
packages/web/src/plan/tempDimensions.ts  — existing temp dimension logic
packages/web/src/plan/AnnotateRibbon.tsx — annotate toolbar
packages/web/src/plan/PlanCanvas.tsx     — Canvas 2D drawing surface (add render passes here)
packages/web/src/plan/manualTags.ts      — manual tag placement pattern to follow
packages/web/src/plan/symbology.ts       — line styles, text styles, hatch patterns
```

Architecture patterns:
- **Semantic commands**: `onSemanticCommand({ type: 'createDimension', ... })`.
  Study `autoDimension.ts` for exact shapes.
- **New tools**: add ToolId to union → add entry to `getToolRegistry()` →
  implement grammar in `tools/<id>.ts` → add render pass in
  `plan/<id>PlanRendering.ts` → call from `PlanCanvas.tsx`.
- **Grips**: study `plan/grip-providers/` for the grip provider pattern.
- **Tests**: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically after every Edit/Write via hook — do not run manually.

---

## What was done before the crash

All ToolIds and grammar state machines are registered and committed:

| Sub-task | ToolId | Status |
|---|---|---|
| A1 | `text` (TX) | Partial — grammar only (reduceTextAnnotation: idle→typing→commit) |
| A2 | `leader-text` (LT) | Partial — grammar only (idle→anchor→elbow→typing→commit) |
| A4 | `angular-dimension` (AD) | Partial — grammar + plan renderer stub |
| A5 | `radial-dimension` (RD), `diameter-dimension` (DD) | Partial — grammar + label renderer |
| A6 | `arc-length-dimension` (ALD) | Partial — grammar + midpoint label renderer |
| A7 | `spot-elevation` (SE) | Partial — grammar + plan label renderer; 3D label missing |
| A8 | `spot-coordinate` (SP) | Partial — grammar + N/E label renderer |
| A9 | `slope-annotation` (SL) | Partial — two-click grammar + % label renderer |
| A10 | `material-tag` (MT) | Partial — grammar + label renderer; live layer lookup missing |
| A12 | `north-arrow` (NA) | Partial — grammar + core `annotation_symbol` elem type; sheet rendering missing |

**A3** (permanent dimension completeness pass) and **A11** (dimension text
overrides) have zero implementation.

There are **staged changes** not yet committed:
- `toolRegistry.ts` — `'brace'` ToolId added (WP-G work, leave it alone)
- `spec/revit-parity/revit2026-parity-tracker.md` — tracker updates for A4–A12 Partial

**Commit the staged changes first** before doing any new work:
```bash
git add packages/core/src/index.ts packages/web/src/tools/toolRegistry.ts \
  spec/revit-parity/revit2026-parity-tracker.md
git commit -m "feat(ann): scaffold annotation ToolIds and grammar state machines (WP-A partial)"
git push origin main
```

There is also an untracked file `packages/web/src/plan/detailCallout.test.ts`.
Read it; if it is annotation-related test scaffolding, integrate it into the
relevant sub-task. If it belongs to WP-D (detail callout view workflow), leave
it for WP-D to commit.

---

## What still needs to be done

Work through these in order. Dispatch sub-agents for independent sub-tasks.

### Priority 1 — A1 / A2: Text and Leader-Text (P1 gap)

The grammars exist in `tools/toolGrammar.ts`. Still needed for each:

1. **Core element types** in `packages/core/src/index.ts`:
   - `text_annotation`: `{ kind: 'text_annotation', xMm, yMm, content, textStyleId, leaderXMm?, leaderYMm?, rotationDeg? }`
   - `leader_annotation`: `{ kind: 'leader_annotation', anchorXMm, anchorYMm, elbowXMm?, elbowYMm?, textXMm, textYMm, content, arrowStyle }`

2. **Plan renderers** (Canvas 2D):
   - `plan/textAnnotationRender.ts` — draws text on canvas, leader line if present, respects view scale
   - `plan/leaderAnnotationRender.ts` — draws arrowhead + elbow + text block

3. **Grip providers** (look at `plan/grip-providers/` for pattern):
   - Text: drag text box moves it, rotation handle
   - Leader: drag anchor, drag text block independently

4. **Inspector** (look at `inspector/InspectorContent.tsx` for how to add fields):
   - Text: `content` (editable textarea), `textStyleId` (dropdown), `rotationDeg`
   - Leader: `content`, `arrowStyle`

5. **Tests**: ≥2 per renderer, ≥1 grammar round-trip

### Priority 2 — A3: Permanent Dimension Completeness (P1 gap)

Zero implementation. Study `autoDimension.ts` first.

Deliverables:
- When the `dimension` tool finalises (double-click or Enter), the command
  shape should mark `autoGenerated: false` so it persists
- Dimension text is draggable via a grip on the label position
- **EQ constraint**: when a permanent dimension chain is selected, show an
  "EQ" chip. Clicking it dispatches batch move commands to make all segments
  equal. Emit `{ type: 'moveElement', ... }` for each inner reference element
- **DimensionStyle** type: `{ textSizeMm, witnessLineGapMm, arrowStyle: 'tick'|'dot'|'arrow', textPosition: 'above'|'inline' }`.
  Add a style picker to `AnnotateRibbon.tsx`

### Priority 3 — A4–A9: Elevate from Partial to Done

Each has a grammar + label renderer stub. For each one add:
- Persistent element type in `core/src/index.ts` (check if already there first — some may have been added)
- A grip provider for moving the label
- Inspector fields (read-only computed values + editable ones)
- ≥2 unit tests per renderer

For **A7** (spot elevation) specifically: also add a text label at world
position in the 3D viewport — look at how `viewport/text3dGeometry.ts` works
(or the nearest equivalent for text in 3D).

### Priority 4 — A10: Material Tag live lookup

Grammar + renderer exist. Wire the click → resolve host element → look up
layer material name from the wall type's layer stack. The wall type data is in
the element's `typeId` → look up in the type catalog in the store.

### Priority 5 — A11: Dimension Text Override (P2)

On any permanent dimension element, add `textPrefix?`, `textSuffix?`,
`textOverride?` optional fields. When `textOverride` is set, display it
instead of the computed measurement value. Expose in the inspector.

### Priority 6 — A12: North Arrow Sheet Rendering

The element type and grammar exist. Implement:
- `workspace/sheets/northArrowSheetRender.ts` — renders the north arrow symbol
  on the sheet canvas
- Read `truNorthAngleDeg` from the project's georeference settings
  (`osm/project.ts`)

---

## Definition of Done per sub-task

- TypeScript compiles: `pnpm tsc --noEmit --filter @bim-ai/web`
- ≥2 unit tests per new module
- Tool appears in plan mode palette
- Annotation renders on Canvas 2D
- Grips allow moving/editing
- Inspector shows relevant properties
- Tracker entry updated in `spec/revit-parity/revit2026-parity-tracker.md`

## Rules

- `git pull --rebase origin main` before every major sub-task
- Commit + push after each completed sub-task
- Do NOT touch: stair/ramp, roof, export, phases, structural, or groups files
- `toolRegistry.ts` is shared — always rebase before editing
