"""IMP-V3-01 — Image-as-underlay import tests.

Covers:
- Import PNG underlay (data URI) → element in state with correct rect/opacity
- Import JPEG underlay → accepted
- Import PDF underlay → accepted
- Import with invalid format (SVG) → 400
- Import with src > 50 MB → 400 validation error
- Move underlay → rect_mm updated (width/height preserved)
- Scale underlay → width/height updated
- Rotate underlay → rotation_deg updated
- Delete underlay → removed from state
- Default opacity = 0.4
- Default rotation = 0.0
- TypeScript round-trip for ImageUnderlayElem (field shape check)
"""

from __future__ import annotations

import base64
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.api.registry import get_catalog
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import ImageUnderlayElem
from bim_ai.engine import apply_inplace, ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "imp_v3_01_test",
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
}

# Minimal valid 1×1 PNG base64 — real PNG header + IHDR + IDAT + IEND
_PNG_1X1_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
_PNG_DATA_URI = f"data:image/png;base64,{_PNG_1X1_B64}"

_JPEG_DATA_URI = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 10).decode()

_PDF_DATA_URI = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 test").decode()

_RECT_MM = {"xMm": 100.0, "yMm": 200.0, "widthMm": 5000.0, "heightMm": 3000.0}


def _build_test_app() -> FastAPI:
    """Stub app with in-memory model store — no DB required."""
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
        try:
            result, new_doc = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

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

    @app.get("/api/v3/tools")
    async def list_tools() -> Any:
        from dataclasses import asdict

        catalog = get_catalog()
        return {
            "schemaVersion": catalog.schemaVersion,
            "tools": [asdict(t) for t in catalog.tools],
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


def _make_fresh_doc() -> Document:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    return doc


# ---------------------------------------------------------------------------
# Unit-level engine tests (no HTTP layer)
# ---------------------------------------------------------------------------


def test_import_png_underlay_creates_element() -> None:
    """Import PNG underlay → element in state with correct rect/opacity."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "underlay-1",
            "src": _PNG_DATA_URI,
            "rectMm": _RECT_MM,
            "opacity": 0.4,
        }
    )
    apply_inplace(doc, cmd)

    elem = doc.elements.get("underlay-1")
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.kind == "image_underlay"
    assert elem.src == _PNG_DATA_URI
    assert elem.rect_mm["xMm"] == pytest.approx(100.0)
    assert elem.rect_mm["yMm"] == pytest.approx(200.0)
    assert elem.rect_mm["widthMm"] == pytest.approx(5000.0)
    assert elem.rect_mm["heightMm"] == pytest.approx(3000.0)
    assert elem.opacity == pytest.approx(0.4)


def test_import_jpeg_underlay_accepted() -> None:
    """Import JPEG underlay → accepted."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "underlay-jpeg",
            "src": _JPEG_DATA_URI,
            "rectMm": _RECT_MM,
        }
    )
    apply_inplace(doc, cmd)

    elem = doc.elements.get("underlay-jpeg")
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.src.startswith("data:image/jpeg")


def test_import_pdf_underlay_accepted() -> None:
    """Import PDF underlay → accepted."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "underlay-pdf",
            "src": _PDF_DATA_URI,
            "rectMm": _RECT_MM,
        }
    )
    apply_inplace(doc, cmd)

    elem = doc.elements.get("underlay-pdf")
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.src.startswith("data:application/pdf")


def test_import_invalid_format_raises() -> None:
    """Import with invalid format (SVG) → ValueError."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    svg_uri = "data:image/svg+xml;base64," + base64.b64encode(b"<svg/>").decode()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "underlay-svg",
            "src": svg_uri,
            "rectMm": _RECT_MM,
        }
    )
    with pytest.raises(ValueError, match="data:image/png"):
        apply_inplace(doc, cmd)


def test_import_src_too_large_raises() -> None:
    """Import with src > 50 MB → ValueError."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    # Create a src that is definitely > 50 MB when encoded as bytes
    big_b64 = base64.b64encode(b"\x00" * (51 * 1024 * 1024)).decode()
    big_uri = f"data:image/png;base64,{big_b64}"

    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "underlay-big",
            "src": big_uri,
            "rectMm": _RECT_MM,
        }
    )
    with pytest.raises(ValueError, match="50 MB"):
        apply_inplace(doc, cmd)


def test_move_underlay_updates_position_preserves_size() -> None:
    """Move underlay → rect_mm position updated, width/height preserved."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd, MoveImageUnderlayCmd

    doc = _make_fresh_doc()
    apply_inplace(
        doc,
        TypeAdapter(ImportImageUnderlayCmd).validate_python(
            {
                "type": "import_image_underlay",
                "id": "ul-1",
                "src": _PNG_DATA_URI,
                "rectMm": _RECT_MM,
            }
        ),
    )

    move_cmd = TypeAdapter(MoveImageUnderlayCmd).validate_python(
        {
            "type": "move_image_underlay",
            "id": "ul-1",
            "rectMm": {"xMm": 999.0, "yMm": 888.0, "widthMm": 0, "heightMm": 0},
        }
    )
    apply_inplace(doc, move_cmd)

    elem = doc.elements["ul-1"]
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.rect_mm["xMm"] == pytest.approx(999.0)
    assert elem.rect_mm["yMm"] == pytest.approx(888.0)
    # Original width/height must be preserved
    assert elem.rect_mm["widthMm"] == pytest.approx(5000.0)
    assert elem.rect_mm["heightMm"] == pytest.approx(3000.0)


def test_scale_underlay_updates_dimensions() -> None:
    """Scale underlay → width/height updated."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd, ScaleImageUnderlayCmd

    doc = _make_fresh_doc()
    apply_inplace(
        doc,
        TypeAdapter(ImportImageUnderlayCmd).validate_python(
            {
                "type": "import_image_underlay",
                "id": "ul-scale",
                "src": _PNG_DATA_URI,
                "rectMm": _RECT_MM,
            }
        ),
    )

    scale_cmd = TypeAdapter(ScaleImageUnderlayCmd).validate_python(
        {
            "type": "scale_image_underlay",
            "id": "ul-scale",
            "widthMm": 8000.0,
            "heightMm": 6000.0,
        }
    )
    apply_inplace(doc, scale_cmd)

    elem = doc.elements["ul-scale"]
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.rect_mm["widthMm"] == pytest.approx(8000.0)
    assert elem.rect_mm["heightMm"] == pytest.approx(6000.0)
    # Position must be preserved
    assert elem.rect_mm["xMm"] == pytest.approx(100.0)
    assert elem.rect_mm["yMm"] == pytest.approx(200.0)


def test_rotate_underlay_updates_rotation() -> None:
    """Rotate underlay → rotation_deg updated."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd, RotateImageUnderlayCmd

    doc = _make_fresh_doc()
    apply_inplace(
        doc,
        TypeAdapter(ImportImageUnderlayCmd).validate_python(
            {
                "type": "import_image_underlay",
                "id": "ul-rot",
                "src": _PNG_DATA_URI,
                "rectMm": _RECT_MM,
            }
        ),
    )

    rot_cmd = TypeAdapter(RotateImageUnderlayCmd).validate_python(
        {
            "type": "rotate_image_underlay",
            "id": "ul-rot",
            "rotationDeg": 45.0,
        }
    )
    apply_inplace(doc, rot_cmd)

    elem = doc.elements["ul-rot"]
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.rotation_deg == pytest.approx(45.0)


def test_delete_underlay_removes_element() -> None:
    """Delete underlay → removed from state."""
    from pydantic import TypeAdapter

    from bim_ai.commands import DeleteImageUnderlayCmd, ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    apply_inplace(
        doc,
        TypeAdapter(ImportImageUnderlayCmd).validate_python(
            {
                "type": "import_image_underlay",
                "id": "ul-del",
                "src": _PNG_DATA_URI,
                "rectMm": _RECT_MM,
            }
        ),
    )
    assert "ul-del" in doc.elements

    del_cmd = TypeAdapter(DeleteImageUnderlayCmd).validate_python(
        {"type": "delete_image_underlay", "id": "ul-del"}
    )
    apply_inplace(doc, del_cmd)
    assert "ul-del" not in doc.elements


def test_default_opacity_is_0_4() -> None:
    """Default opacity = 0.4."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "ul-def-opacity",
            "src": _PNG_DATA_URI,
            "rectMm": _RECT_MM,
            # no opacity field → default
        }
    )
    apply_inplace(doc, cmd)

    elem = doc.elements["ul-def-opacity"]
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.opacity == pytest.approx(0.4)


def test_default_rotation_is_0() -> None:
    """Default rotation = 0.0."""
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "ul-def-rot",
            "src": _PNG_DATA_URI,
            "rectMm": _RECT_MM,
        }
    )
    apply_inplace(doc, cmd)

    elem = doc.elements["ul-def-rot"]
    assert isinstance(elem, ImageUnderlayElem)
    assert elem.rotation_deg == pytest.approx(0.0)


def test_image_underlay_ts_round_trip_field_shape() -> None:
    """TypeScript round-trip for ImageUnderlayElem — verify serialised alias fields.

    The element must serialise with camelCase alias keys matching the
    TypeScript type so the frontend can consume the snapshot payload.
    """
    from pydantic import TypeAdapter

    from bim_ai.commands import ImportImageUnderlayCmd

    doc = _make_fresh_doc()
    cmd = TypeAdapter(ImportImageUnderlayCmd).validate_python(
        {
            "type": "import_image_underlay",
            "id": "ul-ts",
            "src": _PNG_DATA_URI,
            "rectMm": _RECT_MM,
            "rotationDeg": 30.0,
            "opacity": 0.6,
            "lockedScale": True,
        }
    )
    apply_inplace(doc, cmd)

    elem = doc.elements["ul-ts"]
    assert isinstance(elem, ImageUnderlayElem)
    dumped = elem.model_dump(by_alias=True)

    # Verify camelCase aliases are used in serialisation
    assert dumped["kind"] == "image_underlay"
    assert "rectMm" in dumped
    assert "rotationDeg" in dumped
    assert "lockedScale" in dumped
    assert dumped["rotationDeg"] == pytest.approx(30.0)
    assert dumped["opacity"] == pytest.approx(0.6)
    assert dumped["lockedScale"] is True


# ---------------------------------------------------------------------------
# Registry test
# ---------------------------------------------------------------------------


def test_import_image_underlay_tool_in_registry(client: TestClient) -> None:
    """Tool descriptor for import-image-underlay present in /api/v3/tools."""
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    tools = {t["name"] for t in resp.json()["tools"]}
    assert "import-image-underlay" in tools
