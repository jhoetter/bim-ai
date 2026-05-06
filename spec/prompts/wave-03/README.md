# Wave 3 — Element Depth

**Goal:** Add structural columns/beams, curtain wall grid config, and ceilings.

**Batch order:**

| Batch | WP | Title | Dependency |
|---|---|---|---|
| A (parallel) | WP-V2-07 | Curtain Wall grid params + Inspector | Start after Wave 2 merged |
| A (parallel) | WP-V2-06 | Structural — Column + Beam | Start after Wave 2 merged |
| B | WP-V2-08 | Ceilings | After both A branches merged to main |

**Why WP-V2-07 and WP-V2-06 can run in parallel:**
Their changes in the two overlapping files land in different parts:
- `core/src/index.ts` — V2-07 adds fields inside the wall block (~line 191); V2-06 adds to ElemKind (line 36) + appends column/beam to Element union (line 500)
- `meshBuilders.ts` — V2-07 modifies inside `makeCurtainWallMesh` body; V2-06 appends new functions at end
- `i18n.ts` — V2-07 adds to `inspector.fields`; V2-06 adds to `tools`

Git merges these cleanly — no textual conflicts.

**Why WP-V2-08 must wait for WP-V2-06:**
WP-V2-08 appends `| 'ceiling'` after `| 'column' | 'beam'` in ElemKind, ToolId, PlanTool, PALETTE_ORDER,
and adds the ceiling grammar + dispatch after the beam equivalents. Those lines don't exist until
WP-V2-06 is merged.

## Tracker

Update `spec/workpackage-master-tracker.md` to `done` for each WP when merged.
When all three WPs are merged, mark Wave 3 → `done` and Wave 4 → `current`.
