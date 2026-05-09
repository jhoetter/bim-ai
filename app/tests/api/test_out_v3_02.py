"""OUT-V3-02 — Presentation canvas, Frames, SavedViews, and PPTX bundle export.

Tests cover:
- Create presentation canvas → in state
- Create frame on canvas → frame in state with correct viewId
- Reorder frames → sort_orders updated sequentially
- Delete frame → removed
- Create saved view → in state
- Update saved view thumbnail → thumbnailDataUri updated
- Export canvas as pptx-bundle → bundle JSON with slides in sort order
- Export canvas with 0 frames → empty slides array
- TypeScript round-trips for FrameElem, SavedViewElem, PresentationCanvasElem (wire-format)
- Frames on different canvases don't interfere
- Update presentation canvas name → reflected
- Delete saved view → removed from state
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import FrameElem, PresentationCanvasElem, SavedViewElem
from bim_ai.engine import ensure_internal_origin
from bim_ai.exp.pptx_export import PptxBundle, Slide, build_pptx_bundle

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "out_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}


# ---------------------------------------------------------------------------
# Stub app
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    _models: dict[str, dict[str, Any]] = {}

    def _seed(model_id: str) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        bundle_raw = body.get("bundle")
        if bundle_raw is None:
            raise HTTPException(status_code=422, detail="bundle required")
        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        stored = _models[model_id]
        doc = stored["doc"]
        bundle.parent_revision = doc.revision
        result, new_doc = _apply_bundle(doc, bundle, "commit")
        if result.applied and new_doc is not None:
            _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}
        return {
            "accepted": result.applied,
            "revision": new_doc.revision if result.applied and new_doc is not None else doc.revision,
        }

    @app.get("/api/models/{model_id}/elements")
    async def get_elements(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        doc = _models[model_id]["doc"]
        return {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}

    @app.get("/api/v3/models/{model_id}/presentation-canvases/{canvas_id}/export")
    async def export_canvas(model_id: str, canvas_id: str, format: str = "pptx-bundle") -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        doc = _models[model_id]["doc"]
        canvas_elem = doc.elements.get(canvas_id)
        if canvas_elem is None or not isinstance(canvas_elem, PresentationCanvasElem):
            raise HTTPException(status_code=404, detail="canvas not found")
        if format != "pptx-bundle":
            raise HTTPException(status_code=400, detail="unsupported format")
        frames = [
            elem.model_dump(by_alias=True)
            for elem in doc.elements.values()
            if isinstance(elem, FrameElem) and elem.presentation_canvas_id == canvas_id
        ]
        canvas_dict = canvas_elem.model_dump(by_alias=True)
        bundle = build_pptx_bundle(canvas_dict, frames)
        return bundle.to_dict()

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _post_bundle(client: TestClient, *cmds: dict) -> dict:
    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json={
            "bundle": {
                "schemaVersion": "cmd-v3.0",
                "commands": list(cmds),
                "assumptions": [_VALID_ASSUMPTION],
                "parentRevision": 0,
            }
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _elements(client: TestClient) -> dict:
    resp = client.get(f"/api/models/{MODEL_ID}/elements")
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPresentationCanvas:
    def test_create_canvas_in_state(self, client: TestClient) -> None:
        result = _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-01", "name": "Design Review"},
        )
        assert result["accepted"] is True
        els = _elements(client)
        assert "canvas-01" in els
        canvas = els["canvas-01"]
        assert canvas["kind"] == "presentation_canvas"
        assert canvas["name"] == "Design Review"
        assert canvas["frameIds"] == []

    def test_update_canvas_name(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-upd", "name": "Old Name"},
        )
        _post_bundle(
            client,
            {"type": "update_presentation_canvas", "id": "canvas-upd", "name": "New Name"},
        )
        els = _elements(client)
        assert els["canvas-upd"]["name"] == "New Name"


class TestFrame:
    def test_create_frame_on_canvas(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-f1", "name": "Deck"},
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-f1",
                "presentationCanvasId": "canvas-f1",
                "viewId": "plan-gf",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "caption": "Ground Floor",
                "sortOrder": 0,
            },
        )
        els = _elements(client)
        assert "frame-f1" in els
        frame = els["frame-f1"]
        assert frame["kind"] == "frame"
        assert frame["viewId"] == "plan-gf"
        assert frame["caption"] == "Ground Floor"
        # Canvas frameIds should include the new frame
        assert "frame-f1" in els["canvas-f1"]["frameIds"]

    def test_reorder_frames_sequential(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-ro", "name": "Reorder"},
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-ro-a",
                "presentationCanvasId": "canvas-ro",
                "viewId": "view-a",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 0,
            },
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-ro-b",
                "presentationCanvasId": "canvas-ro",
                "viewId": "view-b",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 1,
            },
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-ro-c",
                "presentationCanvasId": "canvas-ro",
                "viewId": "view-c",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 2,
            },
        )
        # Move c (sort_order=2) to position 0 → should re-normalise to 0,1,2
        _post_bundle(
            client,
            {"type": "reorder_frame", "id": "frame-ro-c", "newSortOrder": 0},
        )
        els = _elements(client)
        sort_orders = sorted(
            [
                (eid, e["sortOrder"])
                for eid, e in els.items()
                if e.get("kind") == "frame" and e.get("presentationCanvasId") == "canvas-ro"
            ],
            key=lambda x: x[1],
        )
        # All three frames should have consecutive sort orders 0,1,2
        order_values = [so for _, so in sort_orders]
        assert order_values == list(range(len(order_values)))

    def test_delete_frame_removed(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-del", "name": "Del"},
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-del",
                "presentationCanvasId": "canvas-del",
                "viewId": "view-x",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 0,
            },
        )
        els_before = _elements(client)
        assert "frame-del" in els_before
        _post_bundle(client, {"type": "delete_frame", "id": "frame-del"})
        els_after = _elements(client)
        assert "frame-del" not in els_after
        assert "frame-del" not in els_after.get("canvas-del", {}).get("frameIds", [])

    def test_frames_on_different_canvases_dont_interfere(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-iso-a", "name": "A"},
        )
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-iso-b", "name": "B"},
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-iso-a1",
                "presentationCanvasId": "canvas-iso-a",
                "viewId": "view-a1",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 0,
            },
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-iso-b1",
                "presentationCanvasId": "canvas-iso-b",
                "viewId": "view-b1",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 0,
            },
        )
        els = _elements(client)
        assert els["canvas-iso-a"]["frameIds"] == ["frame-iso-a1"]
        assert els["canvas-iso-b"]["frameIds"] == ["frame-iso-b1"]


class TestSavedView:
    def test_create_saved_view_in_state(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {
                "type": "create_saved_view",
                "id": "sv-01",
                "baseViewId": "plan-gf",
                "name": "Ground Floor overview",
                "cameraState": {"zoom": 1.0, "centerMm": {"xMm": 0, "yMm": 0}},
                "detailLevel": "fine",
            },
        )
        els = _elements(client)
        assert "sv-01" in els
        sv = els["sv-01"]
        assert sv["kind"] == "saved_view"
        assert sv["baseViewId"] == "plan-gf"
        assert sv["name"] == "Ground Floor overview"
        assert sv["detailLevel"] == "fine"

    def test_update_saved_view_thumbnail(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {
                "type": "create_saved_view",
                "id": "sv-thumb",
                "baseViewId": "plan-1f",
                "name": "First Floor",
            },
        )
        _post_bundle(
            client,
            {
                "type": "update_saved_view",
                "id": "sv-thumb",
                "thumbnailDataUri": "data:image/png;base64,abc123",
            },
        )
        els = _elements(client)
        assert els["sv-thumb"]["thumbnailDataUri"] == "data:image/png;base64,abc123"

    def test_delete_saved_view(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {
                "type": "create_saved_view",
                "id": "sv-del",
                "baseViewId": "plan-gf",
                "name": "To Delete",
            },
        )
        els_before = _elements(client)
        assert "sv-del" in els_before
        _post_bundle(client, {"type": "delete_saved_view", "id": "sv-del"})
        els_after = _elements(client)
        assert "sv-del" not in els_after


class TestPptxExport:
    def test_export_canvas_bundle_slides_in_sort_order(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-exp", "name": "Export Deck"},
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-exp-2",
                "presentationCanvasId": "canvas-exp",
                "viewId": "view-second",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "caption": "Second slide",
                "sortOrder": 1,
            },
        )
        _post_bundle(
            client,
            {
                "type": "create_frame",
                "id": "frame-exp-1",
                "presentationCanvasId": "canvas-exp",
                "viewId": "view-first",
                "positionMm": {"xMm": 10, "yMm": 10},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "caption": "First slide",
                "sortOrder": 0,
            },
        )
        resp = client.get(
            f"/api/v3/models/{MODEL_ID}/presentation-canvases/canvas-exp/export?format=pptx-bundle"
        )
        assert resp.status_code == 200
        bundle = resp.json()
        assert bundle["schemaVersion"] == "out-v3.0"
        assert bundle["title"] == "Export Deck"
        slides = bundle["slides"]
        assert len(slides) == 2
        # Slides must be ordered by sortOrder
        assert slides[0]["sortOrder"] == 0
        assert slides[0]["viewId"] == "view-first"
        assert slides[1]["sortOrder"] == 1
        assert slides[1]["viewId"] == "view-second"

    def test_export_canvas_zero_frames_empty_slides(self, client: TestClient) -> None:
        _post_bundle(
            client,
            {"type": "create_presentation_canvas", "id": "canvas-empty", "name": "Empty"},
        )
        resp = client.get(
            f"/api/v3/models/{MODEL_ID}/presentation-canvases/canvas-empty/export?format=pptx-bundle"
        )
        assert resp.status_code == 200
        bundle = resp.json()
        assert bundle["slides"] == []

    def test_export_canvas_not_found_returns_404(self, client: TestClient) -> None:
        resp = client.get(
            f"/api/v3/models/{MODEL_ID}/presentation-canvases/nonexistent/export?format=pptx-bundle"
        )
        assert resp.status_code == 404


class TestPptxBundleUnit:
    """Unit tests for the build_pptx_bundle function."""

    def test_build_bundle_sorts_by_sort_order(self) -> None:
        canvas = {"id": "c1", "name": "Test", "frameIds": ["f2", "f1"]}
        frames = [
            {
                "id": "f2",
                "kind": "frame",
                "presentationCanvasId": "c1",
                "viewId": "view-b",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "caption": None,
                "sortOrder": 1,
            },
            {
                "id": "f1",
                "kind": "frame",
                "presentationCanvasId": "c1",
                "viewId": "view-a",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "caption": "First",
                "sortOrder": 0,
            },
        ]
        bundle = build_pptx_bundle(canvas, frames)
        assert isinstance(bundle, PptxBundle)
        d = bundle.to_dict()
        assert d["schemaVersion"] == "out-v3.0"
        assert d["title"] == "Test"
        assert len(d["slides"]) == 2
        assert d["slides"][0]["viewId"] == "view-a"
        assert d["slides"][1]["viewId"] == "view-b"

    def test_build_bundle_excludes_other_canvas_frames(self) -> None:
        canvas = {"id": "c1", "name": "Canvas 1", "frameIds": ["f1"]}
        frames = [
            {
                "id": "f1",
                "presentationCanvasId": "c1",
                "viewId": "view-a",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 0,
            },
            {
                "id": "f2",
                "presentationCanvasId": "c2",  # different canvas
                "viewId": "view-b",
                "positionMm": {"xMm": 0, "yMm": 0},
                "sizeMm": {"widthMm": 210, "heightMm": 148},
                "sortOrder": 0,
            },
        ]
        bundle = build_pptx_bundle(canvas, frames)
        d = bundle.to_dict()
        assert len(d["slides"]) == 1
        assert d["slides"][0]["viewId"] == "view-a"


class TestTypeScriptWireFormat:
    """Verify FrameElem, SavedViewElem, PresentationCanvasElem round-trip correctly
    through Pydantic model_dump(by_alias=True) — mirrors TS wire-format expectations."""

    def test_frame_elem_wire_format(self) -> None:
        frame = FrameElem(
            id="f-ts",
            presentationCanvasId="c-ts",
            viewId="view-ts",
            positionMm={"xMm": 10.0, "yMm": 20.0},
            sizeMm={"widthMm": 210.0, "heightMm": 148.0},
            caption="Test",
            sortOrder=0,
        )
        wire = frame.model_dump(by_alias=True)
        assert wire["kind"] == "frame"
        assert wire["presentationCanvasId"] == "c-ts"
        assert wire["viewId"] == "view-ts"
        assert wire["positionMm"] == {"xMm": 10.0, "yMm": 20.0}
        assert wire["sizeMm"] == {"widthMm": 210.0, "heightMm": 148.0}
        assert wire["sortOrder"] == 0

    def test_saved_view_elem_wire_format(self) -> None:
        sv = SavedViewElem(
            id="sv-ts",
            baseViewId="plan-gf",
            name="Overview",
            cameraState={"zoom": 1.5},
            detailLevel="fine",
        )
        wire = sv.model_dump(by_alias=True)
        assert wire["kind"] == "saved_view"
        assert wire["baseViewId"] == "plan-gf"
        assert wire["name"] == "Overview"
        assert wire["cameraState"] == {"zoom": 1.5}
        assert wire["detailLevel"] == "fine"
        assert wire["thumbnailDataUri"] is None

    def test_presentation_canvas_elem_wire_format(self) -> None:
        canvas = PresentationCanvasElem(
            id="c-ts",
            name="My Deck",
        )
        wire = canvas.model_dump(by_alias=True)
        assert wire["kind"] == "presentation_canvas"
        assert wire["name"] == "My Deck"
        assert wire["frameIds"] == []
