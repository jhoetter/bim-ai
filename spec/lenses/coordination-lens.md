# Coordination Lens

Status: done, committed, merged to `main`, and pushed on 2026-05-15.

The Coordination Lens is the cross-discipline review lens for model health, clashes, linked models, issues, BCF-style review artifacts, and revision/change review. It is not a geometry authoring lens. Geometry authoring remains owned by Architecture, Structure, MEP, and related discipline lenses.

German product label: **Koordination**.

## Ownership

The Coordination Lens owns:

- model health warnings and broken-reference review
- clash and constructability issue review
- issue status, responsible discipline/team, due date, and history readouts
- linked model and link drift review
- BCF/review snapshot visibility
- coordination schedule defaults
- change impact review between revisions

The Coordination Lens does not own:

- wall, floor, roof, opening, structure, or MEP authoring commands
- discipline-specific geometry creation
- destructive model edits outside explicit issue/status workflows

## Workpackage Tracker

| Workpackage | Status | Evidence |
| --- | --- | --- |
| COORD-WP-001 - Lens identity and navigation | Done | `packages/web/src/workspace/shell/LensDropdown.tsx`, `packages/web/src/cmdPalette/defaultCommands.ts`, `packages/web/src/workspace/commandCapabilities.ts` expose `coordination` in the lens cycle, Cmd+K, and command capability graph. |
| COORD-WP-002 - Authoring command gating | Done | `packages/web/src/workspace/commandCapabilities.ts` disables geometry authoring commands in coordination lens with a Coordination-specific reason while leaving review/link/advisor workflows enabled. |
| COORD-WP-003 - API snapshot | Done | `GET /api/models/{model_id}/coordination-lens` in `app/bim_ai/routes_api.py` returns `coordinationLensSnapshot_v1` from `app/bim_ai/coordination_lens.py`. |
| COORD-WP-004 - Issue lifecycle fields and status updates | Done | `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, and dispatch code support richer issue metadata plus `UpdateIssueStatusCmd` for `issue` and `constructability_issue`. |
| COORD-WP-005 - Right-rail review readout | Done | `packages/web/src/workspace/coordinationLensReadout.ts` and `WorkspaceRightRail.tsx` show health, clashes, issues, links, snapshots, required schedules, and open ownership rows when `lensMode === "coordination"`. |
| COORD-WP-006 - Schedule and view defaults | Done | `COORDINATION_SCHEDULE_DEFAULTS` and `COORDINATION_VIEW_DEFAULTS` are emitted by `app/bim_ai/coordination_lens.py` and mirrored in the web readout required schedule list. |
| COORD-WP-007 - Coexistence with other lenses | Done | Final `main` merge resolves coordination with architecture, structure, MEP, fire-safety, energy, construction, and sustainability lens additions. |

## Acceptance Evidence

Implemented commits on the feature branch:

- `efd71aa61` - Expose coordination lens in web UI
- `5935d4a1c` - Add coordination lens API snapshot
- `29fc08e3e` - Add coordination lens review readout

Merged to `main` through:

- `7142ff681` - Merge coordination lens workpackages
- `14b3f4775` - Merge origin main into coordination lens workpackages

Verification commands run before merge/push:

```bash
pnpm --filter @bim-ai/web exec vitest run src/workspace/shell/LensDropdown.test.tsx src/workspace/coordinationLensReadout.test.ts src/workspace/WorkspaceRightRail.test.tsx src/cmdPalette/defaultCommands.test.ts src/workspace/commandCapabilities.test.ts src/viewport/useLensFilter.test.ts src/schedules/scheduleUtils.test.ts src/state/storeSliceContracts.test.ts
pnpm --filter @bim-ai/web typecheck
uv run pytest tests/test_coordination_lens.py tests/test_construction_lens.py tests/test_architecture_lens_query.py tests/test_architecture_schedule_defaults.py --no-cov
uv run ruff check bim_ai/coordination_lens.py bim_ai/construction_lens.py bim_ai/architecture_lens_query.py tests/test_coordination_lens.py tests/test_construction_lens.py tests/test_architecture_lens_query.py tests/test_architecture_schedule_defaults.py bim_ai/elements.py bim_ai/commands.py bim_ai/engine.py bim_ai/engine_dispatch_core.py bim_ai/engine_dispatch_coordination.py bim_ai/routes_api.py bim_ai/schedule_derivation.py bim_ai/schedule_field_registry.py
```

## Residual Notes

The implementation intentionally stops at review and issue-management surfaces. Future work can deepen live clash visualization, BCF REST roundtrip, and asynchronous linked-model coordination jobs without changing the lens ownership boundary above.
