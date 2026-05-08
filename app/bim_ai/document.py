from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field

from bim_ai.elements import Element


class Document(BaseModel):
    revision: int = 1
    elements: dict[str, Annotated[Element, Field(discriminator="kind")]]


from bim_ai.cmd.types import AgentTrace  # noqa: F401 — needed for model_rebuild
Document.model_rebuild()
