# ruff: noqa: I001

from bim_ai.engine import (
    Command,
    Document,
    SourceDocProvider,
    _enforce_linked_readonly,
    _enforce_pin_block,
)

from bim_ai.engine_dispatch_core import try_apply_core_command
from bim_ai.engine_dispatch_properties import try_apply_properties_command
from bim_ai.engine_dispatch_building import try_apply_building_command
from bim_ai.engine_dispatch_structure import try_apply_structure_command
from bim_ai.engine_dispatch_documentation import try_apply_documentation_command
from bim_ai.engine_dispatch_coordination import try_apply_coordination_command
from bim_ai.engine_dispatch_viewsheets import try_apply_viewsheets_command
from bim_ai.engine_dispatch_siteassets import try_apply_siteassets_command
from bim_ai.engine_dispatch_presentation import try_apply_presentation_command


def apply_inplace(
    doc: Document,
    cmd: Command,
    *,
    source_provider: SourceDocProvider | None = None,
) -> None:
    """Apply ``cmd`` to ``doc`` in place.

    ``source_provider`` is optional: only ``RunClashTestCmd`` (FED-02) consults
    it to walk linked source documents for cross-link clash detection. All
    other commands ignore it. The route layer threads a real DB-backed
    provider; tests and intra-host paths can omit it.
    """
    els = doc.elements
    _enforce_linked_readonly(cmd)
    _enforce_pin_block(els, cmd)
    for handler in (
        try_apply_core_command,
        try_apply_properties_command,
        try_apply_building_command,
        try_apply_structure_command,
        try_apply_documentation_command,
        try_apply_coordination_command,
        try_apply_viewsheets_command,
        try_apply_siteassets_command,
        try_apply_presentation_command,
    ):
        if handler(doc, cmd, source_provider=source_provider):
            break

    # KRN-08: areas track a derived computedAreaSqMm. Recompute after every
    # command apply so create/update/delete of areas (and shafts that affect
    # `net` rule-set deductions) keep the value current.
    from bim_ai.area_calculation import recompute_all_areas

    recompute_all_areas(els)
