# Agent Prompt 2: Replayable Sheet Viewports And Section Sheet Rendering

## Mission

You are Agent 2 of 5 parallel BIM AI parity agents. Advance replayable sheet viewport placement and sheet rendering, especially plan/section/schedule/3D viewport references on sheets, without owning Project Browser hierarchy, schedule engine semantics, room programme behavior, or evidence package metadata.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E04` Section/elevation views
- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- Related `WP-X01` JSON snapshot and command replay, only for viewport command replay evidence

The product invariant is: a sheet is rebuilt from canonical model commands and view references. Sheet UI state must not become a second source of truth.

## Start Procedure

1. Start from a clean and current `main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/sheet-viewports
   ```

2. Before editing, inspect:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `packages/web/src/workspace/SheetCanvas.tsx`
   - `packages/web/src/workspace/sheetViewportAuthoring.tsx`
   - `packages/web/src/workspace/sheetViewRef.ts`
   - `packages/web/src/workspace/sectionViewportSvg.tsx`
   - `packages/web/src/plan/sectionProjectionWire.ts`
   - `packages/web/e2e/evidence-baselines.spec.ts`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/plan_projection_wire.py`

3. Identify whether your slice is UI-only viewport editing or command-backed replay. Prefer command-backed replay if feasible in a focused diff.

## Allowed Scope

Prefer changes in these files:

- `packages/web/src/workspace/SheetCanvas.tsx`
- `packages/web/src/workspace/sheetViewportAuthoring.tsx`
- `packages/web/src/workspace/sheetViewRef.ts`
- `packages/web/src/workspace/sectionViewportSvg.tsx`
- `packages/web/src/plan/sectionProjectionWire.ts`
- `packages/web/e2e/evidence-baselines.spec.ts`
- `packages/web/e2e/golden-bundle-plan.spec.ts`
- `app/bim_ai/elements.py`, only for sheet viewport fields
- `app/bim_ai/commands.py`, only for sheet viewport commands
- `app/bim_ai/engine.py`, only for applying sheet viewport commands
- `app/tests/*sheet*`, `app/tests/*section*`, and focused replay tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals And Hard Boundaries

Do not take over these areas:

- Project Browser grouping beyond minimal display of viewport ref titles.
- Schedule derivation/filter/grouping behavior.
- Room programme derivation, advisor quick fixes, and room legend semantics.
- Evidence package digest or Agent Review artifact logic.
- IFC/glTF export semantics.
- General Workspace layout refactors.

If screenshot baselines change, first decide whether the visual change is intentional. If intentional, update only the affected baseline images and document the exact reason in the final report.

## Implementation Goals

Deliver a narrow production documentation slice:

1. Make sheet viewport placement replayable:
   - create or extend a command such as `upsertSheetViewports` if the existing model supports it;
   - persist `viewportsMm` with stable view refs and geometry;
   - ensure replay/roundtrip tests rebuild the same sheet.
2. Improve viewport authoring:
   - allow editing refs and positions via the existing form or minimal handles;
   - support refs such as `plan:<id>`, `section:<id>`, `schedule:<id>`, and, if already modeled, `viewpoint:<id>`.
3. Improve section-on-sheet rendering:
   - keep `sectionProjectionPrimitives_v1` as the contract;
   - render cut structure clearly without broad section graphics expansion.
4. Preserve evidence behavior:
   - `data-testid="sheet-canvas"` and full-sheet evidence paths must stay stable unless intentionally updated;
   - deterministic sheet evidence should still capture the same semantic sheet.

## Validation Commands

Run focused validation first:

```bash
cd app && ruff check bim_ai tests && pytest
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts e2e/golden-bundle-plan.spec.ts
```

Then, if time allows before committing:

```bash
pnpm verify
```

If screenshots fail, inspect whether the failure is a real regression, an intentional visual update, or a platform-baseline issue.

## Tracker Update Rules

Update `spec/revit-production-parity-workpackage-tracker.md` before committing:

- Update only rows you materially affected: likely `WP-E04`, `WP-E05`, `WP-E06`, and possibly `WP-X01`.
- Mention command replay, viewport refs, sheet evidence, and tests in `Implemented / evidence`.
- Keep remaining blockers honest: drag/drop, dimensions/tags, print/PDF fidelity, and richer section graphics likely remain unless you actually completed them.
- Do not mark a row `done` unless it satisfies the tracker Done Rule.

## Commit And Push

Commit only your focused branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sheets): replay sheet viewport placement

EOF
)"
git push -u origin agent/sheet-viewports
```

Do not push to `main`.

## Final Report

Return:

- Branch name and commit SHA.
- Which viewport refs and replay paths now work.
- Tracker rows updated.
- Validation commands run and results.
- Any screenshot baseline changes and why they are intentional.
- Merge risks with the saved-view, schedule, room, or evidence agents.
