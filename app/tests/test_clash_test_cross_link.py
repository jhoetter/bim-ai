"""FED-02 — cross-link clash detection.

Acceptance: a host wall + a beam-shaped wall in a linked Structure model
should clash when run with ``linkScope='all_links'`` (or a specific link id),
and the clash result should carry a populated ``link_chain`` identifying the
link that contributed the linked element.
"""

from __future__ import annotations

import pytest

from bim_ai.clash_engine import Aabb, aabb_clash_distance_mm, run_clash_test
from bim_ai.document import Document
from bim_ai.elements import (
    AssetLibraryEntryElem,
    ClashTestElem,
    LevelElem,
    LinkModelElem,
    PlacedAssetElem,
    SelectionSetElem,
    SelectionSetRuleSpec,
    Vec2Mm,
    Vec3Mm,
    WallElem,
)
from bim_ai.engine import apply_inplace, try_commit


def _level(eid: str = "lvl-0", elev: float = 0.0) -> LevelElem:
    return LevelElem(kind="level", id=eid, name="L0", elevation_mm=elev, datum_kind="story")


def _wall(
    *,
    id: str,
    sx: float,
    sy: float,
    ex: float,
    ey: float,
    thickness: float = 200.0,
    height: float = 3000.0,
    name: str = "W",
    level_id: str = "lvl-0",
) -> WallElem:
    return WallElem(
        kind="wall",
        id=id,
        name=name,
        level_id=level_id,
        start=Vec2Mm(x_mm=sx, y_mm=sy),
        end=Vec2Mm(x_mm=ex, y_mm=ey),
        thickness_mm=thickness,
        height_mm=height,
    )


# --- AABB primitive --------------------------------------------------------


def test_aabb_clash_distance_overlap_is_zero():
    a = Aabb(min_x=0, min_y=0, min_z=0, max_x=10, max_y=10, max_z=10)
    b = Aabb(min_x=5, min_y=5, min_z=5, max_x=15, max_y=15, max_z=15)
    assert aabb_clash_distance_mm(a, b) == 0.0


def test_aabb_clash_distance_separated_returns_axis_distance():
    a = Aabb(min_x=0, min_y=0, min_z=0, max_x=10, max_y=10, max_z=10)
    b = Aabb(min_x=20, min_y=0, min_z=0, max_x=30, max_y=10, max_z=10)
    assert aabb_clash_distance_mm(a, b) == pytest.approx(10.0)


def test_aabb_transformed_rotation_keeps_axis_aligned_wrap():
    a = Aabb(min_x=-100, min_y=-50, min_z=0, max_x=100, max_y=50, max_z=200)
    # 90° rotation: x-extent (200) and y-extent (100) swap.
    rotated = a.transformed(sin_a=1.0, cos_a=0.0, dx=0, dy=0, dz=0)
    assert rotated.max_x - rotated.min_x == pytest.approx(100)
    assert rotated.max_y - rotated.min_y == pytest.approx(200)


# --- Engine round-trip: upsert + run ---------------------------------------


def test_upsert_selection_set_with_link_scope_round_trips():
    doc = Document(revision=1, elements={"lvl-0": _level()})
    ok, new_doc, _c, _v, _code = try_commit(
        doc,
        {
            "type": "upsertSelectionSet",
            "id": "sset-A",
            "name": "All walls (any link)",
            "filterRules": [
                {
                    "field": "category",
                    "operator": "equals",
                    "value": "wall",
                    "linkScope": "all_links",
                }
            ],
        },
    )
    assert ok
    assert new_doc is not None
    sset = new_doc.elements["sset-A"]
    assert isinstance(sset, SelectionSetElem)
    assert sset.filter_rules[0].link_scope == "all_links"


def test_upsert_clash_test_round_trips():
    doc = Document(revision=1, elements={"lvl-0": _level()})
    ok, new_doc, _c, _v, _code = try_commit(
        doc,
        {
            "type": "upsertClashTest",
            "id": "ct-1",
            "name": "Walls vs Beams",
            "setAIds": ["sset-A"],
            "setBIds": ["sset-B"],
            "toleranceMm": 0.0,
        },
    )
    assert ok
    assert new_doc is not None
    ct = new_doc.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    assert ct.set_a_ids == ["sset-A"]


# --- Cross-link clash flow -------------------------------------------------


def test_run_clash_test_host_only_finds_clash():
    """Sanity: clash logic works even without any links."""
    doc = Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            # Two walls that overlap (same line, opposite endpoints).
            "w-arch": _wall(id="w-arch", sx=0, sy=0, ex=2000, ey=0, name="Arch"),
            "w-other": _wall(id="w-other", sx=500, sy=-50, ex=1500, ey=50, name="Beam"),
            "sset-A": SelectionSetElem(
                kind="selection_set",
                id="sset-A",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="typeName", operator="equals", value="Arch", link_scope="host"
                    )
                ],
            ),
            "sset-B": SelectionSetElem(
                kind="selection_set",
                id="sset-B",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="typeName", operator="equals", value="Beam", link_scope="host"
                    )
                ],
            ),
            "ct-1": ClashTestElem(
                kind="clash_test", id="ct-1", set_a_ids=["sset-A"], set_b_ids=["sset-B"]
            ),
        },
    )
    from bim_ai.commands import RunClashTestCmd

    apply_inplace(doc, RunClashTestCmd(clashTestId="ct-1"))
    ct = doc.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    assert ct.results is not None
    assert len(ct.results) == 1
    r = ct.results[0]
    assert {r.element_id_a, r.element_id_b} == {"w-arch", "w-other"}
    assert r.link_chain_a == [] and r.link_chain_b == []


def test_run_clash_test_includes_placed_assets_from_constructability_proxies():
    doc = Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            "w-arch": _wall(id="w-arch", sx=0, sy=0, ex=2000, ey=0, name="Arch wall"),
            "asset-shelf": AssetLibraryEntryElem(
                kind="asset_library_entry",
                id="asset-shelf",
                assetKind="block_2d",
                name="Shelf type",
                category="casework",
                tags=[],
                thumbnailKind="schematic_plan",
            ),
            "shelf-1": PlacedAssetElem(
                kind="placed_asset",
                id="shelf-1",
                name="Shelf",
                assetId="asset-shelf",
                levelId="lvl-0",
                positionMm={"xMm": 1000, "yMm": 0},
                paramValues={"widthMm": 600, "depthMm": 300, "proxyHeightMm": 900},
            ),
            "sset-A": SelectionSetElem(
                kind="selection_set",
                id="sset-A",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="category", operator="equals", value="wall", link_scope="host"
                    )
                ],
            ),
            "sset-B": SelectionSetElem(
                kind="selection_set",
                id="sset-B",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="category", operator="equals", value="placed_asset", link_scope="host"
                    )
                ],
            ),
            "ct-1": ClashTestElem(
                kind="clash_test", id="ct-1", set_a_ids=["sset-A"], set_b_ids=["sset-B"]
            ),
        },
    )

    ct = doc.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    results = run_clash_test(doc, ct, lambda _uuid, _rev: None)

    assert len(results) == 1
    assert {results[0].element_id_a, results[0].element_id_b} == {"w-arch", "shelf-1"}


def _build_host_with_link(link_id: str = "link-str") -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            "w-arch": _wall(id="w-arch", sx=0, sy=0, ex=2000, ey=0, name="Arch wall"),
            link_id: LinkModelElem(
                kind="link_model",
                id=link_id,
                name="Structure link",
                source_model_id="22222222-2222-2222-2222-222222222222",
                position_mm=Vec3Mm(x_mm=500.0, y_mm=0.0, z_mm=0.0),
                rotation_deg=0.0,
                origin_alignment_mode="origin_to_origin",
            ),
            "sset-A": SelectionSetElem(
                kind="selection_set",
                id="sset-A",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="typeName",
                        operator="equals",
                        value="Arch wall",
                        link_scope="host",
                    )
                ],
            ),
            "sset-B": SelectionSetElem(
                kind="selection_set",
                id="sset-B",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="typeName",
                        operator="equals",
                        value="Structural beam",
                        link_scope="all_links",
                    )
                ],
            ),
            "ct-1": ClashTestElem(
                kind="clash_test", id="ct-1", set_a_ids=["sset-A"], set_b_ids=["sset-B"]
            ),
        },
    )


def _structure_source_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            # A "beam" represented as a thin wall element sitting near the host
            # wall once translated by (500, 0).
            "beam-1": _wall(
                id="beam-1",
                sx=200,
                sy=-50,
                ex=1200,
                ey=50,
                thickness=80.0,
                height=400.0,
                name="Structural beam",
            ),
        },
    )


def test_cross_link_clash_detected_with_link_chain():
    host = _build_host_with_link()
    src = _structure_source_doc()

    def provider(uuid: str, rev: int | None) -> Document | None:
        if uuid == "22222222-2222-2222-2222-222222222222":
            return src
        return None

    ct = host.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    results = run_clash_test(host, ct, provider)
    assert len(results) == 1
    r = results[0]
    # Pair: host wall vs linked beam (id is prefixed with the link id).
    assert r.element_id_a == "w-arch"
    assert r.element_id_b == "link-str::beam-1"
    assert r.link_chain_a == []
    assert r.link_chain_b == ["link-str"]


def test_specific_link_id_scope_excludes_other_links():
    """A rule scoped to a single link should ignore other links' contents."""
    host = _build_host_with_link()
    # Add a second, distant link that also exposes a beam — but the rule is
    # scoped to the first link only.
    host.elements["link-mep"] = LinkModelElem(
        kind="link_model",
        id="link-mep",
        name="MEP",
        source_model_id="33333333-3333-3333-3333-333333333333",
        position_mm=Vec3Mm(x_mm=0.0, y_mm=99999.0, z_mm=0.0),
        rotation_deg=0.0,
        origin_alignment_mode="origin_to_origin",
    )
    sset_b = host.elements["sset-B"]
    assert isinstance(sset_b, SelectionSetElem)
    sset_b.filter_rules[0].link_scope = {"specificLinkId": "link-str"}

    structure = _structure_source_doc()
    mep = _structure_source_doc()  # same shape; just a far-away placement

    def provider(uuid: str, rev: int | None) -> Document | None:
        if uuid == "22222222-2222-2222-2222-222222222222":
            return structure
        if uuid == "33333333-3333-3333-3333-333333333333":
            return mep
        return None

    ct = host.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    results = run_clash_test(host, ct, provider)
    assert len(results) == 1
    assert results[0].link_chain_b == ["link-str"]


def test_link_rotation_translates_aabb_into_clash_zone():
    """A linked beam that's far from the host in source-space should be
    rotated/translated into the host's clash zone by the link transform."""

    host_doc = Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            "w-arch": _wall(id="w-arch", sx=0, sy=0, ex=2000, ey=0, name="Arch"),
            # 90° rotation + translation: source X-axis maps to host Y-axis.
            "link-rot": LinkModelElem(
                kind="link_model",
                id="link-rot",
                name="Rotated",
                source_model_id="44444444-4444-4444-4444-444444444444",
                position_mm=Vec3Mm(x_mm=500.0, y_mm=-1000.0, z_mm=0.0),
                rotation_deg=90.0,
                origin_alignment_mode="origin_to_origin",
            ),
            "sset-A": SelectionSetElem(
                kind="selection_set",
                id="sset-A",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="typeName", operator="equals", value="Arch", link_scope="host"
                    )
                ],
            ),
            "sset-B": SelectionSetElem(
                kind="selection_set",
                id="sset-B",
                filter_rules=[
                    SelectionSetRuleSpec(
                        field="typeName",
                        operator="equals",
                        value="Beam",
                        link_scope="all_links",
                    )
                ],
            ),
            "ct-1": ClashTestElem(
                kind="clash_test", id="ct-1", set_a_ids=["sset-A"], set_b_ids=["sset-B"]
            ),
        },
    )

    # Source: a "beam" sitting along source-X around (1000, 0). After +90°
    # rotation that becomes source-Y, then +(500, -1000) places it at roughly
    # (500, 0) — overlapping the host wall.
    src = Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            "b": _wall(
                id="b", sx=900, sy=-25, ex=1100, ey=25, thickness=80, height=400, name="Beam"
            ),
        },
    )

    def provider(uuid: str, rev: int | None) -> Document | None:
        return src if uuid == "44444444-4444-4444-4444-444444444444" else None

    ct = host_doc.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    results = run_clash_test(host_doc, ct, provider)
    assert len(results) == 1
    assert results[0].link_chain_b == ["link-rot"]


def test_run_clash_test_with_no_links_or_provider_falls_back_to_host():
    """If a rule says ``all_links`` but no provider is wired, that rule simply
    contributes no candidates — the test still runs (host-only)."""

    host = _build_host_with_link()
    sset_b = host.elements["sset-B"]
    assert isinstance(sset_b, SelectionSetElem)
    sset_b.filter_rules[0].link_scope = "all_links"

    def empty_provider(_uuid: str, _rev: int | None) -> Document | None:
        return None

    ct = host.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    results = run_clash_test(host, ct, empty_provider)
    # No candidates in setB — no clashes.
    assert results == []


def test_run_clash_test_command_round_trips_through_engine():
    """The full apply path: upsert sets + clash test, then run it via
    ``RunClashTestCmd``; results land on the element."""

    from bim_ai.commands import RunClashTestCmd

    host = _build_host_with_link()
    src = _structure_source_doc()

    def provider(uuid: str, rev: int | None) -> Document | None:
        return src if uuid == "22222222-2222-2222-2222-222222222222" else None

    apply_inplace(
        host,
        RunClashTestCmd(clashTestId="ct-1"),
        source_provider=provider,
    )
    ct = host.elements["ct-1"]
    assert isinstance(ct, ClashTestElem)
    assert ct.results is not None
    assert len(ct.results) == 1
    assert ct.results[0].link_chain_b == ["link-str"]
