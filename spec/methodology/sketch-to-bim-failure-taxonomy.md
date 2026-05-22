# Sketch-to-BIM Failure Taxonomy

Last updated: 2026-05-19

This taxonomy is for sketch-to-BIM phase packets, final acceptance manifests,
and future CLI/API output. It separates deterministic product failures from
project-specific sketch acceptance and brief acceptance failures.

## Required Failure Record

Every unresolved phase issue must use this shape, whether recorded in Markdown,
JSON, or CLI output:

| Field | Meaning |
| -- | -- |
| `category` | One of `model-integrity`, `renderer`, `sketch-fidelity`, `command-surface`, `evidence-staleness`, or `user-tolerance`. |
| `status` | `blocker`, `tolerance`, or `resolved`. |
| `ownerLayer` | The layer expected to fix or own the issue. |
| `source` | The rule id, renderer diagnostic id, checklist id, brief row, command id, or evidence check that raised it. |
| `affectedIds` | Model element ids, feature ids, view ids, command ids, or evidence file ids. |
| `phase` | The phase that introduced or discovered the issue. |
| `evidence` | Paths or digests for Advisor payloads, screenshots, renderer diagnostics, Sketch Understanding IR, capability matrix, bundle, or user tolerance note. |
| `decision` | Why it blocks, why it is tolerated, or what fixed it. |

`blocker` means the phase cannot advance. `tolerance` means the issue remains
visible and accepted with a scoped rationale. `resolved` means current evidence
proves the issue was fixed.

## Categories

| Category | Owner layer | Blocks when | Tolerable when | Examples | Evidence expected |
| -- | -- | -- | -- | -- | -- |
| `model-integrity` | Normal Advisor, constructability, constraints, BIM engine | The model is physically, semantically, or coordination-invalid. Errors always block; warnings block when tied to current-phase authored elements unless explicitly tolerated. | The finding is known nonblocking for this phase, has no user-facing effect, and has a written scope and expiry. | `room_unenclosed`, `floor_overlap`, invalid opening host, stair comfort failure, unsupported physical/helper role leakage, schedule rows referencing missing elements. | Advisor/constructability JSON with rule ids, severity, profile, affected element ids, recommendation, model revision, and current git head. |
| `renderer` | Viewport, screenshot, export renderer, renderer diagnostics | Required geometry is valid in the model but fails to render/export faithfully, or renderer diagnostics report unsupported/dropped visual features needed for acceptance. | The missing visual feature is outside the target quality level or explicitly accepted as a documented renderer limitation. | Roof opening command persists but screenshot shows uncut roof; dormer cut silently no-ops; categories hidden in acceptance view; glTF/PDF export drops a balcony. | Renderer diagnostics JSON, screenshot/export paths, required-view manifest, affected feature ids, and comparison to the source sketch or expected view. |
| `sketch-fidelity` | Sketch acceptance methodology, agent visual readout, target feature checklist | Current evidence does not match required sketch-derived features for the phase or final target level. This is not a normal Advisor finding. | The user accepts a deliberate design deviation, or the quality target is lower than the omitted feature requires. | Silhouette too boxy; asymmetric gable reads as generic roof; facade bay rhythm materially differs; material contrast missing; room/furniture layout visibly compressed. | Sketch Understanding IR, source image references, semantic checklist rows, screenshot paths, viewpoint names, visual readout, and feature-to-element mapping. |
| `command-surface` | CLI/API/MCP/seed DSL/product transaction surface | The agent cannot express, apply, replay, or trace a required feature through a supported deterministic surface. | A lower-level bundle workaround is documented and still produces traceable, reviewable model elements. | No public command for wall recess; DSL cannot produce a needed roof form; `sketch.phase.apply` is contract-only; command output lacks ids needed for refinement. | Command/API descriptor, bundle or recipe rows, dry-run output, capability matrix row, trace from feature to command ids, and documented fallback. |
| `evidence-staleness` | Evidence/provenance runner, phase packet, CI/check scripts | Evidence was produced against a different git head, model revision, ruleset, renderer build, IR hash, capability hash, or screenshot manifest than the current claim. | Only for non-acceptance draft handoff, clearly labeled stale and never called accepted. | Checked-in Advisor payload predates rule changes; screenshots were captured before seed source changed; capability matrix hash differs from manifest. | Provenance manifest with current and recorded git head, model revision, IR hash, capability hash, Advisor/rule digest, renderer diagnostics digest, screenshot manifest, stale reason. |
| `user-tolerance` | User/project owner, acceptance packet | A blocker can only be waived by an explicit user/project decision and no such decision exists. | The tolerance names the issue, scope, owner, expiry/revisit point, and user/project acceptance. | User accepts omitting rear facade detail in concept BIM; owner accepts known area variance; renderer limitation allowed for a draft but not final. | Tolerance table or user note with date, decision-maker, affected ids/features, rationale, expiry, and evidence bundle it applies to. |

## Blocker Policy

- Normal Advisor/integrity/constructability errors are `model-integrity`
  blockers.
- Renderer diagnostics are `renderer` blockers when they affect a required
  sketch or brief feature.
- A missing required sketch feature is a `sketch-fidelity` blocker even when the
  normal Advisor is clean.
- Missing, stale, or mismatched evidence is an `evidence-staleness` blocker for
  any `accepted` claim.
- User tolerances do not erase the original category. Record both the original
  failure and the `user-tolerance` decision that permits advancement.

## CLI Output Guidance

Future CLI output should preserve category and status separately from product
rule severity:

```json
{
  "category": "sketch-fidelity",
  "status": "blocker",
  "ownerLayer": "sketch-acceptance",
  "source": "semantic-checklist.roof-form",
  "affectedIds": ["feature:asymmetric-gable", "view:main-perspective"],
  "phase": "3-envelope",
  "evidence": ["evidence/phase-3/main-perspective.png", "evidence/sketch-ir.json"],
  "decision": "Main viewpoint still reads as a generic flat/gable box; phase cannot advance."
}
```
