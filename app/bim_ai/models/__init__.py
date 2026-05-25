"""Typed request/response models for the bim_ai HTTP surface.

Per the BRT-30/BRT-31 plan in `spec/trackers/backend-rework-tracker.md`, this
subpackage is where Pydantic request bodies and response shapes that
back the FastAPI routes live.

Route handlers historically accepted an untyped JSON body and called
``body.get(KEY)`` for each field. Models in this subpackage declare
those keys explicitly, accept both camelCase and snake_case via
``populate_by_name=True``, and keep ``extra="allow"`` so callers that
pass undocumented fields still work — Pydantic is a validation layer
here, not a contract narrowing.
"""

__all__: list[str] = []
