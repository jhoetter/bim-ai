"""Pydantic response shapes for routes_reverse_bim (BRT-04).

Nearly every reverse-BIM and source-pipeline endpoint returns the
same shell:

    {"ok": bool, "format": "<reverseBim|source>...<version>", ...}

The legacy code returns these as `dict[str, Any]`; clients have to
trust the format string. These models lift the common shell into
typed `*Response` classes with `extra="allow"` so the per-route
fields (which differ across 60 handlers) flow through unchanged
while OpenAPI clients can rely on `ok` + `format` always being
present and well-typed.

Per-route deep shapes are deliberately *not* modeled here — the
shell + extra="allow" gives us the OpenAPI documentation win without
the maintenance burden of 60 hand-typed response shapes. Handlers
that warrant deeper validation (e.g. v1-stable endpoints) can
graduate to dedicated `*StrictResponse` models over time.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(
        extra="allow",
        populate_by_name=True,
        protected_namespaces=(),
    )


class OperationResponse(_Base):
    """Common shell returned by ~all reverse-BIM and source endpoints."""

    ok: bool = Field(description="True if the operation produced a usable artifact")
    format: str = Field(
        description="Stable format identifier with version suffix, e.g. "
        "`sourceFolderManifest_v1`. Clients should branch on this rather "
        "than relying on payload shape."
    )


class FolderOutputResponse(_Base):
    """Response of /v3/reverse-bim/folder-output and related package builders.

    Carries the package state + acceptance subreport that BRT-21
    work depends on; modeled separately because the acceptance
    block is non-trivial.
    """

    ok: bool
    format: str
    package_state: str | None = Field(
        default=None,
        alias="packageState",
        description="One of source_rejected | ai_reader_pending | ready_for_modeling",
    )
    source_folder: str | None = Field(default=None, alias="sourceFolder")
    output_dir: str | None = Field(default=None, alias="outputDir")
    summary: dict[str, Any] | None = None
    acceptance: dict[str, Any] | None = None
    next_step: str | None = Field(default=None, alias="nextStep")


class HybridSliceExecuteResponse(_Base):
    """Response of /v3/reverse-bim/hybrid-slice-execute."""

    ok: bool
    format: str
    slice_id: str | None = Field(default=None, alias="sliceId")
    summary: dict[str, Any] | None = None


class HybridRunExecuteResponse(_Base):
    """Response of /v3/reverse-bim/hybrid-run-execute."""

    ok: bool
    format: str
    run_id: str | None = Field(default=None, alias="runId")
    summary: dict[str, Any] | None = None


class ReverseBimViewBundleResponse(_Base):
    """Response of the reverse-BIM view-bundle endpoints.

    Returned by `_reverse_bim_view_bundle` which wraps
    `build_semantic_authoring_bundle(...).model_dump(by_alias=True)`.
    Already shape-stable; modeled here so clients can rely on it.
    """

    ok: bool | None = None
    format: str | None = None
    commands: list[dict[str, Any]] | None = None
    assumptions: list[dict[str, Any]] | None = None
    summary: dict[str, Any] | None = None
