# Agent Prompt 6: Layered Assembly Cut Solids And Join Fidelity

## Mission

You are Agent 6 of the next parallel BIM AI parity batch. Deepen physical geometry fidelity by adding one bounded layered wall/floor/roof assembly cut-solid or join-fidelity slice that aligns section, glTF/export evidence, and existing type/material metadata. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-B04` Roofs
- `WP-D05` Materials/layer catalogs
- `WP-E03` 3D geometry fidelity
- `WP-X02` glTF export

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/layered-assembly-cut-solids-joins
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/cut_solid_kernel.py`
   - `app/bim_ai/opening_cut_primitives.py`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/export_gltf.py`
   - `app/bim_ai/material_assembly_resolve.py`
   - `app/bim_ai/wall_join_evidence.py`
   - existing geometry/material/glTF tests

## File Ownership Rules

Own geometry/material evidence only. Avoid schedules UI, room legends, sheet raster, OpenBIM replay, validation bundles, and broad web UI changes.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/cut_solid_kernel.py`
- `app/bim_ai/opening_cut_primitives.py`
- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/export_gltf.py`
- `app/bim_ai/material_assembly_resolve.py`
- `app/bim_ai/wall_join_evidence.py`
- focused geometry/material/export tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement arbitrary full CSG.
- Do not rewrite all roof/stair geometry.
- Do not touch schedule UI, IFC replay, or sheet raster code.
- Do not open a PR.

## Implementation Checklist

- Add one bounded layered assembly or join fidelity case, such as layer-aware cut evidence, mitred/merged join evidence, or roof/floor layer export hints.
- Keep helper logic shared across section and glTF/export evidence where practical.
- Preserve existing reveal/skew/orthogonal behavior.
- Add tests for the helper and at least two downstream consumers.
- Update tracker rows with exact evidence keys, tests, and remaining geometry blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_cut_solid* tests/test_opening* tests/test_section* tests/test_export_gltf.py tests/test_material_assembly_schedule.py tests/test_wall_join*
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B02`, `WP-B03`, `WP-B04` if touched, `WP-D05`, `WP-E03`, and `WP-X02`. Add a Recent Sprint Ledger entry describing the layered geometry/join slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): add layered assembly join slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, geometry behavior added, tracker rows updated, validation results, and shared-file merge risks.
