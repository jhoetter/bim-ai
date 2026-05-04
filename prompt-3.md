# Agent Prompt 3: Materials And Type Propagation Catalog Depth

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Make materials/types less shallow by adding one production-grade propagation slice: wall, floor, or roof assembly material metadata, cut-pattern/export evidence, or type schedule parity. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D04` Family/type registry and propagation
- `WP-D05` Materials/layer catalogs
- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-B04` Roofs
- light `WP-X02` glTF export

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/materials-type-propagation-depth
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - builtin material/type registry helpers
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/export_gltf.py`
   - existing material assembly and type propagation tests
   - existing glTF material/evidence tests

## File Ownership Rules

Own material/type propagation and evidence only. Avoid broad new schemas unless the field is tiny, replayable, and tested through command/snapshot/export. Do not touch IFC import/export, schedule UI, evidence loops, or roof/stair geometry owned by Prompt 6.

## Allowed Scope

Prefer changes in:

- builtin material/type registry helpers
- `app/bim_ai/schedule_derivation.py`, only for material/type schedule evidence
- `app/bim_ai/export_gltf.py`, only for material evidence metadata if needed
- focused material assembly and type propagation tests
- focused glTF evidence tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement a full material editor.
- Do not change IFC semantics.
- Do not alter stair/roof geometry beyond material evidence for the chosen slice.
- Do not add broad command schemas without replay tests.
- Do not open a PR.

## Implementation Checklist

- Pick one bounded material/type propagation slice and document it in tests.
- Ensure schedule/export evidence reflects the chosen material/type data.
- Preserve existing wall/floor type propagation behavior.
- Add tests for propagation, schedule evidence, and export evidence if touched.
- Update tracker rows with exact catalog/type behavior and remaining material blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_material_assembly_schedule.py tests/test_export_gltf.py tests/test_schedule*
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-D04`, `WP-D05`, `WP-B02`, `WP-B03`, `WP-B04`, and any affected `WP-X02` evidence. Add a Recent Sprint Ledger entry naming the material/type propagation slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(materials): deepen type propagation evidence

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, material/type behavior added, tracker rows updated, validation results, and shared-file merge risks.
