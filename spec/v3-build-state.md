# v3 Build State

Last updated: 2026-05-08 (7/8 merged; WP-002 EDT not implemented — needs re-dispatch)
Active heavy workers: 0 / 8

## Live workers

| NNN | WP-ID | Prompt | Branch | Status | Started | Reported |
| --- | ----- | ------ | ------ | ------ | ------- | -------- |
| 002 | EDT-V3-01 constraint rules (parallel / perpendicular / collinear / equal_length) | wp-002.md | feat/v3-edt-v3-01-constraint-rules | failed | 2026-05-08 | — |

Statuses: `dispatched-pending-prompt` (writer subagent in flight), `dispatched` (prompt file written, awaiting user to start worker), `working` (worker started, no report yet), `pushed` (branch pushed, awaiting review-subagent), `reviewed-pass` / `reviewed-fail`, `merged`, `failed`.

## Merged so far

| WP-ID | Branch | Merged at | Commit |
| ----- | ------ | --------- | ------ |
| Sprint 0 / B4 phase 1 (WP-001) | feat/v3-sprint0-b4-tokens | 2026-05-08 | 5c385189 |
| CQ-02 Python lockfile (WP-008) | feat/v3-cq-02-python-lockfile | 2026-05-08 | bc2a302d |
| API-V3-01 tool registry (WP-003) | feat/v3-api-v3-01-tool-cli-surface | 2026-05-08 | 4bfdecb1 |
| KRN-V3-01 phasing primitive (WP-004) | feat/v3-krn-v3-01-phasing | 2026-05-08 | ae63f533 |
| TKN-V3-01 tokenisation (WP-005) | feat/v3-tkn-v3-01-tokenisation | 2026-05-08 | 74e39d64 |
| KRN-V3-06 plan region (WP-006) | feat/v3-krn-v3-06-plan-region | 2026-05-08 | 5cdcf1db |
| SUN-V3-01 sun & shadow (WP-007) | feat/v3-sun-v3-01-sun-shadow | 2026-05-08 | c3cfd58f |

## Held back (deps not ready)

- **KRN-V3-02 stacked walls** — heavy `engine.py` overlap with KRN-V3-01 (WP-004 now merged ✅); safe to dispatch.
- **KRN-V3-03 multi-roof + fascia/gutter + soffit** — heavy `engine.py` overlap with KRN-V3-01 (WP-004 now merged ✅); safe to dispatch.
- **KRN-V3-05 stair-by-sketch** — `engine.py` overlap; WP-004 merged ✅; safe to dispatch.
- **CMD-V3-01 command-bundle apply** — depends on API-V3-01 (WP-003 ✅) + TKN-V3-01 (WP-005 ✅); safe to dispatch.
- **CQ-01 WebSocket robustness** — non-trivial; schedule after Sprint 0 (WP-001 ✅ merged).
- **CQ-04 god-file split** — high merge-conflict risk against ANY in-flight T1/T9 work; schedule for quiet window between bet-cycles.
- **CQ-03 workspace/ reorg** — riskiest CQ item; dedicated quiet week needed.
- **All CHR-V3-* chrome WPs** — Sprint 0 (WP-001) now merged ✅; safe to dispatch.
- **COL-V3-01 multi-user** — hard dep: CQ-01 must land first.

## File-overlap notes

- WP-004 (KRN-V3-01 phasing) is merged. KRN-V3-02 + KRN-V3-03 + KRN-V3-05 can now dispatch against the current engine.py.
- WP-005 (TKN-V3-01) and WP-006 (KRN-V3-06) both merged — CMD-V3-01 is unblocked.
- WP-007 (SUN-V3-01) cherry-picked from feat/v3-krn-v3-01-phasing (sun worker committed to wrong branch; content is intact on main).
- WP-002 (EDT-V3-01) branch created but 0 commits — worker never implemented. Re-dispatch with `please implement spec/v3-prompts/wp-002.md`.

## Notes

- Sprint 0 (WP-001) merged — CHR-V3-* WPs are now unblocked.
- API-V3-01 (WP-003) merged — every new kernel verb WP must add CLI + REST/RPC + JSON schema + assumption-log per the API-V3-01 contract.
- TKN-V3-01 (WP-005) merged — CMD-V3-01, OPT-V3-01, IMG-V3-01 are unblocked (dispatch after CMD-V3-01 prompt is written).
- Concurrency cap: 8 heavy workers in flight at any time.
- WP-002 re-dispatch is highest priority to clear the failed slot.

## References

- **Revit parity tracker** — `spec/revit-parity/README.md`: 120 features audited from a 6-hour Revit 2026 course (2026-05-08). Current status: 0 ✅ / 23 🟡 / 97 ❌. Priority gaps with **no WP yet**: wall type/assembly editing + Location Line (F-036–F-037), Rooms front-end placement (F-091–092), Levels UX / level heads (F-025–026), Temporary Hide/Isolate (F-047, F-101–102). Partially addressed by existing WPs: wall editing mechanics → `EDT-V3-01/02/04/05/06/12`; Project Browser → `CHR-V3-07`; Floor Edit Boundary → `EDT-V3-13`.
