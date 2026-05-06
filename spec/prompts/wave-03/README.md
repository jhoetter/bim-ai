# Wave 3 — Element Depth

**Goal:** Add structural columns/beams, curtain wall grid config, and ceilings.

**Batch order (sequential — all WPs conflict on shared files):**

| Batch | WP | Title | Dependency |
|---|---|---|---|
| A | WP-V2-07 | Curtain Wall grid params + Inspector | Start after Wave 2 merged |
| B | WP-V2-06 | Structural — Column + Beam | After A merged to main |
| C | WP-V2-08 | Ceilings | After B merged to main |

**Why sequential:** All three WPs touch `core/src/index.ts` (ElemKind + Element union),
`toolRegistry.ts`, `toolGrammar.ts`, `PlanCanvas.tsx`, `meshBuilders.ts`, and `Viewport.tsx`.
Running in parallel would create merge conflicts on all of these.

WP-V2-07 is first because it adds no new ElemKind — it only extends the existing wall type and
updates the curtain wall mesh builder + Inspector UI.

## Tracker

Update `spec/workpackage-master-tracker.md` to `done` for each WP when merged.
When all three WPs are merged, mark Wave 3 → `done` and Wave 4 → `current`.
