# Agent Prompt 5: Validation Advisor Expansion And Quick-Fix Bundles

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Expand the validation/advisor system toward PRD section 11: blocking classes, schedule/sheet linkage checks, quick-fix command bundles, and user-facing severity/status surfacing. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-V01` Validation/advisor expansion
- `WP-P02` Collaboration model, only scoped undo/conflict feedback around advisor fixes
- Light `WP-D03` Schedule UI, only for schedule-link validation display
- Light `WP-E05` Sheet canvas and titleblock, only for sheet-link validation display
- Light `WP-X01` JSON snapshot and command replay, only for quick-fix bundle replay tests

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/validation-quickfix-bundles
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/routes_api.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/Workspace.tsx`
   - `packages/web/src/state/store.ts`
   - `packages/web/src/advisor/perspectiveFilter.ts`

## Allowed Scope

Prefer changes in:

- validation rules and quick-fix payloads in `app/bim_ai/constraints.py`
- command replay or undo handling in `app/bim_ai/engine.py`, only where required for quick-fix bundles
- API/advisor shaping in `app/bim_ai/routes_api.py`
- TypeScript advisor types in `packages/core/src/index.ts`
- advisor/status UI in `packages/web/src/Workspace.tsx`, `packages/web/src/state/store.ts`, and `packages/web/src/advisor/*`
- focused tests under `app/tests/test_constraints_*`, `app/tests/test_undo_replay_constraint.py`, and web advisor tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement full multiplayer persistence or conflict resolution.
- Do not change room derivation, schedule definitions, or sheet authoring except to validate existing links.
- Do not change OpenBIM export/import semantics.
- Do not update visual baselines unless a stable advisor display intentionally changes.
- Do not open a PR.

## Implementation Checklist

- Add one narrow validation class or quick-fix bundle, such as orphan schedule/sheet references, invalid view refs, room programme mismatch fix bundles, hosted-opening severity classes, or stale document evidence warnings.
- Ensure violations include stable codes, severity, affected element ids, and replayable fix commands where appropriate.
- Surface the new advisor state in the web without broad layout churn.
- Add focused backend tests and at least one web unit or e2e assertion if UI changes.
- Keep quick-fix behavior deterministic and undo-aware.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_constraints_room_programme_consistency.py tests/test_undo_replay_constraint.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-V01`, `WP-P02`, and maybe `WP-D03`, `WP-E05`, or `WP-X01`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Include exact violation codes and quick-fix command coverage.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(validation): add advisor quick-fix bundle slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, validation class or quick-fix added, tracker rows updated, validation results, and any collaboration/undo risks.
