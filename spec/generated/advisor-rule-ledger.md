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

**Affected ids:** evidence, snapshot, view, document

**Fix command hints:** regenerateEvidence, recordRuleDigest, recordRendererDigest

**Tests:** app/tests/test_advisor_rule_registry.py, app/tests/test_api_v3_registry.py, packages/cli/cli.mcpParity.test.mjs
