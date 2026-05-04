# Agent Prompt 2: Sheet Resize Handles, Model Crop, And Print Export

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Extend sheet production beyond viewport placement: resize handles, crop metadata flowing into placed model views, and deterministic print/export evidence. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E05` Sheet composition and viewport placement
- `WP-E06` Publish/export evidence
- `WP-X01` Evidence manifest and artifact links
- light `WP-A03` Replayable command history

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/sheet-resize-print-export
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/export_bundle.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/sheet/SheetCanvas.tsx`
   - `packages/web/src/Workspace.tsx`
   - existing sheet/export tests

## Allowed Scope

Prefer changes in:

- sheet/viewport element fields and command handling for viewport size/crop data
- `SheetCanvas.tsx` pointer interactions for resize handles
- export/evidence helpers that already generate deterministic sheet artifacts
- web tests around sheet viewport manipulation and export affordances
- backend tests around replayable viewport resize/crop command effects
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement a full print dialog.
- Do not refactor unrelated evidence manifest formats.
- Do not change plan projection style semantics unless required to respect crop metadata.
- Do not change OpenBIM import/export semantics.
- Do not open a PR.

## Implementation Checklist

- Add command-backed viewport resize behavior with deterministic geometry.
- Carry model crop or viewport crop metadata through backend state and frontend rendering.
- Extend export/evidence output so reviewers can see placement, crop, and size in a deterministic artifact or manifest hint.
- Add regression coverage for resize/crop replay.
- Keep UI affordances small: one visible handle pattern or equivalent keyboard/property edit is enough.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_sheet* tests/test_evidence*
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test -- Sheet
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-E05`, `WP-E06`, `WP-X01`, and maybe `WP-A03`. Mention resize/crop command names, artifact evidence, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sheets): add viewport resize and crop export evidence

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, sheet behavior added, export/evidence artifact changes, tracker rows updated, validation results, and any shared-file merge risks.
