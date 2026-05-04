# Agent Prompt 7: OpenBIM Authoritative Merge Replay And IDS Advisor Slice

## Mission

You are Agent 7 of the next parallel BIM AI parity batch. Turn the current OpenBIM import replay sketch into one narrow authoritative merge/replay or IDS advisor slice: apply a constrained IFC-derived command sketch, or produce deterministic IDS mismatch advisories that map directly to replayable quick-fix evidence. Do not open a pull request. Commit and push only your branch.

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
   git switch -c agent/openbim-merge-replay-ids-advisor
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/ifc_stub.py`
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/engine.py`
   - `spec/ifc-export-wp-x03-slice.md`
   - existing IFC, IDS, manifest, and constraint tests

## File Ownership Rules

Own OpenBIM/IDS replay evidence only. Avoid geometry kernels, schedule UI, sheet export/raster, room derivation, and level constraints. If engine replay is touched, keep it constrained to existing command vocabulary and explicit tests.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/export_ifc.py`
- `app/bim_ai/ifc_stub.py`
- `app/bim_ai/evidence_manifest.py`
- `app/bim_ai/constraints.py`, only for OpenBIM/IDS advisories
- `app/bim_ai/engine.py`, only for applying a narrowly supported command sketch if needed
- `app/tests/test_export_ifc.py`
- `app/tests/test_ifc_exchange_manifest_offline.py`
- focused IDS/constraint tests
- `spec/ifc-export-wp-x03-slice.md`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement arbitrary IFC document merge.
- Do not add native RVT bridge behavior.
- Do not rewrite exporter geometry.
- Do not introduce networked IDS services.
- Do not open a PR.

## Implementation Checklist

- Add one constrained authoritative OpenBIM replay step or IDS advisor mapping:
  - apply a safe subset of `authoritativeReplay_v0` commands to an empty document, or
  - emit deterministic IDS mismatch advisories with replayable quick-fix/evidence pointers.
- Keep unsupported IFC products explicitly counted and reported.
- Preserve existing offline behavior when IfcOpenShell is unavailable.
- Add tests for the supported path and the skipped/unsupported path.
- Update `spec/ifc-export-wp-x03-slice.md` if the exported/imported contract changes.
- Update tracker rows with exact keys, command subset/advisor IDs, tests, and remaining OpenBIM blockers.

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

Update `WP-X03`, `WP-X05`, `WP-D06`, `WP-X01`, and any narrow `WP-V01` evidence. Add a Recent Sprint Ledger entry describing the OpenBIM replay/IDS advisor slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): add authoritative replay ids advisor slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, OpenBIM behavior added, tracker rows updated, validation results, and shared-file merge risks.
