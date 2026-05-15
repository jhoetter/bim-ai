"""TOP-V3-04 — Site Walls + Graded Regions tests.

Covers:
1.  Create site wall with siteHostId → binding recorded in state
2.  Create site wall with nonexistent siteHostId → 400
3.  Create graded region flat mode → state correct
4.  Create graded region slope mode → state correct
5.  flat mode missing targetZMm → 400 validation error
6.  slope mode missing slopeAxisDeg → 400 validation error
7.  Update graded region → reflected in state
8.  Delete graded region → removed from state
9.  Site wall without siteHostId → normal wall (no regression)
10. TypeScript round-trip for GradedRegionElem kind field (isinstance check)
11. List model includes graded regions
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.api.registry import get_catalog
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import GradedRegionElem, ToposolidExcavationElem, WallElem
from bim_ai.engine import apply_inplace, ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "top_v3_04_test",
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

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}

_CREATE_TOPOSOLID = {
    "type": "CreateToposolid",
    "toposolidId": "topo-1",
    "name": "Site terrain",
    "boundaryMm": [
        {"xMm": 0, "yMm": 0},
        {"xMm": 20000, "yMm": 0},
        {"xMm": 20000, "yMm": 20000},
        {"xMm": 0, "yMm": 20000},
    ],
    "thicknessMm": 1500,
    "baseElevationMm": 0,
}

_BOUNDARY_MM = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 5000, "yMm": 0},
    {"xMm": 5000, "yMm": 5000},
    {"xMm": 0, "yMm": 5000},
]


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


def _make_doc_with_level_and_topo() -> Document:
    """Utility: create a document that has a level + toposolid pre-seeded."""
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateToposolidCmd

    apply_inplace(
        doc,
        TypeAdapter(
            dict  # type: ignore[type-arg]
        ).validate_python(_CREATE_LEVEL),  # type: ignore[arg-type]
    )
    from bim_ai.commands import CreateLevelCmd

    apply_inplace(doc, TypeAdapter(CreateLevelCmd).validate_python(_CREATE_LEVEL))
    apply_inplace(doc, TypeAdapter(CreateToposolidCmd).validate_python(_CREATE_TOPOSOLID))
    return doc


# ---------------------------------------------------------------------------
# Unit-level engine tests (no HTTP layer)
# ---------------------------------------------------------------------------


def _fresh_doc() -> Document:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateLevelCmd, CreateToposolidCmd

    apply_inplace(doc, TypeAdapter(CreateLevelCmd).validate_python(_CREATE_LEVEL))
    apply_inplace(doc, TypeAdapter(CreateToposolidCmd).validate_python(_CREATE_TOPOSOLID))
    return doc


# ---------------------------------------------------------------------------
# Test 1: Create site wall with siteHostId → binding recorded in state
# ---------------------------------------------------------------------------


def test_create_site_wall_with_site_host_id() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateWallCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateWallCmd).validate_python(
        {
            "type": "createWall",
            "id": "wall-site-1",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 5000, "yMm": 0},
            "siteHostId": "topo-1",
        }
    )
    apply_inplace(doc, cmd)
    wall = doc.elements.get("wall-site-1")
    assert isinstance(wall, WallElem)
    assert wall.site_host_id == "topo-1"


# ---------------------------------------------------------------------------
# Test 2: Create site wall with nonexistent siteHostId → raises
# ---------------------------------------------------------------------------


def test_create_site_wall_nonexistent_site_host_id() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateWallCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateWallCmd).validate_python(
        {
            "type": "createWall",
            "id": "wall-site-bad",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 5000, "yMm": 0},
            "siteHostId": "topo-nonexistent",
        }
    )
    with pytest.raises(ValueError, match="topo-nonexistent"):
        apply_inplace(doc, cmd)


# ---------------------------------------------------------------------------
# Test 3: Create graded region flat mode → state correct
# ---------------------------------------------------------------------------


def test_create_graded_region_flat_mode() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateGradedRegionCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateGradedRegionCmd).validate_python(
        {
            "type": "CreateGradedRegion",
            "id": "gr-1",
            "hostToposolidId": "topo-1",
            "boundaryMm": _BOUNDARY_MM,
            "targetMode": "flat",
            "targetZMm": -500.0,
        }
    )
    apply_inplace(doc, cmd)
    region = doc.elements.get("gr-1")
    assert isinstance(region, GradedRegionElem)
    assert region.host_toposolid_id == "topo-1"
    assert region.target_mode == "flat"
    assert region.target_z_mm == -500.0
    assert region.slope_axis_deg is None


# ---------------------------------------------------------------------------
# Test 4: Create graded region slope mode → state correct
# ---------------------------------------------------------------------------


def test_create_graded_region_slope_mode() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateGradedRegionCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateGradedRegionCmd).validate_python(
        {
            "type": "CreateGradedRegion",
            "id": "gr-slope-1",
            "hostToposolidId": "topo-1",
            "boundaryMm": _BOUNDARY_MM,
            "targetMode": "slope",
            "slopeAxisDeg": 45.0,
            "slopeDegPercent": 5.0,
        }
    )
    apply_inplace(doc, cmd)
    region = doc.elements.get("gr-slope-1")
    assert isinstance(region, GradedRegionElem)
    assert region.target_mode == "slope"
    assert region.slope_axis_deg == 45.0
    assert region.slope_deg_percent == 5.0
    assert region.target_z_mm is None


def test_create_toposolid_excavation_relation_suppresses_pierce_warning() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateFloorCmd, CreateToposolidExcavationCmd
    from bim_ai.constraints import evaluate

    doc = _fresh_doc()
    apply_inplace(
        doc,
        TypeAdapter(CreateFloorCmd).validate_python(
            {
                "type": "createFloor",
                "id": "basement-cutter",
                "levelId": "lvl-1",
                "boundaryMm": [
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 5000, "yMm": 1000},
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": 1000, "yMm": 5000},
                ],
                "thicknessMm": 250,
            }
        ),
    )
    apply_inplace(
        doc,
        TypeAdapter(CreateToposolidExcavationCmd).validate_python(
            {
                "type": "CreateToposolidExcavation",
                "id": "exc-1",
                "hostToposolidId": "topo-1",
                "cutterElementId": "basement-cutter",
                "cutMode": "to_bottom_of_cutter",
                "offsetMm": 100,
            }
        ),
    )

    excavation = doc.elements.get("exc-1")
    assert isinstance(excavation, ToposolidExcavationElem)
    assert excavation.host_toposolid_id == "topo-1"
    assert excavation.cutter_element_id == "basement-cutter"
    assert excavation.estimated_volume_m3 == 5.6
    assert [v for v in evaluate(doc.elements) if v.rule_id == "toposolid_pierce_check"] == []


def test_create_toposolid_excavation_rejects_non_overlapping_cutter() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateFloorCmd, CreateToposolidExcavationCmd

    doc = _fresh_doc()
    apply_inplace(
        doc,
        TypeAdapter(CreateFloorCmd).validate_python(
            {
                "type": "createFloor",
                "id": "remote-floor",
                "levelId": "lvl-1",
                "boundaryMm": [
                    {"xMm": 30000, "yMm": 30000},
                    {"xMm": 32000, "yMm": 30000},
                    {"xMm": 32000, "yMm": 32000},
                    {"xMm": 30000, "yMm": 32000},
                ],
            }
        ),
    )
    cmd = TypeAdapter(CreateToposolidExcavationCmd).validate_python(
        {
            "type": "CreateToposolidExcavation",
            "id": "exc-bad",
            "hostToposolidId": "topo-1",
            "cutterElementId": "remote-floor",
        }
    )
    with pytest.raises(ValueError, match="must overlap"):
        apply_inplace(doc, cmd)


# ---------------------------------------------------------------------------
# Test 5: flat mode missing targetZMm → raises
# ---------------------------------------------------------------------------


def test_create_graded_region_flat_missing_target_z() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateGradedRegionCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateGradedRegionCmd).validate_python(
        {
            "type": "CreateGradedRegion",
            "id": "gr-bad",
            "hostToposolidId": "topo-1",
            "boundaryMm": _BOUNDARY_MM,
            "targetMode": "flat",
            # no targetZMm
        }
    )
    with pytest.raises(ValueError, match="targetZMm is required for flat mode"):
        apply_inplace(doc, cmd)


# ---------------------------------------------------------------------------
# Test 6: slope mode missing slopeAxisDeg → raises
# ---------------------------------------------------------------------------


def test_create_graded_region_slope_missing_axis() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateGradedRegionCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateGradedRegionCmd).validate_python(
        {
            "type": "CreateGradedRegion",
            "id": "gr-bad-slope",
            "hostToposolidId": "topo-1",
            "boundaryMm": _BOUNDARY_MM,
            "targetMode": "slope",
            # missing slopeAxisDeg and slopeDegPercent
        }
    )
    with pytest.raises(ValueError, match="slopeAxisDeg and slopeDegPercent are required"):
        apply_inplace(doc, cmd)


# ---------------------------------------------------------------------------
# Test 7: Update graded region → reflected
# ---------------------------------------------------------------------------


def test_update_graded_region() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateGradedRegionCmd, UpdateGradedRegionCmd

    doc = _fresh_doc()
    create_cmd = TypeAdapter(CreateGradedRegionCmd).validate_python(
        {
            "type": "CreateGradedRegion",
            "id": "gr-update",
            "hostToposolidId": "topo-1",
            "boundaryMm": _BOUNDARY_MM,
            "targetMode": "flat",
            "targetZMm": 0.0,
        }
    )
    apply_inplace(doc, create_cmd)

    update_cmd = TypeAdapter(UpdateGradedRegionCmd).validate_python(
        {
            "type": "UpdateGradedRegion",
            "id": "gr-update",
            "targetZMm": 1000.0,
        }
    )
    apply_inplace(doc, update_cmd)
    region = doc.elements.get("gr-update")
    assert isinstance(region, GradedRegionElem)
    assert region.target_z_mm == 1000.0


# ---------------------------------------------------------------------------
# Test 8: Delete graded region → removed
# ---------------------------------------------------------------------------


def test_delete_graded_region() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateGradedRegionCmd, DeleteGradedRegionCmd

    doc = _fresh_doc()
    create_cmd = TypeAdapter(CreateGradedRegionCmd).validate_python(
        {
            "type": "CreateGradedRegion",
            "id": "gr-delete",
            "hostToposolidId": "topo-1",
            "boundaryMm": _BOUNDARY_MM,
            "targetMode": "flat",
            "targetZMm": 0.0,
        }
    )
    apply_inplace(doc, create_cmd)
    assert "gr-delete" in doc.elements

    delete_cmd = TypeAdapter(DeleteGradedRegionCmd).validate_python(
        {"type": "DeleteGradedRegion", "id": "gr-delete"}
    )
    apply_inplace(doc, delete_cmd)
    assert "gr-delete" not in doc.elements


# ---------------------------------------------------------------------------
# Test 9: Site wall without siteHostId → normal wall (no regression)
# ---------------------------------------------------------------------------


def test_create_wall_without_site_host_id_is_normal() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import CreateWallCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(CreateWallCmd).validate_python(
        {
            "type": "createWall",
            "id": "wall-normal",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 5000, "yMm": 0},
        }
    )
    apply_inplace(doc, cmd)
    wall = doc.elements.get("wall-normal")
    assert isinstance(wall, WallElem)
    assert wall.site_host_id is None


# ---------------------------------------------------------------------------
# Test 10: GradedRegionElem round-trip via model_dump / model_validate
# ---------------------------------------------------------------------------


def test_graded_region_round_trip_serialization() -> None:
    """GradedRegionElem must survive a dump/validate round-trip with correct kind."""
    region = GradedRegionElem(
        kind="graded_region",
        id="gr-rt",
        hostToposolidId="topo-1",
        boundaryMm=_BOUNDARY_MM,
        targetMode="flat",
        targetZMm=200.0,
    )
    dumped = region.model_dump(by_alias=True)
    assert dumped["kind"] == "graded_region"
    assert dumped["hostToposolidId"] == "topo-1"
    assert dumped["targetMode"] == "flat"
    assert dumped["targetZMm"] == 200.0

    restored = GradedRegionElem.model_validate(dumped)
    assert restored.id == "gr-rt"
    assert restored.target_z_mm == 200.0


# ---------------------------------------------------------------------------
# Test 11: List model snapshot includes graded regions
# ---------------------------------------------------------------------------


def test_snapshot_includes_graded_regions(client: TestClient) -> None:
    # Seed level + toposolid
    r1 = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_TOPOSOLID]),
    )
    assert r1.status_code == 200, r1.text
    rev = r1.json().get("newRevision", 1)

    # Create graded region
    r2 = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "CreateGradedRegion",
                    "id": "gr-snap",
                    "hostToposolidId": "topo-1",
                    "boundaryMm": _BOUNDARY_MM,
                    "targetMode": "flat",
                    "targetZMm": 0.0,
                }
            ],
            revision=rev,
        ),
    )
    assert r2.status_code == 200, r2.text

    snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
    assert snap.status_code == 200
    elements = snap.json()["elements"]
    assert "gr-snap" in elements
    assert elements["gr-snap"]["kind"] == "graded_region"


# ---------------------------------------------------------------------------
# Test: create-graded-region tool descriptor present in catalog
# ---------------------------------------------------------------------------


def test_create_graded_region_tool_in_catalog(client: TestClient) -> None:
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    tool_names = [t["name"] for t in resp.json()["tools"]]
    assert "create-graded-region" in tool_names


# ---------------------------------------------------------------------------
# Test: Delete nonexistent graded region → raises
# ---------------------------------------------------------------------------


def test_delete_nonexistent_graded_region() -> None:
    from pydantic import TypeAdapter

    from bim_ai.commands import DeleteGradedRegionCmd

    doc = _fresh_doc()
    cmd = TypeAdapter(DeleteGradedRegionCmd).validate_python(
        {"type": "DeleteGradedRegion", "id": "does-not-exist"}
    )
    with pytest.raises(ValueError, match="does-not-exist"):
        apply_inplace(doc, cmd)
