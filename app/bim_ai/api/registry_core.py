"""Core ToolDescriptor registry primitives for API-V3 descriptors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from bim_ai.api.registry_metadata import KERNEL_COMMANDS_BY_TOOL, RESOURCE_GROUPS_BY_TOOL


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
    surfaceMetadata: dict[str, Any] = field(default_factory=dict)

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
        if not self.kernelCommands and self.name in KERNEL_COMMANDS_BY_TOOL:
            object.__setattr__(self, "kernelCommands", list(KERNEL_COMMANDS_BY_TOOL[self.name]))
        if not self.resourceGroups:
            groups = RESOURCE_GROUPS_BY_TOOL.get(self.name)
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
