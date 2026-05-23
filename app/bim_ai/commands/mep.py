"""MEP-domain command re-exports.

Pipe / duct / cable-tray / fixture / mep-equipment / mep-terminal /
opening-request command classes live in ``bim_ai.commands_mep`` (the legacy
sibling module). This file re-exports them so the BRT-22 per-domain layout
exposes a uniform ``bim_ai.commands.mep`` namespace alongside ``geometry``,
``hosting``, ``schedule``, ``site``, ``documentation``, and ``other``.
"""

from __future__ import annotations

from bim_ai.commands_mep import (
    CreateCableTrayCmd,
    CreateDuctCmd,
    CreateDuctLegendCmd,
    CreateFixtureCmd,
    CreateMepEquipmentCmd,
    CreateMepOpeningRequestCmd,
    CreateMepTerminalCmd,
    CreatePipeCmd,
    CreatePipeLegendCmd,
    MepSystemCmdType,
)

__all__ = [
    "CreateCableTrayCmd",
    "CreateDuctCmd",
    "CreateDuctLegendCmd",
    "CreateFixtureCmd",
    "CreateMepEquipmentCmd",
    "CreateMepOpeningRequestCmd",
    "CreateMepTerminalCmd",
    "CreatePipeCmd",
    "CreatePipeLegendCmd",
    "MepSystemCmdType",
]
