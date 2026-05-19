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
  spec/bim-integrity-rendering-sketch-methodology-tracker.md, the target brief,
  the required feature pack, and the current seed evidence.
- Identify the current phase, required sketch/brief features, required views,
  model integrity blockers, renderer diagnostic blockers, Advisor findings,
  stale evidence inputs, and acceptance gates.

During editing:
- Change only source recipe/bundle/model code needed for this assignment.
- Run integrity and constructability evidence after each meaningful model
  change.
- Treat renderer unsupported/failed diagnostics for required visual features as
  blockers.
- Capture or refresh the required browser/evidence screenshots for changed
  feature views.
- Keep finding dispositions explicit: fixed, tolerated with owner/expiry, or
  blocked with a reproducible reason.

Before reporting completion:
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
| Freshness | Evidence matches current model revision, Advisor rule digest, renderer support matrix, seed source, target spec, and git head. |
| Benchmarks | Relevant benchmark or rehearsal row records integrity, renderer diagnostics, exchange, performance, and acceptance status. |
| Drift gates | Generated tracker status, Advisor rule docs, renderer support matrix, and benchmark suite metadata are in sync. |

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

## Gates Run
| Command | Result |
| ------- | ------ |
| <command> | pass/fail, key output |

## Tracker Updates
| Row | Status | Evidence note |
| --- | ------ | ------------- |
| BIR-... | Partial/Done | exact proof and remaining gap |

## Blockers
- None, or concrete unresolved blocker with owner/follow-up.
```
