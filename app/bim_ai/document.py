from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field

from bim_ai.elements import Element


class Document(BaseModel):
    revision: int = 1
    elements: dict[str, Annotated[Element, Field(discriminator="kind")]]
