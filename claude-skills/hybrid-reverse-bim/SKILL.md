# Hybrid Reverse-BIM

Use this skill when the user gives a source folder for an existing building and
wants a faithful BIM model authored through MCP/live BIM software.

This is a runtime operating procedure. It is not a backlog, not a seed DSL, and
not a sketch-to-BIM workflow.

## Goal

Given a source folder containing plans, scans, sections, elevations, schedules,
site/topology/parcel documents, photos, energy/drainage/legal documents, and
related material, produce a source-faithful existing-building BIM model.

The source folder is the truth source. Seed artifacts are never truth. A seed or
export may be produced only after acceptance.

## Core Workflow

Use the hybrid method:

```text
global source preflight
  -> trusted source specification
  -> iterative MCP modeling slices
  -> readback / Advisor / constructability / integrity
  -> source-equivalent screenshots, overlays, and visual geometry parity
  -> repair or reopen source facts
  -> final acceptance
```

Do not model before the global preflight resolves the target building scope,
source authority, scale, coordinate frames, and source-required levels well
enough to avoid modeling the wrong building.

## Source Preflight

1. Build the folder manifest.
2. Render PDFs/images into source pages.
3. Extract native PDF text only as supplemental evidence.
4. Classify documents/pages by role.
5. Package source pages for multimodal AI/subagent reading.
6. Use `ai-reading/reader-dispatch.md` and `ai-reading/reader-pass-manifest.json`
   to dispatch reader assignments. Prefer the self-contained prompts under
   `ai-reading/assignments/**`.
   The default reader is a multimodal AI/subagent or human reviewer that reads
   the rendered page images visually. The reader may write concise Markdown
   notes, but the response must include a structured source-fact block before it
   can feed MCP modeling.
   Reader responses may be supplied directly, written as JSON under
   `ai-reading/responses/**`, or written as Markdown under the same response
   path with a fenced `json` source-fact object. Markdown without structured
   facts is preserved as reader notes but still requires a consolidation pass.
   If a `reader_command` is available, it may be used as an optional automation
   adapter; it receives request plus `assignmentId`, `readerPassId`, and
   `responsePathHint` metadata on stdin and returns one
   `sourceAiVisualTraceReaderResponse_v1` JSON object on stdout.
   Prefer `reverse_bim.reader_dispatch_plan` to inspect dispatchable
   assignments and `reverse_bim.reader_dispatch_execute` to write response JSON
   files under `ai-reading/responses/**`. Missing-input assignments are not
   dispatched; they require source packaging repair.
   The optional command `app/scripts/reverse_bim_openai_reader.py` can be used
   when `OPENAI_API_KEY` and `OPENAI_READER_MODEL` are set, but it is not the
   methodology and should not replace subagent reasoning when that is available.
7. Collect AI-reader responses as structured source facts.
8. Normalize and validate facts.
9. Run reader consensus for critical facts.
10. Resolve target building scope and context mask. If documents disagree
    between whole building, Doppelhaus, target half, or unit, record an explicit
    source-backed `buildingScopeDecisions` / `scopeDecisions` disposition. A
    target-half/unit decision is not enough by itself; it still needs a
    source-backed mask, polygon, or boundary reference before authoring.
11. Resolve levels/storeys, scale, origin, rotation, and coordinate frames.
12. Build the folder-output/trusted source specification.

If the source package is `source_packaging_ready` or
`source_understanding_blocked`, stop modeling and repair source understanding.

## Trusted Source Specification

Every modelable fact must have:

- `factId`;
- kind/subtype;
- level/storey or site context;
- metric geometry where required;
- source document, page, and region provenance;
- confidence;
- status;
- intended MCP tool or resolver;
- expected readback.

Every reader response should include `workPackageId`, `requestId`,
`readerPassId`, and independent reader identity metadata such as `readerId`,
`agentId`, `provider`, `model`, or `responseId`. Critical packages must have
independent agreement or an explicit deterministic disposition before modeling.
Reader consensus dispositions are allowed only when they include a decision,
reason, and source/cross-check evidence; they must not hide unresolved source
uncertainty.

Do not infer hidden geometry from prose alone. Prose/Markdown reader notes are
useful for understanding and repair, but MCP authoring uses the consolidated
source fact ledger. If a fact is not MCP-ready, run the required resolver,
request source repair/consolidation, or record a blocked/tolerated disposition.
Explicit `source_unavailable` facts are allowed only as source-limited
reference evidence with decision, reason, affected scope, and reviewed source
evidence. They must not become modeled geometry or hide missing values that are
required to author walls, rooms, openings, stairs, roofs, terrain, or schedules.

## Modeling Slices

Model in this order unless the source package says otherwise:

1. project setup, levels, origin, target scope, review views;
2. KG/basement;
3. EG/ground floor;
4. DG/upper floor;
5. vertical circulation, stairs, slab openings, railing;
6. roof, dormers, roof openings, elevations;
7. site, parcel, terrain/topology;
8. materials, assemblies, schedules, areas, volumes;
9. final evidence and acceptance.

For every slice:

1. Select the slice facts from the source specification.
2. Run MCP readiness.
3. Resolve levels, hosts, wall matches, loops, types, and roof positions.
4. Generate semantic MCP bundles.
5. Dry-run every mutation.
6. Commit only after dry-run passes.
7. Query the live model after commit.
8. Compare expected readback with live model readback.
9. Run Advisor, constructability, integrity, area/volume checks.
10. Create source-equivalent plan/elevation/section/site/3D views.
11. Capture screenshots and source overlays.
12. Inspect visual geometry parity: roof/wall joins, dormers, openings, stairs,
    rooms, terrain/toposolid, excavations, building pad, and parcel/site
    placement.
13. Disposition every finding.
14. Accept the slice only when source facts, model readback, QA, and visual
    geometry evidence agree.

When using `reverse_bim.hybrid_slice_execute` or `reverse_bim.hybrid_run_execute`,
pass the folder-output `outputDir` so source-revision ledgers are persisted under
`validation/` and future agents can resume repair work. Also pass
`sourcePageIndex` or `evidenceRequirements` whenever available; the executor
will emit the required `viewCapturePlan` and keep the slice blocked until the
matching UI screenshots and source overlays are supplied.

## Source-Spec Feedback Loop

The source specification is a controlled baseline, not immutable truth.

If modeling evidence shows that the source spec is wrong or incomplete, do not
manually bend the model around the bad spec. Classify the issue:

- `source_fact_misread`;
- `source_fact_underconstrained`;
- `coordinate_frame_wrong`;
- `mcp_payload_wrong`;
- `model_authoring_error`;
- `tool_gap`;
- `existing_condition`.

For source/spec problems, reopen the affected source facts, run a focused
AI-reader/source repair pass, regenerate the affected MCP handoff rows, and
rerun only the impacted slice.

For model-authoring problems, repair the live model and rerun readback/QA.

## Visual Geometry Gate

Advisor-clean is not acceptance. Every slice that changes visible geometry must
have source-equivalent screenshots or overlays, and those views must be checked
for defects that deterministic rules may miss.

The slice fails if screenshots show:

- walls visibly passing through a roof or stopping below it with a gap;
- roof, eave, ridge, dormer, or roof-window height/position mismatching the
  source view;
- doors/windows floating, duplicated, outside walls, or at wrong source-backed
  height;
- terrain/toposolid offset, mirrored, starting on the wrong side of the
  building, or missing the building-pad/excavation relationship;
- site/parcel placement inconsistent with the accepted coordinate frame;
- stair/opening/floor relationships that are visibly incoherent.

These failures are model/tool/source-spec defects, not acceptable existing
conditions. Fix the model, repair the source specification, or record a tool
gap and rerun the impacted slice. Existing-condition tolerances apply only to
source-backed nonconforming realities, not to visible authoring or renderer
errors.

## Existing-Condition Warnings

Advisor and constructability warnings block by default.

A warning may be tolerated only when it is a documented existing condition:

- severity is warning, not error;
- affected element ids are known;
- source facts and source page/region evidence support it;
- reason is explicit;
- reviewer/accepted-by is recorded;
- the final report exposes it.

Never tolerate fixable authoring errors such as unhosted openings, floating
objects, wrong stairs, empty source-required levels, roof-wall penetration,
terrain/site coordinate mismatch, or source-view mismatches.

## Final Acceptance

Do not accept the model unless:

- all source-required levels have real modeled content;
- floorplan topology matches the source plans;
- rooms and areas reconcile with source calculations;
- sections/elevations align;
- roof/dormers/openings match source views or have source-limited dispositions;
- roof surfaces meet supporting walls/eaves/ridge conditions without visible
  wall-through-roof penetrations or floating gaps;
- site/parcel/terrain, excavations, and building pad are source-backed or
  visibly source-limited and share the accepted building coordinate frame;
- no floating/unhosted elements remain;
- no doors/windows are outside walls;
- no assets/openings conflict with stairs;
- Advisor, constructability, and integrity have no unresolved errors;
- warnings are fixed or source-backed existing conditions;
- required screenshots and overlays exist;
- UI inspection and MCP query evidence agree.

## Preferred Tool Families

Use source tools for preflight:

- `source.folder_manifest`
- `source.render_pdf_pages`
- `source.ai_visual_trace_packet`
- `source.ai_visual_trace_work_order`
- `source.ai_visual_trace_agent_requests`
- `source.ai_visual_trace_reader_pass_manifest`
- `source.normalize_ai_visual_trace_reader_responses`
- `source.reader_consensus`
- `source.validate_ai_visual_trace_completeness`

Use reverse-BIM handoff/gates:

- `reverse_bim.folder_output`
- `reverse_bim.document_authority`
- `reverse_bim.coordinate_frame_worklist`
- `reverse_bim.coordinate_frame_alignment`
- `reverse_bim.source_building_scope`
- `reverse_bim.mcp_readiness`
- `reverse_bim.readback_compare`
- `reverse_bim.source_spec_revision`
- `reverse_bim.source_revision_ledger`
- `reverse_bim.source_revision_ledger_persist`
- `reverse_bim.handoff_regeneration`
- `reverse_bim.hybrid_slice`
- `reverse_bim.hybrid_slice_execute`
- `reverse_bim.hybrid_run`
- `reverse_bim.hybrid_run_execute`
- `reverse_bim.phase_packet`
- `reverse_bim.phase_run`
- `reverse_bim.final_acceptance`
- `reverse_bim.view_capture_plan`
- `reverse_bim.view_capture_execute` via `pnpm --filter @bim-ai/web reverse-bim:capture -- --plan <plan.json> --out <evidence-dir> --json`
- `reverse_bim.visual_review_requests`
- `reverse_bim.visual_review_normalize`

Use MCP authoring and query/resolve surfaces:

- `author.level`
- `author.wall`
- `author.wall_chain`
- `author.floor_from_boundary`
- `author.room_outline`
- `opening.door_on_wall`
- `opening.window_on_wall`
- `author.stair_between_levels`
- `opening.slab_opening`
- `author.roof_from_boundary`
- `author.dormer_on_roof`
- `query.elements`
- `query.levels`
- `query.views`
- `query.hosts`
- `query.enclosed_loops`
- `resolve.wall_by_line`
- `resolve.wall_opening_host`
- `resolve.opening_source_match`
- `resolve.roof_position_from_source_point`

Use QA/evidence after every slice:

- `qa.advisor`
- `qa.constructability`
- `qa.integrity_preflight`
- `qa.area_reconciliation`
- `reverse_bim.level_completeness`
- `reverse_bim.physical_topology`
- `reverse_bim.source_overlay_evidence`
- `reverse_bim.ui_evidence`

Raw bundles are fallback only when a first-class MCP authoring surface is
missing, and the fallback must be recorded as a tool gap.
