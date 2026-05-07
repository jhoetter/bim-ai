# Wave-3 Agent 1 — federation downstream — status

**Branch:** `wave3-1` (rebased and merged into `main`)
**Date:** 2026-05-07
**Theme:** federation downstream — building on the FED-01 keystone

## Workpackages shipped

| WP     | State     | Commit                       | Notes                                                                                                |
| ------ | --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| FED-02 | `done`    | `cf3552d5` → main            | Full WP. linkScope, link-chain, three commands, AABB cross-link transform, UI scope dropdown.        |
| FED-03 | `partial` | `0fe4cfc2` → main            | All required slices shipped. Canvas badge (yellow triangle on element) deferred — banner covers UX. |
| FED-04 | `partial` | `6c2ee24f` → main            | IFC half shipped per WP guidance. DXF + Revit deferred (disabled menu entries with tooltips).        |

Tracker rows + per-WP detail blocks updated in `spec/workpackage-master-tracker.md` (commits `73a99c2a`, `ad072667`, `bc438ed5`).

## What ran clean

- `pnpm exec tsc --noEmit` (all 7 typecheck-eligible packages)
- `pnpm vitest run` — 2070 tests passing (FED-02 added 6, FED-03 added 4, FED-04 added 4 new vitest cases)
- `pytest --no-cov tests/test_link_model.py tests/test_clash_test_cross_link.py tests/test_cross_link_copy_monitor.py tests/test_ifc_shadow_import.py tests/test_export_ifc.py tests/test_engine_constraints.py tests/test_constraints.py` — 92 passing
- FED-02: 11 pytest, 6 vitest
- FED-03: 10 pytest, 4 vitest
- FED-04: 5 pytest, 4 vitest

## Push protocol followed

- Each WP: commit on `wave3-1` → push wave3-1 with --force-with-lease → push wave3-1:main → mark tracker done
- `wave3-1` head is `bc438ed5` matching `origin/main`
- Status file written **after** all branches were pushed (per anti-laziness note)

## File ownership respected

Only touched files in this agent's lane (per the wave3 README ownership grid):

- `packages/core/src/index.ts` — append-only (SelectionSetRule, ClashResult, MonitorSource, monitorSource on level/grid_line)
- `app/bim_ai/elements.py` / `commands.py` / `engine.py` — append-only
- `app/bim_ai/clash_engine.py`, `monitored.py` — new files
- `app/bim_ai/routes_api.py` — appended import-ifc endpoint
- `app/bim_ai/routes_commands.py` — extended `_command_needs_link_sources` allowlist
- `app/bim_ai/constraints.py` — appended drift advisory rule
- `packages/web/src/coordination/` — extended ClashTestPanel + SelectionSetPanel
- `packages/web/src/workspace/InspectorContent.tsx`, `ProjectMenu.tsx`, `Workspace.tsx` — extended in place
- `packages/web/src/state/store.ts` — added `coerceMonitorSource` helper
- `packages/web/src/i18n.ts` — appended coordination + inspector keys (en + de)

No files in agent-2/3/4/5/6/7/8 territory touched.

## Deferred items (suggested follow-ups)

### From FED-03

- **Canvas badge** (yellow triangle) on monitored elements when `monitorSource.drifted` is true. The data + advisory exists; this is purely a renderer overlay (~0.5 day in `packages/web/src/viewport/` + `packages/web/src/plan/`).

### From FED-04

- **DXF underlay import** via `ezdxf`. Add a parallel endpoint `POST /api/models/{host_id}/import-dxf`, a new `link_dxf` element kind for 2D linework, and a plan-underlay renderer. WP estimate: ~1 week.
- **Revit (.rvt) import**: blocked on OpenBIM / Forge convergence per OpenBIM Stance — when a viable converter exists, the same shadow-model pattern accepts whatever it writes.
- **Polished progress reporting** for long IFC imports (chunked websocket events instead of a single 200 OK).
- **End-to-end DB-backed test** for the import-ifc route (currently the test exercises the pure-data pipeline; the route layer itself is covered by integration via `try_apply_kernel_ifc_authoritative_replay_v0` + `try_commit`, but a TestClient-based test against a live SQLite would catch session lifecycle issues).

### From FED-01 (still partial)

Not in this agent's scope, but worth flagging the existing FED-01 deferred items remain open: per-link visibility modes, revision-pinning UI + drift badge, alignment modes beyond `origin_to_origin`, CLI subcommands, Project Browser left-rail Links group, VV-dialog Revit Links tab, `worksetId` on `link_model`.

## Conflict notes

Two rebase conflicts encountered, both in append-only "list" files where parallel waves added entries near each other:

1. `app/bim_ai/engine.py` — origin/main added a post-match `recompute_all_areas(els)` block (KRN-08) right where my new match cases were appended. Resolution: keep both — my cases inside the match, area recomputation after.
2. `app/bim_ai/elements.py` — origin/main added `AreaElem` + `MaskingRegionElem` immediately before my `SelectionSetRuleSpec`. Resolution: keep both, ordered Area → Masking → SelectionSet → Clash.

Both rebases verified by re-running `pytest tests/test_link_model.py tests/test_clash_test_cross_link.py tests/test_cross_link_copy_monitor.py tests/test_ifc_shadow_import.py` post-resolve — all green.
