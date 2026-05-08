"""DSC-V3-01 — agent-callable API tests for set-element-discipline.

Covers:
- test_set_discipline_via_api: POST SetElementDisciplineCmd bundle, assert element's
  discipline is updated.
- test_reset_to_default: POST with discipline=null, assert element returns to
  DEFAULT_DISCIPLINE_BY_KIND value.
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
from bim_ai.elements import DEFAULT_DISCIPLINE_BY_KIND
from bim_ai.engine import ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "discipline_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}
_CREATE_WALL = {
    "type": "createWall",
    "id": "wall-1",
    "levelId": "lvl-1",
    "start": {"xMm": 0, "yMm": 0},
    "end": {"xMm": 5000, "yMm": 0},
}
_CREATE_COLUMN = {
    "type": "createColumn",
    "id": "col-1",
    "levelId": "lvl-1",
    "positionMm": {"xMm": 1000, "yMm": 1000},
    "heightMm": 3000,
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
        elements_out = {
            eid: el.model_dump(by_alias=True) for eid, el in doc.elements.items()
        }
        return {"modelId": model_id, "revision": doc.revision, "elements": elements_out}

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


class TestSetDisciplineViaApi:
    """POST SetElementDisciplineCmd bundle — assert element's discipline updated."""

    def test_set_wall_discipline_to_struct(self, client: TestClient) -> None:
        """Commit a wall, then retag it to struct via the API."""
        # Commit level + wall (revision 1 -> 2)
        r1 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle([_CREATE_LEVEL, _CREATE_WALL], revision=1),
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["applied"] is True
        rev2 = r1.json()["newRevision"]

        # Retag wall to struct (revision 2 -> 3)
        r2 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["wall-1"], "discipline": "struct"}],
                revision=rev2,
            ),
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["applied"] is True

        # Verify via snapshot
        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        assert snap.status_code == 200
        wall = snap.json()["elements"]["wall-1"]
        assert wall["discipline"] == "struct"

    def test_set_column_discipline_to_arch(self, client: TestClient) -> None:
        """Columns default to 'struct'; override to 'arch' via API."""
        r1 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle([_CREATE_LEVEL, _CREATE_COLUMN], revision=1),
        )
        assert r1.status_code == 200, r1.text
        rev2 = r1.json()["newRevision"]

        r2 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["col-1"], "discipline": "arch"}],
                revision=rev2,
            ),
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["applied"] is True

        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        col = snap.json()["elements"]["col-1"]
        assert col["discipline"] == "arch"

    def test_set_discipline_batch_multiple_elements(self, client: TestClient) -> None:
        """Tag multiple elements in a single setElementDiscipline command."""
        r1 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [
                    _CREATE_LEVEL,
                    {**_CREATE_WALL, "id": "w-a", "start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 5000, "yMm": 0}},
                    {**_CREATE_WALL, "id": "w-b", "start": {"xMm": 0, "yMm": 6000}, "end": {"xMm": 5000, "yMm": 6000}},
                ],
                revision=1,
            ),
        )
        assert r1.status_code == 200
        rev2 = r1.json()["newRevision"]

        r2 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["w-a", "w-b"], "discipline": "mep"}],
                revision=rev2,
            ),
        )
        assert r2.status_code == 200
        assert r2.json()["applied"] is True

        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        elems = snap.json()["elements"]
        assert elems["w-a"]["discipline"] == "mep"
        assert elems["w-b"]["discipline"] == "mep"


class TestResetToDefault:
    """POST with discipline=null — assert element returns to DEFAULT_DISCIPLINE_BY_KIND value."""

    def test_reset_wall_to_default(self, client: TestClient) -> None:
        """Re-tag a wall to struct, then reset it to null — should become 'arch'."""
        r1 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle([_CREATE_LEVEL, _CREATE_WALL], revision=1),
        )
        assert r1.status_code == 200
        rev2 = r1.json()["newRevision"]

        # Tag to struct
        r2 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["wall-1"], "discipline": "struct"}],
                revision=rev2,
            ),
        )
        assert r2.status_code == 200
        rev3 = r2.json()["newRevision"]

        # Reset to null (should become DEFAULT_DISCIPLINE_BY_KIND["wall"] = "arch")
        r3 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["wall-1"], "discipline": None}],
                revision=rev3,
            ),
        )
        assert r3.status_code == 200, r3.text
        assert r3.json()["applied"] is True

        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        wall = snap.json()["elements"]["wall-1"]
        assert wall["discipline"] == DEFAULT_DISCIPLINE_BY_KIND["wall"]
        assert wall["discipline"] == "arch"

    def test_reset_column_to_default(self, client: TestClient) -> None:
        """Re-tag a column to 'arch', then reset it to null — should become 'struct'."""
        r1 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle([_CREATE_LEVEL, _CREATE_COLUMN], revision=1),
        )
        assert r1.status_code == 200
        rev2 = r1.json()["newRevision"]

        # Override to arch
        r2 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["col-1"], "discipline": "arch"}],
                revision=rev2,
            ),
        )
        assert r2.status_code == 200
        rev3 = r2.json()["newRevision"]

        # Reset to null (should become DEFAULT_DISCIPLINE_BY_KIND["column"] = "struct")
        r3 = client.post(
            f"/api/models/{MODEL_ID}/bundles",
            json=_bundle(
                [{"type": "setElementDiscipline", "elementIds": ["col-1"], "discipline": None}],
                revision=rev3,
            ),
        )
        assert r3.status_code == 200, r3.text
        assert r3.json()["applied"] is True

        snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
        col = snap.json()["elements"]["col-1"]
        assert col["discipline"] == DEFAULT_DISCIPLINE_BY_KIND["column"]
        assert col["discipline"] == "struct"
