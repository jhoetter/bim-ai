# Agent Prompt 3: Hosted Openings, Joins, And Cut Solid Fidelity

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Deepen kernel fidelity for hosted openings and joins with one bounded evidenced slice: non-orthogonal openings, rough opening/reveal evidence, better cut solids, or slab/wall join behavior with glTF/section evidence. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-E03` 3D geometry fidelity
- `WP-X02` glTF export
- light `WP-D05` Materials/layer catalogs

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/hosted-openings-cut-solid-fidelity
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/opening_cut_primitives.py`
   - `app/bim_ai/cut_solid_kernel.py`
   - `app/bim_ai/export_gltf.py`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/elements.py`
   - existing opening, cut-solid, section, and glTF tests

## File Ownership Rules

This is the only schema-adjacent geometry lane in this wave. If persisted fields are required, keep them narrow and isolated. Do not change sheet crop projection, validation advisor rules, IFC import semantics, or evidence artifact lifecycle fields.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/opening_cut_primitives.py`
- `app/bim_ai/cut_solid_kernel.py`
- `app/bim_ai/export_gltf.py`
- `app/bim_ai/section_projection_primitives.py`
- geometry helper modules and focused tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not redesign the full geometry kernel.
- Do not add broad new command families.
- Do not change schedule UI.
- Do not change IFC import/replay behavior.
- Do not open a PR.

## Implementation Checklist

- Add one bounded fidelity improvement for hosted openings, joins, rough openings/reveals, or slab/wall cuts.
- Prove the output is more than a proxy marker using glTF, section primitives, or cut-solid tests.
- Keep fixture geometry deterministic and small.
- Preserve existing axis-aligned slab opening behavior.
- Document remaining true boolean and join blockers in the tracker.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_opening_cut_primitives.py tests/test_cut_solid_kernel.py tests/test_export_gltf.py tests/test_section* tests/test_plan_projection_and_evidence_slices.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-B02`, `WP-B03`, `WP-E03`, `WP-X02`, and maybe `WP-D05`. Include exact geometry scenario, evidence path, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): deepen hosted opening cut fidelity

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, geometry behavior added, evidence paths, tracker rows updated, validation results, and shared-file merge risks.
