# WP-SKT-01 — Sketch Session Remaining Sub-modes (closeout)

## Branch

`feat/wave-04-skt-01-sketch-modes`

## Goal

Finish the `SketchSession` state-machine sub-modes that the wave3-4 slice deferred: `ceiling`, `in_place_mass`, `void_cut`, `detail_region`. Each sub-mode reuses the existing protocol (canvas-mode toggle, line/arc accumulation, Finish dispatch) and differs only in the validation rules and the engine command emitted on finish.

## Done rule

(a) `app/bim_ai/sketch_session.py` supports the four new sub-modes; each has its own validator and Finish-command emitter.
(b) Closed-loop validation enforced for `ceiling`, `in_place_mass`, `void_cut`; line-set validation for `detail_region`.
(c) Finish dispatches the appropriate command: ceiling → `createCeiling`, in_place_mass → `createMass` (new — see file 2), void_cut → `createVoidCut` (new), detail_region → `createDetailRegion` (already exists).
(d) Tests cover one happy-path + one rejection path per sub-mode.
(e) Tracker row for SKT-01 flips from `partial` → `done`.

---

## File 1 — `app/bim_ai/sketch_session.py`

Add sub-mode entries `ceiling`, `in_place_mass`, `void_cut`, `detail_region` to whatever `SUBMODES` registry exists (or extend the if/elif chain in `finish_session`). Each entry maps to a validator + a Finish-emitter.

Validators reuse `sketch_validation.assert_closed_loop` for the polygon-style sub-modes and `sketch_validation.assert_line_set` for `detail_region`. If those helpers do not yet exist, factor them out from the floor / roof / room_separation handlers.

Finish-emitters return a list of commands (typically one). Pass through any sub-mode-specific options stored on `SketchSession.options`.

## File 2 — `app/bim_ai/engine.py`

If absent, add `CreateMassCmd { id, levelId, footprintMm, heightMm, rotationDeg?, materialKey? }` and `CreateVoidCutCmd { id, hostElementId, profileMm, depthMm }` Pydantic classes plus `case` branches in `try_commit_bundle`. Existing `createCeiling` already exists per EDT-04 closeout.

`CreateMassCmd` constructs a `MassElem` with `phaseId='massing'`. `CreateVoidCutCmd` adds an `agentDeviation`-tracked subtractive boolean against the host element (use the existing void pattern if any; otherwise a new `VoidCutElem` is OK — keep it scoped to "marker" + the engine handles the geometry on render).

## File 3 — `app/bim_ai/sketch_validation.py`

If validators are not generic, factor out:

```python
def assert_closed_loop(points: list[Vec2Mm], *, tol_mm: float = 1.0) -> None: ...
def assert_line_set(segments: list[tuple[Vec2Mm, Vec2Mm]]) -> None: ...
```

These already may exist for floor / roof — reuse, don't duplicate.

## Tests

`app/tests/test_sketch_session_remaining_modes.py` (new):

For each of `ceiling`, `in_place_mass`, `void_cut`, `detail_region`:

- happy path: build a session in that sub-mode, add valid geometry, call `finish_session`, assert the right command type and payload.
- rejection: add invalid geometry (open loop where closed required, or zero segments), assert finish raises with a specific error.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_sketch_session_remaining_modes.py tests/test_sketch_session.py tests/test_sketch_validation.py
```

## Tracker

Flip SKT-01 row from `partial` → `done`. Replace deferred-scope text with as-shipped four-submode coverage.

## Non-goals

- No UI canvas changes — the plan canvas already routes Finish through `SketchSession`. New sub-modes are picked up automatically once the engine accepts the new commands.
- No void boolean geometry on the renderer — the marker element is enough; CSG was scoped out of this WP.
- No "edit existing sketch" round-trip — Finish-only, in keeping with the existing slice.
