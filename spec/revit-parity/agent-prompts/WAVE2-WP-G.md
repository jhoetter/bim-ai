# Wave 2 — WP-G: Animated Sun Study + Roof-by-Extrusion + Wall Parts

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — Element union + ElemKind
packages/web/src/viewport/sunStore.ts                    — sun position Zustand store (done)
packages/web/src/viewport/SunOverlay.tsx                 — sun controls UI (done)
packages/web/src/viewport/meshBuilders.ts                — 3D mesh dispatcher
packages/web/src/plan/planElementMeshBuilders.ts         — plan symbol dispatcher
packages/web/src/tools/toolRegistry.ts                   — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts                    — per-tool grammar state machines
packages/web/src/plan/PlanCanvas.tsx                     — main plan interaction handler
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `sunStore.ts` — Zustand store with `azimuthDeg`, `altitudeDeg`; 3D viewport reacts to changes
- `SunOverlay.tsx` — sun angle controls panel in 3D toolbar
- `projectNorthAngleDeg` in `project_settings` (F6/wave-1)
- Roof element type in `core/index.ts` with `boundary`, `ridgePoints`, etc.
- Sweep/extrusion mesh builders for roofs in `meshBuilders.ts`
- Wall element type with all layer/type data in `core/index.ts`

---

## Tasks

### G1 — Animated sun study (Ch. 14.2.2) — highest priority

Extend `SunOverlay.tsx` (or create a sibling `SunAnimationPanel.tsx`) with animation controls:

**G1a. Controls**:
- Date picker (input type="date") — sets the reference date for sun position calculation
- Start time (HH:MM) / End time (HH:MM) inputs
- Step dropdown: 15 min / 30 min / 1 hr
- Speed multiplier: 0.5× / 1× / 2× / 4×
- "Play / Pause" button
- "Reset" button (returns to Start time)

**G1b. Animation loop**: On "Play", use `requestAnimationFrame` to:
- Increment `currentTimeSec` by `(step_seconds * speed) / frames_per_step`
- Recalculate sun azimuth + altitude from date + time + latitude (use the same solar
  calculation formula already in `sunStore.ts` or `sunCalc.ts`)
- Call `sunStore.setState({ azimuthDeg, altitudeDeg })`
- Stop when `currentTimeSec >= endTimeSec`
- "Pause" calls `cancelAnimationFrame`

The 3D scene already re-renders in response to sunStore changes — no mesh changes needed.

**G1c. Wiring**: Mount the panel below (or beside) the existing SunOverlay controls.
Show only when the 3D viewport is active.

Tests:
- Given fixed date + time, the solar angle calculation returns a known azimuth/altitude
  (use a reference value: 21 Jun, 12:00, lat=48°N → altitude ≈ 65°)
- Animation increments time correctly across the step boundary

Update tracker §14.2.2: "Implemented — animated sun study with date/time range + playback"

---

### G2 — Roof by extrusion tool (Ch. 10.2)

**G2a. ToolId**: Add `'roof-by-extrusion'` to `toolRegistry.ts` (hotkey `RE`, plan mode).

**G2b. Grammar**: Add `RoofByExtrusionState` / `reduceRoofByExtrusion` to `toolGrammar.ts`:
```
idle
  → click → recording profile points
recording
  → click → append point
  → double-click / Enter → confirm-depth
confirm-depth
  → type mm + Enter → done
  → Escape → idle
```
Effect on done:
`{ kind: 'createRoofByExtrusion', profilePoints, depthMm, levelId, slopeAngleDeg: 0 }`

**G2c. Command handler**: In the command queue, `createRoofByExtrusion` creates a `roof`
element with `profilePoints` as the sketch boundary and `depthMm` as the extrusion extent.
Study how `createRoofByFootprint` works — use the same data shape so the existing roof mesh
builder can handle it without changes. Add `extrusionDepthMm?: number` to the roof type in
`core/index.ts` if needed.

**G2d. PlanCanvas wiring**: Add `case 'roof-by-extrusion':` routing events through
`reduceRoofByExtrusion`. On effect, dispatch the command.

Tests:
- Grammar: 3 clicks + Enter → confirm-depth state; type 3000 + Enter → createRoofByExtrusion effect
- createRoofByExtrusion command creates a roof element with correct profilePoints + depthMm

Update tracker §10.2: "Implemented — roof-by-extrusion tool + grammar + command handler"

---

### G3 — Wall parts / Create Parts (Ch. 8.1.3, P2)

**G3a. Data model**: Add to wall element in `core/index.ts`:
```ts
parts?: Array<{
  id: string;
  startT: number;   // 0.0–1.0 along wall length
  endT: number;
  materialId?: string;
}>;
```

**G3b. "Create Parts" action**: Appears in the selection toolbar when exactly 1 wall is
selected. Clicking "Create Parts" dispatches:
`{ type: 'createWallParts', wallId, count: 3 }`
which splits the wall into `count` equal parts (startT/endT = 0/0.33, 0.33/0.67, 0.67/1.0).

**G3c. Plan rendering**: When a wall has `parts`, and the user is in "Parts" mode (a toggle
button in the selection toolbar), render each part as a separately coloured/highlighted
segment in plan. Parts without a materialId get a default hatch.

**G3d. Inspector for parts**: When a wall with parts is selected and "Parts" mode is active,
clicking a part segment selects that part → inspector shows material dropdown for that part.
Dispatches `{ type: 'updateWallPart', wallId, partId, materialId }`.

Tests:
- createWallParts on a wall produces 3 parts with correct startT/endT values
- Plan renderer: wall with parts renders 3 distinct segment meshes

Update tracker §8.1.3: "Partial — wall parts data model + create action + plan rendering"

---

## Rules

- `git pull --rebase origin main` before editing `core/index.ts`, `toolRegistry.ts`,
  or `toolGrammar.ts` — WP-B, WP-C, WP-D, WP-E, WP-F all touch these files
- Commit + push after each completed task (G1, G2, G3 separately)
- DO NOT touch group renderers, IFC export menu, attach grammar, annotation grips, decal tool
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
