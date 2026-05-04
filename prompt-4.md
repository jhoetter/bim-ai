# Agent Prompt 4: OpenBIM Import And IDS Roundtrip Slice

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Extend OpenBIM from export/read-back smoke toward a narrow import/roundtrip and IDS mismatch workflow for levels, walls, spaces, Psets/QTOs, and cleanroom metadata. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X03` IFC export/import
- `WP-X05` IDS validation
- `WP-D06` Cleanroom metadata and IDS
- Light `WP-V01` Validation/advisor expansion, only for IDS/OpenBIM mismatch hooks

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/openbim-import-ids-roundtrip
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `spec/ifc-export-wp-x03-slice.md`
   - `spec/openbim-compatibility.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/constraints.py`
   - `app/bim_ai/routes_api.py`
   - `app/tests/test_export_ifc.py`
   - `app/tests/test_ifc_exchange_manifest_offline.py`
   - `app/tests/test_ids_enforcement.py`

## Allowed Scope

Prefer changes in:

- new narrow import/read-back helpers under `app/bim_ai/` if needed
- `app/bim_ai/export_ifc.py` for semantic inspection matrix extensions
- `app/bim_ai/constraints.py` for IDS/OpenBIM advisory hooks only
- `app/bim_ai/routes_api.py` for a small API or manifest entry only if required
- focused tests under `app/tests/test_export_ifc*.py`, `app/tests/test_ifc_exchange_manifest_offline.py`, `app/tests/test_ids_enforcement.py`, and new import/read-back tests
- `spec/ifc-export-wp-x03-slice.md`
- `spec/openbim-compatibility.md`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not build broad IFC import/replay for all entity classes.
- Do not change roof/stair/geometry booleans.
- Do not change schedule UI, sheet authoring, or Agent Review UI.
- Do not require `ifcopenshell` for tests that are meant to pass in offline environments; follow existing skip patterns.
- Do not open a PR.

## Implementation Checklist

- Add one narrow OpenBIM intake or roundtrip feature, such as an IFC semantic import summary, read-back-to-command sketch for levels/walls/spaces, IDS mismatch rows from inspected Psets, or manifest coverage for import limitations.
- Keep optional dependency behavior clear and tested.
- Add focused tests that document available vs skipped behavior.
- Update OpenBIM docs only for actual behavior.
- Keep IFC/glTF manifest parity coherent if keys change.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py tests/test_ids_enforcement.py
```

Then run, if practical:

```bash
cd app && pytest
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-X03`, `WP-X05`, `WP-D06`, and maybe `WP-V01`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Explicitly list import/read-back scope and unsupported entities.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): add narrow IFC import IDS roundtrip slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, import/read-back coverage, tracker rows updated, validation results, and any geometry or IDS handoff notes.
