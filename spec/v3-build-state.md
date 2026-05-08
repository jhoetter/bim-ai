# v3 Build State

Last updated: 2026-05-08 (wave-6: all 8 reviews FAIL — fix prompts written, fix workers needed; ~39/63 WPs done)
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

| WP-ID | WP | Merged at | Commit |
| ----- | -- | --------- | ------ |
| KRN-V3-07 slanted/tapered walls (WP-016) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | 8606047a |
| KRN-V3-11 railing baluster (WP-017) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | 06cbff58 |
| CMD-V3-02 assumption log (WP-018) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | b6cea202 |
| COL-V3-01 multi-user collab (WP-019+021) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | f221fff0 |
| JOB-V3-01 Jobs panel (WP-022) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | a15c2a4a |
| KRN-V3-10 stair sub-kinds (WP-020) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | 0879e972 |
| CHR-V3-03 status bar (WP-023) | feat/v3-job-v3-01-jobs-panel | 2026-05-08 | bcd5bf32 |

## Wave-4 merged

| WP-ID | WP | Merged at | Commit |
| ----- | -- | --------- | ------ |
| WP-024 | KRN-V3-04 Design Options | 2026-05-08 | a752a0dd |
| WP-025 | KRN-V3-08 Wall sweeps & reveals (tests) | 2026-05-08 | 9513cd0b |
| WP-026 | MRK-V3-01 3D-anchored comments | 2026-05-08 | a77639cd |
| WP-027 | VER-V3-01 Activity stream | 2026-05-08 | 33f8a072 |
| WP-028 | CHR-V3-04+EDT-V3-03 Cmd+K palette | 2026-05-08 | 68d147d8 |
| WP-030 | COL-V3-02 Permission tiers | 2026-05-08 | 56933e37 |
| WP-031 | EDT-V3-11 Phase-filter as lens | 2026-05-08 | 45eff78b |

## Wave-5 merged

| WP-ID | WP | Merged at | Commit |
| ----- | -- | --------- | ------ |
| WP-029 | VIE-V3-01 detail-level rendering | 2026-05-08 | 04e5ad8c |
| WP-032 | VER-V3-02 named milestones (Cmd+S) | 2026-05-08 | 138645d2 |
| WP-033 | MRK-V3-02 plan+3D markups | 2026-05-08 | e89088c9 |
| WP-034 | COL-V3-03 shareable public link | 2026-05-08 | 890d5693 |
| WP-035 | OPT-V3-01 design-options agent scratch | 2026-05-08 | b7813496 |
| WP-036 | CHR-V3-05 activity-stream drawer | 2026-05-08 | 8e10a907 |
| WP-037 | VIE-V3-02 drafting view + callout bundle | 2026-05-08 | 66981deb |
| WP-038 | VIE-V3-03 view templates + propagation toast | 2026-05-08 | 239b6c76 |
| WP-039 | SHT-V3-01 sheet + titleblock + window legend | 2026-05-08 | 873d7cd0 |

## Wave-6 fix-up needed (all 8 reviewed → FAIL; fix prompts at spec/v3-prompts/wp-NNN-fix.md)

CROSS-CUTTING ISSUE: Workers branched from each other instead of from main, creating a
chain: AST → TOP → IMG → DSC. Fix workers must rebase onto main (instructions in fix prompts).
Multiple branches contain OUT-V3-01 presentation routes as scope creep; workers must remove them.

| WP-ID | WP | Branch | Status | Fix prompt | Key failures |
| ----- | -- | ------ | ------ | ---------- | ------------ |
| WP-040 | DSC-V3-01 element discipline tags | feat/v3-dsc-v3-01-discipline-tags | FAIL — fix needed | wp-040-fix.md | scope creep (IMG code), missing ToolDescriptor, no "default" radio, no API tests |
| WP-041 | TOP-V3-01 toposolid primitive | feat/v3-top-v3-01-toposolid | FAIL — fix needed | wp-041-fix.md | scope creep (AST code on branch), missing TS types, no CLI, no floor inheritance |
| WP-042 | AST-V3-01 searchable asset library | feat/v3-ast-v3-01-asset-library | FAIL — fix needed | wp-042-fix.md | TS exports missing (build-breaking), no CLI, onPlace stub, scope creep |
| WP-043 | IMG-V3-01 image → layout JSON | feat/v3-img-v3-01-image-to-layout | FAIL — fix needed | wp-043-fix.md | calibrator/sampler not wired, JOB queue stub, OUT scope creep; rebase onto main after WP-041 merges |
| WP-044 | CAN-V3-01 line-weight hierarchy | feat/v3-can-v3-01-line-weight-hierarchy | FAIL — fix needed | wp-044-fix.md | wrong step values (continuous vs discrete), weights not applied to draw calls, brand-swap test missing |
| WP-045 | OUT-V3-01 live presentation URL | feat/v3-out-v3-01-live-web-link | FAIL — fix needed | wp-045-fix.md | CLI publish missing, in-memory storage not durable, allowMeasurement/Comment not returned, WS revoke test missing |
| WP-046 | MRK-V3-03 sheet review | feat/v3-mrk-v3-03-sheet-review | FAIL — fix needed (active worker has uncommitted changes) | wp-046-fix.md | push uncommitted work first; OUT scope creep; production routes not wired; chip uses polling not WS |
| WP-047 | CHR-V3-08 ToolModifierBar | feat/v3-chr-v3-08-tool-modifier-bar | FAIL — fix needed | wp-047-fix.md | frontend only — missing SetToolPrefCmd + CLI + agent-callable tests (API-V3-01 violation) |

## Merge order when fix workers pass review

1. WP-041 (TOP) — rebase onto main, drop AST commit, add TS types + CLI + floor inheritance
2. WP-042 (AST) — add TS types + CLI, fix canvas placement, remove non-AST scope creep
3. WP-040 (DSC) — rebase onto main, drop IMG commit, add ToolDescriptor + radio + tests
4. WP-044 (CAN) — independent; fix step values + draw calls + brand-swap test
5. WP-045 (OUT) — independent; add CLI + durability + fields + WS revoke test
6. WP-047 (CHR) — independent; add backend command layer + tests
7. WP-043 (IMG) — rebase onto main after TOP merges; fix calibrator + JOB + remove OUT routes
8. WP-046 (MRK) — push local work; remove OUT routes; wire production routes; fix chip

## Orphan commits (flagged for user decision — do NOT cherry-pick without confirmation)

All 6 are on origin/feat/v3-edt-v3-01-constraint-rules (wave-1 branch already merged):
- 615fad24 feat(seed+viewport): six visual gap fixes
- c7ddc1bf feat(viewport): add cladding boards to recessed wall back
- 7e44a3c0 fix(store): coerce window outlineKind/attachedRoofId + door operationType (equivalent fix already in WP-045 branch as 3b580a98 — likely safe to drop)
- 06840cef feat(seed): tame asymmetry + drop dormer cut
- 8dc5ee7a feat(seed): full-width recess
- 12ec01dd feat(seed): bump picture-frame profile

## Held back (pending deps or timing)

- CQ-04 god-file split — high merge-conflict risk; schedule for quiet window between waves.
- CQ-03 workspace reorg — riskiest CQ item; dedicated quiet week.
- DSC-V3-02 view discipline tags — depends on DSC-V3-01 (WP-040, wave-6); hold until WP-040 merges.
- LNS-V3-01 lens dropdown — depends on DSC-V3-01 (WP-040); hold.
- TOP-V3-02..04, OSM-V3-01 — depends on TOP-V3-01 (WP-041); hold.
- AST-V3-04 kitchen kit — depends on AST-V3-01 (WP-042); hold.
- CON-V3-02 seed handoff — depends on IMG-V3-01 (WP-043); hold.
- CAN-V3-02 hatch patterns — depends on CAN-V3-01 (WP-044); hold.
- OUT-V3-02, OUT-V3-03 PPTX/PDF export — depends on OUT-V3-01 (WP-045); hold.
- COL-V3-04 presence avatars — v3.1 stretch per spec; hold.
- COL-V3-06 offline-tolerant authoring — next state; hold.
- VG-V3-01 render-and-compare — deps met (TKN, API done); schedule wave-7.
- CTL-V3-01 catalog query API — deps met (API done); schedule wave-7.
- ANN-V3-01 detail-region authoring — deps met (soft dep on EDT-01); schedule wave-7.
- IMP-V3-01 image-as-underlay — Wave 0, no deps; schedule wave-7.
- MAT-V3-01, MAT-V3-02 material tokens — Wave 0, no deps; schedule wave-7.
- SCH-V3-01 custom-properties + schedule view — Wave 0, no deps; schedule wave-7.
- CHR-V3-06, CHR-V3-07, CHR-V3-10 chrome WPs — Wave 0, no deps; schedule wave-7.
- EDT-V3-04, EDT-V3-05, EDT-V3-06 UX WPs — Wave 0, no deps; schedule wave-7.
- TST-V3-01 refinement-reliability CI test — deps met (CMD-V3-01/02 + JOB-V3-01 done); schedule wave-7.
- EXP-V3-01 render-pipeline export — deps met (CMD-V3-01/02 + JOB-V3-01 done); schedule wave-7.

## Notes

- API-V3-01 (WP-003) contract: every new kernel verb must add CLI + REST + JSON schema.
- CQ-01 (WP-013) merged — COL-V3-01 + JOB-V3-01 shipped; T3 and T9 long-running ops are stable.
- All B3 now-state WPs are done: COL-V3-01..03, MRK-V3-01..02, VER-V3-01..02 all merged.
- B1 critical path: all 6 kernel WPs done; ANN-V3-01 and EDT-V3-09 remain for full B1 felt-outcome.
- Concurrency cap: 8 heavy workers in flight at any time.
- DSC-V3-01 (WP-040) + TOP-V3-01 (WP-041) both touch engine.py but in disjoint regions (discipline metadata vs. toposolid geometry); overlap risk is low but workers should coordinate on imports.
- WP-043 IMG-V3-01 was branched from feat/v3-top-v3-01-toposolid — fix worker must rebase onto main after WP-041 merges.
- WP-040 DSC-V3-01 was branched from feat/v3-img-v3-01-image-to-layout — fix worker must rebase onto main (drop IMG commit).
- Orphan store-coerce fix: 7e44a3c0 (on old edt branch) is equivalent to 3b580a98 (on OUT-V3-01 branch); when OUT merges the fix lands. Drop 7e44a3c0.
- Seed/viewport orphans (615fad24, c7ddc1bf, 06840cef, 8dc5ee7a, 12ec01dd) are visual fixes on old branches; user must decide whether to cherry-pick.
