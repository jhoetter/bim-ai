from __future__ import annotations

from typing import Any

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

_TOPOSOLID_BOUNDARY_SCHEMA: dict[str, Any] = {
    "type": "array",
    "minItems": 3,
    "items": {
        "type": "object",
        "required": ["xMm", "yMm"],
        "properties": {
            "xMm": {"type": "number"},
            "yMm": {"type": "number"},
        },
    },
}

_VEC2_MM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["xMm", "yMm"],
    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
}

_VEC3_MM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["xMm", "yMm", "zMm"],
    "properties": {
        "xMm": {"type": "number"},
        "yMm": {"type": "number"},
        "zMm": {"type": "number"},
    },
}

_SITE_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SiteContextMutationOutput",
    "type": "object",
    "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
}


def _register_site_mutation(
    name: str,
    title: str,
    required: list[str],
    properties: dict[str, Any],
    cli_example: str,
    notes: str,
) -> None:
    register(
        ToolDescriptor(
            name=name,
            category="mutation",
            inputSchema={
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": title,
                "type": "object",
                "required": ["modelId", *required],
                "properties": {"modelId": {"type": "string", "format": "uuid"}, **properties},
                "additionalProperties": False,
            },
            outputSchema=_SITE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Mutation accepted"),
                "error": ExitCode(code=1, meaning="Validation error or missing referenced element"),
            },
            cliExample=cli_example,
            restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=notes,
        )
    )


_register_site_mutation(
    "site.setup-georeference",
    "SiteSetupGeoreferenceInput",
    ["referenceLevelId", "boundaryMm"],
    {
        "referenceLevelId": {"type": "string"},
        "siteId": {"type": "string"},
        "toposolidId": {"type": "string"},
        "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
        "projectBasePointMm": _VEC3_MM_SCHEMA,
        "surveyPointMm": _VEC3_MM_SCHEMA,
        "angleToTrueNorthDeg": {"type": "number"},
        "latitudeDeg": {"type": "number"},
        "longitudeDeg": {"type": "number"},
        "dateIso": {"type": "string"},
        "timeOfDay": {"type": "object"},
        "propertyLines": {"type": "array", "items": {"type": "object"}},
        "contextObjects": {"type": "array", "items": {"type": "object"}},
    },
    'bim-ai site setup --reference-level lvl-1 --boundary "0,0;20000,0;20000,12000;0,12000" --lat 48.13 --lon 11.58 --true-north 12.5 --json',
    (
        "Preferred M4-A baseline: emits typed createProjectBasePoint, createSurveyPoint, "
        "createSunSettings, upsertSite, and CreateToposolid commands. Raw apply-bundle is a "
        "fallback only for fields not represented by this descriptor."
    ),
)

for _site_descriptor in [
    (
        "site.upsert-site",
        "UpsertSiteInput",
        ["id", "referenceLevelId", "boundaryMm"],
        {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "referenceLevelId": {"type": "string"},
            "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
            "padThicknessMm": {"type": "number"},
            "baseOffsetMm": {"type": "number"},
            "northDegCwFromPlanX": {"type": "number"},
            "uniformSetbackMm": {"type": "number"},
            "contextObjects": {"type": "array", "items": {"type": "object"}},
        },
        'bim-ai site setup --site-id site-a --reference-level lvl-1 --boundary "0,0;10000,0;10000,8000;0,8000" --json',
        "Typed upsertSite surface. Use site.setup-georeference for full origin/sun/toposolid setup.",
    ),
    (
        "site.graded-region-update",
        "UpdateGradedRegionInput",
        ["id"],
        {
            "id": {"type": "string"},
            "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
            "targetMode": {"type": "string", "enum": ["flat", "slope"]},
            "targetZMm": {"type": "number"},
            "slopeAxisDeg": {"type": "number"},
            "slopeDegPercent": {"type": "number"},
        },
        "bim-ai site graded-region update gr-1 --target-z 150 --json",
        "Typed graded-region update surface.",
    ),
    (
        "site.graded-region-delete",
        "DeleteGradedRegionInput",
        ["id"],
        {"id": {"type": "string"}},
        "bim-ai site graded-region delete gr-1 --json",
        "Typed graded-region delete surface.",
    ),
    (
        "site.property-line-create",
        "CreatePropertyLineInput",
        ["startMm", "endMm"],
        {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "startMm": _VEC2_MM_SCHEMA,
            "endMm": _VEC2_MM_SCHEMA,
            "setbackMm": {"type": "number", "minimum": 0},
            "classification": {"type": "string", "enum": ["street", "rear", "side", "other"]},
            "bearingTable": {"type": "object"},
        },
        'bim-ai site property-line create --line "0,0;25000,0" --classification street --setback 4500 --json',
        "Typed property-line create surface, including bearing-table payloads.",
    ),
    (
        "site.property-line-update",
        "UpdatePropertyLineInput",
        ["propertyLineId"],
        {
            "propertyLineId": {"type": "string"},
            "name": {"type": "string"},
            "startMm": _VEC2_MM_SCHEMA,
            "endMm": _VEC2_MM_SCHEMA,
            "setbackMm": {"type": "number", "minimum": 0},
            "classification": {"type": "string", "enum": ["street", "rear", "side", "other"]},
            "bearingTable": {"type": "object"},
        },
        "bim-ai site property-line update pl-1 --setback 5000 --classification side --json",
        "Typed property-line update surface.",
    ),
    (
        "site.property-line-delete",
        "DeletePropertyLineInput",
        ["propertyLineId"],
        {"propertyLineId": {"type": "string"}},
        "bim-ai site property-line delete pl-1 --json",
        "Typed property-line delete surface.",
    ),
    (
        "site.project-base-point-create",
        "CreateProjectBasePointInput",
        ["positionMm"],
        {
            "id": {"type": "string"},
            "positionMm": _VEC3_MM_SCHEMA,
            "angleToTrueNorthDeg": {"type": "number"},
            "clipped": {"type": "boolean"},
        },
        "bim-ai site base-point create --position 0,0,0 --true-north 12.5 --json",
        "Typed singleton project base point create surface.",
    ),
    (
        "site.project-base-point-move",
        "MoveProjectBasePointInput",
        ["positionMm"],
        {"positionMm": _VEC3_MM_SCHEMA},
        "bim-ai site base-point move --position 1000,0,0 --json",
        "Typed project base point move surface.",
    ),
    (
        "site.project-base-point-rotate",
        "RotateProjectBasePointInput",
        ["angleToTrueNorthDeg"],
        {"angleToTrueNorthDeg": {"type": "number"}},
        "bim-ai site base-point rotate --true-north 12.5 --json",
        "Typed project base point true-north surface.",
    ),
    (
        "site.survey-point-create",
        "CreateSurveyPointInput",
        ["positionMm"],
        {
            "id": {"type": "string"},
            "positionMm": _VEC3_MM_SCHEMA,
            "sharedElevationMm": {"type": "number"},
            "clipped": {"type": "boolean"},
        },
        "bim-ai site survey-point create --position 0,0,0 --shared-elevation 510000 --json",
        "Typed singleton survey point create surface.",
    ),
    (
        "site.survey-point-move",
        "MoveSurveyPointInput",
        ["positionMm"],
        {"positionMm": _VEC3_MM_SCHEMA, "sharedElevationMm": {"type": "number"}},
        "bim-ai site survey-point move --position 1000,2000,0 --json",
        "Typed survey point move surface.",
    ),
    (
        "site.sun-settings-create",
        "CreateSunSettingsInput",
        [],
        {
            "id": {"type": "string"},
            "latitudeDeg": {"type": "number"},
            "longitudeDeg": {"type": "number"},
            "dateIso": {"type": "string"},
            "timeOfDay": {"type": "object"},
            "daylightSavingStrategy": {"type": "string", "enum": ["auto", "on", "off"]},
        },
        "bim-ai site sun-settings create --lat 48.13 --lon 11.58 --date 2026-06-21 --time 14:30 --json",
        "Typed sun settings singleton create surface.",
    ),
    (
        "site.sun-settings-update",
        "UpdateSunSettingsInput",
        [],
        {
            "latitudeDeg": {"type": "number"},
            "longitudeDeg": {"type": "number"},
            "dateIso": {"type": "string"},
            "timeOfDay": {"type": "object"},
            "daylightSavingStrategy": {"type": "string", "enum": ["auto", "on", "off"]},
        },
        "bim-ai site sun-settings update --date 2026-12-21 --time 09:00 --json",
        "Typed sun settings partial update surface.",
    ),
    (
        "site.toposolid-subdivision-update",
        "UpdateToposolidSubdivisionInput",
        ["id"],
        {
            "id": {"type": "string"},
            "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
            "finishCategory": {
                "type": "string",
                "enum": ["paving", "lawn", "road", "planting", "other"],
            },
            "materialKey": {"type": "string"},
            "name": {"type": "string"},
        },
        "bim-ai site subdivision update sub-1 --finish-category paving --material-key asphalt --json",
        "Typed toposolid subdivision update surface.",
    ),
    (
        "site.toposolid-subdivision-delete",
        "DeleteToposolidSubdivisionInput",
        ["id"],
        {"id": {"type": "string"}},
        "bim-ai site subdivision delete sub-1 --json",
        "Typed toposolid subdivision delete surface.",
    ),
    (
        "site.toposolid-excavation-create",
        "CreateToposolidExcavationInput",
        ["hostToposolidId", "cutterElementId"],
        {
            "id": {"type": "string"},
            "hostToposolidId": {"type": "string"},
            "cutterElementId": {"type": "string"},
            "cutMode": {
                "type": "string",
                "enum": ["to_top_of_cutter", "to_bottom_of_cutter", "custom_depth"],
            },
            "offsetMm": {"type": "number"},
            "customDepthMm": {"type": "number"},
            "estimatedVolumeM3": {"type": "number"},
        },
        "bim-ai site excavation create --host-toposolid topo-1 --cutter floor-1 --cut-mode to_bottom_of_cutter --json",
        "Typed toposolid excavation create surface. Cutter must reference floor, roof, or toposolid.",
    ),
    (
        "site.toposolid-excavation-update",
        "UpdateToposolidExcavationInput",
        ["id"],
        {
            "id": {"type": "string"},
            "cutMode": {
                "type": "string",
                "enum": ["to_top_of_cutter", "to_bottom_of_cutter", "custom_depth"],
            },
            "offsetMm": {"type": "number"},
            "customDepthMm": {"type": "number"},
            "estimatedVolumeM3": {"type": "number"},
        },
        "bim-ai site excavation update ex-1 --offset 150 --json",
        "Typed toposolid excavation update surface.",
    ),
    (
        "site.toposolid-excavation-delete",
        "DeleteToposolidExcavationInput",
        ["id"],
        {"id": {"type": "string"}},
        "bim-ai site excavation delete ex-1 --json",
        "Typed toposolid excavation delete surface.",
    ),
]:
    _register_site_mutation(*_site_descriptor)
