# Agent Prompt 4: Material Assemblies, Layer Quantities, And Type Propagation

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Deepen production type semantics: material assemblies on wall/floor types, type-to-instance propagation, layer quantities, and schedule/export evidence. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D04` Type catalogs and instance parameters
- `WP-D05` Material takeoff and finish data
- `WP-B02` Walls and hosted openings
- `WP-B03` Floors, roofs, and slabs
- light `WP-X02` IFC/glTF semantic export evidence

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/material-assemblies-layer-quantities
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/export_gltf.py`
   - `packages/core/src/index.ts`
   - `packages/web/src/Workspace.tsx`
   - type/material/schedule/export tests

## Allowed Scope

Prefer changes in:

- type catalog element fields for wall/floor material layers
- command handling that updates types and ensures instances resolve inherited data
- schedule derivation for material/layer quantities
- small export/manifest hints that expose resolved type/layer semantics
- frontend type/material tables or property display already present
- focused tests
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not build a complete material browser.
- Do not redesign geometry kernels.
- Do not change room schedule semantics.
- Do not implement full IFC roundtrip imports.
- Do not open a PR.

## Implementation Checklist

- Add or strengthen material layer definitions for at least one wall type and one floor/slab type path.
- Ensure instances can resolve type-inherited assembly fields deterministically.
- Derive at least one layer quantity or material takeoff row from resolved instance geometry.
- Include evidence in schedule/export/manifest output sufficient for reviewer inspection.
- Add tests for type update, instance propagation, and derived quantities.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_schedule* tests/test_export_ifc.py tests/test_export_gltf.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-D04`, `WP-D05`, `WP-B02`, `WP-B03`, and maybe `WP-X02`. Mention assembly schema, propagated values, quantity evidence, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(types): add material assemblies and layer quantity evidence

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, type/material behavior added, quantity/export evidence, tracker rows updated, validation results, and any shared-file merge risks.
