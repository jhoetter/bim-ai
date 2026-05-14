"""DSC-V3-02 — tests for view discipline lens (defaultLens + SetViewLensCmd).

Covers:
- SetViewLensCmd updates defaultLens on the target view (PlanViewElem + ViewElem).
- SetViewLensCmd raises ValueError for unknown viewId.
- element_passes_lens helper: show_all passes everything; show_struct passes only struct.
- Fire-safety lens foregrounds relevant overlay host elements without mutating discipline.
- Snapshot serialisation: views default defaultLens to 'show_all' when field absent.
- set-view-lens tool descriptor present in /api/v3/tools.
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
from bim_ai.elements import PlanViewElem, ViewElem
from bim_ai.engine import element_passes_lens, ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "dsc_v3_02_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}
_CREATE_PLAN_VIEW = {
    "type": "upsertPlanView",
    "id": "pv-1",
    "name": "Ground Floor Plan",
    "levelId": "lvl-1",
}

_BLOCKING_ADVISORY_CLASSES = {
    "revision_conflict",
    "assumption_log_required",
    "assumption_log_malformed",
    "assumption_log_duplicate_key",
    "direct_main_commit_forbidden",
    "option_routing_not_yet_implemented",
}


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
            blocking = {v.get("advisoryClass") for v in result.violations}
            if blocking & _BLOCKING_ADVISORY_CLASSES:
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
        from bim_ai.api.registry import get_catalog

        catalog = get_catalog()
        return {"tools": [{"name": t.name} for t in catalog.tools]}

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


# ---------------------------------------------------------------------------
# Unit tests: element_passes_lens helper
# ---------------------------------------------------------------------------


class TestElementPassesLens:
    def test_show_all_passes_everything(self) -> None:
        assert element_passes_lens("arch", "show_all") is True
        assert element_passes_lens("struct", "show_all") is True
        assert element_passes_lens("mep", "show_all") is True
        assert element_passes_lens(None, "show_all") is True

    def test_show_struct_passes_struct_only(self) -> None:
        assert element_passes_lens("struct", "show_struct") is True
        assert element_passes_lens("arch", "show_struct") is False
        assert element_passes_lens("mep", "show_struct") is False

    def test_show_arch_passes_arch_only(self) -> None:
        assert element_passes_lens("arch", "show_arch") is True
        assert element_passes_lens("struct", "show_arch") is False
        assert element_passes_lens("mep", "show_arch") is False

    def test_show_mep_passes_mep_only(self) -> None:
        assert element_passes_lens("mep", "show_mep") is True
        assert element_passes_lens("arch", "show_mep") is False
        assert element_passes_lens("struct", "show_mep") is False

    def test_none_discipline_treated_as_arch(self) -> None:
        assert element_passes_lens(None, "show_arch") is True
        assert element_passes_lens(None, "show_struct") is False
        assert element_passes_lens(None, "show_mep") is False

    def test_show_fire_safety_passes_overlay_hosts_and_marked_props(self) -> None:
        assert element_passes_lens("arch", "show_fire_safety", elem_kind="wall") is True
        assert element_passes_lens("mep", "show_fire_safety", elem_kind="duct") is True
        assert (
            element_passes_lens(
                "struct",
                "show_fire_safety",
                elem_kind="generic_model",
                props={"fireCompartmentId": "A"},
            )
            is True
        )
        assert element_passes_lens("struct", "show_fire_safety", elem_kind="column") is False


# ---------------------------------------------------------------------------
# Unit tests: defaultLens field defaults on view elements
# ---------------------------------------------------------------------------


class TestDefaultLensDefault:
    def test_plan_view_elem_defaults_to_show_all(self) -> None:
        pv = PlanViewElem(id="pv-x", levelId="lvl-x")
        assert pv.default_lens == "show_all"

    def test_view_elem_defaults_to_show_all(self) -> None:
        v = ViewElem(id="v-x")
        assert v.default_lens == "show_all"

    def test_plan_view_elem_serialises_default_lens(self) -> None:
        pv = PlanViewElem(id="pv-x", levelId="lvl-x")
        data = pv.model_dump(by_alias=True)
        assert data["defaultLens"] == "show_all"

    def test_plan_view_elem_deserialises_default_lens(self) -> None:
        pv = PlanViewElem.model_validate({"id": "pv-x", "levelId": "lvl-x"})
        assert pv.default_lens == "show_all"

    def test_plan_view_elem_round_trip_with_set_lens(self) -> None:
        pv = PlanViewElem.model_validate(
            {"id": "pv-x", "levelId": "lvl-x", "defaultLens": "show_struct"}
        )
        assert pv.default_lens == "show_struct"
        data = pv.model_dump(by_alias=True)
        assert data["defaultLens"] == "show_struct"

    def test_plan_view_elem_round_trip_with_fire_safety_lens(self) -> None:
        pv = PlanViewElem.model_validate(
            {"id": "pv-x", "levelId": "lvl-x", "defaultLens": "show_fire_safety"}
        )
        assert pv.default_lens == "show_fire_safety"


# ---------------------------------------------------------------------------
# Integration: SetViewLensCmd via engine
# ---------------------------------------------------------------------------


class TestSetViewLensViaEngine:
    def test_set_view_lens_updates_default_lens(self, client: TestClient) -> None:
        # Create level + plan view
        r1 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle([_CREATE_LEVEL, _CREATE_PLAN_VIEW], revision=1),
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["applied"] is True
        rev2 = r1.json()["newRevision"]

        # Set lens to show_struct
        r2 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "set_view_lens", "viewId": "pv-1", "lens": "show_struct"}],
                revision=rev2,
            ),
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["applied"] is True

        # Verify snapshot
        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        assert snap.status_code == 200
        pv = snap.json()["elements"]["pv-1"]
        assert pv["defaultLens"] == "show_struct"

    def test_set_view_lens_raises_for_unknown_view(self) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        bundle = CommandBundle.model_validate(
            {
                "schemaVersion": "cmd-v3.0",
                "commands": [
                    {"type": "set_view_lens", "viewId": "nonexistent", "lens": "show_all"}
                ],
                "assumptions": [_VALID_ASSUMPTION],
                "parentRevision": 1,
            }
        )
        result, _ = _apply_bundle(doc, bundle, "commit")
        assert result.applied is False

    def test_set_view_lens_can_reset_to_show_all(self, client: TestClient) -> None:
        snap_before = client.get(f"/api/models/{MODEL_ID}/snapshot")
        rev = snap_before.json()["revision"]

        # Ensure plan view exists (may already from previous test in same session)
        if "pv-1" not in snap_before.json()["elements"]:
            r = client.post(
                f"/api/models/{MODEL_ID}/bundles",
                json=_bundle([_CREATE_LEVEL, _CREATE_PLAN_VIEW], revision=rev),
            )
            assert r.json()["applied"] is True
            rev = r.json()["newRevision"]

        r = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "set_view_lens", "viewId": "pv-1", "lens": "show_all"}],
                revision=rev,
            ),
        )
        assert r.status_code == 200
        assert r.json()["applied"] is True
        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        assert snap.json()["elements"]["pv-1"]["defaultLens"] == "show_all"


# ---------------------------------------------------------------------------
# Tool descriptor present in /api/v3/tools
# ---------------------------------------------------------------------------


class TestToolDescriptor:
    def test_set_view_lens_tool_registered(self, client: TestClient) -> None:
        resp = client.get("/api/v3/tools")
        assert resp.status_code == 200
        names = {t["name"] for t in resp.json()["tools"]}
        assert "set-view-lens" in names
