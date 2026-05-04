# Agent Prompt 3: Geometry Joins And Layered Assembly Fidelity

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Improve physical fidelity for one bounded geometry family: wall joins and/or layered wall, floor, or roof assembly evidence with deterministic cut, glTF, and schedule behavior. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-B04` Roofs
- `WP-D04` Family/type registry and propagation
- `WP-D05` Materials/layer catalogs
- light `WP-X02` glTF export

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/geometry-joins-layered-assemblies
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/cut_solid_kernel.py`
   - `app/bim_ai/export_gltf.py`
   - material/type registry helpers
   - roof/floor/wall geometry helpers
   - existing material assembly, cut kernel, glTF, roof, and slab tests

## File Ownership Rules

Own bounded geometry and assembly evidence only. Avoid IFC import/export and avoid broad new schemas unless a tiny optional field is required and fully replay-tested. Do not touch room derivation, validation breadth, or section documentation UI.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/cut_solid_kernel.py` or adjacent geometry helpers
- `app/bim_ai/export_gltf.py`
- material/type registry helpers
- focused geometry and material assembly tests
- focused glTF evidence tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not solve all joins, all roof forms, or all material assemblies.
- Do not change IFC semantics.
- Do not add broad command schemas without replay tests.
- Do not change visual baselines unless a deterministic geometry fixture requires it.
- Do not open a PR.

## Implementation Checklist

- Pick one bounded fidelity slice, such as simple wall join evidence, layered floor/wall offsets in cut/glTF, or roof assembly material hints.
- Keep geometry deterministic and fixture-driven.
- Align any schedule/material evidence with the chosen geometry slice.
- Add tests for the selected slice and for unchanged behavior outside the slice.
- Update tracker rows with exact implemented geometry family, tests, and remaining physical-fidelity blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_cut* tests/test_export_gltf.py tests/test_material_assembly_schedule.py tests/test_roof*
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B02`, `WP-B03`, `WP-B04`, `WP-D04`, `WP-D05`, and any affected `WP-X02` evidence. Add a Recent Sprint Ledger entry naming the exact geometry/assembly slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): add join assembly fidelity slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, geometry/assembly behavior added, tracker rows updated, validation results, and shared-file merge risks.
