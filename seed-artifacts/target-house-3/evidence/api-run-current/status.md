# Sketch-to-BIM Initiation Check

Generated: 2026-05-11T12:12:15.203Z
Model: 9bb9a145-d9ce-5a2f-a748-bb5be3301b30
IR: seed-artifacts/target-house-3/evidence/sketch-ir.json
Capability matrix: spec/sketch-to-bim-capability-matrix.json

## Summary

- Features: 5 (4 critical)
- Ready: 2
- Needs attention: 3
- Blocked: 0
- Errors: 0
- Warnings: 3

## Blocking Issues

_None._

## Warnings

- `partial_capability` at `$.features[white_folded_wrapper].kind`: Feature white_folded_wrapper has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[roof_court_void].kind`: Feature roof_court_void has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[ground_vertical_cladding].kind`: Feature ground_vertical_cladding has partial capability support; screenshot/advisor proof is mandatory.

## Feature Coverage

| Feature | Kind | Priority | Readiness | Capability status |
| --- | --- | --- | --- | --- |
| white_folded_wrapper | folded_white_wrapper_shell | critical | needs_attention | cap.folded_white_wrapper_shell:partial |
| front_loggia | recessed_loggia | critical | ready | cap.recessed_loggia:supported |
| roof_court_void | roof_opening_with_occupied_terrace | critical | needs_attention | cap.roof_opening_occupied_terrace:partial |
| ground_vertical_cladding | vertical_cladding | medium | needs_attention | cap.vertical_cladding:partial |
| usable_residential_plan | room_access_and_enclosure | critical | ready | cap.room_access_and_enclosure:supported |

## Visual Checklist

Checklist items: 18
Every item starts as `unchecked`; acceptance requires screenshot evidence and pass/fail notes.

## Live Advisor

- warning: 0 finding(s) across 0 group(s).
- info: 19 finding(s) across 5 group(s).

## Live Artifacts

- snapshot: `seed-artifacts/target-house-3/evidence/api-run-current/live/snapshot.json`
- validate: `seed-artifacts/target-house-3/evidence/api-run-current/live/validate.json`
- evidencePackage: `seed-artifacts/target-house-3/evidence/api-run-current/live/evidence-package.json`
- advisorWarning: `seed-artifacts/target-house-3/evidence/api-run-current/live/advisor-warning.json`
- advisorInfo: `seed-artifacts/target-house-3/evidence/api-run-current/live/advisor-info.json`
- modelStats: `seed-artifacts/target-house-3/evidence/api-run-current/live/model-stats.json`

## Screenshots

Not captured by this packet.

## Visual Gate

Not scored by this packet.

## Capability Gaps

No blocked critical capability gaps were generated.

## Acceptance Gates

Result: blocked (1 blocker(s), 0 tolerance(s)).
- `screenshots_missing`: No screenshot manifest was captured for the initiation packet.

