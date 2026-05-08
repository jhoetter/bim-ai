# WP-EDT-02 — Padlock UI + Engine Wiring (closeout)

## Branch

`feat/wave-04-edt-02-padlock`

## Goal

Wire the padlock chip on temp-dimensions to actually create a `ConstraintElem`, and make the engine reject any command that violates an `error`-severity constraint after apply. Today the load-bearing slice is in place: `ConstraintElem` is in the discriminated union, `app/bim_ai/edt/constraints.py` evaluates `equal_distance` constraints, `make_locked_distance_constraint(...)` is callable, and `handleTempDimLockClick` in `packages/web/src/plan/PlanCanvas.tsx` is a stub. This WP closes the loop.

## Done rule

(a) Clicking the padlock chip on a wall-to-wall temp-dimension creates a `ConstraintElem` via a new `CreateConstraintCmd`; the chip flips to a "locked" rendering style.
(b) After the bundle commits, attempting to move either wall in a way that breaks the locked distance is rejected by the engine; the rejection surfaces a deterministic error mentioning the violating constraint id and residual_mm.
(c) Tests cover: padlock-click round-trip (vitest), `CreateConstraintCmd` apply (pytest), post-apply rejection on violation (pytest).
(d) Tracker row for EDT-02 flips from `partial` → `done`.

---

## File 1 — `packages/core/src/index.ts`

Add `CreateConstraintCmd` and the `ConstraintRefRow` / `ConstraintElem` shapes (mirror the Pydantic shapes from `app/bim_ai/elements.py`).

- Append `'constraint'` to `ElemKind`.
- Append the `constraint` shape to the Element discriminated union (`rule`, `refsA[]`, `refsB[]`, `lockedValueMm?`, `severity`, `pinned`).
- Append `CreateConstraintCmd { type: 'createConstraint'; id; rule; refsA; refsB; lockedValueMm?; severity? }` to the EngineCommand union.

## File 2 — `app/bim_ai/engine.py`

Add `CreateConstraintCmd` Pydantic class (mirror the TS shape; alias `refsA` / `refsB` / `lockedValueMm`). Add a `case CreateConstraintCmd():` branch in `try_commit_bundle` that constructs a `ConstraintElem` and inserts it into the world.

In the same `try_commit_bundle`, **after** all command applies in the bundle have run but **before** returning success, call `bim_ai.edt.constraints.evaluate_all(world_elements)`; if `errors_only(...)` is non-empty, roll back the bundle and raise `EngineError` whose message includes each violation's `constraint_id`, `rule`, and `residual_mm`. Use the existing rollback pattern (snapshot before apply, restore on raise).

## File 3 — `packages/web/src/plan/PlanCanvas.tsx`

Replace the `handleTempDimLockClick` stub. The handler:

1. Reads the temp-dim target's `aId` / `bId` (the two wall ids) and the current measured distance from the temp-dim.
2. Calls `dispatch({ type: 'createConstraint', id: <generated>, rule: 'equal_distance', refsA: [{elementId: aId, anchor: 'center'}], refsB: [{elementId: bId, anchor: 'center'}], lockedValueMm: <measured>, severity: 'error' })`.
3. Updates store state so the temp-dim renders with a "locked" badge thereafter.

`packages/web/src/plan/GripLayer.tsx` (or wherever `TempDimLayer` is implemented) — locked badge: render a filled-padlock glyph instead of the open-padlock glyph when the temp-dim has a matching `ConstraintElem` in the world.

## File 4 — `packages/web/src/plan/tempDimensionLockState.ts` (new)

Pure helper:

```ts
export function findLockedConstraintFor(
  aId: string,
  bId: string,
  elements: Element[],
): Element | undefined;
```

Used by `TempDimLayer` to pick the locked vs unlocked rendering and by tests.

## Tests

`app/tests/test_create_constraint_command.py` (new):

- `test_create_constraint_inserts_element` — apply the command, assert the constraint appears.
- `test_violation_after_apply_rejects_bundle` — pre-seed two walls + a locked constraint at 5000mm; submit a bundle that moves one wall to break the lock; assert the bundle fails and the world is unchanged.
- `test_warning_constraint_does_not_reject` — same scenario with `severity='warning'`; bundle succeeds.

`packages/web/src/plan/tempDimensionLockState.test.ts` (new): exercise the locked-state lookup helper.

`packages/web/src/plan/PlanCanvas.padlock.test.tsx` (new): mount PlanCanvas with two selected walls and a temp-dim, simulate a padlock click, assert the dispatched command shape.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_create_constraint_command.py tests/test_edt_constraints.py
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/plan/tempDimensionLockState.test.ts src/plan/PlanCanvas.padlock.test.tsx
```

## Tracker

Update `spec/workpackage-master-tracker.md` row EDT-02 from `partial` → `done`. Replace the deferred-scope text with the as-shipped behaviour. Note the engine post-apply hook in `try_commit_bundle`.

## Non-goals

- No support for additional constraint rules (parallel / perpendicular / collinear / equal_length); they remain pass-through.
- No padlock chip in 3D viewport (separate from the plan-canvas temp-dim).
- No undo-friendly "soft lock" UX — locks are hard error-severity by default.
