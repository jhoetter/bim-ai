# Agent Prompt 5: Agent Evidence Artifacts And Collaboration Follow-Through

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Close more of the agent review loop after `evidenceLifecycleSignal_v1`: staged artifact URL placeholders, BCF/issue roundtrip checks, diff threshold policy metadata, and collaboration conflict summaries that Agent Review can act on. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-A02` Evidence package API
- `WP-F02` Agent review UI
- `WP-F03` Automated evidence comparison
- `WP-X04` BCF export/import
- `WP-P02` Collaboration model

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/evidence-artifacts-collab-followthrough
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/evidence_manifest.py`
   - agent review and evidence loop helpers
   - `app/bim_ai/engine.py`
   - `packages/web/src/workspace/AgentReviewPane.tsx`
   - evidence, BCF, collaboration, and Agent Review tests

## File Ownership Rules

Do not reshape sheet viewport evidence owned by Prompt 1. Avoid broad `Workspace.tsx` edits; prefer `AgentReviewPane.tsx` or isolated child components. If touching `evidence_manifest.py`, keep changes to artifact lifecycle, diff policy, BCF links, or collaboration summaries.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/evidence_manifest.py`
- agent evidence review loop helpers
- BCF/issue evidence link summaries
- collaboration conflict/replay diagnostic summaries that already exist
- `packages/web/src/workspace/AgentReviewPane.tsx` or isolated components
- focused backend and web tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement external artifact storage.
- Do not change sheet viewport projection/export behavior.
- Do not change IFC import/replay semantics.
- Do not implement multiplayer persistence.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic artifact/collaboration follow-through signal that agents can consume programmatically.
- Tie Agent Review guidance to exact evidence rows, BCF/issue links, diff policy metadata, or conflict diagnostics.
- Keep digest semantics clear when derivative summaries are excluded.
- Add backend tests and, where practical, a focused web assertion.
- Document staged artifact and automated fix-loop blockers in the tracker.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_evidence* tests/test_agent* tests/test_undo_replay_constraint.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test -- AgentReview
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-A02`, `WP-F02`, `WP-F03`, `WP-X04`, and `WP-P02`. Include exact manifest keys, UI paths, evidence rows, BCF/collaboration links, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(evidence): add artifact collaboration followthrough

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, evidence/collaboration behavior added, tracker rows updated, validation results, and shared-file merge risks.
