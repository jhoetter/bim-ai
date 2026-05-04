# Agent Prompt 5: Performance And Collaboration Scale Proof

## Mission

You are Agent 5 of the next parallel BIM AI parity batch. Raise confidence on large models and scoped collaboration by adding larger deterministic fixtures, incremental or worker-friendly derivation diagnostics, and conflict/replay evidence without broad UI rewrites. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-P01` Browser performance budget
- `WP-P02` Collaboration model
- `WP-X01` JSON snapshot and command replay
- light `WP-A04` CI verification gates

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/performance-collaboration-scale-proof
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/summary.py`
   - performance tests and cockpit smoke tests
   - undo/redo/replay diagnostics tests
   - CI workflow timing hints if thresholds change

## File Ownership Rules

Own scale diagnostics, performance tests, and collaboration replay evidence. Avoid schedule derivation, IFC replay, room derivation, geometry kernels, and visual rendering baselines except for timing evidence.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/summary.py` or model summary/regeneration diagnostics helpers
- `app/bim_ai/engine.py`, only for diagnostics or replay evidence
- performance and collaboration tests
- cockpit smoke timing thresholds if justified by deterministic evidence
- CI evidence hints only if timing evidence changes
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement multiplayer persistence.
- Do not rewrite command execution.
- Do not change model semantics or schedule/IFC behavior.
- Do not add flaky timing requirements without local and CI margins.
- Do not open a PR.

## Implementation Checklist

- Add one larger deterministic fixture or replay workload that exercises scale without relying on external services.
- Add or refine diagnostics that would support incremental/worker-friendly derivation later.
- Add one collaboration/conflict replay evidence improvement with stable output.
- Keep timing thresholds conservative and documented.
- Add tests that are deterministic and suitable for CI.
- Update tracker rows with exact workload size, timing/diagnostic evidence, and remaining collaboration blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_*performance* tests/test_*diagnostic* tests/test_undo_replay_constraint.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-P01`, `WP-P02`, `WP-X01`, and any affected `WP-A04` evidence. Add a Recent Sprint Ledger entry with the fixture size, timing evidence, and collaboration/replay diagnostics.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(perf): add collaboration scale proof

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, scale/collaboration behavior added, tracker rows updated, validation results, and shared-file merge risks.
