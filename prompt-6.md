# Agent Prompt 6: Roof And Stair Production Geometry Slice

## Mission

You are Agent 6 of the next parallel BIM AI parity batch. Improve one visible roof/stair production geometry path: stair landings/headroom/opening evidence or roof plane/overhang/ridge evidence, with plan, section, and glTF consistency. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B04` Roofs
- `WP-B05` Stairs
- `WP-E03` 3D geometry fidelity
- `WP-E04` Section/elevation views
- `WP-X02` glTF export
- light `WP-V01` Validation/advisor expansion

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/roof-stair-production-geometry
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - roof/stair geometry helpers
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/export_gltf.py`
   - existing roof, stair, section, glTF, and validation tests
   - focused web rendering tests if plan/section UI changes

## File Ownership Rules

Own roof/stair geometry and evidence only. Avoid material catalog changes owned by Prompt 3 and avoid IFC export/import. If touching `export_gltf.py`, coordinate by limiting changes to roof/stair geometry evidence rather than material metadata.

## Allowed Scope

Prefer changes in:

- roof/stair geometry helpers
- `app/bim_ai/section_projection_primitives.py`, only for roof/stair section evidence
- `app/bim_ai/export_gltf.py`, only for roof/stair geometry evidence
- roof/stair pytest
- focused Vitest if web rendering changes
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not solve all roof forms or full stair modeling.
- Do not change material catalog propagation.
- Do not touch IFC import/export.
- Do not rewrite plan/section rendering broadly.
- Do not open a PR.

## Implementation Checklist

- Pick one visible production geometry slice: stair landing/headroom/opening evidence or roof plane/overhang/ridge evidence.
- Ensure plan, section, and glTF evidence agree for the chosen slice.
- Add validation only if directly tied to the selected geometry issue.
- Add deterministic tests for the geometry and export/section evidence.
- Update tracker rows with exact geometry behavior and remaining roof/stair blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_roof* tests/test_stair* tests/test_section* tests/test_export_gltf.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-B04`, `WP-B05`, `WP-E03`, `WP-E04`, `WP-X02`, and any narrow `WP-V01` evidence. Add a Recent Sprint Ledger entry describing the roof/stair production geometry slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): add roof stair production slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, roof/stair behavior added, tracker rows updated, validation results, and shared-file merge risks.
