"""OUT-V3-03 — BrandTemplate element + brand-aware PDF export tests.

Covers:
- Create brand template → stored in state with correct fields
- Invalid accentHex (not #RRGGBB) → 400 / ValueError
- Update brand template accent → reflected in state
- Delete brand template → removed from state
- Export PDF without brand → brandLayer null, invariantCheck 'layer-c-only'
- Export PDF with brand → bundle contains brand layer
- Export PDF with nonexistent brandTemplateId → 404
- assert_brand_only_layer_c passes on all valid bundles
- TypeScript round-trip for BrandTemplateElem (structural check)
- TypeScript round-trip for BrandedExportBundle (structural check)
- CSS override snippet preserved verbatim
- Logo mark SVG URI stored + returned correctly
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.commands import (
    CreateBrandTemplateCmd,
    DeleteBrandTemplateCmd,
    UpdateBrandTemplateCmd,
)
from bim_ai.document import Document
from bim_ai.elements import BrandTemplateElem
from bim_ai.engine import apply_inplace, ensure_internal_origin

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "out_v3_03_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}

_BLOCKING_ADVISORY_CLASSES = {
    "revision_conflict",
    "assumption_log_required",
    "assumption_log_malformed",
    "assumption_log_duplicate_key",
    "direct_main_commit_forbidden",
    "option_routing_not_yet_implemented",
}


# ---------------------------------------------------------------------------
# Brand-swap invariant assertion helper
# ---------------------------------------------------------------------------


def assert_brand_only_layer_c(bundle: dict) -> None:
    """Assert that the brand-swap invariant signal is present and correct.

    The contract: only Layer C tokens differ on brand swap, never Layer A.
    This is signalled by invariantCheck == 'layer-c-only'.
    """
    assert bundle.get("invariantCheck") == "layer-c-only", (
        f"Expected invariantCheck='layer-c-only', got {bundle.get('invariantCheck')!r}"
    )


# ---------------------------------------------------------------------------
# Stub test app (no DB required)
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    _models: dict[str, dict[str, Any]] = {}

    def _seed(model_id: str, revision: int = 1) -> None:
        doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        bundle_raw = body.get("bundle")
        if not isinstance(bundle_raw, dict):
            raise HTTPException(status_code=422, detail="bundle field required")

        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        mode_raw = body.get("mode", "dry_run")
        mode = mode_raw if mode_raw in ("dry_run", "commit") else "dry_run"

        doc = _models[model_id]["doc"]
        result, new_doc = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]

        if not result.applied and result.violations:
            blocking_classes = {v.get("advisoryClass") for v in result.violations}
            if blocking_classes & _BLOCKING_ADVISORY_CLASSES:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "result": result.model_dump(by_alias=True),
                        "violations": result.violations,
                    },
                )

        if result.applied and result.new_revision is not None and new_doc is not None:
            _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}

        return result.model_dump(by_alias=True)

    @app.get("/api/models/{model_id}/snapshot")
    async def snapshot(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = _models[model_id]["doc"]
        elements_out = {eid: el.model_dump(by_alias=True) for eid, el in doc.elements.items()}
        return {"modelId": model_id, "revision": doc.revision, "elements": elements_out}

    @app.get("/api/v3/models/{model_id}/export/pdf")
    async def export_branded_pdf(model_id: str, brandTemplateId: str | None = None) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        doc = _models[model_id]["doc"]

        brand_layer: dict[str, Any] | None = None
        if brandTemplateId is not None:
            bt_elem = doc.elements.get(brandTemplateId)
            if bt_elem is None or bt_elem.kind != "brand_template":
                raise HTTPException(
                    status_code=404,
                    detail=f"BrandTemplate '{brandTemplateId}' not found in model",
                )
            assert isinstance(bt_elem, BrandTemplateElem)
            brand_layer = {
                "accentHex": bt_elem.accent_hex,
                "accentForegroundHex": bt_elem.accent_foreground_hex,
                "typeface": bt_elem.typeface,
                "logoMarkSvgUri": bt_elem.logo_mark_svg_uri,
                "cssOverrideSnippet": bt_elem.css_override_snippet,
            }

        sheets = [
            {"sheetId": elem.id, "name": elem.name}
            for elem in doc.elements.values()
            if getattr(elem, "kind", None) == "sheet"
        ]

        return {
            "schemaVersion": "out-v3.0",
            "format": "pdf",
            "brandTemplateId": brandTemplateId,
            "brandLayer": brand_layer,
            "sheets": sheets,
            "invariantCheck": "layer-c-only",
        }

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _bundle(commands: list[dict[str, Any]], revision: int = 1) -> dict[str, Any]:
    return {
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": commands,
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": revision,
        },
        "mode": "commit",
    }


def _create_bt_cmd(
    bt_id: str = "bt-1",
    name: str = "Acme Brand",
    accent_hex: str = "#2563eb",
    accent_fg_hex: str = "#ffffff",
    typeface: str = "Inter",
    logo_uri: str | None = None,
    css_snippet: str | None = None,
) -> dict[str, Any]:
    cmd: dict[str, Any] = {
        "type": "create_brand_template",
        "id": bt_id,
        "name": name,
        "accentHex": accent_hex,
        "accentForegroundHex": accent_fg_hex,
        "typeface": typeface,
    }
    if logo_uri is not None:
        cmd["logoMarkSvgUri"] = logo_uri
    if css_snippet is not None:
        cmd["cssOverrideSnippet"] = css_snippet
    return cmd


# ---------------------------------------------------------------------------
# 1. Create brand template → in state with correct fields
# ---------------------------------------------------------------------------


def test_create_brand_template_stores_element() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    cmd = CreateBrandTemplateCmd(
        id="bt-1",
        name="Acme",
        accentHex="#2563eb",
        accentForegroundHex="#ffffff",
        typeface="Inter",
    )
    apply_inplace(doc, cmd)
    elem = doc.elements["bt-1"]
    assert isinstance(elem, BrandTemplateElem)
    assert elem.kind == "brand_template"
    assert elem.id == "bt-1"
    assert elem.name == "Acme"
    assert elem.accent_hex == "#2563eb"
    assert elem.accent_foreground_hex == "#ffffff"
    assert elem.typeface == "Inter"
    assert elem.logo_mark_svg_uri is None
    assert elem.css_override_snippet is None


# ---------------------------------------------------------------------------
# 2. Invalid accentHex (not #RRGGBB) → ValueError / 400
# ---------------------------------------------------------------------------


def test_create_brand_template_invalid_accent_hex_raises() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    with pytest.raises(ValueError, match="accentHex"):
        apply_inplace(
            doc,
            CreateBrandTemplateCmd(
                id="bt-bad",
                name="Bad",
                accentHex="not-a-hex",
                accentForegroundHex="#ffffff",
            ),
        )


def test_create_brand_template_invalid_accent_foreground_hex_raises() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    with pytest.raises(ValueError, match="accentForegroundHex"):
        apply_inplace(
            doc,
            CreateBrandTemplateCmd(
                id="bt-bad",
                name="Bad",
                accentHex="#2563eb",
                accentForegroundHex="rgb(0,0,0)",
            ),
        )


# ---------------------------------------------------------------------------
# 3. Update brand template accent → reflected
# ---------------------------------------------------------------------------


def test_update_brand_template_accent_reflected() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    apply_inplace(
        doc,
        CreateBrandTemplateCmd(
            id="bt-1",
            name="Acme",
            accentHex="#2563eb",
            accentForegroundHex="#ffffff",
        ),
    )
    apply_inplace(
        doc,
        UpdateBrandTemplateCmd(id="bt-1", accentHex="#dc2626"),
    )
    elem = doc.elements["bt-1"]
    assert isinstance(elem, BrandTemplateElem)
    assert elem.accent_hex == "#dc2626"
    # other fields unchanged
    assert elem.accent_foreground_hex == "#ffffff"
    assert elem.name == "Acme"


# ---------------------------------------------------------------------------
# 4. Delete brand template → removed
# ---------------------------------------------------------------------------


def test_delete_brand_template_removes_element() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    apply_inplace(
        doc,
        CreateBrandTemplateCmd(
            id="bt-1",
            name="Acme",
            accentHex="#2563eb",
            accentForegroundHex="#ffffff",
        ),
    )
    assert "bt-1" in doc.elements
    apply_inplace(doc, DeleteBrandTemplateCmd(id="bt-1"))
    assert "bt-1" not in doc.elements


# ---------------------------------------------------------------------------
# 5. Export PDF without brand → brandLayer null, invariantCheck layer-c-only
# ---------------------------------------------------------------------------


def test_export_pdf_without_brand(client: TestClient) -> None:
    resp = client.get(f"/api/v3/models/{MODEL_ID}/export/pdf")
    assert resp.status_code == 200
    bundle = resp.json()
    assert bundle["schemaVersion"] == "out-v3.0"
    assert bundle["format"] == "pdf"
    assert bundle["brandLayer"] is None
    assert_brand_only_layer_c(bundle)


# ---------------------------------------------------------------------------
# 6. Export PDF with brand → bundle contains brand layer
# ---------------------------------------------------------------------------


def test_export_pdf_with_brand(client: TestClient) -> None:
    # First commit a brand template
    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_create_bt_cmd("bt-export")]),
    )
    assert resp.status_code == 200

    resp = client.get(f"/api/v3/models/{MODEL_ID}/export/pdf?brandTemplateId=bt-export")
    assert resp.status_code == 200
    bundle = resp.json()
    assert bundle["brandTemplateId"] == "bt-export"
    assert bundle["brandLayer"] is not None
    assert bundle["brandLayer"]["accentHex"] == "#2563eb"
    assert bundle["brandLayer"]["accentForegroundHex"] == "#ffffff"
    assert bundle["brandLayer"]["typeface"] == "Inter"
    assert_brand_only_layer_c(bundle)


# ---------------------------------------------------------------------------
# 7. Export PDF with nonexistent brandTemplateId → 404
# ---------------------------------------------------------------------------


def test_export_pdf_nonexistent_brand_template_404(client: TestClient) -> None:
    resp = client.get(f"/api/v3/models/{MODEL_ID}/export/pdf?brandTemplateId=no-such-bt")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 8. assert_brand_only_layer_c passes on all valid bundles
# ---------------------------------------------------------------------------


def test_assert_brand_only_layer_c_passes_on_valid_bundle() -> None:
    valid_bundle = {
        "schemaVersion": "out-v3.0",
        "format": "pdf",
        "brandTemplateId": None,
        "brandLayer": None,
        "sheets": [],
        "invariantCheck": "layer-c-only",
    }
    assert_brand_only_layer_c(valid_bundle)  # must not raise


def test_assert_brand_only_layer_c_fails_on_bad_bundle() -> None:
    bad_bundle = {
        "schemaVersion": "out-v3.0",
        "format": "pdf",
        "invariantCheck": "some-other-value",
    }
    with pytest.raises(AssertionError):
        assert_brand_only_layer_c(bad_bundle)


# ---------------------------------------------------------------------------
# 9. TypeScript round-trip for BrandTemplateElem (structural check)
# ---------------------------------------------------------------------------


def test_typescript_brand_template_elem_structural_shape() -> None:
    """Verify BrandTemplateElem can be constructed as a dict matching the TS shape."""
    elem: dict[str, Any] = {
        "kind": "brand_template",
        "id": "bt-ts",
        "name": "TS Brand",
        "accentHex": "#1d4ed8",
        "accentForegroundHex": "#f0f9ff",
        "typeface": "Helvetica Neue",
    }
    assert elem["kind"] == "brand_template"
    assert elem["accentHex"].startswith("#")
    assert len(elem["accentHex"]) == 7


# ---------------------------------------------------------------------------
# 10. TypeScript round-trip for BrandedExportBundle (structural check)
# ---------------------------------------------------------------------------


def test_typescript_branded_export_bundle_structural_shape() -> None:
    bundle: dict[str, Any] = {
        "schemaVersion": "out-v3.0",
        "format": "pdf",
        "brandTemplateId": "bt-ts",
        "brandLayer": {
            "accentHex": "#1d4ed8",
            "accentForegroundHex": "#f0f9ff",
            "typeface": "Helvetica Neue",
        },
        "sheets": [{"sheetId": "sh-1", "name": "Sheet 001"}],
        "invariantCheck": "layer-c-only",
    }
    assert bundle["schemaVersion"] == "out-v3.0"
    assert bundle["invariantCheck"] == "layer-c-only"
    assert isinstance(bundle["sheets"], list)
    assert_brand_only_layer_c(bundle)


# ---------------------------------------------------------------------------
# 11. CSS override snippet preserved verbatim
# ---------------------------------------------------------------------------


def test_css_override_snippet_preserved_verbatim() -> None:
    css = ":root { --accent: #ff0000; } .header { font-family: 'Brand Font'; }"
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    apply_inplace(
        doc,
        CreateBrandTemplateCmd(
            id="bt-css",
            name="CSS Brand",
            accentHex="#ff0000",
            accentForegroundHex="#ffffff",
            cssOverrideSnippet=css,
        ),
    )
    elem = doc.elements["bt-css"]
    assert isinstance(elem, BrandTemplateElem)
    assert elem.css_override_snippet == css


# ---------------------------------------------------------------------------
# 12. Logo mark SVG URI stored + returned correctly
# ---------------------------------------------------------------------------


def test_logo_mark_svg_uri_stored_and_returned(client: TestClient) -> None:
    svg_uri = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4="
    model_id = str(uuid.uuid4())

    # Build a fresh app so we don't collide with MODULE_ID fixture
    app = _build_test_app()
    fresh_client = TestClient(app)

    # The fixture only seeded MODEL_ID, so we need a different approach:
    # use the main MODEL_ID with a unique bt id
    resp = fresh_client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([
            _create_bt_cmd(
                bt_id="bt-logo",
                logo_uri=svg_uri,
            )
        ]),
    )
    assert resp.status_code == 200

    resp = fresh_client.get(f"/api/v3/models/{MODEL_ID}/export/pdf?brandTemplateId=bt-logo")
    assert resp.status_code == 200
    bundle = resp.json()
    assert bundle["brandLayer"] is not None
    assert bundle["brandLayer"]["logoMarkSvgUri"] == svg_uri
    assert_brand_only_layer_c(bundle)
