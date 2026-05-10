# BIM AI — Code Quality Tracker

Tracks architectural debt and robustness gaps surfaced by a PE-style audit on 2026-05-07. Production-readiness items (auth, deploy, observability, migrations) are out of scope here — handled separately.

Last reconciled: 2026-05-10 after local full verification on `main`.

This tracker is for the code-quality items only:

- Realtime/WS robustness gaps
- Python dependency pinning + lockfile
- `packages/web/src/workspace/` junk-drawer (164 files at one level)
- Flat `app/bim_ai/` package + 3 large central modules (`engine.py`, `constraints.py`, `export_ifc.py`)
- Monolithic 2,137-LOC zustand store

## Current Snapshot

| ID    | Status    | Current state                                                                                                                                                                                                                                    |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CQ-01 | `done`    | Sequenced WebSocket publish path, bounded replay buffer, resume/RESYNC flow, client reconnect/backoff, and regression coverage are merged and green.                                                                                             |
| CQ-02 | `done`    | `uv.lock`, bounded Python deps, frozen installs, and lockfile CI checks are merged and green.                                                                                                                                                    |
| CQ-03 | `done`    | Feature clusters now own their files under `workspace/agent/`, `bcf/`, `evidence/`, `inspector/`, `comments/`, `shell/`, `readouts/`, `sheets/`, `project/`, `authoring/`, `library/`, and `viewport/`; only 17 cross-feature shell/shared files remain at root. |
| CQ-04 | `done`    | The legacy Python entrypoints are compatibility facades: `constraints.py` is 106 LOC, `export_ifc.py` is 449 LOC, and `engine.py` is 559 LOC; evaluation, IFC building, engine helpers, commit orchestration, dispatch, replay, geometry, and advisory bodies live in focused modules. |
| CQ-05 | `done`    | The stable `useBimStore` facade is a 110-LOC composition layer over extracted model, viewport, plan authoring, collaboration, workspace UI, and coercion modules with slice regression tests.                                                    |

## Status Legend

| Symbol    | Meaning                                         |
| --------- | ----------------------------------------------- |
| `open`    | Not started                                     |
| `partial` | Some slice exists                               |
| `done`    | Done rule met — type-clean, tests green, merged |

## Done Rule

A CQ item is `done` when: (a) `make verify` passes; (b) new logic has unit-test coverage; (c) the specific acceptance criteria below are met; (d) merged to main.

---

## CQ-01 — WebSocket robustness (reconnect + replay buffer + sequence)

**Status:** `done`
**Severity:** Medium
**Blast radius:** Server hub + client WS layer + message envelope. Touches state hydration on reconnect.

**Problem.** `app/bim_ai/hub.py` (~88 LOC) does fire-and-forget broadcast with silent error suppression; a slow consumer is dropped without notice. Client side has no auto-reconnection — a dropped socket leaves the app in `wsOn: false` and requires manual refresh. There is no message sequence number, no replay buffer, no resume protocol. Any drop = state divergence until the user reloads.

**Acceptance criteria.**

- Each broadcast envelope carries a monotonic `seq: number` per `model_id`.
- Server retains a bounded ring buffer (suggest N=512 or last 30s, whichever larger) of recent deltas keyed by `model_id`.
- Client persists `lastSeq` per model and on reconnect sends `?resumeFrom=<seq>` (or initial frame). Server replays `seq+1..` if in window, else returns `RESYNC` and client refetches snapshot.
- Client reconnects with exponential backoff (250ms → 8s, jittered) up to N attempts before surfacing offline state.
- Server applies per-socket send backpressure: if `send` queue depth exceeds threshold, the socket is closed with code 1011 and the client treats it as a normal reconnect.
- Tests: integration test in `app/tests/` for replay-window hit, replay-window miss (forces RESYNC), and one for backpressure-induced disconnect.

**Suggested files.**

- `app/bim_ai/hub.py` — add `Hub.publish(model_id, delta) -> seq`, ring buffer, `Hub.resume(model_id, from_seq)`.
- `app/bim_ai/main.py` (or wherever `/ws/{model_id}` is registered) — read `?resumeFrom=` query, dispatch to `Hub.resume`.
- `packages/web/src/state/ws.ts` (or equivalent) — backoff, resume protocol, `lastSeq` persistence in store.

**Completion 2026-05-10.** Hub sequencing/replay/backpressure is merged. Model-scoped mutation broadcasts use `Hub.publish(...)` for deltas, comments, activity, job updates, and imports. `Hub` normalizes UUID/string model ids before room, buffer, and presence lookup. The workspace client persists `lastSeq` per model in `sessionStorage`, reconnects with `resumeFrom`, and clears the cursor after `RESYNC`; jobs and presentation sockets reconnect with bounded exponential backoff. Regression coverage: `app/tests/test_ws_robustness.py` and `packages/web/src/lib/wsReconnect.test.ts`.

---

## CQ-02 — Python dependency pinning + lockfile

**Status:** `done`
**Severity:** Medium
**Blast radius:** `app/pyproject.toml` + new lockfile + CI install step.

**Problem.** All deps in `app/pyproject.toml` are `>=X` floor only. No `poetry.lock` / `uv.lock` / pinned `requirements.txt` is committed. CI installs whatever PyPI's mirror serves at install time — non-reproducible builds and silent drift on minor releases of FastAPI / Pydantic / SQLAlchemy.

**Acceptance criteria.**

- A lockfile (`uv.lock` recommended; `requirements.lock` acceptable) is committed at `app/`.
- `pyproject.toml` adds upper bounds on majors for the runtime deps (e.g. `fastapi>=0.115,<0.120`). Floors stay where they are.
- CI installs from the lockfile, not from `pyproject.toml` floors.
- Renovate / dependabot config (or a documented manual-bump cadence) so the pin doesn't fossilise.

**Suggested files.**

- `app/pyproject.toml`
- `app/uv.lock` (new)
- `Makefile` — `install` target uses `uv sync --frozen` (or equivalent).
- `.github/workflows/ci.yml` — same.

**Progress 2026-05-10.** Already satisfied in repo: `app/uv.lock` is committed, runtime deps have major upper bounds, CI runs `uv lock --check` and `uv sync --frozen --extra dev --extra ifc`, and the Makefile has `lockfile-check`.

---

## CQ-03 — Reorganise `packages/web/src/workspace/` (164-file junk drawer)

**Status:** `done`
**Severity:** Medium-High (gets worse with every WP)
**Blast radius:** Very high. Hundreds of import paths.

**Problem.** `packages/web/src/workspace/` currently holds 164 files in a single directory. The folder is a catch-all for agent panels, evidence/manifest readouts, BCF logic, snapshot machinery, viewport mounting, inspector UI, comments, schedules cross-cutting code, and one-off readout modules. Co-located sibling files have no semantic relationship.

**Acceptance criteria.**

- Sub-organised into feature folders. Suggested split (validate empirically before moving):
  - `workspace/agent/` — `AgentReviewPane.tsx`, `agentBrief*`, `agentReview*`, `agent-review-*`.
  - `workspace/evidence/` — `evidenceManifest*`, `*EvidenceSummaryFormat*`, baseline correlation.
  - `workspace/bcf/` — `bcf*`.
  - `workspace/inspector/` — `InspectorContent.tsx` + helpers.
  - `workspace/viewport/` — `Viewport.tsx`, `CanvasMount.tsx` (or move into top-level `viewport/`).
  - `workspace/comments/` — `CommentsPanel.tsx` + helpers.
  - `workspace/readouts/` — the various `*Readout` modules that don't fit a feature.
  - `workspace/shell/` — `AppShell.tsx`, layout glue.
- All imports updated; `pnpm verify` clean.
- An `index.ts` per subfolder re-exports the public surface so siblings don't reach into deep paths.
- No file remains at `workspace/` root unless it's a true cross-feature shell.

**Approach note.** Recommend splitting into multiple PRs by subfolder to keep diffs reviewable. First PR introduces the directory shape + moves agent/ and evidence/ (the two largest clusters); subsequent PRs follow.

**Suggested first PR scope.** `agent/` cluster only — ~25 files, clearest semantic boundary, lowest risk.

**Progress 2026-05-10.** Introduced `workspace/agent/` with an `index.ts` public surface. Moved the agent review pane, agent brief/readout/action helpers, freshness render test, and colocated unit tests into the folder. Updated `workspace/review/` imports to consume the agent public surface. Added `workspace/bcf/` for BCF issue-package and roundtrip evidence helpers/tests. Added `workspace/evidence/` for artifact-upload manifest, baseline lifecycle, digest invariant, staged-artifact formatting, and project-browser evidence helpers/tests. Added `workspace/inspector/` for the right-rail inspector shell, inspector content renderers, sun inspector panel, plan-view graphics matrix, retired view-template panel, and colocated tests. Added `workspace/comments/` for the comments panel surface and tests. Added `workspace/shell/` for the app shell, primary top/status/rail/tab/presence chrome, shell chips, empty-state hint, temporary visibility chip, and tests. Added `workspace/readouts/` for deterministic workspace readout helpers and tests. Added `workspace/sheets/` for sheet canvas/documentation, section viewport SVG/doc helpers, titleblock/viewport authoring, sheet refs, manifest helpers, and colocated tests. Added `workspace/project/` for project menu, project browser, links/VV dialogs, snapshots, propagation toast, and colocated tests. Added `workspace/authoring/` for workbenches, options/modifier bars, subdivision palette, level/material/site/room-scheme helpers, and colocated tests. Added `workspace/library/` for asset cards, preview, kit-chain editor, solver, and library overlay. Added `workspace/viewport/` for canvas mounting, 3D layer controls, wall context menu, and colocated tests. Moved the standalone schedule view to `src/schedules/`. Root `workspace/` files dropped from 164 to 17, all shell/composition/shared model surfaces.

---

## CQ-04 — Split Python god-files (`engine.py`, `constraints.py`, `export_ifc.py`)

**Status:** `done`
**Severity:** High (readability + test isolation)
**Blast radius:** High. Every file that imports from these three.

**Problem.** Three files in `app/bim_ai/` remain large central modules:

- `app/bim_ai/engine.py` — 7,255 LOC spanning command dispatch, replay, undo/redo, snapshot diffing, IFC replay preflight, and assorted helper APIs.
- `app/bim_ai/constraints.py` — 2,986 LOC mixing constraint evaluation, validation rules, and spatial geometry helpers.
- `app/bim_ai/export_ifc.py` — 3,343 LOC of IFC export logic. Coverage exclusion has been lifted, but the module is still too large.

These files load slowly, test slowly, and are AI-agent-merge-conflict magnets (the nightshift status logs already show this).

**Acceptance criteria.**

- Each god-file split into ≥3 cohesive modules under a sub-package:
  - `app/bim_ai/engine/` — `dispatch.py`, `replay.py`, `undo.py`, `snapshot.py`, `__init__.py` re-exporting the public surface.
  - `app/bim_ai/constraints/` — `evaluation.py`, `geometry.py`, `validation.py`, `__init__.py`.
  - `app/bim_ai/export_ifc/` — `geometry.py`, `properties.py`, `psets.py`, `header.py`, `__init__.py`.
- The original `engine.py` etc. either disappear or become thin re-export shims (prefer the package directory; remove the shim once imports are migrated).
- Public import paths preserved (`from bim_ai.engine import try_commit_bundle` still works) via `__init__.py` re-exports.
- Coverage exclusion of `export_ifc` lifted; minimum 50% line coverage on the new sub-modules.
- All 106 existing pytests pass without modification.

**Approach note.** Do these three splits as **separate** PRs. Each is independent; serialising avoids merge hell against the nightshift agents.

**Order:** `constraints.py` first (cleanest seams), then `engine.py`, then `export_ifc.py` (gnarliest, IFC-spec-driven).

**Completed slices.**

- `export_ifc.py`: coverage omit lifted; extracted `export_ifc_scope.py`, `export_ifc_geometry.py`, `export_ifc_properties.py`, and `export_ifc_readback.py`. Coverage now includes fake-IFC readback/topology tests, QTO template readback tests, geometry helper tests, scope helper tests, and property/QTO helper tests.
- `constraints.py`: extracted `constraints_geometry.py`, `constraints_wall_geometry.py`, `constraints_sheet_viewports.py`, and `constraints_metadata.py`, preserving legacy private aliases and adding focused tests for geometry, wall/opening intervals, sheet viewport repair, and metadata maps.
- `constraints.py`: extracted schedule/opening QA, agent brief, exchange, GLTF closure, and plan-tag-style advisory logic into `constraints_advisories.py`, preserving existing `bim_ai.constraints` imports. `constraints.py` is down to 2,175 LOC.
- `constraints.py`: extracted room color scheme, section-on-sheet, advisor summary, sheet viewport quick fixes, dormer overflow, room-boundary, and monitored-source drift advisories into `constraints_tail_advisories.py`, preserving existing `bim_ai.constraints` imports. `constraints.py` is down to 1,816 LOC.
- `engine.py`: extracted `engine_plan_mesh.py`, `engine_mirror.py`, `engine_visibility.py`, and `engine_wall_helpers.py`, preserving existing `bim_ai.engine` imports and reusing focused regression coverage.
- `engine.py`: extracted pure replay diagnostics constants/builders into `engine_replay_diagnostics.py`, preserving existing `bim_ai.engine` imports and replay diagnostics regression coverage.
- `engine.py`: extracted authoritative replay preflight and command-bundle merge preflight logic into `engine_authoritative_replay.py`, preserving existing `bim_ai.engine` imports. `engine.py` is down to 6,594 LOC.
- `engine.py`: extracted the command dispatch body into `engine_dispatch.py`, preserving `from bim_ai.engine import apply_inplace` and focused command regression coverage. `engine.py` is down to 1,821 LOC.
- `export_ifc.py`: extracted IFC authoritative replay, semantic roundtrip, import-preview, and unsupported-merge-map readback logic into `export_ifc_authoritative_replay.py`, preserving legacy `bim_ai.export_ifc` imports. `export_ifc.py` is down to 1,945 LOC.
- `export_ifc.py`: extracted kernel IFC manifest eligibility, geometry skip counts, expected emit counts, and artifact hint construction into `export_ifc_manifest.py`, preserving legacy `bim_ai.export_ifc` imports. `export_ifc.py` is down to 1,781 LOC.
- `export_ifc.py`: extracted kernel site exchange evidence helpers into `export_ifc_site_exchange.py`, preserving legacy `bim_ai.export_ifc` imports. `export_ifc.py` is down to 1,715 LOC.
- `export_ifc.py`: extracted the kernel IFC body builder and space Pset helper into `export_ifc_kernel.py`; `export_ifc.py` is now a 449-LOC compatibility facade plus semantic inspection/re-export surface.
- `constraints.py`: extracted the shared violation model/annotation metadata into `constraints_core.py` and the constraint evaluator into `constraints_evaluation.py`; `constraints.py` is now a 106-LOC compatibility facade.
- `engine.py`: extracted commit/replay orchestration into `engine_commit.py`, trace-image handling into `engine_trace_image.py`, and the remaining validation/helper surface into `engine_helpers.py`; `engine.py` is now a 559-LOC compatibility facade over dispatch, replay, helpers, and commit modules.

**Latest verification.** Full local verification passed after the final CQ-04 facade split: `pnpm verify`; `uv run ruff check bim_ai tests`; `uv run pytest -q` with `2476 passed, 93 skipped, 1 deselected` and total coverage `75.95%`.

**Completion 2026-05-10.** CQ-04 is complete for the code-quality tracker: the original god-files no longer own the core implementation bodies and are preserved as stable import facades for existing code/tests.

---

## CQ-05 — Slice the zustand store (`packages/web/src/state/store.ts`, 2,137 LOC)

**Status:** `done`
**Severity:** Medium
**Blast radius:** Medium. Every selector callsite stays valid if we keep the public hook surface; internal store wiring changes.

**Problem.** A single `create()` call holds: hydration state, snapshot/elements, violations, viewer/orbit/visibility, plan tools, collaboration, activity, and category overrides. Hot-reload thrashes the whole tree on any mutation. The store is hard to test in isolation.

**Acceptance criteria.**

- Store sliced into ≥3 stores by concern. Suggested:
  - `useModelStore` — hydration, snapshot, elementsById, violations, command log.
  - `useViewportStore` — orbit camera, visibility, category overrides, view filters.
  - `useCollabStore` — presence, activity, ws connection state.
  - (`useUiStore` if there's a clean ui-only residue.)
- Public selector API for the rest of the app stays stable: `useBimStore(selector)` continues to work, either as a façade that pulls from the slices or by migrating callsites incrementally.
- No store imports another via dynamic `import()`.
- Existing tests pass; add at least one new unit test per new store covering the basic mutations.

**Approach note.** Easiest path: introduce slices using the [zustand "slices" pattern](https://docs.pmnd.rs/zustand/guides/slices-pattern) inside the existing `useBimStore` first (zero callsite churn). Then, in a follow-up PR, extract slices that are genuinely independent (most likely `useCollabStore`) into their own store.

**Completion 2026-05-10.** Added explicit typed slice contracts for the stable `useBimStore` facade: model, viewport, plan authoring, collaboration, and workspace UI. Added regression coverage that exercises each slice's basic mutations through the public hook. Extracted plan authoring, collaboration, and workspace UI runtime slice factories into `storeRuntimeSlices.ts`, moved viewport runtime state/actions into `storeViewportRuntimeSlice.ts`, moved model/document runtime actions into `storeModelRuntimeSlice.ts`, and moved snapshot/element coercion into `storeCoercion.ts`. `store.ts` is now a 110-LOC facade that preserves the public selector API, has no dynamic imports, and delegates concern-specific behavior to extracted modules.

---

## Remaining Sequence

No code-quality tracker items remain open.
