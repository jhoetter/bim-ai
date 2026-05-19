# Target House 1 Live Evidence Status

Generated: 2026-05-19T09:14:55.498Z
Evidence mode: deterministic offline replay from `seed-artifacts/target-house-1/bundle.json`
Git head recorded: `fc119dadca6a7f3926cc5c659484c66db3063870`
Bundle SHA-256: `d9c5459907252d8b14357e80a06390eead8a762627bd9c2cfcf3095caf024ec3`
Advisor rule digest: `4795c8d864a33e47c8cbe34ece2e1361c453b117bc2ee0db61365d9992b788aa`
Model: `target-house-1-offline-regenerated` revision `2`

## Gate Results

- Seed artifact freshness: pass
- Target-house evidence acceptance: pass (8/8 visual rows, 7/7 data rows)
- Clean-pass gate: blocked (14 blocker groups, 24 P0 errors, 4 warnings, 0 renderer blockers)
- Geometry diagnostic: blocked (undefined findings: undefined errors, undefined warnings)

## Evidence Counts

- Elements: 154
- Advisor findings: 1
- Constructability findings: 17
- Constructability severity counts: {"error":15,"warning":2}

## Remaining Clean-Pass Blockers

- `model_integrity_coordinate_list_invalid` (error, p0_error, count 2) from advisor-all+advisor-error+constructability-report+validate; elements: main-stair
- `unsupported_slab` (error, p0_error, count 1) from constructability-report; elements: upper-wrapper-floor
- `railing_host_reference_missing` (error, p0_error, count 2) from constructability-report; elements: hf-front-loggia-railing, hf-roof-court-railing
- `railing_baluster_profile_missing` (error, p0_error, count 3) from constructability-report; elements: hf-front-loggia-railing, hf-roof-court-railing, main-stair-guardrail
- `railing_post_or_handrail_support_missing` (error, p0_error, count 3) from constructability-report; elements: hf-front-loggia-railing, hf-roof-court-railing, main-stair-guardrail
- `railing_material_slots_missing` (error, p0_error, count 3) from constructability-report; elements: hf-front-loggia-railing, hf-roof-court-railing, main-stair-guardrail
- `BIR-D04-SHAPE` (error, p0_error, count 1) from constructability-report
- `site_coordinate_system_missing_datum` (error, p0_error, count 2) from constructability-report
- `BIR-E03` (error, p0_error, count 1) from constructability-report; elements: upper-wrapper-floor
- `BIR-E06` (error, p0_error, count 2) from constructability-report; elements: hf-front-loggia-railing, hf-roof-court-railing
- `BIR-E07` (error, p0_error, count 3) from constructability-report; elements: hf-front-loggia-railing, hf-roof-court-railing, main-stair-guardrail
- `room_access_invalid_subject` (error, p0_error, count 1) from constructability-report
- `site_relationship_missing_site` (warning, warning_without_tolerance, count 2) from constructability-report
- `site_relationship_missing_toposolid` (warning, warning_without_tolerance, count 2) from constructability-report

## Notes

- Browser screenshots were not recaptured by this offline refresh; existing PNG captures are reused and now align with all eight required view rows, including `front_loggia`.
- Clean-pass remains blocked by deterministic model-integrity/constructability findings in the refreshed seed, not by stale git head, bundle hash, or Advisor-rule digest evidence.