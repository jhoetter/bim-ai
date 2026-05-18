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
from bim_ai.routes_api import api_router

EXPECTED_SEED_TOOLS = {
    "api-list-tools",
    "api-inspect",
    "api-version",
    "apply-bundle",
    "model.commit_bundle",
    "model.dry_run",
    "model-show",
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
        assert commit.kernelCommands == ["*"]
        assert {"model", "transaction", "kernel-command"} <= set(commit.resourceGroups)
        assert "input:CommandBundleRequest" in commit.schemaRefs
        assert "output:BundleResult" in commit.schemaRefs
        assert "cli:apply-bundle:commit" in commit.exampleRefs

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
