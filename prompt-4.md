# Agent Prompt 4: IFC Import Replay And Merge Sketch

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Move OpenBIM past read-back inspection toward a narrow import/replay sketch: levels, walls, spaces, Psets/QTOs, unsupported entity reporting, and command-sketch evidence. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X03` IFC export/import
- `WP-X05` IDS validation
- `WP-D06` Cleanroom metadata and IDS
- light `WP-V01` Validation/advisor expansion

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/ifc-import-replay-sketch
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `spec/ifc-export-wp-x03-slice.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/ifc_stub.py`
   - `app/bim_ai/constraints.py`
   - IFC, IDS, and offline manifest tests

## File Ownership Rules

Keep this prompt OpenBIM-only. Avoid broad document merge behavior and do not require IfcOpenShell for offline tests. If touching validation, keep it gated to IFC/IDS/import evidence so it does not conflict with Prompt 2's broader advisor work.

## Allowed Scope

Prefer changes in:

- IFC semantic import/read-back helpers
- command-sketch output for levels, walls, spaces, Psets, or QTOs
- unsupported entity/import-scope reports
- IDS mismatch evidence derived from imported/inspected data
- optional dependency skip behavior
- `spec/ifc-export-wp-x03-slice.md` if behavior changes
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement full document merge/import replay.
- Do not change glTF or roof geometry.
- Do not change Agent Review UI.
- Do not rewrite validation advisor internals.
- Do not open a PR.

## Implementation Checklist

- Add one narrow import/replay sketch improvement, such as command sketches for inspected IFC levels/walls/spaces or Pset/QTO-driven limitations.
- Make unsupported behavior explicit and deterministic.
- Preserve existing export/read-back checks.
- Add focused tests that pass with and without IfcOpenShell where appropriate.
- Update OpenBIM docs only for actual behavior.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py tests/test_ids_enforcement.py tests/test_exchange_ifc_geometry_skips_advisory.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-X03`, `WP-X05`, `WP-D06`, and maybe `WP-V01`. Include exact import/replay sketch scope, unsupported entities, IDS checks, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): add ifc import replay sketch

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, IFC import/replay sketch behavior, tracker rows updated, validation results, optional dependency notes, and shared-file merge risks.
