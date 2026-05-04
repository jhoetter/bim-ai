# Agent Prompt 3: Schedule Definitions, Type Propagation, And Materials

## Mission

You are Agent 3 of 5 parallel BIM AI parity agents. Advance the schedule/type/material spine: persisted schedule definitions, stable JSON/CSV export, schedule UI editing, and type/material propagation for current categories. Stay isolated from room programme validation, sheet placement, evidence package digests, and OpenBIM exporters.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-D01` Server-derived schedules
- `WP-D02` Schedule CSV/API/CLI export
- `WP-D03` Schedule UI
- `WP-D04` Family/type registry and propagation
- First narrow slice of `WP-D05` Materials/layer catalogs

The product invariant is: schedules are derived documentation from the canonical semantic model. Schedule UI state, CSV output, and CLI/API table output must agree.

## Start Procedure

1. Start from a clean and current `main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/schedules
   ```

2. Before editing, inspect:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/engine.py`
   - `app/bim_ai/schedule_derivation.py`
   - `app/bim_ai/schedule_field_registry.py`
   - `app/bim_ai/schedule_csv.py`
   - `app/bim_ai/type_material_registry.py`
   - `app/bim_ai/routes_api.py`, schedule endpoints only
   - `packages/cli/cli.mjs`, `schedule-table` only
   - `packages/web/src/schedules/SchedulePanel.tsx`

## Allowed Scope

Prefer changes in these files:

- `app/bim_ai/elements.py`, only `ScheduleElem`, family/type/material fields needed by schedules
- `app/bim_ai/commands.py`, only schedule/type/material commands
- `app/bim_ai/engine.py`, only applying schedule/type/material commands
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`
- `app/bim_ai/schedule_csv.py`
- `app/bim_ai/type_material_registry.py`
- `app/bim_ai/routes_api.py`, schedule table routes only
- `packages/cli/cli.mjs`, `schedule-table` only
- `packages/core/src/index.ts`, only schedule/type/material shapes
- `packages/web/src/state/store.ts`, only hydration for touched shapes
- `packages/web/src/schedules/SchedulePanel.tsx`
- `app/tests/test_*schedule*.py`
- `app/tests/test_kernel_schedule_exports.py`
- `app/tests/test_golden_exchange_fixture.py`, only schedule matrix assertions
- `packages/web/e2e/evidence-baselines.spec.ts`, only schedule mocks/baselines if schedule UI contract changes
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals And Hard Boundaries

Do not edit these areas unless a minimal compatibility fix is proven necessary:

- `app/bim_ai/room_derivation_preview.py`
- Room-specific validation/advisor quick-fix behavior in `app/bim_ai/constraints.py`
- `packages/web/src/workspace/SheetCanvas.tsx`
- `packages/web/src/workspace/sheetViewportAuthoring.tsx`
- `app/bim_ai/evidence_manifest.py`
- `app/bim_ai/export_ifc.py`
- `app/bim_ai/export_gltf.py`
- Section projection and plan symbology files, except for schedule references already displayed in UI

Prompt 4 owns room programme behavior. If you add room schedule fields, keep them generic and coordinate by documenting the merge risk.

## Implementation Goals

Deliver a focused schedule parity slice:

1. Persist richer schedule definitions:
   - sort, group, and filter definitions;
   - stable column/display metadata;
   - backwards-compatible schedule payloads.
2. Keep API/CLI/CSV aligned:
   - `GET /schedules/{id}/table` JSON and CSV agree;
   - `packages/cli/cli.mjs schedule-table --csv` remains compatible;
   - column order follows `schedule_field_registry.py`.
3. Improve type/material propagation:
   - door/window family type and material fields flow into schedules;
   - add a minimal material/layer catalog slice only if it directly supports schedule rows.
4. Improve schedule UI:
   - expose persisted sort/group/filter state in `SchedulePanel.tsx`;
   - avoid owning sheet placement of schedules.

## Validation Commands

Run focused validation first:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_*schedule*.py tests/test_kernel_schedule_exports.py tests/test_golden_exchange_fixture.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
```

If CLI or API contracts changed, also run a focused CLI/API smoke using existing fixtures if available.

Then, if time allows before committing:

```bash
pnpm verify
```

## Tracker Update Rules

Update `spec/revit-production-parity-workpackage-tracker.md` before committing:

- Update only rows you materially affected: likely `WP-D01`, `WP-D02`, `WP-D03`, `WP-D04`, and possibly `WP-D05`.
- Mention tests proving JSON/CSV/CLI/UI behavior.
- Keep remaining blockers strict: full material assemblies, every-category parity, pagination, and richer schedule UI likely remain unless implemented and tested.
- Do not mark a row `done` unless it satisfies the tracker Done Rule.

## Commit And Push

Commit only your focused branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(schedules): persist schedule definitions and type fields

EOF
)"
git push -u origin agent/schedules
```

Do not push to `main`.

## Final Report

Return:

- Branch name and commit SHA.
- Schedule definitions/fields now supported.
- API/CSV/CLI compatibility notes.
- Tracker rows updated.
- Validation commands run and results.
- Any shared-file or room/sheet/evidence merge risks.
