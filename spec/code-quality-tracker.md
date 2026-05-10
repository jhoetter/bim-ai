# BIM AI — Code Quality Tracker

Tracks architectural debt and robustness gaps surfaced by a PE-style audit on 2026-05-07. Production-readiness items (auth, deploy, observability, migrations) are out of scope here — handled separately.

Last reconciled: 2026-05-10 after CI run `25622305508` passed on `main`.

This tracker is for the code-quality items only:

- Realtime/WS robustness gaps
- Python dependency pinning + lockfile
- `packages/web/src/workspace/` junk-drawer (164 files at one level)
- Flat `app/bim_ai/` package + 3 large central modules (`engine.py`, `constraints.py`, `export_ifc.py`)
- Monolithic 2,137-LOC zustand store

## Current Snapshot

| ID    | Status    | Current state                                                                                                                                                                         |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CQ-01 | `done`    | Sequenced WebSocket publish path, bounded replay buffer, resume/RESYNC flow, client reconnect/backoff, and regression coverage are merged and green.                                  |
| CQ-02 | `done`    | `uv.lock`, bounded Python deps, frozen installs, and lockfile CI checks are merged and green.                                                                                         |
| CQ-03 | `partial` | `workspace/agent/` now owns the agent review pane, agent readouts/actions, and their tests; the root workspace directory is down from 164 to 150 files.                               |
| CQ-04 | `partial` | Multiple cohesive helper modules have been extracted from `constraints.py`, `engine.py`, and `export_ifc.py`; the large source files still exist and are not thin shims.              |
| CQ-05 | `partial` | Typed slice contracts and tests exist; plan authoring, collaboration, workspace UI, and viewport runtime slice factories are extracted while the stable `useBimStore` facade remains. |

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

**Status:** `open`
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

**Progress 2026-05-10.** Introduced `workspace/agent/` with an `index.ts` public surface. Moved the agent review pane, agent brief/readout/action helpers, freshness render test, and colocated unit tests into the folder. Updated `workspace/review/` imports to consume the agent public surface. Root `workspace/` files dropped from 164 to 150.

---

## CQ-04 — Split Python god-files (`engine.py`, `constraints.py`, `export_ifc.py`)

**Status:** `partial`
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
- `engine.py`: extracted `engine_plan_mesh.py`, `engine_mirror.py`, `engine_visibility.py`, and `engine_wall_helpers.py`, preserving existing `bim_ai.engine` imports and reusing focused regression coverage.
- `engine.py`: extracted pure replay diagnostics constants/builders into `engine_replay_diagnostics.py`, preserving existing `bim_ai.engine` imports and replay diagnostics regression coverage.

**Latest verification.** Full backend suite passed after the latest CQ-04 slice: `2476 passed, 93 skipped, 1 deselected` with total coverage `75.83%`; each pushed workpackage passed GitHub CI on `main`.

**Remaining work.** Continue extracting dispatch/replay/preflight-heavy engine code, IFC authoritative replay/import-preview code, and constraint evaluation/validation bodies until the original files are thin compatibility shims or replaced by packages.

---

## CQ-05 — Slice the zustand store (`packages/web/src/state/store.ts`, 2,137 LOC)

**Status:** `partial`
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

**Progress 2026-05-10.** Added explicit typed slice contracts for the stable `useBimStore` facade: model, viewport, plan authoring, collaboration, and workspace UI. Added regression coverage that exercises each slice's basic mutations through the public hook. Extracted plan authoring, collaboration, and workspace UI runtime slice factories into `storeRuntimeSlices.ts`, then moved viewport runtime state/actions into `storeViewportRuntimeSlice.ts`. The public selector API remains stable and no store uses dynamic imports.

---

## Remaining Sequence

1. **CQ-04** — keep extracting narrow, tested helper clusters until `engine.py`, `constraints.py`, and `export_ifc.py` become thin shims or packages.
2. **CQ-05** — convert typed slice contracts into real runtime slices inside the stable `useBimStore` facade first, then split truly independent stores.
3. **CQ-03** — reorg `packages/web/src/workspace/` by feature cluster in a quiet window; this is still the highest-churn remaining item.

CQ-03 and CQ-04 are the two remaining items most likely to conflict with parallel agents. Schedule them when those tracks are quiet, or pause the relevant nightshift slots for the merge window.
