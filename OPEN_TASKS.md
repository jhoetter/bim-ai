# Open tasks — BIM AI UI

Living to-do for the redesigned UI. Anything that's *still open* lives here so it doesn't get buried in commit messages or a 1200-line spec. When a task closes, move it to spec/ui-ux-redesign-v1-spec.md §6 (Sprint Ledger) and delete its row here.

**Counterpart docs**:
- `spec/ui-ux-redesign-v1-spec.md` §32 — fuller-context visual-fidelity audit (V01–V15).
- `spec/ui-ux-redesign-v1-spec.md` §28 — WP-UI-* table (every row is `partial`; this file enumerates the *concrete next moves*, not the WP roll-up).
- `spec/ui-ux-redesign-v1-spec.md` §6 — sprint ledger of what already closed.

Last updated: 2026-05-06.

---

## High-impact (user-visible, blocks daily use)

### T-03 · TopBar Project menu
**WP target**: WP-UI-A03 · **Source**: §32 V03 + V10 · **Status**: open

The "BIM AI seed" pill in `TopBar.tsx` is a label, not a menu trigger. Empty-state copy still refers to a "Project menu" that doesn't exist on the redesigned chrome.

**Next moves**:
1. Build a project-name dropdown per spec §11.1: chevron next to the pill opens a popover with: recent projects (last 5, from localStorage), "New project" (clear store + bootstrap), "Open snapshot from disk" (file picker → `hydrateFromSnapshot`), "Save snapshot to disk" (download).
2. Update the §25 `canvas-empty` copy to reference this menu by name (or the existing W hotkey + "Insert seed house" CTA).

### T-04 · Re-capture Playwright baselines
**WP target**: WP-UI-H01 · **Source**: chat thread after `dddda700` · **Status**: open

Baselines in `packages/web/e2e/__screenshots__/ui-redesign-baselines.spec.ts/darwin/` were captured before:
- The canvas-full-bleed fix (V01)
- The 3D ViewCube replacement (V04)
- The TabBar addition (V15)

The current 7 PNGs are stale; CI diff will fail.

**Next moves**:
```sh
cd packages/web && pnpm exec playwright test --update-snapshots
```
Visually verify the new PNGs look right, then commit.

---

## Medium (deferred from earlier WPs, called out in commits but not in spec)

---

## §28 WP-UI rows — table-level audit

Every row in §28 is `partial`. The §4 done-rule (real surface adoption + a11y + WCAG + reduced-motion + Playwright baseline + lucide-only + tokens-only) is not yet met for any. This is intentional — the redesign is shippable in its current state. Closing each row toward `done` is its own sweep, tracked separately when one is scheduled.

If you start a `partial → done` sweep, list the rows you're targeting *here* under a new "## Sweep: <name>" heading, then move closed rows to §6 (Sprint Ledger).

---

## How to add a new task

1. Append a new `### T-NN · Title` heading at the end of the relevant section.
2. Fill: WP target / Source / Status, then a 1-paragraph "what" + a "Next moves" sub-list.
3. If it's user-visible, also add a row in spec §32. Otherwise just here.
4. Once closed, **delete the heading from this file** and add a row in spec §6 (Sprint Ledger) with the closing commit.
