# Agent Prompt 8: Evidence Artifact Ingestion And Pixel Diff Closure

## Mission

You are Agent 8 of the next parallel BIM AI parity batch. Move Agent Review closer to a closed production loop by adding one deterministic artifact ingestion, stale/missing screenshot, or pixel-diff metadata slice that guides regeneration without changing export semantics. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-A02` Evidence package API
- `WP-A03` Playwright evidence baselines
- `WP-A04` CI verification gates
- `WP-F02` Agent review UI
- `WP-F03` Automated evidence comparison
- light `WP-X04` BCF export/import

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/evidence-artifact-ingestion-pixel-diff
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/agent_evidence_review_loop.py`
   - `app/bim_ai/agent_review.py`
   - `packages/web/src/workspace/AgentReviewPane.tsx`
   - `packages/web/e2e/evidence-baselines.spec.ts`
   - `.github/workflows/ci.yml`
   - existing evidence/Agent Review tests

## File Ownership Rules

Own evidence ingestion/review-loop metadata only. Avoid sheet raster implementation, schedule engine, OpenBIM replay, geometry kernels, room legends, and broad UI rewrites.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/evidence_manifest.py`
- `app/bim_ai/agent_evidence_review_loop.py`
- `app/bim_ai/agent_review.py`
- focused evidence tests
- `packages/web/src/workspace/AgentReviewPane.tsx`
- `packages/web/src/workspace/agentReviewActions.test.ts`
- `packages/web/e2e/evidence-baselines.spec.ts`
- `.github/workflows/ci.yml` only for deterministic hint output
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement external artifact storage.
- Do not change sheet export/raster generation.
- Do not change schedules, IFC, or geometry.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic artifact ingest or pixel-diff metadata signal with stable keys and digest semantics.
- Connect the signal to Agent Review guidance or a targeted action row.
- Keep derivative summaries excluded from semantic digests when appropriate.
- Add backend tests and a focused web/Playwright assertion if UI changes.
- Update tracker rows with exact manifest keys, UI path, tests, and remaining closure blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_evidence* tests/test_agent*
cd packages/web && pnpm exec vitest run src/workspace && pnpm exec playwright test e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-A02`, `WP-A03`, `WP-A04`, `WP-F02`, `WP-F03`, and any narrow `WP-X04` evidence. Add a Recent Sprint Ledger entry describing the evidence ingestion/pixel diff slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(evidence): add artifact ingestion pixel diff slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, evidence-loop behavior added, tracker rows updated, validation results, and shared-file merge risks.
