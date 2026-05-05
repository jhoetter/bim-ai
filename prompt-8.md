# Prompt 8 - Browser Progressive Rendering Budget And Large Model Proof V1

## Mission

Close out the remaining v1 browser progressive rendering budget and large-model proof gaps for Revit Production Parity without broadening the architecture. Build on the existing `browserRenderingBudgetReadout_v1` and replay diagnostics work, and make the UI behavior deterministic enough to validate in unit and component tests without relying on flaky timing or pixel measurements.

This is wave 2 of the remaining 4 planned closeout waves. Treat this as a focused implementation pass for the browser-side performance proof: users should be able to see when projection, schedule hydration, sheet rendering, and Agent Review/Workspace surfaces are within budget, stale, intentionally deferred, or over budget, with stable reason codes that tests and diagnostics can assert.

## Target Workpackages

- WP-P01 Browser performance budget
- WP-P02 Collaboration model
- WP-C02 Plan projection engine
- WP-E05 Sheet canvas and titleblock
- WP-F02 Agent review UI

The tracker currently indicates that `browserRenderingBudgetReadout_v1` and replay diagnostics exist. Multiplayer scale proof and stronger large-model UI proof remain open. Address the large-model browser proof now; do not attempt a real-time multiplayer load test.

## Scope

Add a deterministic browser progressive rendering budget and large-model proof that covers the following surfaces:

- Projection primitive thresholds: define and expose stable budget thresholds for plan projection primitives so the UI can distinguish in-budget, deferred, stale, and over-budget states for large projected models.
- Schedule hydration rows: add deterministic row-count and hydration-budget handling for large schedules, including visible readouts for hydrated, deferred, stale, and over-budget schedule state.
- Sheet viewport counts: include sheet canvas/titleblock proof for large sheets with many viewports, including readouts for viewport count thresholds and progressive rendering status.
- Stale and over-budget reason codes: use explicit, stable reason codes for every progressive rendering budget state that can be consumed by replay diagnostics, tests, Agent Review, and Workspace readouts.
- Agent Review and Workspace readouts: surface the relevant browser budget status in Agent Review and Workspace UI so reviewers can understand whether the large-model proof is in budget, stale, deferred, or over budget.
- Replay/evidence integration: if the existing replay diagnostics or evidence package already carries browser rendering budget data, extend it narrowly with the new deterministic reason codes and large-model proof fields. If it does not need to change, leave backend evidence/replay code alone.
- Tests: add focused tests for the projection, schedule, sheet, Agent Review, and Workspace budget states. Tests should assert deterministic thresholds, state transitions, readout content, and reason codes.

Keep the implementation bounded:

- Do not rewrite the worker architecture.
- Do not add a real-time multiplayer load test.
- Do not add pixel timing assertions.
- Do not depend on wall-clock rendering duration for pass/fail behavior.
- Do not introduce broad performance abstractions unless the existing code already has a natural place for them.
- Do not change unrelated Revit parity tracker rows except the affected workpackages and Recent Sprint Ledger.

Prefer existing local patterns for selectors, diagnostics, fixtures, and UI readouts. If there are existing budget helpers or replay diagnostic schemas, extend those rather than adding parallel concepts.

## Non-goals

- No worker architecture rewrite or new rendering scheduler architecture.
- No browser benchmark harness based on frame timing, screenshots, or pixel assertions.
- No real-time multiplayer scale proof or load test.
- No backend evidence package churn unless the browser budget proof or replay diagnostics require it.
- No broad UI redesign of Agent Review, Workspace, schedule, plan, or sheet surfaces.
- No speculative optimization work beyond what is needed to prove deterministic progressive rendering budget behavior.

## Validation

Run the focused web validation after implementation:

```bash
pnpm --filter web typecheck
pnpm --filter web vitest src/workspace src/plan src/schedules src/lib
```

Run backend validation only if the evidence package or replay diagnostics change:

```bash
pnpm --filter backend ruff
pnpm --filter backend pytest
```

Validation should not rely on flaky timing, animation frame duration, screenshots, or pixel comparisons. Prefer deterministic fixtures that exceed projection primitive thresholds, schedule hydration row thresholds, and sheet viewport count thresholds, then assert stable UI readouts and reason codes.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-8-browser-progressive-render-budget`.
- Commit your changes and push the branch.
- Do not open a pull request.
