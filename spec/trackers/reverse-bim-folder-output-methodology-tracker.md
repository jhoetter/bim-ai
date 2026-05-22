# Reverse-BIM Folder Output Methodology Tracker

Last updated: 2026-05-20

Status: **Folder-output contract, now governed by the post-failure reset
tracker. This is the handoff contract between source understanding and live MCP
BIM authoring.**

Reset note: after the failed `target-house-3` Leo benchmark, the controlling
methodology tracker is
`spec/reverse-bim-actual-methodology-tracker.md`. This folder-output contract
remains valid only when its outputs feed the stricter live MCP phase gates,
Advisor gates, physical-topology gates, and UI/source-overlay evidence gates
defined there.

## Purpose

This tracker defines the output that must be produced from a source folder such
as `/Users/jhoetter/Desktop/Testhäuser/Testhaus Leo` before an AI modeling agent
is allowed to author the BIM model.

The folder output must be clear enough that a later agent can be told:

```text
Here is the reverse-BIM folder output package.
Build the BIM model exactly from this specification.
Use MCP tools, query after every step, run Advisor/constructability/integrity,
and stop whenever the package says a fact is blocked.
```

This document is not a seed format and not a sketch-to-BIM replacement. It is a
source-faithful BIM technician handoff: every modelable fact is normalized,
provenance-backed, conflict-aware, and mapped either to an MCP authoring tool or
to a resolver/source-repair requirement.

## Non-Negotiable Rule

The output package may not claim that a building is ready to model unless the
MCP-readiness report says which facts are:

- `ready_for_mcp_authoring`
- `needs_mcp_resolver`
- `needs_source_refinement`
- `metadata_for_authoring`
- `reference_only`
- `source_conflict_disposition_required`
- `missing_mcp_tool`

The next agent must not infer hidden geometry from prose. If a fact is not
MCP-ready, the agent must run the required resolver, request source repair, or
record an explicit tolerance/disposition.

## Target Folder Output

A completed reverse-BIM source-understanding run writes one output directory:

```text
reverse-bim-output/
  README.md
  run-summary.json
  source/
    folder-manifest.json
    document-registry.json
    document-classification.json
    rendered-pages.json
    native-text-extractions.json
    source-page-index.json
  ai-reading/
    ai-visual-trace-packet.json
    ai-visual-trace-work-order.json
    ai-visual-agent-requests.json
    reader-responses.raw.json
    reader-response-index.json
    reader-responses.normalized.json
    agent-loop.accepted.json
    repair-requests.open.json
  understanding/
    coordinate-frames.json
    coordinate-frame-worklist.json
    source-fact-ledger.json
    room-topology.json
    opening-reconciliation.json
    roof-dormer.json
    conflict-ledger.json
    conflict-disposition-report.json
    conflict-disposition-worklist.json
    existing-building-ir.json
    source-coverage.initial.json
  mcp-handoff/
    mcp-readiness.json
    authoring-plan.json
    resolver-worklist.json
    phase-authoring-spec.json
    tolerance-policy.json
  validation/
    source-completeness-report.json
    package-acceptance-report.json
  evidence/
    source-thumbnails/
    page-crops/
    source-analysis.md
```

The exact directory name is not important. The artifact names and schemas are
important.

## Package Acceptance States

| State | Meaning | May next agent model? |
| ----- | ------- | --------------------- |
| `source_packaging_ready` | Folder manifest/rendering/classification exist, but AI facts are missing or incomplete. | No |
| `source_understanding_blocked` | AI facts exist but required work packages failed completeness or conflicts are unresolved. | No |
| `mcp_handoff_partial` | Some facts are MCP-ready; other phases are blocked by resolvers/source refinement. | Only ready phases/facts |
| `mcp_handoff_ready` | All required geometry facts are either authorable, resolver-ready, metadata/reference, or explicitly tolerated. | Yes, phase by phase |
| `modeling_in_progress` | A live BIM model is being authored from this output. | Continue only through phase gates |
| `accepted_model_built` | Final model passed source coverage, Advisor, constructability, integrity, and UI/MCP readback gates. | Done |

`mcp_handoff_ready` does not mean the model exists. It means the source package
is good enough for a modeling agent to create the model through MCP without
guessing.

## Required Artifact Contracts

### `run-summary.json`

Purpose: top-level machine-readable status.

Required fields:

```json
{
  "format": "reverseBimFolderOutputRunSummary_v1",
  "sourceFolder": "/absolute/source/folder",
  "outputDir": "/absolute/output/folder",
  "createdAt": "2026-05-20T00:00:00Z",
  "packageState": "mcp_handoff_partial",
  "sourceManifestDigestSha256": "sha256",
  "summary": {
    "sourceDocumentCount": 0,
    "renderedPageCount": 0,
    "workPackageCount": 0,
    "acceptedWorkPackageCount": 0,
    "normalizedFactCount": 0,
    "mcpReadyFactCount": 0,
    "resolverNeededFactCount": 0,
    "sourceRefinementNeededFactCount": 0,
    "openConflictCount": 0,
    "openBlockerCount": 0
  },
  "nextAgentInstruction": "Use mcp-handoff/phase-authoring-spec.json. Do not model blocked facts."
}
```

### `source/document-registry.json`

Purpose: stable document ids independent of local file names.

Each document row must include:

- `sourceDocumentId`
- `relativePath`
- `absolutePath`
- `sha256`
- `kind`
- `pageCount`
- `classification`
- `classificationConfidence`
- `roleInModeling`
- `status`

Allowed `status` values:

- `accepted_for_modeling`
- `context_only`
- `duplicate`
- `superseded`
- `unknown_needs_review`
- `unreadable`

### `source/source-page-index.json`

Purpose: one row per rendered source page or image, so AI readers and later
modeling agents can point to the same evidence.

Required fields:

- `sourcePageId`
- `sourceDocumentId`
- `page`
- `classification`
- `renderedPagePath`
- `widthPx`
- `heightPx`
- `dpi`
- `sha256`
- `nativeTextAvailable`
- `coordinateFrameId`
- `modelingUse`

Allowed `modelingUse` values:

- `primary_geometry`
- `secondary_geometry_check`
- `area_reconciliation`
- `section_elevation_check`
- `site_parcel`
- `terrain`
- `photo_current_condition`
- `materials_history`
- `legal_context`
- `ignored_with_reason`

### `ai-reading/reader-responses.normalized.json`

Purpose: deterministic normalization of raw AI/subagent reading output.

Must be produced by:

- `source.normalize_ai_visual_trace_reader_responses`

The normalized response may contain warnings. It may not contain errors for any
fact that is included in the modeling handoff.

### `ai-reading/agent-loop.accepted.json`

Purpose: package-level completeness gate.

Must be produced by:

- `source.ai_visual_trace_agent_loop`

Required rule:

- A package with required fact kinds cannot be `accepted` unless every required
  kind is present and every required value field is present.
- A package with `needs_revision` or `waiting_for_ai_reader` must be represented
  in `repair-requests.open.json`.

### `understanding/source-fact-ledger.json`

Purpose: canonical source fact database for the modeling agent.

Required shape:

```json
{
  "format": "reverseBimSourceFactLedger_v1",
  "facts": [
    {
      "factId": "ai-srcfact-eg-wall-001",
      "kind": "wall_chain",
      "value": {},
      "confidence": 0.82,
      "status": "accepted",
      "scope": "target_building",
      "modelingPhase": "P4-floor-plan-topology",
      "provenance": {
        "sourceDocumentId": "srcdoc-...",
        "page": 1,
        "region": "bbox or source description",
        "method": "ai_document_read",
        "renderedPagePath": "..."
      },
      "normalization": {},
      "conflictIds": [],
      "notes": []
    }
  ]
}
```

Allowed fact statuses:

- `accepted`
- `candidate`
- `conflicting`
- `deferred`
- `rejected`
- `superseded`
- `modeled`

Rules:

- `accepted` facts must have provenance and confidence.
- `conflicting` facts must reference at least one conflict id.
- `deferred` facts must include a reason and later owner/phase.
- Geometry facts must use millimeters in model coordinates whenever they are
  intended for MCP authoring.

## Required Fact Kinds and MCP Payload Expectations

### Levels

Fact kind: `level`

Minimum `value`:

```json
{
  "name": "EG",
  "elevationMm": 0,
  "sourceLevelName": "Erdgeschoss",
  "confidenceNote": "..."
}
```

MCP handoff:

- Tool: `author.level`.
- Query after commit: `query.levels`.
- QA: level datum/integrity checks.

### Wall Chains

Fact kind: `wall_chain`

Minimum `value`:

```json
{
  "levelId": "level-eg",
  "points": [{"xMm": 0, "yMm": 0}, {"xMm": 9900, "yMm": 0}],
  "thicknessMm": 300,
  "wallRole": "exterior | party | structural | interior_partition",
  "closed": false,
  "heightMm": 2800,
  "wallTypeHint": "existing exterior masonry 300mm"
}
```

MCP handoff:

- Tool: `author.wall_chain`.
- If `levelId` is not a live model id, run level resolver first.
- Query after commit: `query.elements` for walls with geometry and host/support
  includes.
- QA: Advisor, integrity preflight, wall graph/source comparison.

### Rooms

Fact kind: `room`

Minimum `value`:

```json
{
  "levelId": "level-eg",
  "name": "Wohnzimmer",
  "areaM2": 18.65,
  "boundaryMm": [
    {"xMm": 300, "yMm": 3900},
    {"xMm": 3285, "yMm": 3900},
    {"xMm": 3285, "yMm": 8450},
    {"xMm": 300, "yMm": 8450}
  ],
  "boundaryRef": "source-room-loop-eg-wohnzimmer",
  "areaToleranceM2": 0.25
}
```

MCP handoff:

- Tool: `author.room_outline`.
- If only `boundaryRef` exists, status must be `needs_source_refinement` unless
  `resolve.room_boundary` can produce the loop from existing walls.
- Query after commit: rooms with calculated area.
- QA: room area reconciliation and access/enclosed-loop checks.

### Doors, Windows, and Openings

Fact kinds: `opening`, `door`, `window`

Minimum `value` before direct MCP authoring:

```json
{
  "levelId": "level-eg",
  "openingType": "door",
  "wallId": "wall-eg-south-001",
  "alongT": 0.42,
  "widthMm": 1000,
  "heightMm": 2175,
  "sillHeightMm": 0,
  "swing": "unknown"
}
```

Resolver-ready `value`:

```json
{
  "levelId": "level-eg",
  "openingType": "window",
  "hostWallRef": "EG north wall at Wohnzimmer",
  "sourcePositionMm": {"xMm": 2160, "yMm": 8750},
  "widthMm": 2250,
  "heightMm": 1375,
  "sillHeightMm": 900
}
```

MCP handoff:

- If `wallId` and `alongT` exist: `opening.door_on_wall` or
  `opening.window_on_wall`.
- If `hostWallRef` or `sourcePositionMm` exists but no `wallId`: run
  `resolve.wall_by_line` and/or `query.nearest_wall`.
- QA: hosted opening integrity, cut fidelity, no floating openings, source
  elevation/plan comparison.

### Stairs

Fact kind: `stair`

Minimum `value` before direct MCP authoring:

```json
{
  "stairId": "stair-eg-dg-001",
  "baseLevelId": "level-eg",
  "topLevelId": "level-dg",
  "runStartMm": {"xMm": 7050, "yMm": 350},
  "runEndMm": {"xMm": 9450, "yMm": 3900},
  "runs": [],
  "stepCount": 15,
  "riserMm": 183,
  "treadMm": 250,
  "slabOpeningRef": "slabopen-eg-dg-001"
}
```

MCP handoff:

- Tool: `author.stair_between_levels` for simple stair.
- Required gap exposed by Leo: add `author.stair_by_runs` /
  `author.stair_by_sketch` for precise existing stair runs, landings, tread
  lines, slab openings, railing host data, and headroom evidence.
- Related tool: `opening.slab_opening`.
- QA: vertical circulation integrity, slab opening/headroom checks, Advisor.

### Roofs and Dormers

Fact kinds: `roof`, `dormer`, `roof_opening`

Minimum roof `value`:

```json
{
  "roofType": "gable",
  "referenceLevelId": "level-dg",
  "boundaryMm": [],
  "boundaryRef": "roof-footprint-main",
  "pitchDeg": 50,
  "eaveHeightMm": 5600,
  "ridgeHeightMm": 10400,
  "overhangMm": 300
}
```

MCP handoff:

- Tool: `author.roof_from_boundary`.
- Dormers use `author.dormer_on_roof`, but still require a roof-host/roof-local
  position resolver and source-derived depth/height validation.
- Roof openings need `opening.roof_opening` and a resolved `hostRoofId`.
- QA: roof/source section/elevation comparison, hosted roof opening checks.

### Terrain and Parcel

Fact kinds: `terrain`, `parcel_boundary`

Minimum parcel `value`:

```json
{
  "parcelId": "Gemarkung Schalksmühle Flur 21 Flurstück 258",
  "boundary": [{"xMm": 0, "yMm": 0}],
  "areaM2": 541.1,
  "coordinateFrameId": "site-frame-001"
}
```

Minimum terrain `value` for toposolid authoring:

```json
{
  "siteRef": "parcel-258",
  "elevationPoints": [{"xMm": 0, "yMm": 0, "zMm": 0}],
  "method": "source_contours_or_spot_heights",
  "confidenceNote": "..."
}
```

MCP handoff:

- Parcel: `site.property-line-create`.
- Terrain: `toposolid-create`.
- If only a raster description exists, status must be `needs_source_refinement`
  or `reference_only`; do not invent contours.

### Areas, Volumes, Materials, History

Fact kinds: `area`, `volume`, `material`, `construction_history`,
`photo_observation`

These are normally not direct geometry authoring facts.

Usage:

- `area`: reconcile room/schedule results.
- `volume`: reconcile shell/quantity schedules.
- `material`: select/create wall/floor/roof types or assign metadata.
- `construction_history`: populate existing-condition metadata.
- `photo_observation`: validate current condition and source conflicts.

MCP handoff status:

- usually `metadata_for_authoring` or `reference_only`;
- never treat as direct geometry unless another geometry fact references it.

## MCP Handoff Reports

### `mcp-handoff/mcp-readiness.json`

Must be produced by:

- `reverse_bim.mcp_readiness`

Required per row:

```json
{
  "factId": "ai-srcfact-opening-001",
  "kind": "opening",
  "status": "needs_mcp_resolver",
  "readyForMcpAuthoring": false,
  "mcpTool": "opening.window_on_wall",
  "mcpInputDraft": {},
  "requiredBeforeMcp": [
    {"resolver": "resolve.wall_by_line", "reason": "host wall required"}
  ],
  "sourceConfidence": 0.75,
  "sourceProvenance": {},
  "recommendation": "Run resolver/query tools first: resolve.wall_by_line."
}
```

### `mcp-handoff/resolver-worklist.json`

Purpose: exact checklist of resolver calls the modeling agent must perform
before authoring.

Required grouping:

```json
{
  "format": "reverseBimResolverWorklist_v1",
  "items": [
    {
      "resolverId": "resolver-opening-eg-001",
      "factId": "ai-srcfact-opening-001",
      "resolver": "resolve.wall_by_line",
      "input": {},
      "expectedOutput": ["wallId", "alongT", "confidence", "candidates"],
      "onAmbiguous": "block_and_add_conflict"
    }
  ]
}
```

### `mcp-handoff/authoring-plan.json`

Must be produced by:

- `reverse_bim.plan_authoring`

Rules:

- Include only normalized facts.
- Direct authoring actions must have `readyForDryRun=true`.
- Blocked actions must be mirrored in `resolver-worklist.json` or
  `repair-requests.open.json`.

### `mcp-handoff/phase-authoring-spec.json`

Purpose: exact modeling instructions for the next AI agent.

Required shape:

```json
{
  "format": "reverseBimPhaseAuthoringSpec_v1",
  "modelingTarget": {
    "scope": "target_building | whole_source_building | context_only",
    "scopeDecisionFactId": "conflict-target-half-identity",
    "unitSystem": "millimeters",
    "coordinateFrameId": "model-frame-001"
  },
  "phases": [
    {
      "phaseId": "P4-floor-plan-topology",
      "status": "ready | blocked | partial",
      "sourceFactIds": [],
      "authoringActions": [],
      "resolverItems": [],
      "requiredQueriesBefore": ["query.levels", "query.types"],
      "requiredQaAfter": ["qa.advisor", "qa.constructability", "qa.integrity_preflight"],
      "acceptanceChecks": [],
      "blockers": []
    }
  ]
}
```

The modeling agent must execute phases in order unless a phase explicitly says
it can run in parallel.

## Modeling Agent Procedure From Folder Output

The later AI modeling agent must follow this procedure exactly:

1. Read `run-summary.json`.
2. If `packageState` is `source_packaging_ready` or
   `source_understanding_blocked`, do not model. Open
   `ai-reading/repair-requests.open.json`.
3. Read `mcp-handoff/phase-authoring-spec.json`.
4. Query live model context:
   - `query.levels`
   - `query.types`
   - `query.views`
   - `model.summary`
5. For each phase:
   - run required resolver items first;
   - update the source fact ledger with resolver outputs;
   - call the listed MCP authoring tool only for ready facts;
   - dry-run the generated bundle;
   - commit only if dry-run has no blocking findings;
   - query created/updated elements;
   - run Advisor, constructability, integrity preflight, renderer/evidence
     checks where available;
   - write a phase packet with finding dispositions;
   - stop if any error/warning is unresolved and not explicitly tolerated.
6. After all phases:
   - build final source coverage matrix;
   - verify no unmodeled accepted geometry facts remain;
   - run final Advisor/constructability/integrity/export/readback;
   - produce final acceptance packet.

The modeling agent must not skip the query/QA loop because the source package
looked plausible.

## Folder Output Tracker

| ID | Capability | Required artifact/output | Current status | Done condition |
| -- | ---------- | ------------------------ | -------------- | -------------- |
| FOUT-001 | Canonical output directory | `reverse-bim-output/` with required subfolders and `README.md`. | Partial | `reverse_bim.folder_output` writes the full directory tree with relative links between artifacts. |
| FOUT-002 | Run summary | `run-summary.json`. | Partial | Summary exposes package state, counts, blockers, and next-agent instruction. |
| FOUT-003 | Document registry | `source/document-registry.json`. | Partial | Registry persists source ids, classifications, roles, status, and hash/page metadata. |
| FOUT-004 | Source page index | `source/source-page-index.json`. | Partial | Every rendered page has a page id, classification, use, dimensions, and coordinate-frame link. |
| FOUT-005 | AI reader raw response capture | `ai-reading/reader-responses.raw.json`, `ai-reading/reader-response-index.json`. | Partial | All subagent/provider outputs are captured with stable response digests, work-package ids, statuses, fact counts, and reader/model metadata when supplied. |
| FOUT-006 | AI reader normalization | `ai-reading/reader-responses.normalized.json`. | Partial | Uses `source.normalize_ai_visual_trace_reader_responses`; no modeling handoff facts have normalization errors. |
| FOUT-007 | Package completeness loop | `ai-reading/agent-loop.accepted.json`. | Partial | Uses `source.ai_visual_trace_agent_loop`; required packages are accepted or represented as repair requests. |
| FOUT-008 | Repair worklist | `ai-reading/repair-requests.open.json`. | Partial | Every failed package/fact has a focused AI-reader repair prompt and blocking reason. |
| FOUT-009 | Coordinate frames | `understanding/coordinate-frames.json`, `understanding/coordinate-frame-worklist.json`, `validation/coordinate-frame-report.json`. | Partial | Candidate coordinate frames, fact-aware alignment worklist, and blocking alignment report are emitted; applying final alignment decisions into source overlay remains pending. |
| FOUT-010 | Consolidated source fact ledger | `understanding/source-fact-ledger.json`. | Partial | Ledger is emitted from normalized facts; full coverage depends on capturing all reader responses. |
| FOUT-011 | Conflict ledger | `understanding/conflict-ledger.json`, `understanding/conflict-disposition-report.json`, `understanding/conflict-disposition-worklist.json`. | Partial | Conflict blockers, missing-decision report, and structured disposition worklist are emitted; applying final project/user decisions to downstream model metadata remains pending. |
| FOUT-012 | ExistingBuildingIR | `understanding/existing-building-ir.json`. | Partial | IR validates and references source facts, coordinate frames, conflicts, and modeling phases. |
| FOUT-013 | Source completeness report | `validation/source-completeness-report.json`. | Partial | Reports missing fact kinds/fields per work package and phase. Dimensional plans and sections/elevations now require a blocking `building_scope` fact so the agent cannot confuse full Doppelhaus, target half, unit, and context-only neighboring scope. |
| FOUT-014 | MCP readiness | `mcp-handoff/mcp-readiness.json`. | Partial | Uses `reverse_bim.mcp_readiness` for the consolidated fact ledger. |
| FOUT-015 | Resolver worklist | `mcp-handoff/resolver-worklist.json`. | Partial | Every `needs_mcp_resolver` fact becomes an exact resolver call with expected output and ambiguity policy. |
| FOUT-016 | Authoring plan | `mcp-handoff/authoring-plan.json`. | Partial | Uses `reverse_bim.plan_authoring`; blocked facts mirror readiness/resolver/repair reports. |
| FOUT-017 | Phase authoring spec | `mcp-handoff/phase-authoring-spec.json`. | Partial | Later modeling agent gets phase groups, actions, resolver items, QA requirements, and blockers; exact source/model comparison checks still need expansion. |
| FOUT-018 | Tolerance policy | `mcp-handoff/tolerance-policy.json`. | Partial | Default tolerance policy is emitted; project-specific tolerances and user decisions still need a richer workflow. |
| FOUT-019 | Package acceptance report | `validation/package-acceptance-report.json`. | Partial | Computes package state and rejects handoff if blockers remain for requested modeling scope, including roof/dormer precision blockers and unresolved building-scope identity. |
| FOUT-020 | Human-readable source analysis | `evidence/source-analysis.md`. | Partial | Summarizes scope, source facts, blockers, and modeling instructions, but is secondary to JSON artifacts. |
| FOUT-021 | Site/terrain decision report | `understanding/site-terrain.json`, `validation/site-topology-report.json`. | Partial | Generic source report now decides exact toposolid candidate vs context-only/tolerance, parcel precision, and building-placement blockers; authoring/site acceptance still pending. |
| FOUT-022 | Building-scope decision report | `understanding/building-scope.json`, `reverse_bim.source_building_scope`. | Partial | Blocks modeling until source facts resolve target vs context scope: whole building, whole Doppelhaus, target half, target unit, selected building/unit, context-only, or explicit ambiguity. Target-half/unit scopes also require a source-backed scope mask, polygon, or boundary ref. Fresh Leo run emits a focused repair request because prior reader responses contain no `building_scope` fact. |

## Leo Benchmark Status

Current Leo benchmark state: **failed / reset**.

The `target-house-3` artifact is not accepted. It is retained only as a
diagnostic failure case showing that the previous acceptance policy was too
permissive.

Observed blockers:

- `KG` exists as a level/view but is not modeled with source-faithful basement
  content.
- Advisor still reports door operation clearance conflicts and a stair/wall
  clash.
- Room topology can be satisfied by analytical/separation artifacts while the
  physical plan remains wrong.
- Roof/dormer, terrain, parcel placement, and material/schedule semantics are
  not source-overlay verified.
- The visual UI state clearly contradicts any claim of "accepted model".

The current controlling plan is
`spec/reverse-bim-actual-methodology-tracker.md`. This folder-output tracker
defines the handoff contract, but Leo is not considered successful until a fresh
run passes the stricter live MCP, Advisor, physical-topology, source-overlay,
and UI evidence gates.

Fresh non-destructive package run
`tmp/reverse-bim-testhaus-leo/folder-output-building-scope-gated/` proves the
new source gate is doing the right thing: it remains
`source_understanding_blocked` with `buildingScopeBlockerCount=1`,
`roofDormerBlockerCount=3`, `coordinateFrameAlignmentBlockerCount=6`, and
`readerConsensusBlockerCount=4`. This is intentional. A modeling agent must
first repair the source understanding, especially the target/context
`building_scope`, instead of producing another plausible but wrong seed.

## Immediate Implementation Plan

| Wave | Work | Parallelizable? | Done condition | Status |
| ---- | ---- | --------------- | -------------- | ------ |
| Wave 1 | Folder-output writer: create required directory tree and aggregate existing source artifacts into stable locations. | Yes | `reverse-bim-output/` exists with manifest, registry, page index, run summary. | Partial |
| Wave 2 | Subagent response capture: store all AI reader outputs from provider/subagents as raw JSON, independent of chat transcript. | Yes | `reader-responses.raw.json` and `reader-response-index.json` contain every work package response with digest and provenance. | Partial |
| Wave 3 | Consolidated fact ledger builder. | No, depends on Wave 2 | `source-fact-ledger.json` has all normalized accepted/candidate/conflicting facts. | Partial |
| Wave 4 | Conflict ledger and scope decision tool. | Partly | `conflict-ledger.json` blocks unresolved scope/dimension/current-vs-historical conflicts. | Partial |
| Wave 5 | Coordinate-frame builder. | Yes | Geometry pages have model-mm transforms and level/site associations. | Partial |
| Wave 6 | MCP readiness against full ledger. | No, depends on Waves 3-5 | Full `mcp-readiness.json` separates authorable/resolver/source-repair/metadata facts. | Partial |
| Wave 7 | Resolver worklist generation. | No, depends on Wave 6 | Every resolver-needed fact has exact resolver input and ambiguity policy. | Partial |
| Wave 8 | Phase authoring spec generation. | No, depends on Wave 7 | Later agent can execute modeling phases without inspecting the original folder. | Partial |
| Wave 9 | Leo package acceptance report. | No | Leo package state is either `mcp_handoff_ready` or blocked with exact repair requests. | Partial: previous repaired fixture is invalidated as proof by live inspection. |
| Wave 10 | Leo modeling benchmark. | No | A fresh model is built transactionally and accepted only after source/model findings are fixed and UI/source-overlay gates pass. | Failed for `target-house-3`; must rerun as a fresh benchmark. |

## Target-House-3 Remediation Tracker

This section is retained as historical failure evidence from the
`target-house-3` MCP modeling run. It proves that the software can author BIM
elements transactionally, but it also proves that the previous methodology could
accept a model that fails live UI and Advisor inspection.

Current benchmark evidence:

- model artifact: `tmp/reverse-bim-testhaus-leo/target-house-3/document.json`
- run summary: `tmp/reverse-bim-testhaus-leo/target-house-3/summary.json`
- Advisor output: `tmp/reverse-bim-testhaus-leo/target-house-3/advisor.json`
- constructability output:
  `tmp/reverse-bim-testhaus-leo/target-house-3/constructability-report.json`
- integrity output:
  `tmp/reverse-bim-testhaus-leo/target-house-3/integrity-preflight.json`

Current `target-house-3` model contents:

- 3 levels: `KG`, `EG`, `DG`
- 24 walls
- 2 floors
- 35 room separations
- 13 rooms
- 1 stair
- 1 slab opening
- 1 railing
- 1 roof
- 1 roof opening
- 1 provisional dormer
- 12 doors
- 2 windows
- 1 site
- 1 flat context toposolid
- 4 property lines

Current model feedback:

- Advisor: 18 warnings, 0 errors.
- Constructability: 18 warnings, 0 errors.
- Integrity preflight: 0 findings, 0 blockers.
- Room topology: 0 inaccessible rooms, 0 unbacked/partial edges, 0 repair
  actions after the repair transaction.
- Area reconciliation: 29 rows, all within tolerance.
- Modeled source facts: 45.
- Remaining unmodeled/blocking source facts: none.
- Final acceptance: invalidated. Reviewed warning dispositions were too
  permissive; the live model still has geometry/topology problems and missing
  UI/source-overlay evidence.

### Blocking Finding Disposition Plan

Statuses in the following historical table describe which helper tools or
fixture repairs existed during the failed benchmark. They are **not** acceptance
statuses for Leo or `target-house-3`.

| ID | Current finding/source blocker | Root cause exposed by Leo | Required folder-output change | Required MCP/modeling change | Done condition | Status |
| -- | ------------------------------ | ------------------------- | ----------------------------- | ---------------------------- | -------------- | ------ |
| LEO-FIX-001 | `unsupported_slab` on `floor-dg` | Floor facts create elevated slabs without support metadata. | Floor/floor-boundary facts must include support intent: bearing wall refs, support wall candidates, column/beam refs, or explicit tolerated support assumption. | Add floor support resolver: find lower-level walls/columns under floor boundary and write `supportedByIds` / `supportIds` / approved support metadata into floor payload. | DG floor passes integrity without `unsupported_slab`; support ids are source-linked or explicitly tolerated. | Partial: `resolve.floor_supports` + `author.floor_supports` implemented and target-house-3 now clears `unsupported_slab`; handoff worklist/source support intent still pending. |
| LEO-FIX-002 | `stair_landing_too_small` | Existing stair was approximated by a single by-sketch footprint and provisional landing. | Stair facts must include exact landing polygons, run geometry, step count per run, stair width, and source uncertainty. | Promote `author.stair_by_sketch` or `author.stair_by_runs`; validate landing size before commit. | Stair passes landing/headroom/shaft checks or has explicit existing-condition tolerance. | Partial: `author.stair_by_sketch` and `author.stair_by_runs` semantic/MCP surfaces implemented; Leo stair source repair and acceptance still pending. |
| LEO-FIX-003 | `stair_riser_tread_comfort_failure` | Source says existing stair dimensions may not match new-build comfort proxy. Current methodology treats this as an error without existing-building tolerance handling. | Stair fact must include whether dimensions are source-measured existing conditions vs inferred/new design. | Add finding disposition/tolerance path for existing nonconforming stairs, or revise riser/tread from source if current value is inferred. | Integrity finding is either resolved by source-correct geometry or explicitly tolerated as existing condition with provenance. | Partial: `author.stair_existing_condition` and source-backed stair tolerance implemented; target-house-3 now has zero integrity blockers. |
| LEO-FIX-004 | Advisor `room_access_*`, `room_without_door_access` | Room boundaries exist, but door-to-room connectivity and interior door openings are incomplete. | Room facts must include boundary edges, edge-to-wall/separation refs, room adjacency, door/access facts, and circulation paths. | Add room-topology authoring pass: create missing interior doors/openings or room separation lines, then query access graph. | No room access errors remain; every room has source-backed access or explicit blocked/tolerated status. | Done for repaired-area fixture: access graph has 0 inaccessible rooms after opening and topology phases. |
| LEO-FIX-005 | Advisor `room_access_room_wall_topology_gap` | Room polygons are not fully backed by walls or room separations. | Source output must emit each room boundary edge with `backingWallRef` or `roomSeparationRef`. | Add `resolve.room_boundary_edges` and author room separations/backing walls before room outline acceptance. | Room topology checks show every modeled room boundary is backed or deliberately virtual with source provenance. | Done for repaired-area fixture: `resolve.room_boundary_edges` produced repairs, `author.room_separation` committed 23 repair commands, and final repair worklist has 0 actions. |
| LEO-FIX-006 | Advisor `room target area mismatch` / area reconciliation warnings | Room polygons and area calculation formulas are not reconciled; DG sloped-area rules may differ from full floor polygon area. | Area facts must distinguish gross/net/living area, sloped-roof reduction factors, formulas, and target tolerance. | Add area reconciliation report after rooms: compare model area to source formula and classify mismatch as geometry error, sloped-area rule, or tolerance. | `source-area-reconciliation.json` has one disposition per source area row; no unexplained mismatches remain. | Done for repaired-area fixture: target-house-3 area reconciliation has 29 rows, all within tolerance. Formula/sloped-area basis extraction remains future hardening. |
| LEO-FIX-007 | `leo-op-dg-dormer-window` unmodeled | Dormer window needs host element after dormer creation, not a normal wall resolver. | Opening fact must classify `hostKind`: wall, dormer wall, roof plane, or facade-only evidence. | Add resolver for dormer-hosted/facade-hosted windows after dormer creation, or model dormer face/window as supported kernel element. | DG dormer window is modeled or explicitly blocked by missing source/window-host tool. | Partial: Leo now models the dormer-window fact through the wall-hosted opening path, clearing coverage and integrity. True dormer-face window authoring remains a tool-contract gap. |
| LEO-FIX-008 | `leo-elevation-opening-front-door` unmodeled duplicate/scope blocker | Elevation-only front-door fact may duplicate EG plan entry door, but no source reconciliation exists. | Opening facts must include duplicate/same-as links across plan/elevation facts. | Add opening source reconciliation: match plan door/window facts to elevation/facade facts by level/facade/position/dimension. | Front door has one modeled element with both plan and elevation source refs, or a documented duplicate disposition. | Done for repaired-area fixture: elevation door fact is reconciled to modeled `op-eg-entry` and no longer blocks coverage. |
| LEO-FIX-009 | Advisor `site_relationship_missing_site` | Parcel/property lines are modeled, but no site element/site context is authored. | Site facts must distinguish parcel boundary, site element, building placement, road edge, and neighborhood context. | Add site setup phase: author site element/project base point/survey point and link parcel lines to site context. | Site relationship checks no longer report missing site. | Done for repaired-area fixture: `site-parcel-258` is authored from parcel context and site relationship warning is cleared. |
| LEO-FIX-010 | Advisor `site_relationship_missing_toposolid` / `leo-terrain-source-limited` | Source folder lacks numeric terrain contours/elevation samples in current extracted facts. | Terrain facts must include elevation points/contours/mesh or explicit no-toposolid disposition. | Add terrain repair request to AI reader; if no source data exists, model a minimal site plane only as tolerated context, not accepted terrain. | Terrain is either modeled with source-backed elevations or final acceptance records terrain unavailable/tolerated. | Done for repaired-area fixture as flat context terrain: `toposolid-parcel-258-flat` clears missing-toposolid warnings. Source-backed contour terrain remains future fidelity work. |
| LEO-FIX-011 | `leo-site-conflict-parcel` | Parcel raster/context lacks exact vector/legal boundary confidence. | Conflict ledger must select legal parcel source vs raster approximation and state target half vs full parcel. | Add site conflict disposition and parcel-coordinate confidence fields. | Parcel boundary is exact enough for acceptance or flagged as context-only with source reason. | Partial: `site-terrain.json` flags the parcel boundary as `estimated_or_limited`; conflict disposition still must decide exact vs context-only parcel use. |
| LEO-FIX-012 | `leo-roof-conflict-dims` and provisional dormer | Roof/dormer dims are partly inferred from plan/elevation and still not source-resolved. | Roof facts must include ridge/eave line refs, pitch source, dormer depth/height/position source, and conflicts. | Add `resolve.roof_host_region` and `resolve.roof_position_from_source_point`; validate dormer inside roof footprint before commit. | Roof/dormer Advisor findings are resolved; provisional dormer status removed. | Partial: `roof-dormer.json` blocks estimated roof, missing dormer depth, and missing roof-opening host ref; `resolve.roof_position_from_source_point` and `validate.roof_dormer_source_alignment` now exist, while exact roof host-region and overlay validation remain pending. |
| LEO-FIX-013 | Advisor `bir_f06_roof_overhang_semantics_missing` | Roof payload lacks required semantic distinction for overhang/eave intent. | Roof fact must include source-backed overhang semantics or no-overhang disposition. | Extend `author.roof_from_boundary` payload/readiness to include roof overhang/eave semantics. | Roof semantic Advisor warning/error is resolved or explicitly tolerated. | Done for repaired-area fixture: `updateElementProperty(overhangSemantics=eave)` clears the warning; richer source extraction remains future hardening. |
| LEO-FIX-014 | Advisor `window_operation_clearance_conflict` | Window placement is resolved by nearest wall only; adjacent wall/window clearance not checked before commit. | Opening fact must include side/handing/operation where available, or unknown-operation flag. | Add pre-commit opening clearance validation and alternate host/alongT resolver candidates. | Window placement has no clearance conflict or carries source-linked tolerated existing-condition disposition. | Not started |
| LEO-FIX-015 | `leo-current-conflict-year-001` | Construction year/design/current-condition conflict is tracked but not disposed. | Conflict ledger must choose built year/current-condition metadata and retain design-date provenance. | Add conflict disposition output consumed by model metadata. | Conflict has explicit disposition, e.g. built 1957, design/source docs 1956, with provenance. | Not started |
| LEO-FIX-016 | `leo-floorplan-conflict-scope` | Target half / adjoining half scope is not formally fixed. | Folder-output must contain target scope polygon and context scope polygon. | Add scope mask to authoring plan so adjoining half facts are context-only unless deliberately modeled. | Weidenstrasse 6 target half is unambiguous and all facts are tagged target/context. | Partial: reader contracts now require `building_scope`; `reverse_bim.source_building_scope` and `understanding/building-scope.json` now block if the target/context scope is missing, ambiguous, context-only without a target, conflicting, or target-half/unit scope lacks a source-backed scope mask/boundary ref. Fresh Leo run `folder-output-building-scope-gated` has `buildingScopeBlockerCount=1` because prior reader responses lacked this fact. Applying the mask into authoring remains pending. |
| LEO-FIX-017 | `leo-drainage-conflict-legibility` | Drainage docs are source-limited/legibility-limited and not model-ready. | Drainage facts must be classified as modelable MEP route, metadata, or unreadable repair request. | Add drainage package repair loop and, later, MEP-lite route authoring if source supports it. | Drainage is either modeled, metadata-only, or explicitly unreadable/tolerated. | Not started |

### Detailed Implementation Waves

Statuses in this historical section must be revalidated against the reset
methodology before they can be counted toward a fresh Leo acceptance run.

| Wave | Scope | Depends on | Implementation tasks | Required artifacts | Done condition | Status |
| ---- | ----- | ---------- | -------------------- | ------------------ | -------------- | ------ |
| R-W1 | Source response capture hardening | Existing folder-output writer | Store all reader responses as raw immutable JSON; include response digest, reader id, model/version, timestamp, work package id, accepted/repaired status. | `ai-reading/reader-responses.raw.json`, `ai-reading/reader-response-index.json` | Leo consolidated run no longer relies on chat-only or manually assembled reader facts. | Partial: raw response digest, per-response index, and `readerCommand` dispatch/capture path implemented/tested; Leo now indexes 6 accepted work-package responses with fact counts and digests. |
| R-W2 | Coordinate-frame acceptance | R-W1 | Add exact page-to-model transform contracts for EG, DG, section/elevation, site, drainage. Include scale source, origin source, rotation, confidence, and residual error. | `understanding/coordinate-frames.json`, `understanding/coordinate-frame-worklist.json`, `validation/coordinate-frame-report.json` | Every geometry fact references an accepted coordinate frame or is blocked. | Partial: generic worklist/report and `coordinateFrameAlignments` application path implemented; Leo now blocks on 6 fact-referenced geometry frames instead of all 35 candidate pages. |
| R-W3 | Conflict disposition workflow | R-W1 | Implement structured conflict choices: choose, merge, supersede, target/context, tolerate, ask-user, source-repair. Add mandatory disposition before final acceptance. | `understanding/conflict-ledger.json`, `understanding/conflict-disposition-report.json`, `understanding/conflict-disposition-worklist.json`, `mcp-handoff/tolerance-policy.json` | Leo's open conflicts have explicit dispositions or block the package with exact questions. | Partial: generic worklist and decision-application path implemented; fresh Leo run now emits 7 open conflicts including target scope, roof dimensions, parcel, drainage, and reader-repair conflicts; separate building-scope gate adds one hard scope blocker when the target/context fact is missing. |
| R-W4 | Room topology extraction | R-W2 | Extend AI reader prompts/schema to return room boundary edges, backing wall/separation refs, adjacency, door access, and circulation path candidates. Normalize these into source facts. | `understanding/room-topology.json`, enriched `source-fact-ledger.json` | Leo rooms can be authored with access/topology data instead of isolated polygons. | Partial: dimensional-floorplan reader contract now requires `boundaryMm`, `boundaryEdges`, `accessRefs`, and `adjacentRoomRefs`; `reverseBimSourceRoomTopology_v1`, tests, open reader repair requests, and package acceptance blocking implemented. Leo now correctly marks the dimensional-floorplans package `needs_revision` because 7 room facts lack topology/access fields. |
| R-W5 | Room topology MCP/readback | R-W4 | Add resolver/readback for room boundary edges; author missing room separations or interior openings; query room access graph after commit. | `mcp-handoff/resolver-worklist.json`, phase packets for rooms/openings | Room access/topology Advisor errors are resolved or have one disposition each. | Done for repaired-area fixture: `author.room_separation`, `resolve.room_boundary_edges`, `query.room_access_graph`, and `roomTopologyRepairWorklist_v1` are implemented; Leo commits 23 repair separations and ends with 0 repair actions. |
| R-W6 | Area reconciliation | R-W4 | Parse area formulas and classify area basis: Wohnfläche, Nutzfläche, gross, net, sloped-roof factor. Compare model room areas and explain mismatches. | `validation/area-reconciliation.json` | Every source area row maps to model room(s) with within-tolerance result or disposition. | Partial: `bim_ai.area_reconciliation` and `/qa/area-reconciliation` implemented; formula basis and final artifact writer pending. |
| R-W7 | Existing-stair contract | R-W2 | Promote `author.stair_by_sketch` / `author.stair_by_runs` with runs, landings, tread lines, width, riser/tread, total rise, source tolerance, and existing-nonconforming flag. | registry descriptor(s), semantic authoring tests, MCP readiness mapping | Leo stair no longer needs raw typed bridge; stair payload has enough geometry for integrity. | Partial: semantic authoring, routes, registry descriptors, and tests implemented; existing-nonconforming tolerance and Leo rerun pending. |
| R-W8 | Stair/floor/railing macro | R-W7 | Add macro or phase helper that authors stair, upper slab opening, railing, landing, and then runs vertical-circulation integrity. | stair phase packet, `validation/vertical-circulation-report.json` | Leo stair has no unresolved slab-opening/landing/railing integrity findings unless tolerated as existing condition. | Not started |
| R-W9 | Floor support resolver | R-W2 | Resolve bearing/support wall ids under elevated floor boundaries; encode support metadata in floor payloads; add support confidence/tolerance. | `mcp-handoff/floor-support-worklist.json`, floor phase packet | DG floor passes support integrity without hand-authored metadata. | Partial: resolver, authoring update, engine props, tests, and target-house-3 application done; handoff worklist/source confidence packaging pending. |
| R-W10 | Opening reconciliation and host resolution | R-W4 | Match plan/elevation openings, resolve wall/dormer/roof hosts, compute `alongT`, sill/head, operation/handing, duplicate links. | `understanding/opening-reconciliation.json`, resolver worklist | Entry door and DG dormer window are modeled or explicitly blocked; duplicate elevation facts are reconciled. | Done for repaired-area fixture / Partial for final fidelity: source reconciliation and resolvers exist; Leo models/reconciles all opening facts, but true dormer-face window authoring and door swing extraction remain future work. |
| R-W11 | Roof/dormer source precision | R-W2 | Extract ridge/eave lines, roof pitch, overhang semantics, dormer footprint/depth/height/host roof region. | `understanding/roof-dormer.json`, roof resolver worklist | Roof/dormer no longer uses provisional geometry in accepted model. | Partial: source report, `resolve.roof_position_from_source_point`, and `validate.roof_dormer_source_alignment` implemented/tested; package acceptance now blocks on roof/dormer precision. Fresh Leo run `folder-output-building-scope-gated` emits 3 roof/dormer blockers for missing/estimated source precision. |
| R-W16 | Building-scope gate | R-W1 | Validate target/context identity before authoring, including whole Doppelhaus vs target half vs unit vs context-only source pages. | `understanding/building-scope.json`, `reverse_bim.source_building_scope`, repair request | A bad single-volume/single-half model cannot be built while source scope is missing or ambiguous. | Partial: report/API/descriptor/tests implemented; target-half/unit scopes require a source-backed scope mask/boundary ref; fresh Leo run blocks because the prior reader responses have no `building_scope` fact. Applying the scope mask into phase authoring remains pending. |
| R-W12 | Site/toposolid decision | R-W2, R-W3 | Extract parcel/site/building placement; determine whether source supports exact toposolid or only context plane; author site/base point/toposolid where possible. | `understanding/site-terrain.json`, `validation/site-topology-report.json` | Site/toposolid Advisor findings are resolved or explicitly tolerated. | Done for repaired-area fixture / Partial for terrain fidelity: Leo authors site and flat context toposolid; source-backed contours/elevation samples remain future work. |
| R-W13 | Source overlay comparison | R-W2 | Render plan/elevation/section views from model, align to source frames, and report deviations for walls/openings/rooms/roof. | `validation/source-overlay-comparison.json`, screenshots | Final acceptance includes visual/source overlay evidence, not just element counts. | Not started |
| R-W14 | Finding disposition ledger | All QA-producing waves | Add required disposition rows for every Advisor/constructability/integrity/source finding. Values: fixed, source_conflict, source_unavailable, existing_nonconforming_tolerated, existing_nonconforming_source_backed, tool_gap, deferred_out_of_scope, blocked. Existing nonconformance dispositions must include source fact ids, reason, and reviewer; they do not hide the warning. | `validation/finding-disposition-ledger.json` | Package cannot enter `accepted_model_built` while any finding lacks disposition. | Done for repaired-area fixture: ledger supports reviewed decisions and target-house-3 has 0 unresolved blocking dispositions. Phase/final gates now distinguish source-backed existing nonconformances from bad authoring. Automated policy/owner workflow remains future work. |
| R-W15 | Final acceptance runner | R-W1 through R-W14 | Implement final gate that joins source coverage, model query summaries, QA reports, overlay evidence, and dispositions. | `validation/final-acceptance.json` | Leo package can only pass when source blockers, Advisor errors/warnings, and integrity findings are resolved or explicitly tolerated. | Done for repaired-area fixture: `reverseBimFinalAcceptance_v1` passes 7/7 gates. Source overlay comparison and public MCP/API exposure remain future work. |

### MCP Contract Additions Required By Leo

| Tool contract | Why Leo needs it | Minimum input | Minimum output | Status |
| ------------- | ---------------- | ------------- | -------------- | ------ |
| `author.stair_by_sketch` | Existing stair geometry needs boundary, landing, tread lines, total rise, not only start/end. | `baseLevelId`, `topLevelId`, `boundaryMm`, `treadLines`, `landings`, `totalRiseMm`, `riserMm`, `treadMm`, source refs. | Typed bundle plus preflight diagnostics for landing/headroom/opening requirements. | Partial: typed semantic bundle/API/registry exists; preflight diagnostics/readback still pending. |
| `author.stair_by_runs` | Sections/plans often describe runs/landings rather than one sketch polygon. | Runs with start/end/polyline, landing polygons, width, riser/tread, levels. | Typed bundle and normalized stair geometry readback. | Partial: typed semantic bundle/API/registry exists; normalized stair readback still pending. |
| `author.stair_vertical_package` | Existing stair acceptance requires stair + opening + railing to be checked together. | Stair payload, upper floor id/boundary, railing path/materials, tolerance policy. | Multi-command bundle, resolver evidence, vertical-circulation report. | Not started |
| `author.stair_existing_condition` | Existing buildings can contain source-faithful stair nonconformance that should not be silently redesigned. | Stair id, tolerated finding codes, reason, source fact ids, reviewer. | Typed property update plus integrity-preflight tolerance recognition. | Partial: semantic/API/registry/engine/integrity path implemented; final policy UI/expiry owner workflow pending. |
| `author.floor_supports` | Resolved support ids must be applied transactionally, not patched manually. | Floor id, support ids, structural/support system metadata, span direction. | Typed `updateElementProperty` bundle validated by engine. | Partial: typed semantic bundle/API/registry and floor property engine handling implemented; source-confidence packaging pending. |
| `resolve.floor_supports` | Elevated floors fail integrity without support ids. | Floor boundary/id, lower level, candidate support kinds, tolerance. | Candidate support ids with coverage/confidence and payload patch. | Partial: API/registry/resolver implemented for wall supports; columns/beams and handoff integration pending. |
| `resolve.room_boundary_edges` | Room polygons alone do not prove topology. | Room boundary, level, tolerance, walls/separations. | Per-edge backing refs, gaps, required separations/openings. | Partial: MCP/API/report implemented and consumed by `roomTopologyRepairWorklist_v1`; source topology extraction still pending. |
| `author.room_separation` | Existing floorplans often need source-derived virtual room boundaries before room outlines can be trusted. | Level id, start/end, optional id/name. | Typed `createRoomSeparation` bundle. | Partial: semantic/API/registry implemented; source topology extraction still pending. |
| `query.room_access_graph` | Advisor room-access findings need deterministic before/after verification. | Level/room ids, doors/openings, adjacency threshold. | Access graph, inaccessible rooms, source-linked recommended repairs. | Partial: MCP/API/report implemented and consumed by `roomTopologyRepairWorklist_v1`; source-backed access fact extraction still pending. |
| `resolve.opening_source_match` | Plan and elevation openings must reconcile to one element. | Opening fact rows with ids, source positions/facades/dimensions. | Same-element candidates, score/reasons, required disposition. | Partial: API/registry/read-only resolver and tests implemented; richer facade/coordinate-frame matching pending. |
| `resolve.dormer_opening_host` | Dormer window cannot use normal wall resolver until dormer wall/face exists. | Dormer id/roof host, source roof-local window position. | Dormer host candidate, confidence, and explicit tool-gap blocker when no dormer face/wall exists. | Partial: API/registry/read-only resolver and tests implemented; direct dormer-face/window authoring pending. |
| `resolve.roof_position_from_source_point` | Dormer and roof windows need roof-local placement. | Roof id and source point/region. | `positionOnRoof`, host roof id, confidence, overflow diagnostics. | Partial: API/registry/read-only bbox projection and tests implemented; exact ridge/eave-frame projection pending. |
| `validate.roof_dormer_source_alignment` | Provisional dormers must not pass final acceptance. | Roof/dormer/opening elements plus source roof facts. | Alignment report against source roof/dormer/opening facts. | Partial: API/registry/source-fact gate and tests implemented; visual overlay/deviation metrics pending. |
| `source.area_reconciliation` | Leo area calculations differ from raw modeled polygon areas. | Source area rows, model rooms, area basis/tolerance. | Reconciliation rows with fixed/source-conflict/tolerated disposition. | Partial: `source-area-consistency.json` now blocks internally inconsistent folder output before MCP handoff; target-house-3 area reconciliation is clean for the repaired-area fixture. |
| `source.overlay_compare` | Source-faithful acceptance needs view/source alignment evidence. | Source coordinate frame, model view, compared fact ids. | Deviation metrics, screenshots, pass/fail rows. | Not started |
| `validate.final_acceptance` | Prevent partial existing-building runs from being accepted as complete. | Advisor, constructability, integrity, coverage, area, room topology, disposition reports. | Gate-by-gate acceptance report with blocking gate ids and reasons. | Partial: local builder and Leo artifact implemented; public MCP/API surface still pending. |

### Updated Leo Milestones

| Milestone | Goal | Must be true | Status |
| --------- | ---- | ------------ | ------ |
| LEO-M1 | Package can be regenerated from source folder and reader responses. | No manual/chat-only facts required; all raw and normalized reader responses are file artifacts. | Partial |
| LEO-M2 | Folder output reaches `mcp_handoff_ready` for architectural scope. | Conflicts disposed; coordinate frames accepted; all architecture facts ready, resolver-ready, metadata, or tolerated. | Partial: previous repaired fixture is useful evidence but not proof for fresh-folder success. |
| LEO-M3 | Shell phase accepted. | Levels, floors, support metadata, exterior/interior walls, roof base geometry pass Advisor/integrity without unexplained errors/warnings. | Failed in `target-house-3` because level completeness, roof/site fidelity, and UI evidence did not pass. |
| LEO-M4 | Rooms/openings phase accepted. | Room topology, room access, interior doors/openings, area reconciliation, and opening source reconciliation pass. | Failed in `target-house-3` because physical topology and door clearance were not solved. |
| LEO-M5 | Stair/vertical circulation phase accepted. | Stair, landing, slab opening, railing, and existing-condition comfort/tolerance are resolved. | Failed in `target-house-3` because a stair-wall clash remains blocking. |
| LEO-M6 | Roof/dormer phase accepted. | Roof, dormer, dormer window/skylight, overhang semantics, and section/elevation alignment pass. | Not started |
| LEO-M7 | Site/terrain phase accepted. | Parcel, site element, project/survey/base point, toposolid or no-source terrain tolerance pass. | Partial: folder-output now produces site/terrain decision blockers and repair/tolerance requests; model authoring and final disposition remain pending. |
| LEO-M8 | Final acceptance. | Source coverage complete; Advisor/constructability/integrity findings are fixed, physical topology is coherent, and UI/MCP/source-overlay readback agree. | Failed for `target-house-3`; future acceptance must block on warnings and UI/source-overlay evidence. |

### Current Leo Run State (2026-05-20)

| Artifact | Current result | Interpretation |
| -------- | -------------- | -------------- |
| `tmp/reverse-bim-testhaus-leo/leo-reader-responses.repaired-area.json` | Adds explicit EG/DG circulation rooms, complete visible Wohnflächenberechnung rows, Speisekammer, missing DG rooms, repaired opening refs, and area-consistent room polygons. | Confirms the methodology now forces room/circulation/area facts to be source artifacts instead of implicit assumptions. |
| `tmp/reverse-bim-testhaus-leo/folder-output-repaired-decisions` | `packageState=mcp_handoff_ready`; 16 source docs, 68 rendered pages, 6 accepted reader packages, 0 hard MCP blockers, 0 room-topology blockers, 0 conflict blockers, 0 coordinate-frame blockers, 0 site-terrain blockers. | The folder-output handoff is now ready for MCP modeling with resolver work still expected during authoring. |
| `tmp/reverse-bim-testhaus-leo/target-house-3` | Transactional model builds with 3 levels, 24 walls, 35 room separations, 13 rooms, 12 doors, 2 windows, 1 stair, 1 slab opening, 1 railing, 1 roof, 1 roof opening, 1 dormer, 1 site, 1 flat context toposolid, 4 property lines. | The diagnostic builder now consumes the generic folder-output facts, including all visible room/area rows, source-line opening hosts, room-topology repair commands, site/toposolid context, and final dispositions. |
| Target-house-3 integrity | 0 integrity findings and 0 blocking findings. | The MCP transaction loop is now preventing invalid geometry from landing. |
| Target-house-3 Advisor/constructability | 18 warnings, 0 errors. Warning groups: door operation clearance (17) and stair-wall clash (1). | All warnings have explicit reviewed dispositions; none remain unresolved. |
| Target-house-3 area reconciliation | 29 rows; all within tolerance; 0 blocking rows. | The repaired-area source package now proves the area gate can catch and then clear Leo area issues. |
| Target-house-3 coverage | 45 modeled or reconciled source facts; 0 unmodeled blockers. | Front-door elevation evidence is reconciled to the modeled EG entry door; the DG dormer-window fact is represented by a modeled window pending true dormer-face host tooling. |
| Target-house-3 final acceptance | Previously reported `accepted=true`, now invalidated by live inspection. | This is the core failure: the final gate was too weak and must be replaced by the reset methodology. |

Important result: the workflow must distinguish **handoff-ready source
package**, **model technically built**, and **model accepted**. Leo reached a
technically built seed artifact, but it did not reach accepted BIM model state.

## Final Definition of Done

This tracker is done when a new source folder run can produce a package where:

- all source docs/pages are inventoried, classified, and either used or
  explicitly ignored;
- all AI-reader outputs are captured as files, not chat-only information;
- all modelable source facts are normalized into canonical JSON;
- all conflicts have explicit dispositions;
- all geometry pages used for modeling have coordinate frames;
- `mcp-readiness.json` says exactly which facts are authorable, resolver-needed,
  source-refinement-needed, metadata/reference, conflict, or missing-tool;
- `phase-authoring-spec.json` tells a later agent which MCP tools to call, in
  what phase, with which source facts, and which QA checks to run afterward;
- the package blocks itself if it is not detailed enough to produce a
  source-faithful BIM model.
