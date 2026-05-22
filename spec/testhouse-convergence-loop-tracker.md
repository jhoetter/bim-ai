# Testhouse Convergence-Loop Architecture Tracker

Last updated: 2026-05-22

Status: **Architecture spec. Implementation in progress.** This tracker
documents the orchestration layer that will drive
`spec/testhouse-hybrid-reverse-bim-tracker.md` from
`packageState=source_understanding_blocked` (its 2026-05-22 close state)
through to per-house final-acceptance or explicit
`source_unavailable` blocker closeout, without requiring a human in the
loop on every pass.

## Why this exists

The testhouse tracker's iter-2 close left the three houses at:

| House | final_acceptance passed / total | Remaining blocking gates |
| --- | --- | --- |
| Alpha | 6 / 11 | `level_completeness`, `physical_topology`, `source_overlay_evidence`, `ui_evidence`, `findings_disposed` |
| Beta  | 6 / 11 | same |
| Gamma | 6 / 11 | same |

Each remaining blocker has a canonical unblocker action. In a hand-driven
session the orchestrator (the LLM agent) dispatches subagents, runs
authoring scripts, drives Playwright captures, and re-runs gates — but
each conversation has a finite context budget, and any handoff between
conversations loses in-flight state. The convergence loop is the
plumbing that makes the work resumable across context resets: state on
disk, deterministic gate-drivers in Python, and a small set of subagent
prompts the LLM orchestrator can dispatch without per-call judgment.

## Operating shape

```
/loop 1200s  (20-min heartbeat, well past the 5-min cache window)
    │
    └─▶ LLM orchestrator wake-up
            │
            ├─▶ Bash: run scripts/testhouse_convergence_pass.py
            │         (loads state.json, drives non-subagent gates inline,
            │          writes state.json, prints what's pending)
            │
            ├─▶ For each pendingSubagentDispatch:
            │       Agent() with prompt from
            │       scripts/testhouse_convergence_prompts.py
            │
            ├─▶ Bash: re-run scripts/testhouse_convergence_pass.py
            │         (it picks up new response files, advances state)
            │
            └─▶ If state.allTerminal: end /loop, commit tracker update.
                Else: ScheduleWakeup(1200s).
```

The state file is the single source of truth between passes. The pass
script is deterministic and idempotent — running it twice in a row with
no new responses produces the same state.

The pass script does NOT call `Agent()`. Only the LLM orchestrator can
do that. The pass script signals "what needs a subagent" via its
output, and the orchestrator handles dispatch in its own turn.

## Per-house state machine

```
                         ┌───────────────────────────────┐
                         │  iter2_authored               │  (start state — set by iter-2 close)
                         └──────────────┬────────────────┘
                                        │
                            iter-2 dev-server load done
                                        ▼
                         ┌───────────────────────────────┐
                         │  iter3_loaded_in_dev          │
                         └──────────────┬────────────────┘
                                        │
                              drive view_capture_plan
                                        ▼
                         ┌───────────────────────────────┐
                         │  iter3_capture_plan_ready     │
                         └──────────────┬────────────────┘
                                        │
                      run Playwright capture pipeline
                                        ▼
                         ┌───────────────────────────────┐
                         │  iter3_screenshots_captured   │
                         └──────────────┬────────────────┘
                                        │
                      drive source_overlay + ui_evidence
                                        ▼
                ┌───────────────────────────────────────────┐
                │  iter3_evidence_reports_ok                │
                └──────────────┬────────────────────────────┘
                               │
                  any model-side gates still blocking?
                ┌──────────────┴──────────────────────────┐
                ▼                                          ▼
   level_completeness                            physical_topology
   needs walls per level                          needs rooms / openings
   needs numeric reader                           needs room reader
   dispatch subagent                              dispatch subagent
   reapply author + reload                        reapply author + reload
                ▼                                          ▼
                └──────────────┬──────────────────────────┘
                               │
                      re-run final_acceptance
                ┌──────────────┴──────────────┐
                ▼                              ▼
           accepted                       blocker count plateau
                │                              │
                ▼                              ▼
         ┌──────────────┐            ┌─────────────────────┐
         │ accepted     │            │ blocked_with_       │
         │ (terminal ✓) │            │ disposition         │
         └──────────────┘            │ (terminal ⛔ —      │
                                     │ source_unavailable) │
                                     └─────────────────────┘
```

A house is **terminal** in two states only:

- `accepted` — `final_acceptance.accepted == true`.
- `blocked_with_disposition` — the same blocking-gate set has appeared
  on N consecutive passes with the same evidence, and the orchestrator
  has written an explicit `source_unavailable` disposition into the
  iter-3 source-fact ledger.

## Gate → unblocker table

| Blocking gate ID | Action (deterministic) | Verifier | Dispatches subagent? |
| --- | --- | --- | --- |
| `view_capture_plan` failed | `scripts/testhouse_iter2_drive_gates.py` step 1 | plan has `summary.blockerCount==0` | no |
| `source_overlay_evidence` | `pnpm --filter @bim-ai/web reverse-bim:capture -- --plan <plan>.json --out <evidence>/ --json`, then re-POST `reverse_bim.source_overlay_evidence` with the resulting manifest | report `accepted==true` or `blockingCount==0` | no (Playwright is local) |
| `ui_evidence` | Same capture pipeline; re-POST `reverse_bim.ui_evidence` | report `accepted==true` | no |
| `level_completeness` (missing numeric coords) | Dispatch numeric-coordinate reader for each empty level → write `responses/reader-pass-N/...json` → re-run `scripts/testhouse_iter2_finalize.py` (folder-output) → re-run `scripts/testhouse_iter2_author.py` → re-load to dev | `query.levels` returns `modeledPhysicalElementCount >= 1` per source-required level | **yes** (action `numeric_reader_for_level`) |
| `physical_topology` | Dispatch room-outline + opening reader → re-author with `author.room_outline` / `opening.door_on_wall` / `opening.window_on_wall` commands → re-load | `query.room_access_graph` returns no `inaccessibleRoomIds` | **yes** (action `room_opening_reader`) |
| `findings_disposed` | Run `reverse_bim.visual_review_normalize` against captured overlays + auto-disposition rule-based cases | `unresolvedBlockingCount==0` | no |
| `area_reconciled` | Dispatch area-schedule reader (when source has area calc PDFs) OR mark `source_unavailable` (when no area schedule exists) → re-run `qa.area_reconciliation` | report accepted | **yes** (action `area_schedule_reader`) |

## Escalation rules

1. **Subagent retry budget = 2.** First dispatch uses the canonical
   prompt. On miss (no output file, malformed JSON, no numeric coords
   in expected fields), the second dispatch uses a tighter retry prompt
   that explicitly addresses the prior failure mode. After two misses,
   the action records a `source_unavailable` disposition for the
   targeted fact set and the house's blocking-gate moves to terminal
   `blocked_with_disposition`.
2. **Per-pass action budget = 3 actions per house.** Each `/loop` pass
   runs at most three unblocker actions per house. Prevents one
   pass from grinding on a single house while others starve.
3. **Plateau detection.** If the same blocking-gate set appears on 3
   consecutive passes for a house, the orchestrator treats it as a
   terminal `blocked_with_disposition` and stops dispatching subagents
   for that house. Final tracker writeup documents the gap.
4. **Total pass budget = 24.** The loop self-terminates after 24
   passes (≈ 8 hours at 1200s heartbeat) regardless of state, to
   prevent runaway. Anything still in flight is documented as
   `blocked_pass_budget_exhausted`.

## State file

Path: `tmp/reverse-bim/convergence-state.json`.

Shape:

```jsonc
{
  "schemaVersion": "testhouseConvergenceState_v1",
  "createdAt": "<ISO timestamp>",
  "lastPassAt": "<ISO timestamp>",
  "passCount": <int>,
  "passBudget": 24,
  "allTerminal": false,
  "houses": {
    "house-alpha": {
      "phase": "iter3_capture_plan_ready",
      "terminal": false,
      "terminalReason": null,
      "lastFinalAcceptance": {
        "passed": 6, "total": 11,
        "blockingGates": ["level_completeness", "physical_topology", "source_overlay_evidence", "ui_evidence", "findings_disposed"]
      },
      "blockingGateHistory": [
        // last 3 final_acceptance blockingGates lists, used for plateau detection
      ],
      "pendingSubagentDispatches": [
        {
          "id": "alpha-iter3-num-kg-pass-01",
          "action": "numeric_reader_for_level",
          "args": {"house": "house-alpha", "level": "KG", "retry": 1},
          "promptKey": "numeric_reader_for_level",
          "responseExpectedPath": "tmp/reverse-bim/house-alpha/ai-reading/responses/reader-pass-iter3/...json"
        }
      ],
      "completedSubagentDispatches": [],
      "retryCounters": {"numeric_reader_for_level:KG": 0},
      "dispositions": []
    }
    // ... house-beta, house-gamma
  }
}
```

## /loop driver

Invoke from any conversation:

```text
/loop 1200s Run scripts/testhouse_convergence_pass.py.
  Read its "pendingSubagentDispatches" for each house.
  For each dispatch, call Agent() with subagent_type=general-purpose and
  the prompt produced by
  scripts/testhouse_convergence_prompts.py prompt_for(<dispatch>).
  Wait for completion in the same turn.
  Re-run scripts/testhouse_convergence_pass.py to ingest the responses.
  If state.json's allTerminal is true, commit the tracker update and
  end the loop (omit ScheduleWakeup). Otherwise continue.
```

The /loop heartbeat is 1200s (20 minutes). Choice reasoning per the
ScheduleWakeup guidance: well past the 5-minute prompt-cache TTL, so
each wake-up pays the cache miss once and amortizes it across multiple
subagent dispatches; not so long that the user feels "stuck" waiting.

## Completion criteria

This architecture tracker closes when:

1. `scripts/testhouse_convergence_pass.py` exists, is idempotent, and
   reports per-house state correctly when invoked on a clean working
   tree.
2. `scripts/testhouse_convergence_prompts.py` exists with the canonical
   prompts for each subagent action listed in the gate table above.
3. The /loop driver wiring above has been exercised at least once
   end-to-end (one full pass producing a state file).
4. The companion tracker
   `spec/testhouse-hybrid-reverse-bim-tracker.md` has an iteration-3
   section referencing this architecture as the driver for iter-3.

## What this architecture cannot do

- Fabricate dimensions the source genuinely does not record. Houses
  where the source folder has no measurable dimensional content (alpha
  KG, gamma's all-prose rescue file) will reach
  `blocked_with_disposition` regardless of subagent quality.
- Resolve genuinely ambiguous building-scope decisions when the source
  is mutually contradictory and there is no evidence for either side.
- Run the Playwright capture pipeline if the web app fails to render
  the loaded model (e.g. a renderer bug). Those are caught as `error`
  diagnostics on the action; the convergence script writes the error
  to state and the house pauses on that gate until the bug is fixed.

These are intentional ceilings. The convergence loop's job is to drive
the work that **can** be automated; everything else escalates cleanly.
