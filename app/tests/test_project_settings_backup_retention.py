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
