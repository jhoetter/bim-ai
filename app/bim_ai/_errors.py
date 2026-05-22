"""Structured route-error handling (BRT-06).

The 2026-05-22 audit counted 234 `raise HTTPException(...)` sites
across the backend, with varied `detail` shapes — sometimes a bare
string, sometimes a dict with a `code`. That inconsistency makes
client-side error handling and OpenAPI documentation lossy.

`RouteError` is the canonical exception type. The handler
registered via :func:`register_route_error_handler` converts it
into a uniform JSON envelope:

    {
      "ok": false,
      "error": {
        "code": "missing_field",
        "message": "outputDir is required",
        "fields": ["outputDir"],   # optional, free-form per error code
        "status": 422
      }
    }

Migration plan (see `spec/backend-rework-tracker.md` BRT-06):
1. Land this module + global handler.
2. Migrate route files incrementally — each file's `HTTPException`
   sites become `raise RouteError(code=..., message=..., status=...)`.
3. The legacy `raise HTTPException(...)` keeps working during the
   migration; mixing the two is intentionally fine.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class RouteError(Exception):
    """Raise inside a FastAPI route to emit a structured error envelope.

    Parameters
    ----------
    code:
        Stable identifier consumers can switch on (e.g.
        ``"missing_field"``, ``"unsupported_operation"``,
        ``"model_not_found"``).
    message:
        Human-readable message. Safe to surface in UIs.
    status:
        HTTP status code. Defaults to 422 to match the most common
        ``raise HTTPException(status_code=422, ...)`` shape in the
        legacy codebase.
    fields:
        Optional list of field names the error relates to (useful for
        form validation).
    extra:
        Free-form additional context the client may want. Merged into
        the envelope's ``error`` object alongside ``code`` / ``message``.
    """

    def __init__(
        self,
        *,
        code: str,
        message: str,
        status: int = 422,
        fields: list[str] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.fields = list(fields) if fields else None
        self.extra = dict(extra) if extra else None

    def to_envelope(self) -> dict[str, Any]:
        # Returned envelope shape is polymorphic — `extra` can carry
        # error-code-specific context. dict[str, Any] is intentional
        # here; whitelisted via spec/typed-contracts-baseline.json.
        error: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "status": self.status,
        }
        if self.fields:
            error["fields"] = self.fields
        if self.extra:
            for key, value in self.extra.items():
                if key in error:
                    continue
                error[key] = value
        return {"ok": False, "error": error}


def register_route_error_handler(app: FastAPI) -> None:
    """Attach the global RouteError handler to *app*."""

    async def _handle(_request: Request, exc: Exception) -> JSONResponse:
        # ``handler`` signature must accept ``Exception`` per FastAPI's
        # type, but only RouteError reaches us in practice because that
        # is the type we registered.
        assert isinstance(exc, RouteError)
        return JSONResponse(status_code=exc.status, content=exc.to_envelope())

    app.add_exception_handler(RouteError, _handle)
