"""F-090 DB checkpoint retention setting for project settings."""

import pytest

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import ProjectSettingsElem
from bim_ai.engine import apply_inplace


def test_project_settings_checkpoint_retention_updates() -> None:
    doc = Document(
        revision=1,
        elements={"project_settings": ProjectSettingsElem(id="project_settings")},
    )

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="project_settings",
            key="checkpointRetentionLimit",
            value="7",
        ),
    )

    settings = doc.elements["project_settings"]
    assert isinstance(settings, ProjectSettingsElem)
    assert settings.checkpoint_retention_limit == 7


def test_project_settings_setup_fields_update() -> None:
    doc = Document(
        revision=1,
        elements={"project_settings": ProjectSettingsElem(id="project_settings")},
    )

    for key, value in [
        ("name", "House A"),
        ("projectNumber", "P-42"),
        ("clientName", "Client"),
        ("projectAddress", "Main Street 1"),
        ("projectStatus", "Schematic"),
        ("lengthUnit", "meter"),
        ("displayLocale", "de-DE"),
        ("volumeComputedAt", "core_faces"),
        ("roomAreaComputationBasis", "wall_core_center"),
    ]:
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(
                elementId="project_settings",
                key=key,
                value=value,
            ),
        )

    settings = doc.elements["project_settings"]
    assert isinstance(settings, ProjectSettingsElem)
    assert settings.name == "House A"
    assert settings.project_number == "P-42"
    assert settings.client_name == "Client"
    assert settings.project_address == "Main Street 1"
    assert settings.project_status == "Schematic"
    assert settings.length_unit == "meter"
    assert settings.display_locale == "de-DE"
    assert settings.volume_computed_at == "core_faces"
    assert settings.room_area_computation_basis == "wall_core_center"


@pytest.mark.parametrize("value", ["0", "100", "abc"])
def test_project_settings_checkpoint_retention_rejects_invalid_values(value: str) -> None:
    doc = Document(
        revision=1,
        elements={"project_settings": ProjectSettingsElem(id="project_settings")},
    )

    with pytest.raises(ValueError, match="checkpointRetentionLimit must be an integer 1..99"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(
                elementId="project_settings",
                key="checkpointRetentionLimit",
                value=value,
            ),
        )
