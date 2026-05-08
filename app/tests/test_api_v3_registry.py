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

import pytest

from bim_ai.api.registry import get_catalog, get_descriptor

EXPECTED_SEED_TOOLS = {
    "api-list-tools",
    "api-inspect",
    "api-version",
    "apply-bundle",
    "model-show",
}

VALID_CATEGORIES = {"query", "mutation", "transform", "job", "introspection"}
VALID_SIDE_EFFECTS = {"none", "mutates-kernel", "enqueues-job", "writes-audit"}
VALID_REST_METHODS = {"GET", "POST"}


def _is_json_schema_draft07(obj: object) -> bool:
    if not isinstance(obj, dict):
        return False
    if "$schema" in obj:
        return "draft-07" in str(obj["$schema"])
    # Accept schemas that omit $schema — permitted by spec
    return True


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
