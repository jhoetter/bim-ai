# Sketch-to-BIM Product Surfaces

M3-A inventory, May 18, 2026. This maps the skill-local
`claude-skills/sketch-to-bim` workflow to stable product surfaces. A helper
script command is not public MCP parity unless it is reachable through API v3,
CLI, or another product-owned descriptor.

## Surface Rules

- Product surfaces must have a stable CLI command or API v3 `ToolDescriptor`.
- Skill-local helpers may orchestrate product calls, but they are not themselves
  public MCP tools.
- Mutating surfaces must go through dry-run/commit bundle semantics or a
  documented backend route with route tests.
- Acceptance status is evidence-based: phase/final acceptance must include IR
  coverage, advisor/evidence output, visual checklist or screenshots, and
  explicit blockers/tolerances.

## Inventory

| Workflow area           | Skill-local operation                                                                                                    | Product surface today                                                                                                                                                                                                                                                                                                  | MCP-capable status                                                                                                                                  | Gaps / next product work                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sketch IR               | `sketch_bim.py semantic-checklist`, `accept --ir`, methodology SKB-21 brief creation                                     | CLI `initiation-check --ir --capabilities --out`; CLI `initiation-run --ir --out --model`; schemas in `packages/cli/lib/sketch-initiation.mjs`; durable fixtures in `spec/sketch-to-bim-golden-seeds.json`                                                                                                             | CLI-reachable, not API v3-described                                                                                                                 | Add API v3/descriptor for `sketch.ir.validate` or expose a CLI descriptor catalogue. Preserve IR schema versioning and examples before promoting to external MCP.                                                                                      |
| Underlay lifecycle      | Manual image/floorplan interpretation, helper `browser-evidence`; underlay transforms are currently lower-level commands | API v3 descriptors: `import-image-underlay`, `move-image-underlay`, `scale-image-underlay`, `rotate-image-underlay`, `delete-image-underlay`; CLI via `apply-bundle`; backend kernel commands `import_image_underlay`, `move_image_underlay`, `scale_image_underlay`, `rotate_image_underlay`, `delete_image_underlay` | Implemented first slice. Product descriptors exist and point to the authoritative bundle route.                                                     | Add dedicated CLI sugar only if agents need file-to-data-URI packaging. Add calibration metadata surface for sketch scale/origin when SKB IR owns underlay alignment.                                                                                  |
| Seed compile            | `sketch_bim.py compile --seed`; recipe artifacts under `seed-artifacts/<seed>/source/recipe.json`                        | CLI `seed-dsl compile --recipe --out`; compiler `packages/cli/lib/seed-dsl.mjs`; tests in `packages/cli/cli.initiationCheck.test.mjs`                                                                                                                                                                                  | CLI-reachable, not API v3-described                                                                                                                 | Add `sketch.seed.compile` descriptor or CLI descriptor export. Keep output as `cmd-v3.0` bundle with assumption provenance.                                                                                                                            |
| Phase apply             | Skill helper `seed`, `accept`, manual bundle edits per phase                                                             | CLI `initiation-run --apply-bundle --base --commit                                                                                                                                                                                                                                                                     | --dry-run`; generic `apply-bundle`; API descriptors `model.dry_run`, `model.commit_bundle`, `apply-bundle`                                          | Implemented through generic transaction surfaces, not a sketch-specific phase tool                                                                                                                                                                     | Add `sketch.phase.apply` descriptor that binds phase id, IR feature ids, bundle path, parent revision, and evidence output without hiding the underlying transaction semantics. |
| Advisor / evidence loop | `advisor`, `advisor-parity`, `constructability-report`, `browser-evidence`, `issue-ledger`, `material-check`             | CLI `advisor --output json --severity`; CLI `initiation-run` writes snapshot, validate, evidence-package, advisor warning/info, optional screenshots, visual gate; backend routes `/snapshot`, `/validate`, `/evidence-package`; API descriptor `model-show` and query routes                                          | Partially productized. Advisor grouping is CLI-reachable; evidence package is backend route-backed; browser evidence remains skill-local automation | Add stable `qa.advisor`/`sketch.evidence.collect` descriptors for warning/info grouping, constructability profile selection, issue ledger, and material intent proof. Browser automation should remain evidence collection, not a core MCP dependency. |
| Phase acceptance        | `phase-accept`, `accept`, `stale-check`                                                                                  | CLI `initiation-check --fail-on-acceptance`; CLI `initiation-run --fail-on-acceptance`; CI `scripts/verify-sketch-seed-artifacts.mjs --require-final-evidence`; golden preflight `initiation-golden`                                                                                                                   | CLI/CI-reachable, not API v3-described                                                                                                              | Add `sketch.phase.accept` descriptor with required packet files and explicit result schema. Final acceptance should remain blocked unless current-HEAD evidence, advisor warnings, and visual gates are clean.                                         |

## First Implemented Slice

The underlay lifecycle now has complete API v3 product descriptors for the
kernel-supported image underlay commands:

- `import-image-underlay`
- `move-image-underlay`
- `scale-image-underlay`
- `rotate-image-underlay`
- `delete-image-underlay`

Each descriptor maps to `POST /api/models/{model_id}/bundles`, declares the
single kernel command it wraps, and is tagged with `image-underlay`,
`sketch-to-bim`, and `kernel-command` resource groups. This is intentionally a
descriptor promotion, not a new route: the authoritative product behavior
already exists in the bundle transaction pipeline and existing command tests.

## Blockers Before Claiming Full M3-A Parity

- No stable public descriptor exports the Sketch Understanding IR validation
  contract; `initiation-check` is CLI-only.
- Seed compilation is product CLI, but not discoverable from API v3/MCP
  descriptors.
- Phase apply and phase acceptance are still orchestration conventions around
  generic bundle and initiation-run surfaces, not typed sketch phase tools.
- Advisor/evidence collection still mixes product routes with skill-local
  browser automation. Browser evidence may be required for acceptance, but it
  should not be the only way an MCP agent understands advisor status.
- Skill helper descriptors in `claude-skills/sketch-to-bim/tools.json` remain
  local adapter metadata until product descriptors/routes expose equivalent
  behavior.
