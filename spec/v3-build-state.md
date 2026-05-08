# v3 Build State

Last updated: 2026-05-08 (8/8 merged; next wave prompts wp-009..wp-015 ready)
Active heavy workers: 0 / 8

## Live workers

_(none — all 8 slots free)_

Statuses: `dispatched-pending-prompt` (writer subagent in flight), `dispatched` (prompt file written, awaiting user to start worker), `working` (worker started, no report yet), `pushed` (branch pushed, awaiting review-subagent), `reviewed-pass` / `reviewed-fail`, `merged`, `failed`.

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

## Next wave — prompts ready, awaiting workers

| NNN | WP-ID | Prompt | Branch | Status |
| --- | ----- | ------ | ------ | ------ |
| 009 | CMD-V3-01 command-bundle apply API | wp-009.md | feat/v3-cmd-v3-01-bundle-apply | dispatched |
| 010 | KRN-V3-02 stacked walls | wp-010.md | feat/v3-krn-v3-02-stacked-walls | dispatched |
| 011 | KRN-V3-03 multi-roof + fascia/gutter + soffit | wp-011.md | feat/v3-krn-v3-03-multi-roof | dispatched |
| 012 | KRN-V3-05 stair by sketch | wp-012.md | feat/v3-krn-v3-05-stair-by-sketch | dispatched |
| 013 | CQ-01 WebSocket robustness | wp-013.md | feat/v3-cq-01-ws-robustness | dispatched |
| 014 | CHR-V3-01 top-bar component | wp-014.md | feat/v3-chr-v3-01-topbar | dispatched |
| 015 | CHR-V3-02 workspace switcher | wp-015.md | feat/v3-chr-v3-02-workspace-switcher | dispatched |

## Held back (deps not ready)

- **CMD-V3-02 assumption log** — depends on CMD-V3-01 (WP-009); dispatch after WP-009 merges.
- **OPT-V3-01 design options** — depends on KRN-V3-04 + CMD-V3-01 (WP-009); dispatch after both merge.
- **KRN-V3-07 slanted/tapered walls** — depends on KRN-V3-02 (WP-010); dispatch after WP-010 merges.
- **KRN-V3-08 wall sweeps & reveals** — depends on KRN-V3-03 (WP-011); dispatch after WP-011 merges.
- **KRN-V3-10 monolithic/floating stair sub-kinds** — depends on KRN-V3-05 (WP-012).
- **KRN-V3-11 railing/baluster** — depends on KRN-V3-05 (WP-012).
- **CHR-V3-02** — hard dep on CHR-V3-01 (WP-014) already noted in wp-015.md.
- **COL-V3-01 multi-user** — hard dep: CQ-01 (WP-013) must land first.
- **JOB-V3-01 Jobs panel** — depends on CQ-01 (WP-013).
- **CQ-04 god-file split** — high merge-conflict risk; schedule for quiet window.
- **CQ-03 workspace reorg** — riskiest CQ item; dedicated quiet week.

## File-overlap notes

- WP-009 (CMD-V3-01) touches engine.py + routes_api.py + cli.mjs — same areas as WP-004/005/006 but those are merged; rebase cleanly from main.
- WP-010 (KRN-V3-02) touches elements.py + engine.py — phasing fields from WP-004 are in place; no conflict expected.
- WP-011 (KRN-V3-03) touches engine.py + roof_geometry.py — phasing from WP-004 merged; rebase cleanly.
- WP-012 (KRN-V3-05) touches engine.py + sketch session — rebase from main.
- WP-013 (CQ-01) touches hub.py + routes_api.py (WS handler) + frontend WS client — disjoint from kernel WPs.
- WP-014 (CHR-V3-01) purely frontend chrome — no Python overlap.
- WP-015 (CHR-V3-02) purely frontend chrome — no Python overlap; needs WP-014 first.

## Notes

- All 8 slots are free — start all 7 workers now (WP-015 can wait for WP-014 to land or run in parallel; the prompt notes the dependency).
- API-V3-01 (WP-003) is merged — every new kernel verb in WP-010/011/012 must add CLI + REST + JSON schema per the API-V3-01 contract.
- CMD-V3-01 (WP-009) is the T9 unlock — CMD-V3-02, OPT-V3-01, IMG-V3-01 depend on it.
- CQ-01 (WP-013) is the T3 unlock — COL-V3-01, JOB-V3-01, OUT-V3-01 all depend on it.
- Concurrency cap: 8 heavy workers in flight at any time.
