"""FAM-08 — schema validation for the bundled external family catalogs.

Walks every file in ``app/bim_ai/family_catalogs`` and asserts:
1. Each file parses through ``CatalogPayload``.
2. Each catalog has at least one family with at least one default type.
3. The family-id and default-type ids inside the catalog all resolve.
4. The bundled fixtures listed in the wave-2 prompt are present.
"""

from __future__ import annotations

import json

import pytest

from bim_ai.family_catalog_format import (
    CATALOGS_DIR,
    CatalogValidationError,
    find_family_in_catalog,
    list_catalog_files,
    load_catalog_by_id,
    load_catalog_file,
    load_catalog_index,
)

REQUIRED_CATALOG_IDS = {
    "living-room-furniture",
    "bathroom-fixtures",
    "kitchen-fixtures",
}


def test_catalogs_dir_has_required_fixtures() -> None:
    files = list_catalog_files()
    assert files, f"no catalog files in {CATALOGS_DIR}"
    found = {load_catalog_file(p).catalog_id for p in files}
    missing = REQUIRED_CATALOG_IDS - found
    assert not missing, f"missing required catalogs: {missing}"


def test_living_room_catalog_loads_with_required_families() -> None:
    cat = load_catalog_by_id("living-room-furniture")
    assert cat is not None
    assert cat.catalog_id == "living-room-furniture"
    assert cat.name and cat.version
    fam_ids = {f.id for f in cat.families}
    # Spec: living-room ships sofa, coffee table, lamp, armchair (~6 families)
    assert "catalog:living-room:sofa-3-seat" in fam_ids
    assert "catalog:living-room:coffee-table" in fam_ids
    assert "catalog:living-room:floor-lamp" in fam_ids
    assert "catalog:living-room:armchair" in fam_ids
    assert len(cat.families) >= 4


def test_bathroom_catalog_has_required_families() -> None:
    cat = load_catalog_by_id("bathroom-fixtures")
    assert cat is not None
    fam_ids = {f.id for f in cat.families}
    for needle in ("toilet", "washbasin", "shower", "bathtub"):
        assert any(needle in fid for fid in fam_ids), f"missing {needle} in bathroom catalog"


def test_kitchen_catalog_has_required_families() -> None:
    cat = load_catalog_by_id("kitchen-fixtures")
    assert cat is not None
    fam_ids = {f.id for f in cat.families}
    for needle in ("counter", "sink", "oven", "fridge"):
        assert any(needle in fid for fid in fam_ids), f"missing {needle} in kitchen catalog"


def test_every_family_has_at_least_one_default_type() -> None:
    for path in list_catalog_files():
        cat = load_catalog_file(path)
        for fam in cat.families:
            assert fam.default_types, f"{cat.catalog_id}/{fam.id} has no defaultTypes"
            for dt in fam.default_types:
                assert dt.family_id == fam.id, (
                    f"{cat.catalog_id}/{fam.id}: defaultType {dt.id} has wrong familyId "
                    f"{dt.family_id!r}"
                )


def test_load_catalog_index_returns_compact_entries() -> None:
    idx = load_catalog_index()
    by_id = {e.catalog_id: e for e in idx}
    for cid in REQUIRED_CATALOG_IDS:
        assert cid in by_id
        entry = by_id[cid]
        assert entry.family_count > 0
        assert entry.name


def test_find_family_in_catalog_resolves_existing_family() -> None:
    cat = load_catalog_by_id("living-room-furniture")
    assert cat is not None
    fam = find_family_in_catalog(cat, "catalog:living-room:sofa-3-seat")
    assert fam is not None
    assert fam.discipline == "generic"
    assert any(dt.id.endswith("standard") for dt in fam.default_types)


def test_find_family_in_catalog_returns_none_for_missing(tmp_path) -> None:
    cat = load_catalog_by_id("kitchen-fixtures")
    assert cat is not None
    assert find_family_in_catalog(cat, "catalog:no-such-family") is None


def test_load_catalog_by_id_returns_none_for_missing() -> None:
    assert load_catalog_by_id("does-not-exist") is None


def test_invalid_json_raises_catalog_validation_error(tmp_path) -> None:
    bad = tmp_path / "broken.json"
    bad.write_text("{not valid json", encoding="utf-8")
    with pytest.raises(CatalogValidationError):
        load_catalog_file(bad)


def test_schema_mismatch_raises_catalog_validation_error(tmp_path) -> None:
    bad = tmp_path / "wrong-shape.json"
    bad.write_text(
        json.dumps(
            {
                "name": "missing catalogId + version",
                "families": [],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(CatalogValidationError):
        load_catalog_file(bad)
