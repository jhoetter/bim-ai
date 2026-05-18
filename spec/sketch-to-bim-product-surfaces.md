# Sketch-to-BIM Product Surfaces

M3-A inventory, May 18, 2026. This maps the skill-local
`claude-skills/sketch-to-bim` workflow to stable product surfaces. A helper
script command is not public MCP parity unless it is reachable through API v3,
CLI, or another product-owned descriptor.

## Surface Rules

- Product surfaces must have a stable CLI command or API v3 `ToolDescriptor`.
- Skill-local helpers may orchestrate product calls, but they are not themselves
  public MCP tools.
- Execution status is explicit:
  - `executable`: the named API route/descriptor or CLI command runs directly.
  - `contract-only`: the descriptor documents a future or blocked route and must
    not be treated as executable.
  - `CLI-only`: the CLI is the canonical public transport for the operation.
  - `skill-local`: only the sketch-to-BIM helper/browser automation owns the
    operation today.
- Mutating surfaces must go through dry-run/commit bundle semantics or a
  documented backend route with route tests.
- Acceptance status is evidence-based: phase/final acceptance must include IR
  coverage, advisor/evidence output, visual checklist or screenshots, and
  explicit blockers/tolerances.
- When an API descriptor is `contract-only`, external agents should call the
  typed CLI or the documented generic bundle route instead of probing the
  blocked endpoint.

## Inventory

| Workflow area           | Skill-local operation                                                                                                    | Product surface today                                                                                                                                                                                                                                                                                                                                                                                    | MCP-capable status                                                                                                                                                         | Gaps / next product work                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sketch IR               | `sketch_bim.py semantic-checklist`, `accept --ir`, methodology SKB-21 brief creation                                     | API v3 descriptor/route `sketch.ir.validate` at `POST /api/v3/sketch/ir/validate`; CLI `sketch ir validate --ir --capabilities --out` aliasing `initiation-check`; schemas in `packages/cli/lib/sketch-initiation.mjs`; durable fixtures in `spec/sketch-to-bim-golden-seeds.json`                                                                                                                       | `executable`. API route validates the stable IR contract; CLI writes the full coverage/checklist/acceptance packet.                                                        | Keep backend validation aligned with the richer CLI packet builder as the IR schema evolves.                                                                                                                                                    |
| Underlay lifecycle      | Manual image/floorplan interpretation, helper `browser-evidence`; underlay transforms are currently lower-level commands | API v3 descriptors: `import-image-underlay`, `move-image-underlay`, `scale-image-underlay`, `rotate-image-underlay`, `delete-image-underlay`; CLI via `apply-bundle`; backend kernel commands `import_image_underlay`, `move_image_underlay`, `scale_image_underlay`, `rotate_image_underlay`, `delete_image_underlay`                                                                                   | Implemented first slice. Product descriptors exist and point to the authoritative bundle route.                                                                            | Add dedicated CLI sugar only if agents need file-to-data-URI packaging. Add calibration metadata surface for sketch scale/origin when SKB IR owns underlay alignment.                                                                           |
| Seed compile            | `sketch_bim.py compile --seed`; recipe artifacts under `seed-artifacts/<seed>/source/recipe.json`                        | API v3 descriptor `sketch.seed.compile`; contract route `POST /api/v3/sketch/seed/compile` returns a precise backend block; CLI `sketch seed compile --recipe --out` aliases `seed-dsl compile`; compiler `packages/cli/lib/seed-dsl.mjs`; tests in `packages/cli/cli.initiationCheck.test.mjs`                                                                                                          | `CLI-only` for execution. Backend route is `contract-only` until the Node compiler is hosted server-side.                                                                  | Do not claim API execution parity for seed compilation until the route returns a `cmd-v3.0` bundle instead of HTTP 501. MCP clients must call the CLI/sidecar compiler because the compiler currently lives in `packages/cli/lib/seed-dsl.mjs`. |
| Phase apply             | Skill helper `seed`, `accept`, manual bundle edits per phase                                                             | API v3 descriptor `sketch.phase.apply`; contract route `POST /api/v3/sketch/phase/apply` returns the underlying bundle transaction shape and precise backend block; CLI `sketch phase apply --bundle --base --dry-run \| --commit`; generic `apply-bundle`; API descriptors `model.dry_run`, `model.commit_bundle`, `apply-bundle`                                                                       | `CLI-only` for the sketch wrapper. The blessed transaction path is `POST /api/models/{model_id}/bundles`, reached directly or through CLI `sketch phase apply`.            | Keep phase apply bound to `cmd-v3.0` bundle semantics; backend wrapper should delegate to `/api/models/{model_id}/bundles` rather than reimplement transactions.                                                                                |
| Advisor / evidence loop | `advisor`, `advisor-parity`, `constructability-report`, `browser-evidence`, `issue-ledger`, `material-check`             | API v3 descriptors/routes `qa.advisor` at `POST /api/models/{model_id}/qa/advisor` and `qa.constructability` at `GET /api/models/{model_id}/constructability-report`; CLI `qa advisor --output json --severity`; CLI `initiation-run` writes snapshot, validate, evidence-package, advisor warning/info, optional screenshots, visual gate; backend routes `/snapshot`, `/validate`, `/evidence-package` | `executable` for Advisor/constructability. Evidence package is backend route-backed; `sketch.evidence.collect` remains `CLI-only`; browser evidence remains `skill-local`. | Add a dedicated `sketch.evidence.collect` descriptor for the combined evidence bundle and keep browser automation as capture/equivalence support, not a core MCP dependency.                                                                    |
| Phase acceptance        | `phase-accept`, `accept`, `stale-check`                                                                                  | API v3 descriptor/route `sketch.phase.accept` at `POST /api/v3/sketch/phase/accept`; CLI `sketch phase accept --ir --capabilities --out --fail-on-acceptance` aliases packet acceptance gates; CI `scripts/verify-sketch-seed-artifacts.mjs --require-final-evidence`; golden preflight `initiation-golden`                                                                                              | `executable`. Implemented route-tested contract for packet blockers and stale evidence; CLI writes the acceptance gate packet.                                             | Final acceptance remains blocked unless current-head evidence, advisor warnings, and visual gates are clean.                                                                                                                                    |

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

## M3-F Implemented Slice

The sketch IR, seed, and phase lane now exposes named API v3 descriptors and
CLI commands for the product surfaces:

- `sketch.ir.validate`: implemented API route and CLI alias.
- `sketch.seed.compile`: `CLI-only`; API descriptor plus route-tested HTTP 501
  block because the compiler currently lives in `packages/cli`.
- `sketch.phase.apply`: `CLI-only` sketch wrapper over
  `/api/models/{model_id}/bundles`; API descriptor plus route-tested HTTP 501
  block that returns the transaction delegation shape. The generic bundle route
  is the authoritative API transaction path.
- `sketch.phase.accept`: implemented API route contract for packet/staleness
  blockers and CLI alias for writing acceptance gates.
- `qa.advisor`: implemented API descriptor/route plus CLI alias for grouped
  warning/info/error findings, profile, recommendations, and element ids.
- `qa.constructability`: implemented API descriptor/route for constructability
  profile reports.

## B08-B11 Resource And Query Slice

The model-state and discovery surfaces are now descriptor-backed where the
backend route already existed:

- B08 model resources: `model-show`, `model.summary`, `query.levels`,
  `query.views`, `query.types`, `query.elements`, `qa.advisor`,
  `model.command_log`, and `evidence.package` cover snapshot, summary, levels,
  views, types, elements, Advisor, command log, and evidence package. Generated
  audit coverage: 9/9 executable.
- B09 command schema export: `commands.schema.catalog` maps to
  `GET /api/v3/commands`, and `commands.schema.inspect` maps to
  `GET /api/v3/commands/{name}`. The route is executable and returns the kernel
  command JSON Schemas; per-command examples and complete raw/semantic mapping
  metadata remain partial and are explicitly marked by the command metadata.
- B10 query/resolve parity: descriptors cover `query.elements`, `query.hosts`,
  `query.levels`, `query.types`, `query.views`, `query.nearest_wall`,
  `query.enclosed_loops`, `resolve.active_or_default_level`,
  `resolve.default_plan_view`, `resolve.wall_by_line`, `resolve.host_face`,
  `resolve.family_type`, `resolve.room_boundary`, and
  `resolve.loop_for_boundary`. Generated audit coverage: 14/14 executable.
- B11 Cmd+K equivalence: the generated audit reads the command capability graph
  and reports 106/106 activator entries with agent-equivalence metadata and zero
  unmapped activators.

The machine-readable status lives in `spec/generated/ui-mcp-parity.json` under
`skb`, and the human ledger lives in `spec/generated/api-descriptor-ledger.md`
under `SKB B08-B11 Audit`.

## Blockers Before Claiming Full M3-A Parity

- Seed compilation is intentionally `CLI-only` for execution; the API descriptor
  is discoverability plus a precise 501 contract until the Node compiler is
  hosted server-side.
- The sketch-specific phase apply API wrapper is intentionally `contract-only`;
  the authoritative transaction path is `/api/models/{model_id}/bundles`, either
  directly or through CLI `sketch phase apply`.
- Evidence collection still mixes product routes with CLI orchestration and
  skill-local browser automation. Browser evidence may be required for
  acceptance, but it should not be the only way an MCP agent understands
  advisor status.
- Skill helper descriptors in `claude-skills/sketch-to-bim/tools.json` remain
  local adapter metadata until product descriptors/routes expose equivalent
  behavior.
