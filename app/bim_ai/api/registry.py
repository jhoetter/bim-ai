"""API-V3-01 — Tool registry.

Every kernel verb registers a ToolDescriptor here at boot.  The registry is
in-memory and populated by calling `register()` at module import time (or from
each theme WP's own module when it lands).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass(frozen=True)
class RestEndpoint:
    method: Literal["GET", "POST"]
    path: str


@dataclass(frozen=True)
class ExitCode:
    code: int
    meaning: str


Mutability = Literal["read", "write", "job", "transform"]
ImplementationStatus = Literal["implemented", "todo", "unsupported", "deprecated"]
Transport = Literal["http", "websocket"]


_LEGACY_ENDPOINT_ALIASES: dict[str, RestEndpoint] = {
    "/api/v3/models/{modelId}/bundles": RestEndpoint(
        method="POST", path="/api/models/{model_id}/bundles"
    ),
    "/api/models/{modelId}/bundles": RestEndpoint(
        method="POST", path="/api/models/{model_id}/bundles"
    ),
}

_KERNEL_COMMANDS_BY_TOOL: dict[str, tuple[str, ...]] = {
    "apply-bundle": ("*",),
    "set-tool-pref": ("setToolPref",),
    "toposolid-create": ("CreateToposolid",),
    "toposolid-update": ("UpdateToposolid",),
    "toposolid-delete": ("DeleteToposolid",),
    "create-graded-region": ("CreateGradedRegion",),
    "create-toposolid-subdivision": ("create_toposolid_subdivision",),
    "site.setup-georeference": (
        "createProjectBasePoint",
        "createSurveyPoint",
        "createSunSettings",
        "upsertSite",
        "CreateToposolid",
    ),
    "site.upsert-site": ("upsertSite",),
    "site.graded-region-update": ("UpdateGradedRegion",),
    "site.graded-region-delete": ("DeleteGradedRegion",),
    "site.property-line-create": ("createPropertyLine",),
    "site.property-line-update": ("updatePropertyLine",),
    "site.property-line-delete": ("deletePropertyLine",),
    "site.project-base-point-create": ("createProjectBasePoint",),
    "site.project-base-point-move": ("moveProjectBasePoint",),
    "site.project-base-point-rotate": ("rotateProjectBasePoint",),
    "site.survey-point-create": ("createSurveyPoint",),
    "site.survey-point-move": ("moveSurveyPoint",),
    "site.sun-settings-create": ("createSunSettings",),
    "site.sun-settings-update": ("updateSunSettings",),
    "site.toposolid-subdivision-update": ("update_toposolid_subdivision",),
    "site.toposolid-subdivision-delete": ("delete_toposolid_subdivision",),
    "site.toposolid-excavation-create": ("CreateToposolidExcavation",),
    "site.toposolid-excavation-update": ("UpdateToposolidExcavation",),
    "site.toposolid-excavation-delete": ("DeleteToposolidExcavation",),
    "set-element-discipline": ("setElementDiscipline",),
    "set-view-lens": ("setViewLens",),
    "set-element-construction": ("setElementConstruction",),
    "create-schedule-view": ("create_schedule_view",),
    "author.stair_between_levels": ("createStair",),
    "opening.slab_opening": ("createSlabOpening",),
    "opening.shaft_opening": ("createSlabOpening",),
    "author.railing": ("createRailing",),
    "structure.column": ("createColumn",),
    "structure.beam": ("createBeam",),
    "structure.column_update": ("updateColumn",),
    "structure.constraint": ("createConstraint",),
    "construction.package": ("createConstructionPackage",),
    "construction.logistics": ("createConstructionLogistics",),
    "construction.qa_checklist": ("upsertConstructionQaChecklist",),
    "mep.pipe_route": ("createPipe",),
    "mep.duct_route": ("createDuct",),
    "mep.cable_tray": ("createCableTray",),
    "mep.equipment": ("createMepEquipment",),
    "mep.fixture": ("createFixture",),
    "mep.terminal": ("createMepTerminal",),
    "mep.opening_request": ("createMepOpeningRequest",),
    "set-element-prop": ("set_element_prop",),
    "update-stair-treads": ("update_stair_treads",),
    "place-kitchen-kit": ("place_kit",),
    "family.upsert_type": ("upsertFamilyType",),
    "family.place_instance": ("placeFamilyInstance",),
    "asset.place": ("PlaceAsset",),
    "material.upsert_pbr": ("update_material_pbr",),
    "material.assign": ("set_element_prop",),
    "material.paint_face": ("set_element_prop",),
    "decal.create": ("create_decal",),
    "import-image-underlay": ("import_image_underlay",),
    "move-image-underlay": ("move_image_underlay",),
    "scale-image-underlay": ("scale_image_underlay",),
    "rotate-image-underlay": ("rotate_image_underlay",),
    "delete-image-underlay": ("delete_image_underlay",),
    "commit-concept-seed": ("commit_concept_seed",),
    "create-frame": ("create_frame",),
    "create-brand-template": ("create_brand_template",),
    "draw-detail-region": ("create_detail_region",),
    "update-material-pbr": ("update_material_pbr",),
}

_RESOURCE_GROUPS_BY_TOOL: dict[str, tuple[str, ...]] = {
    "api-list-tools": ("api-descriptor",),
    "api-inspect": ("api-descriptor",),
    "api-version": ("api-descriptor",),
    "model-show": ("model", "snapshot"),
    "collab-ws": ("collaboration",),
    "fire-safety-lens-review-status": ("lens", "fire-safety"),
    "cost-quantity-lens-review-status": ("lens", "cost-quantity"),
    "construction-lens-report": ("lens", "construction"),
    "presentation-create": ("presentation", "share-link"),
    "presentation-revoke": ("presentation", "share-link"),
    "presentation-list": ("presentation", "share-link"),
    "img-trace": ("image", "sketch"),
    "import-image-underlay": ("image-underlay", "sketch-to-bim", "kernel-command"),
    "move-image-underlay": ("image-underlay", "sketch-to-bim", "kernel-command"),
    "scale-image-underlay": ("image-underlay", "sketch-to-bim", "kernel-command"),
    "rotate-image-underlay": ("image-underlay", "sketch-to-bim", "kernel-command"),
    "delete-image-underlay": ("image-underlay", "sketch-to-bim", "kernel-command"),
    "catalog-query": ("asset-catalog",),
    "family.upsert_type": ("family", "family-type", "kernel-command"),
    "family.place_instance": ("family", "family-instance", "kernel-command"),
    "asset.query": ("asset-catalog", "asset-library"),
    "asset.place": ("asset", "asset-library", "kernel-command"),
    "material.query": ("material", "material-catalog"),
    "material.upsert_pbr": ("material", "pbr", "kernel-command"),
    "material.assign": ("material", "kernel-command"),
    "material.paint_face": ("material", "paint", "kernel-command"),
    "decal.create": ("decal", "material", "kernel-command"),
    "list-concept-seeds": ("concept-seed",),
    "export-presentation": ("presentation", "export"),
    "export-branded-pdf": ("presentation", "export"),
    "export-render-bundle": ("render", "export"),
    "presentation-documentation-pack": (
        "presentation",
        "export",
        "documentation",
        "sheet",
        "schedule",
        "revision",
        "render",
    ),
    "external-model-call-audit-export": ("audit",),
    "import-neighborhood": ("site", "context"),
    "site.setup-georeference": ("site", "context", "kernel-command"),
    "site.upsert-site": ("site", "context", "kernel-command"),
    "site.graded-region-update": ("site", "toposolid", "kernel-command"),
    "site.graded-region-delete": ("site", "toposolid", "kernel-command"),
    "site.property-line-create": ("site", "property-line", "kernel-command"),
    "site.property-line-update": ("site", "property-line", "kernel-command"),
    "site.property-line-delete": ("site", "property-line", "kernel-command"),
    "site.project-base-point-create": ("site", "georeference", "kernel-command"),
    "site.project-base-point-move": ("site", "georeference", "kernel-command"),
    "site.project-base-point-rotate": ("site", "georeference", "kernel-command"),
    "site.survey-point-create": ("site", "georeference", "kernel-command"),
    "site.survey-point-move": ("site", "georeference", "kernel-command"),
    "site.sun-settings-create": ("site", "sun-settings", "kernel-command"),
    "site.sun-settings-update": ("site", "sun-settings", "kernel-command"),
    "site.toposolid-subdivision-update": ("site", "toposolid", "kernel-command"),
    "site.toposolid-subdivision-delete": ("site", "toposolid", "kernel-command"),
    "site.toposolid-excavation-create": ("site", "toposolid", "kernel-command"),
    "site.toposolid-excavation-update": ("site", "toposolid", "kernel-command"),
    "site.toposolid-excavation-delete": ("site", "toposolid", "kernel-command"),
}


def _mutability_for(
    category: Literal["query", "mutation", "transform", "job", "introspection"],
    side_effects: Literal["none", "mutates-kernel", "enqueues-job", "writes-audit"],
) -> Mutability:
    if category in {"query", "introspection"} and side_effects == "none":
        return "read"
    if category == "job" or side_effects == "enqueues-job":
        return "job"
    if category == "transform":
        return "transform"
    return "write"


def _schema_refs(
    name: str, input_schema: dict[str, Any], output_schema: dict[str, Any]
) -> list[str]:
    refs: list[str] = []
    for direction, schema in (("input", input_schema), ("output", output_schema)):
        title = schema.get("title")
        if isinstance(title, str) and title:
            refs.append(f"{direction}:{title}")
        schema_ref = schema.get("$ref")
        if isinstance(schema_ref, str) and schema_ref:
            refs.append(f"{direction}:{schema_ref}")
    return refs or [f"descriptor:{name}"]


@dataclass
class ToolDescriptor:
    name: str
    category: Literal["query", "mutation", "transform", "job", "introspection"]
    inputSchema: dict[str, Any]
    outputSchema: dict[str, Any]
    exitCodes: dict[str, ExitCode]
    cliExample: str
    restEndpoint: RestEndpoint
    sideEffects: Literal["none", "mutates-kernel", "enqueues-job", "writes-audit"]
    agentSafetyNotes: str | None = None
    stableId: str | None = None
    mutability: Mutability | None = None
    requiredPermissions: list[str] = field(default_factory=list)
    transport: Transport = "http"
    implementationStatus: ImplementationStatus = "implemented"
    unsupportedReason: str | None = None
    deprecatedReplacement: str | None = None
    requiresBrowser: bool = False
    createsExternalAssets: bool = False
    exportsData: bool = False
    schemaRefs: list[str] = field(default_factory=list)
    exampleRefs: list[str] = field(default_factory=list)
    kernelCommands: list[str] = field(default_factory=list)
    resourceGroups: list[str] = field(default_factory=list)
    uiFeatures: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.restEndpoint.path in _LEGACY_ENDPOINT_ALIASES:
            object.__setattr__(
                self, "restEndpoint", _LEGACY_ENDPOINT_ALIASES[self.restEndpoint.path]
            )

        if self.stableId is None:
            object.__setattr__(self, "stableId", self.name)
        if self.mutability is None:
            object.__setattr__(
                self,
                "mutability",
                _mutability_for(self.category, self.sideEffects),
            )
        if not self.requiredPermissions:
            permission = "model:read" if self.mutability in {"read", "transform"} else "model:write"
            if self.sideEffects == "writes-audit":
                permission = "model:share"
            object.__setattr__(self, "requiredPermissions", [permission])
        if self.name == "collab-ws":
            object.__setattr__(self, "transport", "websocket")
        if self.sideEffects == "enqueues-job":
            object.__setattr__(self, "createsExternalAssets", True)
        if "export" in self.name or self.name.endswith("-pdf"):
            object.__setattr__(self, "exportsData", True)
        if not self.schemaRefs:
            object.__setattr__(
                self,
                "schemaRefs",
                _schema_refs(self.name, self.inputSchema, self.outputSchema),
            )
        if not self.exampleRefs and self.cliExample:
            object.__setattr__(self, "exampleRefs", ["cliExample"])
        if not self.kernelCommands and self.name in _KERNEL_COMMANDS_BY_TOOL:
            object.__setattr__(self, "kernelCommands", list(_KERNEL_COMMANDS_BY_TOOL[self.name]))
        if not self.resourceGroups:
            groups = _RESOURCE_GROUPS_BY_TOOL.get(self.name)
            if groups is None and self.kernelCommands:
                groups = ("kernel-command",)
            object.__setattr__(self, "resourceGroups", list(groups or ()))
        if not self.uiFeatures and self.resourceGroups:
            object.__setattr__(
                self,
                "uiFeatures",
                [f"group:{group}" for group in self.resourceGroups],
            )


@dataclass
class ToolCatalog:
    schemaVersion: str
    tools: list[ToolDescriptor]


_registry: dict[str, ToolDescriptor] = {}


def register(descriptor: ToolDescriptor) -> None:
    _registry[descriptor.name] = descriptor


def get_catalog() -> ToolCatalog:
    return ToolCatalog(
        schemaVersion="api-v3.0",
        tools=list(_registry.values()),
    )


def get_descriptor(name: str) -> ToolDescriptor | None:
    return _registry.get(name)


# ---------------------------------------------------------------------------
# Seed: introspection tools (registered at import time)
# ---------------------------------------------------------------------------

_COMMON_ERROR_CODES: dict[str, ExitCode] = {
    "ok": ExitCode(code=0, meaning="Success"),
    "not_found": ExitCode(code=1, meaning="Tool name not found in registry"),
    "error": ExitCode(code=1, meaning="Unexpected error"),
}

register(
    ToolDescriptor(
        name="api-list-tools",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiListToolsInput",
            "type": "object",
            "properties": {
                "output": {
                    "type": "string",
                    "enum": ["json", "text"],
                    "default": "json",
                    "description": "Output format.",
                }
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ToolCatalog",
            "type": "object",
            "required": ["schemaVersion", "tools"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "tools": {
                    "type": "array",
                    "items": {"$ref": "#/definitions/ToolDescriptor"},
                },
            },
            "definitions": {
                "ToolDescriptor": {
                    "type": "object",
                    "required": [
                        "name",
                        "stableId",
                        "category",
                        "inputSchema",
                        "outputSchema",
                        "exitCodes",
                        "cliExample",
                        "restEndpoint",
                        "sideEffects",
                        "mutability",
                        "requiredPermissions",
                        "transport",
                        "implementationStatus",
                        "schemaRefs",
                        "exampleRefs",
                        "kernelCommands",
                        "resourceGroups",
                    ],
                    "properties": {
                        "name": {"type": "string"},
                        "stableId": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": ["query", "mutation", "transform", "job", "introspection"],
                        },
                        "inputSchema": {"type": "object"},
                        "outputSchema": {"type": "object"},
                        "exitCodes": {"type": "object"},
                        "cliExample": {"type": "string"},
                        "restEndpoint": {
                            "type": "object",
                            "required": ["method", "path"],
                            "properties": {
                                "method": {"type": "string", "enum": ["GET", "POST"]},
                                "path": {"type": "string"},
                            },
                        },
                        "sideEffects": {
                            "type": "string",
                            "enum": ["none", "mutates-kernel", "enqueues-job", "writes-audit"],
                        },
                        "mutability": {
                            "type": "string",
                            "enum": ["read", "write", "job", "transform"],
                        },
                        "requiredPermissions": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "transport": {
                            "type": "string",
                            "enum": ["http", "websocket"],
                        },
                        "implementationStatus": {
                            "type": "string",
                            "enum": ["implemented", "todo", "unsupported", "deprecated"],
                        },
                        "unsupportedReason": {"type": "string"},
                        "deprecatedReplacement": {"type": "string"},
                        "requiresBrowser": {"type": "boolean"},
                        "createsExternalAssets": {"type": "boolean"},
                        "exportsData": {"type": "boolean"},
                        "schemaRefs": {"type": "array", "items": {"type": "string"}},
                        "exampleRefs": {"type": "array", "items": {"type": "string"}},
                        "kernelCommands": {"type": "array", "items": {"type": "string"}},
                        "resourceGroups": {"type": "array", "items": {"type": "string"}},
                        "uiFeatures": {"type": "array", "items": {"type": "string"}},
                        "agentSafetyNotes": {"type": "string"},
                    },
                }
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Success")},
        cliExample="bim-ai api list-tools --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/tools"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only, no kernel side-effects.",
    )
)

register(
    ToolDescriptor(
        name="api-inspect",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiInspectInput",
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": {"type": "string", "description": "Tool name to inspect."},
                "output": {
                    "type": "string",
                    "enum": ["json", "text"],
                    "default": "json",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ToolDescriptor",
            "$ref": "#/definitions/ToolDescriptor",
            "definitions": {
                "ToolDescriptor": {
                    "type": "object",
                    "required": ["name", "category"],
                    "properties": {
                        "name": {"type": "string"},
                        "category": {"type": "string"},
                    },
                }
            },
        },
        exitCodes=_COMMON_ERROR_CODES,
        cliExample="bim-ai api inspect api-list-tools --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/tools/{name}"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only, no kernel side-effects.",
    )
)

register(
    ToolDescriptor(
        name="api-version",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiVersionInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ApiVersionOutput",
            "type": "object",
            "required": ["schemaVersion", "buildRef"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "buildRef": {"type": "string"},
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Success")},
        cliExample="bim-ai api version",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/version"),
        sideEffects="none",
    )
)

# ---------------------------------------------------------------------------
# Stubs: apply-bundle + model-show (CMD-V3-01 / query stubs)
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="apply-bundle",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandBundleRequest",
            "type": "object",
            "required": ["bundle"],
            "properties": {
                "bundle": {
                    "type": "object",
                    "required": ["schemaVersion", "commands", "assumptions", "parentRevision"],
                    "properties": {
                        "schemaVersion": {
                            "type": "string",
                            "enum": ["cmd-v3.0"],
                            "description": "Must be 'cmd-v3.0'.",
                        },
                        "commands": {
                            "type": "array",
                            "items": {"type": "object"},
                            "description": "Array of kernel commands to apply atomically.",
                        },
                        "assumptions": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                                "type": "object",
                                "required": ["key", "value", "confidence", "source"],
                                "properties": {
                                    "key": {"type": "string", "minLength": 1},
                                    "value": {},
                                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                                    "source": {"type": "string"},
                                    "contestable": {"type": "boolean", "default": True},
                                    "evidence": {"type": "string"},
                                },
                            },
                            "description": "CMD-V3-02 contract — non-empty assumption log.",
                        },
                        "parentRevision": {
                            "type": "integer",
                            "description": "Optimistic-concurrency lock: must match current model revision.",
                        },
                        "targetOptionId": {
                            "type": "string",
                            "description": "OPT-V3-01: design option target. Absent = current model state.",
                        },
                        "tolerances": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["advisoryClass", "reason"],
                                "properties": {
                                    "advisoryClass": {"type": "string"},
                                    "reason": {"type": "string"},
                                },
                            },
                            "description": "Explicit overrides; recorded in audit log (T3 activity stream).",
                        },
                    },
                    "additionalProperties": False,
                },
                "mode": {
                    "type": "string",
                    "enum": ["dry_run", "commit"],
                    "default": "dry_run",
                    "description": "dry_run: validate only; commit: apply if no blocking advisories.",
                },
                "userId": {
                    "type": "string",
                    "description": "User identity for undo-stack attribution.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "optionId": {"type": "string"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "checkpointSnapshotId": {
                    "type": "string",
                    "description": "SHA-256 of post-bundle element state; hand-off to VG-V3-01.",
                },
                "elements": {
                    "type": "object",
                    "description": "Post-commit element map. Each element may carry agentTrace when CMD-V3-02 is active.",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "agentTrace": {
                                "type": "object",
                                "description": "CMD-V3-02: provenance trace linking element to its originating bundle.",
                                "properties": {
                                    "bundleId": {"type": "string"},
                                    "assumptionKeys": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "appliedAt": {"type": "string", "format": "date-time"},
                                },
                                "required": ["bundleId", "assumptionKeys", "appliedAt"],
                            }
                        },
                    },
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle applied (commit) or validated (dry-run)"),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "assumption_log_required": ExitCode(
                code=3, meaning="assumptions field missing or malformed"
            ),
            "assumption_log_malformed": ExitCode(
                code=4, meaning="assumption entry is missing required field or has invalid value"
            ),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            "bim-ai apply-bundle bundle.json --base 1 --dry-run\n"
            "bim-ai apply-bundle bundle.json --base 1 --commit\n"
            "bim-ai apply-bundle bundle.json --base 1 --commit --tolerate constraint_error"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Default mode is --dry-run; always validate first. "
            "parentRevision must equal current model revision or the call is rejected with revision_conflict (HTTP 409). "
            "assumptions is required and non-empty (CMD-V3-02 contract). "
            "targetOptionId 'main' is permanently forbidden. "
            "Same bundle + same parentRevision -> same BundleResult (deterministic)."
        ),
    )
)

register(
    ToolDescriptor(
        name="collab-ws",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CollabWsInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CollabWsOutput",
            "description": "WebSocket endpoint — no HTTP response body. Speaks the yjs Y-WebSocket protocol.",
            "type": "object",
            "properties": {},
        },
        exitCodes={
            "ok": ExitCode(
                code=0, meaning="Connection accepted; yjs sync + awareness relay active"
            ),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="# connect via any yjs WebsocketProvider: ws://<host>/api/models/<id>/collab",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/collab"),
        sideEffects="none",
        agentSafetyNotes=(
            "WebSocket endpoint only. Relays raw yjs bytes; does not mutate kernel state. "
            "Commits still go through POST /api/models/{model_id}/bundles (CMD-V3-01)."
        ),
    )
)

register(
    ToolDescriptor(
        name="model.dry_run",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelDryRunInput",
            "type": "object",
            "required": ["modelId", "commands"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "commands": {
                    "type": "array",
                    "minItems": 1,
                    "items": {"type": "object"},
                    "description": "Kernel commands to validate through the authoritative bundle pipeline.",
                },
                "userId": {
                    "type": "string",
                    "default": "local-dev",
                    "description": "User identity for diagnostics attribution.",
                },
                "clientOpId": {
                    "type": "string",
                    "description": "Optional idempotency/correlation id supplied by the caller.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelDryRunResult",
            "type": "object",
            "required": ["ok", "modelId", "reason", "violations", "summaryBefore"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "reason": {"type": "string"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "summaryBefore": {"type": "object"},
                "summaryAfter": {"type": ["object", "null"]},
                "wouldRevision": {"type": ["integer", "null"]},
                "appliedCommandsPreview": {"type": "array", "items": {"type": "object"}},
                "replayDiagnostics": {"type": "object"},
                "agentBriefCommandProtocol_v1": {"type": "object"},
                "agentGeneratedBundleQaChecklist_v1": {"type": "object"},
                "agentBriefAcceptanceReadout_v1": {"type": "object"},
                "agentReviewReadoutConsistencyClosure_v1": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle validated without mutating the model"),
            "invalid_bundle": ExitCode(code=1, meaning="Bundle payload could not be validated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai apply-bundle bundle.json --base 1 --dry-run",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/commands/bundle/dry-run"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Validation only: this route computes would-apply summaries and diagnostics without persisting. "
            "It delegates to try_commit_bundle, the same deterministic kernel boundary used by commits."
        ),
        schemaRefs=["input:BundleEnvelope", "output:ModelDryRunResult"],
        exampleRefs=["cli:apply-bundle:dry-run"],
        kernelCommands=["*"],
        resourceGroups=["model", "transaction", "kernel-command"],
        uiFeatures=["transaction:dry-run", "group:model", "group:transaction"],
    )
)

register(
    ToolDescriptor(
        name="model.commit_bundle",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelCommitBundleInput",
            "type": "object",
            "required": ["modelId", "bundle"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "bundle": {
                    "type": "object",
                    "required": ["schemaVersion", "commands", "assumptions"],
                    "properties": {
                        "schemaVersion": {"type": "string", "enum": ["cmd-v3.0"]},
                        "commands": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"type": "object"},
                        },
                        "assumptions": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"type": "object"},
                            "description": "CMD-V3-02 non-empty assumption log.",
                        },
                        "parentRevision": {
                            "type": "integer",
                            "description": "Optimistic-concurrency lock for the authoritative commit route.",
                        },
                        "targetOptionId": {"type": "string"},
                        "tolerances": {"type": "array", "items": {"type": "object"}},
                    },
                    "additionalProperties": False,
                },
                "mode": {
                    "type": "string",
                    "const": "commit",
                    "default": "commit",
                    "description": "Typed MCP surface for committing; dry-runs use model.dry_run.",
                },
                "userId": {"type": "string", "default": "local-dev"},
                "submitter": {"type": "string", "default": "agent"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "optionId": {"type": "string"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "checkpointSnapshotId": {"type": "string"},
                "elements": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle committed through CMD-V3-01"),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "assumption_log_required": ExitCode(
                code=3, meaning="assumptions field missing or malformed"
            ),
            "assumption_log_malformed": ExitCode(
                code=4, meaning="assumption entry is missing required field or has invalid value"
            ),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json --base 1 --commit",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Commits only through the existing CMD-V3-01 apply-bundle route; use model.dry_run first. "
            "parentRevision and CMD-V3-02 assumptions are enforced by the authoritative route."
        ),
        schemaRefs=["input:CommandBundleRequest", "output:BundleResult"],
        exampleRefs=["cli:apply-bundle:commit"],
        kernelCommands=["*"],
        resourceGroups=["model", "transaction", "kernel-command"],
        uiFeatures=["transaction:commit", "group:model", "group:transaction"],
    )
)

# ---------------------------------------------------------------------------
# M3-B — Documentation/export product pack
# ---------------------------------------------------------------------------

_POINT_2_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["xMm", "yMm"],
    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
    "additionalProperties": False,
}

_SHEET_VIEWPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["viewportId", "viewRef", "xMm", "yMm", "widthMm", "heightMm"],
    "properties": {
        "viewportId": {"type": "string"},
        "viewRef": {
            "type": "string",
            "description": "Stable reference such as plan:<id>, section:<id>, elevation:<id>, schedule:<id>.",
        },
        "label": {"type": "string"},
        "xMm": {"type": "number"},
        "yMm": {"type": "number"},
        "widthMm": {"type": "number", "exclusiveMinimum": 0},
        "heightMm": {"type": "number", "exclusiveMinimum": 0},
        "cropMinMm": _POINT_2_SCHEMA,
        "cropMaxMm": _POINT_2_SCHEMA,
    },
    "additionalProperties": True,
}

_CMD_V3_BUNDLE_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SemanticAuthoringBundle",
    "type": "object",
    "required": ["operation", "commands", "metadata"],
    "properties": {
        "operation": {"type": "string"},
        "commands": {"type": "array", "items": {"type": "object"}},
        "todo": {"type": "array", "items": {"type": "object"}},
        "metadata": {"type": "object"},
    },
}

_SLAB_OPENING_INPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SlabOpeningInput",
    "type": "object",
    "required": ["hostFloorId", "boundaryMm"],
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "hostFloorId": {"type": "string"},
        "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
        "isShaft": {"type": "boolean", "default": False},
    },
    "additionalProperties": False,
}


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


_STRUCTURE_CONSTRUCTION_SCHEMAS: dict[str, dict[str, Any]] = {
    "structure.column": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureColumnInput",
        "type": "object",
        "required": ["levelId", "positionMm"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "levelId": {"type": "string"},
            "positionMm": _POINT_2_SCHEMA,
            "bMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
            "hMm": {"type": "number", "exclusiveMinimum": 0, "default": 300},
            "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 2800},
            "rotationDeg": {"type": "number", "default": 0},
            "materialKey": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "structure.beam": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureBeamInput",
        "type": "object",
        "required": ["levelId", "startMm", "endMm"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "levelId": {"type": "string"},
            "startMm": _POINT_2_SCHEMA,
            "endMm": _POINT_2_SCHEMA,
            "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 200},
            "heightMm": {"type": "number", "exclusiveMinimum": 0, "default": 400},
            "materialKey": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "structure.column_update": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureColumnUpdateInput",
        "type": "object",
        "required": ["id"],
        "properties": {
            "id": {"type": "string"},
            "bMm": {"type": "number", "exclusiveMinimum": 0},
            "hMm": {"type": "number", "exclusiveMinimum": 0},
        },
        "additionalProperties": False,
    },
    "structure.constraint": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StructureConstraintInput",
        "type": "object",
        "required": ["rule", "refsA", "refsB"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "rule": {
                "type": "string",
                "enum": [
                    "equal_distance",
                    "equal_length",
                    "parallel",
                    "perpendicular",
                    "collinear",
                ],
            },
            "refsA": {"type": "array", "minItems": 1, "items": {"type": "object"}},
            "refsB": {"type": "array", "minItems": 1, "items": {"type": "object"}},
            "lockedValueMm": {"type": "number"},
            "severity": {"type": "string", "enum": ["warning", "error"], "default": "error"},
        },
        "additionalProperties": False,
    },
    "construction.package": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionPackageInput",
        "type": "object",
        "required": ["name"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "code": {"type": "string"},
            "phaseId": {"type": "string"},
            "plannedStart": {"type": "string"},
            "plannedEnd": {"type": "string"},
            "actualStart": {"type": "string"},
            "actualEnd": {"type": "string"},
            "responsibleCompany": {"type": "string"},
            "dependencies": {"type": "array", "items": {"type": "string"}},
        },
        "additionalProperties": False,
    },
    "construction.logistics": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionLogisticsInput",
        "type": "object",
        "required": ["name", "logisticsKind"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "logisticsKind": {"type": "string"},
            "boundaryMm": {"type": "array", "minItems": 3, "items": _POINT_2_SCHEMA},
            "pathMm": {"type": "array", "minItems": 2, "items": _POINT_2_SCHEMA},
            "phaseId": {"type": "string"},
            "constructionPackageId": {"type": "string"},
            "plannedStart": {"type": "string"},
            "plannedEnd": {"type": "string"},
            "progressStatus": {"type": "string"},
            "responsibleCompany": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "construction.qa_checklist": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "ConstructionQaChecklistInput",
        "type": "object",
        "required": ["name"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "targetElementIds": {"type": "array", "items": {"type": "string"}},
            "constructionPackageId": {"type": "string"},
            "phaseId": {"type": "string"},
            "responsibleCompany": {"type": "string"},
            "progressStatus": {"type": "string"},
            "checklist": {"type": "array", "items": {"type": "object"}},
        },
        "additionalProperties": False,
    },
}

for _tool_name, _schema in _STRUCTURE_CONSTRUCTION_SCHEMAS.items():
    _group = "structure" if _tool_name.startswith("structure.") else "construction"
    register(
        ToolDescriptor(
            name=_tool_name,
            category="mutation",
            inputSchema=_schema,
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Typed semantic authoring bundle generated"),
                "invalid": ExitCode(code=422, meaning="Invalid semantic authoring payload"),
            },
            cliExample=f"bim-ai {_group} {_tool_name.split('.', 1)[1].replace('_', '-')} --json",
            restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=(
                "Generates typed kernel commands only; submit through model.dry_run or "
                "model.commit_bundle for revision, permission, and advisor checks."
            ),
            schemaRefs=[f"input:{_schema['title']}", "output:SemanticAuthoringBundle"],
            exampleRefs=[f"cli:{_group}:{_tool_name.split('.', 1)[1]}"],
            resourceGroups=["semantic-authoring", _group, "kernel-command"],
            uiFeatures=(
                ["tool:structure", "cmd-k:structure-lens"]
                if _group == "structure"
                else ["lens:construction", "cmd-k:construction-lens"]
            ),
        )
    )

register(
    ToolDescriptor(
        name="author.stair_between_levels",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StairBetweenLevelsInput",
            "type": "object",
            "required": ["baseLevelId", "topLevelId", "runStartMm", "runEndMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "baseLevelId": {"type": "string"},
                "topLevelId": {"type": "string"},
                "runStartMm": _POINT_2_SCHEMA,
                "runEndMm": _POINT_2_SCHEMA,
                "widthMm": {"type": "number", "exclusiveMinimum": 0, "default": 1000},
                "riserMm": {"type": "number", "exclusiveMinimum": 0, "default": 175},
                "treadMm": {"type": "number", "exclusiveMinimum": 0, "default": 275},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createStair bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid stair payload"),
        },
        cliExample=(
            "bim-ai author stair-between-levels --base-level lvl-0 --top-level lvl-1 "
            "--run '1000,1000;1000,4200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates createStair only; submit through model.dry_run or model.commit_bundle for "
            "transaction safety and advisor validation."
        ),
        schemaRefs=["input:StairBetweenLevelsInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:author:stair-between-levels"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "kernel-command"],
        uiFeatures=["tool:stair", "cmd-k:tool.stair"],
    )
)

register(
    ToolDescriptor(
        name="opening.slab_opening",
        category="mutation",
        inputSchema=_SLAB_OPENING_INPUT_SCHEMA,
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createSlabOpening bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid slab opening payload"),
        },
        cliExample=(
            "bim-ai opening slab-opening --floor floor-1 --boundary "
            "'1000,1000;2200,1000;2200,2200;1000,2200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Host floor id must be resolved before calling; dry-run before commit.",
        schemaRefs=["input:SlabOpeningInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:opening:slab-opening"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "opening", "kernel-command"],
        uiFeatures=["tool:vertical-opening", "cmd-k:tool.floor-opening"],
    )
)

register(
    ToolDescriptor(
        name="opening.shaft_opening",
        category="mutation",
        inputSchema={
            **_SLAB_OPENING_INPUT_SCHEMA,
            "title": "ShaftOpeningInput",
            "properties": {
                **_SLAB_OPENING_INPUT_SCHEMA["properties"],
                "isShaft": {"type": "boolean", "const": True, "default": True},
            },
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed shaft createSlabOpening bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid shaft opening payload"),
        },
        cliExample=(
            "bim-ai opening shaft-opening --floor floor-1 --boundary "
            "'1000,1000;2200,1000;2200,2200;1000,2200' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates one shaft-marked slab opening on an explicit floor. Multi-floor shaft "
            "propagation still requires one typed opening per host floor."
        ),
        schemaRefs=["input:ShaftOpeningInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:opening:shaft-opening"],
        resourceGroups=[
            "semantic-authoring",
            "vertical-circulation",
            "opening",
            "shaft",
            "kernel-command",
        ],
        uiFeatures=["tool:shaft-opening", "cmd-k:tool.shaft"],
    )
)

register(
    ToolDescriptor(
        name="author.railing",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RailingInput",
            "type": "object",
            "required": ["pathMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "hostedStairId": {"type": "string"},
                "hostFloorId": {"type": "string"},
                "hostWallId": {"type": "string"},
                "hostEdgeId": {"type": "string"},
                "pathMm": {"type": "array", "minItems": 2, "items": _POINT_2_SCHEMA},
                "guardHeightMm": {"type": "number", "exclusiveMinimum": 0},
                "balusterPattern": {"type": "object"},
                "handrailSupports": {"type": "array", "items": {"type": "object"}},
                "materialSlots": {"type": "object"},
            },
            "additionalProperties": False,
        },
        outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Typed createRailing bundle generated"),
            "invalid": ExitCode(code=422, meaning="Invalid railing payload"),
        },
        cliExample="bim-ai author railing --hosted-stair stair-1 --path '1000,1000;1000,4200' --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Railing path is explicit 2D model geometry. Use hostedStairId when it follows a stair; "
            "dry-run catches invalid baluster/support payloads."
        ),
        schemaRefs=["input:RailingInput", "output:SemanticAuthoringBundle"],
        exampleRefs=["cli:author:railing"],
        resourceGroups=["semantic-authoring", "vertical-circulation", "railing", "kernel-command"],
        uiFeatures=["tool:railing", "cmd-k:tool.railing"],
    )
)

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

register(
    ToolDescriptor(
        name="document.create_drawing_set",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateDrawingSetInput",
            "type": "object",
            "required": ["modelId", "sheet"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "parentRevision": {
                    "type": "integer",
                    "description": "Optimistic-concurrency lock passed into the cmd-v3 bundle.",
                },
                "sheet": {
                    "type": "object",
                    "required": ["id", "name"],
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "titleBlock": {"type": "string"},
                        "paperWidthMm": {"type": "number"},
                        "paperHeightMm": {"type": "number"},
                        "titleblockParameters": {
                            "type": "object",
                            "additionalProperties": {"type": "string"},
                        },
                    },
                    "additionalProperties": False,
                },
                "viewportsMm": {
                    "type": "array",
                    "items": _SHEET_VIEWPORT_SCHEMA,
                    "description": "Sheet viewport placements written by upsertSheetViewports.",
                },
                "schedules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "name"],
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "sheetId": {"type": "string"},
                            "filters": {"type": "object"},
                            "grouping": {"type": "object"},
                        },
                        "additionalProperties": False,
                    },
                },
                "tags": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["hostElementId", "hostViewId", "positionMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "hostElementId": {"type": "string"},
                            "hostViewId": {"type": "string"},
                            "positionMm": _POINT_2_SCHEMA,
                            "tagDefinitionId": {"type": "string"},
                            "textOverride": {"type": "string"},
                        },
                        "additionalProperties": False,
                    },
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["levelId", "aMm", "bMm", "offsetMm"],
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "levelId": {"type": "string"},
                            "aMm": _POINT_2_SCHEMA,
                            "bMm": _POINT_2_SCHEMA,
                            "offsetMm": _POINT_2_SCHEMA,
                            "anchorA": {"type": "object"},
                            "anchorB": {"type": "object"},
                            "refElementIdA": {"type": "string"},
                            "refElementIdB": {"type": "string"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DrawingSetBundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "elements": {"type": "object"},
                "violations": {"type": "array", "items": {"type": "object"}},
                "artifactOutputs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["kind", "route"],
                        "properties": {
                            "kind": {"type": "string", "enum": ["pdf", "ifc", "gltf", "glb"]},
                            "route": {"type": "string"},
                            "contentType": {"type": "string"},
                        },
                    },
                    "description": "Follow-up export routes available after commit.",
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Drawing set bundle committed or dry-run validated"),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "invalid_bundle": ExitCode(code=1, meaning="Generated documentation bundle invalid"),
        },
        cliExample=(
            "bim-ai documentation pack --sheet-id A101 --sheet-name 'GA Plan' "
            '--viewports \'[{"viewportId":"vp-plan","viewRef":"plan:plan-gf","xMm":20,"yMm":20,"widthMm":160,"heightMm":110}]\' '
            "--schedule-id sch-rooms --schedule-category room --place-schedule --dry-run"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates/replaces documentation elements through cmd-v3 commands: upsertSheet, "
            "upsertSheetViewports, upsertSchedule, placeTag, and createDimension. "
            "Use dry_run before commit. Exports are separate read-only routes; this tool mutates only "
            "model documentation state and does not write external files by itself."
        ),
        schemaRefs=["input:CreateDrawingSetInput", "output:DrawingSetBundleResult"],
        exampleRefs=["cli:documentation:pack"],
        kernelCommands=[
            "upsertSheet",
            "upsertSheetViewports",
            "upsertSchedule",
            "placeTag",
            "createDimension",
        ],
        resourceGroups=["document", "sheet", "viewport", "schedule", "tag", "dimension"],
        uiFeatures=[
            "group:sheet",
            "group:schedule",
            "group:documentation",
            "export:pdf",
        ],
    )
)

register(
    ToolDescriptor(
        name="presentation-documentation-pack",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationDocumentationPackInput",
            "type": "object",
            "required": ["modelId", "sheetId", "canvasId", "viewId"],
            "properties": {
                "modelId": {"type": "string"},
                "sheetId": {"type": "string"},
                "canvasId": {"type": "string"},
                "viewId": {"type": "string"},
                "brandTemplateId": {"type": "string", "default": "bt-client-pack"},
                "scheduleId": {"type": "string", "default": "sch-client-pack"},
                "scheduleCategory": {"type": "string", "default": "room"},
                "frames": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Optional create_frame payload fragments for deck slides.",
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationDocumentationPackResult",
            "type": "object",
            "required": ["ok", "revision"],
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
                "appliedCommands": {"type": "array", "items": {"type": "object"}},
                "evidenceRoutes": {
                    "type": "object",
                    "properties": {
                        "presentation": {"type": "string"},
                        "brandedPdf": {"type": "string"},
                        "renderBundle": {"type": "string"},
                    },
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(
                code=0,
                meaning="Presentation/documentation pack committed or dry-run validated",
            ),
            "revision_conflict": ExitCode(
                code=2, meaning="parentRevision does not match current revision"
            ),
            "invalid_bundle": ExitCode(code=1, meaning="Generated presentation pack invalid"),
        },
        cliExample=(
            "bim-ai documentation presentation-pack --sheet-id A101 --canvas-id deck-client "
            "--view-id plan-gf --brand-template-id bt-client --schedule-id sch-rooms --dry-run"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Creates a client-facing pack through typed commands: create_brand_template, "
            "upsertViewTemplate, applyPlanViewTemplate, upsertSheet, upsertSchedule, "
            "create_schedule_view, upsertSheetViewports, createRevisionCloud, "
            "create_presentation_canvas, and create_frame. Follow with read-only "
            "presentation, branded PDF, render bundle, and documentation evidence exports."
        ),
        schemaRefs=[
            "input:PresentationDocumentationPackInput",
            "output:PresentationDocumentationPackResult",
        ],
        exampleRefs=["cli:documentation:presentation-pack"],
        kernelCommands=[
            "create_brand_template",
            "upsertViewTemplate",
            "applyPlanViewTemplate",
            "upsertSheet",
            "upsertSchedule",
            "create_schedule_view",
            "upsertSheetViewports",
            "createRevisionCloud",
            "create_presentation_canvas",
            "create_frame",
        ],
        resourceGroups=[
            "presentation",
            "export",
            "documentation",
            "sheet",
            "schedule",
            "revision",
            "render",
        ],
        uiFeatures=[
            "group:presentation",
            "group:documentation",
            "group:schedule",
            "export:branded-pdf",
            "export:render-bundle",
        ],
    )
)

_EXPORT_BINARY_RESPONSE_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "ExportArtifactResponse",
    "type": "object",
    "required": ["artifact", "evidence", "limitations"],
    "properties": {
        "artifact": {
            "type": "object",
            "required": ["contentType", "filename", "route"],
            "properties": {
                "contentType": {"type": "string"},
                "filename": {"type": "string"},
                "route": {"type": "string"},
            },
        },
        "evidence": {
            "type": "object",
            "properties": {
                "manifestRoute": {"type": "string"},
                "determinism": {"type": "string"},
                "correlation": {"type": "string"},
            },
        },
        "limitations": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": True,
}

register(
    ToolDescriptor(
        name="export.pdf",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportPdfInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "sheetId": {
                    "type": "string",
                    "description": "Optional sheet id; first sheet is used if omitted.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="PDF bytes returned"),
            "not_found": ExitCode(code=1, meaning="Model or sheet not found"),
        },
        cliExample="bim-ai export pdf --sheet-id A101 --out A101.pdf",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/exports/sheet-preview.pdf"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only sheet PDF artifact. The PDF is a server-side sheet preview/export listing path; "
            "full browser print raster is separately exposed as sheet-print-raster.png with contract headers."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportPdfInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:pdf"],
        resourceGroups=["export", "document", "sheet", "pdf"],
        uiFeatures=["project.export-pdf", "group:sheet"],
    )
)

register(
    ToolDescriptor(
        name="export.ifc",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportIfcInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="IFC STEP bytes returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai export ifc --out model.ifc",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/exports/model.ifc"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only IFC STEP export. Use /exports/ifc-manifest for exchange evidence and coverage; "
            "geometry/material coverage is limited to kernel elements currently supported by export_ifc_model_step."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportIfcInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:ifc", "route:export:ifc-manifest"],
        resourceGroups=["export", "ifc"],
        uiFeatures=["project.export-ifc"],
    )
)

register(
    ToolDescriptor(
        name="export.gltf",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportGltfInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="glTF JSON returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai export gltf --out model.gltf",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/exports/model.gltf"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only glTF JSON export. Use /exports/gltf-manifest for visual/export evidence and "
            "material diagnostics; binary GLB is available via export.glb."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportGltfInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:gltf", "route:export:gltf-manifest"],
        resourceGroups=["export", "gltf", "visual"],
        uiFeatures=["project.export-gltf"],
    )
)

register(
    ToolDescriptor(
        name="export.glb",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportGlbInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema=_EXPORT_BINARY_RESPONSE_SCHEMA,
        exitCodes={
            "ok": ExitCode(code=0, meaning="Binary GLB bytes returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai export glb --out model.glb",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/exports/model.glb"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only binary glTF export. Evidence and limitations are reported by "
            "/exports/gltf-manifest before or after downloading the binary artifact."
        ),
        requiredPermissions=["model:read"],
        exportsData=True,
        schemaRefs=["input:ExportGlbInput", "output:ExportArtifactResponse"],
        exampleRefs=["cli:export:glb", "route:export:gltf-manifest"],
        resourceGroups=["export", "gltf", "visual"],
        uiFeatures=["project.export-gltf"],
    )
)

register(
    ToolDescriptor(
        name="set-tool-pref",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetToolPrefInput",
            "type": "object",
            "required": ["tool", "pref_key", "pref_value"],
            "properties": {
                "tool": {
                    "type": "string",
                    "description": "Authoring tool name (e.g. 'wall', 'door', 'window').",
                },
                "pref_key": {
                    "type": "string",
                    "description": "Modifier key (e.g. 'alignment', 'swingSide', 'multipleMode').",
                },
                "pref_value": {
                    "type": "string",
                    "description": "Serialised value (booleans as 'true'/'false').",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetToolPrefOutput",
            "type": "object",
            "required": ["ok", "revision"],
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Pref stored; revision incremented"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai tool-pref set --tool wall --pref alignment --value center",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/commands"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "CHR-V3-08: stores a sticky modifier preference on the document. "
            "The command type discriminator is 'setToolPref'. "
            "pref_value must be a string; booleans serialised as 'true'/'false'."
        ),
    )
)

# ---------------------------------------------------------------------------
# SKB readiness — QA/advisor product surfaces
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="qa.advisor",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAdvisorInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "profile": {
                    "type": "string",
                    "default": "authoring_default",
                    "description": "Constructability/advisor profile to evaluate.",
                },
                "severity": {"type": "string", "enum": ["info", "warning", "error"]},
                "elementIds": {"type": "array", "items": {"type": "string"}},
                "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAdvisorResult",
            "type": "object",
            "required": ["format", "profile", "findings", "summary"],
            "properties": {
                "format": {"const": "qaAdvisor_v1"},
                "profile": {"type": "string"},
                "findings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "ruleId": {"type": "string"},
                            "severity": {"type": "string"},
                            "message": {"type": "string"},
                            "recommendation": {"type": "string"},
                            "elementIds": {"type": "array", "items": {"type": "string"}},
                            "blockingClass": {"type": "string"},
                        },
                        "additionalProperties": True,
                    },
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "findingCount": {"type": "integer"},
                        "returnedCount": {"type": "integer"},
                        "severityCounts": {"type": "object"},
                    },
                    "additionalProperties": True,
                },
                "limitations": {"type": "array", "items": {"type": "string"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Advisor findings returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai qa advisor --output json --severity warning",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/qa/advisor"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Advisor surface for agent refinement. Findings preserve severity, "
            "profile, recommendation, and affected element ids where available."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaAdvisorInput", "output:QaAdvisorResult"],
        exampleRefs=["cli:qa:advisor", "route:qa:advisor"],
        resourceGroups=["qa", "advisor", "constructability", "sketch-to-bim"],
        uiFeatures=["advisor-panel", "group:advisor"],
    )
)

register(
    ToolDescriptor(
        name="qa.constructability",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaConstructabilityInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "profile": {"type": "string", "default": "authoring_default"},
                "phaseFilter": {"type": "string", "default": "all"},
                "optionLocks": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaConstructabilityReport",
            "type": "object",
            "required": ["modelId", "summary"],
            "properties": {
                "modelId": {"type": "string"},
                "profile": {"type": "string"},
                "summary": {"type": "object"},
                "issues": {"type": "array", "items": {"type": "object"}},
                "viewpoints": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Constructability report returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample=(
            "curl /api/models/$BIM_AI_MODEL_ID/constructability-report?profile=authoring_default"
        ),
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/constructability-report"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only constructability profile report for phase acceptance. Use qa.advisor "
            "when an element-filterable warning/info/error list is needed."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaConstructabilityInput", "output:QaConstructabilityReport"],
        exampleRefs=["route:constructability-report"],
        resourceGroups=["qa", "constructability", "profile", "sketch-to-bim"],
        uiFeatures=["advisor-panel", "construction-lens", "group:constructability"],
    )
)

register(
    ToolDescriptor(
        name="model-show",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelShowInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSnapshot",
            "type": "object",
            "required": ["modelId", "revision", "elements"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "elements": {"type": "object"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai snapshot  # (BIM_AI_MODEL_ID must be set)",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/snapshot"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only snapshot.",
        stableId="model-show",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ModelShowInput", "output:ModelSnapshot"],
        exampleRefs=["route:model-snapshot", "cli:snapshot"],
        resourceGroups=["model", "snapshot", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["model-browser", "workspace"],
    )
)

register(
    ToolDescriptor(
        name="model.summary",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSummaryInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSummaryResource",
            "type": "object",
            "required": ["modelId", "revision", "summary"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "summary": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Model summary returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai model summary --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/summary"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only compact model resource for planning. Use snapshot or query.elements "
            "when element payloads are required."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:ModelSummaryInput", "output:ModelSummaryResource"],
        exampleRefs=["route:model-summary", "cli:model:summary"],
        resourceGroups=["model", "summary", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["model-browser", "workspace-summary"],
    )
)

register(
    ToolDescriptor(
        name="model.command_log",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelCommandLogInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelCommandLog",
            "type": "object",
            "required": ["modelId", "revision", "commands"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "commands": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Recent command log returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="curl /api/models/$BIM_AI_MODEL_ID/command-log",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/command-log"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only audit trail for recent model commits, undo metadata, command payloads, "
            "and agent/user attribution when recorded."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:ModelCommandLogInput", "output:ModelCommandLog"],
        exampleRefs=["route:model-command-log"],
        resourceGroups=["model", "command-log", "audit", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["activity-stream", "undo-redo"],
    )
)

register(
    ToolDescriptor(
        name="evidence.package",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "EvidencePackageInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "EvidencePackage",
            "type": "object",
            "required": ["format", "modelId", "revision", "summary", "validate"],
            "properties": {
                "format": {"const": "evidencePackage_v1"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "summary": {"type": "object"},
                "validate": {"type": "object"},
                "advisorSeveritySummary_v1": {"type": "object"},
                "semanticDigestSha256": {"type": "string"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Evidence package returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai evidence-package --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/evidence-package"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only evidence package for agent review. It includes validation, summary, "
            "export links, deterministic evidence manifests, and Advisor severity rollups; "
            "live screenshot capture remains a separate evidence step."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:EvidencePackageInput", "output:EvidencePackage"],
        exampleRefs=["route:evidence-package", "cli:evidence-package"],
        resourceGroups=["evidence", "model", "validation", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["agent-review", "advisor-panel"],
    )
)

register(
    ToolDescriptor(
        name="commands.schema.catalog",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaCatalogInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaCatalog",
            "type": "object",
            "required": ["schemaVersion", "commandCount", "commandNames", "schemas", "metadata"],
            "properties": {
                "schemaVersion": {"const": "command-schemas-v1"},
                "commandCount": {"type": "integer"},
                "commandNames": {"type": "array", "items": {"type": "string"}},
                "schemas": {"type": "object"},
                "metadata": {
                    "type": "object",
                    "description": (
                        "Per-command metadata keyed by discriminator. Each row includes "
                        "a generated example, example status, rawSemanticMapping, and "
                        "mappingStatus ('mapped' or 'explicit-raw-expert')."
                    ),
                },
                "unionSchema": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Kernel command schemas returned")},
        cliExample="bim-ai api list-commands --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/commands"),
        sideEffects="none",
        agentSafetyNotes=(
            "Exports the full backend Command union as per-command JSON Schemas. "
            "Each command carries a generated minimal example plus raw/semantic mapping "
            "metadata; commands without a typed descriptor are explicitly marked raw/expert."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:CommandSchemaCatalogInput", "output:CommandSchemaCatalog"],
        exampleRefs=["route:v3-commands"],
        resourceGroups=["api-descriptor", "command-schema", "kernel-command", "mcp-resource"],
        uiFeatures=["developer-tools"],
    )
)

register(
    ToolDescriptor(
        name="commands.schema.inspect",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaInspectInput",
            "type": "object",
            "required": ["name"],
            "properties": {"name": {"type": "string", "description": "Kernel command type."}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaInspectResult",
            "type": "object",
            "required": ["schemaVersion", "name", "schema", "metadata"],
            "properties": {
                "schemaVersion": {"const": "command-schemas-v1"},
                "name": {"type": "string"},
                "schema": {"type": "object"},
                "metadata": {
                    "type": "object",
                    "description": (
                        "Command metadata with generated example, exampleStatus, "
                        "rawSemanticMapping, and mappingStatus."
                    ),
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Kernel command schema returned"),
            "not_found": ExitCode(code=1, meaning="Command not found"),
        },
        cliExample="bim-ai api inspect-command createWall --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/commands/{name}"),
        sideEffects="none",
        agentSafetyNotes=(
            "Inspect a single backend command schema. The schema is executable through "
            "raw apply-bundle, but first-class semantic descriptors remain preferred "
            "where available."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:CommandSchemaInspectInput", "output:CommandSchemaInspectResult"],
        exampleRefs=["route:v3-command"],
        resourceGroups=["api-descriptor", "command-schema", "kernel-command", "mcp-resource"],
        uiFeatures=["developer-tools"],
    )
)

register(
    ToolDescriptor(
        name="query.elements",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryElementsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "filter": {"type": "object"},
                "include": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["geometrySummary", "hostRefs", "scheduleSummary", "raw"],
                    },
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 1000},
                "cursor": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryResolveEnvelope",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data", "warnings"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
                "nextCursor": {"type": ["string", "null"]},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Matching elements returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported filter/include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query elements --category wall --include geometrySummary --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/elements"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only element discovery for replacing UI selection. Supports category, "
            "level, type, bbox, property, and createdBy-style filters where implemented."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryElementsInput", "output:QueryResolveEnvelope"],
        exampleRefs=["route:query-elements", "cli:query:elements"],
        resourceGroups=["query", "elements", "model", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["selection", "model-browser", "inspector"],
    )
)

register(
    ToolDescriptor(
        name="query.levels",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryLevelsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["planViews", "constraints"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryLevelsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Levels returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query levels --include planViews --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/levels"),
        sideEffects="none",
        agentSafetyNotes="Read-only level and plan-view discovery for explicit level ids.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryLevelsInput", "output:QueryLevelsResult"],
        exampleRefs=["route:query-levels", "cli:query:levels"],
        resourceGroups=["query", "levels", "model", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["level-browser", "project-browser"],
    )
)

register(
    ToolDescriptor(
        name="query.types",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryTypesInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "filter": {"type": "object"},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["parameters", "materials"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryTypesResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Type/material catalog returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported filter/include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query types --category wall_type --include materials --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/types"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only type/material discovery. Agents should resolve existing types before "
            "authoring walls, slabs, roofs, openings, or assets."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryTypesInput", "output:QueryTypesResult"],
        exampleRefs=["route:query-types", "cli:query:types"],
        resourceGroups=["query", "types", "materials", "model", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["type-browser", "inspector"],
    )
)

register(
    ToolDescriptor(
        name="query.views",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryViewsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "filter": {"type": "object"},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["crop", "placements", "templates"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryViewsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Views returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported filter/include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query views --kind plan --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/views"),
        sideEffects="none",
        agentSafetyNotes="Read-only view/sheet/schedule discovery for review and documentation.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryViewsInput", "output:QueryViewsResult"],
        exampleRefs=["route:query-views", "cli:query:views"],
        resourceGroups=["query", "views", "sheets", "schedules", "model", "mcp-resource"],
        uiFeatures=["project-browser", "view-browser", "sheet-browser"],
    )
)

register(
    ToolDescriptor(
        name="query.hosts",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryHostsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "hostKinds": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["wall", "floor", "roof", "slab"]},
                },
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "lineMm": {
                    "type": "array",
                    "items": {"type": "array", "items": {"type": "number"}},
                },
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["hostFaces", "normalizedPosition"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryHostsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Candidate hosts returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported host query"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query hosts --kind wall --point-mm 1200,0 --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/hosts"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only host discovery for wall, roof, floor/slab, and hosted-opening workflows."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryHostsInput", "output:QueryHostsResult"],
        exampleRefs=["route:query-hosts", "cli:query:hosts"],
        resourceGroups=["query", "hosts", "walls", "roofs", "slabs", "mcp-resource"],
        uiFeatures=["canvas-hover", "selection"],
    )
)

register(
    ToolDescriptor(
        name="query.nearest_wall",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryNearestWallInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "maxDistanceMm": {"type": "number", "minimum": 0},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryNearestWallResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Nearest wall result returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid point or tolerance"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query nearest-wall --point-mm 1200,300 --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/nearest-wall"),
        sideEffects="none",
        agentSafetyNotes="Read-only wall proximity resolver for hosted openings and line matching.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryNearestWallInput", "output:QueryNearestWallResult"],
        exampleRefs=["route:query-nearest-wall", "cli:query:nearest-wall"],
        resourceGroups=["query", "walls", "resolver", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["canvas-hover", "wall-tool"],
    )
)

register(
    ToolDescriptor(
        name="query.enclosed_loops",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryEnclosedLoopsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "levelId": {"type": "string"},
                "sourceElementIds": {"type": "array", "items": {"type": "string"}},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["area", "segments", "sourceElementIds"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryEnclosedLoopsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Candidate enclosed loops returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid loop query"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query loops --level level-1 --include area --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/query/enclosed-loops"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only loop discovery for floors, roofs, rooms, and wall-chain-derived boundaries."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryEnclosedLoopsInput", "output:QueryEnclosedLoopsResult"],
        exampleRefs=["route:query-enclosed-loops", "cli:query:loops"],
        resourceGroups=["query", "loops", "rooms", "floors", "roofs", "mcp-resource"],
        uiFeatures=["floor-tool", "roof-sketch", "room-tool"],
    )
)

register(
    ToolDescriptor(
        name="resolve.active_or_default_level",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveActiveOrDefaultLevelInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "activeLevelId": {"type": "string"},
                "preferredElevationMm": {"type": "number"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveLevelResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Level resolved"),
            "not_found": ExitCode(code=1, meaning="Model not found or no level exists"),
        },
        cliExample="bim-ai resolve level --active-or-default --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/active-or-default-level"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only replacement for UI active-level state.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveActiveOrDefaultLevelInput", "output:ResolveLevelResult"],
        exampleRefs=["route:resolve-active-or-default-level", "cli:resolve:level"],
        resourceGroups=["resolve", "levels", "context", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["active-level-picker"],
    )
)

register(
    ToolDescriptor(
        name="resolve.default_plan_view",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveDefaultPlanViewInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveDefaultPlanViewResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Plan view resolved"),
            "not_found": ExitCode(code=1, meaning="Model, level, or plan view not found"),
        },
        cliExample="bim-ai resolve default-plan-view --level level-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/default-plan-view"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only replacement for UI active-plan-view context.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveDefaultPlanViewInput", "output:ResolveDefaultPlanViewResult"],
        exampleRefs=["route:resolve-default-plan-view", "cli:resolve:default-plan-view"],
        resourceGroups=["resolve", "views", "levels", "context", "mcp-resource"],
        uiFeatures=["project-browser", "active-view"],
    )
)

register(
    ToolDescriptor(
        name="resolve.wall_by_line",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveWallByLineInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "startMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "endMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "toleranceMm": {"type": "number", "minimum": 0},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveWallByLineResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Wall resolved by line"),
            "not_found": ExitCode(code=1, meaning="Model not found or no wall matched"),
            "bad_request": ExitCode(code=2, meaning="Invalid line/tolerance"),
        },
        cliExample="bim-ai resolve wall --line 0,0:6000,0 --tolerance-mm 50 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/wall-by-line"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only line-matched wall resolver for sketch wall/host equivalence.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveWallByLineInput", "output:ResolveWallByLineResult"],
        exampleRefs=["route:resolve-wall-by-line", "cli:resolve:wall"],
        resourceGroups=["resolve", "walls", "line-match", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["wall-tool", "selection"],
    )
)

register(
    ToolDescriptor(
        name="resolve.host_face",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveHostFaceInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "hostId": {"type": "string"},
                "hostKinds": {"type": "array", "items": {"type": "string"}},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveHostFaceResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Host face resolved"),
            "not_found": ExitCode(code=1, meaning="Model or host not found"),
            "bad_request": ExitCode(code=2, meaning="Invalid host-face request"),
        },
        cliExample="bim-ai resolve host-face --host wall-1 --point-mm 1000,0 --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/resolve/host-face"),
        sideEffects="none",
        agentSafetyNotes="Read-only hosted-placement resolver for walls, roof faces, and slab faces.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveHostFaceInput", "output:ResolveHostFaceResult"],
        exampleRefs=["route:resolve-host-face", "cli:resolve:host-face"],
        resourceGroups=["resolve", "hosts", "host-face", "walls", "roofs", "slabs"],
        uiFeatures=["canvas-hover", "hosted-placement-tools"],
    )
)

register(
    ToolDescriptor(
        name="resolve.family_type",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveFamilyTypeInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "category": {"type": "string"},
                "name": {"type": "string"},
                "constraints": {"type": "object"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveFamilyTypeResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Family/type resolved"),
            "not_found": ExitCode(code=1, meaning="No matching type found"),
            "bad_request": ExitCode(code=2, meaning="Invalid resolver request"),
        },
        cliExample="bim-ai resolve family-type --category door --name Entry --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/resolve/family-type"),
        sideEffects="none",
        agentSafetyNotes="Read-only replacement for UI family/type picker state.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveFamilyTypeInput", "output:ResolveFamilyTypeResult"],
        exampleRefs=["route:resolve-family-type", "cli:resolve:family-type"],
        resourceGroups=["resolve", "types", "families", "catalog", "mcp-resource"],
        uiFeatures=["type-picker", "family-browser"],
    )
)

register(
    ToolDescriptor(
        name="resolve.room_boundary",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoomBoundaryInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "roomId": {"type": "string"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoomBoundaryResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Room boundary resolved"),
            "not_found": ExitCode(code=1, meaning="Room or boundary not found"),
            "bad_request": ExitCode(code=2, meaning="Invalid room-boundary request"),
        },
        cliExample="bim-ai resolve room-boundary --room room-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/room-boundary"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only room/space boundary resolver for room-programme authoring.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveRoomBoundaryInput", "output:ResolveRoomBoundaryResult"],
        exampleRefs=["route:resolve-room-boundary", "cli:resolve:room-boundary"],
        resourceGroups=["resolve", "rooms", "boundaries", "loops", "mcp-resource"],
        uiFeatures=["room-tool", "inspector"],
    )
)

register(
    ToolDescriptor(
        name="resolve.loop_for_boundary",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveLoopForBoundaryInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "boundaryElementIds": {"type": "array", "items": {"type": "string"}},
                "levelId": {"type": "string"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveLoopForBoundaryResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Boundary loop resolved"),
            "not_found": ExitCode(code=1, meaning="No loop matched"),
            "bad_request": ExitCode(code=2, meaning="Invalid boundary request"),
        },
        cliExample="bim-ai resolve loop-for-boundary --level level-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/loop-for-boundary"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only resolver from selected/detected boundary context to explicit loop id.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveLoopForBoundaryInput", "output:ResolveLoopForBoundaryResult"],
        exampleRefs=["route:resolve-loop-for-boundary", "cli:resolve:loop-for-boundary"],
        resourceGroups=["resolve", "loops", "boundaries", "floors", "roofs", "mcp-resource"],
        uiFeatures=["floor-tool", "roof-sketch", "room-tool"],
    )
)

register(
    ToolDescriptor(
        name="fire-safety-lens-review-status",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "FireSafetyLensReviewStatusInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "FireSafetyLensReviewStatus",
            "type": "object",
            "required": [
                "modelId",
                "format",
                "lensId",
                "scheduleDefaults",
                "viewDefaults",
                "sheetDefaults",
                "counts",
                "schedules",
            ],
            "properties": {
                "modelId": {"type": "string"},
                "format": {"const": "fireSafetyLensReviewStatus_v1"},
                "lensId": {"const": "fire-safety"},
                "germanName": {"const": "Brandschutz"},
                "scheduleDefaults": {"type": "array", "items": {"type": "object"}},
                "viewDefaults": {"type": "array", "items": {"type": "object"}},
                "sheetDefaults": {"type": "array", "items": {"type": "object"}},
                "nonGoals": {"type": "array", "items": {"type": "string"}},
                "counts": {"type": "object"},
                "schedules": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Fire Safety Lens readout generated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai fire-safety-lens-review-status --model-id <id>",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/fire-safety-lens"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Brandschutz review payload. It exposes consultant-review "
            "schedules and statuses, but does not claim jurisdictional fire-code approval."
        ),
    )
)

register(
    ToolDescriptor(
        name="cost-quantity-lens-review-status",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CostQuantityLensReviewStatusInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CostQuantityLensReviewStatus",
            "type": "object",
            "required": [
                "modelId",
                "format",
                "lensId",
                "scheduleDefaults",
                "viewDefaults",
                "sheetDefaults",
                "counts",
                "totals",
                "schedules",
            ],
            "properties": {
                "modelId": {"type": "string"},
                "format": {"const": "costQuantityLensReviewStatus_v1"},
                "lensId": {"const": "cost-quantity"},
                "englishName": {"const": "Cost and Quantity"},
                "germanName": {"const": "Kosten und Mengen"},
                "scheduleDefaults": {"type": "array", "items": {"type": "object"}},
                "viewDefaults": {"type": "array", "items": {"type": "object"}},
                "sheetDefaults": {"type": "array", "items": {"type": "object"}},
                "nonGoals": {"type": "array", "items": {"type": "string"}},
                "counts": {"type": "object"},
                "totals": {"type": "object"},
                "schedules": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Cost and Quantity Lens readout generated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai cost-quantity-lens-review-status --model-id <id>",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/cost-quantity-lens"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Kosten und Mengen payload. Unit rates without source references "
            "are surfaced for review but excluded from cost totals."
        ),
    )
)

# ---------------------------------------------------------------------------
# TOP-V3-01 — Toposolid tool descriptors
# ---------------------------------------------------------------------------

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

register(
    ToolDescriptor(
        name="toposolid-create",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId", "boundaryMm"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
                "name": {"type": "string"},
                "boundaryMm": _TOPOSOLID_BOUNDARY_SCHEMA,
                "heightSamples": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["xMm", "yMm", "zMm"],
                        "properties": {
                            "xMm": {"type": "number"},
                            "yMm": {"type": "number"},
                            "zMm": {"type": "number"},
                        },
                    },
                },
                "heightmapGridMm": {
                    "type": "object",
                    "required": ["stepMm", "rows", "cols", "values"],
                    "properties": {
                        "stepMm": {"type": "number"},
                        "rows": {"type": "integer"},
                        "cols": {"type": "integer"},
                        "values": {"type": "array", "items": {"type": "number"}},
                    },
                },
                "thicknessMm": {"type": "number", "default": 1500},
                "baseElevationMm": {"type": "number"},
                "defaultMaterialKey": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid created"),
            "error": ExitCode(code=1, meaning="Validation error or duplicate id"),
        },
        cliExample=(
            "bim-ai toposolid create "
            '--boundary \'[{"xMm":0,"yMm":0},{"xMm":10000,"yMm":0},{"xMm":10000,"yMm":10000},{"xMm":0,"yMm":10000}]\' '
            "--thickness 1500"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "TOP-V3-01: supply either heightSamples (sparse) or heightmapGridMm (grid), not both. "
            "Omitting both creates a flat-starter terrain at baseElevationMm."
        ),
    )
)

register(
    ToolDescriptor(
        name="toposolid-update",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
                "name": {"type": "string"},
                "thicknessMm": {"type": "number"},
                "baseElevationMm": {"type": "number"},
                "defaultMaterialKey": {"type": "string"},
                "pinned": {"type": "boolean"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid updated"),
            "not_found": ExitCode(code=1, meaning="toposolidId not found"),
        },
        cliExample="bim-ai toposolid update topo-1 --thickness 2000",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
    )
)

register(
    ToolDescriptor(
        name="toposolid-delete",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteToposolidInput",
            "type": "object",
            "required": ["modelId", "toposolidId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "toposolidId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteToposolidOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Toposolid deleted"),
            "not_found": ExitCode(code=1, meaning="toposolidId not found"),
        },
        cliExample="bim-ai toposolid delete topo-1",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Emits a warning advisory (not an error) if floor elements reference "
            "this toposolid as their host before deletion."
        ),
    )
)
# DSC-V3-01 — set-element-discipline
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="set-element-discipline",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetElementDisciplineInput",
            "type": "object",
            "required": ["elementIds", "discipline"],
            "properties": {
                "elementIds": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "description": "IDs of elements whose discipline tag should be set.",
                },
                "discipline": {
                    "type": ["string", "null"],
                    "enum": ["arch", "struct", "mep", "site", "gen", None],
                    "description": (
                        "Discipline tag to assign. null resets the element to its "
                        "DEFAULT_DISCIPLINE_BY_KIND value."
                    ),
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Discipline tag updated on all specified elements"),
            "not_found": ExitCode(code=1, meaning="One or more elementIds not found in model"),
            "unsupported_kind": ExitCode(
                code=2,
                meaning="Element kind does not support the discipline field",
            ),
            "invalid_discipline": ExitCode(
                code=3, meaning="discipline value is not a recognised tag"
            ),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            "# Set a wall to structural discipline\n"
            'bim-ai apply-bundle \'{"commands":[{"type":"setElementDiscipline",'
            '"elementIds":["wall-id"],"discipline":"struct"}],...}\'\n'
            "# Reset to kind default\n"
            'bim-ai apply-bundle \'{"commands":[{"type":"setElementDiscipline",'
            '"elementIds":["col-id"],"discipline":null}],...}\''
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Wrap in a CommandBundle via apply-bundle (POST /api/models/{model_id}/bundles). "
            "discipline=null resets the element to DEFAULT_DISCIPLINE_BY_KIND for its kind. "
            "Structural kinds (column, beam, brace, foundation) default to 'struct'; "
            "MEP kinds (duct, pipe, fixture) default to 'mep'; all others default to 'arch'. "
            "Command is undoable via bundle replay at an earlier parentRevision."
        ),
    )
)

# ---------------------------------------------------------------------------
# DSC-V3-02 — set-view-lens
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="set-view-lens",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetViewLensInput",
            "type": "object",
            "required": ["model_id", "view_id", "lens"],
            "properties": {
                "model_id": {"type": "string"},
                "view_id": {"type": "string"},
                "lens": {
                    "type": "string",
                    "enum": [
                        "show_arch",
                        "show_struct",
                        "show_mep",
                        "show_fire_safety",
                        "show_all",
                    ],
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "required": ["schemaVersion", "applied", "violations"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Discipline lens set on the target view"),
            "not_found": ExitCode(code=1, meaning="viewId not found in model"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            "# Set a plan view to show only structural elements foreground\n"
            "bim-ai view-set-lens --model-id <id> --view-id <viewId> --lens show_struct\n"
            "# Reset to show all disciplines at full opacity\n"
            "bim-ai view-set-lens --model-id <id> --view-id <viewId> --lens show_all"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Wrap in a CommandBundle via apply-bundle. "
            "lens must be one of: show_arch, show_struct, show_mep, "
            "show_fire_safety, show_all. "
            "show_all renders all elements at full opacity (default). "
            "Does not mutate element discipline fields — view-only modifier."
        ),
    )
)

# ---------------------------------------------------------------------------
# Construction lens — Bauausfuehrung workflow layer
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="construction-lens-report",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ConstructionLensReportInput",
            "type": "object",
            "required": ["model_id"],
            "properties": {"model_id": {"type": "string"}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ConstructionLensReport",
            "type": "object",
            "required": ["modelId", "revision", "lens", "summary"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "lens": {"type": "object"},
                "phases": {"type": "array", "items": {"type": "object"}},
                "packages": {"type": "array", "items": {"type": "object"}},
                "progress": {"type": "array", "items": {"type": "object"}},
                "logistics": {"type": "array", "items": {"type": "object"}},
                "qaChecklists": {"type": "array", "items": {"type": "object"}},
                "issues": {"type": "array", "items": {"type": "object"}},
                "summary": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Construction lens report returned"),
            "not_found": ExitCode(code=1, meaning="modelId not found"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="curl /api/models/<model-id>/construction-lens",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/construction-lens"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only field-app payload exposing construction package membership, progress, "
            "phase data, issue references, evidence references, logistics, and QA checklists."
        ),
    )
)

register(
    ToolDescriptor(
        name="set-element-construction",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetElementConstructionInput",
            "type": "object",
            "required": ["model_id", "element_id", "metadata"],
            "properties": {
                "model_id": {"type": "string"},
                "element_id": {"type": "string"},
                "phaseCreatedId": {"type": "string"},
                "phaseDemolishedId": {"type": "string"},
                "clearDemolished": {"type": "boolean"},
                "metadata": {
                    "type": "object",
                    "properties": {
                        "constructionPackageId": {"type": "string"},
                        "plannedStart": {"type": "string"},
                        "plannedEnd": {"type": "string"},
                        "actualStart": {"type": "string"},
                        "actualEnd": {"type": "string"},
                        "installationSequence": {"type": "integer"},
                        "dependencies": {"type": "array", "items": {"type": "string"}},
                        "progressStatus": {
                            "type": "string",
                            "enum": [
                                "not_started",
                                "in_progress",
                                "installed",
                                "inspected",
                                "accepted",
                            ],
                        },
                        "responsibleCompany": {"type": "string"},
                        "evidenceRefs": {"type": "array", "items": {"type": "object"}},
                        "issueIds": {"type": "array", "items": {"type": "string"}},
                        "punchItemIds": {"type": "array", "items": {"type": "string"}},
                        "inspectionChecklist": {"type": "array", "items": {"type": "object"}},
                    },
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BundleResult",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Construction metadata attached"),
            "not_found": ExitCode(code=1, meaning="elementId/modelId not found"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample=(
            'bim-ai apply-bundle \'{"commands":[{"type":"setElementConstruction",'
            '"elementId":"wall-1","metadata":{"progressStatus":"installed"}}],...}\''
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Mutates only construction metadata under element props plus optional phaseCreated/"
            "phaseDemolished ids. It does not reclassify design elements as temporary works."
        ),
    )
)

# ---------------------------------------------------------------------------
# OUT-V3-01 — Live presentation URL tools
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="presentation-create",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationCreateInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "pageScopeIds": {"type": "array", "items": {"type": "string"}, "default": []},
                "allowMeasurement": {"type": "boolean", "default": False},
                "allowComment": {"type": "boolean", "default": False},
                "expiresAt": {"type": "integer", "description": "Unix ms timestamp; null = never"},
                "displayName": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationCreateOutput",
            "type": "object",
            "required": ["id", "token", "url"],
            "properties": {
                "id": {"type": "string"},
                "token": {"type": "string"},
                "url": {"type": "string"},
                "isRevoked": {"type": "boolean"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai publish --link --model <id> [--allow-measurement] [--allow-comment]",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/presentations"),
        sideEffects="writes-audit",
        agentSafetyNotes="Creates a public shareable link. Use pageScopeIds to restrict visible pages.",
    )
)

register(
    ToolDescriptor(
        name="presentation-revoke",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationRevokeInput",
            "type": "object",
            "required": ["modelId", "linkId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "linkId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationRevokeOutput",
            "type": "object",
            "required": ["revokedAt"],
            "properties": {
                "revokedAt": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Presentation link not found"),
        },
        cliExample="bim-ai publish --revoke <link-id> --model <id>",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/presentations/{link_id}/revoke"
        ),
        sideEffects="writes-audit",
        agentSafetyNotes="Immediately invalidates the link and pushes {type: revoked} to all active WS viewers.",
    )
)

register(
    ToolDescriptor(
        name="presentation-list",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationListInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PresentationListOutput",
            "type": "object",
            "required": ["presentations"],
            "properties": {
                "presentations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "token", "isRevoked"],
                        "properties": {
                            "id": {"type": "string"},
                            "token": {"type": "string"},
                            "isRevoked": {"type": "boolean"},
                            "allowMeasurement": {"type": "boolean"},
                            "allowComment": {"type": "boolean"},
                        },
                    },
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai publish --list --model <id>",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/presentations"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; lists non-revoked presentation links only.",
    )
)
# ---------------------------------------------------------------------------
# IMG-V3-01 — Image-to-layout trace
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="img-trace",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImgTraceInput",
            "type": "object",
            "required": ["image"],
            "properties": {
                "image": {
                    "type": "string",
                    "format": "binary",
                    "description": "Image file (multipart/form-data field 'image'). JPEG or PNG.",
                },
                "archetypeHint": {
                    "type": "string",
                    "description": "Optional layout archetype hint (e.g. 'residential_apartment').",
                },
                "brief": {
                    "type": "string",
                    "description": "Optional free-text design brief (multipart field 'brief').",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "StructuredLayout",
            "type": "object",
            "required": [
                "schemaVersion",
                "imageMetadata",
                "rooms",
                "walls",
                "openings",
                "ocrLabels",
                "advisories",
            ],
            "properties": {
                "schemaVersion": {"type": "string", "enum": ["img-v3.0"]},
                "imageMetadata": {
                    "type": "object",
                    "required": ["widthPx", "heightPx"],
                    "properties": {
                        "widthPx": {"type": "integer"},
                        "heightPx": {"type": "integer"},
                        "calibrationMmPerPx": {"type": "number"},
                    },
                },
                "rooms": {"type": "array", "items": {"type": "object"}},
                "walls": {"type": "array", "items": {"type": "object"}},
                "openings": {"type": "array", "items": {"type": "object"}},
                "ocrLabels": {"type": "array", "items": {"type": "object"}},
                "advisories": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["code"],
                        "properties": {
                            "code": {"type": "string"},
                            "message": {"type": "string"},
                        },
                    },
                },
                "jobId": {
                    "type": "string",
                    "description": "Present instead of layout fields when image >2MB was enqueued.",
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Layout extracted successfully"),
            "no_walls_detected": ExitCode(
                code=1, meaning="No wall segments found; image may not be a floor plan"
            ),
        },
        cliExample="bim-ai trace --image plan.png --archetype-hint residential_apartment -o layout.json",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/trace"),
        sideEffects="none",
        agentSafetyNotes=(
            "Deterministic: same image bytes → byte-identical StructuredLayout JSON. "
            "Images >2MB are enqueued as image_trace jobs; response contains {jobId}. "
            "Check advisories[].code for 'no_walls_detected', 'low_contrast_image', "
            "'opencv_unavailable', 'tesseract_unavailable'. "
            "Exit code 1 (no_walls_detected) means the image is likely not a floor plan."
        ),
    )
)

# ---------------------------------------------------------------------------
# SCH-V3-01 — Custom-properties + schedule view
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-schedule-view",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateScheduleViewInput",
            "type": "object",
            "required": ["id", "name", "category"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "category": {"type": "string"},
                "columns": {"type": "array", "items": {"type": "object"}},
                "filterExpr": {"type": "string"},
                "sortKey": {"type": "string"},
                "sortDir": {"type": "string", "enum": ["asc", "desc"]},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateScheduleViewOutput",
            "type": "object",
            "properties": {
                "scheduleId": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Schedule view created"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai create-schedule-view --id sv-1 --name 'Wall Schedule' --category wall",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
    )
)

register(
    ToolDescriptor(
        name="set-element-prop",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SetElementPropInput",
            "type": "object",
            "required": ["elementId", "key", "value"],
            "properties": {
                "elementId": {"type": "string"},
                "key": {"type": "string"},
                "value": {},
            },
        },
        outputSchema={"type": "object"},
        exitCodes={
            "ok": ExitCode(code=0, meaning="Custom property set on element"),
            "not_found": ExitCode(code=1, meaning="elementId not found in document"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains set_element_prop command",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Merges into element.props dict. Element must exist; unknown elementId raises 400.",
    )
)

# ---------------------------------------------------------------------------
# VG-V3-01 — Visual comparison tool
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-graded-region",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateGradedRegionInput",
            "type": "object",
            "required": ["modelId", "hostToposolidId", "boundaryMm", "targetMode"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "id": {"type": "string"},
                "hostToposolidId": {
                    "type": "string",
                    "description": "Id of the host toposolid element",
                },
                "boundaryMm": {
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
                    "description": "Closed boundary polygon (≥ 3 vertices) in plan mm",
                },
                "targetMode": {
                    "type": "string",
                    "enum": ["flat", "slope"],
                    "description": "'flat' levels the region to targetZMm; 'slope' grades along slopeAxisDeg at slopeDegPercent",
                },
                "targetZMm": {
                    "type": "number",
                    "description": "Target elevation in mm; required for flat mode",
                },
                "slopeAxisDeg": {
                    "type": "number",
                    "description": "Slope axis direction in degrees; required for slope mode",
                },
                "slopeDegPercent": {
                    "type": "number",
                    "description": "Slope gradient in percent; required for slope mode",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateGradedRegionOutput",
            "type": "object",
            "properties": {"ok": {"type": "boolean"}, "revision": {"type": "integer"}},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Graded region created"),
            "error": ExitCode(code=1, meaning="Validation error or host toposolid not found"),
        },
        cliExample=(
            "bim-ai create-graded-region "
            "--hostToposolidId topo-1 "
            '--boundary \'[{"xMm":0,"yMm":0},{"xMm":5000,"yMm":0},{"xMm":5000,"yMm":5000}]\' '
            "--targetMode flat --targetZMm 0"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "TOP-V3-04: supply targetZMm for flat mode, or slopeAxisDeg + slopeDegPercent for slope mode. "
            "hostToposolidId must reference an existing toposolid."
        ),
    )
)

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

register(
    ToolDescriptor(
        name="compare-snapshots",
        category="query",
        inputSchema={
            "type": "object",
            "required": ["snapshotA", "snapshotB"],
            "properties": {
                "snapshotA": {"type": "object", "description": "First model snapshot"},
                "snapshotB": {"type": "object", "description": "Second model snapshot"},
                "metric": {
                    "type": "string",
                    "enum": ["ssim", "mse", "pixel-diff"],
                    "default": "ssim",
                },
                "threshold": {"type": "number", "description": "Pass/fail threshold"},
                "region": {"type": "string", "description": "Named region mask"},
            },
        },
        outputSchema={
            "type": "object",
            "properties": {
                "schemaVersion": {"type": "string"},
                "metric": {"type": "string"},
                "score": {"type": "number"},
                "thresholdPassed": {"type": "boolean"},
                "perRegionScores": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Comparison complete; score returned"),
            "threshold_fail": ExitCode(code=1, meaning="Score below threshold"),
        },
        cliExample="bim-ai compare pre.json post.json --metric ssim --threshold 0.7",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/compare"),
        sideEffects="none",
        agentSafetyNotes="Safe to call any number of times. Same inputs → byte-identical output.",
    )
)

# ---------------------------------------------------------------------------
# CTL-V3-01 — Catalog query
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="catalog-query",
        category="query",
        inputSchema={
            "type": "object",
            "properties": {
                "kind": {
                    "type": "string",
                    "description": "Element kind to filter (e.g. 'door', 'window', 'sofa')",
                },
                "maxWidthMm": {"type": "number"},
                "minWidthMm": {"type": "number"},
                "tag": {"type": "string"},
                "style": {"type": "string"},
                "page": {"type": "integer", "default": 0},
                "pageSize": {"type": "integer", "default": 50},
            },
        },
        outputSchema={
            "type": "object",
            "properties": {
                "schemaVersion": {"type": "string"},
                "items": {"type": "array"},
                "total": {"type": "integer"},
                "page": {"type": "integer"},
                "pageSize": {"type": "integer"},
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Query successful")},
        cliExample="bim-ai catalog query --kind door --max-width 900 --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/catalog"),
        sideEffects="none",
        agentSafetyNotes=(
            "Safe to call any number of times. Deterministic — same query → identical result. "
            "Use to discover catalog keys before emitting bundles."
        ),
    )
)

# ---------------------------------------------------------------------------
# EDT-V3-09 — Stair tread auto-balance
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="update-stair-treads",
        category="mutation",
        inputSchema={
            "type": "object",
            "required": ["id", "treadLines"],
            "properties": {
                "id": {"type": "string"},
                "treadLines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "fromMm": {"type": "object"},
                            "toMm": {"type": "object"},
                            "riserHeightMm": {"type": "number"},
                            "manualOverride": {"type": "boolean"},
                        },
                    },
                },
            },
        },
        outputSchema={"type": "object"},
        exitCodes={
            "ok": ExitCode(code=0, meaning="Tread lines updated"),
            "not_found": ExitCode(code=1, meaning="Stair not found"),
        },
        cliExample="bim-ai update-stair-treads --id stair-1 --treadLines '[...]'",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
    )
)

# ---------------------------------------------------------------------------
# AST-V3-04 — Parametric kitchen kit
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="place-kitchen-kit",
        category="mutation",
        inputSchema={
            "type": "object",
            "required": ["id", "hostWallId", "startMm", "endMm"],
            "properties": {
                "id": {"type": "string"},
                "kitId": {
                    "type": "string",
                    "enum": ["kitchen_modular"],
                    "default": "kitchen_modular",
                },
                "hostWallId": {"type": "string"},
                "startMm": {"type": "number"},
                "endMm": {"type": "number"},
                "components": {"type": "array", "items": {"type": "object"}},
                "countertopDepthMm": {"type": "number", "default": 600},
                "countertopMaterialId": {"type": "string"},
            },
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes={
            "ok": ExitCode(code=0, meaning="Kitchen kit placed"),
            "not_found": ExitCode(code=1, meaning="hostWallId not found"),
        },
        cliExample="bim-ai place-kitchen-kit --id kit-1 --hostWallId wall-1 --startMm 0 --endMm 4200",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Places a FamilyKitInstanceElem. Call catalog-query with kind=door/window first "
            "to resolve materialId. startMm/endMm are along-wall positions in mm."
        ),
    )
)

# ---------------------------------------------------------------------------
# M4-D — Families, assets, materials, decals typed parity aliases
# ---------------------------------------------------------------------------

_M4D_MUTATION_CODES = {
    "ok": ExitCode(code=0, meaning="Bundle applied or validated"),
    "not_found": ExitCode(code=1, meaning="Referenced model element not found"),
    "error": ExitCode(code=1, meaning="Unexpected error"),
}

register(
    ToolDescriptor(
        name="family.upsert_type",
        category="mutation",
        inputSchema={
            "title": "FamilyUpsertTypeInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "familyId": {"type": "string"},
                "discipline": {"type": "string", "enum": ["door", "window", "generic"]},
                "parameters": {"type": "object", "additionalProperties": True},
                "catalogSource": {
                    "type": "object",
                    "required": ["catalogId", "familyId", "version"],
                    "properties": {
                        "catalogId": {"type": "string"},
                        "familyId": {"type": "string"},
                        "version": {"type": "string"},
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample=(
            "bim-ai family upsert-type --id ft-chair --name Chair "
            "--parameters '{\"widthMm\":500}' --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Generates an upsertFamilyType command. Use catalog-query or family catalog routes "
            "first when the type is sourced from a catalog."
        ),
    )
)

register(
    ToolDescriptor(
        name="family.place_instance",
        category="mutation",
        inputSchema={
            "title": "FamilyPlaceInstanceInput",
            "type": "object",
            "required": ["familyTypeId", "positionMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "familyTypeId": {"type": "string"},
                "levelId": {"type": "string"},
                "hostViewId": {"type": "string"},
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
                },
                "rotationDeg": {"type": "number"},
                "paramValues": {"type": "object", "additionalProperties": True},
                "hostElementId": {"type": "string"},
                "hostAlongT": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample=(
            "bim-ai family place-instance --family-type ft-chair --level lvl-0 "
            "--pos 1200,900 --json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Places a FamilyInstanceElem from an existing family_type. Hosted wall placement "
            "may also create a wall_opening when hostAlongT is provided."
        ),
    )
)

register(
    ToolDescriptor(
        name="asset.query",
        category="query",
        inputSchema={
            "title": "AssetQueryInput",
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "category": {"type": "string"},
                "disciplineTag": {"type": "string", "enum": ["arch", "struct", "mep"]},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"results": {"type": "array"}}},
        exitCodes={"ok": ExitCode(code=0, meaning="Results returned")},
        cliExample="bim-ai catalog query --kind sofa --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/catalog"),
        sideEffects="none",
        agentSafetyNotes="Read-only catalog/library query. Empty result sets are valid evidence.",
    )
)

register(
    ToolDescriptor(
        name="asset.place",
        category="mutation",
        inputSchema={
            "title": "AssetPlaceInput",
            "type": "object",
            "required": ["assetId", "levelId", "positionMm"],
            "properties": {
                "id": {"type": "string"},
                "assetId": {"type": "string"},
                "levelId": {"type": "string"},
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {"xMm": {"type": "number"}, "yMm": {"type": "number"}},
                },
                "rotationDeg": {"type": "number"},
                "paramValues": {"type": "object", "additionalProperties": True},
                "hostElementId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai asset place --asset sofa-2400 --level lvl-0 --pos 2500,1400,0 --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Places an existing AssetLibraryEntry as a PlacedAssetElem.",
    )
)

register(
    ToolDescriptor(
        name="material.query",
        category="query",
        inputSchema={
            "title": "MaterialQueryInput",
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "text": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"materials": {"type": "array"}}},
        exitCodes={"ok": ExitCode(code=0, meaning="Material catalog returned")},
        cliExample="bim-ai query types --category material --text brick",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/registry/type-material"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only access to builtin and document material/type registry evidence; "
            "agents should resolve a material key before assignment."
        ),
    )
)

register(
    ToolDescriptor(
        name="material.upsert_pbr",
        category="mutation",
        inputSchema={
            "title": "MaterialUpsertPbrInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "albedoColor": {"type": "string"},
                "albedoMapId": {"type": "string"},
                "normalMapId": {"type": "string"},
                "roughnessMapId": {"type": "string"},
                "metallicMapId": {"type": "string"},
                "heightMapId": {"type": "string"},
                "uvScaleMm": {"type": "object"},
                "uvRotationDeg": {"type": "number"},
                "hatchPatternId": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai material update-pbr --id mat-oak --albedo-map img-oak --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Patches PBR/map fields on an existing MaterialElem through update_material_pbr. "
            "It does not upload image bytes."
        ),
    )
)

register(
    ToolDescriptor(
        name="material.assign",
        category="mutation",
        inputSchema={
            "title": "MaterialAssignInput",
            "type": "object",
            "required": ["elementId", "materialKey"],
            "properties": {
                "elementId": {"type": "string"},
                "materialKey": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"elementId": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai material assign --element wall-1 --material brick_red --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Sets materialKey on element kinds that support the property, currently including walls.",
    )
)

register(
    ToolDescriptor(
        name="material.paint_face",
        category="mutation",
        inputSchema={
            "title": "MaterialPaintFaceInput",
            "type": "object",
            "required": ["elementId", "faceKind", "materialKey"],
            "properties": {
                "elementId": {"type": "string"},
                "faceKind": {"type": "string"},
                "materialKey": {"type": "string"},
                "generatedFaceId": {"type": "string"},
                "uvScaleMm": {"type": "object"},
                "uvRotationDeg": {"type": "number"},
                "uvOffsetMm": {"type": "object"},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"elementId": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai material paint-face --element wall-1 --face exterior --material brick_red --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Writes faceMaterialOverrides via set_element_prop. Unsupported element kinds are rejected by the kernel."
        ),
    )
)

register(
    ToolDescriptor(
        name="decal.create",
        category="mutation",
        inputSchema={
            "title": "DecalCreateInput",
            "type": "object",
            "required": ["parentElementId", "parentSurface", "imageAssetId", "uvRect"],
            "properties": {
                "id": {"type": "string"},
                "parentElementId": {"type": "string"},
                "parentSurface": {
                    "type": "string",
                    "enum": ["front", "back", "top", "left", "right", "bottom"],
                },
                "imageAssetId": {"type": "string"},
                "uvRect": {"type": "object"},
                "opacity": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "additionalProperties": False,
        },
        outputSchema={"type": "object", "properties": {"id": {"type": "string"}}},
        exitCodes=_M4D_MUTATION_CODES,
        cliExample="bim-ai decal create --parent wall-1 --surface front --image-asset logo-img --json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Creates a DecalElem hosted on an existing parent element surface.",
    )
)

# ---------------------------------------------------------------------------
# OSM-V3-01 — neighborhood massing import
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="import-neighborhood",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportNeighborhoodInput",
            "type": "object",
            "required": ["lat", "lon"],
            "properties": {
                "lat": {"type": "number", "description": "Origin latitude (WGS-84)"},
                "lon": {"type": "number", "description": "Origin longitude (WGS-84)"},
                "radiusM": {
                    "type": "number",
                    "default": 200.0,
                    "description": "Search radius in metres around the origin.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportNeighborhoodOutput",
            "type": "object",
            "required": ["imported", "masses"],
            "properties": {
                "imported": {"type": "integer"},
                "masses": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Import succeeded"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
            "error": ExitCode(code=1, meaning="Overpass API error or parse failure"),
        },
        cliExample="bim-ai import-neighborhood --lat 48.137 --lon 11.575 --radius-m 200 --model-id m-1",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/v3/models/{modelId}/neighborhood-import"
        ),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Replaces all existing OSM neighborhood_mass elements. "
            "Re-import with the same bbox is idempotent. "
            "Does NOT mutate authored walls, floors, or roofs."
        ),
    )
)

# ---------------------------------------------------------------------------
# TOP-V3-02 — Toposolid subdivision
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-toposolid-subdivision",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidSubdivisionInput",
            "type": "object",
            "required": [
                "modelId",
                "id",
                "hostToposolidId",
                "boundaryMm",
                "finishCategory",
                "materialKey",
            ],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "id": {"type": "string"},
                "hostToposolidId": {"type": "string", "description": "ID of the parent toposolid"},
                "boundaryMm": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["xMm", "yMm"],
                        "properties": {
                            "xMm": {"type": "number"},
                            "yMm": {"type": "number"},
                        },
                    },
                    "minItems": 3,
                    "description": "Closed polygon defining the subdivision region",
                },
                "finishCategory": {
                    "type": "string",
                    "enum": ["paving", "lawn", "road", "planting", "other"],
                },
                "materialKey": {"type": "string"},
                "name": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateToposolidSubdivisionOutput",
            "type": "object",
            "properties": {
                "ok": {"type": "boolean"},
                "revision": {"type": "integer"},
                "id": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Subdivision created"),
            "not_found": ExitCode(code=1, meaning="Host toposolid not found"),
            "conflict": ExitCode(code=2, meaning="Element id already exists"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains create_toposolid_subdivision",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Host toposolid must exist. Boundary outside host footprint triggers a warning "
            "agent_deviation (not a 400). finishCategory must be one of: paving, lawn, road, "
            "planting, other."
        ),
    )
)

# ---------------------------------------------------------------------------
# IMP-V3-01 — Image-as-underlay import
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="import-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportImageUnderlayInput",
            "type": "object",
            "required": ["id", "src", "rectMm"],
            "properties": {
                "id": {"type": "string", "description": "Element id for the new underlay."},
                "src": {
                    "type": "string",
                    "description": (
                        "Base64 data URI: data:image/png, data:image/jpeg, or "
                        "data:application/pdf. Maximum 50 MB."
                    ),
                },
                "rectMm": {
                    "type": "object",
                    "required": ["xMm", "yMm", "widthMm", "heightMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                        "widthMm": {"type": "number"},
                        "heightMm": {"type": "number"},
                    },
                },
                "rotationDeg": {"type": "number", "default": 0.0},
                "opacity": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.4},
                "lockedScale": {"type": "boolean", "default": False},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ImportImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay imported and element created"),
            "invalid_format": ExitCode(
                code=1,
                meaning="src is not a supported data URI (PNG, JPEG or PDF only)",
            ),
            "src_too_large": ExitCode(code=2, meaning="src exceeds 50 MB limit"),
            "duplicate_id": ExitCode(code=3, meaning="Element id already exists in model"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains import_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "IMP-V3-01: src must be a data URI with prefix data:image/png, "
            "data:image/jpeg, or data:application/pdf. "
            "Maximum base64-encoded payload size is 50 MB. "
            "Use move_image_underlay / scale_image_underlay / rotate_image_underlay "
            "to adjust the underlay after import. "
            "delete_image_underlay removes the element entirely."
        ),
    )
)

register(
    ToolDescriptor(
        name="move-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "MoveImageUnderlayInput",
            "type": "object",
            "required": ["id", "rectMm"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
                "rectMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                        "widthMm": {
                            "type": "number",
                            "description": "Ignored by the kernel; existing width is preserved.",
                        },
                        "heightMm": {
                            "type": "number",
                            "description": "Ignored by the kernel; existing height is preserved.",
                        },
                    },
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "MoveImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay moved through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains move_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use the standard bundle dry-run path first. Move updates xMm/yMm only; "
            "scale-image-underlay owns width/height changes."
        ),
    )
)

register(
    ToolDescriptor(
        name="scale-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ScaleImageUnderlayInput",
            "type": "object",
            "required": ["id", "widthMm", "heightMm"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
                "widthMm": {"type": "number", "exclusiveMinimum": 0},
                "heightMm": {"type": "number", "exclusiveMinimum": 0},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ScaleImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay scaled through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains scale_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use the standard bundle dry-run path first. Scale preserves xMm/yMm and "
            "only changes widthMm/heightMm."
        ),
    )
)

register(
    ToolDescriptor(
        name="rotate-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RotateImageUnderlayInput",
            "type": "object",
            "required": ["id", "rotationDeg"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
                "rotationDeg": {"type": "number"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RotateImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay rotated through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains rotate_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Use the standard bundle dry-run path first. Rotation is stored in degrees.",
    )
)

register(
    ToolDescriptor(
        name="delete-image-underlay",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteImageUnderlayInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string", "description": "Existing image_underlay element id."},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DeleteImageUnderlayOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Underlay deleted through the bundle pipeline"),
            "not_found": ExitCode(code=1, meaning="id does not reference an image_underlay"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains delete_image_underlay",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Use the standard bundle dry-run path first. Deleting the underlay removes "
            "the calibration/reference image from the model."
        ),
    )
)

# ---------------------------------------------------------------------------
# CON-V3-02 — Concept seed handoff tools
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="commit-concept-seed",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommitConceptSeedInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {
                    "type": "string",
                    "description": "ID of the ConceptSeedElem to commit (must be in 'draft' state).",
                },
                "envelopeTokens": {
                    "type": "array",
                    "description": "Additional envelope tokens to merge into the seed.",
                    "items": {
                        "type": "object",
                        "required": ["hostId", "t", "deltaMm", "scaleFactor", "rho"],
                        "properties": {
                            "hostId": {"type": "string"},
                            "t": {"type": "number"},
                            "deltaMm": {"type": "number"},
                            "scaleFactor": {"type": "number"},
                            "rho": {"type": "number"},
                        },
                    },
                },
                "kernelElementDrafts": {
                    "type": "array",
                    "description": "Additional kernel element drafts to merge.",
                    "items": {"type": "object"},
                },
                "assumptionsLog": {
                    "type": "array",
                    "description": "Additional assumption log entries to merge.",
                    "items": {
                        "type": "object",
                        "required": ["assumption", "confidence", "source"],
                        "properties": {
                            "assumption": {"type": "string"},
                            "confidence": {"type": "number"},
                            "source": {"type": "string"},
                        },
                    },
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommitConceptSeedOutput",
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "status": {"type": "string", "enum": ["committed"]},
                "committedAt": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(
                code=0, meaning="Seed transitioned to 'committed'; T9 may now consume it"
            ),
            "not_found": ExitCode(code=1, meaning="No ConceptSeedElem found with the given id"),
            "invalid_state": ExitCode(code=2, meaning="Seed is not in 'draft' state"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains commit_concept_seed command",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Idempotent within the T6 session: committing a draft seed is a one-way state "
            "transition. Do NOT call twice; the second call raises 400."
        ),
    )
)

register(
    ToolDescriptor(
        name="list-concept-seeds",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ListConceptSeedsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "description": "Target model UUID."},
                "status": {
                    "type": "string",
                    "enum": ["draft", "committed", "consumed"],
                    "description": "Filter by lifecycle status. Omit to return all seeds.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "type": "array",
            "items": {"type": "object"},
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Seed list returned (may be empty)"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai api concept-seeds --model <id> --status committed",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/models/{modelId}/concept-seeds"),
        sideEffects="none",
        agentSafetyNotes="Safe read-only query. T9 polls this endpoint to discover seeds ready for ingestion.",
    )
)

# ---------------------------------------------------------------------------
# OUT-V3-02 — Presentation canvas, frames, saved views
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-frame",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateFrameInput",
            "type": "object",
            "required": ["id", "presentationCanvasId", "viewId", "positionMm", "sizeMm"],
            "properties": {
                "id": {"type": "string", "description": "Unique frame element ID."},
                "presentationCanvasId": {
                    "type": "string",
                    "description": "ID of the parent PresentationCanvasElem.",
                },
                "viewId": {
                    "type": "string",
                    "description": "ID of the view (plan_view, section_cut, etc.) to crop.",
                },
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                    },
                },
                "sizeMm": {
                    "type": "object",
                    "required": ["widthMm", "heightMm"],
                    "properties": {
                        "widthMm": {"type": "number"},
                        "heightMm": {"type": "number"},
                    },
                },
                "caption": {"type": "string", "description": "Optional slide caption."},
                "brandTemplateId": {"type": "string"},
                "sortOrder": {"type": "integer", "default": 0},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "type": "object",
            "properties": {
                "accepted": {"type": "boolean"},
                "revision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Frame created"),
            "duplicate_id": ExitCode(code=1, meaning="Frame ID already exists"),
            "canvas_not_found": ExitCode(code=1, meaning="presentationCanvasId not found"),
        },
        cliExample='bim-ai create-frame --id frame-01 --presentationCanvasId canvas-01 --viewId plan-gf --positionMm \'{"xMm":0,"yMm":0}\' --sizeMm \'{"widthMm":210,"heightMm":148}\'',
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Requires a valid presentationCanvasId; canvas must exist before adding frames.",
    )
)

register(
    ToolDescriptor(
        name="export-presentation",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportPresentationInput",
            "type": "object",
            "required": ["modelId", "canvasId"],
            "properties": {
                "modelId": {"type": "string"},
                "canvasId": {"type": "string"},
                "format": {
                    "type": "string",
                    "enum": ["pptx-bundle"],
                    "default": "pptx-bundle",
                    "description": "Only 'pptx-bundle' (structured JSON) is supported in v3.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PptxBundle",
            "type": "object",
            "required": ["schemaVersion", "title", "slides"],
            "properties": {
                "schemaVersion": {"type": "string"},
                "title": {"type": "string"},
                "slides": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["viewId", "positionMm", "sizeMm", "sortOrder"],
                        "properties": {
                            "viewId": {"type": "string"},
                            "caption": {"type": ["string", "null"]},
                            "positionMm": {"type": "object"},
                            "sizeMm": {"type": "object"},
                            "sortOrder": {"type": "integer"},
                        },
                    },
                },
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle returned"),
            "not_found": ExitCode(code=1, meaning="Canvas not found"),
            "bad_format": ExitCode(code=1, meaning="Unsupported format parameter"),
        },
        cliExample="bim-ai export-presentation --modelId <uuid> --canvasId canvas-01 --format pptx-bundle",
        restEndpoint=RestEndpoint(
            method="GET",
            path="/api/v3/models/{modelId}/presentation-canvases/{canvasId}/export",
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only export; safe to call at any time. Returns JSON bundle, not a binary .pptx file.",
    )
)

# ---------------------------------------------------------------------------
# OUT-V3-03 — BrandTemplate CRUD + branded PDF export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="create-brand-template",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateBrandTemplateInput",
            "type": "object",
            "required": ["id", "name", "accentHex", "accentForegroundHex"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "accentHex": {
                    "type": "string",
                    "pattern": "^#[0-9a-fA-F]{6}$",
                    "description": "CSS hex colour for brand accent, e.g. '#2563eb'",
                },
                "accentForegroundHex": {
                    "type": "string",
                    "pattern": "^#[0-9a-fA-F]{6}$",
                    "description": "Foreground colour on the accent surface, e.g. '#ffffff'",
                },
                "typeface": {
                    "type": "string",
                    "default": "Inter",
                    "description": "CSS font-family for brand text",
                },
                "logoMarkSvgUri": {
                    "type": "string",
                    "description": "data: URI or remote URL for the logo SVG mark",
                },
                "cssOverrideSnippet": {
                    "type": "string",
                    "description": "Raw CSS injected as Layer C overrides (opaque; no validation)",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CreateBrandTemplateOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Brand template created"),
            "invalid_hex": ExitCode(code=1, meaning="accentHex or accentForegroundHex not #RRGGBB"),
            "duplicate_id": ExitCode(code=1, meaning="Element with that id already exists"),
        },
        cliExample="bim-ai create-brand-template --id bt-1 --name Acme --accentHex '#2563eb' --accentForegroundHex '#ffffff'",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes="Wrap in a CommandBundle with type='create_brand_template'.",
    )
)

register(
    ToolDescriptor(
        name="export-branded-pdf",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportBrandedPdfInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "description": "UUID of the model"},
                "brandTemplateId": {
                    "type": "string",
                    "description": "Optional id of a brand_template element; omit for unbranded export",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "BrandedExportBundle",
            "type": "object",
            "required": ["schemaVersion", "format", "sheets", "invariantCheck"],
            "properties": {
                "schemaVersion": {"type": "string", "enum": ["out-v3.0"]},
                "format": {"type": "string", "enum": ["pdf", "pptx"]},
                "brandTemplateId": {"type": "string"},
                "brandLayer": {
                    "type": "object",
                    "properties": {
                        "accentHex": {"type": "string"},
                        "accentForegroundHex": {"type": "string"},
                        "typeface": {"type": "string"},
                        "logoMarkSvgUri": {"type": "string"},
                        "cssOverrideSnippet": {"type": "string"},
                    },
                },
                "sheets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "sheetId": {"type": "string"},
                            "name": {"type": "string"},
                        },
                    },
                },
                "invariantCheck": {"type": "string", "enum": ["layer-c-only"]},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Export bundle returned"),
            "not_found": ExitCode(code=1, meaning="Model or brandTemplateId not found"),
        },
        cliExample="bim-ai export-branded-pdf --modelId <uuid> --brandTemplateId bt-1",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/models/{modelId}/export/pdf"),
        sideEffects="none",
        agentSafetyNotes="Read-only; safe to call freely.",
    )
)

# ---------------------------------------------------------------------------
# EXP-V3-01 — Render-pipeline export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="export-render-bundle",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExportRenderBundleInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "description": "UUID of the model"},
                "format": {
                    "type": "string",
                    "enum": ["gltf", "gltf-pbr", "ifc-bundle", "metadata-only"],
                    "default": "metadata-only",
                    "description": "Export format. metadata-only returns JSON without a binary asset.",
                },
                "viewId": {
                    "type": "string",
                    "description": "Optional viewpoint/saved_view id to filter cameras to a single view.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "RenderExportBundle",
            "type": "object",
            "required": ["schemaVersion", "format", "metadata", "exportTimestamp"],
            "properties": {
                "schemaVersion": {"type": "string", "enum": ["exp-v3.0"]},
                "format": {
                    "type": "string",
                    "enum": ["gltf", "gltf-pbr", "ifc-bundle", "metadata-only"],
                },
                "primaryAsset": {
                    "type": ["object", "null"],
                    "properties": {
                        "kind": {"type": "string"},
                        "pathInArchive": {"type": "string"},
                    },
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "cameras": {"type": "array", "items": {"type": "object"}},
                        "sunSettings": {"type": "object"},
                        "materials": {"type": "array", "items": {"type": "object"}},
                        "annotations": {"type": "array", "items": {"type": "object"}},
                    },
                },
                "exportTimestamp": {"type": "string", "format": "date-time"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Export bundle returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
            "invalid_format": ExitCode(code=2, meaning="Unsupported export format"),
        },
        cliExample="bim-ai export gltf-pbr my-model --view front-elev -o front.glb",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/models/{modelId}/export"),
        sideEffects="none",
        agentSafetyNotes=(
            "EXP-V3-01: deterministic — same model state + same parameters → byte-identical bundle. "
            "Use format=metadata-only to inspect cameras, sun settings, and materials without "
            "triggering a binary asset pipeline. "
            "viewId filters cameras to a single viewpoint or saved_view element."
        ),
    )
)

# ---------------------------------------------------------------------------
# ANN-V3-01 — Detail-region drawing-mode
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="draw-detail-region",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DrawDetailRegionInput",
            "type": "object",
            "required": ["id", "viewId", "vertices"],
            "properties": {
                "id": {"type": "string"},
                "viewId": {"type": "string"},
                "vertices": {
                    "type": "array",
                    "minItems": 2,
                    "items": {
                        "type": "object",
                        "required": ["x", "y"],
                        "properties": {
                            "x": {"type": "number"},
                            "y": {"type": "number"},
                        },
                    },
                },
                "closed": {"type": "boolean", "default": False},
                "hatchId": {"type": "string"},
                "lineweightOverride": {"type": "number"},
                "phaseCreated": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "DrawDetailRegionOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Detail region created"),
            "not_found": ExitCode(code=1, meaning="viewId not found in document"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains create_detail_region",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "ANN-V3-01: creates a DetailRegionElem on the target view. "
            "vertices is a list of {x, y} plan-mm points. "
            "closed=true fills the region with the optional hatch pattern."
        ),
    )
)

# ---------------------------------------------------------------------------
# MAT-V3-01 — Material PBR map slots
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="update-material-pbr",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateMaterialPbrInput",
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "string", "description": "ID of the MaterialElem to update."},
                "albedoMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the albedo (diffuse) map.",
                },
                "normalMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the normal map.",
                },
                "roughnessMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the roughness map.",
                },
                "metalnessMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the metalness map.",
                },
                "aoMapId": {
                    "type": "string",
                    "description": "ID of the image asset to use as the ambient-occlusion map.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "UpdateMaterialPbrOutput",
            "type": "object",
            "properties": {
                "applied": {"type": "boolean"},
                "newRevision": {"type": "integer"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Material PBR maps updated"),
            "not_found": ExitCode(code=1, meaning="materialId not found in document"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="bim-ai apply-bundle bundle.json  # bundle contains update_material_pbr",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/models/{modelId}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "MAT-V3-01: patches PBR map slot IDs on an existing MaterialElem. "
            "Only provided fields are updated; omitted fields are left unchanged. "
            "Image asset IDs are opaque strings — they are not validated against an asset registry."
        ),
    )
)


# ---------------------------------------------------------------------------
# M3-F — Sketch IR, seed, and phase product surfaces
# ---------------------------------------------------------------------------

_SKETCH_IR_REF = "schema:sketch-understanding-ir.v0"
_SKETCH_MATRIX_REF = "schema:sketch-to-bim-capability-matrix.v0"
_SKETCH_PACKET_REF = "schema:sketch-to-bim-initiation-packet.v0"
_CMD_V3_REF = "schema:cmd-v3.0"

register(
    ToolDescriptor(
        name="sketch.ir.validate",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchIrValidateRequest",
            "type": "object",
            "required": ["ir"],
            "properties": {
                "ir": {"type": "object", "description": _SKETCH_IR_REF},
                "capabilityMatrix": {
                    "type": "object",
                    "description": _SKETCH_MATRIX_REF,
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchIrValidateResult",
            "type": "object",
            "required": ["schemaVersion", "ok", "summary", "issues"],
            "properties": {
                "schemaVersion": {"const": "sketch.ir.validate.result.v0"},
                "ok": {"type": "boolean"},
                "summary": {
                    "type": "object",
                    "required": ["errorCount", "warningCount"],
                    "properties": {
                        "errorCount": {"type": "integer"},
                        "warningCount": {"type": "integer"},
                    },
                },
                "issues": {"type": "array", "items": {"type": "object"}},
                "cliEquivalent": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="IR contract is valid"),
            "invalid": ExitCode(code=2, meaning="IR or capability matrix has blocking errors"),
        },
        cliExample=(
            "bim-ai sketch ir validate --ir sketch-ir.json "
            "--capabilities spec/sketch-to-bim-capability-matrix.json --out packet"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/ir/validate"),
        sideEffects="none",
        agentSafetyNotes=(
            "Validation does not create model geometry. Treat a pass as preflight only; "
            "phase acceptance still requires live evidence."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:SketchIrValidateRequest",
            "output:SketchIrValidateResult",
            _SKETCH_IR_REF,
        ],
        exampleRefs=[
            "cli:sketch:ir:validate",
            "spec:examples/sketch-understanding-ir.example.json",
        ],
        resourceGroups=["sketch-to-bim", "sketch-ir", "initiation"],
    )
)

register(
    ToolDescriptor(
        name="sketch.seed.compile",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchSeedCompileRequest",
            "type": "object",
            "required": ["recipe"],
            "properties": {
                "recipe": {"type": "object", "description": "seed-dsl.v0 recipe"},
                "modelHint": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandBundle",
            "type": "object",
            "required": ["schemaVersion", "commands", "assumptions"],
            "properties": {
                "schemaVersion": {"const": "cmd-v3.0"},
                "commands": {"type": "array", "items": {"type": "object"}},
                "assumptions": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle written by CLI compiler"),
            "blocked": ExitCode(code=501, meaning="Python API route is contract-only"),
        },
        cliExample="bim-ai sketch seed compile --recipe seed.json --out bundle.json",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/seed/compile"),
        sideEffects="none",
        implementationStatus="unsupported",
        unsupportedReason=(
            "The product compiler is implemented in packages/cli/lib/seed-dsl.mjs. "
            "The API route is a typed blocked contract until the compiler is hosted server-side."
        ),
        agentSafetyNotes="Compiled output must be submitted through model.dry_run before commit.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:SketchSeedCompileRequest", f"output:{_CMD_V3_REF}"],
        exampleRefs=["cli:sketch:seed:compile", "spec:examples/seed-dsl-modern-house.example.json"],
        resourceGroups=["sketch-to-bim", "seed-dsl", "command-bundle"],
    )
)

register(
    ToolDescriptor(
        name="sketch.phase.apply",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseApplyRequest",
            "type": "object",
            "required": ["modelId", "phaseId", "bundle"],
            "properties": {
                "modelId": {"type": "string"},
                "phaseId": {"type": "string"},
                "featureIds": {"type": "array", "items": {"type": "string"}},
                "bundle": {"type": "object", "description": _CMD_V3_REF},
                "parentRevision": {"type": "integer"},
                "mode": {"type": "string", "enum": ["dry_run", "commit"], "default": "dry_run"},
                "userId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseApplyDelegation",
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "bundleRequest": {"type": "object"},
                "cliEquivalent": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="CLI wrapper submitted phase bundle"),
            "blocked": ExitCode(code=501, meaning="Backend wrapper is contract-only"),
        },
        cliExample=(
            "bim-ai sketch phase apply --model $BIM_AI_MODEL_ID "
            "--bundle phase.json --base 7 --dry-run --out phase-apply.json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/phase/apply"),
        sideEffects="mutates-kernel",
        implementationStatus="unsupported",
        unsupportedReason=(
            "Use the CLI wrapper or POST the described CommandBundle to /api/models/{model_id}/bundles. "
            "The sketch-specific backend wrapper is blocked to avoid duplicating transaction semantics."
        ),
        agentSafetyNotes="Default to dry_run. A commit must include parentRevision and preserve bundle assumptions.",
        kernelCommands=["*"],
        schemaRefs=[
            "input:SketchPhaseApplyRequest",
            "output:SketchPhaseApplyDelegation",
            _CMD_V3_REF,
        ],
        exampleRefs=["cli:sketch:phase:apply"],
        resourceGroups=["sketch-to-bim", "phase", "transaction", "kernel-command"],
    )
)

register(
    ToolDescriptor(
        name="sketch.phase.accept",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseAcceptRequest",
            "type": "object",
            "required": ["phaseId", "packet"],
            "properties": {
                "phaseId": {"type": "string"},
                "packet": {"type": "object", "description": _SKETCH_PACKET_REF},
                "requireCurrentHead": {"type": "boolean", "default": True},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseAcceptResult",
            "type": "object",
            "required": ["schemaVersion", "phaseId", "ok", "summary", "blockers"],
            "properties": {
                "schemaVersion": {"const": "sketch.phase.accept.result.v0"},
                "phaseId": {"type": "string"},
                "ok": {"type": "boolean"},
                "summary": {"type": "object"},
                "blockers": {"type": "array", "items": {"type": "object"}},
                "cliEquivalent": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Phase packet has no acceptance blockers"),
            "blocked": ExitCode(code=5, meaning="Acceptance blockers remain"),
        },
        cliExample=(
            "bim-ai sketch phase accept --ir sketch-ir.json "
            "--capabilities spec/sketch-to-bim-capability-matrix.json --out packet "
            "--fail-on-acceptance"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/phase/accept"),
        sideEffects="none",
        agentSafetyNotes=(
            "Passing acceptance requires current-head evidence, coverage, advisor, and visual gates. "
            "Do not treat stale packets as final acceptance."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:SketchPhaseAcceptRequest",
            "output:SketchPhaseAcceptResult",
            _SKETCH_PACKET_REF,
        ],
        exampleRefs=["cli:sketch:phase:accept"],
        resourceGroups=["sketch-to-bim", "phase", "acceptance", "evidence"],
    )
)

# ---------------------------------------------------------------------------
# AGT-V3-06 — External model-call audit export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="external-model-call-audit-export",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExternalModelCallAuditExportInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExternalModelCallAuditCsv",
            "type": "string",
            "description": "CSV with jobId, modelId, modelVersion, trainOnInputFlag, timestamp, agentIdentifier.",
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="External model-call audit CSV returned"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="curl /api/v3/ai/audit-log.csv",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/ai/audit-log.csv"),
        sideEffects="none",
        agentSafetyNotes=(
            "AGT-V3-06: v3 has no external AI calls, so this export is header-only. "
            "Future integrations must validate calls through bim_ai.ai_boundary with "
            "trainOnInputFlag=false."
        ),
    )
)
