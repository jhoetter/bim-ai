from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FamilyTypeElem,
    FloorElem,
    LevelElem,
    PlanViewElem,
    RoomElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
)
from bim_ai.query_resolve import (
    model_summary_resource,
    query_elements,
    query_enclosed_loops,
    query_hosts,
    query_levels,
    query_types,
    query_views,
    resolve_active_or_default_level,
    resolve_default_plan_view,
    resolve_family_type,
    resolve_host_face,
    resolve_loop_for_boundary,
    resolve_room_boundary,
    resolve_wall_by_line,
)

MODEL_ID = "model-query-resolve"


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _doc() -> Document:
    return Document(
        revision=7,
        elements={
            "level-0": LevelElem(id="level-0", name="Ground Floor", elevationMm=0),
            "plan-level-0": PlanViewElem(
                id="plan-level-0",
                name="Ground Floor Plan",
                levelId="level-0",
                scale=100,
            ),
            "wall-type-ext": WallTypeElem(id="wall-type-ext", name="Exterior 200"),
            "door-type-single": FamilyTypeElem(
                id="door-type-single",
                name="Single Flush 900",
                familyId="single-flush",
                discipline="door",
                parameters={"widthMm": 900, "heightMm": 2100},
            ),
            "w-s": WallElem(
                id="w-s",
                name="South wall",
                levelId="level-0",
                start=_pt(0, 0),
                end=_pt(12000, 0),
                wallTypeId="wall-type-ext",
                heightMm=3000,
                thicknessMm=200,
            ),
            "w-e": WallElem(
                id="w-e",
                name="East wall",
                levelId="level-0",
                start=_pt(12000, 0),
                end=_pt(12000, 9000),
                wallTypeId="wall-type-ext",
                heightMm=3000,
                thicknessMm=200,
            ),
            "w-n": WallElem(
                id="w-n",
                name="North wall",
                levelId="level-0",
                start=_pt(12000, 9000),
                end=_pt(0, 9000),
                wallTypeId="wall-type-ext",
                heightMm=3000,
                thicknessMm=200,
            ),
            "w-w": WallElem(
                id="w-w",
                name="West wall",
                levelId="level-0",
                start=_pt(0, 9000),
                end=_pt(0, 0),
                wallTypeId="wall-type-ext",
                heightMm=3000,
                thicknessMm=200,
            ),
            "door-1": DoorElem(
                id="door-1",
                name="Entry door",
                wallId="w-s",
                alongT=0.25,
                widthMm=900,
                familyTypeId="door-type-single",
            ),
            "floor-1": FloorElem(
                id="floor-1",
                name="Ground slab",
                levelId="level-0",
                boundaryMm=[_pt(0, 0), _pt(12000, 0), _pt(12000, 9000), _pt(0, 9000)],
                floorTypeId=None,
            ),
            "room-1": RoomElem(
                id="room-1",
                name="Living",
                levelId="level-0",
                outlineMm=[_pt(0, 0), _pt(6000, 0), _pt(6000, 4500), _pt(0, 4500)],
            ),
        },
    )


def test_model_summary_resource_returns_counts_defaults_and_extents() -> None:
    summary = model_summary_resource(MODEL_ID, _doc())

    assert summary["revision"] == 7
    assert summary["counts"]["walls"] == 4
    assert summary["counts"]["levels"] == 1
    assert summary["defaults"]["levelId"] == "level-0"
    assert summary["defaults"]["planViewId"] == "plan-level-0"
    assert summary["extents"]["bboxMm"][0:2] == [-100.0, -100.0]


def test_query_elements_filters_and_includes_geometry_and_hosts() -> None:
    result = query_elements(
        MODEL_ID,
        _doc(),
        {"filter": {"kinds": ["door"], "levelIds": ["level-0"], "text": "entry"}},
        include=["geometrySummary", "hostRefs"],
    )

    assert result["ok"] is True
    door = result["data"]["elements"][0]
    assert door["id"] == "door-1"
    assert door["typeId"] == "door-type-single"
    assert door["geometrySummary"]["representation"] == "hosted_opening"
    assert door["hostRefs"] == [{"elementId": "w-s", "kind": "wall", "relationship": "host"}]


def test_query_levels_types_and_views_return_stable_resource_shapes() -> None:
    doc = _doc()

    levels = query_levels(MODEL_ID, doc, include=["planViews", "constraints"])
    types = query_types(MODEL_ID, doc, {"filter": {"categories": ["door"]}}, include=["parameters"])
    views = query_views(MODEL_ID, doc, {"filter": {"kinds": ["plan_view"]}}, include=[])

    assert levels["data"]["levels"][0]["planViewIds"] == ["plan-level-0"]
    assert types["data"]["types"][0]["id"] == "door-type-single"
    assert types["data"]["types"][0]["parameters"]["widthMm"] == 900
    assert views["data"]["views"][0]["id"] == "plan-level-0"
    assert views["data"]["views"][0]["scale"] == 100


def test_query_hosts_and_resolve_host_face_find_nearest_wall() -> None:
    doc = _doc()

    hosts = query_hosts(
        MODEL_ID,
        doc,
        {
            "hostKind": "wall",
            "forKind": "door",
            "levelId": "level-0",
            "nearPointMm": [3000, 20, 1000],
        },
    )
    resolved = resolve_host_face(
        MODEL_ID,
        doc,
        {
            "forKind": "door",
            "hostKinds": ["wall"],
            "levelId": "level-0",
            "pointMm": [3000, 20, 1000],
        },
    )

    assert hosts["data"]["hosts"][0]["elementId"] == "w-s"
    assert hosts["data"]["hosts"][0]["position"]["t"] == 0.25
    assert resolved["data"]["host"]["elementId"] == "w-s"
    assert resolved["data"]["placement"]["u"] == 0.25


def test_resolve_wall_by_line_and_defaults() -> None:
    doc = _doc()

    level = resolve_active_or_default_level(MODEL_ID, doc, {"hint": {"viewId": "plan-level-0"}})
    view = resolve_default_plan_view(MODEL_ID, doc, {"levelId": "level-0"})
    wall = resolve_wall_by_line(
        MODEL_ID,
        doc,
        {"levelId": "level-0", "lineMm": [[0, 0], [12000, 0]], "toleranceMm": 25},
    )

    assert level["data"]["level"]["id"] == "level-0"
    assert level["data"]["resolution"]["strategy"] == "from_view"
    assert view["data"]["viewId"] == "plan-level-0"
    assert wall["data"]["wallId"] == "w-s"
    assert wall["data"]["match"]["overlapRatio"] == 1.0


def test_loop_discovery_and_boundary_resolvers() -> None:
    doc = _doc()

    loops = query_enclosed_loops(
        MODEL_ID,
        doc,
        {
            "levelId": "level-0",
            "source": {"kind": "walls", "elementIds": ["w-s", "w-e", "w-n", "w-w"]},
            "toleranceMm": 25,
        },
    )
    loop = resolve_loop_for_boundary(
        MODEL_ID,
        doc,
        {
            "levelId": "level-0",
            "source": {"kind": "enclosing_walls", "elementIds": ["w-s", "w-e", "w-n", "w-w"]},
            "toleranceMm": 25,
        },
    )
    room = resolve_room_boundary(MODEL_ID, doc, {"roomId": "room-1"})

    assert loops["ok"] is True
    assert loops["data"]["loops"][0]["id"].startswith("loop:sha256:")
    assert loops["data"]["loops"][0]["boundaryMm"][0] == loops["data"]["loops"][0]["boundaryMm"][-1]
    assert loop["data"]["usableFor"] == ["floor", "roof", "room", "ceiling"]
    assert room["data"]["areaMm2"] == 27_000_000


def test_resolve_family_type_and_unsupported_filters_are_explicit() -> None:
    doc = _doc()

    family = resolve_family_type(
        MODEL_ID,
        doc,
        {"category": "door", "nameOrText": "single flush 900", "preferDefault": True},
    )
    unsupported_created_by = query_elements(
        MODEL_ID,
        doc,
        {"filter": {"createdBy": "agent:mcp"}},
        include=[],
    )
    unsupported_parameters = query_types(
        MODEL_ID,
        doc,
        {"filter": {"parameters": {"widthMm": {"gte": 800}}}},
        include=[],
    )

    assert family["data"]["typeId"] == "door-type-single"
    assert unsupported_created_by["ok"] is False
    assert unsupported_created_by["error"]["code"] == "unsupported_filter"
    assert unsupported_parameters["ok"] is False
    assert unsupported_parameters["error"]["code"] == "unsupported_filter"
