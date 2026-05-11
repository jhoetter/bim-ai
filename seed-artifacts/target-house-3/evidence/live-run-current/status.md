# Sketch-to-BIM Initiation Check

Generated: 2026-05-11T13:04:28.165Z
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

- snapshot: `seed-artifacts/target-house-3/evidence/live-run-current/live/snapshot.json`
- validate: `seed-artifacts/target-house-3/evidence/live-run-current/live/validate.json`
- evidencePackage: `seed-artifacts/target-house-3/evidence/live-run-current/live/evidence-package.json`
- advisorWarning: `seed-artifacts/target-house-3/evidence/live-run-current/live/advisor-warning.json`
- advisorInfo: `seed-artifacts/target-house-3/evidence/live-run-current/live/advisor-info.json`
- modelStats: `seed-artifacts/target-house-3/evidence/live-run-current/live/model-stats.json`

## Screenshots

Captured 7 screenshot(s).
- vp-main-iso: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/vp-main-iso.png`
- vp-front-elev: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/vp-front-elev.png`
- vp-roof-court: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/vp-roof-court.png`
- vp-rear-axo: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/vp-rear-axo.png`
- hf-pv-ground: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/hf-pv-ground.png`
- hf-pv-upper: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/hf-pv-upper.png`
- hf-sec-loggia: `seed-artifacts/target-house-3/evidence/live-run-current/screenshots/hf-sec-loggia.png`

## Visual Gate

Captured views scored: 7; pass=0; needs_review=7; fail=0.
- vp-main-iso: needs_review
- vp-front-elev: needs_review
- vp-roof-court: needs_review
- vp-rear-axo: needs_review
- hf-pv-ground: needs_review
- hf-pv-upper: needs_review
- hf-sec-loggia: needs_review

## Capability Gaps

No blocked critical capability gaps were generated.

## Acceptance Gates

Result: pass (0 blocker(s), 1 tolerance(s)).
- tolerance `visual_gate_needs_human_review`: 7 screenshot view(s) have no target comparison and need human review.

