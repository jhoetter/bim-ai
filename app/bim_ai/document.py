from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.elements import Element


class DesignOption(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    name: str
    is_primary: bool = Field(default=False, alias="isPrimary")


class DesignOptionSet(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: str
    name: str
    options: list[DesignOption] = Field(default_factory=list)


class Document(BaseModel):
    revision: int = 1
    elements: dict[str, Annotated[Element, Field(discriminator="kind")]]
    design_option_sets: list[DesignOptionSet] = Field(
        default_factory=list, alias="designOptionSets"
    )


from bim_ai.cmd.types import AgentTrace  # noqa: E402, F401 — needed for model_rebuild

Document.model_rebuild()
