# ruff: noqa: I001

from bim_ai.engine_dispatch_building_envelope import try_apply_building_envelope_command
from bim_ai.engine_dispatch_building_edit import try_apply_building_edit_command


def try_apply_building_command(doc, cmd, *, source_provider=None) -> bool:
    for handler in (
        try_apply_building_envelope_command,
        try_apply_building_edit_command,
    ):
        if handler(doc, cmd, source_provider=source_provider):
            return True
    return False
