# BIM AI — Code Quality Tracker

Tracks architectural debt and robustness gaps surfaced by a PE-style audit on 2026-05-07. Production-readiness items (auth, deploy, observability, migrations) are out of scope here — handled separately.

This tracker is for the code-quality items only:

- Realtime/WS robustness gaps
- Python dependency pinning + lockfile
- `packages/web/src/workspace/` junk-drawer (137 files at one level)
- Flat `app/bim_ai/` package + 3 god-files (~9.95k LOC across 3 files)
- Monolithic 1,692-LOC zustand store

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

**Status:** `partial`
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

**Progress 2026-05-10.** Hub sequencing/replay/backpressure exists and all model-scoped mutation broadcasts now use `Hub.publish(...)` so deltas, comments, activity, job updates, and imports are sequenced and replayable. `Hub` normalizes UUID/string model ids before room, buffer, and presence lookup. The workspace client persists `lastSeq` per model in `sessionStorage`, reconnects with `resumeFrom`, and clears the cursor after `RESYNC`; jobs and presentation sockets now reconnect with bounded exponential backoff. Added regression coverage in `app/tests/test_ws_robustness.py` and `packages/web/src/lib/wsReconnect.test.ts`.

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

## CQ-03 — Reorganise `packages/web/src/workspace/` (137-file junk drawer)

**Status:** `open`
**Severity:** Medium-High (gets worse with every WP)
**Blast radius:** Very high. Hundreds of import paths.

**Problem.** `packages/web/src/workspace/` holds 137 files in a single directory — ~29.5k LOC, ~40% of the entire frontend. The folder is a catch-all for agent panels, evidence/manifest readouts, BCF logic, snapshot machinery, viewport mounting, inspector UI, comments, schedules cross-cutting code, and one-off readout modules. Co-located sibling files have no semantic relationship.

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

---

## CQ-04 — Split Python god-files (`engine.py`, `constraints.py`, `export_ifc.py`)

**Status:** `partial`
**Severity:** High (readability + test isolation)
**Blast radius:** High. Every file that imports from these three.

**Problem.** Three files in `app/bim_ai/` exceed 3,000 LOC each:

- `app/bim_ai/engine.py` — 3,330 LOC, ~52 function defs spanning command dispatch, replay, undo/redo, snapshot diffing.
- `app/bim_ai/constraints.py` — 3,274 LOC mixing constraint evaluation, validation rules, and spatial geometry helpers.
- `app/bim_ai/export_ifc.py` — 3,344 LOC of IFC export logic. Currently excluded from coverage (`pyproject.toml`), which is itself a smell.

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

**Progress 2026-05-10.** Lifted the `bim_ai/export_ifc.py` coverage omit. Full backend pytest passes with `export_ifc.py` included in coverage (`2449 passed, 93 skipped, 1 deselected`; total coverage 74.95%).

**Progress 2026-05-10.** Extracted IFC exchange-scope helpers from `export_ifc.py` into `bim_ai/export_ifc_scope.py` with focused tests for kernel-slice product classification and deterministic level/storey sketches. The broader `export_ifc.py` package split is still open.

**Progress 2026-05-10.** Extracted IFC geometry math helpers from `export_ifc.py` into `bim_ai/export_ifc_geometry.py` with focused tests for polygon metrics, bounds, level elevation lookup, room vertical spans, and wall local-to-world placement.

**Progress 2026-05-10.** Extracted IFC QTO/classification/Pset helpers from `export_ifc.py` into `bim_ai/export_ifc_properties.py`, adding test coverage for common Pset payloads for stairs, columns, beams, ceilings, and railings.

**Progress 2026-05-10.** Extracted reusable constraint polygon geometry helpers from `constraints.py` into `bim_ai/constraints_geometry.py`, preserving legacy private aliases and adding focused tests for polygon area/orientation, concave triangulation, and overlap area.

**Progress 2026-05-10.** Extracted wall/room/opening geometry helpers from `constraints.py` into `bim_ai/constraints_wall_geometry.py`, preserving legacy private aliases and adding focused tests for room edge coverage, interval merging, hosted opening intervals, and wall-joint exemptions.

**Progress 2026-05-10.** Extracted sheet viewport quick-fix constants and extent parsing/repair helpers from `constraints.py` into `bim_ai/constraints_sheet_viewports.py`, preserving legacy private aliases and adding direct tests for dimension parsing, extent repair, and zero-extent labels.

**Progress 2026-05-10.** Extracted static constraint rule metadata and material-catalog advisory maps from `constraints.py` into `bim_ai/constraints_metadata.py`, preserving legacy private exports and adding tests for representative discipline/blocking-class/material mappings.

**Progress 2026-05-10.** Extracted engine plan detail-level mesh helpers from `engine.py` into `bim_ai/engine_plan_mesh.py`, preserving the public `bim_ai.engine` mesh exports and reusing the existing detail-level rendering coverage.

**Progress 2026-05-10.** Extracted engine mirror/reflection helpers from `engine.py` into `bim_ai/engine_mirror.py`, preserving legacy private exports through `bim_ai.engine` and reusing the mirror command regression coverage.

---

## CQ-05 — Slice the zustand store (`packages/web/src/state/store.ts`, 1,692 LOC)

**Status:** `partial`
**Severity:** Medium
**Blast radius:** Medium. Every selector callsite stays valid if we keep the public hook surface; internal store wiring changes.

**Problem.** A single `create()` call holds: hydration state, snapshot/elements, violations, viewer/orbit/visibility, plan tools, collaboration, activity, and category overrides. Hot-reload thrashes the whole tree on any mutation. The store is hard to test in isolation. Derived inline imports (`import('./storeTypes').CategoryOverrides`) suggest the file is fighting circular-dep gravity.

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

**Progress 2026-05-10.** Added explicit typed slice contracts for the stable `useBimStore` facade: model, viewport, plan authoring, collaboration, and workspace UI. Removed the store's dynamic `import('./storeTypes')` type casts and added regression coverage that exercises each slice's basic mutations through the public hook. Runtime slice extraction is still open.

---

## Sequencing recommendation

1. **CQ-02** (Python pinning) — smallest, lowest risk, builds the lockfile-discipline muscle.
2. **CQ-01** (WS robustness) — bounded feature work, real reliability win.
3. **CQ-05** (zustand slices) — start with the in-store slice pattern (no callsite churn), defer extraction.
4. **CQ-04** (Python god-files) — three independent PRs, serialised against nightshift activity.
5. **CQ-03** (workspace/ reorg) — last; multiple sub-PRs by feature cluster. Deserves a quiet week with no parallel agents touching `workspace/`.

CQ-03 and CQ-04 are the two items most likely to conflict with nightshift agents — schedule them when those tracks are quiet, or pause the relevant nightshift slots for the merge window.
