from __future__ import annotations

from functools import lru_cache
from types import UnionType
from typing import Annotated, Any, Literal, Union, get_args, get_origin

from pydantic import BaseModel, TypeAdapter

from bim_ai.commands import Command

COMMAND_SCHEMA_EXPORT_VERSION = "command-schemas-v1"
RAW_BUNDLE_ROUTE = "POST /api/models/{model_id}/bundles"


def _command_model_classes() -> tuple[type[BaseModel], ...]:
    """Return the Pydantic models that make up the discriminated Command union."""

    if get_origin(Command) is not Annotated:
        raise TypeError("bim_ai.commands.Command must remain an Annotated discriminated union.")
    union_type = get_args(Command)[0]
    command_models = get_args(union_type)
    if not command_models:
        raise TypeError("bim_ai.commands.Command does not expose any union members.")
    return command_models


def _command_discriminator(model_cls: type[BaseModel]) -> str:
    field = model_cls.model_fields.get("type")
    if field is None:
        raise TypeError(f"{model_cls.__name__} is missing required discriminator field 'type'.")
    values = get_args(field.annotation)
    if get_origin(field.annotation) is not Literal or len(values) != 1:
        raise TypeError(f"{model_cls.__name__}.type must be a single-value Literal.")
    return str(values[0])


def command_model_map() -> dict[str, type[BaseModel]]:
    """Map every backend command discriminator to its Pydantic model class."""

    out: dict[str, type[BaseModel]] = {}
    for model_cls in _command_model_classes():
        name = _command_discriminator(model_cls)
        if name in out:
            raise ValueError(
                f"Duplicate command discriminator {name!r}: "
                f"{out[name].__name__} and {model_cls.__name__}."
            )
        out[name] = model_cls
    return dict(sorted(out.items()))


def _wire_name(field_name: str, field: Any) -> str:
    return str(field.alias or field_name)


def _sample_string(name: str) -> str:
    lower = name.lower()
    if lower == "type":
        return "commandType"
    if lower in {"kind", "category"}:
        return "default"
    if lower.endswith("id") or lower.endswith("_id"):
        stem = lower.removesuffix("_id").removesuffix("id").replace("_", "-") or "element"
        return f"{stem}-1"
    if "path" in lower:
        return "artifacts/example.json"
    if "color" in lower or "colour" in lower:
        return "#808080"
    if "name" in lower or "label" in lower or "title" in lower:
        return "Example"
    return "example"


def _sample_number(name: str) -> float | int:
    lower = name.lower()
    if any(
        token in lower for token in ("height", "width", "thickness", "length", "radius", "depth")
    ):
        return 1000
    if lower.endswith("t") or "ratio" in lower or "percent" in lower:
        return 0.5
    return 0


def _strip_annotated(annotation: Any) -> Any:
    while get_origin(annotation) is Annotated:
        annotation = get_args(annotation)[0]
    return annotation


def _first_non_none_arg(args: tuple[Any, ...]) -> Any:
    for arg in args:
        if arg is not type(None):
            return arg
    return args[0] if args else Any


def _example_value(annotation: Any, name: str, depth: int = 0) -> Any:
    if depth > 8:
        return None

    annotation = _strip_annotated(annotation)
    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin is Literal:
        return args[0] if args else _sample_string(name)
    if annotation is list or origin in {list, tuple, set}:
        return []
    if annotation is dict or origin is dict:
        return {}
    if origin in {UnionType, Union}:
        return _example_value(_first_non_none_arg(args), name, depth + 1)
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return _model_example(annotation, depth + 1)
    if annotation is str:
        return _sample_string(name)
    if annotation is int:
        return int(_sample_number(name))
    if annotation is float:
        return float(_sample_number(name))
    if annotation is bool:
        return False
    return None


def _model_example(model_cls: type[BaseModel], depth: int = 0) -> dict[str, Any]:
    example: dict[str, Any] = {}
    for field_name, field in model_cls.model_fields.items():
        wire_name = _wire_name(field_name, field)
        if field_name == "type":
            example[wire_name] = _example_value(field.annotation, field_name, depth + 1)
            continue
        if not field.is_required():
            continue
        example[wire_name] = _example_value(field.annotation, wire_name, depth + 1)
    return example


def _validated_example(model_cls: type[BaseModel]) -> tuple[dict[str, Any] | None, str, str | None]:
    example = _model_example(model_cls)
    try:
        model_cls.model_validate(example)
    except Exception as exc:  # pragma: no cover - exact validation text is environment-specific.
        return None, "unavailable", f"Generated minimal example did not validate: {exc}"
    return example, "generated-minimal", None


def _normalize(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


def _registry_mappings_for_command(name: str) -> list[dict[str, Any]]:
    from bim_ai.api.registry import get_catalog

    normalized_name = _normalize(name)
    rows: list[dict[str, Any]] = []
    for descriptor in get_catalog().tools:
        commands = list(descriptor.kernelCommands or [])
        if "*" in commands or not any(_normalize(cmd) == normalized_name for cmd in commands):
            continue
        groups = list(descriptor.resourceGroups or [])
        stable_id = descriptor.stableId or descriptor.name
        if "semantic-authoring" in groups or stable_id.startswith(("author.", "opening.")):
            mapping_kind = "semantic-authoring"
        else:
            mapping_kind = "typed-kernel-tool"
        rows.append(
            {
                "descriptor": descriptor.name,
                "stableId": stable_id,
                "mappingKind": mapping_kind,
                "transport": {
                    "method": descriptor.restEndpoint.method,
                    "path": descriptor.restEndpoint.path,
                },
                "resourceGroups": groups,
            }
        )
    return sorted(rows, key=lambda row: (row["mappingKind"], row["stableId"]))


def _raw_semantic_mapping(name: str) -> dict[str, Any]:
    descriptor_mappings = _registry_mappings_for_command(name)
    has_semantic = any(row["mappingKind"] == "semantic-authoring" for row in descriptor_mappings)
    if has_semantic:
        agent_surface = "semantic-authoring"
    elif descriptor_mappings:
        agent_surface = "typed-kernel-tool"
    else:
        agent_surface = "raw-expert"
    return {
        "agentSurface": agent_surface,
        "rawExecution": {
            "available": True,
            "transport": RAW_BUNDLE_ROUTE,
            "bundlePath": "bundle.commands[]",
        },
        "descriptorMappings": descriptor_mappings,
        "rawOnly": not descriptor_mappings,
        "rawOnlyReason": (
            "No first-class descriptor maps to this discriminator; keep usage explicit "
            "through expert/raw command bundles."
            if not descriptor_mappings
            else None
        ),
    }


def _command_metadata(name: str, model_cls: type[BaseModel]) -> dict[str, Any]:
    example, example_status, example_error = _validated_example(model_cls)
    mapping = _raw_semantic_mapping(name)
    return {
        "name": name,
        "modelClass": model_cls.__name__,
        "example": example,
        "exampleStatus": example_status,
        "exampleError": example_error,
        "rawSemanticMapping": mapping,
        "mappingStatus": (
            "mapped" if mapping["descriptorMappings"] else "explicit-raw-expert"
        ),
    }


@lru_cache(maxsize=1)
def export_command_schemas() -> dict[str, Any]:
    """Return the backend command catalogue for API/CLI/MCP audit tooling.

    The source of truth is the `Command` discriminated union in `commands.py`.
    Schemas are emitted per discriminator so downstream audits can list or
    inspect individual kernel command payloads without importing backend code.
    """

    model_map = command_model_map()
    command_names = list(model_map)
    schemas = {
        name: TypeAdapter(model_cls).json_schema(by_alias=True)
        for name, model_cls in model_map.items()
    }
    metadata = {
        name: _command_metadata(name, model_cls)
        for name, model_cls in model_map.items()
    }
    return {
        "schemaVersion": COMMAND_SCHEMA_EXPORT_VERSION,
        "commandCount": len(command_names),
        "commandNames": command_names,
        "schemas": schemas,
        "metadata": metadata,
        "unionSchema": TypeAdapter(Command).json_schema(by_alias=True),
    }


def get_command_schema(name: str) -> dict[str, Any] | None:
    export = export_command_schemas()
    schema = export["schemas"].get(name)
    if schema is None:
        return None
    return {
        "schemaVersion": export["schemaVersion"],
        "name": name,
        "schema": schema,
        "metadata": export["metadata"][name],
    }
