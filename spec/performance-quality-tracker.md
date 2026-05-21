# BIM AI Performance Quality Tracker

Last updated: 2026-05-21

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

- `spec/code-quality-tracker.md` for broad code health;
- `spec/frontend-monolith-extraction-map.md` for component extraction;
- `spec/bim-integrity-rendering-sketch-methodology-tracker.md` for Advisor,
  BIM integrity, renderer fidelity, and sketch-methodology acceptance;
- `spec/benchmarks/` for benchmark fixtures.

Performance work often overlaps those trackers, but this file owns latency,
throughput, responsiveness, scale, and budget acceptance.

## Grade Summary

Initial grade, based on 2026-05-19 measurements from model
`6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2`:

| Area | Current state | Grade |
| ---- | ------------- | ----- |
| Small-model command authoring | Usable after backend evaluation dedupe; still near the upper bound for "instant" UX. | `B-` |
| Snapshot loading | Acceptable server timing, but likely duplicated via REST + websocket bootstrap. | `B-` |
| Plan projection | About 200 ms per revision; okay now, scale-sensitive. | `C+` |
| Schedule table derivation | Room schedules cost about 230 ms and are fetched from multiple surfaces. | `C` |
| Validation endpoint | About 400 ms on a small model. | `C-` |
| Evidence package | About 7-8 seconds on a small model due repeated room-boundary derivation. | `F` |
| Frontend bundle | Main app chunk is 4.19 MB minified / 1.08 MB gzip. | `D` |
| Frontend state invalidation | Delta store exists, but `elementsById` invalidates many large subscribers. | `C-/D+` |
| 2D/3D interaction scale | Good enough at 169 elements; vulnerable to full-model scans and continuous rendering. | `C` |
| Collaboration/websocket scale | Simple and workable locally; not robust under slow clients or many subscribers. | `C-` |

Initial overall grade:

- current small-model interactive experience: `C+`;
- larger-project readiness: `C-/D+`;
- reporting/evidence path readiness: `F`;
- production-load experience: `D+`.

Current recheck grade, based on 2026-05-20/2026-05-21 measurements from current
seed model `9bb9a145-d9ce-5a2f-a748-bb5be3301b30` (`target-house-3`, revision
`1`, `120` elements):

| Area | Current state after recheck | Grade |
| ---- | --------------------------- | ----- |
| Small-model command/evaluation backend | `evaluate` is about 88-95 ms and a hosted-opening probe reached about 127-151 ms before failing on constraints. | `B` |
| Snapshot loading | Warm snapshot and expanded snapshot are about 95-122 ms for a 146 KB payload. | `A-/B+` |
| Plan projection | About 51-84 ms on `plan-eg` / `EG` projection requests. | `B+` |
| Schedule table derivation | Not re-measured on current seed because it has no schedule elements. | `Unknown` |
| Validation endpoint | About 137-142 ms. | `B` |
| Evidence package | About 0.48-0.63 s and observed one room-boundary derivation call. | `B+` |
| Frontend bundle | Entry chunk is now about 408 KB minified / 125 KB gzip after route splitting; largest lazy chunk is still the workspace at about 2.15 MB minified / 568 KB gzip. | `C+` |
| Frontend state invalidation | Structural risk remains: broad `elementsById` subscriptions and large components. | `C-/D+` |
| 2D/3D interaction scale | Still not empirically measured with browser traces or large fixtures. | `C` |
| Collaboration/websocket scale | No new load test; risk unchanged. | `C-` |

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

| Endpoint / path | Observed result | Grade | Notes |
| --------------- | --------------- | ----- | ----- |
| `/api/health` | about `1-6 ms` | `A` | No concern. |
| `/api/bootstrap` | about `13-20 ms` | `A-` | Small payload; no concern. |
| `/api/models/{id}/snapshot` | about `236-269 ms`, `105171` bytes | `B-` | Dominated by validation/evaluation; acceptable but not cheap. |
| `/api/models/{id}/snapshot?expandLinks=true` | about `236-267 ms`, `105171` bytes | `B-` | Similar to snapshot on this model. |
| `/api/models/{id}/activity` | about `7-10 ms` | `A` | No concern. |
| `/api/models/{id}/comments` | about `6-10 ms` | `A` | No concern. |
| `/api/models/{id}/projection/plan?...` | about `198-217 ms`, `20735` bytes | `C+` | Triggered on revision changes in plan UI. |
| `/api/models/{id}/schedules/room-schedule/table` | about `226-237 ms`, `13403` bytes | `C` | Room schedules derive room-boundary closure. |
| `/api/models/{id}/summary` | about `206-224 ms`, `20945` bytes | `C+` | Uses similar validation/summary work. |
| `/api/models/{id}/validate` | about `399-425 ms`, `21023` bytes | `C-` | Slower than snapshot due repeated/extra validation work. |
| `/api/models/{id}/evidence-package` | about `7.1-8.0 s`, `242262` bytes | `F` | Critical repeated derivation path. |

### Backend Compute Costs

| Operation | Observed result | Grade | Notes |
| --------- | --------------- | ----- | ----- |
| `load_model_row` | about `21-32 ms` | `B` | Database/storage cost is not dominant. |
| `Document.model_validate` | about `0.5 ms` | `A` | Not a bottleneck for current model size. |
| element `model_dump` for snapshot-like payload | about `0.3-0.9 ms` | `A` | Not a bottleneck for current model size. |
| `violations_wire` / `evaluate` | about `200-240 ms` | `C+` | Dominated by room-boundary derivation. |
| `compute_room_boundary_derivation` | about `190-230 ms` | `C+` | The central repeated compute cost. |
| `derive_schedule_table(room-schedule)` | about `197-210 ms` | `C` | Room schedule pulls room-boundary closure. |
| `derive_schedule_table(opening-schedule)` | about `0.0-0.1 ms` | `A` | Non-room schedules are cheap on this model. |
| `try_commit(insertWindowOnWall)` | about `208-217 ms` | `B-` | Mostly one final `evaluate`. |
| transaction metadata after fixes | about `0.2-0.3 ms` | `A` | Previously hidden duplicate evaluation risk removed. |
| delta generation with reused violations | about `0.2-0.3 ms` | `A` | Not a bottleneck after reuse. |

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

| Asset | Size | Gzip |
| ----- | ---- | ---- |
| main app JS `index-*.js` | `4,186.45 KB` | `1,079.35 KB` |
| CSS `index-*.css` | `77.98 KB` | `19.12 KB` |
| `csgWorker-*.js` | `258.26 KB` | not reported by Vite summary |
| `html2canvas.esm-*.js` | `202.38 KB` | `48.04 KB` |
| `leaflet-src-*.js` | `150.05 KB` | `43.59 KB` |
| total `dist` directory | `5.7 MB` | n/a |

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

| Endpoint / path | Recheck result | Prior comparable baseline | Interpretation |
| --------------- | -------------- | ------------------------- | -------------- |
| `/api/models/{id}/snapshot` | warm about `95-122 ms`, first cold-ish samples up to about `510 ms` | about `236-269 ms` | Better after warmup; first request can still be noisy. |
| `/api/models/{id}/snapshot?expandLinks=true` | about `95 ms` warm | about `236-267 ms` | Better. |
| `/api/models/{id}/projection/plan?...` | about `51-84 ms` | about `198-217 ms` | Much better. |
| `/api/models/{id}/summary` | about `52-54 ms` | about `206-224 ms` | Much better. |
| `/api/models/{id}/validate` | about `137-142 ms` | about `399-425 ms` | Much better. |
| `/api/models/{id}/evidence-package` | about `0.48-0.63 s` | about `7.1-8.0 s` | Critical improvement. |

Backend compute timings:

| Operation | Recheck result | Prior comparable baseline | Interpretation |
| --------- | -------------- | ------------------------- | -------------- |
| `load_model_row` | about `26 ms` | about `21-32 ms` | Similar. |
| `Document.model_validate` | about `0.4 ms` | about `0.5 ms` | Similar. |
| element `model_dump` for snapshot-like payload | about `0.3-0.4 ms` | about `0.3-0.9 ms` | Similar. |
| `violations_wire` / `evaluate` | about `88-95 ms` | about `200-240 ms` | Better. |
| `compute_room_boundary_derivation` | about `45-46 ms` | about `190-230 ms` | Much better on current seed. |
| `try_commit(insertWindowOnWall)` probe | about `127-151 ms`, but failed with `constraint_error` on current seed | about `208-217 ms` successful on older model | Faster timing, but not a success-path apples-to-apples comparison. |
| `/evidence-package` room-boundary calls | `1` observed call, about `46 ms` total | about `32` observed calls and about `6.1 s` total | The repeated-derivation failure appears fixed for current seed. |

Production bundle recheck:

| Asset | 2026-05-19 | 2026-05-20/21 | Interpretation |
| ----- | ---------- | -------------- | -------------- |
| main app JS minified | `4,186.45 KB` | `4,317.15 KB` | Worse. |
| main app JS gzip | `1,079.35 KB` | `1,122.95 KB` | Worse. |
| CSS gzip | `19.12 KB` | `19.14 KB` | Similar. |

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

| File | Lines |
| ---- | ----: |
| `packages/web/src/Viewport.tsx` | `6192` |
| `packages/web/src/workspace/Workspace.tsx` | `6851` |
| `packages/web/src/plan/PlanCanvas.tsx` | `9334` |

Risk:

- broad re-renders are expensive to reason about;
- state dependencies are difficult to isolate;
- small UI state changes can invalidate large component trees;
- performance ownership is unclear.

Relevant tracker:

- `spec/frontend-monolith-extraction-map.md`

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

| Status | Meaning |
| ------ | ------- |
| `Done` | Implemented, verified, and protected by a regression budget or test. |
| `Partial` | Some fix exists, but coverage, scale, or budget enforcement is incomplete. |
| `Not started` | No reliable implementation exists. |
| `Blocked` | Needs architectural decision, benchmark fixture, or dependency first. |

| Priority | Meaning |
| -------- | ------- |
| `P0` | User-visible critical latency, multi-second stalls, or known regression risk. |
| `P1` | Required for professional-scale smoothness and predictable interaction. |
| `P2` | Important hardening, scale, and maintainability work. |
| `P3` | Nice-to-have observability, polish, or future-proofing. |

## Milestones

| Milestone | Status | Exit Criteria |
| --------- | ------ | ------------- |
| `PERF-M0` Baseline and tracker | `Done` | This tracker exists with measured baselines, grades, and backlog items. |
| `PERF-M1` Interactive authoring under 150 ms server p50 | `Partial` | Common commands return in under 150 ms p50 and under 300 ms p95 on standard model fixtures. |
| `PERF-M2` Evidence package under 1 s small-model p50 | `Done` | Current seed and the synthetic small fixture run under the budget; schedule-heavy evidence is covered by the backend budget harness. |
| `PERF-M3` Snapshot/bootstrap dedupe | `Not started` | Initial load uses one authoritative bootstrap path and avoids duplicate snapshot/evaluation/hydration. |
| `PERF-M4` Projection/schedule caching | `Not started` | Plan projection and schedule tables use revision-keyed server/client caches with invalidation. |
| `PERF-M5` Frontend selector/index hardening | `Not started` | Main panes consume derived selectors/indices rather than scanning `elementsById` directly for common views. |
| `PERF-M6` 3D/2D interaction budgets | `Not started` | Orbit, hover, pan, snap, and placement remain smooth on scale fixtures; render loop is demand-driven when idle. |
| `PERF-M7` Bundle budget | `Partial` | Entry chunk is below budget and non-default routes are split; the workspace route still needs deeper heavy-panel splitting. |
| `PERF-M8` CI performance gates | `Partial` | Backend compute/evidence budgets and web bundle budgets run in CI; browser interaction budgets are still missing. |

## Tracker Items

### A. Backend Baselines, Instrumentation, And Budgets

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-A01` | P0 | `Done` | Record current measured baselines. | This tracker includes endpoint timings, compute timings, bundle size, and grades from the 2026-05-19 investigation. |
| `PERF-A02` | P0 | `Done` | Add repeatable backend benchmark script. | `app/scripts/performance_budget.py` emits JSON timings and enforces budgets for evaluate, projection, schedules, evidence package, and room derivation. |
| `PERF-A03` | P0 | `Partial` | Add standard performance fixtures. | Synthetic small, schedule-heavy, and room-separation stress fixtures exist; a larger documentation-heavy fixture is still missing. |
| `PERF-A04` | P1 | `Not started` | Add route timing middleware in dev/test. | Slow backend routes log route, model id, revision, elapsed time, and top-level compute phase labels. |
| `PERF-A05` | P1 | `Not started` | Add compute-phase timers for expensive derivations. | Room derivation, schedule derivation, plan projection, sheet evidence, validation, and evidence package expose phase timings in debug logs or optional response metadata. |
| `PERF-A06` | P1 | `Done` | Add CI backend budgets. | CI runs the backend performance budget harness with stable synthetic fixtures and failure thresholds. |
| `PERF-A07` | P2 | `Not started` | Store historical benchmark output. | Benchmark JSON is written to `spec/generated` or artifacts so regressions can be compared over time. |

### B. Command Commit And Undo/Redo Responsiveness

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-B01` | P0 | `Done` | Reuse already-computed violations for command delta/response. | `compute_delta_wire` accepts `violations`; command routes reuse `try_commit` result instead of evaluating again. |
| `PERF-B02` | P0 | `Done` | Remove hidden transaction-metadata full evaluation. | Transaction metadata computes changed/removed/patch ids directly without calling full delta/evaluate. |
| `PERF-B03` | P0 | `Done` | Avoid old-document evaluation unless needed for blocking comparison. | `try_commit` and bundle commit evaluate the previous document only when the new document contains blocking/error violations. |
| `PERF-B04` | P0 | `Partial` | Keep common command server time near 200 ms or lower. | Current `insertWindowOnWall` is about 208-217 ms; target is under 150 ms p50 on small/medium fixtures. |
| `PERF-B05` | P1 | `Not started` | Add interactive command budget tests. | Common commands such as place window, place door, move wall, create wall, move level, and undo/redo have measured budgets. |
| `PERF-B06` | P1 | `Not started` | Separate undo-stack optimistic availability from full authoritative refresh where safe. | UI can show pending undo/redo state immediately while preserving authoritative failure rollback semantics. |
| `PERF-B07` | P1 | `Not started` | Add command-specific validation fast paths. | Simple hosted opening operations avoid full expensive advisors where only nonblocking documentation advisories changed. |
| `PERF-B08` | P2 | `Not started` | Add incremental validation boundary. | Constraint evaluation can receive changed ids and skip unrelated expensive advisors where sound. |

### C. Constraint Evaluation And Room Derivation

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-C01` | P0 | `Done` | Reduce room rectangle enumeration from all 4-combinations to horizontal-pair x vertical-pair. | `compute_room_boundary_derivation` returns same tested behavior and room derivation is about 190-230 ms on current model. |
| `PERF-C02` | P0 | `Done` | Share room-boundary derivation between evaluation and schedule parity in one evaluation. | `constraints_evaluation.evaluate` passes the existing room-boundary bundle to schedule parity. |
| `PERF-C03` | P0 | `Partial` | Identify room derivation as the dominant remaining evaluate cost. | Tracker records measurements; no broader cache/incremental design yet. |
| `PERF-C04` | P0 | `Not started` | Add request-scoped room-boundary cache. | Any route computing the room-boundary bundle more than once per document revision reuses it. |
| `PERF-C05` | P1 | `Not started` | Add document-revision scoped room-boundary cache. | Repeated requests for unchanged model revision reuse safe immutable derivation results. |
| `PERF-C06` | P1 | `Not started` | Build level-local invalidation for room derivation. | Changes outside a level do not invalidate room derivation for unrelated levels. |
| `PERF-C07` | P1 | `Not started` | Pre-index axis segments by coordinate and extent. | Rectangle detection avoids repeated snapping and repeated full candidate checks. |
| `PERF-C08` | P2 | `Not started` | Add stress fixture for walls + room separations. | CI covers runtime scaling with high segment counts below and above the enumeration cap. |
| `PERF-C09` | P2 | `Not started` | Split blocking constraints from documentation advisories. | Interactive commands can run blocking/error checks first and defer expensive info-only documentation advisors where appropriate. |

### D. Evidence Package And Reporting

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-D01` | P0 | `Partial` | Add request-scoped evidence context/cache object. | Current seed evidence package observed one room-boundary derivation call, and synthetic schedule-heavy evidence now has a CI budget; schedule/projection/sheet fragment memoization is still not complete. |
| `PERF-D02` | P0 | `Done` | Reduce `/evidence-package` to under 1 s on current small model. | Current seed is about 0.48-0.63 s, and the synthetic small fixture budget is under 1.5 s in CI. |
| `PERF-D03` | P0 | `Done` | Remove repeated room-boundary derivation from sheet evidence for current seed. | Current seed evidence package observed one room-boundary derivation call; keep regression coverage before treating this as scale-complete. |
| `PERF-D04` | P1 | `Not started` | Cache schedule table derivation inside evidence package. | Each schedule id is derived at most once per evidence package request. |
| `PERF-D05` | P1 | `Not started` | Cache plan projection wire sample inside evidence package. | Each `(planViewId, fallbackLevelId, presentation)` projection is resolved at most once per request. |
| `PERF-D06` | P1 | `Not started` | Provide evidence-package modes. | Route supports `summary`, `default`, and `full` modes so UI panels do not fetch expensive full evidence unless needed. |
| `PERF-D07` | P1 | `Not started` | Make full evidence package asynchronous or job-backed if still expensive. | Long-running full evidence generation returns job id/progress instead of blocking UI request. |
| `PERF-D08` | P2 | `Not started` | Add evidence package perf gate to Agent Review. | UI warns when evidence generation exceeds budget and links to expensive phase diagnostics. |

### E. Snapshot, Websocket, And Collaboration

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-E01` | P0 | `Partial` | Bypass Vite websocket proxy for app websocket in dev. | Dev websocket connects directly to API port and benign proxy errors are quieted. |
| `PERF-E02` | P0 | `Done` | Prevent backend traceback on initial websocket send disconnect. | Initial websocket bootstrap send is inside disconnect handling and unregisters cleanly. |
| `PERF-E03` | P0 | `Not started` | Remove duplicate REST + websocket snapshot bootstrap. | After REST snapshot load, websocket can connect in delta/resume-only mode without sending another full snapshot. |
| `PERF-E04` | P1 | `Not started` | Add websocket bootstrap timing telemetry. | Dev logs show snapshot send time, payload bytes, violations time, replay count, and resume status. |
| `PERF-E05` | P1 | `Not started` | Implement per-socket send tasks/queues. | One slow websocket cannot block broadcast to other clients. |
| `PERF-E06` | P1 | `Not started` | Add large-delta/presence backpressure policy. | Slow clients receive RESYNC or disconnect based on queue size and age, not just synchronous send failure. |
| `PERF-E07` | P2 | `Not started` | Compress or slim initial websocket snapshot. | Snapshot payload avoids duplicate fields and can use HTTP snapshot plus websocket deltas for cold start. |

### F. Plan Projection And Schedule Caching

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-F01` | P0 | `Not started` | Add server-side plan projection cache by revision and params. | Repeated projection requests for the same revision/plan/presentation return from cache. |
| `PERF-F02` | P0 | `Not started` | Add client-side projection request dedupe and `AbortController`. | Rapid revision/view changes cancel stale fetches and avoid setting stale projection state. |
| `PERF-F03` | P1 | `Not started` | Add projection timing metadata in debug mode. | Plan projection response can include optional phase timings and primitive counts. |
| `PERF-F04` | P1 | `Not started` | Add server-side schedule table cache by revision and schedule id. | Repeated `/schedules/{id}/table` requests for unchanged revision reuse cached derivation. |
| `PERF-F05` | P1 | `Not started` | Add client schedule table cache. | SchedulePanel and ModeShells share a cache instead of independently refetching the same table. |
| `PERF-F06` | P1 | `Not started` | Avoid full room closure payload in schedule table when caller does not need it. | Schedule endpoint supports a mode that omits expensive room programme closure/evidence for lightweight grid display. |
| `PERF-F07` | P2 | `Not started` | Add projection/schedule CI budgets. | Stable plan and schedule fixtures have timing thresholds. |

### G. Frontend State, Selectors, And Derived Indices

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-G01` | P0 | `Not started` | Inventory direct `elementsById` subscriptions. | Generated report lists components subscribing to full model state and their derived scans. |
| `PERF-G02` | P0 | `Not started` | Add derived model indices to store/selectors. | Store exposes levels, walls by level, openings by wall, schedules, sheets, project settings, rooms by level, and selectable ids. |
| `PERF-G03` | P1 | `Not started` | Migrate `Workspace` off broad full-model scans for common derived values. | Workspace uses narrow selectors for levels, sheets, schedules, project settings, saved views, and counts. |
| `PERF-G04` | P1 | `Not started` | Migrate `PlanCanvas` interaction paths to indices. | Snapping, picking, hover, tags, dimensions, walls, and floors use precomputed indices where possible. |
| `PERF-G05` | P1 | `Not started` | Migrate `Viewport` placement/conflict paths to indices. | Hosted opening conflict and level/project-settings lookups avoid repeated full scans. |
| `PERF-G06` | P1 | `Not started` | Add selector equality strategy. | Zustand selectors use stable derived references or shallow equality so unrelated state changes do not wake large consumers. |
| `PERF-G07` | P2 | `Not started` | Add frontend render-count instrumentation in dev. | Major panes can log render count and render cause under a dev flag. |

### H. 2D Plan Canvas Interaction Performance

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-H01` | P0 | `Not started` | Add pointermove budget measurement for PlanCanvas. | Dev benchmark records pointermove handler time for pan, hover, snap, draw wall, place door/window, and tag/dimension interactions. |
| `PERF-H02` | P1 | `Not started` | Add spatial index for plan picking and snapping. | Candidate lookup is sublinear for walls/openings/rooms/tags/dimensions on scale fixtures. |
| `PERF-H03` | P1 | `Not started` | Avoid `Object.values(elementsById)` inside high-frequency handlers. | Pointermove paths use precomputed arrays/indices updated on revision, not per event. |
| `PERF-H04` | P1 | `Not started` | Coalesce visual hover/snap state updates. | Pointermove UI state is updated at animation-frame cadence and only when semantic hover/snap target changes. |
| `PERF-H05` | P2 | `Not started` | Add large-plan fixture. | CI/e2e can open a large plan and assert interaction budget without visual drift. |

### I. 3D Viewport Rendering Performance

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-I01` | P0 | `Partial` | Remove React state updates from every orbit movement. | Camera orientation UI state is deferred/throttled during orbit and flushed on end. |
| `PERF-I02` | P0 | `Not started` | Convert 3D render loop to demand-driven idle rendering. | Renderer runs continuously during orbit/walk/animation/resize/hover when needed, but sleeps at idle. |
| `PERF-I03` | P1 | `Not started` | Add viewport frame-time instrumentation. | Dev overlay/log can report FPS, frame time, draw calls, geometries, textures, and rebuild counts. |
| `PERF-I04` | P1 | `Not started` | Add geometry rebuild timing. | Mesh rebuild effect reports added/changed/removed ids, dirty ids, rebuild time, and disposal count. |
| `PERF-I05` | P1 | `Not started` | Add spatial/raycast acceleration for picking if needed. | Raycast cost remains bounded on medium/large fixtures. |
| `PERF-I06` | P2 | `Not started` | Reuse shared geometries/materials where safe. | Repeated element classes do not allocate unnecessary duplicate materials/geometries. |
| `PERF-I07` | P2 | `Not started` | Add GPU memory leak guard. | Repeated open/close/load/delta cycles do not grow geometries, textures, materials, or renderer memory. |

### J. Bundle Size And Code Splitting

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-J01` | P0 | `Done` | Record current production bundle baseline. | Main app chunk is recorded as 4.19 MB minified / 1.08 MB gzip. |
| `PERF-J02` | P0 | `Done` | Add bundle size budget. | `scripts/check-bundle-budgets.mjs` fails CI when entry, largest JS chunk, or total JS gzip budgets regress. |
| `PERF-J03` | P0 | `Done` | Code split non-default routes. | Workspace, family editor, presentation viewer, and icon gallery routes load through `React.lazy`. |
| `PERF-J04` | P1 | `Not started` | Code split heavy panels. | Evidence/Agent Review, Sheet Documentation, Schedule focus, Family Library, PDF/export, map/Leaflet surfaces load on demand. |
| `PERF-J05` | P1 | `Not started` | Add manual chunks for stable heavy dependencies. | Three.js, Leaflet, html2canvas/jsPDF, command registry, and large feature modules are split where appropriate. |
| `PERF-J06` | P2 | `Not started` | Add bundle analyzer report. | A generated report identifies top modules in the main chunk. |

### K. Monolith Extraction And Render Ownership

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-K01` | P1 | `Not started` | Split `PlanCanvas` into interaction, rendering, projection, and overlays modules. | High-frequency interaction code is isolated from broad UI rendering. |
| `PERF-K02` | P1 | `Not started` | Split `Viewport` into renderer runtime, controls, mesh sync, overlays, and tools modules. | Camera/orbit changes no longer risk re-rendering unrelated UI/tool code. |
| `PERF-K03` | P1 | `Not started` | Split `Workspace` shell from domain panels and command handlers. | Top-level workspace rerenders are reduced and easier to profile. |
| `PERF-K04` | P2 | `Not started` | Add render ownership docs. | Each large pane documents which state it owns, which selectors it consumes, and its expected render frequency. |

### L. Performance UX And Perceived Responsiveness

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-L01` | P0 | `Not started` | Make command pending state explicit. | UI clearly shows when a command is pending authoritative commit without blocking visual feedback. |
| `PERF-L02` | P0 | `Partial` | Optimistic hosted openings. | Door/window/opening placement can materialize an optimistic element, but undo/action-stack state still waits for backend response. |
| `PERF-L03` | P1 | `Not started` | Make undo/redo stack latency visible and bounded. | Undo depth updates within target budget or shows pending commit state. |
| `PERF-L04` | P1 | `Not started` | Avoid cascading spinners after every command. | Projection/schedule refreshes should not reset whole panels unless data actually changes or is stale. |
| `PERF-L05` | P2 | `Not started` | Add user-facing degraded-mode warnings. | Large models can surface reduced rendering/detail modes when budgets are exceeded. |

### M. CI And Regression Gates

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `PERF-M01` | P0 | `Done` | Add backend perf smoke test for current small fixture. | Synthetic small, schedule-heavy, and room-stress fixtures measure evaluate, projection, schedules, evidence, and room derivation in CI. |
| `PERF-M02` | P0 | `Done` | Add bundle size check. | Entry gzip, largest JS chunk gzip, and total JS gzip are checked in CI. |
| `PERF-M03` | P1 | `Not started` | Add Playwright interaction perf traces. | Orbit, pan, place window, place door, draw wall, and plan hover collect browser timing traces. |
| `PERF-M04` | P1 | `Not started` | Add render-count regression test harness. | Development/test mode can assert major panes do not render unexpectedly on simple deltas. |
| `PERF-M05` | P2 | `Not started` | Add benchmark trend artifacts. | CI uploads benchmark JSON/HTML summaries for comparison across commits. |

## Proposed Performance Budgets

These are starting budgets for the current small fixture. They should be revised
once medium and large fixtures exist.

| Path / action | Target p50 | Target p95 | Current |
| ------------- | ---------: | ---------: | ------: |
| `/snapshot?expandLinks=true` | `<150 ms` | `<300 ms` | `~95 ms` warm on current seed; initial baseline was `~236-267 ms` |
| `insertWindowOnWall` commit | `<150 ms` | `<300 ms` | `~127-151 ms` failed-constraint probe on current seed; initial success path was `~208-217 ms` |
| `/projection/plan` | `<100 ms` | `<250 ms` | `~51-84 ms` on current seed; initial baseline was `~198-217 ms` |
| room schedule table | `<100 ms` | `<250 ms` | `~226-237 ms` |
| `/validate` | `<200 ms` | `<500 ms` | `~137-142 ms` on current seed; initial baseline was `~399-425 ms` |
| `/evidence-package` default | `<1000 ms` | `<1500 ms` | `~480-630 ms` on current seed; initial baseline was `~7100-8000 ms` |
| main JS gzip | `<500 KB` | hard fail at `750 KB` | entry `125 KB` gzip after route split; largest lazy chunk `568 KB`; total JS gzip `1.36 MB` |
| 3D idle render loop | `0 continuous frames` | n/a | likely continuous |
| pointermove handler | `<4 ms` | `<8 ms` | not measured |

## Recommended Immediate Work Plan

1. `PERF-D01`, `PERF-D04`, and `PERF-D05`: finish schedule/projection/sheet
   memoization inside evidence package after the schedule-heavy CI budget.
2. `PERF-E03`: stop double snapshot bootstrapping.
3. `PERF-F01` and `PERF-F04`: add revision-keyed server caches for plan
   projection and schedule table derivation.
4. `PERF-J04`: split heavy workspace panels from the workspace lazy chunk.
5. `PERF-G01` and `PERF-G02`: generate an `elementsById` subscription/scan
   report and introduce derived indices.
6. `PERF-I02`: make 3D rendering demand-driven when idle.
7. Expand the benchmark fixture set with a larger documentation-heavy model and
   trend artifacts.

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
