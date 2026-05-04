# Agent Prompt 4: Print Raster Service And Evidence Artifact Pipeline

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Push beyond SVG/PDF listing hints toward deterministic raster/print artifact handling: server SVG-to-PNG pathway or a controlled raster placeholder contract, artifact URLs/placeholders, diff ingestion metadata, and CI/evidence correlation. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E06` Sheets/print/export
- `WP-A02` Agent review/evidence package
- `WP-A03` Evaluation harness
- `WP-A04` Collaboration follow-through
- `WP-F03` Cloud artifact persistence and traceability

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/print-raster-evidence-artifacts
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/sheet_preview_svg.py`
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/agent_review.py`
   - `packages/web/src/workspace/AgentReviewPane.tsx`
   - relevant Playwright evidence specs
   - `.github/workflows/ci.yml`

## File Ownership Rules

Avoid changing plan projection logic owned by prior sheet crop work. Coordinate mentally with the plan/view prompt if visual baselines are touched. Do not change schedule quantity logic or IFC import/replay behavior.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/sheet_preview_svg.py`
- print artifact helper modules, if already present
- `app/bim_ai/evidence_manifest.py`, for artifact metadata only
- focused evidence manifest and sheet preview tests
- Playwright evidence specs and CI correlation hints
- `packages/web/src/workspace/AgentReviewPane.tsx`, only for artifact/diff display
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement a full print server or general rendering farm.
- Do not change plan projection crop semantics.
- Do not introduce non-deterministic image generation in tests.
- Do not expand collaboration workflow beyond artifact metadata/follow-through evidence.
- Do not open a PR.

## Implementation Checklist

- Add either a deterministic SVG-to-PNG pathway or a clearly versioned raster placeholder contract suitable for offline CI.
- Attach artifact URLs/placeholders and diff ingestion metadata to evidence manifests.
- Surface artifact/diff evidence in the agent review UI only as needed.
- Add tests that prove deterministic artifact metadata, manifest correlation, and CI evidence hints.
- Update tracker rows with implemented artifact behavior and remaining print/raster blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests
pnpm exec vitest run src/workspace
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-E06`, `WP-A02`, `WP-A03`, `WP-A04`, and `WP-F03`. Add a Recent Sprint Ledger entry describing the raster/artifact contract, tests, and any remaining production print service blockers.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(evidence): add print raster artifact pipeline

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, raster/artifact behavior added, tracker rows updated, validation results, and shared-file merge risks.
