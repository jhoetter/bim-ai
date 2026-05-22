# Sketch-to-BIM Methodology

Last updated: 2026-05-18

This is the active entrypoint for sketch-to-BIM methodology. The archived
methodology under `spec/archive/` is historical context only.

For current work, use these sources together:

- `spec/trackers/sketch-to-bim-readiness-tracker.md` for the active backlog, milestones,
  CLI/MCP gaps, real-BIM methodology gaps, and target-house readiness gates.
- `spec/archive/bim-integrity-rendering-sketch-methodology-tracker.md` for the new
  BIM-integrity, renderer-fidelity, Advisor, and sketch-acceptance backlog
  exposed by the target-house dry run.
- `spec/sketch-to-bim-product-surfaces.md` for the current product/agent
  surface inventory.
- `spec/sketch-to-bim-failure-taxonomy.md` for blocker/tolerance categories,
  owner layers, examples, and expected evidence.
- `spec/sketch-to-bim-capability-matrix.json` for feature-to-capability
  readiness.
- `spec/trackers/ui-mcp-parity-tracker.md` for the broader UI/Cmd+K/CLI/MCP parity
  design.
- `claude-skills/sketch-to-bim/SKILL.md` for the operational phase checklist.

## Method

Sketch-to-BIM runs use a compiler loop, not a one-shot translation:

```text
source sketch / floorplan / brief
  -> visual source-of-truth read
  -> Sketch Understanding IR
  -> BIM information requirements
  -> capability and surface check
  -> phase plan
  -> deterministic bundle / recipe
  -> dry-run and commit through product transaction surfaces
  -> deterministic Advisor, constructability, renderer diagnostics,
     screenshots, and evidence package
  -> warning/error-led refinement against named model elements and required
     visual features
  -> sketch acceptance / brief acceptance or issue ledger
  -> final accepted seed artifact only after current-head evidence passes
```

## Deterministic Advisor-Driven Authoring

The software's error detection is part of authoring, not a final audit step. An
agent must use Advisor, constructability reports, validation payloads, dry-run
warnings, and evidence-package findings after every meaningful phase change.
The normal Advisor is deterministic and project-general: it reports BIM/code,
physics, coordination, constructability, metadata, and export-readiness issues
that can be derived from the model and selected profile. It does not make
subjective aesthetic judgments, judge whether a model resembles a customer
sketch, or decide whether it satisfies a project-specific design brief.

Required behavior:

- collect warning and info payloads in addition to errors;
- preserve finding code, severity, profile, message, recommendation, affected
  element ids, and viewpoint/context when available;
- export an agent loop packet for each phase that joins Advisor and
  constructability findings to recipe/bundle source lines, authoring commands,
  optional command-log transactions, phase ownership, and the next verification
  action;
- classify each finding as `fix-now`, `fix-in-phase`, `later-phase`,
  `tolerated`, or `blocked`;
- resolve all findings tied to elements authored in the current phase unless a
  written tolerance explains why the warning is acceptable;
- treat UI Advisor/profile drift as a blocker until CLI/API and UI evidence are
  reconciled;
- use warnings as design feedback, for example room enclosure, missing doors,
  stair comfort, roof/opening hosts, clearance conflicts, material/type gaps,
  schedule/export gaps, and construction-readiness issues.

An Advisor-clean model can still fail sketch acceptance or brief acceptance. A
visually correct model with unresolved Advisor/constructability warnings is also
not accepted unless the tolerance is explicit, scoped, and visible in the final
packet.

## Sketch And Brief Acceptance

Sketch acceptance and brief acceptance are methodology gates layered on top of
the normal deterministic product checks. They are run only for a sketch-to-BIM
project or another project with an explicit source sketch/brief contract.

- `sketch acceptance` checks current rendered evidence against required
  sketch-derived features: silhouette, proportions, roof form, openings,
  facade rhythm, material contrast, rooms, stairs, and named viewpoints.
- `brief acceptance` checks the source brief and Sketch Understanding IR
  against the model: programme, target areas, levels, room names, dimensions,
  material intent, documentation requirements, and declared tolerances.
- Neither gate creates generic Advisor findings for unrelated projects. A
  normal architect-authored project must not receive product warnings such as
  "does not match sketch" unless that project opted into sketch/brief evidence.
- Phase packets must classify unresolved issues with the taxonomy in
  `spec/sketch-to-bim-failure-taxonomy.md`, including blocker/tolerance status,
  owner layer, example, and evidence path.

## Sketch Acceptance Provenance

Sketch acceptance is a methodology gate, not the normal live Advisor. Brief
acceptance follows the same provenance rule when the project has a written
programme or dimensional brief. The
product-owned scaffold is
`packages/cli/lib/sketch-acceptance-provenance.mjs`; phase acceptance should use
it to record the current git head, model revision, Sketch Understanding IR hash,
capability hash, Advisor/rule/integrity digests, renderer-diagnostics digest,
required feature-to-element mappings, evidence paths, and stale reasons.

This provenance manifest proves that a sketch-specific or brief-specific
acceptance claim was made against current evidence. It must not create generic
product findings such as "looks unlike the sketch" for unrelated
architect-authored projects.

## Quality Targets

| Target                   | Meaning                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `massing_only`           | Visual massing and silhouette study.                                                                     |
| `concept_bim`            | Primary BIM objects with basic usability evidence.                                                       |
| `project_initiation_bim` | Usable project seed with rooms, access, Advisor evidence, screenshots, and BIM information requirements. |
| `documentation_ready`    | Project initiation plus sheets, schedules, exports, and documentation evidence.                          |

## Real BIM Minimum

For `project_initiation_bim`, a model is not accepted solely because it looks
like the reference. It must also have:

- levels, storeys, and rooms/spaces with names, target areas, function labels,
  access, and schedule intent;
- typed architectural elements rather than final mass placeholders;
- wall/floor/roof/stair/opening type intent, material intent, and layer-set
  placeholders where known;
- exterior/interior/load-bearing/fire/thermal placeholders where relevant;
- classification placeholders for rooms and building elements;
- structural and MEP-lite assumptions where the sketch implies stairs, shafts,
  wet rooms, equipment zones, or penetrations;
- saved views, diagnostics, Advisor/constructability evidence, and stale-check
  metadata;
- warning/error issue ledger with every current-phase finding resolved or
  explicitly tolerated;
- explicit tolerances for anything not yet supported.

## Surface Policy

Use the strongest public surface available:

1. First-class API/MCP descriptor or route when it is executable.
2. Typed CLI command when the route is contract-only or CLI is the canonical
   implementation.
3. Seed DSL/domain macro when it preserves intent and compiles to reviewable
   `cmd-v3.0`.
4. Raw bundle only when no semantic surface exists; document the gap.
5. Browser automation only for evidence capture or UI equivalence checks, not as
   the sole authoring contract.

Current sketch-specific exceptions are intentional. `sketch.seed.compile` is
CLI-only until the Node seed compiler is hosted server-side. `sketch.phase.apply`
is a CLI wrapper plus a contract-only API descriptor; the blessed API transaction
path is `POST /api/models/{model_id}/bundles`, with CLI `sketch phase apply` as
the external-agent convenience path over the same `cmd-v3.0` bundle semantics.

## Current Gate

Before generating `target-house-1`, close or explicitly tolerate the P0 items in
`spec/trackers/sketch-to-bim-readiness-tracker.md` and
`spec/archive/bim-integrity-rendering-sketch-methodology-tracker.md`, then produce the
target-house no-seed rehearsal packet defined by `SKB-RDY-F01` through
`SKB-RDY-F06`.
