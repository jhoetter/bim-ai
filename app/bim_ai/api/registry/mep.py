"""MEP typed-surface descriptors (pipe / duct / cable tray / equipment / fixture / terminal / opening-request).

Extracted from registry.py (BRT-25).
"""

from __future__ import annotations

from typing import Any

from bim_ai.api.registry._shared import (
    _CMD_V3_BUNDLE_OUTPUT_SCHEMA,
    _POINT_2_SCHEMA,
)
from bim_ai.api.registry_core import (
    ExitCode,
    RestEndpoint,
    ToolDescriptor,
    register,
)

_MEP_SYSTEM_ENUM = [
    "hvac_supply",
    "hvac_return",
    "heating",
    "cooling",
    "domestic_water",
    "wastewater",
    "electrical",
    "data",
    "fire_protection",
    "other",
]

_MEP_FLOW_ENUM = ["supply", "return", "exhaust", "bidirectional", "none", "unknown"]

_MEP_ROUTE_BASE_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["levelId", "startMm", "endMm"],
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "levelId": {"type": "string"},
        "startMm": _POINT_2_SCHEMA,
        "endMm": _POINT_2_SCHEMA,
        "elevationMm": {"type": "number", "default": 0},
        "systemType": {"type": "string"},
        "systemName": {"type": "string"},
        "flowDirection": {"type": "string", "enum": _MEP_FLOW_ENUM, "default": "unknown"},
        "serviceLevel": {"type": "string"},
        "clearanceZone": {"type": "object"},
        "maintainAccessZone": {"type": "object"},
        "connectors": {"type": "array", "items": {"type": "object"}},
        "colour": {"type": "string"},
    },
    "additionalProperties": False,
}


def _mep_route_schema(title: str, extra_properties: dict[str, Any]) -> dict[str, Any]:
    return {
        **_MEP_ROUTE_BASE_SCHEMA,
        "title": title,
        "properties": {**_MEP_ROUTE_BASE_SCHEMA["properties"], **extra_properties},
    }


_MEP_PLACED_BASE_PROPERTIES: dict[str, Any] = {
    "id": {"type": "string"},
    "name": {"type": "string"},
    "levelId": {"type": "string"},
    "positionMm": _POINT_2_SCHEMA,
    "systemType": {"type": "string", "enum": _MEP_SYSTEM_ENUM},
    "systemName": {"type": "string"},
    "connectors": {"type": "array", "items": {"type": "object"}},
}


def _mep_placed_schema(title: str, extra_properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": title,
        "type": "object",
        "required": ["levelId", "positionMm"],
        "properties": {**_MEP_PLACED_BASE_PROPERTIES, **extra_properties},
        "additionalProperties": False,
    }


_MEP_TYPED_SURFACES: tuple[dict[str, Any], ...] = (
    {
        "name": "mep.pipe_route",
        "title": "MepPipeRouteInput",
        "inputSchema": _mep_route_schema(
            "MepPipeRouteInput",
            {
                "diameterMm": {"type": "number", "exclusiveMinimum": 0, "default": 25},
                "insulation": {"type": "string"},
                "materialKey": {"type": "string"},
            },
        ),
        "ok": "Typed createPipe bundle generated",
        "cli": (
            "bim-ai mep pipe-route --level lvl-1 --line '0,100;3000,100' "
            "--elevation 2600 --system domestic_water --service-level 'Level 1 ceiling' --json"
        ),
        "schemaRef": "input:MepPipeRouteInput",
        "groups": ["semantic-authoring", "mep", "route", "pipe", "kernel-command"],
        "ui": ["tool:mep.pipe-route", "cmd-k:mep.pipe-route"],
        "notes": "Creates a straight pipe route with explicit level, route geometry, elevation, system, and service metadata.",
    },
    {
        "name": "mep.duct_route",
        "title": "MepDuctRouteInput",
        "inputSchema": _mep_route_schema(
            "MepDuctRouteInput",
            {
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
                "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
                "shape": {"type": "string", "enum": ["rectangular", "round", "oval"]},
                "insulation": {"type": "string"},
            },
        ),
        "ok": "Typed createDuct bundle generated",
        "cli": (
            "bim-ai mep duct-route --level lvl-1 --line '0,800;3000,800' "
            "--elevation 2800 --system hvac_supply --width 500 --height 250 --json"
        ),
        "schemaRef": "input:MepDuctRouteInput",
        "groups": ["semantic-authoring", "mep", "route", "duct", "kernel-command"],
        "ui": ["tool:mep.duct-route", "cmd-k:mep.duct-route"],
        "notes": "Creates a straight duct route with route geometry, elevation, shape, system, flow, and service metadata.",
    },
    {
        "name": "mep.cable_tray",
        "title": "MepCableTrayInput",
        "inputSchema": _mep_route_schema(
            "MepCableTrayInput",
            {
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
                "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 60},
            },
        ),
        "ok": "Typed createCableTray bundle generated",
        "cli": (
            "bim-ai mep cable-tray --level lvl-1 --line '0,1200;3000,1200' "
            "--elevation 2700 --system electrical --service-level overhead --json"
        ),
        "schemaRef": "input:MepCableTrayInput",
        "groups": ["semantic-authoring", "mep", "route", "cable-tray", "kernel-command"],
        "ui": ["tool:mep.cable-tray", "cmd-k:mep.cable-tray"],
        "notes": "Creates an electrical/data tray route with explicit geometry, elevation, system, and service metadata.",
    },
    {
        "name": "mep.equipment",
        "inputSchema": _mep_placed_schema(
            "MepEquipmentInput",
            {
                "elevationMm": {"type": "number", "default": 0},
                "equipmentType": {"type": "string"},
                "familyTypeId": {"type": "string"},
                "serviceLevel": {"type": "string"},
                "clearanceZone": {"type": "object"},
                "maintainAccessZone": {"type": "object"},
                "electricalLoadW": {"type": "number", "minimum": 0},
            },
        ),
        "ok": "Typed createMepEquipment bundle generated",
        "cli": (
            "bim-ai mep equipment --level lvl-1 --position 500,500 --system hvac_supply "
            "--equipment-type AHU --elevation 0 --json"
        ),
        "schemaRef": "input:MepEquipmentInput",
        "groups": ["semantic-authoring", "mep", "equipment", "kernel-command"],
        "ui": ["tool:mep.equipment", "cmd-k:mep.equipment"],
        "notes": "Places MEP equipment with level, position, elevation, system, service, connector, and access metadata.",
    },
    {
        "name": "mep.fixture",
        "inputSchema": _mep_placed_schema(
            "MepFixtureInput",
            {
                "roomId": {"type": "string"},
                "fixtureType": {"type": "string"},
                "electricalLoadW": {"type": "number", "minimum": 0},
            },
        ),
        "ok": "Typed createFixture bundle generated",
        "cli": (
            "bim-ai mep fixture --level lvl-1 --position 1200,900 --room room-1 "
            "--fixture-type sink --system domestic_water --json"
        ),
        "schemaRef": "input:MepFixtureInput",
        "groups": ["semantic-authoring", "mep", "fixture", "kernel-command"],
        "ui": ["tool:mep.fixture", "cmd-k:mep.fixture"],
        "notes": "Places a fixture with room/level position, system, connector, and load metadata.",
    },
    {
        "name": "mep.terminal",
        "inputSchema": _mep_placed_schema(
            "MepTerminalInput",
            {
                "terminalKind": {
                    "type": "string",
                    "enum": ["diffuser", "terminal", "sprinkler", "device"],
                },
                "roomId": {"type": "string"},
                "flowDirection": {"type": "string", "enum": _MEP_FLOW_ENUM},
                "serviceLevel": {"type": "string"},
            },
        ),
        "ok": "Typed createMepTerminal bundle generated",
        "cli": (
            "bim-ai mep terminal --level lvl-1 --position 1800,900 --room room-1 "
            "--terminal-kind diffuser --system hvac_supply --service-level ceiling --json"
        ),
        "schemaRef": "input:MepTerminalInput",
        "groups": ["semantic-authoring", "mep", "terminal", "kernel-command"],
        "ui": ["tool:mep.terminal", "cmd-k:mep.terminal"],
        "notes": "Places a terminal/diffuser/device with system, service level, flow, and connector metadata.",
    },
    {
        "name": "mep.opening_request",
        "inputSchema": {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "MepOpeningRequestInput",
            "type": "object",
            "required": ["hostElementId"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "hostElementId": {"type": "string"},
                "levelId": {"type": "string"},
                "requesterElementIds": {"type": "array", "items": {"type": "string"}},
                "openingKind": {"type": "string", "enum": ["wall", "slab", "roof", "shaft"]},
                "positionMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0},
                "heightMm": {"type": "number", "exclusiveMinimum": 0},
                "diameterMm": {"type": "number", "exclusiveMinimum": 0},
                "clearanceMm": {"type": "number", "minimum": 0, "default": 50},
                "systemType": {"type": "string", "enum": _MEP_SYSTEM_ENUM},
                "systemName": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "ok": "Typed createMepOpeningRequest bundle generated",
        "cli": (
            "bim-ai mep opening-request --host wall-1 --level lvl-1 --requester duct-1 "
            "--opening-kind wall --position 1500,800 --width 600 --height 320 --system hvac_supply --json"
        ),
        "schemaRef": "input:MepOpeningRequestInput",
        "groups": [
            "semantic-authoring",
            "mep",
            "opening-request",
            "coordination",
            "kernel-command",
        ],
        "ui": ["tool:mep.opening-request", "cmd-k:mep.opening-request"],
        "notes": "Creates a traceable MEP penetration request against an explicit host and requester elements.",
    },
)

for _surface in _MEP_TYPED_SURFACES:
    register(
        ToolDescriptor(
            name=_surface["name"],
            category="mutation",
            inputSchema=_surface["inputSchema"],
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning=_surface["ok"]),
                "invalid": ExitCode(code=422, meaning=f"Invalid {_surface['name']} payload"),
            },
            cliExample=_surface["cli"],
            restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=(
                f"{_surface['notes']} Submit through model.dry_run or model.commit_bundle "
                "for transaction safety and advisor validation."
            ),
            schemaRefs=[_surface["schemaRef"], "output:SemanticAuthoringBundle"],
            exampleRefs=[f"cli:{_surface['name']}"],
            resourceGroups=_surface["groups"],
            uiFeatures=_surface["ui"],
        )
    )
