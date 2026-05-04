# Agent Prompt 5: Evidence Diff Ingestion And Agent Review Fix Loop

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Move from placeholder artifact/diff metadata toward a closed evidence review loop: stale/missing screenshot detection, ingested diff rows, issue/action targeting, and Agent Review guidance. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-F02` Agent review UI
- `WP-F03` Automated evidence comparison
- `WP-A02` Evidence package API
- `WP-A03` Playwright evidence baselines
- `WP-A04` CI verification gates
- light `WP-X04` BCF export/import

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/evidence-diff-fix-loop
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/evidence_manifest.py`
   - agent review/evidence loop helpers
   - `packages/web/src/workspace/AgentReviewPane.tsx`
   - Playwright evidence specs
   - `.github/workflows/ci.yml`

## File Ownership Rules

Own evidence diff ingestion and Agent Review guidance only. Avoid implementing external storage or real rasterization; build on the current placeholder artifact contract. Do not touch IFC replay, schedule UI, material catalogs, or geometry kernels.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/evidence_manifest.py`
- agent review/evidence loop helpers
- `packages/web/src/workspace/AgentReviewPane.tsx` or isolated child components
- Playwright evidence specs
- CI correlation hints
- focused evidence/Agent Review tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement external artifact storage.
- Do not implement real server-side SVG-to-PNG rasterization.
- Do not change OpenBIM or schedule semantics.
- Do not rewrite Agent Review UI broadly.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic stale/missing screenshot or ingested-diff signal.
- Connect that signal to Agent Review guidance or action targeting.
- Keep digest semantics clear for derivative summaries.
- Add backend tests and, where practical, a focused web or Playwright assertion.
- Update tracker rows with exact manifest keys, UI path, tests, and remaining fix-loop blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_evidence* tests/test_agent*
cd packages/web && pnpm exec vitest run src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-F02`, `WP-F03`, `WP-A02`, `WP-A03`, `WP-A04`, and any narrow `WP-X04` evidence. Add a Recent Sprint Ledger entry describing the evidence diff/fix-loop behavior.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(evidence): add diff ingestion fix loop

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, evidence/fix-loop behavior added, tracker rows updated, validation results, and shared-file merge risks.
