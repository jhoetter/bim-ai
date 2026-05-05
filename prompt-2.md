# Prompt 2 - Room Color Scheme Override Authoring And Sheet Legend Evidence V1

## Mission

You are implementing wave 2 of the remaining Revit Production Parity v1 closeout work.

Close the remaining parity gap around room color scheme override authoring and sheet legend evidence while keeping the scope tight. Existing tracker state indicates that room programs, finish schedules, legends, and room separation evidence already exist, but room color scheme override authoring and sheet legend parity remain partial.

Your goal is to add bounded, durable authoring and evidence paths that make room color scheme overrides inspectable, persistable, deterministic, and visible from sheets without attempting to build a full Revit color scheme editor.

## Target Workpackages

- WP-B06 Rooms and room separation
- WP-C04 Room color schemes and legends
- WP-D03 Schedule UI
- WP-E05 Sheet canvas and titleblock
- WP-V01 Validation/advisor expansion

## Scope

Implement a focused v1 pass covering these behaviors:

- Add bounded authoring and persistence for room color scheme override rows.
  - Support explicit override rows for room color scheme entries where the existing model already has a room, room target, room program, finish schedule, or legend relationship to anchor the data.
  - Persist only the v1 fields needed for parity evidence, such as scheme identity, target room or room classification identity, label/readout, fill color, optional hatch or pattern token if already supported, and ordering metadata.
  - Preserve existing room target, derivation, schedule, and constraint behavior. Do not change room area derivation semantics.
  - Treat incomplete or ambiguous override rows as validation/advisor findings rather than silently inventing values.

- Make room color scheme legend evidence deterministic.
  - Ensure legend entries derived from room color scheme overrides have stable ordering across runs.
  - Ensure any digest, snapshot, export evidence, or test fixture for room legend output is deterministic.
  - Prefer existing digest or evidence helpers if present.
  - Add or extend tests that prove legend digest/order stability for the same model inputs.

- Add sheet legend placement and readout parity for v1.
  - Allow the sheet canvas/titleblock evidence path to place or reference a room color scheme legend in a bounded way.
  - Ensure sheet readouts expose enough evidence to verify which legend is placed, where it is placed, and which scheme/entries it represents.
  - Keep placement deterministic and fixture-friendly. Use existing sheet canvas/titleblock data structures and UI patterns where possible.
  - Avoid broad canvas editor work beyond the minimal placement/readout path needed for parity evidence.

- Expand room color scheme advisories.
  - Add validation/advisor findings for missing scheme identity, missing or ambiguous room target/classification, duplicate override keys, missing required label/readout, invalid fill color, and unsupported or unknown pattern tokens.
  - Reuse existing validation/advisor severity and location conventions.
  - Ensure advisories are visible in the same backend/frontend pathways already used for room, schedule, legend, sheet, or workspace validation.

- Update schedule/workspace readouts only as needed.
  - If the room schedule or workspace UI already has room legend/readout surfaces, extend them narrowly to display authored override evidence and advisor state.
  - Keep changes consistent with existing schedule UI, sheet canvas, and workspace readout patterns.

- Add focused tests.
  - Backend tests should cover persistence, target resolution, validation/advisor behavior, schedule/readout integration where applicable, and stable legend evidence.
  - Web tests should cover room legend readouts, sheet legend placement/readout, workspace evidence surfaces, and stable ordering/digest behavior where implemented on the frontend.

## Non-goals

- Do not build a full Revit color scheme editor.
- Do not add an arbitrary hatch or pattern library.
- Do not change room area derivation behavior.
- Do not broaden room separation geometry behavior beyond what is needed to preserve existing evidence.
- Do not redesign the schedule UI, sheet canvas, titleblock system, or workspace validation surfaces.
- Do not introduce a new persistence subsystem if existing project storage patterns can support the bounded v1 fields.
- Do not create a pull request.

## Validation

Run focused validation before committing:

```bash
pnpm exec ruff check agent
pnpm exec pytest agent/tests -k "room or target or derivation or schedule or constraint"
pnpm exec tsc --noEmit
pnpm exec vitest run --runInBand -t "room legend|sheet|workspace|readout|digest|order"
```

If the repository has narrower package scripts for backend ruff, backend pytest, web typecheck, or web vitest, prefer the local scripts that match those same validation targets. Capture any unavailable or failing commands in your final handoff with the reason and the closest validation you did run.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-2-room-color-scheme-sheet-legend`.
- Commit your changes and push the branch.
- Do not open a pull request.
