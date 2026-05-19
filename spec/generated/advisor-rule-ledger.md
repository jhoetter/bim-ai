# Advisor Rule Ledger

Generated from `app/bim_ai/advisor_rule_registry.py`.

| Rule ID | Severity | Policy | Layer | Discipline | Profiles | Surfaces | Suppressibility | Actionability | Status | Tracker |
| ------- | -------- | ------ | ----- | ---------- | -------- | -------- | --------------- | ------------- | ------ | ------- |
| `bim_invariant_failure` | error | p0_integrity_error | model_integrity | platform | `model_integrity`, `construction_readiness`, `agent_preflight` | `ui`, `api`, `cli`, `mcp`, `docs` | not_suppressible | modeled_fix_required | planned | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-P01` |
| `host_wall_outside_envelope` | error | p0_integrity_error | model_integrity | architecture | `model_integrity`, `architecture`, `construction_readiness`, `agent_preflight` | `ui`, `api`, `cli`, `mcp`, `docs` | tolerable_with_evidence | modeled_fix_required | planned | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-C02` |
| `hosted_door_not_embedded` | error | p0_integrity_error | model_integrity | architecture | `model_integrity`, `architecture`, `construction_readiness`, `agent_preflight` | `ui`, `api`, `cli`, `mcp`, `docs` | not_suppressible | quick_fix_available | planned | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-C01` |
| `physical_helper_leakage` | error | p0_integrity_error | model_integrity | coordination | `model_integrity`, `coordination`, `construction_readiness`, `agent_preflight` | `ui`, `api`, `cli`, `mcp`, `docs` | not_suppressible | quick_fix_available | planned | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-B03` |
| `renderer_unsupported_cut` | error | p0_renderer_fidelity_error | renderer_diagnostics | renderer | `renderer_fidelity`, `construction_readiness`, `sketch_acceptance` | `ui`, `api`, `cli`, `mcp`, `docs` | tolerable_with_evidence | implementation_or_view_change_required | planned | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-I01`, `BIR-M04` |
| `sketch_evidence_stale` | error | p0_sketch_acceptance_error | sketch_acceptance | sketch | `sketch_acceptance`, `agent_preflight` | `ui`, `api`, `cli`, `mcp`, `docs` | not_suppressible | evidence_regeneration_required | planned | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-T04` |

## Rule Details

### `bim_invariant_failure`

**Title:** BIM Document Invariant Failure

**UI summary:** The model contains an invalid document invariant.

**Source layer:** model_integrity

**Severity policy:** p0_integrity_error

**Surfaces:** ui, api, cli, mcp, docs

**Status:** planned

**Recommendation:** Repair the invalid document state before continuing; rerun the command bundle after ids, levels, units, type references, and deleted references are consistent.

**Documentation:** Generic guardrail for always-true document invariants such as unique ids, valid level/type references, valid units, valid physical-role declarations, and no stale references to deleted elements.

**Examples:** Duplicate ids, stale references, or invalid physical-role declarations.

**Affected ids:** element, level, type, document

**Fix command hints:** repairReferences, normalizeDocument, rollbackTransaction

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs

### `host_wall_outside_envelope`

**Title:** Physical Host Wall Outside Building Envelope

**UI summary:** A physical wall is outside the supported building envelope.

**Source layer:** model_integrity

**Severity policy:** p0_integrity_error

**Surfaces:** ui, api, cli, mcp, docs

**Status:** planned

**Recommendation:** Move the wall into the level floor/building envelope, attach it to an explicit exterior support condition, or mark it as a documented detached condition.

**Documentation:** Physical walls on a storey must align with a floor, room boundary, envelope, or explicit detached/exterior condition. Hosted children inherit this error when their host wall is out of context.

**Examples:** A wall and its hosted openings sit outside the active floor/envelope.

**Affected ids:** wall, door, window, floor, level

**Fix command hints:** moveWallIntoEnvelope, addDetachedCondition, convertToAnalysis

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs

### `hosted_door_not_embedded`

**Title:** Hosted Door Not Embedded In Real Wall

**UI summary:** A hosted door is not embedded in a valid physical wall.

**Source layer:** model_integrity

**Severity policy:** p0_integrity_error

**Surfaces:** ui, api, cli, mcp, docs

**Status:** planned

**Recommendation:** Rehost the door to a physical architectural wall inside the building envelope, or convert the access artifact to a nonphysical analysis object.

**Documentation:** A door may have a syntactically valid wall reference while still being invalid because the host is nonphysical, analysis-only, outside the level floor, too short, or not part of a room/building boundary.

**Examples:** A door references a wall that is analysis-only, outside context, or too short.

**Affected ids:** door, wall, level, floor

**Fix command hints:** rehostDoor, moveWallIntoEnvelope, convertToAnalysis

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs

### `physical_helper_leakage`

**Title:** Physical Helper Or Analysis Element Leakage

**UI summary:** A helper or analysis element leaked into the physical BIM model.

**Source layer:** model_integrity

**Severity policy:** p0_integrity_error

**Surfaces:** ui, api, cli, mcp, docs

**Status:** planned

**Recommendation:** Mark helper/access/diagnostic geometry as nonphysical and hidden from normal BIM surfaces, or replace it with authored physical building elements.

**Documentation:** Access-graph, room-closure, diagnostic, sketch, and other helper entities must not appear as visible physical BIM, schedules, exports, or valid hosts unless they have been explicitly promoted to a real element category.

**Examples:** Room-closure or access-graph helper geometry appears as physical BIM.

**Affected ids:** element, wall, door, room, analysis_object

**Fix command hints:** convertToAnalysis, hideHelper, deleteElement, promotePhysicalElement

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs

### `renderer_unsupported_cut`

**Title:** Renderer Unsupported Or Failed Geometry Cut

**UI summary:** The renderer cannot faithfully display a required geometry cut.

**Source layer:** renderer_diagnostics

**Severity policy:** p0_renderer_fidelity_error

**Surfaces:** ui, api, cli, mcp, docs

**Status:** planned

**Recommendation:** Add renderer support or fallback diagnostics for the requested cut before using the viewport, screenshot evidence, or export preview as acceptance evidence.

**Documentation:** The semantic model may request a roof, slab, wall, or host cut that the current renderer cannot display faithfully. Renderer diagnostics must surface this as a fidelity error instead of silently showing uncut or proxy geometry.

**Examples:** A slab, roof, wall, or host cut is required but not faithfully rendered.

**Affected ids:** element, roof, floor, wall, opening, view

**Fix command hints:** addRendererFallback, switchEvidenceView, markRendererUnsupported

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs

### `sketch_evidence_stale`

**Title:** Sketch Acceptance Evidence Stale

**UI summary:** The sketch-to-BIM evidence packet is stale for the current model.

**Source layer:** sketch_acceptance

**Severity policy:** p0_sketch_acceptance_error

**Surfaces:** ui, api, cli, mcp, docs

**Status:** planned

**Recommendation:** Regenerate the evidence packet after the current model revision, rule digest, renderer support matrix, target spec, and git head are all recorded.

**Documentation:** Sketch-to-BIM acceptance evidence becomes stale when the model revision, Advisor rule digest, renderer support matrix, seed source, target spec, or git head changes after the evidence was captured.

**Examples:** Evidence was captured before the current git head or Advisor rule digest.

**Affected ids:** evidence, snapshot, view, document

**Fix command hints:** regenerateEvidence, recordRuleDigest, recordRendererDigest

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs


## Taxonomy Families

| Family | Layer | Discipline | Severity | Profiles | Match | Tracker |
| ------ | ----- | ---------- | -------- | -------- | ----- | ------- |
| `explicit_registry` | model_integrity | platform | error | `model_integrity`, `construction_readiness`, `agent_preflight` | `bim_invariant_failure`, `host_wall_outside_envelope`, `hosted_door_not_embedded`, `physical_helper_leakage`, `renderer_unsupported_cut`, `sketch_evidence_stale` | `BIR-A02` |
| `authoring_validation` | authoring_validation | architecture | error | `model_integrity`, `architecture`, `agent_preflight` | `door_off_wall`, `wall_missing_level`, `floor_missing_level`, `opening_*`, `create_*`, `update_*`, `delete_*`, `place_*`, `move_*` | `BIR-B01`, `BIR-B04`, `BIR-B05` |
| `model_integrity_architecture` | model_integrity | architecture | error | `model_integrity`, `architecture`, `construction_readiness`, `agent_preflight` | `bim_invariant_failure`, `hosted_*`, `physical_*`, `model_integrity_*`, `wall_*`, `floor_*`, `room_*`, `stair_*`, `slab_*`, `level_*`, `grid_*`, `dimension_*` | `BIR-C01`, `BIR-D03`, `BIR-E01`, `BIR-P01` |
| `constructability_profile` | constructability | coordination | warning | `architecture`, `structure`, `mep`, `fire`, `accessibility`, `construction_readiness` | `furniture_wall_hard_clash`, `stair_wall_hard_clash`, `physical_hard_clash`, `room_without_door_access`, `room_without_egress_path`, `constructability_*`, `clearance_*`, `egress_*`, `fire_*`, `accessibility_*`, `load_*`, `pipe_*`, `duct_*`, `mep_*`, `ids_*` | `BIR-D07`, `BIR-G01`, `BIR-U03` |
| `renderer_diagnostics` | renderer_diagnostics | renderer | error | `renderer_fidelity`, `construction_readiness`, `sketch_acceptance` | `renderer_unsupported_cut`, `renderer_failed_cut`, `renderer_*`, `render_*`, `roof_opening_render_*`, `wall_cut_*`, `gltf_render_*` | `BIR-I02`, `BIR-J09` |
| `exchange_documentation` | constructability | exchange | warning | `exchange`, `documentation`, `construction_readiness` | `export_readback_drift`, `exchange_*`, `ifc_*`, `gltf_*`, `dxf_*`, `schedule_*`, `sheet_*`, `plan_view_sheet_*`, `evidence_package_*` | `BIR-K01`, `BIR-K02`, `BIR-R05` |
| `sketch_methodology` | sketch_acceptance | sketch | error | `sketch_acceptance`, `agent_preflight` | `sketch_evidence_stale`, `sketch_*`, `semantic_*`, `source_feature_*`, `assumption_*`, `target_house_*` | `BIR-M03`, `BIR-T01`, `BIR-T04` |
| `platform_transaction` | model_integrity | platform | error | `model_integrity`, `agent_preflight` | `stale_reference`, `transaction_*`, `undo_*`, `redo_*`, `collaboration_*`, `provenance_*` | `BIR-Q01`, `BIR-T02` |
| `general_review` | constructability | coordination | warning | `architecture`, `construction_readiness` | `<fallback>` | `BIR-A02`, `BIR-U05` |
