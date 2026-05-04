# Agent Prompt 3: Roof, Stair, And Layered Geometry Fidelity

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Improve one bounded physical-geometry path for production Revit parity: roofs, stairs, floor/wall layers, or material cut bands proven across at least two surfaces. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B03` Floors/slabs and slab openings
- `WP-B04` Roofs
- `WP-B05` Stairs
- `WP-D05` Materials/layer catalogs
- `WP-E03` 3D geometry fidelity
- Light `WP-X02` glTF export, only when proving mesh parity

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/roof-stair-layer-fidelity
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/cut_solid_kernel.py`
   - `app/bim_ai/export_gltf.py`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `app/bim_ai/type_material_registry.py`
   - `packages/web/src/Viewport.tsx`
   - `packages/web/src/plan/symbology.ts`

## Allowed Scope

Prefer changes in:

- bounded roof/stair/layer fields in `app/bim_ai/elements.py` and `app/bim_ai/commands.py`
- geometry helpers in `app/bim_ai/cut_solid_kernel.py`
- glTF mesh output in `app/bim_ai/export_gltf.py`
- plan/section projection consumers in `app/bim_ai/plan_projection_wire.py` and `app/bim_ai/section_projection_primitives.py`
- material/layer helper data in `app/bim_ai/type_material_registry.py`
- focused tests under `app/tests/test_export_gltf.py`, `app/tests/test_cut_solid_kernel.py`, `app/tests/test_plan_projection_and_evidence_slices.py`, and `app/tests/test_golden_exchange_fixture.py`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not change IFC semantics unless a tiny skip/manifest compatibility update is unavoidable.
- Do not change sheet authoring or Agent Review UI.
- Do not attempt broad arbitrary boolean geometry.
- Do not update visual baselines unless the chosen geometry is intentionally visible and stable.
- Do not open a PR.

## Implementation Checklist

- Pick exactly one narrow geometry improvement, for example roof overhang/ridge proxy, stair treads in plan and 3D, layered wall/floor cut bands, or material hatch metadata.
- Prove the improvement across at least two surfaces: plan, section, 3D/glTF, validation, or schedule/material display.
- Add focused tests for the bounded fixture.
- Preserve existing geometry manifests unless intentionally updated and tested.
- Document remaining geometry blockers in the tracker.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_cut_solid_kernel.py tests/test_export_gltf.py tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely a subset of `WP-B03`, `WP-B04`, `WP-B05`, `WP-D05`, `WP-E03`, and `WP-X02`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Be precise about which geometry is real and which remains proxy.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): add bounded roof stair layer slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, chosen geometry slice, surfaces proven, tracker rows updated, validation results, and any OpenBIM handoff notes.
