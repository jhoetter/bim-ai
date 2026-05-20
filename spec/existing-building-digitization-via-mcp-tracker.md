# Existing-Building Digitization via MCP Tracker

Last updated: 2026-05-20

Status: **New MCP-first methodology/spec. Seed artifacts are not the primary
authoring abstraction.**

Packaging note: `target-house-3` is also packaged under
`seed-artifacts/target-house-3/` so the accepted Leo diagnostic model can be
loaded with the existing `make seed name=target-house-3` inspection path. That
artifact is a replay/inspection bridge for the benchmark output, not the source
of truth for the reverse-BIM methodology.

Related implementation handoff tracker:
`spec/reverse-bim-folder-output-methodology-tracker.md` defines the exact
folder-output package that a later AI modeling agent must be able to consume to
build the BIM model through MCP.

## Purpose

This tracker replaces the legacy sketch-to-BIM seed methodology for the current
priority: digitizing an existing building from a source folder such as
`/Users/jhoetter/Desktop/Testhäuser/Testhaus Leo`.

The goal is not a plausible massing seed. The goal is a source-faithful,
inspectable, detailed existing-building BIM model produced by an AI agent using
the BIM software like a careful BIM technician:

1. Inventory and classify all source documents.
2. Extract dimensions, levels, wall graphs, openings, rooms, stairs, sections,
   elevations, terrain, parcel lines, materials, schedules, and conflicts with
   source provenance.
3. Build incrementally through MCP/API-backed live model operations.
4. Query the model after every modeling step.
5. Run Advisor, constructability, model-integrity, rendering, and evidence
   checks after every phase.
6. Force a structured disposition for every finding.
7. Iterate until the live model is source-faithful and clean, or every remaining
   issue is explicitly tolerated.

## Scope Reset

The following are **legacy for this priority**:

- `claude-skills/sketch-to-bim` operational flow.
- Old `target-house-1` / `target-house-2` attempts and seed artifacts.
- Seed DSL as the main authoring abstraction.
- Broad massing-first or sketch-style approximation.
- Accepting a model because it looks roughly plausible.

Allowed reuse:

- Kernel commands, transaction routes, query/resolve routes, Advisor,
  constructability, evidence package, renderer diagnostics, IFC/glTF export, and
  model-integrity checks.
- Seed DSL or raw bundles only as temporary import/export bridges when a
  first-class MCP tool is missing. Their usage must be recorded as a tooling
  gap, not treated as the methodology.

Out of scope for this tracker:

- Using a seed as the primary reverse-BIM workflow.
- Optimizing for a new building from a single sketch.
- Reusing old target-house assumptions as current truth.

## Status Model

| Status | Meaning |
| ------ | ------- |
| Done | Capability exists in the repo as a tested/descriptor-backed or route-backed surface that can be used now. |
| Partial | Some implementation exists, but it is not sufficient for existing-building digitization without extra agent/source-code knowledge or manual glue. |
| Not started | No stable product surface or workflow contract was found in the repo. |
| Legacy | Existing capability belongs to the old seed/sketch path and must not be the primary path for reverse-BIM. |

## Repo Inventory Snapshot

Observed from the current repo on 2026-05-20:

| Area | Current state | Status |
| ---- | ------------- | ------ |
| Backend command catalogue | `app/bim_ai/commands.py` exposes 262 command discriminators via `commands.schema.catalog` / `GET /api/v3/commands`. | Done |
| API/MCP-like descriptor catalogue | `app/bim_ai/api/registry.py` exposes 171 descriptors after the reverse-BIM source, multimodal agent-loop, AI-reader normalization, folder-output handoff, MCP-readiness, authoring-plan, AI visual completeness, and promoted architecture authoring/resolver surfaces including `author.level`, `author.dormer_on_roof`, `resolve.opening_source_match`, `resolve.dormer_opening_host`, `resolve.roof_position_from_source_point`, and `validate.roof_dormer_source_alignment`. | Done |
| Transaction path | `model.dry_run`, `model.commit_bundle`, `apply-bundle`, `/api/models/{model_id}/bundles`, `/commands/bundle/dry-run`, command log, undo/redo. | Done |
| Query/readback path | `model-show`, `model.summary`, `query.elements`, `query.levels`, `query.types`, `query.views`, `query.hosts`, `query.nearest_wall`, `query.enclosed_loops`, `resolve.*`. | Done |
| QA feedback | `qa.advisor`, `qa.constructability`, `qa.integrity_preflight`, `qa.profile_comparison`, `evidence.package`, renderer diagnostics route. | Done |
| Core building authoring via semantic MCP descriptors | First-class descriptors now cover walls, wall chains, floors from boundary, room outlines, doors, windows, roof from boundary, roof openings, stairs, slab/shaft openings, railing, structure/MEP/construction. Most generate typed semantic bundles that still must be dry-run/committed through `model.dry_run` / `model.commit_bundle`. | Partial |
| Site authoring | Toposolid, toposolid subdivision/excavation, graded region, property line, project base point, survey point, sun settings, upsert site. | Partial |
| AI visual source tracing | `source.prepare_ai_visual_trace_run` prepares an entire source folder; `source.ai_visual_trace_packet` packages rendered drawings/docs for external AI/subagent visual reading; `source.ai_visual_trace_work_order` splits reusable reader work packages; `source.ai_visual_trace_agent_requests` creates provider-neutral multimodal reader requests; `source.normalize_ai_visual_trace_reader_responses` normalizes flexible AI/subagent output into MCP-feedable source facts; `source.ai_visual_trace_agent_loop` validates normalized returned facts, can optionally dispatch an external JSON stdin/stdout reader command, and emits repair prompts; `source.validate_ai_visual_trace_completeness` blocks non-modelable returned facts. The old deterministic CV trace product surface has been removed. | Partial |
| PDF/folder ingestion | Source manifest, PDF rendering/text extraction, document classification, AI-reading/AI-visual-trace packets, and AI fact validation now exist as first slice surfaces. | Partial |
| Folder-output handoff | `reverse_bim.folder_output` builds the source-folder handoff package with registry, page index, raw/indexed/normalized reader responses, completeness report, fact ledger, conflict ledger/disposition worklist, coordinate-frame candidates/alignment worklist, room topology report, opening reconciliation, roof/dormer precision report, site/terrain report, MCP readiness, resolver worklist, phase authoring spec, package acceptance report, and README. | Partial |
| Existing-building IR | A seed/validation surface now exists for source-linked existing-building IR packets, but the full schema and conflict ledger are still incomplete. | Partial |
| Legacy seed/sketch flow | Still documented and partially surfaced as sketch descriptors; not suitable as primary reverse-BIM path. | Legacy |

## Methodology Invariant

An existing-building model is not accepted until these are true:

- Every modeled element traces back to source evidence, an explicit inference, or
  an explicit tolerance.
- Every source fact is either modeled, rejected as irrelevant/duplicate, marked
  conflicting, or deferred with a reason.
- Every phase commits through transactional MCP/API surfaces after dry-run.
- Every phase records Advisor, constructability, integrity, renderer/evidence,
  model query summaries, screenshots/views, and a finding disposition ledger.
- No accepted state exists while errors or warnings remain unresolved unless the
  tolerance is explicit, scoped, source-linked, and visible in the final packet.

## AI/MCP Boundary

Reverse-BIM is **AI-first for document understanding** and **MCP-first for BIM
authoring**.

The software should not try to out-OCR or out-trace a multimodal AI on old
scanned plans. Instead, it should package deterministic source context and call
an AI reader/subagent as a first-class source tool. The AI reader returns strict
JSON facts with provenance; deterministic software then validates those facts,
detects conflicts, and drives the live BIM model through MCP tools.

Required boundary:

- AI/subagents may read and visually trace drawings, scans, handwriting,
  sections, elevations, tables, photos, and site/legal documents.
- AI/subagents must return structured facts, not model mutations.
- Every returned fact must include source document id, page/region evidence,
  confidence, and uncertainty/conflict notes.
- AI visual tracing must use `source.ai_visual_trace_packet` or
  `source.ai_reading_packet`, and returned facts must be normalized with
  `source.normalize_ai_visual_trace_reader_responses`, then pass
  `source.validate_ai_facts` and
  `source.validate_ai_visual_trace_completeness`.
- Before modeling, normalized facts must pass
  `reverse_bim.mcp_readiness`: each fact is classified as directly
  MCP-authorable, resolver-needed, source-refinement-needed,
  metadata/reference, conflict, or missing-tool.
- Model creation must use the existing MCP/API authoring surfaces:
  `author.wall`, `author.wall_chain`, `author.floor_from_boundary`,
  `author.room_outline`, `opening.door_on_wall`, `opening.window_on_wall`,
  `author.roof_from_boundary`, `opening.roof_opening`,
  `author.stair_between_levels`, `opening.slab_opening`, site tools, and
  related query/resolve tools.
- Raw bundles are allowed only as expert fallback for missing descriptors and
  must be recorded as a tooling gap.
- Every generated semantic bundle must be dry-run and then committed through the
  transaction path before QA/readback.

## 1. Source Ingestion

### Target Workflow

```text
source folder
  -> immutable folder manifest
  -> document registry
  -> PDF/image rendering and native text extraction
  -> AI-readable source packet for multimodal document reading
  -> drawing/document classification
  -> per-page/page-region scale detection
  -> coordinate normalization
  -> fact extraction with source provenance
  -> conflict ledger
  -> existing-building understanding IR
```

### Source Inventory Tracker

| ID | Capability | Required output | Current repo surface | Status | Gap / required work |
| -- | ---------- | --------------- | -------------------- | ------ | ------------------- |
| SRC-001 | Folder manifest | Stable list of files with path, size, mtime, SHA-256, MIME/type guess, page count, image dimensions, parent folder metadata. | `source.folder_manifest` route/descriptor exists. | Partial | Persist manifests as project resources and add source registry storage. |
| SRC-002 | Source registry | Persisted source document ids independent of local file paths. | Imported links/assets have source metadata; no digitization source registry. | Not started | Add `source_document` records/resources with immutable content hash and local path. |
| SRC-003 | PDF page rendering | Per-page raster images with DPI, page size, rotation, crop boxes, thumbnail, hash. | `source.render_pdf_pages` route/descriptor exists and uses Poppler when available. | Partial | Add page crop boxes, thumbnails, and persisted source page resources. |
| SRC-004 | PDF text extraction | Native text extraction where a text layer exists, with diagnostics when pages are scans. | Poppler/pypdf-backed `source.extract_text` now exists. | Partial | Add text boxes/page coordinates later; keep text extraction supplemental, not primary for scanned plans. |
| SRC-005 | AI document reading and visual trace packet | Rendered source pages, native text excerpts, classifications, source ids, and required fact schema packaged for an LLM/subagent to read and visually trace. | `source.prepare_ai_visual_trace_run`, `source.ai_reading_packet`, `source.ai_visual_trace_packet`, `source.ai_visual_trace_work_order`, `source.ai_visual_trace_agent_requests`, `source.normalize_ai_visual_trace_reader_responses`, `source.ai_visual_trace_agent_loop`, `source.validate_ai_facts`, and `source.validate_ai_visual_trace_completeness` now exist. | Partial | Add a live provider adapter if desired; the deterministic loop already supports provider-neutral/subagent responses, normalization, and repair cycles. |
| SRC-006 | Image rendering/import | Imported image underlay and source-page rendering support visual review and coordinate alignment. | `import-image-underlay`, move/scale/rotate/delete descriptors. The old deterministic CV trace product surface has been removed. | Partial | Connect source docs to underlays with provenance and scale/origin metadata; AI visual tracing is the only reverse-BIM trace path. |
| SRC-007 | Drawing classification | Classify pages/files as floor plan, section, elevation, site plan, calculation, photo, legal/admin, energy, drainage, unknown. | `source.classify_documents` filename heuristic exists. | Partial | Add page-level AI classification from rendered pages and source text. |
| SRC-008 | Drawing set grouping | Group related plans/sections/elevations by scale, issue date, level, phase, and source version. | No dedicated surface found. | Not started | Add grouping and supersession detection; warn on conflicting revisions. |
| SRC-009 | Scale detection | Parse scale notes, scale bars, dimension strings, title blocks, known-size symbols, and manual fallbacks. | `source.detect_scale` parses text scale and dimension candidates; AI visual reading must identify graphical scale/dimension evidence from rendered pages. | Partial | Add per-page/per-region scale model, dimension-line calibration, and confidence ledger. |
| SRC-010 | Coordinate normalization | Map each page’s pixel/PDF coordinates into project mm coordinates with origin, rotation, scale, and level association. | Image underlay transform exists; no source-coordinate resource. | Partial | Add `source.coordinate_frame` and `source.align_page_to_model`; AI reader may propose scale/origin candidates, but MCP stores the deterministic transform. |
| SRC-011 | Semantic extraction | Extract dimensions, room labels, wall lines, openings, stair arrows, roof lines, contour lines, parcel boundaries, notes, materials. | AI-reading packet, AI visual trace work order, generic AI fact validation, and modelability completeness validation exist. | Partial | Use multimodal AI/subagents as primary readers; deterministic code validates provenance/conflicts and modelability. |
| SRC-012 | Table extraction | Extract area calculations, energy/drainage schedules, material lists, legal parcel data. | No dedicated surface found. | Not started | Add table extraction and structured document parsers. |
| SRC-013 | Photo evidence | Register photos, infer viewpoints when possible, link facade/roof/material facts. | Asset/image support exists, not reverse-BIM photo semantics. | Not started | Add photo classification, viewpoint hypothesis, and material evidence references. |
| SRC-014 | Source provenance | Every extracted fact stores document id, page, region, extraction method, confidence, timestamp, and source text/geometry pointer. | Assumption entries and evidence refs exist generally. | Partial | Add provenance as first-class field in reverse-BIM IR and later model element metadata. |
| SRC-015 | Conflict ledger | Conflicting facts across documents are detected and assigned disposition. | Folder output now emits `conflict-ledger.json`, `conflict-disposition-report.json`, and `conflict-disposition-worklist.json`; `/api/v3/reverse-bim/folder-output` accepts `conflictDecisions`. | Partial | Apply accepted decisions into model metadata/tolerance policy and final acceptance. |

### Source Fact Shape

Every extracted fact must use this minimum shape:

```json
{
  "factId": "srcfact-001",
  "kind": "room_area | wall_line | opening | level_height | parcel_boundary | material_note",
  "value": {},
  "confidence": 0.84,
  "status": "candidate | accepted | rejected | conflicting | superseded | modeled",
  "provenance": {
    "sourceDocumentId": "doc-001",
    "page": 2,
    "region": {"x": 120.0, "y": 88.0, "w": 340.0, "h": 40.0, "units": "pdf_pt"},
    "method": "native_text | ai_document_read | user_supplied",
    "textExcerpt": "Wohnen 24.36 m2",
    "coordinateFrameId": "frame-ground-plan"
  }
}
```

### AI Visual Exhaustiveness Gate

`source.validate_ai_facts` only proves that returned facts have basic ids,
confidence, and provenance. That is not sufficient for reverse-BIM.
`source.validate_ai_visual_trace_completeness` is the stricter pre-authoring
gate. It validates modelable fields by fact kind and can be called with
`requiredKinds`/`requiredFactKinds` for a work package so an agent cannot submit
a complete-looking subset while omitting required wall, room, opening, stair,
roof, or site facts:

- walls require level, endpoints/chain points, thickness, role, and closed/open
  chain state;
- rooms require level, name, source area, and boundary reference;
- doors/windows/openings require level, host wall reference or resolver-ready
  position, dimensions, and sill/head data where applicable;
- stairs require source/target levels, runs, step count, and slab-opening
  reference;
- roof/dormer facts require boundary/host references, pitch/heights, and
  position/dimension data;
- parcel/terrain/drainage facts require boundaries, areas, methods, and current
  uncertainty where applicable.

A future "here is Leo's folder" run must fail this gate until the AI visual
reader has returned exhaustive source facts, not just a plausible narrative.

### MCP-Feedable Source Spec Gate

The source specification produced from a folder is not merely a human-readable
analysis. It is the structured contract an agent will feed into MCP tools.

`source.normalize_ai_visual_trace_reader_responses` is the deterministic adapter
between flexible AI reading and strict model authoring. It:

- moves AI-returned top-level values such as `scope`, `levelId`, `areaM2`,
  `boundaryPointsMm`, `hostWallRef`, and `position` into the canonical `value`
  object;
- maps geometry aliases such as `boundaryPointsMm -> boundaryMm`, `points ->
  boundary`, `fromLevelId/toLevelId -> baseLevelId/topLevelId`, and
  `position.alongT -> alongT`;
- converts scalar current-condition strings into structured
  `photo_observation`, `material`, `construction_history`, or `conflict` facts;
- demotes vague current-condition prose about roofs/openings/stairs to
  observations instead of letting it masquerade as authorable geometry;
- preserves normalization findings so an agent can see exactly what was adapted
  before validation and MCP planning.

`reverse_bim.mcp_readiness` then classifies every normalized fact:

- `ready_for_mcp_authoring`: call the named MCP authoring tool in a dry-run
  transaction.
- `needs_mcp_resolver`: run query/resolve tools first, e.g.
  `resolve.wall_by_line`, `query.nearest_wall`, or roof host resolution.
- `needs_source_refinement`: send a focused repair request to the AI reader for
  missing geometry, host, level, boundary, or terrain data.
- `metadata_for_authoring`: use as reconciliation/type/material/schedule
  evidence, not as a direct element creation command.
- `reference_only`: retain as provenance-backed acceptance context.
- `source_conflict_disposition_required`: block final acceptance until resolved.
- `missing_mcp_tool`: add/map a first-class MCP tool contract before authoring.

## 2. Existing-Building Understanding IR

### Target IR

The reverse-BIM IR is a source-linked building understanding layer, not a seed
recipe. It must be queryable and diffable before any model mutation.

```text
ExistingBuildingIR
  sourceManifest
  coordinateFrames
  extractedFacts
  conflicts
  levels
  site
  buildingShell
  floorPlanGraphs
  rooms
  openings
  stairs
  roofsDormers
  basementCellar
  materialsHistory
  areasVolumes
  modelingPlan
  acceptanceRequirements
```

### IR Tracker

| ID | IR area | Must represent | Current repo surface | Status | Required work |
| -- | ------- | -------------- | -------------------- | ------ | ------------- |
| IR-001 | Levels/storeys | Names, elevations, slab thicknesses, finished floor levels, basement/cellar, attic, split levels, section alignment, confidence. | `createLevel`, query levels, datum checks. | Partial | Add source-provenance fields and level reconciliation against sections/elevations. |
| IR-002 | Walls/partitions | Exterior/interior wall graph, thickness, height, material, structural role, existing/demolished/new phase, endpoints, joins. | Wall commands/checks exist; many first-class authoring descriptors missing. | Partial | Add reverse-BIM wall graph IR and wall-line-to-model matching. |
| IR-003 | Openings | Doors, windows, wall openings, roof openings with host, normalized position, dimensions, sill/head heights, swing/handing when known. | Wall-hosted commands and integrity checks exist; descriptors mostly raw. | Partial | Add opening extraction and host-resolution workflow with source backchecks. |
| IR-004 | Stairs | Runs, landings, riser/tread, width, direction, connecting levels, shaft/slab openings, railings/headroom. | `author.stair_between_levels`, `createStair`, stair integrity. | Partial | Add stair-by-runs/landings MCP surface and source symbol extraction. |
| IR-005 | Rooms | Room names, polygons, target areas, calculated areas, usage, finish notes, door access, containment, reconciliation status. | Room elements, room derivation, room access/integrity checks. | Partial | Add source area ledger and room topology reconciliation as primary gate. |
| IR-006 | Roofs/dormers | Roof footprint, ridge/eave lines, pitch, overhangs, dormers, skylights, drainage notes, attic relation. | `createRoof`, `createDormer`, roof openings, roof evidence. | Partial | Promote roof/dormer MCP tools; add section/elevation-driven roof inference. |
| IR-007 | Basement/cellar | Cellar levels, foundation/floor slab, walls below grade, exterior access, light wells, drainage, terrain cuts. | Levels/floors/walls/toposolid/excavation exist. | Partial | Add basement-specific phase and cut/terrain reconciliation. |
| IR-008 | Terrain/toposolid | Topography samples/contours, retaining structures, building pad/cut, relation to house footprint. | Toposolid descriptors and site integrity exist. | Partial | Add site-plan ingestion and terrain-source coordinate alignment. |
| IR-009 | Parcel/property lines | Legal parcel boundary, setbacks, easements, northing/easting, survey/base point. | Property line and georeference tools exist. | Partial | Add legal doc parsing and site coordinate normalization. |
| IR-010 | Areas/volumes | Source area calculations, DIN/usable/gross/living distinctions, room and storey sums, volume where available. | Area command and schedules exist; cost/quantity lens exists. | Partial | Add area-calculation parser and reconciliation gate. |
| IR-011 | Materials/construction history | Construction year, renovation dates, material assemblies, energy-retrofit notes, roof/window replacements. | Materials, construction metadata, phases/options exist. | Partial | Add source-linked history model and existing-building phase semantics. |
| IR-012 | Confidence | Per-fact confidence, per-element confidence, unresolved ambiguity, inference method. | Assumptions support confidence generally. | Partial | Make confidence required in reverse-BIM IR and model metadata. |
| IR-013 | Conflict handling | Multiple conflicting scales/dimensions/areas/revisions with explicit choices. | No dedicated source conflict tooling. | Not started | Add conflict ledger and block modeling on unreviewed P0 conflicts. |
| IR-014 | Fact-to-element mapping | Each IR fact maps to created/updated element ids and validation evidence. | Command log and source command index patterns exist. | Partial | Add durable source fact references on element metadata and QA readback. |

### IR Acceptance Gate

The agent may not begin committed modeling until:

- source manifest exists;
- every relevant document/page has a classification or `unknown` disposition;
- at least one coordinate frame exists for each drawing used for geometry;
- levels and primary floor plans are identified with confidence;
- known conflicts have severity and disposition;
- the first modeling plan lists which source facts will be authored in each
  phase.

## 3. MCP-First Authoring Surfaces

### Current Strong Surfaces

| Surface | Current capability | Status |
| ------- | ------------------ | ------ |
| `model.dry_run` | Dry-run kernel command bundles. | Done |
| `model.commit_bundle` / `apply-bundle` | Commit bundles through existing transaction path. | Done |
| `model-show`, `model.summary` | Snapshot and compact summary. | Done |
| `query.elements` | Element search with geometry/host/raw includes. | Done |
| `query.levels`, `query.views`, `query.types` | Required context discovery. | Done |
| `query.hosts`, `query.nearest_wall`, `resolve.wall_by_line`, `resolve.host_face` | Host/line matching support. | Done |
| `query.enclosed_loops`, `resolve.room_boundary`, `resolve.loop_for_boundary` | Loop/boundary discovery. | Done |
| `qa.advisor`, `qa.constructability`, `qa.integrity_preflight`, `qa.profile_comparison` | Deterministic feedback loop inputs. | Done |
| `evidence.package`, renderer diagnostics route | Evidence collection and renderer diagnostic persistence. | Done |
| `commands.schema.catalog` / `commands.schema.inspect` | Raw command schema discovery. | Done |
| `source.prepare_ai_visual_trace_run`, `source.ai_reading_packet`, `source.ai_visual_trace_packet`, `source.ai_visual_trace_work_order`, `source.ai_visual_trace_agent_requests`, `source.ai_visual_trace_agent_loop`, `source.validate_ai_facts`, `source.validate_ai_visual_trace_completeness` | Folder-to-reader preparation, AI reader/subagent input packet, reusable visual-reading work order, provider-neutral multimodal reader requests, response validation, accepted fact aggregation, repair prompts, and modelability completeness gate. | Partial |
| `reverse_bim.plan_authoring` | Maps validated source facts to first-class MCP authoring tools or required resolver steps. | Partial |

### Authoring Surface Tracker

| Object / operation | Existing command(s) | First-class MCP/API descriptor today | Current usable path | Status | Required MCP contract |
| ------------------ | ------------------- | ------------------------------------ | ------------------- | ------ | --------------------- |
| Levels | `createLevel`, `moveLevelElevation` | `author.level` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add `edit.level_elevation` and level alignment readback. |
| Wall | `createWall`, `updateWall`, `moveWallEndpoints`, `moveWallDelta` | `author.wall` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add direct commit envelope/readback or keep documented two-step dry-run/commit. |
| Wall chain | `createWallChain` | `author.wall_chain` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add join/corner evidence to response/phase packet. |
| Floor/slab from boundary | `createFloor` | `author.floor_from_boundary` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add `author.floor_from_walls` and source boundary reconciliation. |
| Room outline | `createRoomOutline`, `createRoomRectangle`, `createRoomPoly`, `placeRoomAtPoint` | `author.room_outline` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add `author.rooms_from_source_areas`, area reconciliation output. |
| Door on wall | `insertDoorOnWall`, `updateDoor`, `assignOpeningFamily` | `opening.door_on_wall` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add opening host resolver and swing/handing metadata. |
| Window on wall | `insertWindowOnWall`, `updateWindow`, `assignOpeningFamily` | `opening.window_on_wall` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add facade/elevation validation and source sill/head reconciliation. |
| Generic wall opening | `createWallOpening`, `updateWallOpening` | No first-class descriptor found. | Raw bundle. | Partial | `opening.wall_opening` with interval validation and cut evidence. |
| Roof | `createRoof`, `upsertRoofType`, `updateElementProperty` | `author.roof_from_boundary` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add `author.roof_from_walls`, roof geometry evidence, and section/elevation reconciliation. |
| Roof opening | `createRoofOpening` | `opening.roof_opening` descriptor exists. | Semantic bundle generation plus transaction path. | Partial | Add host roof plane resolver and dormer/skylight source validation. |
| Dormer | `createDormer` | `author.dormer_on_roof` descriptor exists. | Semantic bundle generation plus transaction path; still needs roof-position resolver. | Partial | Add roof-host region resolver, source elevation validation, and floor-opening evidence. |
| Stair between levels | `createStair` | `author.stair_between_levels` | Semantic bundle generation plus transaction path. | Partial | Current helper is too simple for existing buildings because it omits by-sketch boundaries, landings, and tread-line evidence. |
| Stair by runs/landings | `createStair` supports run fields, by-sketch boundaries, landings; `update_stair_treads` exists. | `author.stair_by_runs` and `author.stair_by_sketch` now expose typed semantic bundles through API/registry. | Raw typed bridge should be replaced in the next Leo rerun; preflight/headroom evidence is still pending. | Partial | Add landing/slab-opening/headroom validation and source-derived existing-condition tolerance. |
| Slab opening | `createSlabOpening` | `opening.slab_opening`, `opening.shaft_opening` | Semantic bundle generation plus transaction path. | Partial | Multi-floor shaft propagation and stair-opening macro. |
| Railing | `createRailing` | `author.railing` | Semantic bundle generation plus transaction path. | Partial | Host path readback, stair railing auto-generation. |
| Toposolid | `CreateToposolid`, `UpdateToposolid`, `DeleteToposolid` | `toposolid-create/update/delete`, `site.setup-georeference`. | First-class descriptors. | Done | Add source-contour import and alignment evidence. |
| Toposolid subdivisions/excavation | subdivision/excavation commands | Site descriptors exist. | First-class descriptors. | Done | Add building pad/cellar cut workflows. |
| Property line | `createPropertyLine`, update/delete | `site.property-line-create/update/delete` | First-class descriptors. | Done | Add parcel doc parser and georeferenced coordinate support. |
| Project/survey point | base/survey point commands | `site.project-base-point-*`, `site.survey-point-*` | First-class descriptors. | Done | Add source CRS/legal coordinate readback. |
| Materials/types | `upsertWallType`, `upsertFloorType`, `upsertRoofType`, `upsertFamilyType`, `update_material_pbr` | Family/material descriptors; wall/floor/roof type mostly raw. | Mixed. | Partial | `type.wall/floor/roof`, assembly/source metadata. |
| Schedules | `upsertSchedule`, `create_schedule_view`, filters | `create-schedule-view`, `document.create_drawing_set`; schedule rows route. | Partial. | Partial | `document.schedule`, `query.schedule_rows`, area schedule reconciliation. |
| Views/sheets | plan/section/elevation/sheet commands | Some doc pack descriptors; many raw. | Partial. | Partial | Phase-specific view capture and source overlay comparison tools. |

### Required Common Mutating Contract

All reverse-BIM mutating tools must support:

```json
{
  "modelId": "uuid",
  "parentRevision": 42,
  "mode": "dry-run | commit",
  "idempotencyKey": "string",
  "sourceFactIds": ["srcfact-001"],
  "assumptions": [
    {
      "key": "wall.thickness.inferred",
      "value": "300mm from plan graphics",
      "confidence": 0.72,
      "source": "source-fact-ledger",
      "contestable": true
    }
  ],
  "tolerances": []
}
```

All mutating responses must include:

```json
{
  "ok": true,
  "revision": 43,
  "createdElementIds": ["wall-001"],
  "updatedElementIds": [],
  "deletedElementIds": [],
  "sourceFactIds": ["srcfact-001"],
  "warnings": [],
  "advisorFindings": [],
  "queryReadback": {},
  "undoToken": "..."
}
```

### Host and Matching Contracts

| ID | Tool | Required behavior | Current status |
| -- | ---- | ----------------- | -------------- |
| MCP-HOST-001 | `resolve.wall_by_line` | Match source/model line to wall candidates with tolerance, level, orientation, length delta, confidence. | Done |
| MCP-HOST-002 | `query.nearest_wall` | Find nearest wall for a point/opening candidate. | Done |
| MCP-HOST-003 | `resolve.host_face` | Resolve wall/roof/slab host face for placement. | Done |
| MCP-HOST-004 | `resolve.opening_host` | Given source opening region, return host wall, normalized interval, rough opening dimensions, conflicts. | Not started |
| MCP-HOST-005 | `validate.opening_placement` | Check door/window/window-like opening fits host, cuts wall, does not overlap, has sill/head, stays within level/story. | Partial via integrity checks |
| MCP-HOST-006 | `resolve.stair_floors` | Find floors needing slab openings for stair/shaft. | Not started |
| MCP-HOST-007 | `validate.stair_vertical_clearance` | Headroom, landing, floor opening, railing and circulation checks. | Partial via vertical circulation integrity |
| MCP-HOST-008 | `resolve.roof_host_region` | Match dormer/skylight/roof opening source region to roof plane. | Not started |
| MCP-HOST-009 | `validate.roof_dormer` | Dormer inside roof footprint, creates host roof and floor openings, aligns to elevation/section. | Partial via `createDormer` engine validation |

## 4. Agent Feedback Loop

### Mandatory Phase Loop

Every phase uses the same loop:

```text
prepare source facts for phase
  -> query current model state
  -> build small transaction
  -> dry-run transaction
  -> commit transaction
  -> query changed elements and impacted hosts
  -> run Advisor
  -> run constructability report
  -> run integrity preflight
  -> collect evidence package
  -> collect renderer diagnostics
  -> capture required screenshots/views
  -> compare model/readback/render evidence to source facts
  -> disposition every finding
  -> fix/tolerate/block before next phase
```

### Required Feedback Artifacts

| ID | Artifact | Current repo surface | Status | Required reverse-BIM use |
| -- | -------- | -------------------- | ------ | ------------------------ |
| FB-001 | Advisor findings | `qa.advisor` | Done | Run after every committed phase and after fix bundles. |
| FB-002 | Constructability report | `qa.constructability` / `/constructability-report` | Done | Run after every phase; use profile appropriate to authoring/acceptance. |
| FB-003 | Model-integrity preflight | `qa.integrity_preflight` | Done | Block progression on hosting/support/vertical-circulation errors. |
| FB-004 | Profile comparison | `qa.profile_comparison` | Done | Use at major gates to catch profile-specific drift. |
| FB-005 | Geometry integrity | Model integrity, hosted opening, physical support, vertical circulation checks. | Done | Required after walls/openings/stairs/roof/site. |
| FB-006 | Renderer diagnostics | `/renderer-diagnostics`, evidence package includes renderer/evidence data. | Partial | Productize phase capture into reverse-BIM packet. |
| FB-007 | Model query summaries | `model.summary`, `query.elements`, `query.hosts`, `query.enclosed_loops`. | Done | Required after each transaction to verify counts/geometry/hosts. |
| FB-008 | Screenshots/views | Evidence package and export/render surfaces exist; live screenshot capture is not a pure MCP primitive. | Partial | Add `qa.capture_views` / `view.render_snapshot` for agent-only review. |
| FB-009 | Source comparison | No source-to-model comparison packet for reverse-BIM. | Not started | Add overlay/diff between source page coordinate frames and model views. |
| FB-010 | Finding disposition | Patterns exist in sketch methodology; no reverse-BIM product artifact. | Not started | Add phase finding ledger with required disposition enum. |

### Finding Disposition Enum

Every Advisor/constructability/integrity/source-comparison finding must be
assigned one of:

| Disposition | Meaning | May proceed? |
| ----------- | ------- | ------------ |
| `fixed` | A follow-up transaction fixed the finding and re-check passed. | Yes |
| `not_applicable` | Finding does not apply to existing-building scope; reason required. | Yes |
| `source_conflict` | Blocked by conflicting source documents; conflict id required. | No for final; maybe yes within same phase |
| `later_phase` | Expected to be resolved by an explicitly named later phase. | Only before that later phase |
| `tolerated` | Accepted with explicit scope, reason, source evidence, and severity. | Yes only if not an error unless user/product policy allows |
| `blocked` | Cannot proceed without tooling or user decision. | No |

Policy: final acceptance may not contain unresolved `error` findings. Warnings
may remain only with `tolerated` dispositions and visible owner/rationale.

## 5. Modeling Phases for Existing Buildings

### Phase Tracker

| Phase | Goal | Required MCP actions | Required feedback | Status |
| ----- | ---- | -------------------- | ----------------- | ------ |
| P0 Source inventory | Produce manifest, document registry, classification, page previews, and AI-readable source packet. | `source.folder_manifest`, render/classify/AI-reading-packet tools. | Source manifest validation. | Partial |
| P1 Scale/site setup | Establish project units, coordinate frames, base/survey point, north, parcel/site frame. | Site/georeference tools, page alignment. | Query site/base points, source alignment checks. | Partial |
| P2 Levels | Model all levels/storeys and datum relationships from plans/sections. | Level commands via bundle; query levels. | Advisor, level datum checks, section-source alignment. | Partial |
| P3 Structural shell | Exterior walls, slabs/floors, primary envelope, cellar shell if known. | Wall/floor tools, dry-run/commit. | Query wall/floor counts, support context, Advisor/integrity. | Partial |
| P4 Floor plan topology | Build exact wall graph, joins, corridors, room-bounding topology per level. | Wall chain/edit/split/trim tools. | Enclosed loops, room boundary candidates, source overlay. | Partial |
| P5 Interior partitions | Add all internal walls/partitions, shafts, niches, wall type assumptions. | Wall/chain/edit tools. | Room loop closure, Advisor, topology comparison. | Partial |
| P6 Rooms and area reconciliation | Create rooms, names, areas, usage, schedules; reconcile to source calculations. | Room outline/schedule tools. | Room area diff, schedule rows, room access checks. | Partial |
| P7 Openings | Place doors/windows/openings with correct hosts, sizes, sills, facade alignment. | Door/window/wall-opening tools, host resolvers. | Hosted opening integrity, elevation/source comparison. | Partial |
| P8 Stairs/vertical circulation | Model stairs, landings, railings, slab openings, headroom. | Stair/slab opening/railing tools. | Vertical circulation integrity, constructability, screenshots. | Partial |
| P9 Roof/dormers | Model roof geometry, dormers, skylights/openings, drainage metadata. | Roof/dormer/roof opening tools. | Roof evidence, roof-wall coverage, source section/elevation comparison. | Partial |
| P10 Basement/cellar | Complete cellar/below-grade walls, floors, terrain cuts, exterior access/drainage. | Levels/walls/floors/toposolid excavation. | Terrain/building relation, drainage metadata warnings. | Partial |
| P11 Terrain/parcel/topology | Model terrain/toposolid, parcel lines, setbacks, site objects, topology relation. | Site/property/toposolid tools. | Site georeferencing integrity, house centered/placed check. | Partial |
| P12 Materials/history | Add construction year, renovation history, assemblies/materials from energy/docs/photos. | Type/material/construction metadata tools. | Material schedules, construction lens, source provenance readback. | Partial |
| P13 Documentation/schedules | Create required plans, sections, elevations, schedules, room/door/window/material schedules. | View/sheet/schedule tools. | Schedule rows, sheet evidence, export diagnostics. | Partial |
| P14 Validation | Run full deterministic validation suite and source comparison. | QA tools, exports, evidence package. | All findings disposed; source fact coverage matrix. | Partial |
| P15 Final acceptance | Freeze accepted model with evidence packet and tolerances. | Final query/export/evidence tools. | Acceptance matrix, UI/MCP equivalence readback. | Not started |

### Phase Exit Packet

Every phase must output:

```json
{
  "phaseId": "P7-openings",
  "modelId": "uuid",
  "startRevision": 18,
  "endRevision": 23,
  "sourceFactIds": ["srcfact-120", "srcfact-121"],
  "transactions": [],
  "createdElementIds": [],
  "updatedElementIds": [],
  "queryReadback": {},
  "advisor": {},
  "constructability": {},
  "integrityPreflight": {},
  "rendererDiagnostics": {},
  "views": [],
  "sourceComparison": {},
  "findingDispositions": [],
  "openBlockers": []
}
```

## 6. Acceptance Criteria

### Hard Acceptance

| ID | Criterion | Evidence required | Status |
| -- | --------- | ----------------- | ------ |
| AC-001 | Model matches floorplan topology, not only envelope. | Source overlay, wall graph diff, room loop/area reconciliation. | Not started |
| AC-002 | No floating/unhosted elements. | `qa.integrity_preflight`, `query.hosts`, model-integrity report. | Partial |
| AC-003 | No doors/windows outside walls or without valid cuts. | Hosted opening integrity, opening cut fidelity evidence. | Partial |
| AC-004 | No furniture/assets on stairs/circulation. | Model-integrity circulation overlap checks. | Partial |
| AC-005 | House centered and correctly placed on topology/site. | Site coordinate frame, toposolid/property line readback, source site overlay. | Partial |
| AC-006 | Room areas reconcile with source calculations. | Area schedule rows, room target area mismatch check, source area ledger. | Partial |
| AC-007 | All levels and sections align. | Level query, section/elevation source comparison, datum checks. | Partial |
| AC-008 | Stairs connect correct levels with required openings/landings/headroom. | Vertical circulation integrity, stair geometry evidence. | Partial |
| AC-009 | Roof/dormers align with plans, elevations, and sections. | Roof geometry evidence and source comparison. | Partial |
| AC-010 | Terrain/parcel/topology represented where source docs contain them. | Toposolid/property line/site georeference checks. | Partial |
| AC-011 | Materials, construction year, renovations recorded where source docs contain them. | Element/type metadata readback with source provenance. | Not started |
| AC-012 | All Advisor findings resolved or explicitly tolerated. | Phase and final finding disposition ledger. | Not started |
| AC-013 | Final model inspectable in UI and via MCP with equivalent information. | UI screenshot/view evidence plus `model-show`/query/evidence package. | Partial |
| AC-014 | No source facts silently dropped. | Source fact coverage matrix with modeled/rejected/conflicting/deferred status. | Not started |
| AC-015 | Final export/readback is coherent. | IFC/glTF/export diagnostics as applicable. | Partial |

### Non-Acceptance Examples

These outcomes must fail:

- exterior massing is plausible but interior partitions are missing;
- rooms exist but do not reconcile with source room areas;
- windows/doors float because the host wall id or normalized position is wrong;
- stair is visual-only and lacks slab openings or level connectivity;
- roof is a generic mass box when sections/elevations show specific geometry;
- site exists but the house is not aligned to parcel/topography;
- Advisor warnings are ignored because the rendered view looks acceptable;
- model can only be understood through a seed artifact, not by live MCP query.

## 7. Migration Plan

### Deprecate from Old Sketch-to-BIM

| ID | Item | Action | Status |
| -- | ---- | ------ | ------ |
| MIG-001 | Seed-first methodology | Mark legacy for existing-building digitization. | Done in this spec |
| MIG-002 | `target-house-*` assumptions | Do not use as truth for reverse-BIM. | Done in this spec |
| MIG-003 | One-shot compile/commit | Replace with phase-by-phase dry-run/commit/query/QA loop. | Partial |
| MIG-004 | Visual massing acceptance | Replace with source fact coverage and model integrity acceptance. | Partial |
| MIG-005 | Sketch IR as primary IR | Replace with ExistingBuildingIR. | Not started |
| MIG-006 | Skill-local agent-loop packet | Productize as reverse-BIM phase packet. | Not started |
| MIG-007 | Raw bundle as normal authoring | Keep as expert fallback only; promote typed MCP tools. | Partial |

### Reuse

| ID | Reusable piece | How to reuse | Status |
| -- | -------------- | ------------ | ------ |
| REUSE-001 | Transaction safety | All mutations use `model.dry_run` then `model.commit_bundle`. | Done |
| REUSE-002 | Query/resolve layer | Use before and after every mutation. | Done |
| REUSE-003 | Advisor/constructability/integrity | Mandatory after every phase. | Done |
| REUSE-004 | Evidence package | Base readback packet; extend for source comparison. | Partial |
| REUSE-005 | Image underlay/source page import | Use rendered source pages as visual underlays/evidence after source ingestion; do not use legacy CV/img-trace as the reverse-BIM tracing source. | Partial |
| REUSE-006 | Site/toposolid tools | Use for parcel/topography/site modeling. | Done |
| REUSE-007 | Export/readback tests | Use final exchange checks. | Partial |
| REUSE-008 | Assumption/confidence patterns | Extend into source fact and IR provenance. | Partial |

### Implement First

P0 implementation order:

| Priority | Work package | Owner slice for parallel agents | Done condition | Status |
| -------- | ------------ | ------------------------------- | -------------- | ------ |
| P0 | Source folder manifest and source document registry | Agent A: backend/source module + descriptor + tests | `source.folder_manifest` returns stable manifest with hashes and page/image metadata. | Partial |
| P0 | PDF render/text/AI-reading packet pipeline | Agent B: PDF renderer/extractor + LLM packet orchestration | PDFs/scans produce page images and an AI-readable source packet; returned AI facts validate with provenance. | Partial |
| P0 | Document classification and coordinate frames | Agent C: classification schema + coordinate normalization tools | Every page can be classified and aligned with scale/origin/rotation. | Partial |
| P0 | ExistingBuildingIR schema | Agent D: schema, examples, validation route | IR validates levels, walls, openings, rooms, site, provenance, confidence/conflicts. | Partial |
| P0 | Reverse-BIM phase packet | Agent E: QA/evidence aggregation | Phase packet joins transactions, source facts, query readback, QA, findings. | Partial |
| P0 | Core typed authoring promotions | Agent F: wall/floor/room/door/window/roof descriptors | Agents can use typed semantic MCP descriptors rather than raw bundles for core architecture. | Done for descriptor promotion; Partial for direct commit/readback |
| P0 | Source-to-model coverage matrix | Agent G: comparison/coverage logic | Every source fact has status and modeled element refs or disposition. | Partial |

P1 implementation order:

| Priority | Work package | Done condition | Status |
| -------- | ------------ | -------------- | ------ |
| P1 | Opening host resolver | Source opening region resolves to host wall/interval/dimensions with ambiguity output. | Not started |
| P1 | Stair-by-runs and stair shaft macro | Existing stair symbols/sections can become stair + openings + railings. | Partial |
| P1 | Roof/dormer tools | Roof/dormer/roof-opening source facts can be authored and validated without raw bundles. | Partial |
| P1 | Area calculation parser/reconciler | Room/level/building area calculations reconcile to model schedules. | Not started |
| P1 | Site/parcel document parser | Parcel/property/site/topology facts feed site tools with provenance. | Not started |
| P1 | Source overlay view comparison | Rendered plan/elevation/section can be compared to source page coordinate frames. | Not started |

P2 implementation order:

| Priority | Work package | Done condition | Status |
| -------- | ------------ | -------------- | ------ |
| P2 | Photo viewpoint/material support | Photos can support facade/material/renovation evidence. | Not started |
| P2 | Legal/admin/energy/drainage parsers | Non-geometric docs become source-linked metadata and schedules. | Not started |
| P2 | Final UI/MCP equivalence packet | Final acceptance proves UI and MCP expose equivalent model facts. | Partial |
| P2 | Full reverse-BIM benchmark corpus | Multiple source folders with expected IR/model/evidence baselines. | Not started |

## Required New MCP Namespaces

### `source.*`

| Tool | Status | Purpose |
| ---- | ------ | ------- |
| `source.folder_manifest` | Partial | Immutable source folder inventory. |
| `source.register_documents` | Not started | Persist source documents and ids. |
| `source.render_pdf_pages` | Partial | Render PDF pages to images with page metadata. |
| `source.extract_text` | Partial | Native PDF text extraction. Supplemental only; scanned plans are read by AI/subagent from rendered pages. |
| `source.prepare_ai_visual_trace_run` | Partial | Given a source folder, write manifest/classification/rendered-pages/text/AI-packet/work-order/reader-request/initial-loop artifacts. |
| `source.ai_reading_packet` | Partial | Package rendered pages/text/classifications for a multimodal AI/subagent reader. |
| `source.ai_visual_trace_packet` | Partial | Package rendered plans/docs for AI visual tracing into source facts; primary replacement for CV-led tracing in reverse-BIM. |
| `source.ai_visual_trace_work_order` | Partial | Split rendered source pages into reusable AI visual-reading work packages with expected fact kinds, value requirements, and checklists. |
| `source.ai_visual_trace_agent_requests` | Partial | Build provider-neutral multimodal reader requests for each work package. |
| `source.normalize_ai_visual_trace_reader_responses` | Partial | Normalize flexible AI/subagent responses into canonical value objects and geometry aliases so facts can be validated and mapped to MCP. |
| `source.ai_visual_trace_agent_loop` | Partial | Ingest multimodal reader responses, normalize them, optionally dispatch an external reader command, validate package completeness, aggregate accepted facts, and produce repair requests. |
| `source.validate_ai_facts` | Partial | Validate LLM-returned source facts before IR/modeling. |
| `source.validate_ai_visual_trace_completeness` | Partial | Enforce modelable fields per AI fact kind and optional required fact kinds so wall/room/opening/stair/roof/site facts cannot pass as vague notes or be silently omitted. |
| `source.classify_documents` | Partial | Classify drawings/docs/photos/calculations. |
| `source.detect_scale` | Partial | Scale detection from notes, bars, dimensions, symbols. |
| `source.create_coordinate_frame` | Not started | Page-to-model transform. |
| `source.extract_facts` | Partial | Extract semantic building/site facts. |
| `source.resolve_conflicts` | Not started | Maintain conflict/disposition ledger. |
| `reverse_bim.source_coverage` | Partial | Track modeled/rejected/deferred source facts. |

### `reverse_bim.*`

| Tool | Status | Purpose |
| ---- | ------ | ------- |
| `reverse_bim.ir_seed` | Partial | Create initial ExistingBuildingIR packet from manifest and source facts. |
| `reverse_bim.ir_validate` | Partial | Validate ExistingBuildingIR. |
| `reverse_bim.plan_phases` | Not started | Produce source-fact-to-modeling phase plan. |
| `reverse_bim.plan_authoring` | Partial | Map source facts to existing MCP authoring tools or resolver prerequisites. |
| `reverse_bim.mcp_readiness` | Partial | Classify normalized source facts as ready for MCP authoring, resolver-needed, source-refinement-needed, metadata/reference, conflict, or missing-tool. |
| `reverse_bim.folder_output` | Partial | Build the folder-output handoff package from a source folder plus optional AI-reader responses. |
| `reverse_bim.phase_packet` | Partial | Aggregate transactions, source facts, QA, views, dispositions. |
| `reverse_bim.source_model_compare` | Not started | Compare model readback/render evidence to source facts. |
| `reverse_bim.final_acceptance` | Not started | Enforce acceptance gates and tolerance policy. |

## Exact Current Gap Summary

The software appears to have much of the BIM modeling and deterministic feedback
surface needed for careful authoring. The first reverse-BIM product slice now
exists, but it is not yet the complete automated digitization pipeline:

- **Source ingestion is now partially implemented.** The repo has folder
  manifests, PDF rendering, supplemental native text extraction, filename-based
  classification, AI-reading packets, AI visual trace work orders, AI fact
  agent request/response loops, AI-reader response normalization, AI fact
  validation, AI visual completeness validation, source fact extraction, and
  source coverage packets. Missing
  pieces are persisted source registries, page-level AI classification,
  coordinate frames, conflict ledgers, optional live provider adapters,
  table/legal parsers, and source-to-model visual comparison.
- **MCP-feedable fact readiness now exists as a first contract.**
  `reverse_bim.mcp_readiness` separates direct authoring payloads from
  resolver-needed facts, source-refinement-needed facts, metadata/reference
  facts, conflicts, and missing tool contracts. This is the bridge an agent
  uses to decide whether to call MCP authoring tools or ask the source reader
  for a repair pass.
- **Document understanding should remain AI-first.** Deterministic tooling should
  render/package source pages and validate returned JSON facts; multimodal
  AI/subagents should read scanned plans and documents. Text extraction is only a
  helper when PDFs already contain useful text.
- **Core architecture authoring is now exposed through promoted MCP descriptors,
  but not fully direct-commit.** First-class descriptors exist for walls, wall
  chains, floors, room outlines, doors, windows, roof boundaries, and roof
  openings. Most still generate typed semantic bundles that must be dry-run and
  committed through model transactions.
- **Query/resolve and QA are strong.** These should be the backbone of the new
  methodology.
- **Acceptance must shift from sketch resemblance to source-fact coverage and
  live model cleanliness.** The final model must be explainable from both the
  source documents and MCP/UI readback.

## Current Testhaus Leo Benchmark Run

Initial source packaging has been run against
`/Users/jhoetter/Desktop/Testhäuser/Testhaus Leo` with outputs in
`tmp/reverse-bim-testhaus-leo/`.

| Artifact | Status | Notes |
| -------- | ------ | ----- |
| Folder manifest | Done | 16 PDFs discovered with stable document ids and lightweight metadata. |
| Document classification | Partial | Filename heuristics found 3 floor plan docs, 1 elevation doc, 2 site plan docs, 2 area calculation docs, drainage/construction/legal docs, and 4 unknown docs. |
| Full folder preparation run | Done for packaging | `tmp/reverse-bim-testhaus-leo/prepared-from-folder/` was generated from `/Users/jhoetter/Desktop/Testhäuser/Testhaus Leo`: 16 files, 16 documents, 68 rendered PDF pages, 6 work packages, 6 reader requests, initial loop blocked until reader responses are supplied. |
| PDF rendering | Partial | 9 priority source pages rendered for AI reading: `EG`, `DG`, `Grundrisse, Schnitt`, `Ansichten`, site, drainage, and area documents. |
| AI-reading packet | Done for packaging | `tmp/reverse-bim-testhaus-leo/source-ai-reading-packet.json` is ready for a multimodal AI/subagent reader. |
| Deterministic source facts | Partial | Classification and scale candidates exist; they are intentionally insufficient for modeling geometry. |
| MCP authoring plan from deterministic facts | Blocked as designed | `tmp/reverse-bim-testhaus-leo/authoring-plan.from-deterministic-facts.json` contains no model actions because no AI-read wall/room/opening/site geometry facts exist yet. |
| MCP authoring plan from demo AI facts | Verified | Demo wall facts route to `author.wall`; demo door facts route to `opening.door_on_wall` and require `resolve.wall_by_line`/`query.nearest_wall` before dry-run. |
| AI visual trace work order | Partial | `tmp/reverse-bim-testhaus-leo/source-ai-visual-trace-work-order.expanded.json` splits the source set into reusable work packages: current condition, dimensional floorplans, section/roof, area/volume, site/parcel, and drainage/basement. Each package now includes expected fact kinds, required modelable value fields, and an extraction checklist. |
| AI visual agent requests | Done for packaging | `tmp/reverse-bim-testhaus-leo/source-ai-visual-agent-requests.json` contains six provider-neutral multimodal reader requests with rendered image inputs, prompts, required fact kinds, and output contracts. |
| AI visual agent loop test | Partial / blocked as designed | `tmp/reverse-bim-testhaus-leo/source-ai-visual-agent-loop.partial.json` ran against partial Leo reader responses. Current-condition facts passed; area/volume needs room facts with boundaries; dimensional floorplans, sections/roof, site/terrain, and drainage are waiting for multimodal reader responses. No BIM authoring is allowed from this partial run. |
| AI reader normalization | Partial | `tmp/reverse-bim-testhaus-leo/source-ai-visual-reader-responses.normalized.json` normalizes the captured partial reader responses into canonical value objects. This proves the adapter path, but the captured file currently contains only current-condition and area/volume packages. |
| MCP authoring readiness | Partial / blocked as designed | `tmp/reverse-bim-testhaus-leo/source-ai-visual-mcp-readiness.partial.json` classifies the captured partial facts. Current captured facts are metadata/reference only; no wall/room/opening/stair/roof/site facts are ready for MCP authoring from that partial artifact. |
| Folder-output fresh run | Partial / blocked as designed | `tmp/reverse-bim-testhaus-leo/folder-output-fresh/` was generated directly from the Leo source folder with no reader responses: 16 source documents, 68 rendered pages, 6 work packages, 35 candidate coordinate frames, package state `source_packaging_ready`. It correctly blocks modeling and instructs dispatch of `ai-reading/ai-visual-agent-requests.json`. |
| Folder-output partial-response run | Partial / blocked as designed | `tmp/reverse-bim-testhaus-leo/folder-output-partial-responses/` was generated with the captured partial reader responses: package state `source_understanding_blocked`, 8 normalized facts, 1 accepted work package, and explicit missing packages/fact kinds for dimensional floorplans, roof/elevations, site/terrain, area room boundaries, and drainage/basement. |
| Folder-output repaired-decisions run | Accepted for MCP handoff fixture | `tmp/reverse-bim-testhaus-leo/folder-output-repaired-decisions/` was regenerated from `leo-reader-responses.repaired-area.json`: 16 documents, 68 pages, 6 accepted reader work packages, complete visible room/area rows for the current fixture, 0 hard MCP blockers, 0 open conflicts, 0 room-topology blockers, 0 coordinate-frame blockers, 0 site/terrain blockers, package state `mcp_handoff_ready`. This is still an integration fixture, not a fresh provider result. |
| Target-house-3 modeling test | Accepted diagnostic MCP model | `tmp/reverse-bim-testhaus-leo/target-house-3/` rebuilds from the folder output transactionally: 3 levels, 24 walls, 2 floors, 35 room separations, 13 rooms, 12 doors, 2 windows, 1 stair, 1 slab opening, 1 railing, 1 roof, 1 roof opening, 1 dormer, 1 site, 1 flat context toposolid, 4 property lines. `final-acceptance.json` passes 7/7 gates with `accepted=true`: coverage complete, area reconciliation clean, room topology complete, integrity clean, and all remaining Advisor/constructability warnings explicitly reviewed/disposed. |
| AI visual source analysis | Partial | `tmp/reverse-bim-testhaus-leo/leo-ai-visual-source-analysis.md` captures current understanding and blockers; it is not yet sufficient for model authoring. |
| AI visual completeness gate | Partial | `source.validate_ai_visual_trace_completeness` now blocks vague AI-read facts. Leo currently has high-level understanding, but it intentionally fails authoring readiness until exact wall chains/thicknesses, room loops, openings, stairs, roof, site/terrain, and conflicts are returned as structured facts. |

The current Leo result proves the intended gate: the system does not create a
rough seed from document classifications. It first requires validated AI-read
source facts, then authors the live BIM through MCP transactions and feedback
loops. The repaired-area fixture now reaches an accepted diagnostic model, but
future hardening is still required:

- replace the fixture with fresh provider/subagent reader responses that produce
  the same fact quality from the folder alone;
- add true dormer-face window authoring instead of representing the current
  dormer-window fact through the wall-hosted opening path;
- extract door swing/handedness where visible so operation-clearance warnings
  are resolved geometrically rather than tolerated as source-limited;
- add source overlay comparison for floor plans, elevations, sections, and site
  plans;
- promote the `tmp/reverse-bim-testhaus-leo/build_target_house_3.py`
  diagnostic harness into a reusable reverse-BIM runner/route.

## Post-Target-House-3 Detailed Tracker

The detailed remediation tracker is maintained in
`spec/reverse-bim-folder-output-methodology-tracker.md` under
`Target-House-3 Remediation Tracker`. That tracker now records the accepted
Leo repaired-area run and the remaining product-hardening work.

The required work is grouped as follows:

| Track | Primary blocker it resolves | Key new artifacts/tools | Acceptance impact | Status |
| ----- | --------------------------- | ----------------------- | ----------------- | ------ |
| Response capture | Consolidated facts are still partly an integration fixture. | `reader-response-index.json`, immutable raw response capture, `readerCommand` dispatch/capture. | Makes the run reproducible from files rather than chat history. | Partial |
| Coordinate frames | Source geometry is in candidate frames, not accepted transforms. | `coordinate-frame-report.json`, `coordinate-frame-worklist.json`, accepted per-page transforms. | Enables source overlay and precise model/source comparison; generic gate now blocks only fact-referenced geometry frames. | Partial |
| Conflict disposition | 6 open conflicts/repair blockers block final acceptance after stricter room topology validation. | `conflict-ledger.json`, `conflict-disposition-worklist.json`, tolerance policy decisions. | Prevents ambiguous target-half/year/parcel/roof/drainage facts from silently entering the model. | Partial |
| Room topology | Room access and room-wall topology must be proven after authoring. | `room-topology.json`, `author.room_separation`, `resolve.room_boundary_edges`, `query.room_access_graph`, `roomTopologyRepairWorklist_v1`. | Source package topology report, stricter reader contract, authoring, deterministic readback, and repair worklist generation exist; target-house-3 now commits topology repairs and ends with 0 repair actions. | Done for repaired-area fixture |
| Area reconciliation | Modeled room polygons must reconcile to source area formulas. | `qa.area_reconciliation`, `area-reconciliation.json`, source area facts. | Source-vs-model room area report exists; target-house-3 has 29 rows all within tolerance. Formula/sloped-area basis extraction remains future hardening. | Done for repaired-area fixture |
| Existing stair | Current stair needed raw typed by-sketch bridge and still has integrity blockers. | `author.stair_by_sketch`, `author.stair_by_runs`, `author.stair_existing_condition`, `author.stair_vertical_package`. | Typed stair authoring and source-backed existing-condition tolerance exist; target-house-3 now has zero stair/integrity blockers. | Partial |
| Floor support | DG slab lacks support metadata. | `resolve.floor_supports`, `author.floor_supports`, support ids/metadata in floor payload. | Resolver and transactional support metadata update exist; target-house-3 clears the DG unsupported-slab integrity blocker. | Partial |
| Opening reconciliation | DG dormer window and elevation front-door facts must not remain uncovered. | `opening-reconciliation.json`, `resolve.opening_source_match`, `resolve.dormer_opening_host`. | Front-door elevation evidence is reconciled to modeled `op-eg-entry`; DG dormer-window fact is modeled via current wall-hosted path. True dormer-face/window authoring remains a tool-contract gap. | Done for repaired-area fixture / Partial for final fidelity |
| Roof/dormer precision | Dormer remains partly provisional; roof overhang semantics must be explicit. | `roof-dormer.json`, `resolve.roof_position_from_source_point`, `validate.roof_dormer_source_alignment`, `overhangSemantics`. | Roof overhang semantics now clear Advisor. Roof/dormer exact ridge/eave projection and overlay validation remain. | Partial |
| Site/toposolid | Site and toposolid relationship warnings must be resolved. | `site-terrain.json`, `site-topology-report.json`, terrain repair/tolerance. | Target-house-3 authors a site element and flat context toposolid from parcel evidence, clearing missing-site/toposolid warnings. Source-backed terrain contours remain future fidelity work. | Done for repaired-area fixture / Partial for terrain fidelity |
| Source overlay comparison | Current acceptance uses counts/QA, not visual source deviation. | `source.overlay_compare`, screenshots/deviation report. | Required to prove model matches floor plans/sections/elevations. | Not started |
| Finding dispositions | Errors/warnings must be fixed or explicitly tolerated before acceptance. | `finding-disposition-ledger.json`, `final-acceptance.json`. | Ledger now applies explicit reviewed decisions; target-house-3 has 0 unresolved blocking dispositions and final acceptance passes 7/7 gates. Automated disposition policy and overlay evidence remain. | Done for repaired-area fixture |

Current `target-house-3` state after the repaired-area Leo run:

- Folder output:
  - `folder-output-repaired-decisions` is `mcp_handoff_ready`.
  - It has 16 source documents, 68 rendered pages, 6 accepted reader packages,
    0 hard MCP blockers, 0 room-topology blockers, 0 conflict blockers, 0
    coordinate-frame blockers, and 0 site-terrain blockers.
  - The stricter room-topology and source-area gates now block missing
    circulation refs, missing visible room rows, and inconsistent level totals.
    Leo was repaired in `leo-reader-responses.repaired-area.json`.
- Model:
  - `target-house-3` builds transactionally with 3 levels, 24 walls, 35 room
    separations, 13 rooms, 12 doors, 2 windows, 1 stair, 1 slab opening, 1
    railing, 1 roof, 1 roof opening, 1 dormer, 1 site, 1 flat context
    toposolid, and 4 property lines.
  - Integrity is clean: 0 findings, 0 blocking findings.
  - Advisor/constructability have 18 warnings and 0 errors; all remaining
    warnings are explicitly reviewed/disposed.
  - Area reconciliation is clean: 29 rows, all within tolerance, 0 blocking rows.
  - Coverage is complete: 45 modeled or reconciled source facts, 0 blocking
    source facts.
  - Final acceptance is true: 7/7 gates pass.
- Seed inspection bridge:
  - `seed-artifacts/target-house-3/` packages the accepted diagnostic model for
    the existing seed-library loader.
  - `make seed name=target-house-3` loads model
    `9bb9a145-d9ce-5a2f-a748-bb5be3301b30` with 119 elements.
  - The packaged bundle uses deterministic `restoreElement` replay from the
    accepted document state; future reverse-BIM runs must still be driven from
    folder-output facts through MCP authoring, resolver, QA, and acceptance
    loops.

Remaining work is product hardening, not current Leo acceptance blocking:

- make the reader loop fresh-provider complete for new folders;
- add true dormer-face/window authoring;
- extract and author door operation/swing data where visible;
- add model/source overlay comparison;
- turn the Leo diagnostic builder into a reusable runner.

## Reusable Run Pattern For New Source Folders

The Leo benchmark shows the general methodology must be multi-pass, not a
single "read folder then model" step:

1. Build the immutable folder manifest and content hashes.
2. Classify documents and pages by role.
3. Render every page likely to contain geometry, photos/current condition,
   sections/elevations, site/legal facts, schedules, areas, volumes, drainage,
   and energy/material history. Do not stop at page one.
4. Generate an AI visual-trace work order split by evidence type:
   current-condition photos, dimensional floor plans, sections/elevations/roof,
   site/parcel/terrain, areas/volumes, and MEP/drainage.
5. Generate `source.ai_visual_trace_agent_requests` and dispatch those work
   packages to AI/subagent readers. They return facts only, never model
   mutations.
6. Validate returned facts with `source.validate_ai_facts` and
   `source.validate_ai_visual_trace_completeness` through
   `source.ai_visual_trace_agent_loop`. The loop first normalizes flexible
   AI/subagent output with
   `source.normalize_ai_visual_trace_reader_responses`.
7. Run `reverse_bim.mcp_readiness` on the normalized facts. Directly authorable
   facts may proceed to dry-run; resolver-needed facts must run query/resolve
   tools; source-refinement-needed facts must go back to AI reader repair; and
   metadata/reference facts must be retained for reconciliation and acceptance.
8. Only after facts are modelable, call `reverse_bim.plan_authoring` to map
   them to MCP tools such as `author.wall`, `author.wall_chain`,
   `opening.door_on_wall`, `opening.window_on_wall`,
   `author.roof_from_boundary`, stair/slab-opening tools, and site tools.
9. Author through dry-run/commit, then query/readback and QA after every phase.

This keeps the methodology reusable for arbitrary future folders while using
Leo as the calibration benchmark.

## Definition of Done for This Tracker

This tracker is complete only when an agent can run:

```text
source folder
  -> source manifest
  -> ExistingBuildingIR with provenance/conflicts
  -> phased MCP model authoring
  -> per-phase QA/evidence/disposition packets
  -> final source coverage matrix
  -> final accepted BIM model
```

without using legacy seed artifacts as truth and without accepting unresolved
Advisor/integrity/source mismatches by default.
