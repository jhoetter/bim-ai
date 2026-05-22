# Target-House-1 No-Seed Readiness Packet

Status: complete planning packet for target-house-1 rehearsal. This document is
an index and handoff summary only; it is not a seed artifact and does not
authorize generation.

## Packet Contents

| Requirement                        | Artifact                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| Sketch IR draft                    | `spec/target-house/target-house-1-sketch-ir.draft.json`            |
| BIM information requirements draft | `spec/target-house/target-house-1-bim-information-requirements.md` |
| Capability map                     | `spec/target-house/target-house-1-capability-map.md`               |
| Phase plan                         | `spec/target-house/target-house-1-phase-plan.md`                   |
| Risk register                      | `spec/target-house/target-house-1-risk-register.md`                |
| Acceptance checklist               | `spec/target-house/target-house-1-acceptance-checklist.md`         |
| External-agent quickstart          | `spec/methodology/sketch-to-bim-agent-quickstart.md`                           |

## Readiness Position

The rehearsal packet closes the planning side of `SKB-RDY-F01` through
`SKB-RDY-F06` and gives `SKB-RDY-G04` a fillable checklist. It does not close
the product implementation gaps in the broader readiness tracker:

- partial roof terrace support still requires live visual proof;
- partial folded wrapper support still requires shell/thickness evidence;
- partial cladding support still requires artifact review;
- room programme support still requires Advisor-clean live model evidence;
- final acceptance still depends on current-head evidence after generation.

## Generation Guardrail

Before any target-house-1 seed generation:

1. Confirm user approval for actual seed creation.
2. Confirm `seed-artifacts/target-house-1` is absent or intentionally created
   only as part of the approved run.
3. Run IR/capability validation into an ignored temporary directory or an
   approved evidence directory.
4. Resolve the floorplan-vs-older-proportion scale assumption.
5. Use the phase plan; do not jump directly to furniture, sheets, or exports
   before envelope, roof court, loggia, and room topology pass.

## Suggested Preflight Command

Use this before generation, with output outside seed artifacts until approval:

```bash
node packages/cli/cli.mjs sketch ir validate \
  --ir spec/target-house/target-house-1-sketch-ir.draft.json \
  --capabilities spec/data/sketch-to-bim-capability-matrix.json \
  --out tmp/target-house-1-readiness-ir
```

Warnings for partial capabilities are expected at readiness time. They become
acceptance work items during the relevant phase and must be backed by
screenshots, Advisor payloads, and tolerances if not fully resolved.
