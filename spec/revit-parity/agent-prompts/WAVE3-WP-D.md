# Wave 3 — WP-D: Room Tag Display + Net Area Computation (§13.1.2 + §13.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — Element union (RoomElem etc.)
packages/web/src/plan/symbology.ts                      — plan symbol renderers (roomFillOpacityScale, roomLabelsVisible)
packages/web/src/plan/planRoomLabelLayout.ts            — room label text layout helper
packages/web/src/plan/planRoomLabelLayout.test.ts       — existing tests
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/schedules/roomFinishScheduleEvidenceReadout.ts — net area computation
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

- `room` element type in `core/index.ts` with `boundary` polygon, `name`, `number`, `areaMm2`
- `planRoomLabelLayout.ts` — computes label position (centroid of boundary polygon) and text rows
- `roomFillOpacityScale` and `roomLabelsVisible` flags exist on the view settings passed to
  symbology; `planTagFontScales.room` controls room tag font scale
- `symbology.ts` line ~702: `if (ann?.roomLabelsVisible === true && typeof mesh.userData.roomLabel === 'object')`
  — a room label rendering hook exists but only exposes centroid/area (not a full 3-line label)
- `roomFinishScheduleEvidenceReadout.ts` — partial net-area computation
- `roomSchemeColor.ts` + `ColorSchemeDialog.tsx` — color fill by department/area

---

## Tasks

### A — Room tag: full 3-line label in plan view

Currently room tags show only area. Update the plan room label renderer to show a proper
Revit-style 3-line label:

```
Room Name          ← el.name  (bold, larger)
Room Number        ← el.number (normal weight)
123.4 m²           ← areaMm2 / 1e6, rounded to 1 decimal
```

**Where to change**: In `symbology.ts` (and/or `planRoomLabelLayout.ts`), update the code that
builds the room label `CanvasTexture` / `Sprite` to render all 3 lines. Study how `planAnnotationLabelSprite()` or similar helpers render multi-line text on the plan canvas.

If the current implementation uses a single `Sprite`, keep using a `Sprite` but draw all 3 lines
onto the CanvasTexture with appropriate font sizes (name: 14px bold, number: 12px, area: 12px).

Export `formatRoomAreaM2(areaMm2: number): string` from `planRoomLabelLayout.ts` (rounds to 1
decimal, appends " m²").

Make sure `roomLabelsVisible: false` still hides all 3 lines (no partial rendering).

---

### B — Room element inspector

In `InspectorContent.tsx`, add a `case 'room':` block (or extend if one exists). Show:

- **Name** — text input; dispatches `{ type: 'updateElement', id, patch: { name } }`
- **Number** — text input; dispatches `{ type: 'updateElement', id, patch: { number } }`
- **Department** — text input (used for color schemes); dispatches patch `{ department }`
- **Area** — read-only display: `formatRoomAreaM2(el.areaMm2)` or "— m²" if not computed
- **Net area** — read-only display of net area (task C below), shown as "Net: 118.2 m²"

Use `<FieldRow>` for read-only fields and standard `<input>` elements for editable ones, following
the existing inspector pattern.

---

### C — Net area computation

Revit's net area subtracts columns and wall segments that fall inside the room boundary from the
gross `areaMm2`.

In `roomFinishScheduleEvidenceReadout.ts` (or add a new `roomNetArea.ts` helper), implement:

```ts
export function computeRoomNetAreaMm2(
  room: RoomElem,
  elementsById: Record<string, Element>,
): number
```

Algorithm:
1. Start with `room.areaMm2` (gross area).
2. Iterate all `column` elements in `elementsById`. For each column whose centre point falls
   inside `room.boundary`, subtract `column.widthMm * column.depthMm` (the column footprint).
3. Iterate all `wall` elements. For each wall segment whose midpoint falls inside `room.boundary`,
   subtract `wall.thicknessMm * wallLengthMm` (wall footprint area within the room).
   Use a point-in-polygon test (Shoelace / ray casting — a simple helper is acceptable).
4. Return `Math.max(0, gross - columnArea - wallArea)`.

This is a geometric approximation (not a full boolean subtraction), which is acceptable at this
parity level.

Export `computeRoomNetAreaMm2` and use it in the room inspector to populate the "Net area" field.

---

### D — Room element type extension (if needed)

If `RoomElem` in `core/index.ts` is missing `department?: string`, add it.
If `areaMm2` is already there, do NOT add a duplicate — just confirm it exists.

---

## Tests

Add to `packages/web/src/plan/planRoomLabelLayout.test.ts` (extend existing file):
1. `formatRoomAreaM2(1234567)` → `"1.2 m²"` (rounds to 1 decimal)
2. `formatRoomAreaM2(0)` → `"0.0 m²"`

Add to `packages/web/src/schedules/roomNetArea.test.ts` (new file):
3. Room with no columns/walls → net area equals gross area
4. Room with one column inside boundary → net area = gross − column footprint
5. Room with a wall midpoint outside boundary → wall not subtracted
6. Net area never goes below 0

Add to inspector tests (wherever `InspectorContent` is tested):
7. `case 'room'` renders name + number + area fields
8. Editing name input dispatches updateElement patch

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §13.1.2 description — append:
```
Room tag updated to render 3-line label (name, number, area) via updated CanvasTexture in
symbology.ts. `formatRoomAreaM2` helper exported from `planRoomLabelLayout.ts`. 2 tests.
```
Change §13.1.2 status to `Done — P1`.

Update §13.1.4 description — append:
```
`computeRoomNetAreaMm2()` helper subtracts column and wall footprints inside the room boundary
(geometric approximation). Exposed in room inspector as "Net area" read-only field. 4 tests.
```
Change §13.1.4 status to `Done — P1`.

Update the summary table row for Chapter 13.
