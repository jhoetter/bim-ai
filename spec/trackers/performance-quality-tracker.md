# BIM AI Performance Quality Tracker

Last updated: 2026-05-23 (audit pass + implementation sweep)

Purpose: track the application-wide performance work needed to make BIM AI feel
responsive during ordinary authoring, remain predictable on larger projects, and
avoid multi-second stalls in reporting, evidence, rendering, and collaboration
flows.

This tracker was created after investigation of sluggish rotation, hosted
window/door placement latency, delayed undo/redo stack updates, and broader
application responsiveness. It records measured baselines, likely bottlenecks,
grades, severity, and concrete remediation items.

## Scope

This tracker covers:

- backend request latency;
- command commit and undo/redo responsiveness;
- constraint, schedule, room-boundary, projection, and evidence computation;
- snapshot and websocket bootstrapping;
- frontend state invalidation and render paths;
- 2D plan and 3D viewport interactivity;
- production bundle size and code splitting;
- websocket broadcast/backpressure behavior;
- CI performance budgets and regression detection.

It does not replace:

- `spec/archive/code-quality-tracker.md` for broad code health;
- `spec/methodology/frontend-monolith-extraction-map.md` for component extraction;
- `spec/archive/bim-integrity-rendering-sketch-methodology-tracker.md` for Advisor,
  BIM integrity, renderer fidelity, and sketch-methodology acceptance;
- `spec/benchmarks/` for benchmark fixtures.

Performance work often overlaps those trackers, but this file owns latency,
throughput, responsiveness, scale, and budget acceptance.

## Grade Summary

Initial grade, based on 2026-05-19 measurements from model
`6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2`:

| Area                          | Current state                                                                         | Grade   |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------- |
| Small-model command authoring | Usable after backend evaluation dedupe; still near the upper bound for "instant" UX.  | `B-`    |
| Snapshot loading              | Acceptable server timing, but likely duplicated via REST + websocket bootstrap.       | `B-`    |
| Plan projection               | About 200 ms per revision; okay now, scale-sensitive.                                 | `C+`    |
| Schedule table derivation     | Room schedules cost about 230 ms and are fetched from multiple surfaces.              | `C`     |
| Validation endpoint           | About 400 ms on a small model.                                                        | `C-`    |
| Evidence package              | About 7-8 seconds on a small model due repeated room-boundary derivation.             | `F`     |
| Frontend bundle               | Main app chunk is 4.19 MB minified / 1.08 MB gzip.                                    | `D`     |
| Frontend state invalidation   | Delta store exists, but `elementsById` invalidates many large subscribers.            | `C-/D+` |
| 2D/3D interaction scale       | Good enough at 169 elements; vulnerable to full-model scans and continuous rendering. | `C`     |
| Collaboration/websocket scale | Simple and workable locally; not robust under slow clients or many subscribers.       | `C-`    |

Initial overall grade:

- current small-model interactive experience: `C+`;
- larger-project readiness: `C-/D+`;
- reporting/evidence path readiness: `F`;
- production-load experience: `D+`.

Current recheck grade, based on 2026-05-20/2026-05-21 measurements from current
seed model `9bb9a145-d9ce-5a2f-a748-bb5be3301b30` (`target-house-3`, revision
`1`, `120` elements):

| Area                                   | Current state after recheck                                                                                                                                      | Grade     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Small-model command/evaluation backend | `evaluate` is about 88-95 ms and a hosted-opening probe reached about 127-151 ms before failing on constraints.                                                  | `B`       |
| Snapshot loading                       | Warm snapshot and expanded snapshot are about 95-122 ms for a 146 KB payload.                                                                                    | `A-/B+`   |
| Plan projection                        | About 51-84 ms on `plan-eg` / `EG` projection requests.                                                                                                          | `B+`      |
| Schedule table derivation              | Not re-measured on current seed because it has no schedule elements.                                                                                             | `Unknown` |
| Validation endpoint                    | About 137-142 ms.                                                                                                                                                | `B`       |
| Evidence package                       | About 0.48-0.63 s and observed one room-boundary derivation call.                                                                                                | `B+`      |
| Frontend bundle                        | Entry chunk is now about 408 KB minified / 125 KB gzip after route splitting; largest lazy chunk is still the workspace at about 2.15 MB minified / 568 KB gzip. | `C+`      |
| Frontend state invalidation            | Structural risk remains: broad `elementsById` subscriptions and large components.                                                                                | `C-/D+`   |
| 2D/3D interaction scale                | Still not empirically measured with browser traces or large fixtures.                                                                                            | `C`       |
| Collaboration/websocket scale          | No new load test; risk unchanged.                                                                                                                                | `C-`      |

Current overall grade:

- current small-model backend responsiveness: `B`;
- larger-project readiness: `C-/D+`;
- reporting/evidence path readiness: `B` for the current seed, pending larger
  fixtures and CI budgets;
- production-load experience: `C`, with the workspace route still needing deeper
  panel-level splitting.

## Measurement Context

Measured locally on 2026-05-19, with the API server at
`http://127.0.0.1:8500` and web package built through Vite.

Representative model:

- model id: `6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2`;
- revision: `3`;
- element count: `169`;
- violations: `0` in normal snapshot response at measurement time;
- payload size for snapshot: about `105 KB`.

Important caveats:

- This is a small model. Scale behavior must be tested with larger fixtures.
- Some results were measured while local dev services were running, so absolute
  numbers include dev-machine variability.
- The conclusions focus on relative cost and repeated work, not exact p95/p99
  production latency.
- Production build size was measured with `pnpm --filter @bim-ai/web build`.

## Measured Baselines

The 2026-05-19 baseline below is intentionally preserved because it records the
original regression class. The 2026-05-20/2026-05-21 recheck shows the current
backend is materially faster on the current seed, while frontend bundle and
scale risks remain.

### Backend HTTP Endpoints

| Endpoint / path                                  | Observed result                    | Grade | Notes                                                         |
| ------------------------------------------------ | ---------------------------------- | ----- | ------------------------------------------------------------- |
| `/api/health`                                    | about `1-6 ms`                     | `A`   | No concern.                                                   |
| `/api/bootstrap`                                 | about `13-20 ms`                   | `A-`  | Small payload; no concern.                                    |
| `/api/models/{id}/snapshot`                      | about `236-269 ms`, `105171` bytes | `B-`  | Dominated by validation/evaluation; acceptable but not cheap. |
| `/api/models/{id}/snapshot?expandLinks=true`     | about `236-267 ms`, `105171` bytes | `B-`  | Similar to snapshot on this model.                            |
| `/api/models/{id}/activity`                      | about `7-10 ms`                    | `A`   | No concern.                                                   |
| `/api/models/{id}/comments`                      | about `6-10 ms`                    | `A`   | No concern.                                                   |
| `/api/models/{id}/projection/plan?...`           | about `198-217 ms`, `20735` bytes  | `C+`  | Triggered on revision changes in plan UI.                     |
| `/api/models/{id}/schedules/room-schedule/table` | about `226-237 ms`, `13403` bytes  | `C`   | Room schedules derive room-boundary closure.                  |
| `/api/models/{id}/summary`                       | about `206-224 ms`, `20945` bytes  | `C+`  | Uses similar validation/summary work.                         |
| `/api/models/{id}/validate`                      | about `399-425 ms`, `21023` bytes  | `C-`  | Slower than snapshot due repeated/extra validation work.      |
| `/api/models/{id}/evidence-package`              | about `7.1-8.0 s`, `242262` bytes  | `F`   | Critical repeated derivation path.                            |

### Backend Compute Costs

| Operation                                      | Observed result    | Grade | Notes                                                |
| ---------------------------------------------- | ------------------ | ----- | ---------------------------------------------------- |
| `load_model_row`                               | about `21-32 ms`   | `B`   | Database/storage cost is not dominant.               |
| `Document.model_validate`                      | about `0.5 ms`     | `A`   | Not a bottleneck for current model size.             |
| element `model_dump` for snapshot-like payload | about `0.3-0.9 ms` | `A`   | Not a bottleneck for current model size.             |
| `violations_wire` / `evaluate`                 | about `200-240 ms` | `C+`  | Dominated by room-boundary derivation.               |
| `compute_room_boundary_derivation`             | about `190-230 ms` | `C+`  | The central repeated compute cost.                   |
| `derive_schedule_table(room-schedule)`         | about `197-210 ms` | `C`   | Room schedule pulls room-boundary closure.           |
| `derive_schedule_table(opening-schedule)`      | about `0.0-0.1 ms` | `A`   | Non-room schedules are cheap on this model.          |
| `try_commit(insertWindowOnWall)`               | about `208-217 ms` | `B-`  | Mostly one final `evaluate`.                         |
| transaction metadata after fixes               | about `0.2-0.3 ms` | `A`   | Previously hidden duplicate evaluation risk removed. |
| delta generation with reused violations        | about `0.2-0.3 ms` | `A`   | Not a bottleneck after reuse.                        |

### Evidence Package Profile

`/evidence-package` profile on the same model:

- total route time: about `7.1-8.0 s` without profiler;
- profiler route time: about `23.4 s` due profiling overhead;
- room-boundary derivation calls observed: `32`;
- total room-boundary derivation time observed: about `6.1 s`;
- profile showed `37` calls to `compute_room_boundary_derivation` under
  profiling, because some imports/call paths were not patched by the lightweight
  wrapper in the non-profile count;
- profile showed about `3,032,668` calls to `quad_closes_rectangle`;
- profile showed about `48.6M` calls to `snap_mm` under profiling.

Main evidence-package repeated-work sources:

- `deterministic_sheet_evidence_manifest`;
- `sheet_elem_to_svg`;
- `sheet_viewport_export_listing_lines`;
- `viewport_evidence_hints_v1`;
- `format_schedule_viewport_documentation_segment`;
- `resolve_plan_projection_wire`;
- `derive_schedule_table`;
- `room_derivation_preview`;
- `room_derivation_candidates_review`;
- `violations_wire`;
- `compute_model_summary`;
- `build_constructability_summary_v1`.

### Production Bundle

Production build output:

| Asset                    | Size          | Gzip                         |
| ------------------------ | ------------- | ---------------------------- |
| main app JS `index-*.js` | `4,186.45 KB` | `1,079.35 KB`                |
| CSS `index-*.css`        | `77.98 KB`    | `19.12 KB`                   |
| `csgWorker-*.js`         | `258.26 KB`   | not reported by Vite summary |
| `html2canvas.esm-*.js`   | `202.38 KB`   | `48.04 KB`                   |
| `leaflet-src-*.js`       | `150.05 KB`   | `43.59 KB`                   |
| total `dist` directory   | `5.7 MB`      | n/a                          |

Vite warning:

```text
Some chunks are larger than 500 kB after minification.
```

Grade: `D`.

The app needs code splitting for heavy routes and panels. A 1 MB gzip main
bundle is expensive for cold loads and makes every dev/preview refresh feel
heavier.

### Current Recheck: 2026-05-20 / 2026-05-21

Current seed model:

- model id: `9bb9a145-d9ce-5a2f-a748-bb5be3301b30`;
- slug: `target-house-3`;
- revision: `1`;
- element count: `120`;
- payload size for snapshot: about `146 KB`;
- schedules: none in this seed, so room schedule timing was not comparable.

Backend HTTP timings:

| Endpoint / path                              | Recheck result                                                      | Prior comparable baseline | Interpretation                                         |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| `/api/models/{id}/snapshot`                  | warm about `95-122 ms`, first cold-ish samples up to about `510 ms` | about `236-269 ms`        | Better after warmup; first request can still be noisy. |
| `/api/models/{id}/snapshot?expandLinks=true` | about `95 ms` warm                                                  | about `236-267 ms`        | Better.                                                |
| `/api/models/{id}/projection/plan?...`       | about `51-84 ms`                                                    | about `198-217 ms`        | Much better.                                           |
| `/api/models/{id}/summary`                   | about `52-54 ms`                                                    | about `206-224 ms`        | Much better.                                           |
| `/api/models/{id}/validate`                  | about `137-142 ms`                                                  | about `399-425 ms`        | Much better.                                           |
| `/api/models/{id}/evidence-package`          | about `0.48-0.63 s`                                                 | about `7.1-8.0 s`         | Critical improvement.                                  |

Backend compute timings:

| Operation                                      | Recheck result                                                         | Prior comparable baseline                         | Interpretation                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `load_model_row`                               | about `26 ms`                                                          | about `21-32 ms`                                  | Similar.                                                           |
| `Document.model_validate`                      | about `0.4 ms`                                                         | about `0.5 ms`                                    | Similar.                                                           |
| element `model_dump` for snapshot-like payload | about `0.3-0.4 ms`                                                     | about `0.3-0.9 ms`                                | Similar.                                                           |
| `violations_wire` / `evaluate`                 | about `88-95 ms`                                                       | about `200-240 ms`                                | Better.                                                            |
| `compute_room_boundary_derivation`             | about `45-46 ms`                                                       | about `190-230 ms`                                | Much better on current seed.                                       |
| `try_commit(insertWindowOnWall)` probe         | about `127-151 ms`, but failed with `constraint_error` on current seed | about `208-217 ms` successful on older model      | Faster timing, but not a success-path apples-to-apples comparison. |
| `/evidence-package` room-boundary calls        | `1` observed call, about `46 ms` total                                 | about `32` observed calls and about `6.1 s` total | The repeated-derivation failure appears fixed for current seed.    |

Production bundle recheck:

| Asset                | 2026-05-19    | 2026-05-20/21 | Interpretation |
| -------------------- | ------------- | ------------- | -------------- |
| main app JS minified | `4,186.45 KB` | `4,317.15 KB` | Worse.         |
| main app JS gzip     | `1,079.35 KB` | `1,122.95 KB` | Worse.         |
| CSS gzip             | `19.12 KB`    | `19.14 KB`    | Similar.       |

Conclusion from recheck:

- The backend performance issue the user felt is materially better.
- Evidence package no longer shows the 7-8 second repeated room-boundary
  derivation behavior on the current seed.
- The tracker remains valid for frontend cold-start, bundle, state invalidation,
  large-model scale, websocket load, and missing CI benchmark coverage.
- The current seed is not a full replacement for the original baseline because
  it has fewer elements and no schedules. Medium/large benchmark fixtures are
  still required before closing scale items.

## Architectural Findings

### Backend

#### Finding BE-1: Global Evaluation Is Still In The Interactive Path

Interactive commands still pay for a whole-model `evaluate()` on the final
document. After recent optimization, that is about `200 ms` on the measured
model. This is acceptable but close to the perceived-latency threshold for
authoring.

Risk:

- larger models will push every command above acceptable latency;
- undo/redo stack updates remain coupled to command response completion;
- fast visual optimistic updates can still feel inconsistent if authoritative
  stack state arrives late.

Relevant files:

- `app/bim_ai/engine_commit.py`
- `app/bim_ai/constraints_evaluation.py`
- `app/bim_ai/room_derivation.py`
- `app/bim_ai/routes_commands.py`

#### Finding BE-2: Room Boundary Derivation Is The Central Hotspot

`compute_room_boundary_derivation` is used by:

- constraints/evaluation;
- room schedules;
- room programme closure;
- plan projection;
- room derivation preview/candidate review;
- sheet and evidence manifests.

The algorithm was improved to enumerate horizontal-pair x vertical-pair
candidates instead of all 4-segment combinations, but it remains the dominant
unit of work.

Risk:

- any route that accidentally calls it multiple times becomes slow;
- evidence and sheet routes can multiply the cost by schedules, viewports, or
  evidence fragments;
- scale with many room separators/walls may still be nonlinear enough to hurt.

Relevant files:

- `app/bim_ai/room_derivation.py`
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/plan_projection_wire.py`
- `app/bim_ai/sheet_preview_svg.py`
- `app/bim_ai/evidence_manifest.py`

#### Finding BE-3: Evidence Package Has No Request-Scoped Compute Cache

The evidence package is the clearest critical backend failure. It recomputes the
same derivations over and over inside one request.

Required cache keys:

- document revision / document identity;
- room-boundary bundle;
- schedule id + schedule filters/grouping;
- plan projection params;
- sheet id + viewport id + presentation params;
- deterministic evidence fragments.

This should be request-scoped first. A cross-request cache can come later.

#### Finding BE-4: Plan Projection Is Refetched Per Revision

`PlanCanvas` refetches projection when `revision` changes. The endpoint costs
about `200 ms`.

Risk:

- every authoring command can trigger command latency plus projection latency;
- rapid command sequences can create stale in-flight requests;
- cancelled frontend effects do not cancel server work unless `AbortController`
  is used and respected.

Relevant files:

- `packages/web/src/plan/PlanCanvas.tsx`
- `packages/web/src/plan/planProjectionWire.ts`
- `app/bim_ai/routes_api.py`
- `app/bim_ai/plan_projection_wire.py`

#### Finding BE-5: Schedule Derivation Is Fetched From Multiple UI Surfaces

The schedule panel and mode shells can fetch schedule tables independently.
Room schedules cost about `230 ms` on the current model.

Risk:

- repeated room schedule fetches multiply room-boundary cost;
- switching workspaces/tabs can cause repeated server work;
- schedule-related evidence may recompute the same table again.

Relevant files:

- `packages/web/src/schedules/SchedulePanel.tsx`
- `packages/web/src/workspace/ModeShells.tsx`
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/routes_api.py`

#### Finding BE-6: Snapshot Bootstrap May Be Duplicated

The client fetches a REST snapshot, then opens a websocket. If the websocket has
no resume sequence, it sends another full snapshot and computes violations
again.

Risk:

- first load pays duplicate server work;
- frontend hydrates twice;
- first interaction can feel delayed or unstable.

Relevant files:

- `packages/web/src/workspace/useWorkspaceSnapshot.ts`
- `app/bim_ai/routes_api.py`

#### Finding BE-7: Websocket Broadcast Awaits Each Client Sequentially

`Hub.broadcast_json` iterates clients and awaits `send_json` per socket.

Risk:

- one slow client can delay others;
- queue-depth tracking is not a true independent per-client queue;
- many collaborators or large deltas will increase publish latency.

Relevant files:

- `app/bim_ai/hub.py`

### Frontend

#### Finding FE-1: Large Monolith Components

Large files:

| File                                       |  Lines |
| ------------------------------------------ | -----: |
| `packages/web/src/Viewport.tsx`            | `6192` |
| `packages/web/src/workspace/Workspace.tsx` | `6851` |
| `packages/web/src/plan/PlanCanvas.tsx`     | `9334` |

Risk:

- broad re-renders are expensive to reason about;
- state dependencies are difficult to isolate;
- small UI state changes can invalidate large component trees;
- performance ownership is unclear.

Relevant tracker:

- `spec/methodology/frontend-monolith-extraction-map.md`

#### Finding FE-2: Single Global `elementsById` Object Invalidates Many Subscribers

`applyDelta` correctly applies sparse deltas but creates a new top-level
`elementsById` object. Many components subscribe to it directly and then scan
the whole model.

Observed:

- `315` `useBimStore(...)` call sites;
- many direct subscriptions to `elementsById`;
- many `Object.values(elementsById)` scans in workspace, plan, schedule, and
  viewport code.

Risk:

- one changed element can cause broad derived recomputation;
- selectors are too coarse for scale;
- performance will degrade with thousands of elements.

Relevant files:

- `packages/web/src/state/storeModelRuntimeSlice.ts`
- `packages/web/src/workspace/Workspace.tsx`
- `packages/web/src/plan/PlanCanvas.tsx`
- `packages/web/src/Viewport.tsx`
- `packages/web/src/schedules/SchedulePanel.tsx`

#### Finding FE-3: Full-Model Scans In Interaction Paths

Plan and viewport code contain repeated model scans near interaction logic:

- snapping;
- picking;
- hover;
- hosted opening conflict checks;
- wall/floor/level lookup;
- tag/dimension lookup;
- temporary visibility and crop filtering.

Risk:

- mousemove/pointermove paths become O(n);
- large models will show cursor lag;
- scans allocate arrays repeatedly through `Object.values`.

Relevant files:

- `packages/web/src/plan/PlanCanvas.tsx`
- `packages/web/src/Viewport.tsx`

#### Finding FE-4: 3D Viewport Appears To Render Continuously

The viewport runs a `requestAnimationFrame` loop and calls `composer.render()`.
Continuous rendering is needed during orbit/walk/animation, but if always active
at idle, it burns CPU/GPU.

Risk:

- laptop battery drain;
- fan/thermal throttling;
- lower headroom for React updates and command response processing;
- worse perceived latency during idle interactions.

Relevant file:

- `packages/web/src/Viewport.tsx`

#### Finding FE-5: Main Bundle Is Too Large

The main JS chunk is about `4.19 MB` minified / `1.08 MB` gzip.

Likely split candidates:

- family editor route;
- public presentation route;
- evidence/review panels;
- sheet documentation and sheet review surfaces;
- schedules module;
- PDF/export modules;
- map/Leaflet surface;
- command palette heavy registries;
- agent review panes;
- design-system icon gallery;
- family library/catalog panels.

Relevant files:

- `packages/web/src/App.tsx`
- `packages/web/vite.config.ts`
- `packages/web/src/export/pdfExporter.ts`

## Status Model

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `Done`        | Implemented, verified, and protected by a regression budget or test.       |
| `Partial`     | Some fix exists, but coverage, scale, or budget enforcement is incomplete. |
| `Not started` | No reliable implementation exists.                                         |
| `Blocked`     | Needs architectural decision, benchmark fixture, or dependency first.      |

| Priority | Meaning                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| `P0`     | User-visible critical latency, multi-second stalls, or known regression risk. |
| `P1`     | Required for professional-scale smoothness and predictable interaction.       |
| `P2`     | Important hardening, scale, and maintainability work.                         |
| `P3`     | Nice-to-have observability, polish, or future-proofing.                       |

## Milestones

| Milestone                                               | Status    | Exit Criteria                                                                                                                        |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `PERF-M0` Baseline and tracker                          | `Done`    | This tracker exists with measured baselines, grades, and backlog items.                                                              |
| `PERF-M1` Interactive authoring under 150 ms server p50 | `Partial` | Common commands return in under 150 ms p50 and under 300 ms p95 on standard model fixtures.                                          |
| `PERF-M2` Evidence package under 1 s small-model p50    | `Done`    | Current seed and the synthetic small fixture run under the budget; schedule-heavy evidence is covered by the backend budget harness. |
| `PERF-M3` Snapshot/bootstrap dedupe                     | `Done`    | Initial load uses one authoritative bootstrap path and avoids duplicate snapshot/evaluation/hydration.                               |
| `PERF-M4` Projection/schedule caching                   | `Partial` | Plan projection and schedule tables use revision-keyed server/client caches with invalidation.                                       |
| `PERF-M5` Frontend selector/index hardening             | `Partial` | Main panes consume derived selectors/indices rather than scanning `elementsById` directly for common views.                          |
| `PERF-M6` 3D/2D interaction budgets                     | `Partial` | Orbit, hover, pan, snap, and placement remain smooth on scale fixtures; render loop is demand-driven when idle.                      |
| `PERF-M7` Bundle budget                                 | `Partial` | Entry chunk is below budget and non-default routes are split; the workspace route still needs deeper heavy-panel splitting.          |
| `PERF-M8` CI performance gates                          | `Partial` | Backend compute/evidence budgets and web bundle budgets run in CI; browser interaction budgets are still missing.                    |

## Tracker Items

### A. Backend Baselines, Instrumentation, And Budgets

| ID         | Priority | Status | Item                                                | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------- | ------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-A01` | P0       | `Done` | Record current measured baselines.                  | This tracker includes endpoint timings, compute timings, bundle size, and grades from the 2026-05-19 investigation.                                                                                                                                                                                                                                                                                                                                                                                      |
| `PERF-A02` | P0       | `Done` | Add repeatable backend benchmark script.            | `app/scripts/performance_budget.py` emits JSON timings and enforces budgets for evaluate, projection, schedules, evidence package, and room derivation.                                                                                                                                                                                                                                                                                                                                                  |
| `PERF-A03` | P0       | `Done` | Add standard performance fixtures.                  | Synthetic small, schedule-heavy, room-separation stress, and documentation-heavy fixtures exist in the backend performance budget harness.                                                                                                                                                                                                                                                                                                                                                               |
| `PERF-A04` | P1       | `Done` | Add route timing middleware in dev/test.            | `route_timing_middleware` in `app/bim_ai/main.py` logs route, method, status, elapsed_ms, model_id, revision via structured `bim_ai.route_timing` logger. Default threshold 250 ms (override via `BIM_AI_ROUTE_TIMING_THRESHOLD_MS`).                                                                                                                                                                                                                                                                    |
| `PERF-A05` | P1       | `Done` | Add compute-phase timers for expensive derivations. | All four expensive routes now accept `?debug=true` and return a `_perfDebug` block: `/validate` (docValidateMs, violationsMs, summaryMs, totalMs), `/projection/plan` (totalMs, cacheHit, docValidateMs, projectionMs, primitiveCount), `/evidence-package` (totalMs, docValidateMs, packageBuildMs, mode), `/schedules/{id}/table` (totalMs, docValidateMs, deriveMs, cacheHit, lightweight). Debug requests bypass the cross-request cache where present so timings reflect actual recomputation cost. |
| `PERF-A06` | P1       | `Done` | Add CI backend budgets.                             | CI runs the backend performance budget harness with stable synthetic fixtures and failure thresholds.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `PERF-A07` | P2       | `Done` | Store historical benchmark output.                  | `app/scripts/performance_budget.py --persist` writes `spec/generated/performance-budget.json` enriched with capturedAt, commitSha, host; the committed file doubles as a git-diffable trend artifact.                                                                                                                                                                                                                                                                                                    |

### B. Command Commit And Undo/Redo Responsiveness

| ID         | Priority | Status        | Item                                                                                    | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------- | ------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-B01` | P0       | `Done`        | Reuse already-computed violations for command delta/response.                           | `compute_delta_wire` accepts `violations`; command routes reuse `try_commit` result instead of evaluating again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PERF-B02` | P0       | `Done`        | Remove hidden transaction-metadata full evaluation.                                     | Transaction metadata computes changed/removed/patch ids directly without calling full delta/evaluate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PERF-B03` | P0       | `Done`        | Avoid old-document evaluation unless needed for blocking comparison.                    | `try_commit` and bundle commit evaluate the previous document only when the new document contains blocking/error violations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PERF-B04` | P0       | `Done`        | Keep common command server time near 200 ms or lower.                                   | `small.insert_window_commit` is covered by the backend performance budget harness with a 150 ms p50 budget; local run was about 18 ms p50 on the synthetic small fixture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PERF-B05` | P1       | `Partial`     | Add interactive command budget tests.                                                   | `small.insert_door_commit`, `small.create_wall_commit`, and `small.move_wall_commit` budgets all live alongside `small.insert_window_commit` in `app/scripts/performance_budget.py BUDGETS_MS` (all 150 ms p50). move_wall measured at ~43 ms p50 on the synthetic small fixture — exercises the wall-geometry-change path (which dirties hosted openings + room boundaries). Undo/redo replay coverage still pending — `try_commit` doesn't natively model a reverse commit; closing that piece needs either a UndoCommand fixture or a thin wrapper that re-applies a stored prior document.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PERF-B06` | P1       | `Not started` | Separate undo-stack optimistic availability from full authoritative refresh where safe. | UI can show pending undo/redo state immediately while preserving authoritative failure rollback semantics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PERF-B07` | P1       | `Done`        | Add command-specific validation fast paths.                                             | End-to-end wiring landed (perf-sweep, 2026-05-23): `try_commit` checks `command_supports_fast_validation_path(cmd_raw)` and, for the allowlisted commands (`insertDoorOnWall`, `insertWindowOnWall`, `createWallOpening`, `moveWallEndpoints`, `moveWallDelta`), drops `documentation_advisors=False` into `_commit_violations` → `evaluate` (PERF-C09 gate). `compute_delta_wire` now accepts `validation_scope='blocking_only'` and `routes/commands.py`'s raw-command handler stamps the delta when the fast path fired. `ModelDelta` gained `validationScope?: 'full' \| 'blocking_only'` in `packages/core/src/modelContracts.ts`. FE `applyDelta` reads the flag: when `'blocking_only'`, prior info-level violations are PRESERVED instead of being dropped on replace (so the advisor panel doesn't flicker). Regression tests: `tests/test_constraints_evaluation_documentation_advisors_gate.py` covers the evaluate gate; `store.test.ts` adds two `applyDelta` cases (preserve on blocking_only, replace on full/omitted). 3397 backend tests + 1804 frontend tests still pass. |
| `PERF-B08` | P2       | `Partial`     | Add incremental validation boundary.                                                    | `evaluate(..., changed_ids: set[str] \| None = None)` accepts a delta-id hint. Today the kwarg is plumbed but not yet consumed by individual advisor passes; the parameter exists so each advisor can opt in incrementally (e.g. `_plan_view_tag_style_advisor_violations` can early-return when none of its tag/plan-view ids appear in `changed_ids`). Pairs with PERF-C09's documentation-advisor gate: once both knobs are wired through `_commit_violations`, command commits can pass both `documentation_advisors=False` and `changed_ids={cmd.targetId}` and skip the unrelated advisor pass entirely. Per-advisor opt-in is the remaining work.                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### C. Constraint Evaluation And Room Derivation

| ID         | Priority | Status        | Item                                                                                          | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------- | ------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-C01` | P0       | `Done`        | Reduce room rectangle enumeration from all 4-combinations to horizontal-pair x vertical-pair. | `compute_room_boundary_derivation` returns same tested behavior and room derivation is about 190-230 ms on current model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PERF-C02` | P0       | `Done`        | Share room-boundary derivation between evaluation and schedule parity in one evaluation.      | `constraints_evaluation.evaluate` passes the existing room-boundary bundle to schedule parity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PERF-C03` | P0       | `Done`        | Identify room derivation as the dominant remaining evaluate cost.                             | Tracker records measurements, the backend budget harness covers small and stress fixtures, and HTTP routes now have request-scoped room-derivation caching.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PERF-C04` | P0       | `Done`        | Add request-scoped room-boundary cache.                                                       | Any HTTP route computing the room-boundary bundle more than once for the same loaded document reuses it within that request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PERF-C05` | P1       | `Done`        | Add document-revision scoped room-boundary cache.                                             | `_ROOM_BOUNDARY_DOC_CACHE` (LRU, 32 entries) in `app/bim_ai/room_derivation.py` keys on `(doc.revision, len(doc.elements), tuple(doc.elements.keys()))`. `compute_room_boundary_derivation` now checks in-request first, then cross-request (deepcopy on read + on store keeps cached entries immune to caller mutations). Performance budget on the current backend: `small.room_derivation` p50 dropped from ~45 ms to ~1 ms after the harness's warmup populates the cache; `documentation_heavy.evidence_package` p50 ~12 s → ~3.7 s; `schedule_heavy.evidence_package` p50 ~8 s → ~3.3 s. Regression tests cover cross-request hits, mutation isolation, and revision-key distinctness (`tests/test_room_derivation_request_cache.py`). `tests/conftest.py` autouse-resets the cache between tests so monkey-patched globals can't leak.                                                                                                                                                                                                                                                                               |
| `PERF-C06` | P1       | `Not started` | Build level-local invalidation for room derivation.                                           | Changes outside a level do not invalidate room derivation for unrelated levels.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PERF-C07` | P1       | `Partial`     | Pre-index axis segments by coordinate and extent.                                             | **"Repeated snapping" half landed (perf-sweep, 2026-05-23):** `quad_closes_rectangle` no longer re-snaps its 8 input endpoints. `axis_aligned_wall_segment` + `axis_aligned_room_separation_segment` snap each AxisSeg tuple's canonical-coord / extent-min / extent-max once at construction, so the inner loop's `uniq.add((snap_mm(px), snap_mm(py)))` was redundant on already-snapped values (the audit's profile recorded ~48.6M `snap_mm` calls under profiling; 8 of those per `quad_closes_rectangle` call lived in this loop). With ~3M `quad_closes_rectangle` calls observed under profiling, that's ~24M `snap_mm` calls dropped from the hot path. "Repeated full candidate checks" half — actively pre-bucketing h/v segments by coordinate so the `combinations(hsegs,2) × combinations(vsegs,2)` enumeration becomes a corner-driven lookup instead of an O(quads) scan — is still open follow-up.                                                                                                                                                                                                         |
| `PERF-C08` | P2       | `Done`        | Add stress fixture for walls + room separations.                                              | `build_room_stress_fixture` (24x14 grid w/ row+col `RoomSeparationElem`s) in `app/scripts/performance_budget.py:254-266`; CI budget `room_stress.room_derivation=1500ms`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PERF-C09` | P2       | `Partial`     | Split blocking constraints from documentation advisories.                                     | `evaluate(..., documentation_advisors=True)` now exposes a gate that wraps nine info-only advisor passes (`_agent_brief_advisory_violations`, `_exchange_advisory_violations`, `_gltf_manifest_closure_advisory_violations`, `_plan_view_tag_style_advisor_violations`, `_room_color_scheme_advisory_violations`, `_section_on_sheet_advisory_violations`, `_monitored_source_drift_advisory_violations`, `_dormer_overflow_advisory_violations`, `constructability_advisory_violations`). Default is `True` so snapshot / evidence / validate / schedule routes are unchanged; passing `False` keeps the blocking/error passes (room-boundary-open, toposolid-pierce) and drops the info-only ones. Regression test `tests/test_constraints_evaluation_documentation_advisors_gate.py` asserts `documentation_advisors=False` never adds rows and preserves the blocking/error set. **Caller wiring is the remaining work** — `_commit_violations` and the hosted-opening optimistic paths can opt in now that the infrastructure exists; left untouched in this commit so each opt-in can be reasoned about individually. |

### D. Evidence Package And Reporting

| ID         | Priority | Status        | Item                                                                           | Acceptance                                                                                                                                                                                                                                                                                        |
| ---------- | -------- | ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-D01` | P0       | `Done`        | Add request-scoped evidence context/cache object.                              | HTTP requests now share request-scoped room-boundary, schedule-table, and plan-projection caches with defensive copies; full backend budget run still passes.                                                                                                                                     |
| `PERF-D02` | P0       | `Done`        | Reduce `/evidence-package` to under 1 s on current small model.                | Current seed is about 0.48-0.63 s, and the synthetic small fixture budget is under 1.5 s in CI.                                                                                                                                                                                                   |
| `PERF-D03` | P0       | `Done`        | Remove repeated room-boundary derivation from sheet evidence for current seed. | Current seed evidence package observed one room-boundary derivation call; keep regression coverage before treating this as scale-complete.                                                                                                                                                        |
| `PERF-D04` | P1       | `Done`        | Cache schedule table derivation inside evidence package.                       | Each schedule id plus room-boundary bundle is derived once per request and reused by evidence/sheet callers.                                                                                                                                                                                      |
| `PERF-D05` | P1       | `Done`        | Cache plan projection wire sample inside evidence package.                     | Each `(planViewId, fallbackLevelId, presentation, crop)` projection is resolved once per request and reused by evidence/sheet callers.                                                                                                                                                            |
| `PERF-D06` | P1       | `Done`        | Provide evidence-package modes.                                                | `/api/models/{id}/evidence-package?mode=summary` short-circuits before the deterministic*Evidence + evidenceClosureReview + agentReview*/agentBrief\* chain. `default` is back-compat; `full` is reserved for verbose debug. Invalid modes return 400.                                            |
| `PERF-D07` | P1       | `Not started` | Make full evidence package asynchronous or job-backed if still expensive.      | Long-running full evidence generation returns job id/progress instead of blocking UI request.                                                                                                                                                                                                     |
| `PERF-D08` | P2       | `Done`        | Add evidence package perf gate to Agent Review.                                | Server stamps every evidence-package response with `_packageGenerationMs` + `_packageGenerationBudgetMs` + `_packageGenerationOverBudget`; `EvidenceArtifactCorrelationPanel` renders a real wall-clock line that turns amber + bold when over budget (replaced the legacy "advisory mock" note). |

### E. Snapshot, Websocket, And Collaboration

| ID         | Priority | Status        | Item                                                            | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | -------- | ------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-E01` | P0       | `Done`        | Bypass Vite websocket proxy for app websocket in dev.           | Dev websocket URLs resolve directly to the API port with `VITE_API_WS_BASE` override support, and benign Vite proxy `EPIPE`/`ECONNRESET` errors are quieted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PERF-E02` | P0       | `Done`        | Prevent backend traceback on initial websocket send disconnect. | Initial websocket bootstrap send is inside disconnect handling and unregisters cleanly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PERF-E03` | P0       | `Done`        | Remove duplicate REST + websocket snapshot bootstrap.           | After REST snapshot load, websocket can connect in delta/resume-only mode without sending another full snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PERF-E04` | P1       | `Done`        | Add websocket bootstrap timing telemetry.                       | `websocket_loop` emits structured JSON via `bim_ai.ws_bootstrap` for all four bootstrap modes (snapshot/skip/resume-RESYNC/resume-replay) with model_id, revision, element_count, violations_count, violations_ms, send_ms, total_bootstrap_ms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `PERF-E05` | P1       | `Partial`     | Implement per-socket send tasks/queues.                         | `Hub.broadcast_json` now fans out concurrently via `asyncio.gather` (commit `d54bf777`), so a single slow websocket cannot stall the broadcast to other clients — verified by `test_broadcast_json_fans_out_concurrently`. A full per-socket queue/task model (decoupling broadcast latency entirely from any single socket via dedicated sender tasks + bounded queues) is the remaining work; whether it is still needed depends on production load profiles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `PERF-E06` | P1       | `Done`        | Add large-delta/presence backpressure policy.                   | `Hub.broadcast_json` now combines two backpressure signals: depth-based (`BACKPRESSURE_THRESHOLD = 8` in-flight sends → close with 1011, pre-existing) AND age-based (`SEND_AGE_LIMIT_SECONDS = 5.0` — if the oldest in-flight send for a socket exceeds this, the next broadcast attempt force-closes the socket). The age signal catches the wedged-TCP case where exactly one `ws.send_json` hangs forever and depth stays pinned at 1, silently swallowing all subsequent broadcasts. `_send_oldest_started_at` is populated when depth transitions 0 → 1 and cleared when depth returns to 0 (also cleared in `unregister`). Regression test `test_age_based_backpressure_closes_wedged_socket` monkey-patches the limit down to 20 ms and asserts a hung-send socket is closed with 1011 on the next broadcast. Full per-socket queue/stream model (separate sender tasks + bounded queues) is left as future work behind PERF-E05; current detection-and-evict policy matches the acceptance bar. |
| `PERF-E07` | P2       | `Not started` | Compress or slim initial websocket snapshot.                    | Snapshot payload avoids duplicate fields and can use HTTP snapshot plus websocket deltas for cold start.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### F. Plan Projection And Schedule Caching

| ID         | Priority | Status | Item                                                                            | Acceptance                                                                                                                                                                                                                                                                   |
| ---------- | -------- | ------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-F01` | P0       | `Done` | Add server-side plan projection cache by revision and params.                   | Repeated projection requests for the same revision/plan/presentation return from cache.                                                                                                                                                                                      |
| `PERF-F02` | P0       | `Done` | Add client-side projection request dedupe and `AbortController`.                | Rapid revision/view changes cancel stale fetches and avoid setting stale projection state.                                                                                                                                                                                   |
| `PERF-F03` | P1       | `Done` | Add projection timing metadata in debug mode.                                   | `/projection/plan?debug=true` returns `_perfDebug` (totalMs, cacheHit, docValidateMs, projectionMs, primitiveCount); debug requests bypass the cross-request cache so timings reflect actual recomputation.                                                                  |
| `PERF-F04` | P1       | `Done` | Add server-side schedule table cache by revision and schedule id.               | `_SCHEDULE_TABLE_CACHE` in `app/bim_ai/routes/api.py` keys on `(model_id, revision, schedule_id, lightweight)` with the same LRU shape as `_PLAN_PROJECTION_CACHE`.                                                                                                          |
| `PERF-F05` | P1       | `Done` | Add client schedule table cache.                                                | `packages/web/src/schedules/scheduleTableCache.ts` exposes `fetchScheduleTable()` with an LRU keyed by (modelId, scheduleId, revision, lightweight). `SchedulePanel` consumes it; revision changes invalidate via the effect deps. AbortController replaces the cancel flag. |
| `PERF-F06` | P1       | `Done` | Avoid full room closure payload in schedule table when caller does not need it. | `derive_schedule_table(..., lightweight=True)` + route `?lightweight=true` skip `peer_finish_set_by_level` and `room_finish_schedule_row_extensions` for room/finish categories. Cache key carries the lightweight axis to avoid collisions.                                 |
| `PERF-F07` | P2       | `Done` | Add projection/schedule CI budgets.                                             | `small.plan_projection=250ms`, `schedule_heavy.{room,door,window}_schedule`, `documentation_heavy.plan_projection=500ms` already enforced (`app/scripts/performance_budget.py:37-44`).                                                                                       |

### G. Frontend State, Selectors, And Derived Indices

| ID         | Priority | Status    | Item                                                                      | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------- | --------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-G01` | P0       | `Done`    | Inventory direct `elementsById` subscriptions.                            | `scripts/inventory-elementsById-consumers.mjs` scans `packages/web/src` for 4 patterns: `store_selector_elementsById` (direct `useBimStore((s) => s.elementsById)`), `store_getstate_elementsById` (`useBimStore.getState().elementsById`), `object_values_elementsById` (high-severity scan candidates), and `object_values_elements`. Generated artifacts committed at `spec/generated/elementsById-inventory.{md,json}` — current scan: 383 matches (314 high severity, dominated by 299 `Object.values(elementsById)` callsites still pending migration). Run via `node scripts/inventory-elementsById-consumers.mjs --out-md spec/generated/elementsById-inventory.md --out-json spec/generated/elementsById-inventory.json` (supports `--fail-high-above N` for future CI gating).                                                                                                                                                                                                                                                                                                                                                                                          |
| `PERF-G02` | P0       | `Done`    | Add derived model indices to store/selectors.                             | Store exposes `all`, `levels`, `walls` (flat), `wallsByLevel`, `roomsByLevel`, `floorsByLevel`, `columns` (flat), `columnsByLevel`, `placedAssetsByLevel`, `beams` (flat), `openingsByWall`, `planViews`, `schedules`, `sheets`, `projectSettings`, `projectBasePoint`, and `selectableIds`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PERF-G03` | P1       | `Partial` | Migrate `Workspace` off broad full-model scans for common derived values. | `Workspace.tsx` `sheetPages` + `levels` now subscribe to `modelIndices.sheets` / `modelIndices.levels` (commit `67b6eca6`). **Structural blocker resolved (perf-sweep, 2026-05-23):** `installModelIndicesInvariant` in `store.ts` subscribes to every `elementsById` change and rebuilds `modelIndices` when a caller (viewport-filter writers in `storeViewportRuntimeSlice`, the ~20 client-only writes in `useWorkspaceSemanticCommand`) updates `elementsById` without explicitly refreshing `modelIndices`. Hot paths (`hydrateFromSnapshot`, `applyDelta`, `mergeElements`) still rebuild inline so the subscriber no-ops there. Future Workspace migrations to narrow `modelIndices.*` reads are now safe through filter writes. Five Workspace.tsx scans remain (commandPaletteEntities, palettePlanTemplates, showEmptyState, projectNorthAngleDeg's project_base_point lookup, driftCount); first three need additional modelIndices fields (`viewpoint`, `saved_view`, `section_cut`, `view_template`, `wallCount`). The in-place migration of Workspace.tsx itself is owned by the time-travel + inspector agent per `~/bim-ai-prompts/1-perf-sweep.md` constraints. |
| `PERF-G04` | P1       | `Partial` | Migrate `PlanCanvas` interaction paths to indices.                        | `planCanvasClickHandler.ts` is fully migrated — all 8 `Object.values(elementsById)` scans replaced by `modelIndices` reads across `0ee6f39a` + `50cf1cad`. **Snap + hover hot paths landed (perf-sweep, 2026-05-23):** `updatePlanCanvasSnapHover` (called on every pointermove) now consumes `modelIndices.wallsByLevel[displayLevelId]` instead of `Object.values(elementsById).filter(wall)`. `nearestWallAt` (8 call sites across click + hover handlers) was hoisted off `elementsById` to take a pre-filtered `walls` slice; callers pass `wallsByLevel[displayLevelId] ?? modelWalls`. `updateSplitWallHover` + `handleDoorWindowToolClick` migrated to the same contract. `updateComponentGhostHover` lost its `Object.values(...).find(id)` (collapsed to a direct dictionary lookup). PlanCanvas.tsx parent still subscribes to broad `elementsById` for sibling render-pass paths. Tags + dimensions paths still pending (their callers in `Workspace.tsx` are owned by the time-travel + inspector agent).                                                                                                                                                            |
| `PERF-G05` | P1       | `Partial` | Migrate `Viewport` placement/conflict paths to indices.                   | `Viewport.tsx` georeferenceKey + georeference + walkLevels + direct3dDraftLevelName now consume `modelIndices.projectSettings` / `modelIndices.levels` (4 full-model scans removed). **3D draft wall-snap landed (perf-sweep, 2026-05-23):** the `snapWallPointToConnectivity` call inside `projectDraftPointToScene` now reads `modelIndices.wallsByLevel[levelInfo.id]` via a ref-mirror instead of `Object.values(elementsByIdRef.current).filter(wall && levelId)` on every pointermove during direct-3d wall drafting; `snapWallPointToConnectivity` + `collectWallConnectivity` accept `readonly WallConnectivityWall[]` to match. Hosted-opening conflict + `wallJoinDisplay.wall3dDisallowedJoinEndpoints` + `roofHeightSampler.roofHeightAtPoint` + dormer/material/dwg scans (~30 in `packages/web/src/viewport/`) still pending; most run per-element during mesh rebuild rather than per pointermove, so leverage is lower than the snap path.                                                                                                                                                                                                                        |
| `PERF-G06` | P1       | `Done`    | Add selector equality strategy.                                           | `packages/web/src/state/useShallowSelector.ts` re-exports zustand v5's `useShallow` as the canonical primitive; regression test asserts three consecutive set() calls produce zero extra renders when projected fields don't change. Broader adoption is bundled with G03/G04/G05 migrations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PERF-G07` | P2       | `Done`    | Add frontend render-count instrumentation in dev.                         | `packages/web/src/state/renderCountProbe.ts` exposes `useRenderCount(name)`; wired into Workspace, PlanCanvas, Viewport. Counts accumulate in `window.__BIM_AI_RENDER_COUNTS__` (auto-on in DEV). Pairs with PERF-M04.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### H. 2D Plan Canvas Interaction Performance

| ID         | Priority | Status    | Item                                                                | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | -------- | --------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-H01` | P0       | `Partial` | Add pointermove budget measurement for PlanCanvas.                  | Dev instrumentation `packages/web/src/plan/planPointerMovePerformance.ts` wired into `PlanCanvas.tsx`; `pnpm performance:plan-pointermove` script not present in `packages/web/package.json` yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PERF-H02` | P1       | `Partial` | Add spatial index for plan picking and snapping.                    | `packages/web/src/plan/spatialIndex.ts` ships a generic `WallSpatialIndex<T>` (grid-bucket, configurable cell size, dedups multi-cell items, `bboxFromSegment` helper folds in snap tolerance). Tests in `spatialIndex.test.ts` cover range / near queries, multi-cell dedup, stats diagnostics, the rejection of non-positive cell sizes, and a contract test that a 1024-wall fixture returns < 50 candidates from `queryNear()`. The library is ready for snap / hover migration: once `modelIndices` exposes a cached `wallSpatialIndex` (or `nearestWallAt` accepts an `index` argument), the hot paths can switch without changing their signatures. End-to-end wiring + the dependent fixture work belongs to a follow-up paired with PERF-H05's e2e half.                                                                                                                   |
| `PERF-H03` | P1       | `Done`    | Avoid `Object.values(elementsById)` inside high-frequency handlers. | All pointermove paths in PlanCanvas.tsx (`snapped` wall-tool topology snap + `updatePlanCanvasSnapHover` + `updateSplitWallHover` + `updateComponentGhostHover`) and Viewport.tsx (`projectDraftPointToScene → snapWallPointToConnectivity`) now consume `modelIndices.wallsByLevel[displayLevelId] ?? modelIndices.walls` (mirrored through refs in Viewport) instead of `Object.values(elementsById).filter(wall && level)`. Verified by `rg "Object.values\\(elementsById\\)" packages/web/src/plan/PlanCanvas.tsx packages/web/src/Viewport.tsx` returning empty. Remaining `Object.values(elementsById)` calls in plan/\* are in render-pass + graph-build code (planCanvasRenderPasses, wallPickLines, planProjection, roomGraph, monitorDriftBadge), which run per render/projection, not per pointermove — those are PERF-G04 broader-scope follow-ups, not H03 acceptance. |
| `PERF-H04` | P1       | `Done`    | Coalesce visual hover/snap state updates.                           | `packages/web/src/plan/useCoalescedSetter.ts` exposes a generic last-write-wins rAF wrapper. PlanCanvas's `updatePlanCanvasSnapHover` invocation now passes the coalesced `setSnapLabel` + `setSnapGlyphState` so repeated pointermove events within a single frame collapse to one commit; the `setSnapGlyphState` wrapper uses a per-candidate structural equality check (`kind, pxX, pxY, extensionFromPxX/Y, associative, activeIndex`) so a fresh array describing the same semantic snap targets skips the React render entirely. Keyboard / tool-cycle callers (which pass updater functions and run at much lower frequency) keep the raw setters so the SetStateAction surface is unchanged. Regression tests in `useCoalescedSetter.test.ts` cover the coalesce + equality + custom-isEqual paths.                                                                        |
| `PERF-H05` | P2       | `Partial` | Add large-plan fixture.                                             | `build_large_plan_fixture()` (2 levels × 20×12 grid ≈ 1000 walls + 480 rooms + schedules + sheets) in `app/scripts/performance_budget.py` with three CI budgets: `large_plan.room_derivation=5000ms` (current ~2 ms cached after PERF-C05), `large_plan.plan_projection=2000ms` (current ~12 ms), `large_plan.evaluate=6000ms` (current ~3.8 s — surfaces the documentation-advisor scale cliff that PERF-C09's gate plus PERF-B07 wiring will tighten). Backend coverage done; the e2e "open a large plan and assert interaction budget without visual drift" half needs a model-loader fixture so the Playwright spec can hydrate from this Document — left for follow-up.                                                                                                                                                                                                        |

### I. 3D Viewport Rendering Performance

| ID         | Priority | Status        | Item                                                    | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | -------- | ------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-I01` | P0       | `Done`        | Remove React state updates from every orbit movement.   | Camera orientation UI state is deferred/throttled during orbit and flushed immediately on explicit camera/view changes and orbit end.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PERF-I02` | P0       | `Done`        | Convert 3D render loop to demand-driven idle rendering. | `Viewport.tsx` implements demand-driven rendering via a custom `scheduleViewportRender()`/`tick()` pair (`Viewport.tsx:843-2596`): `shouldAnimateViewport()` returns true only during walk/drag/inertia; `tick()` re-arms `scheduleViewportRender` only while animating, so the loop self-terminates at idle. External requests use `requestViewportRenderRef.current?.()`. Verified by `viewport/Viewport.authoringSource.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `PERF-I03` | P1       | `Done`        | Add viewport frame-time instrumentation.                | `packages/web/src/viewport/viewportFrameStats.ts` exposes `recordViewportFrame(renderer, renderMs, intervalMs)`; `Viewport.tsx` `tick()` calls it on every demand-driven render with the wall-clock around `composer.render()` plus the gap since the prior tick. Stats accumulate in `window.__BIM_AI_VIEWPORT_FRAME_STATS__` — frameCount, lastRenderMs, avgRenderMs (EMA α=0.1), avgFrameIntervalMs, fps, plus a `renderer.info` snapshot (drawCalls, triangles, lines, points, geometries, textures, programs). Recording auto-enables in DEV / Vitest; production builds no-op unless `window.__BIM_AI_RECORD_VIEWPORT_FRAME_STATS__` is forced true. Pairs with PERF-G07 render-count probe. Regression tests in `viewportFrameStats.test.ts` cover the per-frame snapshot, the FPS-from-EMA derivation, and the recording gate. Geometry rebuild-time slice (added/changed/removed ids) is still PERF-I04 work.                                                                                                             |
| `PERF-I04` | P1       | `Done`        | Add geometry rebuild timing.                            | `packages/web/src/viewport/viewportRebuildStats.ts` exposes `recordViewportRebuild({addedCount, removedCount, changedCount, extraDirtyCount, rebuildMs})`. Wired into the single useEffect in `useViewportSceneEffects.ts` (the surgical diff-and-rebuild pass that converts an `elementsById` change into O(delta) mesh ops). Stats accumulate in `window.__BIM_AI_VIEWPORT_REBUILD_STATS__` — rebuildCount, last + avg (EMA) rebuild ms, added/removed/changed/extraDirty sizes for the most recent pass, and a running `totalMeshChurn` summing add+remove+change across rebuilds. `extraDirtyCount` tracks the propagation set (e.g. walls dirtying their hosted openings) so callers can separate direct vs. propagated work. Recording auto-enables in DEV / Vitest, off in prod by default. Pairs with I03 (per-frame render time) and G07 (React render counts) — together they give a full hot-path budget probe. Tests in `viewportRebuildStats.test.ts` cover diff capture, EMA-rolled average, and churn accumulation. |
| `PERF-I05` | P1       | `Not started` | Add spatial/raycast acceleration for picking if needed. | Raycast cost remains bounded on medium/large fixtures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PERF-I06` | P2       | `Partial`     | Reuse shared geometries/materials where safe.           | `scripts/inventory-three-allocations.mjs` audits `new THREE.*` allocations under `packages/web/src/viewport/` + `Viewport.tsx`. Current scan (mirrored in `spec/generated/three-allocations-inventory.{md,json}`): 217 total allocations — 116 geometries (57 BoxGeometry, 41 BufferGeometry), 92 materials (42 MeshStandardMaterial, 23 MeshBasicMaterial, 18 LineBasicMaterial), 9 textures. Inventory is the canonical workpiece for follow-on consolidation: a shared `BoxGeometry(1,1,1)` cache + per-color `MeshStandardMaterial` cache would cover most of the high-severity sites, but consolidating each callsite needs case-by-case review since some setters mutate the geometry/material after construction.                                                                                                                                                                                                                                                                                                           |
| `PERF-I07` | P2       | `Partial`     | Add GPU memory leak guard.                              | `packages/web/e2e/perf-gpu-leak-guard.spec.ts` reads `renderer.info.{geometries, textures, programs, drawCalls}` from the PERF-I03 probe before and after a 5-iteration camera-cycle, writes the deltas to `spec/generated/perf-gpu-leak-guard.json`, and fails when either counter grows >25% (with a min-floor of 10 to avoid noise when starting near zero). Opt-in via `PLAYWRIGHT_PERF=1`. Covers the demand-driven render loop's idle settle and camera-cycle path. Real open/close/load/delta cycles need a model-loader fixture so each load can mutate elementsById, which is shared follow-up work with PERF-M03 and PERF-H05.                                                                                                                                                                                                                                                                                                                                                                                           |

### J. Bundle Size And Code Splitting

| ID         | Priority | Status        | Item                                             | Acceptance                                                                                                                                                                                                                                     |
| ---------- | -------- | ------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-J01` | P0       | `Done`        | Record current production bundle baseline.       | Main app chunk is recorded as 4.19 MB minified / 1.08 MB gzip.                                                                                                                                                                                 |
| `PERF-J02` | P0       | `Done`        | Add bundle size budget.                          | `scripts/check-bundle-budgets.mjs` fails CI when entry, largest JS chunk, or total JS gzip budgets regress.                                                                                                                                    |
| `PERF-J03` | P0       | `Done`        | Code split non-default routes.                   | Workspace, family editor, presentation viewer, and icon gallery routes load through `React.lazy`.                                                                                                                                              |
| `PERF-J04` | P1       | `Not started` | Code split heavy panels.                         | Evidence/Agent Review, Sheet Documentation, Schedule focus, Family Library, PDF/export, map/Leaflet surfaces load on demand. Workspace lazy chunk currently 1.75 MB / 437 KB gzip after J05 vendor splits; deeper panel splits still pending.  |
| `PERF-J05` | P1       | `Done`        | Add manual chunks for stable heavy dependencies. | `packages/web/vite.config.ts` `manualChunks` splits vendor-three (153 KB gzip), vendor-pdf (177 KB gzip), vendor-leaflet (43 KB gzip), vendor-i18n (19 KB gzip), vendor-command-palette (3 KB gzip) — Workspace chunk dropped 568→437 KB gzip. |
| `PERF-J06` | P2       | `Done`        | Add bundle analyzer report.                      | `rollup-plugin-visualizer` wired conditionally via `ANALYZE=1 pnpm build` → `dist/bundle-analysis.html` (treemap, gzip + brotli sized). Default builds unaffected.                                                                             |

### K. Monolith Extraction And Render Ownership

| ID         | Priority | Status    | Item                                                                                      | Acceptance                                                                                                                                                                                                                                                            |
| ---------- | -------- | --------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-K01` | P1       | `Partial` | Split `PlanCanvas` into interaction, rendering, projection, and overlays modules.         | LOC-only split landed (`PlanCanvas.tsx` 9334→1897 via SLC-2026 sweep with `planCanvasClickHandler.ts`, `planCanvasHoverHandlers.ts`, `planCanvasRenderPasses.ts`, etc.); parent still threads `elementsById` into siblings, so render-ownership boundary not met yet. |
| `PERF-K02` | P1       | `Partial` | Split `Viewport` into renderer runtime, controls, mesh sync, overlays, and tools modules. | LOC-only split landed (`Viewport.tsx` 6192→2902 with `useViewport*` hooks + `ViewportOverlays.tsx`); camera/orbit, mesh sync, tools still co-located.                                                                                                                 |
| `PERF-K03` | P1       | `Partial` | Split `Workspace` shell from domain panels and command handlers.                          | LOC-only split landed (`Workspace.tsx` 6851→2996 with `WorkspaceLeftRail`, `WorkspaceRightRail`, `useWorkspace*` hooks); top-level still subscribes to `elementsById` (line 199).                                                                                     |
| `PERF-K04` | P2       | `Done`    | Add render ownership docs.                                                                | `spec/methodology/render-ownership.md` documents Workspace/PlanCanvas/Viewport state ownership, store-read dependencies, and expected render frequency contract per pane, plus the G03→G04→G05→G06 roadmap to bring renders down to budget.                           |

### L. Performance UX And Perceived Responsiveness

| ID         | Priority | Status        | Item                                              | Acceptance                                                                                                                                                                                                                                                            |
| ---------- | -------- | ------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-L01` | P0       | `Done`        | Make command pending state explicit.              | UI clearly shows saving state and a pending command count beside the undo stack while authoritative commit/undo/redo is in flight.                                                                                                                                    |
| `PERF-L02` | P0       | `Done`        | Optimistic hosted openings.                       | Door/window/opening placement materializes an optimistic element before the server round trip, command pending state is visible, and undo-stack authority remains backend-owned by design; speculative undo reservation is tracked separately as P1 correctness work. |
| `PERF-L03` | P1       | `Not started` | Make undo/redo stack latency visible and bounded. | Undo depth updates within target budget or shows pending commit state.                                                                                                                                                                                                |
| `PERF-L04` | P1       | `Done`        | Avoid cascading spinners after every command.     | Plan projection (`usePlanProjectionWireSync.ts`) only clears wire data on `!modelId`, never on a revision change; schedule panel (`SchedulePanel.tsx` post-F05) keeps prior data through cancellation thanks to AbortController + cached LRU.                         |
| `PERF-L05` | P2       | `Not started` | Add user-facing degraded-mode warnings.           | Large models can surface reduced rendering/detail modes when budgets are exceeded.                                                                                                                                                                                    |

### M. CI And Regression Gates

| ID         | Priority | Status    | Item                                                   | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------- | --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERF-M01` | P0       | `Done`    | Add backend perf smoke test for current small fixture. | Synthetic small, schedule-heavy, and room-stress fixtures measure evaluate, projection, schedules, evidence, and room derivation in CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PERF-M02` | P0       | `Done`    | Add bundle size check.                                 | Entry gzip, largest JS chunk gzip, and total JS gzip are checked in CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PERF-M03` | P1       | `Done`    | Add Playwright interaction perf traces.                | `packages/web/e2e/perf-interaction-traces.spec.ts` captures all five canonical scenarios opt-in via `PLAYWRIGHT_PERF=1`: `plan-hover` (120 iter), `pan` (20 iter middle-drag), `place-window-hover-only` (40 iter), `place-door-hover-only` (40 iter), `orbit` (20 iter right-drag — exercises the demand-driven render loop and PERF-I02 wake/sleep), `draw-wall` (20 iter click-drag-release). Writes `spec/generated/perf-interaction-traces.json` with `schemaVersion: perf-interaction-traces.v1`. The placement / drawing scenarios run without a model-loader fixture, capturing the pointermove + snap-hover hot paths that dominate cost; once a fixture exists, the inner actions can be swapped for real tool activation without touching the harness shape. |
| `PERF-M04` | P1       | `Done`    | Add render-count regression test harness.              | `packages/web/src/state/renderCountProbe.test.ts` asserts the useRenderCount probe records exactly one sample per render and isolates names. Builds the primitive future per-pane budgets layer on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PERF-M05` | P2       | `Blocked` | Add benchmark trend artifacts.                         | Implementation prepared (perf-budget step writes `--out app/performance-budget-ci.json`; follow-up `actions/upload-artifact@v7.0.1` publishes `performance-budget-{sha}` with `if: always()` + 30-day retention). Push blocked because the Claude Code OAuth token lacks `workflow` scope. Maintainer must apply the change manually or push via a token with workflow scope.                                                                                                                                                                                                                                                                                                                                                                                           |

## Proposed Performance Budgets

These are starting budgets for the current small fixture. They should be revised
once medium and large fixtures exist.

| Path / action                |            Target p50 |            Target p95 |                                                                                          Current |
| ---------------------------- | --------------------: | --------------------: | -----------------------------------------------------------------------------------------------: |
| `/snapshot?expandLinks=true` |             `<150 ms` |             `<300 ms` |                                `~95 ms` warm on current seed; initial baseline was `~236-267 ms` |
| `insertWindowOnWall` commit  |             `<150 ms` |             `<300 ms` |    `~127-151 ms` failed-constraint probe on current seed; initial success path was `~208-217 ms` |
| `/projection/plan`           |             `<100 ms` |             `<250 ms` |                                  `~51-84 ms` on current seed; initial baseline was `~198-217 ms` |
| room schedule table          |             `<100 ms` |             `<250 ms` |                                                                                    `~226-237 ms` |
| `/validate`                  |             `<200 ms` |             `<500 ms` |                                `~137-142 ms` on current seed; initial baseline was `~399-425 ms` |
| `/evidence-package` default  |            `<1000 ms` |            `<1500 ms` |                              `~480-630 ms` on current seed; initial baseline was `~7100-8000 ms` |
| main JS gzip                 |             `<500 KB` | hard fail at `750 KB` |      entry `125 KB` gzip after route split; largest lazy chunk `568 KB`; total JS gzip `1.36 MB` |
| 3D idle render loop          | `0 continuous frames` |                   n/a |                                                         demand-driven after idle render-loop fix |
| pointermove handler          |               `<4 ms` |               `<8 ms` | instrumented by `pnpm performance:plan-pointermove`; current fixture trace still to be collected |

## Recommended Immediate Work Plan

1. `PERF-B06` and `PERF-L03`: design queued/cancelable optimistic undo so
   pending commands can reserve action-stack affordances without undoing the
   wrong authoritative revision.
2. `PERF-F04`: add revision-keyed server caching for schedule table derivation.
3. `PERF-J04`: split heavy workspace panels from the workspace lazy chunk.
4. Add Playwright interaction traces for orbit, pan, hosted opening placement,
   wall drawing, and plan hover.
5. Add benchmark trend artifacts for comparing budget results over time.

## Audit Findings (2026-05-22)

Full code-path audit run on 2026-05-22 surfaced ten new bottlenecks not
covered by existing tracker items. Items are ordered by leverage.

1. **`evaluate()` defeats its own room-boundary cache.** ~~`constraints_evaluation.py:782`
   and `:1620` build a fresh `Document(elements=dict(elements))` before
   calling `compute_room_boundary_derivation`. The C04 request-scoped cache
   keys on `id(doc)` / `id(doc.elements)`, so each `evaluate()` call inside a
   request misses the cache.~~ **Resolved in `ced642f1` (2026-05-23)** —
   `room_derivation` keys on content fingerprint; `evaluate()` no longer
   defensively re-wraps. Measured: evaluate p50 107->84ms; evidence_package
   696->563ms on small fixture.
2. **Cache keys are object-identity, not revision.** ~~Same pattern in
   `room_derivation.py:522`, `schedule_derivation.py:742`,
   `plan_projection_wire.py:1978`.~~ **Resolved across all three in
   `ced642f1` + `72fd43b1` (2026-05-23)** — same content-fingerprint pattern
   applied to schedule + plan-projection request caches. Documentation_heavy
   evidence_package: 14533->12134ms p50 (-16%); schedule_heavy: 8225->7968ms
   (-3%). Read-only contract documented; cross-request caches still deepcopy
   on store.
3. **`deepcopy(bundle)` on every C04 cache hit** ~~(`room_derivation.py:525,527`).
   On the `room_stress` fixture the deepcopy may consume a meaningful share of
   the cited 190-230 ms baseline. Return a frozen view instead.~~ **Resolved
   in `ced642f1` + `72fd43b1` (2026-05-23)** — deepcopy removed from
   room/schedule/plan-projection request caches; callers documented as
   read-only.
4. **`planCanvasClickHandler.ts` is now the dominant full-scan offender.**
   ~~10+ `Object.values(elementsById)` calls (lines 899, 1472, 1484, 1510, 1561,
   1807, 1880, 2321).~~ **Resolved across two commits (2026-05-23):**
   `0ee6f39a` migrated the 4 wall scans (wall-join, wall-opening,
   ceiling-sketch auto-detect) + project-base-point lookup;
   `50cf1cad` closed the remaining 3 (align-element target picker, slab-opening
   host floor lookup, steel-connection beam/column pick) by adding
   `modelIndices.{columnsByLevel, placedAssetsByLevel, floorsByLevel,
columns, beams}`. The file now has zero `Object.values(elementsById)` scans.
   Broader `PERF-G04` acceptance still needs snapping/hover/tag/dimension
   migration in separate handlers.
5. **`Workspace.tsx:199` subscribes to entire `elementsById`.** A single
   element change rerenders the whole workspace shell. Highest-leverage
   `PERF-G03` / `PERF-G06` fix.
6. **`modelIndices` are built but unused.** `buildModelIndices` recomputes
   on every snapshot/load/delta (`storeModelRuntimeSlice.ts:73, 115, 168`)
   yet has zero consumers outside tests. Pure overhead today; becomes
   immediate win as soon as `PERF-G03..G05` land.
7. **`Workspace.tsx:2848, 2866, 2878`** ~~do
   `Object.values(elementsById).find(...'project_settings')` three times in
   adjacent blocks. Trivial migration to `modelIndices.projectSettings`.~~
   **Resolved** — all three call sites now consume `modelIndices.projectSettings`
   (current lines `Workspace.tsx:2851, 2866, 2878`).
8. **`viewport/dormerRoofCut.ts:22,26` and `levelDatums3d.ts:29`** do full
   scans inside the viewport rebuild path. ~~Candidates for `PERF-G05`.~~
   **`levelDatums3d.ts` resolved in `ccb889f0` (2026-05-23)** —
   `resolveLevelDatum3dRows` now takes `modelIndices.levels` directly, and
   the effect's dep array swapped `elementsById` for `modelLevels` so the
   datum group rebuilds only on actual level-set changes (not on viewport
   filter writes). `dormerRoofCut.ts` still open: `applyDormerCutsToRoofGeom`
   is registered through `registerDormerCutFn` and invoked deep inside
   meshBuilders, which has no access to modelIndices today; threading it
   through is a wider refactor.
9. **`build_evidence_package_payload`** ~~(`routes_api.py:1011-1119`) now
   unconditionally derives 10+ heavy artifacts
   (`constructabilitySummary_v1`, `deterministicSheetEvidence`,
   `3dViewEvidence`, `planViewEvidence`, `sectionCutEvidence`,
   `evidenceClosureReview_v1`, `evidenceDiffIngestFixLoop_v1`,
   `bcfTopicsIndex_v1`, `agentReviewActions_v1`, ...). `PERF-D06` summary
   mode should drop the `deterministic*Evidence` + `evidenceClosureReview`
   chain.~~ **Resolved** — `mode=summary` short-circuit lives at
   `routes/api.py:1147-1152`; payload returns before the deterministic\*Evidence
   - evidenceClosureReview chain. The `default` mode (Evidence panel UI) still
     pays the full cost — that is the surface where `documentation_heavy.evidence_package`
     = 12 s p50 is observable. Splitting `default` further or making it
     job-backed is the remaining PERF-D07 work.
10. **`Hub.broadcast_json:118-145`** ~~still iterates clients sequentially
    under `await`. Backpressure (threshold 8) closes slow sockets but no
    per-socket task. One slow client + a large evidence broadcast stalls
    every other connected client.~~ **Resolved in `d54bf777` (2026-05-23)** —
    `broadcast_json` now fans out via `asyncio.gather` over per-socket
    helpers; the depth-based backpressure check + increment is still atomic
    per `_send_one` frame. Regression test asserts 3 slow + 1 fast sockets
    finish in ~50 ms (max) instead of ~150 ms (sum). A full per-socket
    queue/stream model is left for `PERF-E05` if it is still needed beyond
    the gather fan-out.

### Status drift since 2026-05-21

The following statuses were corrected based on the 2026-05-22 audit:

- `PERF-C08` Not started -> Done (`build_room_stress_fixture` already in CI).
- `PERF-F07` Not started -> Done (projection + schedule budgets already
  enforced by `app/scripts/performance_budget.py`).
- `PERF-G01` Done -> Not started (no inventory artifact exists; ~1,358
  `useBimStore` call sites today).
- `PERF-H01` Done -> Partial (instrumentation wired, but
  `pnpm performance:plan-pointermove` script absent from
  `packages/web/package.json`).
- `PERF-I02` stays Done — re-audit confirmed the custom
  `scheduleViewportRender()`/`shouldAnimateViewport()`/`tick()` pair in
  `Viewport.tsx:843-2596` is the demand-driven idle mechanism (covered
  by `viewport/Viewport.authoringSource.test.ts`). The initial audit
  pass mistakenly looked only for `setAnimationLoop(null)` /
  `invalidate` / `needsRender` and missed the custom orchestrator.
- `PERF-K01/K02/K03` Not started -> Partial (LOC-only) (SLC-2026 sweep
  split the three monoliths by LOC budget; render-ownership boundaries
  still pending).

## Commands Used For Initial Measurements

Representative backend endpoint timing:

```bash
for u in \
  'http://127.0.0.1:8500/api/health' \
  'http://127.0.0.1:8500/api/bootstrap' \
  'http://127.0.0.1:8500/api/models/6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2/snapshot' \
  'http://127.0.0.1:8500/api/models/6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2/snapshot?expandLinks=true' \
  'http://127.0.0.1:8500/api/models/6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2/activity' \
  'http://127.0.0.1:8500/api/models/6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2/comments'
do
  curl -sS -w "$u TOTAL:%{time_total} TTFB:%{time_starttransfer} SIZE:%{size_download}\n" \
    -o /dev/null -m 15 "$u"
done
```

Representative production build:

```bash
pnpm --filter @bim-ai/web build
```

Representative backend compute probe:

```bash
cd app
PYTHONPATH=. uv run python <measurement-script>
```

Future work should replace ad hoc scripts with checked-in benchmark commands.

## Open Questions

- What is the target model size for "ordinary professional use" in the near
  term: 500 elements, 5k elements, 50k elements?
- Should nonblocking documentation advisories run synchronously during every
  authoring commit, or can they update asynchronously?
- Is `/evidence-package` intended as an interactive UI route, an agent/report
  route, or a background job route?
- What browser/device class is the baseline for UI performance: modern desktop
  workstation only, or typical laptop?
- What first-load budget is acceptable for local dev versus production?
- Should collaboration be optimized for two local users, small teams, or many
  subscribers?

## Done Definition For This Tracker

This tracker can be considered complete only when:

- common authoring commands feel immediate and pass backend budgets on small and
  medium fixtures;
- evidence package no longer performs repeated whole-document derivations and is
  either fast or explicitly job-backed;
- snapshot and websocket bootstrap do not duplicate full payload/evaluation
  work;
- plan projection and schedule derivation are cached by revision and params;
- frontend major panes avoid broad full-model scans in high-frequency paths;
- the main app bundle is split below the agreed gzip threshold;
- render loops sleep at idle and expose frame/rebuild metrics in dev;
- CI has stable performance budgets for backend, frontend bundle, and core
  browser interactions.
