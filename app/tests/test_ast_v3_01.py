"""AST-V3-01: Searchable asset library + schematic-2D thumbnails."""
from __future__ import annotations

import pytest

from bim_ai.assets import render_schematic_thumbnail_svg, search_assets
from bim_ai.document import Document
from bim_ai.elements import AssetLibraryEntryElem, PlacedAssetElem
from bim_ai.engine import apply_inplace


def _empty_doc() -> Document:
    return Document(elements={})


def _apply(doc: Document, cmd_dict: dict) -> Document:
    from pydantic import TypeAdapter

    from bim_ai.commands import Command

    ta: TypeAdapter[Command] = TypeAdapter(Command)
    cmd = ta.validate_python(cmd_dict)
    apply_inplace(doc, cmd)
    return doc


def _doc_with_level() -> tuple[Document, str]:
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "createLevel",
            "id": "lv-1",
            "name": "Level 1",
            "elevationMm": 0,
            "alsoCreatePlanView": False,
        },
    )
    return doc, "lv-1"


# ---------------------------------------------------------------------------
# IndexAssetCmd
# ---------------------------------------------------------------------------


def test_index_asset_creates_element():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "id": "asset-sink-1",
            "name": "Kitchen Sink, Double Basin",
            "category": "kitchen",
            "tags": ["sink", "plumbing", "double"],
            "thumbnailKind": "schematic_plan",
        },
    )
    elem = doc.elements.get("asset-sink-1")
    assert isinstance(elem, AssetLibraryEntryElem)
    assert elem.name == "Kitchen Sink, Double Basin"
    assert elem.category == "kitchen"
    assert "sink" in elem.tags


def test_index_asset_auto_id():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "name": "Chair",
            "category": "furniture",
        },
    )
    entries = [e for e in doc.elements.values() if isinstance(e, AssetLibraryEntryElem)]
    assert len(entries) == 1
    assert entries[0].name == "Chair"


def test_index_asset_duplicate_id_raises():
    doc = _empty_doc()
    _apply(doc, {"type": "IndexAsset", "id": "dup", "name": "A", "category": "furniture"})
    with pytest.raises(ValueError, match="duplicate element id"):
        _apply(doc, {"type": "IndexAsset", "id": "dup", "name": "B", "category": "furniture"})


def test_index_asset_with_param_schema():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "id": "asset-table-1",
            "name": "Dining Table",
            "category": "furniture",
            "paramSchema": [
                {"key": "widthMm", "kind": "mm", "default": 1200},
                {"key": "depthMm", "kind": "mm", "default": 800},
            ],
        },
    )
    elem = doc.elements["asset-table-1"]
    assert isinstance(elem, AssetLibraryEntryElem)
    assert elem.param_schema is not None
    assert len(elem.param_schema) == 2
    assert elem.param_schema[0].key == "widthMm"
    assert elem.param_schema[0].kind == "mm"


def test_index_asset_with_explicit_render_kinds():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "id": "asset-fridge-1",
            "name": "Appliance 600",
            "category": "kitchen",
            "planSymbolKind": "fridge",
            "renderProxyKind": "fridge",
        },
    )
    elem = doc.elements["asset-fridge-1"]
    assert isinstance(elem, AssetLibraryEntryElem)
    assert elem.plan_symbol_kind == "fridge"
    assert elem.render_proxy_kind == "fridge"


def test_index_asset_accepts_bedroom_and_living_symbol_kinds():
    doc = _empty_doc()
    for symbol_kind in ("bed", "wardrobe", "lamp", "rug"):
        _apply(
            doc,
            {
                "type": "IndexAsset",
                "id": f"asset-{symbol_kind}",
                "name": symbol_kind.title(),
                "category": "casework" if symbol_kind == "wardrobe" else "furniture",
                "planSymbolKind": symbol_kind,
                "renderProxyKind": symbol_kind,
            },
        )
        elem = doc.elements[f"asset-{symbol_kind}"]
        assert isinstance(elem, AssetLibraryEntryElem)
        assert elem.plan_symbol_kind == symbol_kind
        assert elem.render_proxy_kind == symbol_kind


def test_index_asset_accepts_bathroom_layout_symbol_kind():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "id": "asset-bath-layout",
            "name": "Compact Bathroom Layout",
            "category": "bathroom",
            "planSymbolKind": "bathroom_layout",
            "renderProxyKind": "bathroom_layout",
        },
    )
    elem = doc.elements["asset-bath-layout"]
    assert isinstance(elem, AssetLibraryEntryElem)
    assert elem.plan_symbol_kind == "bathroom_layout"
    assert elem.render_proxy_kind == "bathroom_layout"


def test_index_asset_discipline_tags():
    doc = _empty_doc()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "id": "asset-1",
            "name": "Fan Coil Unit",
            "category": "furniture",
            "disciplineTags": ["mep"],
        },
    )
    elem = doc.elements["asset-1"]
    assert isinstance(elem, AssetLibraryEntryElem)
    assert "mep" in elem.discipline_tags


# ---------------------------------------------------------------------------
# PlaceAssetCmd
# ---------------------------------------------------------------------------


def test_place_asset_creates_element():
    doc, level_id = _doc_with_level()
    _apply(doc, {"type": "IndexAsset", "id": "a-1", "name": "Sink", "category": "kitchen"})
    _apply(
        doc,
        {
            "type": "PlaceAsset",
            "id": "placed-1",
            "assetId": "a-1",
            "levelId": level_id,
            "positionMm": {"xMm": 1500, "yMm": 2000},
        },
    )
    elem = doc.elements.get("placed-1")
    assert isinstance(elem, PlacedAssetElem)
    assert elem.asset_id == "a-1"
    assert elem.level_id == level_id
    assert elem.position_mm.x_mm == 1500
    assert elem.position_mm.y_mm == 2000


def test_place_asset_inherits_name_from_entry():
    doc, level_id = _doc_with_level()
    _apply(doc, {"type": "IndexAsset", "id": "a-2", "name": "Toilet", "category": "bathroom"})
    _apply(
        doc,
        {
            "type": "PlaceAsset",
            "assetId": "a-2",
            "levelId": level_id,
            "positionMm": {"xMm": 500, "yMm": 500},
        },
    )
    placed = [e for e in doc.elements.values() if isinstance(e, PlacedAssetElem)]
    assert len(placed) == 1
    assert placed[0].name == "Toilet"


def test_place_asset_invalid_asset_id_raises():
    doc, level_id = _doc_with_level()
    with pytest.raises(ValueError, match="AssetLibraryEntry"):
        _apply(
            doc,
            {
                "type": "PlaceAsset",
                "assetId": "nonexistent",
                "levelId": level_id,
                "positionMm": {"xMm": 0, "yMm": 0},
            },
        )


def test_place_asset_invalid_level_id_raises():
    doc = _empty_doc()
    _apply(doc, {"type": "IndexAsset", "id": "a-3", "name": "Door", "category": "door"})
    with pytest.raises(ValueError, match="Level"):
        _apply(
            doc,
            {
                "type": "PlaceAsset",
                "assetId": "a-3",
                "levelId": "bad-level",
                "positionMm": {"xMm": 0, "yMm": 0},
            },
        )


def test_place_asset_with_param_values():
    doc, level_id = _doc_with_level()
    _apply(doc, {"type": "IndexAsset", "id": "a-4", "name": "Table", "category": "furniture"})
    _apply(
        doc,
        {
            "type": "PlaceAsset",
            "id": "placed-2",
            "assetId": "a-4",
            "levelId": level_id,
            "positionMm": {"xMm": 100, "yMm": 200},
            "paramValues": {"widthMm": 1600},
        },
    )
    elem = doc.elements["placed-2"]
    assert isinstance(elem, PlacedAssetElem)
    assert elem.param_values["widthMm"] == 1600


def test_update_placed_asset_param_values_after_placement():
    doc, level_id = _doc_with_level()
    _apply(
        doc,
        {
            "type": "IndexAsset",
            "id": "a-parametric-sofa",
            "name": "Sofa",
            "category": "furniture",
            "paramSchema": [
                {"key": "widthMm", "kind": "mm", "default": 2200},
                {"key": "depthMm", "kind": "mm", "default": 950},
            ],
        },
    )
    _apply(
        doc,
        {
            "type": "PlaceAsset",
            "id": "placed-parametric-sofa",
            "assetId": "a-parametric-sofa",
            "levelId": level_id,
            "positionMm": {"xMm": 100, "yMm": 200},
        },
    )
    _apply(
        doc,
        {
            "type": "updateElementProperty",
            "elementId": "placed-parametric-sofa",
            "key": "paramValues",
            "value": {"widthMm": 2600, "depthMm": 1000},
        },
    )

    elem = doc.elements["placed-parametric-sofa"]
    assert isinstance(elem, PlacedAssetElem)
    assert elem.param_values == {"widthMm": 2600, "depthMm": 1000}


def test_place_asset_rotation():
    doc, level_id = _doc_with_level()
    _apply(doc, {"type": "IndexAsset", "id": "a-5", "name": "Chair", "category": "furniture"})
    _apply(
        doc,
        {
            "type": "PlaceAsset",
            "id": "placed-3",
            "assetId": "a-5",
            "levelId": level_id,
            "positionMm": {"xMm": 0, "yMm": 0},
            "rotationDeg": 90,
        },
    )
    elem = doc.elements["placed-3"]
    assert isinstance(elem, PlacedAssetElem)
    assert elem.rotation_deg == 90


# ---------------------------------------------------------------------------
# search_assets
# ---------------------------------------------------------------------------


def _doc_with_assets() -> Document:
    doc = _empty_doc()
    entries = [
        {"id": "s1", "name": "Kitchen Sink, Double Basin", "category": "kitchen", "tags": ["sink", "plumbing"]},
        {"id": "s2", "name": "Kitchen Sink, Single", "category": "kitchen", "tags": ["sink"]},
        {"id": "s3", "name": "Bathroom Sink", "category": "bathroom", "tags": ["sink"]},
        {"id": "c1", "name": "Armchair", "category": "furniture", "tags": ["seating"]},
        {"id": "c2", "name": "Dining Chair", "category": "furniture", "tags": ["seating", "chair"]},
        {"id": "d1", "name": "Single Swing Door", "category": "door", "tags": ["door"]},
        {"id": "w1", "name": "Fixed Window", "category": "window", "tags": ["window", "fixed"]},
    ]
    for e in entries:
        _apply(doc, {"type": "IndexAsset", **e})
    return doc


def test_search_assets_by_query():
    doc = _doc_with_assets()
    results = search_assets("sink", doc.elements)
    ids = [r.id for r in results]
    assert "s1" in ids
    assert "s2" in ids
    assert "s3" in ids
    assert "c1" not in ids


def test_search_assets_category_filter():
    doc = _doc_with_assets()
    results = search_assets("sink", doc.elements, category="kitchen")
    ids = [r.id for r in results]
    assert "s1" in ids
    assert "s2" in ids
    assert "s3" not in ids  # bathroom


def test_search_assets_empty_query_returns_all():
    doc = _doc_with_assets()
    results = search_assets("", doc.elements)
    assert len(results) == 7


def test_search_assets_no_match_returns_empty():
    doc = _doc_with_assets()
    results = search_assets("bathtub", doc.elements)
    assert results == []


def test_search_assets_limit():
    doc = _doc_with_assets()
    results = search_assets("", doc.elements, limit=3)
    assert len(results) == 3


def test_search_assets_prefix_match():
    doc = _doc_with_assets()
    # "sin" should prefix-match "sink"
    results = search_assets("sin", doc.elements)
    ids = [r.id for r in results]
    assert any(i in ids for i in ["s1", "s2", "s3"])


def test_search_assets_discipline_filter():
    doc = _empty_doc()
    _apply(doc, {"type": "IndexAsset", "id": "m1", "name": "Fan Coil", "category": "furniture", "disciplineTags": ["mep"]})
    _apply(doc, {"type": "IndexAsset", "id": "a1", "name": "Column", "category": "furniture", "disciplineTags": ["struct"]})
    results = search_assets("", doc.elements, discipline_tag="mep")
    assert len(results) == 1
    assert results[0].id == "m1"


# ---------------------------------------------------------------------------
# render_schematic_thumbnail_svg
# ---------------------------------------------------------------------------


def _make_entry(category: str) -> AssetLibraryEntryElem:
    return AssetLibraryEntryElem(
        kind="asset_library_entry",
        id="t-1",
        assetKind="block_2d",
        name="Test",
        tags=[],
        category=category,
        thumbnailKind="schematic_plan",
        thumbnailWidthMm=60,
        thumbnailHeightMm=60,
    )


def test_thumbnail_is_valid_svg():
    svg = render_schematic_thumbnail_svg(_make_entry("kitchen"))
    assert svg.startswith("<svg")
    assert svg.endswith("</svg>")


def test_thumbnail_uses_only_token_colors():
    for cat in ["furniture", "kitchen", "bathroom", "door", "window", "casework", "decal", "profile"]:
        svg = render_schematic_thumbnail_svg(_make_entry(cat))
        # No inline hex literals allowed — only var(--...) tokens
        assert "#" not in svg, f"category '{cat}' thumbnail contains a hex literal"
        assert "var(--" in svg, f"category '{cat}' thumbnail missing CSS token"


def test_thumbnail_no_hex_literals_any_category():
    for cat in ["furniture", "kitchen", "bathroom", "door", "window", "casework", "decal", "profile"]:
        svg = render_schematic_thumbnail_svg(_make_entry(cat))
        import re
        assert not re.search(r"#[0-9a-fA-F]{3,6}\b", svg), f"hex literal in category '{cat}'"


def test_thumbnail_default_dimensions():
    entry = AssetLibraryEntryElem(
        kind="asset_library_entry",
        id="t-2",
        assetKind="block_2d",
        name="Default dims",
        tags=[],
        category="furniture",
        thumbnailKind="schematic_plan",
    )
    svg = render_schematic_thumbnail_svg(entry)
    # Default should be 60×60 (may render as 60 or 60.0)
    assert 'width="60' in svg
    assert 'height="60' in svg


def test_thumbnail_uses_explicit_symbol_kind_over_generic_name():
    entry = AssetLibraryEntryElem(
        kind="asset_library_entry",
        id="t-3",
        assetKind="block_2d",
        name="Appliance 600",
        tags=[],
        category="kitchen",
        planSymbolKind="fridge",
        thumbnailKind="schematic_plan",
        thumbnailWidthMm=60,
        thumbnailHeightMm=65,
    )
    svg = render_schematic_thumbnail_svg(entry)
    assert 'x1="30.0" y1="4"' in svg
    assert "var(--draft-cut)" in svg


def test_thumbnail_supports_bedroom_and_living_symbol_kinds():
    for symbol_kind in ("bed", "wardrobe", "lamp", "rug"):
        entry = AssetLibraryEntryElem(
            kind="asset_library_entry",
            id=f"t-{symbol_kind}",
            assetKind="block_2d",
            name=symbol_kind.title(),
            tags=[],
            category="casework" if symbol_kind == "wardrobe" else "furniture",
            planSymbolKind=symbol_kind,
            thumbnailKind="schematic_plan",
            thumbnailWidthMm=60,
            thumbnailHeightMm=60,
        )
        svg = render_schematic_thumbnail_svg(entry)
        assert "var(--draft-cut)" in svg
        assert 'stroke-width="0.5"' in svg
        assert "#" not in svg


# ---------------------------------------------------------------------------
# Tool descriptor registration
# ---------------------------------------------------------------------------


def test_tool_descriptors_registered():
    import bim_ai.assets  # noqa: F401 — ensure side effects ran
    from bim_ai.api.registry import get_descriptor

    for name in ("asset-index", "asset-search", "asset-place"):
        d = get_descriptor(name)
        assert d is not None, f"Tool descriptor '{name}' not registered"
        assert d.name == name


def test_tool_descriptors_have_required_fields():
    from bim_ai.api.registry import get_descriptor

    for name in ("asset-index", "asset-search", "asset-place"):
        d = get_descriptor(name)
        assert d is not None
        assert d.inputSchema
        assert d.outputSchema
        assert d.restEndpoint
        assert d.cliExample


def test_asset_index_descriptor_advertises_bathroom_layout_symbol_kind():
    from bim_ai.api.registry import get_descriptor

    d = get_descriptor("asset-index")
    assert d is not None
    props = d.inputSchema["properties"]
    assert "bathroom_layout" in props["planSymbolKind"]["enum"]
    assert "bathroom_layout" in props["renderProxyKind"]["enum"]
