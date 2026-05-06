# Open tasks — BIM AI UI

Living to-do for the redesigned UI. Anything that's *still open* lives here so it doesn't get buried in commit messages or a 1200-line spec. When a task closes, move it to spec/ui-ux-redesign-v1-spec.md §6 (Sprint Ledger) and delete its row here.

**Counterpart docs**:
- `spec/ui-ux-redesign-v1-spec.md` §32 — fuller-context visual-fidelity audit (V01–V15).
- `spec/ui-ux-redesign-v1-spec.md` §28 — WP-UI-* table (every row is `partial`; this file enumerates the *concrete next moves*, not the WP roll-up).
- `spec/ui-ux-redesign-v1-spec.md` §6 — sprint ledger of what already closed.

Last updated: 2026-05-06.

---

## High-impact (user-visible, blocks daily use)

---

## Medium (deferred from earlier WPs, called out in commits but not in spec)

---

## §28 WP-UI rows — table-level audit

40 of 43 rows are now `done` (2026-05-06 sweep). Three rows remain `partial`:

- **WP-UI-B01** (2D Plan canvas — drafting visuals): `planCanvasState.draftingPaintFor` not directly used in PlanCanvas.tsx; canvas achieves token-driven paint via symbology.ts but scale-dependent line weights and hatch visibility are not yet wired.
- **WP-UI-B02** (2D Plan canvas — pointer + snap grammar): `planCanvasState.classifyPointerStart` not used; PlanCanvas has its own pointer classification.
- **WP-UI-B03** (2D Plan canvas — zoom/pan/level/empty state): `planCanvasState.PlanCamera` not used; PlanCanvas has its own zoom/pan/camera. Anchor-toward-cursor zoom and strict 1:5–1:5000 bounds not applied.

Next sweep: wire `PlanCamera`, `SnapEngine`, and `draftingPaintFor` into `PlanCanvas.tsx` to close B01–B03.

---

## How to add a new task

1. Append a new `### T-NN · Title` heading at the end of the relevant section.
2. Fill: WP target / Source / Status, then a 1-paragraph "what" + a "Next moves" sub-list.
3. If it's user-visible, also add a row in spec §32. Otherwise just here.
4. Once closed, **delete the heading from this file** and add a row in spec §6 (Sprint Ledger) with the closing commit.
