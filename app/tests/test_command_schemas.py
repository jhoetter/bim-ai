from __future__ import annotations

import json

from fastapi.testclient import TestClient

from bim_ai.command_schemas import (
    COMMAND_SCHEMA_EXPORT_VERSION,
    command_model_map,
    export_command_schemas,
    get_command_schema,
)
from bim_ai.main import app

EXPECTED_COMMAND_COUNT = 261


def test_command_schema_export_lists_all_command_discriminators() -> None:
    model_map = command_model_map()
    export = export_command_schemas()

    assert export["schemaVersion"] == COMMAND_SCHEMA_EXPORT_VERSION
    assert export["commandCount"] == len(model_map) == EXPECTED_COMMAND_COUNT
    assert export["commandNames"] == sorted(model_map)
    assert set(export["schemas"]) == set(model_map)
    assert set(export["metadata"]) == set(model_map)
    assert export["unionSchema"]["discriminator"]["propertyName"] == "type"
    assert len(export["unionSchema"]["oneOf"]) == export["commandCount"]


def test_command_schema_export_has_json_schema_and_todo_metadata() -> None:
    export = export_command_schemas()
    create_wall_schema = export["schemas"]["createWall"]
    create_wall_metadata = export["metadata"]["createWall"]

    assert create_wall_schema["properties"]["type"]["const"] == "createWall"
    assert "levelId" in create_wall_schema["properties"]
    assert create_wall_metadata["name"] == "createWall"
    assert create_wall_metadata["modelClass"] == "CreateWallCmd"
    assert create_wall_metadata["example"] == {
        "type": "createWall",
        "levelId": "level-1",
        "start": {"xMm": 0.0, "yMm": 0.0},
        "end": {"xMm": 0.0, "yMm": 0.0},
    }
    assert create_wall_metadata["exampleStatus"] == "generated-minimal"
    assert create_wall_metadata["exampleError"] is None
    assert create_wall_metadata["mappingStatus"] == "mapped"
    assert create_wall_metadata["rawSemanticMapping"]["agentSurface"] == "semantic-authoring"
    assert create_wall_metadata["rawSemanticMapping"]["rawExecution"] == {
        "available": True,
        "transport": "POST /api/models/{model_id}/bundles",
        "bundlePath": "bundle.commands[]",
    }
    json.dumps(export)


def test_get_command_schema_returns_single_command_payload() -> None:
    payload = get_command_schema("insertDoorOnWall")

    assert payload is not None
    assert payload["schemaVersion"] == COMMAND_SCHEMA_EXPORT_VERSION
    assert payload["name"] == "insertDoorOnWall"
    assert payload["schema"]["properties"]["type"]["const"] == "insertDoorOnWall"
    assert payload["metadata"]["modelClass"] == "InsertDoorOnWallCmd"
    assert get_command_schema("__missing__") is None


def test_v3_commands_routes_are_registered_on_real_app() -> None:
    client = TestClient(app)

    listing = client.get("/api/v3/commands")
    assert listing.status_code == 200
    listing_body = listing.json()
    assert listing_body["schemaVersion"] == COMMAND_SCHEMA_EXPORT_VERSION
    assert listing_body["commandCount"] == EXPECTED_COMMAND_COUNT
    assert "createWall" in listing_body["commandNames"]

    single = client.get("/api/v3/commands/createWall")
    assert single.status_code == 200
    assert single.json()["schema"]["properties"]["type"]["const"] == "createWall"

    missing = client.get("/api/v3/commands/notACommand")
    assert missing.status_code == 404
