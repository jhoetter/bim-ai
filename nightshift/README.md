# Nightshift — parallel-agent overnight execution

Seven AI engineers running in parallel against the bim-ai backlog.

## Agents and themes

| Agent | Branch        | Theme                                                  | WPs                                              |
| ----- | ------------- | ------------------------------------------------------ | ------------------------------------------------ |
| 1     | `nightshift-1` | Roof renderer + IFC roof exchange                      | KRN-11, IFC-01, IFC-02                            |
| 2     | `nightshift-2` | Wall openings, door variants, window outlines          | KRN-04, KRN-13, KRN-12                            |
| 3     | `nightshift-3` | Materials catalog + curtain wall panels                | MAT-01 (Part A + B), KRN-09                       |
| 4     | `nightshift-4` | Coordinate system, project templates, worksharing docs | FED-05, FAM-06, KRN-06, VIE-06                    |
| 5     | `nightshift-5` | View discipline (detail levels, elevations, isolate)   | VIE-05, VIE-07, VIE-04, VIE-03, ANN-02, VIE-01   |
| 6     | `nightshift-6` | CLI + validation                                       | CLI-01, VAL-01, CLI-02                            |
| 7     | `nightshift-7` | Family editor depth (sweep, mirror, formulas, flex)    | FAM-09, FAM-07, FAM-04, FAM-02                    |

**Total:** 24 assigned WPs across 7 agents. Each agent is also instructed to pick up additional Wave-0 WPs from the tracker after exhausting their queue.

## How to invoke an agent

Hand each agent its prompt file:

> Your task for this nightshift is in `nightshift/nightshift-<N>.md`. Read it end-to-end and execute. Do not stop until every WP is done.

Each prompt is self-contained — it specifies the branch, file ownership, merge protocol, quality gates, anti-laziness rules, and the per-WP scope.

## File-ownership map (collision risk)

High-collision shared files (every agent expects to rebase through these):

- `spec/workpackage-master-tracker.md` — every agent updates their rows
- `packages/core/src/index.ts` — element-kind extensions from agents 1, 2, 3, 4, 5, 7
- `app/bim_ai/elements.py` — same
- `app/bim_ai/commands.py` — agents 2, 3, 4, 5, 7 add new commands
- `app/bim_ai/engine.py` — agents 2, 3, 4, 5, 7 add engine logic

Owned files (one agent only):

- Agent 1: `app/bim_ai/export_ifc.py`, `app/bim_ai/roof_geometry.py`, roof functions in `meshBuilders.ts`
- Agent 2: `packages/web/src/families/geometryFns/{doorGeometry,windowGeometry}.ts`, wall-opening CSG path
- Agent 3: `packages/web/src/viewport/materials.ts`, curtain wall functions, `addStandingSeamPattern`
- Agent 4: `docs/collaboration-model.md`, `app/bim_ai/templates/`, font assets, origin-marker rendering
- Agent 5: `packages/web/src/plan/planProjection*.ts`, project browser elevation group, view state slice
- Agent 6: CLI subcommands (`export json`, `diff`), `app/bim_ai/diff_engine.py`, room-enclosure constraint
- Agent 7: `packages/web/src/familyEditor/*`, sweep geometry, expression evaluator

## Merge cadence

Per WP: each agent commits → pushes branch → rebases onto latest main → fast-forwards merge to main → pushes main. Tracker update is a separate commit on the branch, also ff-merged. Agents loop up to 5 times on push-to-main races before giving up and continuing.

The user's `pre-push` git hook will be invoked on every push; it runs the project's checks. If the hook blocks a push, the agent investigates the underlying failure (never `--no-verify`).

## Status

Each agent appends to its own `nightshift-<N>-status.md` file at end-of-shift. The user reads these in the morning to assess progress and merge-blocked items.
