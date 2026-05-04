# Agent Prompt 6: Non-Orthogonal Opening And Join Geometry Fidelity Slice

## Mission

You are Agent 6 of the next parallel BIM AI parity batch. Deepen geometry fidelity by adding one bounded non-orthogonal hosted opening or wall-join evidence slice that aligns cut solids, plan/section projection, and glTF/export evidence. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-E03` 3D geometry fidelity
- `WP-E04` Section/elevation views
- `WP-X02` glTF export

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/nonorthogonal-opening-join-geometry
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/opening_cut_primitives.py`
   - `app/bim_ai/cut_solid_kernel.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/export_gltf.py`
   - existing opening, wall join, section, and glTF tests

## File Ownership Rules

Own hosted opening/join geometry evidence only. Avoid schedule UI, room derivation, level constraints, sheet raster/export service, and OpenBIM IFC replay. If you touch shared projection/export files, keep the change limited to geometry evidence fields.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/opening_cut_primitives.py`
- `app/bim_ai/cut_solid_kernel.py`
- `app/bim_ai/wall_join_evidence.py` if present
- `app/bim_ai/plan_projection_wire.py`, only for geometry evidence rows
- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/export_gltf.py`
- focused backend tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement arbitrary full CSG booleans.
- Do not rewrite all wall/floor/roof geometry.
- Do not change schedule quantity semantics unless a test shows an existing geometry-QTO invariant must be preserved.
- Do not touch web UI unless type updates are strictly required.
- Do not open a PR.

## Implementation Checklist

- Add one bounded geometry fidelity case: non-orthogonal hosted opening spans, angled wall join evidence, or layered void evidence.
- Keep plan, section, cut-solid, and glTF evidence aligned through shared helper logic.
- Add deterministic manifest/projection evidence keys where useful.
- Add tests covering geometry helper output plus at least two downstream consumers.
- Preserve existing orthogonal/reveal behavior.
- Update tracker rows with exact helper names, evidence keys, tests, and remaining geometry blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_opening* tests/test_cut_solid* tests/test_section* tests/test_export_gltf.py tests/test_wall_join*
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B02`, `WP-B03` if touched, `WP-E03`, `WP-E04`, and `WP-X02`. Add a Recent Sprint Ledger entry describing the geometry fidelity slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): add non-orthogonal opening join slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, geometry behavior added, tracker rows updated, validation results, and shared-file merge risks.
