# Agent Prompt 4: OpenBIM And IDS Inspection Matrix

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Extend OpenBIM read-back and IDS-style inspection from smoke tests into a clearer matrix for exported IFC semantics, cleanroom metadata, Psets/QTOs, spaces, openings, and mismatch advisories. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X03` IFC export/import
- `WP-X05` IDS validation
- `WP-D06` Cleanroom metadata and IDS
- `WP-X04` BCF export/import, only if issue/advisory packaging naturally fits
- Related `WP-V01`, only advisor rules directly tied to OpenBIM/IDS mismatches

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/openbim-inspection
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `spec/ifc-export-wp-x03-slice.md`
   - `spec/openbim-compatibility.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/export_gltf.py`, manifest only
   - `app/bim_ai/constraints.py`, exchange/IDS rules only
   - `app/tests/test_export_ifc.py`
   - `app/tests/test_export_ifc_door_material_readback.py`
   - `app/tests/test_exchange_ifc_geometry_skips_advisory.py`
   - `app/tests/test_ids_enforcement.py`

## Allowed Scope

Prefer changes in:

- `app/bim_ai/export_ifc.py`
- `app/bim_ai/constraints.py`, exchange/IDS/OpenBIM advisory rules only
- `app/bim_ai/export_gltf.py`, only if syncing manifest parity keys
- `app/tests/test_export_ifc*.py`
- `app/tests/test_exchange_ifc_geometry_skips_advisory.py`
- `app/tests/test_ids_enforcement.py`
- `app/tests/test_golden_exchange_fixture.py`, only exchange assertions
- `spec/ifc-export-wp-x03-slice.md`
- `spec/openbim-compatibility.md`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not build full IFC import/replay unless a tiny inspection helper is enough.
- Do not implement broad geometry booleans; geometry fidelity is owned by another agent.
- Do not change schedule UI, sheet viewport authoring, or Agent Review UI.
- Do not change room programme UI, except to inspect exported space metadata.
- Do not open a PR.

## Implementation Checklist

- Add or extend an inspection matrix for exported IFC semantics:
  - levels/storeys;
  - walls/openings;
  - spaces/room metadata;
  - Psets/QTOs;
  - cleanroom fields;
  - known skipped/proxy geometry advisories.
- Keep IFC/glTF manifest parity checks coherent if keys change.
- Add focused tests that pass even when optional `ifcopenshell` is unavailable where the repo pattern requires skips.
- Update docs/specs only for actual behavior, not aspirational scope.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_export_ifc.py tests/test_export_ifc_door_material_readback.py tests/test_exchange_ifc_geometry_skips_advisory.py tests/test_ids_enforcement.py
```

Then run, if practical:

```bash
cd app && pytest
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-X03`, `WP-X05`, `WP-D06`, and maybe `WP-V01`/`WP-X04`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Explicitly list what the inspection matrix covers and what remains out of scope.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): extend IFC IDS inspection matrix

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, matrix coverage, tracker rows updated, validation results, and any geometry handoff notes.
