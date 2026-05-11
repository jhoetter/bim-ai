# Sketch-to-BIM Initiation Check

Generated: 2026-05-11T06:52:08.090Z
IR: nightshift/seed-target-house-2026-05-11/sketch-ir.json
Capability matrix: spec/sketch-to-bim-capability-matrix.json

## Summary

- Features: 5 (4 critical)
- Ready: 2
- Needs attention: 3
- Blocked: 0
- Errors: 0
- Warnings: 6

## Blocking Issues

_None._

## Warnings

- `assumption_validation_missing` at `$.assumptions[0].validation`: Assumption has no validation route.
- `assumption_validation_missing` at `$.assumptions[1].validation`: Assumption has no validation route.
- `assumption_validation_missing` at `$.assumptions[2].validation`: Assumption has no validation route.
- `partial_capability` at `$.features[upper-white-wrapper].kind`: Feature upper-white-wrapper has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[roof-court-void].kind`: Feature roof-court-void has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[vertical-cladding].kind`: Feature vertical-cladding has partial capability support; screenshot/advisor proof is mandatory.

## Feature Coverage

| Feature | Kind | Priority | Readiness | Capability status |
| --- | --- | --- | --- | --- |
| upper-white-wrapper | folded_white_wrapper_shell | critical | needs_attention | cap.folded_white_wrapper_shell:partial |
| front-loggia | recessed_loggia | critical | ready | cap.recessed_loggia:supported |
| roof-court-void | roof_opening_with_occupied_terrace | critical | needs_attention | cap.roof_opening_occupied_terrace:partial |
| vertical-cladding | vertical_cladding | high | needs_attention | cap.vertical_cladding:partial |
| interior-usability | room_access_and_enclosure | critical | ready | cap.room_access_and_enclosure:supported |

## Visual Checklist

Checklist items: 20
Every item starts as `unchecked`; acceptance requires screenshot evidence and pass/fail notes.

## Live Advisor

Not captured. Run with `--live --model <id>` after the model exists.

## Live Artifacts

Not captured by this packet.

## Screenshots

Not captured by this packet.

## Visual Gate

Not scored by this packet.

## Capability Gaps

No blocked critical capability gaps were generated.

## Acceptance Gates

Result: blocked (1 blocker(s), 0 tolerance(s)).
- `screenshots_missing`: No screenshot manifest was captured for the initiation packet.

