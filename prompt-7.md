# Agent Prompt 7: Populated IFC Merge And Opening Replay Slice

## Mission

You are Agent 7 of the next parallel BIM AI parity batch. Extend OpenBIM beyond empty-document replay by adding one constrained populated-document merge, opening replay, or richer IDS advisor slice that remains deterministic and explicitly scoped. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X03` IFC export/import
- `WP-X05` IDS validation
- `WP-D06` Cleanroom metadata and IDS
- `WP-X01` JSON snapshot and command replay
- light `WP-V01` Validation/advisor expansion

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/populated-ifc-merge-opening-replay
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/ifc_stub.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/evidence_manifest.py`
   - `spec/ifc-export-wp-x03-slice.md`
   - existing IFC/IDS/offline tests

## File Ownership Rules

Own OpenBIM replay/IDS behavior only. Avoid geometry kernels, schedules, sheet raster, room legends, and level/datums except through existing command vocabulary.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/export_ifc.py`
- `app/bim_ai/ifc_stub.py`
- `app/bim_ai/engine.py`, only for constrained replay/merge helpers
- `app/bim_ai/constraints.py`, only for OpenBIM/IDS advisories
- `app/bim_ai/evidence_manifest.py`, only for manifest evidence
- `spec/ifc-export-wp-x03-slice.md`
- focused IFC/IDS tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement arbitrary IFC graph merge.
- Do not add native RVT bridge behavior.
- Do not rewrite exporter geometry.
- Do not open a PR.

## Implementation Checklist

- Add one constrained path: populated-document safe merge guard, IFC opening replay sketch/apply, or richer IDS mismatch quick-fix evidence.
- Keep unsupported products and skipped cases explicit.
- Preserve offline behavior when IfcOpenShell is unavailable.
- Add tests for supported and unsupported/skipped paths.
- Update the IFC slice spec if the contract changes.
- Update tracker rows with exact keys, tests, and remaining OpenBIM blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py tests/test_evidence_manifest* tests/test_constraints*
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-X03`, `WP-X05`, `WP-D06`, `WP-X01`, and any narrow `WP-V01` evidence. Add a Recent Sprint Ledger entry describing the OpenBIM merge/replay slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): add populated ifc replay slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, OpenBIM behavior added, tracker rows updated, validation results, and shared-file merge risks.
