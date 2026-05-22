# Testhouse Convergence Loop — `/loop` Driver

Companion to `spec/archive/testhouse-convergence-loop-tracker.md` and the two
scripts in this directory (`testhouse_convergence_pass.py` and
`testhouse_convergence_prompts.py`).

## How to start the loop

From any conversation in the bim-ai repo, paste:

```
/loop 1200s Drive the testhouse convergence loop. On each pass:

1. cd /home/jhoetter/repos/bim-ai/app && uv run python ../scripts/testhouse_convergence_pass.py
   Read the JSON summary it prints. The summary is also persisted to
   tmp/reverse-bim/convergence-state.json so a context-reset wakeup can pick it up.

2. If summary.allTerminal is true:
     - Update spec/trackers/testhouse-hybrid-reverse-bim-tracker.md with the final
       per-house outcome (accepted vs blocked_with_disposition vs
       blocked_pass_budget_exhausted), commit, and exit the loop
       (omit ScheduleWakeup).

3. Otherwise, for each row in summary.houses:
   a. For each entry in row.pendingSubagentDispatches:
      - Get the prompt:
          uv run python /home/jhoetter/repos/bim-ai/scripts/testhouse_convergence_prompts.py \
            --action <dispatch.action> --house <dispatch.args.house> \
            --level <dispatch.args.level || ''> --retry <dispatch.args.retry>
      - Dispatch via the Agent tool:
          subagent_type: general-purpose
          description: "<dispatch.id>"
          prompt: <stdout from the prompts script>
          run_in_background: false   (block in this turn)
      - When the agent returns, record its dispatchId in
        completedSubagentDispatches by writing the response file at the
        path the prompt instructed. The next pass script will pick it up.
      - Update the retryCounter (the pass script does this on next
        pass; no action needed here).
   b. Increment the orchestrator's per-house action counter; stop
      dispatching for this house once 3 actions have run this pass.

4. After all dispatches in this pass complete, re-run the pass script
   to ingest the new response files and advance state.

5. If summary.allTerminal is now true, do step 2's tracker close.
   Otherwise, ScheduleWakeup(1200s) with the same prompt.

Plateau detection, pass budget, retry budgets are all enforced inside
the pass script. The orchestrator's only job in this loop is to call
the pass script, dispatch its pendingSubagentDispatches, and re-call
the pass script.
```

## Why 1200s heartbeat

Per the `ScheduleWakeup` guidance: 1200 seconds (20 minutes) is well
past the 5-minute prompt-cache TTL, so each wake-up pays the cache
miss exactly once and amortizes it across however many subagent
dispatches the orchestrator runs in-turn. Shorter intervals burn the
cache repeatedly; longer intervals make the loop feel idle.

## Manual single-pass invocation

If you just want to run one pass without setting up `/loop`:

```bash
cd /home/jhoetter/repos/bim-ai/app && \
  uv run python ../scripts/testhouse_convergence_pass.py | tee /tmp/pass.json

# Inspect pendingSubagentDispatches:
jq '.houses[].pendingSubagentDispatches' /tmp/pass.json

# Get the prompt for one of them:
uv run python ../scripts/testhouse_convergence_prompts.py \
  --action numeric_reader_for_level --house house-gamma --level KG --retry 1
```

Paste the prompt into a fresh Claude Code conversation with subagent
support and the resulting response will land at the path the prompt
instructs. Re-run the pass script to ingest.

## State file location

`tmp/reverse-bim/convergence-state.json`. The pass script creates it
on first run if missing. Delete the file to restart the convergence
from `iter2_authored` for every house.

## Safe to interrupt

Any pass can be interrupted at any moment — the pass script always
writes the state file before exiting, even on errors. The next
invocation picks up from the persisted state. Subagent dispatches
themselves are not interruptible mid-run (the Agent tool blocks the
turn), but each completion writes an atomic response file the next
pass ingests.

## Reset / re-run from scratch

```bash
rm tmp/reverse-bim/convergence-state.json
# Optionally also rm the dev-server models if you want to re-create them:
# (the loader script will re-create them under fresh UUIDs)
rm tmp/reverse-bim/house-*/iter-2-dev-model.json
```

## What the loop will not do

- Decide ambiguous source content (e.g. mutually-contradictory
  building-scope evidence with no human disambiguation).
- Create / migrate database tables.
- Fix a renderer crash in the web app that prevents Playwright from
  capturing a model. Those errors are recorded under `house.errors`
  and the offending gate plateaus into `blocked_with_disposition`
  after 3 passes.
