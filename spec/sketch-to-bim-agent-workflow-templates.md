# Sketch-to-BIM Agent Workflow Templates

Purpose: reusable prompts and closeout checklists for agents authoring or
reviewing sketch-to-BIM seeds. These templates are governance artifacts, not
product Advisor rules. They force agents to prove integrity, renderer support,
Advisor parity, evidence freshness, and sketch acceptance before reporting a
seed as accepted.

## Standard Agent Prompt

Use this prompt for any sketch-to-BIM implementation worker:

```text
You are authoring a sketch-to-BIM seed in bim-ai.

Before editing:
- Read spec/sketch-to-bim-methodology.md, spec/sketch-to-bim-failure-taxonomy.md,
  spec/archive/bim-integrity-rendering-sketch-methodology-tracker.md, the target brief,
  the required feature pack, and the current seed evidence.
- Identify the current phase, required sketch/brief features, required views,
  model integrity blockers, renderer diagnostic blockers, Advisor findings,
  stale evidence inputs, and acceptance gates.

During editing:
- Change only source recipe/bundle/model code needed for this assignment.
- Author through the declared CLI/MCP/API command surface. Do not patch live
  state without a source bundle/recipe command that can be replayed.
- Run integrity and constructability evidence after each meaningful model
  change.
- Treat renderer unsupported/failed diagnostics for required visual features as
  blockers.
- Capture or refresh the required browser/evidence screenshots for changed
  feature views.
- Keep assumption and source-feature ledgers current. Every assumption needs a
  source reference, confidence/disposition, and owner; every required feature
  needs source refs, BIM target selectors or element ids, and command refs.
- Keep finding dispositions explicit: fixed, tolerated with owner/expiry, or
  blocked with a reproducible reason.

Before reporting completion:
- Run `python3 claude-skills/sketch-to-bim/sketch_bim.py assumption-ledger
  --seed <seed> --phase <phase> --fail-on-incomplete`.
- Run `python3 claude-skills/sketch-to-bim/sketch_bim.py source-feature-map
  --seed <seed> --phase <phase> --fail-on-incomplete`.
- Run `python3 claude-skills/sketch-to-bim/sketch_bim.py agent-loop-packet
  --seed <seed> --phase <phase> --fail-on-untraced`.
- Run Advisor/constructability evidence and parity checks.
- Run renderer diagnostics or the renderer support matrix check used by this
  seed.
- Run sketch acceptance/semantic visual gates for the affected phase/features.
- Run stale evidence validation against current model revision, Advisor rule
  digest, renderer support matrix, seed source, target spec, and git head.
- Run focused tests and the relevant generated-doc drift checks.
- Update tracker rows conservatively. Mark Done only when implementation,
  tests, generated docs, evidence artifacts, and limitations are all linked.
- Commit only your own changes locally and do not push.
```

## Evidence Gate Checklist

Agents must record all rows in their closeout note:

| Gate | Required proof before completion |
| ---- | -------------------------------- |
| Integrity | Model integrity and constructability checks have zero blocking errors, or every blocker has a disposition. |
| Renderer | Renderer diagnostics/support matrix covers required visual features; unsupported required features block acceptance. |
| Advisor | CLI/API/UI or right-rail parity evidence is current for the affected model/profile. |
| Sketch acceptance | Required features, views, screenshots, and semantic visual checklist rows are current and pass or carry accepted tolerances. |
| Assumptions | Assumption ledger is non-empty, source-linked, and has no unresolved contestable rows. |
| Source traceability | Source-feature map links sketch evidence to BIM targets and bundle/recipe commands; blocking findings have command lineage in `agent-loop-packet.json`. |
| Render/export | Renderer diagnostics, screenshot manifest, visual gate, and export validation are present and pass for required features. |
| Freshness | Evidence matches current model revision, Advisor rule digest, renderer support matrix, seed source, target spec, and git head. |
| Rehearsal/benchmarks | Relevant benchmark or disposable rehearsal row records integrity, renderer diagnostics, exchange, performance, acceptance, source-feature mapping, and stale-check status. |
| Drift gates | Generated tracker status, Advisor rule docs, renderer support matrix, and benchmark suite metadata are in sync. |

## Disposable Rehearsal Prompt

Use this prompt before claiming `BIR-O04` style closure:

```text
Run a disposable sketch-to-BIM rehearsal without committing seed artifacts.
Use a throwaway project/model id and write evidence under a temporary or
nightshift path. The rehearsal must exercise: source evidence parse, phase plan,
assumption ledger, source-feature map, CLI/MCP/API command authoring, dry-run,
commit/apply, Advisor/constructability, integrity diagnostics, renderer
diagnostics, screenshots/semantic checklist, export validation, stale check,
finding-to-command traceability, tolerance ledger, and closeout report.

The rehearsal is accepted only if the artifact set is reproducible, every gate
records pass/fail status, and no disposable model appears in the committed seed
library. If any gate is blocked, keep the rehearsal status blocked and link the
repro command and evidence path.
```

## Wave Closeout Template

Use this report shape for wave workers and parent closeout:

```markdown
## Scope
- Agent:
- Owned tracker rows:
- Commit:

## Changes
- Code/docs:
- Evidence artifacts:
- Generated docs:
- Assumption/source-feature ledgers:
- Rehearsal/benchmark artifacts:

## Gates Run
| Command | Result |
| ------- | ------ |
| <command> | pass/fail, key output |

## Methodology Closure
| Gate | Artifact | Result |
| ---- | -------- | ------ |
| Assumptions | assumption-ledger.json | pass/fail |
| Source-feature map | source-feature-map.json | pass/fail |
| Finding traceability | agent-loop-packet.json | pass/fail |
| Integrity/render/export | integrity, renderer, export artifacts | pass/fail |
| Freshness/rehearsal | stale-check and rehearsal evidence | pass/fail |

## Tracker Updates
| Row | Status | Evidence note |
| --- | ------ | ------------- |
| BIR-... | Partial/Done | exact proof and remaining gap |

## Blockers
- None, or concrete unresolved blocker with owner/follow-up.
```
