"""Pydantic request bodies for ``routes_sketch_product`` (BRT-03).

The sketch-to-BIM M3-F product tool contracts. Each model maps one
handler in ``app/bim_ai/routes_sketch_product.py``.

Validation rules:

1. ``model_config = ConfigDict(extra="allow", populate_by_name=True,
   protected_namespaces=())`` preserves the legacy dict semantics.
2. Required-field shape validation (``ir`` must be a dict,
   ``modelId`` must be a non-empty string, ...) stays in the handler via
   explicit ``if not isinstance(...) ...: raise HTTPException(422, ...)``
   blocks that match the previous error messages verbatim.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True, protected_namespaces=())


class SketchIrValidateRequest(_Base):
    ir: Any | None = None
    capability_matrix: Any | None = Field(default=None, alias="capabilityMatrix")


class SketchSeedCompileRequest(_Base):
    recipe: Any | None = None


class SketchPhaseApplyRequest(_Base):
    model_id: Any | None = Field(default=None, alias="modelId")
    phase_id: Any | None = Field(default=None, alias="phaseId")
    bundle: Any | None = None
    mode: Any | None = None
    feature_ids: Any | None = Field(default=None, alias="featureIds")
    user_id: Any | None = Field(default=None, alias="userId")
    parent_revision: Any | None = Field(default=None, alias="parentRevision")


class SketchPhaseAcceptRequest(_Base):
    phase_id: Any | None = Field(default=None, alias="phaseId")
    packet: Any | None = None
    require_current_head: Any | None = Field(default=None, alias="requireCurrentHead")


__all__ = [
    "SketchIrValidateRequest",
    "SketchPhaseAcceptRequest",
    "SketchPhaseApplyRequest",
    "SketchSeedCompileRequest",
]
