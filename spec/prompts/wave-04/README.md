# Wave 4 — Data Layer

**Goal:** Color Fill Legend, Room volume display, Shared Parameters, and schedule Calculate Totals.

**Batch order:**

| Batch   | WP       | Title                           | Dependency               |
| ------- | -------- | ------------------------------- | ------------------------ |
| A (solo)| WP-V2-09 | Room + Area V2                  | Start after Wave 3 merged |
| B       | WP-V2-10 | Parameters + Shared Parameters  | After WP-V2-09 merged    |

**Why WP-V2-09 must complete before WP-V2-10 starts:**

Both WPs append to `ElemKind` and the `Element` union in `packages/core/src/index.ts`.
WP-V2-10's anchor line in that file (`| 'color_fill_legend';`) does not exist until WP-V2-09 merges.
The git merge would conflict at the same closing semicolon.

**Scope already implemented (skip in prompts, do not re-implement):**

- `room_separation` element: already in `core/index.ts` line 366, store, and `RoomSeparationAuthoringWorkbench.tsx`
- `upperLimitLevelId` field: already in room element shape (`core/index.ts` line 238) and store parser
- Room color scheme / fill logic: already in `planProjectionWire.ts` and `roomColorSchemeCanon.ts`
- Sort / group controls in SchedulePanel: already in `ScheduleDefinitionToolbar.tsx` (`sortBy`, `groupKeys`, `sortDescending`)

## Tracker

Update `spec/workpackage-master-tracker.md`:
- WP done → change `open` → `done`
- Wave 3 still shows CURRENT — when WP-V2-09 and WP-V2-10 both land, change Wave 3 → `done` and Wave 4 → `done`, Wave 5 → `current`
