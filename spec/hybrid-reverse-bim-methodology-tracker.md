# Hybrid Reverse-BIM Methodology Tracker

Last updated: 2026-05-21

Status: **New controlling methodology tracker.** This supersedes the legacy
sketch-to-BIM/seed methodology for existing-building digitization and should be
used before any new Leo modeling run.

## Product Goal

Given a source folder such as:

```text
/Users/jhoetter/Desktop/Testhaeuser/Testhaus Leo
```

produce a faithful, detailed, inspectable existing-building BIM model through
MCP-backed live BIM authoring. The result must behave like the output of a
careful BIM technician, not like a plausible massing seed.

The source folder is the input. A seed artifact is not the source of truth and
is allowed only as an optional export/transport bridge after acceptance.

## Core Decision

The correct execution model is **hybrid**:

```text
Global source preflight first.
Then iterative source -> MCP authoring -> readback -> Advisor -> visual evidence
slices until the model is accepted.
```

Pure waterfall is too slow and hides geometry problems until late. Pure
floor-by-floor agile can create locally plausible floors that fail globally.
Hybrid is required because existing buildings have both:

- global facts that must be stable before modeling, such as target scope,
  levels, scale, coordinate frames, site orientation, and source authority;
- local facts that benefit from immediate BIM feedback, such as wall chains,
  openings, rooms, stairs, dormers, and source-view alignment.

## Human BIM Technician Reference Workflow

A competent human BIM modeler would not start by drawing a whole house from a
single impression. They would:

1. inventory all drawings, scans, photos, schedules, and legal/site documents;
2. decide which documents govern geometry, areas, heights, and current
   condition;
3. establish scale, origin, orientation, levels, and building target scope;
4. set up plan, section, elevation, and 3D review views before heavy modeling;
5. model one bounded slice at a time;
6. constantly compare the live BIM view to the source drawing view;
7. run checks after each slice;
8. distinguish fixable authoring mistakes from documented existing conditions;
9. keep an issue/disposition log;
10. accept the model only when it is traceable, inspectable, and clean.

The AI agent must follow the same discipline. MCP tools provide the hands.
AI/subagents read documents. Advisor, query/readback, constructability,
geometry integrity, and screenshots provide the feedback.

## Methodology Overview

```text
SOURCE FOLDER
  -> GLOBAL SOURCE PREFLIGHT
  -> TRUSTED SOURCE SPECIFICATION
  -> ITERATIVE MODELING SLICES
       -> source facts for slice
       -> MCP readiness
       -> MCP dry run
       -> MCP commit
       -> model readback
       -> Advisor / constructability / integrity
       -> source-view screenshots and overlays
       -> disposition / repair
           -> if source facts are disproved, return to source specification
  -> FINAL ACCEPTANCE
  -> OPTIONAL EXPORT / SEED
```

Modeling is not allowed before the global preflight resolves target scope,
levels, scale, coordinate frame, and source authority enough to avoid modeling
the wrong building.

The source specification is not frozen forever. It is a controlled baseline.
If live modeling proves that a source fact was misread, underconstrained, or
geometrically impossible, the workflow must return to source understanding,
revise the affected facts, update provenance/confidence/conflict disposition,
regenerate the affected MCP handoff rows, and rerun only the impacted slice.
The model must not be manually bent until it "looks right" while the source
specification remains wrong.

## Status Terms

| Status | Meaning |
| --- | --- |
| Done | Stable, tested, and usable now through API/MCP/CLI or a direct helper. |
| Partial | Some surface exists, but the hybrid workflow still needs glue, stricter contracts, or missing evidence. |
| Missing | Needs new implementation. |
| Legacy | Exists but must not be primary for reverse-BIM. |

## Global Preflight

This is the non-negotiable front gate. It is not full modeling. It answers:

- What exact building or building part is the target?
- Which source documents are authoritative for plans, sections, elevations,
  site, areas, volumes, and materials?
- Which levels/storeys exist?
- What scale, origin, rotation, and coordinate frames apply?
- Are we modeling one half of a duplex, the whole building, one unit, or
  context geometry?
- Which facts are visible, inferred, conflicting, or unavailable?
- Which source pages must later have matching BIM views/screenshots?

### Global Preflight Tracker

| ID | Requirement | Existing repo support | Status | Required build or decision |
| --- | --- | --- | --- | --- |
| GPF-001 | Create immutable folder manifest with file hashes and metadata. | `source.folder_manifest` | Partial | Persist source registry per run/project; include stable document ids independent of local paths. |
| GPF-002 | Render PDFs/images into AI-readable page images. | `source.render_pdf_pages`, `source.prepare_ai_visual_trace_run` | Partial | Persist page index with DPI, page size, crop, rotation, and source-page ids. |
| GPF-003 | Extract native text only as supplemental evidence, not OCR primary. | `source.extract_text` | Partial | Keep text supplemental; add page-coordinate text boxes later when available. |
| GPF-004 | Classify documents/pages by role: floor plan, section, elevation, site, calculation, photo, legal, energy, drainage. | `source.classify_documents`, `reverse_bim.document_authority` | Partial | Page-level AI classification is still needed; document-level authority/supersession is now deterministic. |
| GPF-005 | Package source pages for multimodal AI/subagent reading. | `source.ai_reading_packet`, `source.ai_visual_trace_packet`, `source.ai_visual_trace_work_order`, `source.ai_visual_trace_agent_requests` | Partial | Keep provider-neutral; add first-class "reader pass" orchestration for multiple independent readers. |
| GPF-006 | Normalize AI-reader responses into strict source facts. | `source.normalize_ai_visual_trace_reader_responses`, `source.validate_ai_facts` | Partial | Enforce fact schemas by phase and reject prose-only source understanding. |
| GPF-007 | Require reader consensus for critical facts. | `source.reader_consensus` | Partial | Define critical fact classes and minimum reader count by phase. |
| GPF-008 | Resolve target building scope and target/context mask. | `reverse_bim.source_building_scope` | Partial | Add stronger mask geometry contract and UI/source overlay evidence for target scope. |
| GPF-009 | Establish page-to-model coordinate frames. | Underlay transforms exist; `coordinate-frame-worklist` exists in folder output. | Partial | Implement first-class source coordinate frame resource and alignment validation. |
| GPF-010 | Establish levels/storeys before modeling. | `author.level`, `query.levels`, `reverse_bim.source_level_completeness` | Partial | Add global level consensus from plans, sections, elevations, and schedules. |
| GPF-011 | Produce a trusted source specification. | `reverse_bim.folder_output`, ExistingBuildingIR seed/validate | Partial | Expand IR schema for all modelable object types and conflict decisions. |
| GPF-012 | Block modeling if required source facts are incomplete. | `source.validate_ai_visual_trace_completeness`, `reverse_bim.mcp_readiness` | Partial | Make the hybrid runner enforce this before any live authoring. |
| GPF-013 | Rank authoritative/superseded source documents before fact handoff. | `reverse_bim.document_authority` | Done | Critical document groups with unresolved authority ties block source preflight. |

## Trusted Source Specification

The source specification is the handoff from document understanding to modeling.
It must be precise enough that the modeling agent does not invent hidden
geometry.

Required artifacts:

- `source/document-registry.json`
- `source/source-page-index.json`
- `ai-reading/reader-responses.normalized.json`
- `understanding/source-fact-ledger.json`
- `understanding/conflict-ledger.json`
- `understanding/coordinate-frames.json`
- `understanding/existing-building-ir.json`
- `mcp-handoff/mcp-readiness.json`
- `mcp-handoff/phase-authoring-spec.json`
- `mcp-handoff/tolerance-policy.json`
- `validation/package-acceptance-report.json`

### Fact Requirements

Every modelable fact must include:

- stable `factId`;
- kind and subtype;
- level/storey or site context;
- metric geometry where required;
- source document id, page, and region;
- confidence;
- status: `candidate`, `accepted`, `conflicting`, `rejected`, `superseded`,
  `modeled`, or `deferred`;
- modeling phase or slice;
- required MCP tool or resolver;
- expected readback after authoring.

### Source Specification Tracker

| ID | Requirement | Existing repo support | Status | Required build or decision |
| --- | --- | --- | --- | --- |
| SPEC-001 | Canonical source fact ledger. | Folder output writes source fact ledger. | Partial | Tighten schemas by fact kind: wall, room, opening, stair, roof, terrain, parcel, material. |
| SPEC-002 | Existing-building IR separate from seed DSL. | `reverse_bim.ir_seed`, `reverse_bim.ir_validate` | Partial | Expand IR to include wall graphs, host references, source-view requirements, and unresolved decisions. |
| SPEC-003 | Conflict ledger with explicit dispositions. | Folder output conflict reports/worklist. | Partial | Make unresolved conflict dispositions block slice authoring automatically. |
| SPEC-004 | MCP-readiness mapping. | `reverse_bim.mcp_readiness`, `reverse_bim.plan_authoring` | Partial | Add per-slice readiness and stricter "no hidden inference" enforcement. |
| SPEC-005 | Source coverage matrix. | `reverse_bim.source_coverage` | Partial | Connect coverage to live element metadata after commits. |
| SPEC-006 | Expected readback per action. | `reverse_bim.plan_authoring` emits expected readback; `reverse_bim.readback_compare` compares expected rows with live query/readback evidence. | Done | Keep extending field-level comparisons as new element categories need stricter checks. |
| SPEC-007 | Source-view requirements. | `reverse_bim.evidence_requirements` | Partial | Include exact plan/elevation/section/site views required for each source page. |
| SPEC-008 | Tolerance policy. | Folder output tolerance policy; phase packet supports source-backed existing nonconformance. | Partial | Expand policy into blocking categories and existing-condition exception categories. |
| SPEC-009 | Source-spec revision loop. | `reverse_bim.source_spec_revision` classifies readback/overlay/Advisor feedback into source fact repair, coordinate-frame repair, MCP payload repair, tool gap, model-authoring error, or existing-condition disposition. | Partial | Add persisted revision ledger that updates fact confidence/disposition and regenerates affected MCP handoff rows. |

## Iterative Modeling Slices

After global preflight, modeling proceeds in slices. A slice is accepted only
when its source facts, live model readback, Advisor findings, and visual
evidence agree.

Recommended slice order:

| Slice | Purpose | Leo meaning | May start when |
| --- | --- | --- | --- |
| S0 Project setup | Empty live model, levels, units, origin, target scope, plan/elevation/section review views. | Create KG, EG, DG/roof reference levels only after Leo levels are source-backed. | Global preflight accepted. |
| S1 KG/basement | Basement/cellar walls, slab, rooms, openings, stair interface. | KG must not be empty as in failed target-house-3. | KG facts and coordinate frame are modelable. |
| S2 EG | Ground floor exterior/interior walls, rooms, openings, floor slab. | Reconstruct EG topology and room areas, not just envelope. | EG plan facts and target scope mask are modelable. |
| S3 DG/upper level | Upper floor walls, rooms, openings, floor. | Reconstruct DG plan and area reductions where source indicates roof slopes. | DG plan facts and vertical alignment are modelable. |
| S4 Vertical circulation | Stairs, slab openings, railing, headroom, inter-level alignment. | Stair must align across KG/EG/DG and not clash with walls/slabs. | Adjacent levels and stair source facts are ready. |
| S5 Roof/dormers/elevations | Roof footprint, pitch, eaves/ridge, dormers, roof openings, elevation alignment. | Use Leo outside views/elevations as source evidence, not a generic roof. | Elevation/section facts and roof host facts are ready. |
| S6 Site/parcel/terrain | Property lines, topography/toposolid, building placement, drainage/context. | House must be correctly placed on source site/topology, not centered on a flat placeholder. | Site/parcel docs have coordinate frame or explicit source-limited disposition. |
| S7 Materials/history/schedules | Assemblies, wall thicknesses, construction year, renovations, areas, volumes. | Room areas and Wohnflaeche/Umbauter Raum reconcile to source calculations. | Geometry is stable enough for schedules. |
| S8 Final evidence | Full Advisor, constructability, integrity, source overlays, screenshots, final report. | Leo can be inspected in UI and via MCP with equivalent information. | All previous slices accepted. |

## Per-Slice Loop

Every slice uses the same loop:

```text
1. Select slice and source facts.
2. Validate source facts and conflicts.
3. Run MCP readiness.
4. Resolve hosts/levels/types/loops through query/resolve tools.
5. Generate semantic MCP bundle.
6. Dry-run bundle.
7. Commit bundle.
8. Query live model readback.
9. Run Advisor, constructability, integrity, area/source checks.
10. Create source-equivalent views.
11. Capture screenshots and source overlays.
12. Disposition every finding.
13. If the finding is a model-authoring error, repair the model.
14. If the finding disproves or weakens a source fact, reopen the source
    specification, repair the fact, regenerate the affected handoff rows, and
    rerun the slice.
15. Accept the slice only after source facts, model readback, QA, and visual
    evidence agree.
```

### Per-Slice Tracker

| ID | Requirement | Existing repo support | Status | Required build or decision |
| --- | --- | --- | --- | --- |
| LOOP-001 | Slice runner that accepts phase authoring spec and executes only unblocked facts. | `reverse_bim.hybrid_slice` and `reverse_bim.hybrid_run` now provide deterministic state reports, but do not execute transactions. | Partial | Build a live executor that performs dry-run, commit, query, QA, screenshots, and packet creation. |
| LOOP-002 | Dry-run before commit for every mutation. | `model.dry_run`, command bundle dry-run path. | Done | Make this mandatory in runner. |
| LOOP-003 | Commit through transactional MCP/API only. | `model.commit_bundle`, `/api/models/{model_id}/bundles`. | Done | Prohibit seed/raw direct writes except recorded fallback. |
| LOOP-004 | Query after commit. | `model.summary`, `query.elements`, `query.levels`, `query.views`, `query.hosts`, `query.enclosed_loops`, plus `reverse_bim.readback_compare`. | Done | Runtime runner must call query surfaces and feed results into the comparator after every commit. |
| LOOP-005 | Advisor after every slice. | `qa.advisor`, Advisor UI. | Done | Phase packet must capture complete findings, not only counts. |
| LOOP-006 | Constructability after every slice. | `qa.constructability`. | Done | Add reverse-BIM profile tuned for existing buildings. |
| LOOP-007 | Integrity after every slice. | `qa.integrity_preflight`, domain integrity checks. | Done | Include hosted openings, floors/stairs, room topology, site georeferencing. |
| LOOP-008 | Area/volume reconciliation. | `qa.area_reconciliation`, schedule tools. | Partial | Add volume reconciliation and source schedule binding per level/half/building. |
| LOOP-009 | Physical topology gate. | `reverse_bim.physical_topology`, `qa.physical_topology`, room boundary resolvers. | Partial | Expand to require real walls/openings/stairs, not analytical-only room graphs. |
| LOOP-010 | Source overlay evidence. | `reverse_bim.source_overlay_evidence`, `qa.source_overlay_compare`. | Partial | Build automatic overlay generation from model views and source page transforms. |
| LOOP-011 | UI screenshot evidence. | `reverse_bim.ui_evidence` validates screenshot metadata. Visual evidence test scripts exist. | Partial | Add stable MCP/API/browser capture command for plan/elevation/section/3D screenshots. |
| LOOP-012 | Finding dispositions. | `reverse_bim.phase_packet` with dispositions. | Partial | Enforce source-backed existing-condition policy and block fixable authoring errors. |
| LOOP-013 | Repair loop. | AI-reader repair requests exist; `reverse_bim.source_spec_revision` maps modeling feedback to source repair, resolver/payload repair, model repair, tool gap, or existing-condition candidate. | Partial | Persist repair worklists and connect them to automated rerun of impacted slices. |
| LOOP-014 | Modeling-to-source feedback loop. | `reverse_bim.source_spec_revision` classifies contradictions as `source_fact_misread`, `source_fact_underconstrained`, `coordinate_frame_wrong`, `mcp_payload_wrong`, `tool_gap`, `model_authoring_error`, `missing_evidence`, or `existing_condition`. | Partial | Persist reopened facts and regenerate affected MCP handoff rows automatically. |

## MCP Authoring Surface Matrix

The methodology must use existing MCP/API authoring surfaces wherever they
exist. Raw bundles are fallback only and must be recorded as a gap.

| Object/operation | Preferred tool surface | Current status | Notes/gaps |
| --- | --- | --- | --- |
| Levels/storeys | `author.level`, `query.levels`, `resolve.active_or_default_level` | Done | Needs stronger global level consensus from source docs. |
| Exterior/interior walls | `author.wall`, `author.wall_chain`, `resolve.wall_by_line` | Done | Need source fact refs on created walls and readback comparator. |
| Floors/slabs | `author.floor_from_boundary`, `resolve.loop_for_boundary`, `resolve.floor_supports` | Partial | Need slab opening coordination and support metadata enforcement. |
| Rooms | `author.room_outline`, `author.room_separation`, `resolve.room_boundary_edges` | Partial | Must reject analytical-only room topology unless source explicitly says open-plan boundary. |
| Doors/windows | `opening.door_on_wall`, `opening.window_on_wall`, `resolve.wall_opening_host`, `resolve.opening_source_match` | Partial | Need mandatory host/readback validation and no duplicate opening creation. |
| Stairs | `author.stair_between_levels`, `author.stair_by_runs`, `author.stair_by_sketch` | Partial | Existing-house stairs often need by-sketch source facts, slab openings, headroom checks. |
| Stair/slab openings | `opening.slab_opening`, `opening.shaft_opening` | Partial | Need automatic stair-to-opening consistency gate. |
| Railings | `author.railing` | Done | Need source/condition metadata for existing railings if visible. |
| Roofs | `author.roof_from_boundary` | Partial | Roof geometry currently may be simplified; source elevations/sections must validate. |
| Dormers | `author.dormer_on_roof`, `resolve.roof_position_from_source_point`, `resolve.dormer_opening_host` | Partial | Need stronger dormer face/window host model and elevation overlay. |
| Roof openings | `opening.roof_opening` | Partial | Need source-backed structural/curb review or accepted existing-condition note. |
| Terrain/toposolid | `toposolid-create`, site tools | Partial | Need source coordinate frame and source-limited terrain policy. |
| Parcel/property lines | `site.property-line-create` | Partial | Need legal/site document extraction and georeferencing. |
| Materials/assemblies | `reverse_bim.source_material_assemblies`, type/material query tools | Partial | Need typed layer-stack authoring and source-unavailable dispositions. |
| Schedules | schedule derivation/query/export surfaces | Partial | Need reverse-BIM schedule reconciliation against source calculations. |
| Views | `author.plan_view`, `save_3d_view`, view/query/sheet tools | Partial | Need exact source-equivalent elevation/section/cutaway view setup. |
| Screenshots | UI/Playwright evidence scripts, `reverse_bim.ui_evidence` validator | Partial | Need first-class capture surface, not ad hoc screenshots. |

## Required Review Views

The agent must create or resolve views that match the source documents.

Minimum view set for a house:

- plan view for every source level/storey;
- basement/cellar plan if source has KG/cellar;
- front elevation;
- rear elevation;
- left elevation;
- right elevation;
- at least one longitudinal section through stair/roof;
- at least one transverse section through roof/dormer;
- 3D overview;
- 3D cutaway showing stairs/floors/openings;
- site/parcel/topology plan;
- schedule views for rooms, openings, areas, volumes, and materials.

### View/Screenshot Tracker

| ID | Requirement | Existing repo support | Status | Required build or decision |
| --- | --- | --- | --- | --- |
| VIEW-001 | Source-equivalent plan views for each level. | Plan view authoring/query exists. | Partial | Add source-page binding, crop, scale, and screenshot requirement per level. |
| VIEW-002 | Source-equivalent elevation views. | Cardinal elevation helper exists; elevation view UI exists. | Partial | Add first-class author/query/update elevation view MCP contract if not already stable. |
| VIEW-003 | Source-equivalent section views. | Section/sheet infrastructure exists. | Partial | Add reverse-BIM section placement from source section marks or inferred review cuts. |
| VIEW-004 | 3D/cutaway review views. | `save_3d_view`, 3D viewer, clipping controls. | Partial | Add deterministic camera presets for reverse-BIM review and screenshot capture. |
| VIEW-005 | Live screenshot capture. | Visual evidence scripts exist; validator exists. | Partial | Build official `capture.view_screenshot` MCP/API/CLI surface or documented Playwright runner. |
| VIEW-006 | Overlay source page on model view. | Underlay and overlay evidence validators exist. | Partial | Build generated overlay image and numeric deviation report. |
| VIEW-007 | Human-visible checklist. | `reverse_bim.ui_evidence` supports checklist validation. | Partial | Add required checklist items per view kind and block on failed visual checks. |

## Advisor And Existing-Condition Policy

Advisor findings are diagnostic evidence. In new-building workflows, many
warnings should be fixed to meet norms. In reverse-BIM, some warnings may be
true existing conditions, especially in older buildings.

Therefore:

- Errors always block.
- Warnings block by default.
- A warning may be accepted only as `existing_nonconforming_source_backed` when
  it is a documented existing condition.
- A tolerance may never hide a fixable authoring error.

### Source-Backed Existing Condition Requirements

A tolerated existing-condition warning must include:

- finding id/rule id;
- source: Advisor, constructability, or integrity;
- severity: warning only;
- affected element ids;
- source fact ids;
- source document/page/region evidence;
- reason;
- accepted by/reviewer;
- date/time;
- whether it affects final use, cost, code review, or renovation planning;
- final report visibility.

Examples that may be tolerated if source-backed:

- steep or narrow existing stair in a historical house;
- low headroom documented by source section;
- nonstandard wall thickness from old construction;
- unusual opening clearance shown in as-built plan;
- terrain/source limitation where no numeric contours are available.

Examples that may not be tolerated:

- floating/unhosted doors or windows;
- doors/windows outside walls;
- stair hard clash caused by wrong modeling;
- missing KG/basement when source has KG;
- room placeholders not bounded by physical topology;
- generic flat terrain when source has site/topology facts;
- source-view mismatch caused by wrong scale/origin;
- unresolved Advisor errors.

### Advisor Policy Tracker

| ID | Requirement | Existing repo support | Status | Required build or decision |
| --- | --- | --- | --- | --- |
| ADV-001 | Phase packet records every Advisor/constructability/integrity finding. | `reverse_bim.phase_packet` | Partial | Ensure live runner passes complete reports and not only summaries. |
| ADV-002 | Source-backed existing-condition dispositions. | `existing_nonconforming_source_backed` support exists in `reverse_bim.phase_packet`. | Partial | Add user-visible final report section and per-finding UI indicator. |
| ADV-003 | Fixable authoring error policy. | Tolerance policy partially exists. | Partial | Enumerate non-tolerable reverse-BIM categories and enforce them in final acceptance. |
| ADV-004 | Existing-building Advisor profile. | `qa.advisor` supports profiles; constructability exists. | Partial | Add/review profile that warns without forcing modern DIN-like correction when source proves existing state. |
| ADV-005 | Disposition repair loop. | `reverse_bim.source_spec_revision` maps findings to model repair, source repair, coordinate-frame repair, tool gap, missing evidence, or existing-condition candidate. | Partial | Connect mapped actions to persisted disposition/revision ledgers and runtime reruns. |

## Final Acceptance

The final model is accepted only when all of these are true:

- Every source-required level has real modeled content.
- Floorplan topology matches source plans, not only envelope/massing.
- Room areas reconcile with source area calculations within declared tolerance.
- Volumes reconcile with source volume calculations where available.
- Sections and elevations align to source evidence.
- Roof/dormers/openings match source views or are explicitly source-limited.
- Terrain/site/parcel placement is source-backed or source-limited with a
  visible disposition.
- No floating or unhosted elements exist.
- No doors/windows are outside walls.
- No assets/furniture/openings occupy stairs.
- No analytical room placeholders are accepted as physical topology.
- Advisor, constructability, and integrity have no unresolved errors.
- Warnings are either fixed or source-backed existing conditions.
- Required screenshots and overlays exist for plan/elevation/section/3D/site.
- UI inspection and MCP query return equivalent information.
- The final evidence package includes source facts, model element refs,
  dispositions, screenshots, overlays, schedules, and final acceptance result.

### Final Acceptance Tracker

| ID | Requirement | Existing repo support | Status | Required build or decision |
| --- | --- | --- | --- | --- |
| ACC-001 | Level completeness gate. | `reverse_bim.level_completeness` | Partial | Tie directly to source-required levels and live model summary. |
| ACC-002 | Physical topology gate. | `reverse_bim.physical_topology` | Partial | Expand coverage for stairs, openings, room boundaries, and assets. |
| ACC-003 | Source overlay evidence gate. | `reverse_bim.source_overlay_evidence`, `qa.source_overlay_compare` | Partial | Build automatic generation of overlay inputs from captured views. |
| ACC-004 | UI screenshot evidence gate. | `reverse_bim.ui_evidence` | Partial | Add official screenshot capture and required visual checklist per view. |
| ACC-005 | Source coverage gate. | `reverse_bim.source_coverage`; hybrid readback/source revision reports preserve `sourceFactIds` in evidence. | Partial | Populate fact-to-element refs during live authoring. |
| ACC-006 | Advisor final gate. | `qa.advisor`, `reverse_bim.final_acceptance`; source-backed warning policy is enforced in phase/final gates. | Done | Keep expanding non-tolerable authoring categories as Advisor grows. |
| ACC-007 | Constructability/integrity final gate. | `qa.constructability`, `qa.integrity_preflight` | Partial | Enforce non-tolerable authoring error categories. |
| ACC-008 | Schedule reconciliation gate. | Area reconciliation exists; schedule derivation exists. | Partial | Add final room/area/volume/material schedule comparison package. |
| ACC-009 | Final acceptance package. | `reverse_bim.final_acceptance`, evidence package surfaces. | Partial | Produce one operator-readable and machine-readable package. |

## Leo End-To-End Validation Plan

Leo is a concrete instance used to prove the methodology, not hardcoded
software behavior.

The fresh Leo run must:

1. ignore existing `target-house-3` seed artifacts as truth;
2. start from the source folder;
3. generate a fresh global source preflight package;
4. dispatch/collect AI-reader facts for every relevant source page;
5. block until building scope, levels, coordinate frames, and source authority
   are resolved;
6. model only MCP-ready slices;
7. create source-equivalent views and screenshots after each slice;
8. compare plan/elevation/section/site screenshots to source pages;
9. run Advisor/constructability/integrity after each slice;
10. repair every authoring issue;
11. record any true existing-condition warnings with source-backed tolerance;
12. accept only when final evidence passes.

### Leo-Specific Success Conditions

The Leo showcase is successful only if:

- KG is modeled if KG/cellar is present in sources;
- EG and DG topology match the source plans;
- wall thicknesses are source-backed, not generic;
- rooms and room areas reconcile with the source area calculation;
- stair geometry, slab openings, and headroom are physically coherent;
- roof pitch, eaves, dormers, and facade openings align to the outside views;
- site/parcel/topology are modeled or explicitly source-limited;
- final Advisor errors are zero;
- remaining warnings, if any, are source-backed existing conditions;
- the model can be inspected through both UI screenshots and MCP query output.

## Implementation Waves

### Wave 1: Hybrid Tracker And Runner Contract

| ID | Work item | Current status | Done criteria |
| --- | --- | --- | --- |
| W1-001 | Adopt this tracker as controlling methodology. | Done by this file. | Other reverse-BIM trackers point here or are clearly subordinate. |
| W1-002 | Define `hybrid_reverse_bim.run` contract. | Partial | `reverse_bim.hybrid_run` aggregates source package, phase-run, and slice reports; live transaction execution still needs a runner. |
| W1-003 | Define per-slice state machine. | Done | `reverse_bim.hybrid_slice` reports source-blocked, MCP-ready, source-revision-required, tool-gap-blocked, readback-blocked, QA-blocked, visual-blocked, or accepted. |
| W1-004 | Define source-backed existing-condition policy in final acceptance. | Done | Policy is encoded in phase and final acceptance gates; warnings require source-backed existing-condition evidence. |
| W1-005 | Create runtime `SKILL.md`. | Done | `claude-skills/hybrid-reverse-bim/SKILL.md` describes the runtime operating procedure for future agents. |
| W1-006 | Test runtime skill against Leo end-to-end. | Not started | Requires the live runner, screenshot/overlay capture, and fresh Leo source package. |

### Wave 2: Source Specification Hardening

| ID | Work item | Current status | Done criteria |
| --- | --- | --- | --- |
| W2-001 | Strengthen source fact schemas by object type. | Partial | Invalid/missing wall, opening, stair, roof, terrain, parcel facts fail before modeling. |
| W2-002 | Add coordinate-frame resource and alignment report. | Partial | Every source page used for geometry has scale, origin, rotation, and level/site binding. |
| W2-003 | Add critical reader consensus policy. | Partial | Critical facts require independent agreement or explicit conflict disposition. |
| W2-004 | Add document authority/supersession report. | Done | `reverse_bim.document_authority` ranks document groups, marks superseded/duplicate documents, and blocks unresolved critical authority ties. |

### Wave 3: Live MCP Slice Authoring

| ID | Work item | Current status | Done criteria |
| --- | --- | --- | --- |
| W3-001 | Build runner that executes phase authoring spec transactionally. | Partial | State/report contracts exist; live dry-run/commit/query/QA executor remains. |
| W3-002 | Build readback comparator. | Done | `reverse_bim.readback_compare` checks expected readback rows against explicit readback rows or queried elements. |
| W3-003 | Attach source fact refs to modeled elements. | Partial | `sourceFactIds` or equivalent survive query, schedule, and evidence export. |
| W3-004 | Build structured repair worklist from QA/readback findings. | Partial | `reverse_bim.source_spec_revision` classifies actions; persistence and automatic rerun are still needed. |

### Wave 4: Visual Evidence And Source Views

| ID | Work item | Current status | Done criteria |
| --- | --- | --- | --- |
| W4-001 | Create source-equivalent plan/elevation/section/site views. | Partial | Views are derived from source-page roles and coordinate frames. |
| W4-002 | Add official screenshot capture. | Partial | Agent can capture required live views without manual UI screenshots. |
| W4-003 | Generate overlay comparison payloads. | Partial | Source page and model screenshot are compared with numeric deviation and visual artifact. |
| W4-004 | Enforce visual checklist. | Partial | Human-visible failures like empty KG or incoherent stairs block acceptance. |

### Wave 5: Leo Fresh Run

| ID | Work item | Current status | Done criteria |
| --- | --- | --- | --- |
| W5-001 | Run fresh Leo source preflight from folder. | Not started for new hybrid method. | Fresh output package exists and does not rely on target-house-3. |
| W5-002 | Repair Leo source understanding until handoff-ready or explicitly blocked. | Not started for new hybrid method. | Building scope, levels, frames, roof/dormer, site, and materials have dispositions. |
| W5-003 | Model Leo slices through MCP. | Not started for new hybrid method. | Each slice has phase packet, screenshots, overlays, and accepted QA. |
| W5-004 | Final Leo acceptance. | Not started for new hybrid method. | UI/MCP evidence proves source-faithful model; optional seed/export created only after pass. |

## Non-Goals And Guardrails

- Do not resurrect deterministic CV image tracing as the primary reader.
- Do not use seed DSL as the primary modeling abstraction.
- Do not hardcode Leo facts into product code.
- Do not accept element counts as proof of correctness.
- Do not tolerate fixable authoring errors as existing conditions.
- Do not move to final acceptance without source-equivalent visual evidence.

## Current Position

Current methodology status:

```text
Tracker: active BUILDING backlog.
Implementation: partial surfaces exist across source packaging, document
authority, MCP authoring, query/resolve, QA, phase packets, readback comparison,
source-spec revision classification, hybrid slice/run state reporting, runtime
skill guidance, and acceptance validation.
Missing critical glue: live hybrid executor, persisted source-spec revision
ledger, source-coordinate alignment resource, official screenshot capture,
automatic overlays, and Leo fresh-run evidence.
```

The next correct action is not to seed another model. It is to implement the
live hybrid executor and evidence capture pieces, then run Leo fresh from the
source folder through the global preflight and slice gates.
