# Agent Prompt 4: Agent Review Evidence Closure Loop

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Make Agent Review more useful for closing the evidence loop: artifact manifest ingestion, stale or missing screenshot detection, pixel-diff metadata shape, regeneration guidance, and CI artifact mapping. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-A02` Evidence package API
- `WP-A04` CI verification gates
- `WP-F02` Agent review UI
- `WP-F03` Automated evidence comparison

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/evidence-closure-loop
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/routes_api.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/agent-review/AgentReviewPanel.tsx`
   - `packages/web/e2e/evidence-baselines.spec.ts`
   - `.github/workflows/ci.yml`

## Allowed Scope

Prefer changes in:

- evidence package and manifest helpers in `app/bim_ai/evidence_manifest.py`
- API response shaping in `app/bim_ai/routes_api.py`
- TypeScript evidence types in `packages/core/src/index.ts`
- Agent Review UI in `packages/web/src/agent-review/AgentReviewPanel.tsx`
- Playwright evidence probes/assertions in `packages/web/e2e/evidence-baselines.spec.ts`
- CI hint output in `.github/workflows/ci.yml`, only for artifact correlation text
- focused tests under `app/tests/test_*evidence*` and web unit/e2e tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change plan/section/sheet visual rendering except to reference existing artifact names.
- Do not regenerate screenshot baselines unless the test contract intentionally changes.
- Do not implement a full external artifact store.
- Do not change schedule, room, geometry, or OpenBIM semantics.
- Do not open a PR.

## Implementation Checklist

- Add one narrow evidence-closure feature, such as manifest upload/read shape, stale digest detection, missing artifact warnings, pixel-diff metadata placeholders, or clearer regeneration guidance.
- Ensure Agent Review can display the new metadata without breaking older evidence packages.
- Keep deterministic artifact basenames and digest semantics clear.
- Add focused backend and web tests.
- Update CI correlation hints only if they help agents map artifacts to evidence rows.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_evidence_manifest.py tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-A02`, `WP-A04`, `WP-F02`, and `WP-F03`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Document exact manifest fields and remaining artifact-store gaps.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(evidence): add agent review closure metadata

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, evidence-loop behavior added, tracker rows updated, validation results, and any CI artifact risks.
