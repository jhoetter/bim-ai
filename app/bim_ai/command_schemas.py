from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Any, Literal, get_args, get_origin

from pydantic import BaseModel, TypeAdapter

from bim_ai.commands import Command

COMMAND_SCHEMA_EXPORT_VERSION = "command-schemas-v1"
EXAMPLE_TODO = "TODO: add a stable, minimal example payload for this kernel command."


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


def _command_metadata(name: str, model_cls: type[BaseModel]) -> dict[str, Any]:
    return {
        "name": name,
        "modelClass": model_cls.__name__,
        "example": None,
        "exampleStatus": "todo",
        "todo": EXAMPLE_TODO,
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
