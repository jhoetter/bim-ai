# Sketch-to-BIM Initiation Check

Generated: 2026-05-18T20:26:11.009Z
Model: a5c6d3f6-6a76-45f2-8017-b6fa78911955
IR: spec/target-house/target-house-1-sketch-ir.draft.json
Capability matrix: spec/sketch-to-bim-capability-matrix.json

## Wave 8 Worker B Source Correction

Status: stale live evidence after seed-source correction.

On 2026-05-19, Wave 8 Worker B updated the authoritative
`seed-artifacts/target-house-1` recipe and bundle for BIR-N02. The source
correction removes physical access-helper doors/walls, removes the overlapping
full-width front-loggia wall opening, and makes the front wrapper split explicit
in seed source instead of relying on a trailing delete/recreate cleanup command.

This evidence packet predates that correction and must be refreshed before final
acceptance claims are treated as current.

## Summary

- Features: 10 (6 critical)
- Ready: 5
- Needs attention: 5
- Blocked: 0
- Errors: 0
- Warnings: 5

## Blocking Issues

_None._

## Warnings

- `partial_capability` at `$.features[folded_white_wrapper_shell].kind`: Feature folded_white_wrapper_shell has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[roof_terrace_cutout].kind`: Feature roof_terrace_cutout has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[vertical_cladding_zones].kind`: Feature vertical_cladding_zones has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[site_orientation_and_plinth].kind`: Feature site_orientation_and_plinth has partial capability support; screenshot/advisor proof is mandatory.
- `partial_capability` at `$.features[documentation_evidence_set].kind`: Feature documentation_evidence_set has partial capability support; screenshot/advisor proof is mandatory.

## Feature Coverage

| Feature | Kind | Priority | Readiness | Capability status |
| --- | --- | --- | --- | --- |
| primary_massing_envelope | basic_massing_envelope | critical | ready | cap.primary_massing_envelope:supported |
| folded_white_wrapper_shell | folded_white_wrapper_shell | critical | needs_attention | cap.folded_white_wrapper_shell:partial |
| roof_terrace_cutout | roof_opening_with_occupied_terrace | critical | needs_attention | cap.roof_opening_occupied_terrace:partial |
| front_deep_loggia | recessed_loggia | critical | ready | cap.recessed_loggia:supported |
| asymmetric_gable_envelope | roof_attached_wall_profile | critical | ready | cap.roof_attached_wall_profile:supported |
| vertical_cladding_zones | vertical_cladding | high | needs_attention | cap.vertical_cladding:partial |
| opening_and_glazing_rhythm | facade_bay_rhythm | high | ready | cap.opening_and_glazing_rhythm:supported |
| room_access_and_enclosure | room_access_and_enclosure | critical | ready | cap.room_access_and_enclosure:supported |
| site_orientation_and_plinth | site_orientation | medium | needs_attention | cap.site_orientation_and_sun:partial |
| documentation_evidence_set | documentation_views | high | needs_attention | cap.documentation_views_schedules:partial |

## Visual Checklist

Checklist items: 35
Every item starts as `unchecked`; acceptance requires screenshot evidence and semantic pass/fail notes.
Semantic checklist items: 291

## Live Advisor

- warning: 49 finding(s) across 13 group(s).
- info: 45 finding(s) across 6 group(s).

## Live Artifacts

- bundleApply: `/tmp/bim-ai-target-house-1-run/final-live-evidence/bundle-apply.json`
- toolRunSummary: `/tmp/bim-ai-target-house-1-run/final-live-evidence/tool-run-summary.json`
- snapshot: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/snapshot.json`
- validate: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/validate.json`
- evidencePackage: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/evidence-package.json`
- advisorError: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/advisor-error.json`
- advisorWarning: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/advisor-warning.json`
- advisorInfo: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/advisor-info.json`
- advisorAll: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/advisor-all.json`
- constructabilityReport: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/constructability-report.json`
- modelStats: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/model-stats.json`
- visualEvidenceContract: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/visual-evidence-contract.json`
- findingDispositions: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/finding-dispositions.json`
- toleranceLedger: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/tolerance-ledger.json`
- exportValidation: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/export-validation.json`
- manifest: `/tmp/bim-ai-target-house-1-run/final-live-evidence/live/evidence-manifest.json`

## Evidence Freshness

Freshness: pass
- git_head: pass
- model_revision: pass
- advisor_rule_digest: pass
- ir_sha256: pass
- capabilities_sha256: pass

## Screenshots

Captured 7 screenshot(s).
- main_front_left: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/main_front_left.png`
- roof_high: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/roof_high.png`
- front_elevation: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/front_elevation.png`
- rear_right_axon: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/rear_right_axon.png`
- ground_floor_plan: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/ground_floor_plan.png`
- first_floor_plan: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/first_floor_plan.png`
- wire_diagnostic: `/tmp/bim-ai-target-house-1-run/final-live-evidence/screenshots/wire_diagnostic.png`

## Visual Gate

Captured views scored: 7; pass=0; needs_review=7; fail=0.
- main_front_left: needs_review
- roof_high: needs_review
- front_elevation: needs_review
- rear_right_axon: needs_review
- ground_floor_plan: needs_review
- first_floor_plan: needs_review
- wire_diagnostic: needs_review

## Capability Gaps

No blocked critical capability gaps were generated.

## BIM Data Quality

Result: pass (0 error(s), 0 warning(s), 0 planned live check(s)).

## Exchange Validation

Result: pass (0 error(s), 0 warning(s), 2 planned check(s)).
- `planned` `psets`: Property-set validation is tracked as a normalized manifest requirement until the IFC backend exposes concrete Pset rows.
- `planned` `quantities`: Quantity validation is planned from evidence-package/validate output until explicit IFC quantity rows are exposed.

## Acceptance Gates

Result: blocked (2 blocker(s), 1 tolerance(s)).
Semantic visual: blocked (291 failure(s) / 291 required).
- `advisor_warning_findings`: 49 live advisor warning finding(s) remain.
- `semantic_visual_checklist_failures`: 291 required semantic visual checklist item(s) are missing, failed, or unverified.
- tolerance `visual_gate_needs_human_review`: 7 screenshot view(s) have no target comparison and need human review.

## Wave 8 Deterministic Evidence Acceptance

Machine-readable report:
`seed-artifacts/target-house-1/evidence/live-run-current/target-house-evidence-acceptance.json`

- BIR-N05 visual evidence: blocked. Required views: 8; passed: 7; failed: 1.
- Missing required view evidence: `front_loggia` lacks a visual-contract row,
  saved viewpoint/snapshot view, screenshot-manifest capture, and PNG.
- BIR-N06 BIM data quality: pass. Current report checks rooms/spaces, levels,
  schedules, types/materials, classifications, spaces, stairs, rails,
  doors/windows, and required export-manifest rows.

## Wave 8 Deterministic Evidence Acceptance

Machine-readable report:
`seed-artifacts/target-house-1/evidence/live-run-current/target-house-evidence-acceptance.json`

- BIR-N05 visual evidence: blocked. Required views: 8; passed: 7; failed: 1.
- Missing required view evidence: `front_loggia` lacks a visual-contract row,
  saved viewpoint/snapshot view, screenshot-manifest capture, and PNG.
- BIR-N06 BIM data quality: pass. Current report checks rooms/spaces, levels,
  schedules, types/materials, classifications, spaces, stairs, rails,
  doors/windows, and required export-manifest rows.
