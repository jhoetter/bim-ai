from __future__ import annotations

from pydantic import TypeAdapter

from bim_ai.codes import BUILDING_PRESETS
from bim_ai.commands import Command
from bim_ai.constraints import evaluate


def test_presets_non_empty() -> None:
    assert BUILDING_PRESETS
    assert "residential" in BUILDING_PRESETS


def test_command_schema_contains_create_room_rectangle() -> None:

    dumped = TypeAdapter(Command).json_schema(mode="serialization")

    assert "createRoomRectangle" in repr(dumped)


def test_evaluate_handles_empty_document() -> None:

    viols = evaluate({})

    assert viols == []
