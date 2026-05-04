# Agent Prompt 2: Sheet Drag/Drop, Viewport Crop, And Export Fidelity

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Move sheets beyond titleblock replay into authoring fidelity: drag/drop or direct-manipulation viewport placement, viewport crop/scale metadata, and deterministic SVG/PNG/PDF evidence. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- `WP-X01` JSON snapshot and command replay
- Light `WP-A03` Playwright evidence baselines, only if stable sheet evidence changes

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/sheet-dragdrop-export
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/sheet_preview_svg.py`
   - `app/bim_ai/sheet_preview_pdf.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/workspace/SheetCanvas.tsx`
   - `packages/web/src/workspace/sheetViewportAuthoring.tsx`
   - `packages/web/src/workspace/sheetTitleblockAuthoring.tsx`

## Allowed Scope

Prefer changes in:

- replayable sheet viewport commands and `viewportsMm` metadata
- sheet preview/export helpers in `app/bim_ai/sheet_preview_svg.py` and `app/bim_ai/sheet_preview_pdf.py`
- `packages/web/src/workspace/SheetCanvas.tsx`
- `packages/web/src/workspace/sheetViewportAuthoring.tsx`
- focused tests under `app/tests/test_upsert_sheet_viewports.py`, `app/tests/test_golden_exchange_fixture.py`, and `packages/web/src/workspace/*.test.ts`
- Playwright sheet assertions and baselines only when visual changes are intentional and stable
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not redesign plan, section, or schedule derivation.
- Do not change Agent Review evidence package contracts except sheet artifact names if necessary.
- Do not implement a full print service beyond deterministic preview/export fidelity.
- Do not change room or OpenBIM semantics.
- Do not open a PR.

## Implementation Checklist

- Add one narrow sheet authoring/export slice, such as viewport drag/drop, viewport crop box editing, viewport scale/title metadata, or sheet SVG/PDF parity for titleblock fields.
- Preserve command replay and snapshot determinism.
- Add backend replay/export tests and web unit or Playwright evidence.
- Avoid broad screenshot layout churn.
- Document remaining print/export blockers in the tracker.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_upsert_sheet_viewports.py tests/test_golden_exchange_fixture.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/golden-bundle-plan.spec.ts e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-E05`, `WP-E06`, `WP-X01`, and maybe `WP-A03`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include exact tests, evidence files, and export limits.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sheets): improve viewport authoring export fidelity

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, sheet behavior added, tracker rows updated, validation results, and any screenshot/export baseline risks.
