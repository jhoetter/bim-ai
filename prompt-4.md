# Agent Prompt 4: Room Programme Workflow And Advisor Validation

## Mission

You are Agent 4 of 5 parallel BIM AI parity agents. Advance room programme workflow, room color legend parity, and advisor validation for rooms. Stay isolated from generic schedule definition work, sheet viewport authoring, saved-view hierarchy, and evidence package metadata.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-B06` Rooms and room separation
- `WP-C04` Room color schemes and legends
- `WP-V01` Validation/advisor expansion

The product invariant is: rooms, derived room graphics, schedules, validation, and exports must tell the same semantic story. Do not introduce a second room source of truth.

## Start Procedure

1. Start from a clean and current `main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/rooms-validation
   ```

2. Before editing, inspect:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/elements.py`, `RoomElem`
   - `app/bim_ai/commands.py`, room commands
   - `app/bim_ai/engine.py`, room command application
   - `app/bim_ai/room_derivation_preview.py`
   - `app/bim_ai/constraints.py`, room-related rules only
   - `app/bim_ai/plan_projection_wire.py`, room primitives and `roomColorLegend`
   - `app/bim_ai/schedule_derivation.py`, room rows only for compatibility
   - `packages/web/src/plan/PlanCanvas.tsx`
   - `packages/web/src/plan/planProjectionWire.ts`
   - `packages/web/src/plan/symbology.ts`
   - `packages/web/src/advisor/AdvisorPanel.tsx`
   - `packages/core/src/index.ts`, `Violation` shape
   - `packages/web/src/state/store.ts`, violation normalization

## Allowed Scope

Prefer changes in these files:

- `app/bim_ai/elements.py`, room metadata only
- `app/bim_ai/commands.py`, room/programme commands only
- `app/bim_ai/engine.py`, room/programme command application only
- `app/bim_ai/room_derivation_preview.py`
- `app/bim_ai/constraints.py`, room/programme/overlap/unbounded-room rules only
- `app/bim_ai/plan_projection_wire.py`, room primitive and legend fields only
- `app/bim_ai/schedule_derivation.py`, only if room rows need compatibility with programme metadata
- `packages/core/src/index.ts`, violation or room metadata types only
- `packages/web/src/state/store.ts`, room/violation hydration only
- `packages/web/src/plan/PlanCanvas.tsx`
- `packages/web/src/plan/planProjectionWire.ts`
- `packages/web/src/plan/symbology.ts`
- `packages/web/src/advisor/AdvisorPanel.tsx`
- `app/tests/test_room_derivation_preview.py`
- `app/tests/test_constraints_room_programme_consistency.py`
- `app/tests/test_constraints_discipline.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`
- `packages/web/e2e/golden-bundle-plan.spec.ts`
- `packages/web/e2e/evidence-baselines.spec.ts`, only room-scheme paths
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals And Hard Boundaries

Do not own these areas:

- Generic schedule builder/filter/sort/group UI. Prompt 3 owns that.
- Sheet viewport placement and section sheet rendering.
- Project Browser hierarchy and saved view editing.
- OpenBIM IFC space export changes, unless a tiny compatibility test is required.
- Evidence package digest/stale artifact logic.
- Broad geometry kernel or wall-hosted opening changes.

If you touch room schedule fields, keep the change minimal and document it as a merge risk for Agent 3.

## Implementation Goals

Deliver a focused room workflow slice:

1. Improve room programme metadata:
   - programme code, department, function label, finish set, and related room fields should be consistent through commands, engine, and hydration;
   - avoid duplicate definitions of programme semantics.
2. Improve room derivation and validation:
   - unbounded-room or incomplete-closure warnings where feasible;
   - overlap validation remains aligned with plan UI severity;
   - add narrow `quickFixCommand` suggestions for room rules you touch.
3. Improve room color legend parity:
   - plan wire `roomColorLegend` matches visible room coloring;
   - `PlanCanvas` displays deterministic, understandable legend labels;
   - keep `ROOM_PLAN_OVERLAP_ADVISOR_MM2` aligned with the server overlap threshold if changed.
4. Keep schedules and exports coherent:
   - room schedule rows should not contradict programme metadata;
   - avoid IFC space behavior changes unless tested.

## Validation Commands

Run focused validation first:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_room_derivation_preview.py tests/test_constraints_room_programme_consistency.py tests/test_constraints_discipline.py tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/golden-bundle-plan.spec.ts e2e/evidence-baselines.spec.ts
```

Then, if time allows before committing:

```bash
pnpm verify
```

## Tracker Update Rules

Update `spec/revit-production-parity-workpackage-tracker.md` before committing:

- Update only rows you materially affected: likely `WP-B06`, `WP-C04`, and `WP-V01`.
- Mention concrete tests and UI evidence for programme, legend, derivation, and validation changes.
- Keep remaining blockers strict: authoritative room closure, full programme UI, schedule/legend parity, and quick-fix breadth likely remain unless completed.
- Do not mark a row `done` unless it satisfies the tracker Done Rule.

## Commit And Push

Commit only your focused branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(rooms): improve programme validation and legends

EOF
)"
git push -u origin agent/rooms-validation
```

Do not push to `main`.

## Final Report

Return:

- Branch name and commit SHA.
- Room programme and validation behavior added.
- Tracker rows updated.
- Validation commands run and results.
- Any schedule, IFC, or evidence merge risks for other agents.
