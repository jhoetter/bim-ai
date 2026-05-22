"""API-V3-01 CI assertions.

Verifies:
(a) Every registered ToolDescriptor has a name, category, cliExample, and restEndpoint.
(b) Every descriptor's inputSchema and outputSchema are valid JSON Schema Draft-07 objects.
(c) At least 5 descriptors are seeded (acceptance gate wired up).
(d) The five expected seed tools are present by name.
(e) Every descriptor can be retrieved by name via get_descriptor().
"""

from __future__ import annotations

import json
import re

import pytest
from fastapi import FastAPI

from bim_ai.api.registry import get_catalog, get_descriptor
from bim_ai.routes.api import api_router

EXPECTED_SEED_TOOLS = {
    "api-list-tools",
    "api-inspect",
    "api-version",
    "apply-bundle",
    "model.commit_bundle",
    "model.dry_run",
    "model-show",
    "qa.advisor_rules",
    "qa.bim_requirement_validation",
}

EXPECTED_M2_TRANSACTION_TOOLS = {
    "model.dry_run",
    "model.commit_bundle",
}

EXPECTED_M3B_DOCUMENT_EXPORT_TOOLS = {
    "document.create_drawing_set",
    "export.pdf",
    "export.ifc",
    "export.gltf",
    "export.glb",
}

EXPECTED_M3K_VERTICAL_CIRCULATION_TOOLS = {
    "author.stair_between_levels",
    "opening.slab_opening",
    "opening.shaft_opening",
    "author.railing",
}

EXPECTED_M4C_MEP_LITE_TOOLS = {
    "mep.pipe_route",
    "mep.duct_route",
    "mep.cable_tray",
    "mep.equipment",
    "mep.fixture",
    "mep.terminal",
    "mep.opening_request",
}

EXPECTED_M4B_STRUCTURE_CONSTRUCTION_TOOLS = {
    "structure.column",
    "structure.beam",
    "structure.column_update",
    "structure.constraint",
    "construction.package",
    "construction.logistics",
    "construction.qa_checklist",
}

VALID_CATEGORIES = {"query", "mutation", "transform", "job", "introspection"}
VALID_SIDE_EFFECTS = {"none", "mutates-kernel", "enqueues-job", "writes-audit"}
VALID_REST_METHODS = {"GET", "POST"}
VALID_MUTABILITY = {"read", "write", "job", "transform"}
VALID_IMPLEMENTATION_STATUS = {"implemented", "todo", "unsupported", "deprecated"}
VALID_TRANSPORTS = {"http", "websocket"}


def _is_json_schema_draft07(obj: object) -> bool:
    if not isinstance(obj, dict):
        return False
    if "$schema" in obj:
        return "draft-07" in str(obj["$schema"])
    # Accept schemas that omit $schema — permitted by spec
    return True


def _route_key(method: str, path: str) -> tuple[str, str]:
    # FastAPI route parameter names are implementation details for this audit;
    # descriptors may use public modelId while routes use model_id.
    return method, re.sub(r"\{[^}]+\}", "{}", path)


def _implemented_route_keys() -> set[tuple[str, str]]:
    app = FastAPI()
    app.include_router(api_router)
    keys: set[tuple[str, str]] = set()
    for route in app.routes:
        path = getattr(route, "path", "")
        methods = getattr(route, "methods", None)
        if methods:
            for method in methods:
                if method in {"GET", "POST", "PATCH", "DELETE", "PUT"}:
                    keys.add(_route_key(method, path))
        elif path:
            # WebSocketRoute has no .methods but is an implemented GET-upgrade route.
            keys.add(_route_key("GET", path))
    return keys


class TestToolRegistry:
    def test_minimum_tool_count(self):
        catalog = get_catalog()
        assert len(catalog.tools) >= 5, f"Expected >= 5 tools in registry, got {len(catalog.tools)}"

    def test_schema_version(self):
        catalog = get_catalog()
        assert catalog.schemaVersion == "api-v3.0"

    def test_seed_tools_present(self):
        catalog = get_catalog()
        names = {t.name for t in catalog.tools}
        missing = EXPECTED_SEED_TOOLS - names
        assert not missing, f"Seed tools missing from registry: {missing}"

    @pytest.mark.parametrize(
        "name",
        sorted(EXPECTED_SEED_TOOLS),
    )
    def test_descriptor_fields_non_empty(self, name: str):
        d = get_descriptor(name)
        assert d is not None, f"get_descriptor('{name}') returned None"
        assert d.name == name
        assert d.category in VALID_CATEGORIES, f"{name}: unexpected category {d.category!r}"
        assert d.sideEffects in VALID_SIDE_EFFECTS, (
            f"{name}: unexpected sideEffects {d.sideEffects!r}"
        )
        assert d.cliExample, f"{name}: cliExample is empty"
        assert d.restEndpoint is not None, f"{name}: restEndpoint is None"
        assert d.restEndpoint.method in VALID_REST_METHODS, (
            f"{name}: unexpected REST method {d.restEndpoint.method!r}"
        )
        assert d.restEndpoint.path.startswith("/"), f"{name}: path must start with /"

    @pytest.mark.parametrize(
        "name",
        sorted(EXPECTED_SEED_TOOLS),
    )
    def test_schemas_are_valid_draft07(self, name: str):
        d = get_descriptor(name)
        assert d is not None
        assert _is_json_schema_draft07(d.inputSchema), (
            f"{name}: inputSchema is not valid JSON Schema Draft-07"
        )
        assert _is_json_schema_draft07(d.outputSchema), (
            f"{name}: outputSchema is not valid JSON Schema Draft-07"
        )

    @pytest.mark.parametrize(
        "name",
        sorted(EXPECTED_SEED_TOOLS),
    )
    def test_schemas_are_json_serialisable(self, name: str):
        d = get_descriptor(name)
        assert d is not None
        json.dumps(d.inputSchema)
        json.dumps(d.outputSchema)

    def test_get_descriptor_unknown_returns_none(self):
        assert get_descriptor("__nonexistent_tool__") is None

    def test_all_descriptors_expose_m1c_machine_metadata(self):
        for d in get_catalog().tools:
            assert d.stableId == d.name
            assert d.mutability in VALID_MUTABILITY, d.name
            assert d.transport in VALID_TRANSPORTS, d.name
            assert d.implementationStatus in VALID_IMPLEMENTATION_STATUS, d.name
            assert d.requiredPermissions, d.name
            assert d.schemaRefs, d.name
            assert d.exampleRefs, d.name
            assert isinstance(d.kernelCommands, list), d.name
            assert isinstance(d.resourceGroups, list), d.name
            if d.implementationStatus in {"todo", "unsupported"}:
                assert d.unsupportedReason, d.name
            if d.implementationStatus == "deprecated":
                assert d.deprecatedReplacement, d.name

    def test_api_list_tools_schema_declares_m1c_contract_fields(self):
        descriptor = get_descriptor("api-list-tools")
        assert descriptor is not None
        tool_def = descriptor.outputSchema["definitions"]["ToolDescriptor"]
        required = set(tool_def["required"])
        assert {
            "stableId",
            "mutability",
            "requiredPermissions",
            "transport",
            "implementationStatus",
            "schemaRefs",
            "exampleRefs",
            "kernelCommands",
            "resourceGroups",
        } <= required
        assert "surfaceMetadata" in tool_def["properties"]

    def test_advisor_rule_registry_descriptor_exposes_canonical_rule_metadata(self):
        descriptor = get_descriptor("qa.advisor_rules")
        assert descriptor is not None
        assert descriptor.restEndpoint.method == "GET"
        assert descriptor.restEndpoint.path == "/api/v3/advisor-rules"
        assert {"qa", "advisor", "rule-registry", "mcp"} <= set(descriptor.resourceGroups)
        assert {"advisor-panel", "agent-review", "rule-ledger"} <= set(descriptor.uiFeatures)
        assert descriptor.surfaceMetadata["advisorRuleCatalog"]["rulesBySurface"]["cli"] == (
            descriptor.surfaceMetadata["advisorRuleCatalog"]["canonicalRuleCount"]
        )

        rule_schema = descriptor.outputSchema["properties"]["rules"]["items"]
        required = set(rule_schema["required"])
        assert {
            "ruleId",
            "discipline",
            "perspective",
            "profiles",
            "severityPolicy",
            "sourceLayer",
            "suppressibility",
            "actionability",
            "surfaces",
            "affectedIdKinds",
            "recommendation",
            "fixCommandHints",
            "testRefs",
            "status",
        } <= required

    def test_implemented_descriptors_point_to_implemented_routes(self):
        route_keys = _implemented_route_keys()
        missing: list[str] = []
        for d in get_catalog().tools:
            if d.implementationStatus != "implemented":
                continue
            key = _route_key(d.restEndpoint.method, d.restEndpoint.path)
            if key not in route_keys:
                missing.append(f"{d.name}: {d.restEndpoint.method} {d.restEndpoint.path}")
        assert not missing, "Descriptor endpoints without implemented routes: " + ", ".join(missing)

    def test_m2_model_transaction_tools_are_first_class_descriptors(self):
        names = {tool.name for tool in get_catalog().tools}
        assert EXPECTED_M2_TRANSACTION_TOOLS <= names

        dry_run = get_descriptor("model.dry_run")
        assert dry_run is not None
        assert dry_run.stableId == "model.dry_run"
        assert dry_run.category == "transform"
        assert dry_run.mutability == "transform"
        assert dry_run.sideEffects == "none"
        assert dry_run.restEndpoint.method == "POST"
        assert dry_run.restEndpoint.path == "/api/models/{model_id}/commands/bundle/dry-run"
        assert "actorKind" in dry_run.inputSchema["properties"]
        assert dry_run.kernelCommands == ["*"]
        assert {"model", "transaction", "kernel-command"} <= set(dry_run.resourceGroups)
        assert "input:BundleEnvelope" in dry_run.schemaRefs
        assert "output:ModelDryRunResult" in dry_run.schemaRefs
        assert "cli:apply-bundle:dry-run" in dry_run.exampleRefs

        commit = get_descriptor("model.commit_bundle")
        assert commit is not None
        assert commit.stableId == "model.commit_bundle"
        assert commit.category == "mutation"
        assert commit.mutability == "write"
        assert commit.sideEffects == "mutates-kernel"
        assert commit.restEndpoint.method == "POST"
        assert commit.restEndpoint.path == "/api/models/{model_id}/bundles"
        assert commit.inputSchema["properties"]["mode"]["const"] == "commit"
        assert "actorKind" in commit.inputSchema["properties"]
        assert "dryRunEvidence" in commit.inputSchema["properties"]
        assert commit.kernelCommands == ["*"]
        assert {"model", "transaction", "kernel-command"} <= set(commit.resourceGroups)
        assert "input:CommandBundleRequest" in commit.schemaRefs
        assert "output:BundleResult" in commit.schemaRefs
        assert "cli:apply-bundle:commit" in commit.exampleRefs

    def test_apply_bundle_descriptor_exposes_agent_mcp_safety_fields(self):
        descriptor = get_descriptor("apply-bundle")
        assert descriptor is not None
        properties = descriptor.inputSchema["properties"]
        assert properties["actorKind"]["enum"] == ["human", "agent", "mcp-client", "ci"]
        assert "dryRunEvidence" in properties

    def test_bim_requirement_validation_descriptor_is_backend_ids_api_parity_surface(self):
        descriptor = get_descriptor("qa.bim_requirement_validation")
        assert descriptor is not None
        assert descriptor.restEndpoint.method == "GET"
        assert descriptor.restEndpoint.path == "/api/models/{model_id}/qa/bim-requirement-validation"
        assert {"ids", "bir", "mcp"} <= set(descriptor.resourceGroups)
        assert descriptor.outputSchema["properties"]["format"]["const"] == (
            "bimRequirementValidationApiParity_v1"
        )

    def test_m3k_vertical_circulation_tools_are_first_class_descriptors(self):
        names = {tool.name for tool in get_catalog().tools}
        assert EXPECTED_M3K_VERTICAL_CIRCULATION_TOOLS <= names

        stair = get_descriptor("author.stair_between_levels")
        assert stair is not None
        assert stair.restEndpoint.path == "/api/semantic-authoring/{surface_id}"
        assert stair.kernelCommands == ["createStair"]
        assert {"semantic-authoring", "vertical-circulation"} <= set(stair.resourceGroups)
        assert stair.inputSchema["required"] == [
            "baseLevelId",
            "topLevelId",
            "runStartMm",
            "runEndMm",
        ]

        slab = get_descriptor("opening.slab_opening")
        shaft = get_descriptor("opening.shaft_opening")
        railing = get_descriptor("author.railing")
        assert slab is not None
        assert shaft is not None
        assert railing is not None
        assert slab.kernelCommands == ["createSlabOpening"]
        assert shaft.kernelCommands == ["createSlabOpening"]
        assert shaft.inputSchema["properties"]["isShaft"]["const"] is True
        assert railing.kernelCommands == ["createRailing"]
        assert "pathMm" in railing.inputSchema["required"]

    def test_m4c_mep_lite_tools_are_first_class_descriptors(self):
        names = {tool.name for tool in get_catalog().tools}
        assert EXPECTED_M4C_MEP_LITE_TOOLS <= names

        pipe = get_descriptor("mep.pipe_route")
        assert pipe is not None
        assert pipe.restEndpoint.path == "/api/semantic-authoring/{surface_id}"
        assert pipe.kernelCommands == ["createPipe"]
        assert {"semantic-authoring", "mep", "route", "pipe"} <= set(pipe.resourceGroups)
        assert {"levelId", "startMm", "endMm"} <= set(pipe.inputSchema["required"])
        assert "elevationMm" in pipe.inputSchema["properties"]
        assert "systemType" in pipe.inputSchema["properties"]
        assert "serviceLevel" in pipe.inputSchema["properties"]

        duct = get_descriptor("mep.duct_route")
        assert duct is not None
        assert duct.kernelCommands == ["createDuct"]
        assert {"widthMm", "heightMm", "shape"} <= set(duct.inputSchema["properties"])

        opening = get_descriptor("mep.opening_request")
        assert opening is not None
        assert opening.kernelCommands == ["createMepOpeningRequest"]
        assert {"hostElementId"} <= set(opening.inputSchema["required"])
        assert "requesterElementIds" in opening.inputSchema["properties"]

    def test_m4b_structure_construction_tools_are_first_class_descriptors(self):
        names = {tool.name for tool in get_catalog().tools}
        assert EXPECTED_M4B_STRUCTURE_CONSTRUCTION_TOOLS <= names

        column = get_descriptor("structure.column")
        beam = get_descriptor("structure.beam")
        constraint = get_descriptor("structure.constraint")
        package = get_descriptor("construction.package")
        logistics = get_descriptor("construction.logistics")
        checklist = get_descriptor("construction.qa_checklist")
        assert column is not None
        assert beam is not None
        assert constraint is not None
        assert package is not None
        assert logistics is not None
        assert checklist is not None
        assert column.restEndpoint.path == "/api/semantic-authoring/{surface_id}"
        assert column.kernelCommands == ["createColumn"]
        assert beam.kernelCommands == ["createBeam"]
        assert constraint.kernelCommands == ["createConstraint"]
        assert package.kernelCommands == ["createConstructionPackage"]
        assert logistics.kernelCommands == ["createConstructionLogistics"]
        assert checklist.kernelCommands == ["upsertConstructionQaChecklist"]
        assert {"semantic-authoring", "structure"} <= set(column.resourceGroups)
        assert {"semantic-authoring", "construction"} <= set(package.resourceGroups)
        assert column.inputSchema["required"] == ["levelId", "positionMm"]
        assert beam.inputSchema["required"] == ["levelId", "startMm", "endMm"]
        assert logistics.inputSchema["required"] == ["name", "logisticsKind"]

    def test_m4d_family_asset_material_decal_tools_are_first_class_descriptors(self):
        expected = {
            "family.upsert_type",
            "family.place_instance",
            "asset.query",
            "asset.place",
            "material.query",
            "material.upsert_pbr",
            "material.assign",
            "material.paint_face",
            "decal.create",
            "place-kitchen-kit",
        }
        names = {tool.name for tool in get_catalog().tools}
        assert expected <= names

        family = get_descriptor("family.place_instance")
        assert family is not None
        assert family.kernelCommands == ["placeFamilyInstance"]
        assert {"family", "family-instance", "kernel-command"} <= set(family.resourceGroups)
        assert family.inputSchema["required"] == ["familyTypeId", "positionMm"]

        paint = get_descriptor("material.paint_face")
        assert paint is not None
        assert paint.kernelCommands == ["set_element_prop"]
        assert {"material", "paint", "kernel-command"} <= set(paint.resourceGroups)
        assert paint.inputSchema["required"] == ["elementId", "faceKind", "materialKey"]

        decal = get_descriptor("decal.create")
        assert decal is not None
        assert decal.kernelCommands == ["create_decal"]
        assert {"decal", "material", "kernel-command"} <= set(decal.resourceGroups)

    @pytest.mark.parametrize(
        ("name", "path"),
        [
            ("model.dry_run", "/api/models/{model_id}/commands/bundle/dry-run"),
            ("model.commit_bundle", "/api/models/{model_id}/bundles"),
        ],
    )
    def test_m2_model_transaction_tool_routes_are_implemented(self, name: str, path: str):
        descriptor = get_descriptor(name)
        assert descriptor is not None
        assert descriptor.restEndpoint.path == path
        assert _route_key(descriptor.restEndpoint.method, path) in _implemented_route_keys()

    def test_m3b_documentation_export_tools_are_first_class_descriptors(self):
        names = {tool.name for tool in get_catalog().tools}
        assert EXPECTED_M3B_DOCUMENT_EXPORT_TOOLS <= names

        drawing = get_descriptor("document.create_drawing_set")
        assert drawing is not None
        assert drawing.category == "mutation"
        assert drawing.mutability == "write"
        assert drawing.sideEffects == "mutates-kernel"
        assert drawing.restEndpoint.method == "POST"
        assert drawing.restEndpoint.path == "/api/models/{model_id}/bundles"
        assert {
            "upsertSheet",
            "upsertSheetViewports",
            "upsertSchedule",
            "placeTag",
            "createDimension",
        } <= set(drawing.kernelCommands)
        assert {"sheet", "viewport", "schedule", "tag", "dimension"} <= set(drawing.resourceGroups)

        for name, content_type in [
            ("export.pdf", "pdf"),
            ("export.ifc", "ifc"),
            ("export.gltf", "gltf"),
            ("export.glb", "gltf"),
        ]:
            descriptor = get_descriptor(name)
            assert descriptor is not None
            assert descriptor.category == "query"
            assert descriptor.mutability == "read"
            assert descriptor.sideEffects == "none"
            assert descriptor.exportsData is True
            assert "model:read" in descriptor.requiredPermissions
            assert "artifact" in descriptor.outputSchema["properties"]
            assert "evidence" in descriptor.outputSchema["properties"]
            assert "limitations" in descriptor.outputSchema["properties"]
            assert content_type in " ".join(descriptor.resourceGroups + descriptor.exampleRefs)
