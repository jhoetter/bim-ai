# Agent Prompt 3: Geometry Fidelity Spine

## Mission

You are Agent 3 of the next parallel BIM AI parity batch. Improve one high-leverage geometry fidelity path that benefits at least two surfaces, such as plan + section, section + glTF, or glTF + validation. Keep scope narrow and fixture-driven. Do not open a pull request. Commit and push only the branch you work on.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-B04` Roofs
- `WP-B05` Stairs
- `WP-E03` 3D geometry fidelity
- `WP-X02` glTF export, only when proving visual geometry parity

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/geometry-fidelity
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/cut_solid_kernel.py`
   - `app/bim_ai/opening_cut_primitives.py`
   - `app/bim_ai/export_gltf.py`
   - `app/bim_ai/section_projection_primitives.py`
   - `app/bim_ai/plan_projection_wire.py`
   - `packages/web/src/plan/symbology.ts`

## Allowed Scope

Prefer changes in:

- `app/bim_ai/cut_solid_kernel.py`
- `app/bim_ai/opening_cut_primitives.py`
- `app/bim_ai/export_gltf.py`, mesh/tree behavior only
- `app/bim_ai/section_projection_primitives.py`, only to consume improved geometry
- `app/bim_ai/plan_projection_wire.py`, only to consume improved geometry
- `packages/web/src/plan/symbology.ts`, only if plan evidence needs the geometry
- focused tests: `app/tests/test_cut_solid_kernel.py`, `app/tests/test_export_gltf.py`, `app/tests/test_plan_projection_and_evidence_slices.py`, `app/tests/test_golden_exchange_fixture.py`
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not edit IFC export unless a tiny manifest-count compatibility adjustment is required. OpenBIM inspection is owned by another agent.
- Do not change schedule definitions or room programme UI.
- Do not change sheet viewport authoring.
- Do not change evidence package digest/UI.
- Do not attempt broad boolean geometry without a bounded fixture and tests.
- Do not open a PR.

## Implementation Checklist

- Pick exactly one narrow geometry improvement, for example:
  - non-orthogonal hosted opening projection;
  - stair plan/section symbol with basic treads and direction marker;
  - layered wall/floor cut bands;
  - roof overhang/ridge proxy in glTF + section;
  - slab opening clipping that improves both glTF and section.
- Prove the improvement across at least two surfaces.
- Preserve existing geometry manifests unless intentionally updated and tested.
- Add focused tests for the chosen fixture.
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

Update only rows you materially changed, likely a subset of `WP-B02/B03/B04/B05`, `WP-E03`, and `WP-X02`. Keep `State` as `partial` unless the Done Rule is fully satisfied. Be precise about which surfaces prove the improvement.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(geometry): improve bounded projection fidelity

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, chosen geometry slice, surfaces proven, tracker rows updated, validation results, and any OpenBIM handoff notes.
