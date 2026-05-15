# Sketch-to-BIM Initiation Check

Generated: 2026-05-15T15:24:31.365Z
Model: b4329ca6-bef7-5be7-8341-cf73e17ac468
IR: seed-artifacts/target-house-4/evidence/sketch-ir.json
Capability matrix: spec/archive/sketch-to-bim-capability-matrix.json

## Summary

- Features: 3 (2 critical)
- Ready: 0
- Needs attention: 1
- Blocked: 2
- Errors: 8
- Warnings: 7

## Blocking Issues

- `missing_object` at `$.sourceInputs`: sourceInputs must be an object.
- `missing_array` at `$.requiredViews`: requiredViews must be an array.
- `feature_view_missing` at `$.features[continuous_long_gable_roof].mustRenderInViews`: Feature continuous_long_gable_roof requires missing view vp-main-iso.
- `feature_view_missing` at `$.features[continuous_long_gable_roof].mustRenderInViews`: Feature continuous_long_gable_roof requires missing view vp-gable-section.
- `capability_missing` at `$.features[continuous_long_gable_roof].kind`: No capability maps feature kind gable_pitched_rectangle.
- `feature_view_missing` at `$.features[paired_long_face_dormers].mustRenderInViews`: Feature paired_long_face_dormers requires missing view vp-main-iso.
- `feature_view_missing` at `$.features[paired_long_face_dormers].mustRenderInViews`: Feature paired_long_face_dormers requires missing view vp-front-elev.
- `capability_missing` at `$.features[paired_long_face_dormers].kind`: No capability maps feature kind dormer.

## Warnings

- `critical_feature_needs_missing` at `$.features[0].capabilityNeeds`: Critical features should list capabilityNeeds so the authoring route is explicit.
- `critical_feature_needs_missing` at `$.features[1].capabilityNeeds`: Critical features should list capabilityNeeds so the authoring route is explicit.
- `assumption_validation_missing` at `$.assumptions[0].validation`: Assumption has no validation route.
- `assumption_validation_missing` at `$.assumptions[1].validation`: Assumption has no validation route.
- `feature_view_missing` at `$.features[mirrored_two_family_plan].mustRenderInViews`: Feature mirrored_two_family_plan requires missing view vp-ground-plan.
- `feature_view_missing` at `$.features[mirrored_two_family_plan].mustRenderInViews`: Feature mirrored_two_family_plan requires missing view vp-attic-plan.
- `capability_missing` at `$.features[mirrored_two_family_plan].kind`: No capability maps feature kind rooms_and_partitions.

## Feature Coverage

| Feature | Kind | Priority | Readiness | Capability status |
| --- | --- | --- | --- | --- |
| continuous_long_gable_roof | gable_pitched_rectangle | critical | blocked | missing |
| paired_long_face_dormers | dormer | critical | blocked | missing |
| mirrored_two_family_plan | rooms_and_partitions | high | needs_attention | missing |

## Visual Checklist

Checklist items: 10
Every item starts as `unchecked`; acceptance requires screenshot evidence and pass/fail notes.

## Live Advisor

- warning: 4 finding(s) across 1 group(s).
- info: 29 finding(s) across 3 group(s).

## Live Artifacts

- snapshot: `seed-artifacts/target-house-4/evidence/live-run-current/live/snapshot.json`
- validate: `seed-artifacts/target-house-4/evidence/live-run-current/live/validate.json`
- evidencePackage: `seed-artifacts/target-house-4/evidence/live-run-current/live/evidence-package.json`
- advisorWarning: `seed-artifacts/target-house-4/evidence/live-run-current/live/advisor-warning.json`
- advisorInfo: `seed-artifacts/target-house-4/evidence/live-run-current/live/advisor-info.json`
- modelStats: `seed-artifacts/target-house-4/evidence/live-run-current/live/model-stats.json`

## Screenshots

Captured 0 screenshot(s).

## Visual Gate

Captured views scored: 0; pass=0; needs_review=0; fail=0.

## Capability Gaps

Generated 3 capability-gap task(s).
- skb-gap-continuous_long_gable_roof: gable_pitched_rectangle (blocked)
- skb-gap-paired_long_face_dormers: dormer (blocked)
- skb-gap-mirrored_two_family_plan: rooms_and_partitions (needs_attention)

## Acceptance Gates

Result: blocked (3 blocker(s), 0 tolerance(s)).
- `coverage_errors`: 8 IR/capability coverage error(s) remain.
- `blocked_features`: 2 feature(s) are blocked by missing capability coverage.
- `advisor_warning_findings`: 4 live advisor warning finding(s) remain.

