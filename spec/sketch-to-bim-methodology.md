# Sketch-to-BIM Methodology

Last updated: 2026-05-18

This is the active entrypoint for sketch-to-BIM methodology. The archived
methodology under `spec/archive/` is historical context only.

For current work, use these sources together:

- `spec/sketch-to-bim-readiness-tracker.md` for the active backlog, milestones,
  CLI/MCP gaps, real-BIM methodology gaps, and target-house readiness gates.
- `spec/sketch-to-bim-product-surfaces.md` for the current product/agent
  surface inventory.
- `spec/sketch-to-bim-capability-matrix.json` for feature-to-capability
  readiness.
- `spec/ui-mcp-parity-tracker.md` for the broader UI/Cmd+K/CLI/MCP parity
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
  -> Advisor, constructability, screenshots, and evidence package
  -> warning/error-led refinement against named model elements
  -> phase acceptance or issue ledger
  -> final accepted seed artifact only after current-head evidence passes
```

## Advisor-Driven Authoring

The software's error detection is part of authoring, not a final audit step. An
agent must use Advisor, constructability reports, validation payloads, dry-run
warnings, and evidence-package findings after every meaningful phase change.

Required behavior:

- collect warning and info payloads in addition to errors;
- preserve finding code, severity, profile, message, recommendation, affected
  element ids, and viewpoint/context when available;
- classify each finding as `fix-now`, `fix-in-phase`, `later-phase`,
  `tolerated`, or `blocked`;
- resolve all findings tied to elements authored in the current phase unless a
  written tolerance explains why the warning is acceptable;
- treat UI Advisor/profile drift as a blocker until CLI/API and UI evidence are
  reconciled;
- use warnings as design feedback, for example room enclosure, missing doors,
  stair comfort, roof/opening hosts, clearance conflicts, material/type gaps,
  schedule/export gaps, and construction-readiness issues.

An advisor-clean model that is visually wrong is not accepted. A visually correct
model with unresolved Advisor/constructability warnings is also not accepted
unless the tolerance is explicit, scoped, and visible in the final packet.

## Quality Targets

| Target | Meaning |
| --- | --- |
| `massing_only` | Visual massing and silhouette study. |
| `concept_bim` | Primary BIM objects with basic usability evidence. |
| `project_initiation_bim` | Usable project seed with rooms, access, Advisor evidence, screenshots, and BIM information requirements. |
| `documentation_ready` | Project initiation plus sheets, schedules, exports, and documentation evidence. |

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

## Current Gate

Before generating `target-house-1`, close or explicitly tolerate the P0 items in
`spec/sketch-to-bim-readiness-tracker.md`, then produce the target-house
no-seed rehearsal packet defined by `SKB-RDY-F01` through `SKB-RDY-F06`.
