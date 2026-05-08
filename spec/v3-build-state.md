# v3 Build State

Last updated: 2026-05-08 (wave-3 complete: 8 WPs merged; ~22/63 done)
Active heavy workers: 0 / 8

## Merged so far

| WP-ID | Branch | Merged at | Commit |
| ----- | ------ | --------- | ------ |
| Sprint 0 / B4 phase 1 (WP-001) | feat/v3-sprint0-b4-tokens | 2026-05-08 | 5c385189 |
| EDT-V3-01 constraint rules (WP-002) | feat/v3-edt-v3-01-constraint-rules | 2026-05-08 | ab3c6c98 |
| CQ-02 Python lockfile (WP-008) | feat/v3-cq-02-python-lockfile | 2026-05-08 | bc2a302d |
| API-V3-01 tool registry (WP-003) | feat/v3-api-v3-01-tool-cli-surface | 2026-05-08 | 4bfdecb1 |
| KRN-V3-01 phasing primitive (WP-004) | feat/v3-krn-v3-01-phasing | 2026-05-08 | ae63f533 |
| TKN-V3-01 tokenisation (WP-005) | feat/v3-tkn-v3-01-tokenisation | 2026-05-08 | 74e39d64 |
| KRN-V3-06 plan region (WP-006) | feat/v3-krn-v3-06-plan-region | 2026-05-08 | 5cdcf1db |
| SUN-V3-01 sun & shadow (WP-007) | feat/v3-sun-v3-01-sun-shadow | 2026-05-08 | c3cfd58f |

## Wave-2 merged

| WP-ID | Branch | Merged at | Commit |
| ----- | ------ | --------- | ------ |
| CQ-01 WebSocket robustness (WP-013) | feat/v3-cq-01-ws-robustness | 2026-05-08 | 8635755a |
| CMD-V3-01 apply-bundle (WP-009) | feat/v3-cmd-v3-01-bundle-apply | 2026-05-08 | cc5d6fae |
| KRN-V3-03 multi-roof + soffit (WP-011) | feat/v3-krn-v3-03-multi-roof | 2026-05-08 | 81be0542 |
| CHR-V3-01 + CHR-V3-02 TopBar + switcher (WP-014+015) | feat/v3-chr-v3-02-workspace-switcher | 2026-05-08 | 07f84d64 |
| KRN-V3-02 stacked walls (WP-010) + KRN-V3-05 stair by sketch (WP-012) | main (orchestrator) | 2026-05-08 | 53536e47 |

## Wave-3 merged

| WP-ID | Branch | Merged at | Commit |
| ----- | ------ | --------- | ------ |
| KRN-V3-07 slanted/tapered walls (WP-016) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | 8606047a |
| KRN-V3-11 railing baluster (WP-017) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | 06cbff58 |
| CMD-V3-02 assumption log (WP-018) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | b6cea202 |
| COL-V3-01 multi-user collab (WP-019+021) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | f221fff0 |
| JOB-V3-01 Jobs panel (WP-022) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | a15c2a4a |
| KRN-V3-10 stair sub-kinds (WP-020) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | 0879e972 |
| CHR-V3-03 status bar (WP-023) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | bcd5bf32 |

## Held back (pending deps)

- **KRN-V3-08 wall sweeps & reveals** — KRN-V3-03 merged; prompt written (WP spec ready).
- **OPT-V3-01 design options** — depends on KRN-V3-04 (not yet merged); hold.
- **CQ-04 god-file split** — high merge-conflict risk; schedule for quiet window.
- **CQ-03 workspace reorg** — riskiest CQ item; dedicated quiet week.

## Wave-4 (prompt files written — ready to dispatch)

| WP-ID | Prompt | WP | Theme | Effort | Dep |
| ----- | ------ | -- | ----- | ------ | --- |
| WP-024 | spec/v3-prompts/wp-024.md | KRN-V3-04 Design Options | T1 kernel | L | KRN-V3-01 ✓ |
| WP-025 | spec/v3-prompts/wp-025.md | KRN-V3-08 Wall sweeps & reveals | T1 kernel | M | KRN-V3-03 ✓ |
| WP-026 | spec/v3-prompts/wp-026.md | MRK-V3-01 3D-anchored comments | T3 collab | L | COL-V3-01 ✓ |
| WP-027 | spec/v3-prompts/wp-027.md | VER-V3-01 Activity stream | T3 collab | L | COL-V3-01 ✓ |
| WP-028 | spec/v3-prompts/wp-028.md | CHR-V3-04+EDT-V3-03 Cmd+K palette | Chrome/T2 | M | none |
| WP-029 | spec/v3-prompts/wp-029.md | VIE-V3-01 Detail-level rendering | T4 docs | M | none |
| WP-030 | spec/v3-prompts/wp-030.md | COL-V3-02 Permission tiers | T3 collab | M | COL-V3-01 ✓ |
| WP-031 | spec/v3-prompts/wp-031.md | EDT-V3-11 Phase-filter as lens | T2 UX | M | KRN-V3-01 ✓ |

## Notes

- API-V3-01 (WP-003) contract: every new kernel verb must add CLI + REST + JSON schema.
- CMD-V3-01 (WP-009) is the T9 unlock — CMD-V3-02, OPT-V3-01 still pending KRN-V3-04.
- CQ-01 (WP-013) is the T3 unlock — COL-V3-01, JOB-V3-01 now unblocked.
- KRN-V3-02 (WP-010) merged — KRN-V3-07 now unblocked.
- KRN-V3-05 (WP-012) merged — KRN-V3-10, KRN-V3-11 now unblocked.
- Concurrency cap: 8 heavy workers in flight at any time.
