"""CTL-V3-01: catalog query layer."""

from __future__ import annotations

CTL_SCHEMA = "ctl-v3.0"
DEFAULT_PAGE_SIZE = 50


def query_catalog(
    *,
    kind: str | None = None,
    max_width_mm: float | None = None,
    min_width_mm: float | None = None,
    tag: str | None = None,
    style: str | None = None,
    page: int = 0,
    page_size: int = DEFAULT_PAGE_SIZE,
    catalog_store: list[dict] | None = None,
) -> dict:
    """Query the T5 catalog. Returns a CatalogQueryResult dict.

    catalog_store: injected for testing; defaults to _load_catalog().
    Same inputs -> identical output (deterministic, no randomness).
    """
    items = catalog_store if catalog_store is not None else _load_catalog()

    # Filter
    if kind:
        items = [i for i in items if i.get("kind") == kind]
    if max_width_mm is not None:
        items = [i for i in items if i.get("widthMm", 0) <= max_width_mm]
    if min_width_mm is not None:
        items = [i for i in items if i.get("widthMm", float("inf")) >= min_width_mm]
    if tag:
        items = [i for i in items if tag in i.get("tags", [])]
    if style:
        items = [i for i in items if i.get("style") == style]

    # Sort deterministically by id for reproducibility
    items = sorted(items, key=lambda i: i.get("id", ""))

    total = len(items)
    start = page * page_size
    page_items = items[start : start + page_size]

    return {
        "schemaVersion": CTL_SCHEMA,
        "items": page_items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


def _load_catalog() -> list[dict]:
    """Load the T5 catalog from the asset library store.

    Falls back to a minimal built-in fixture if the store is not yet populated.
    """
    try:
        from app.bim_ai.db import get_global_catalog  # type: ignore

        return [e.model_dump(by_alias=True) for e in get_global_catalog()]
    except Exception:
        return _builtin_fixture()


def _builtin_fixture() -> list[dict]:
    """Minimal built-in catalog for tests and early integration."""
    return [
        {
            "id": "door-800",
            "kind": "door",
            "widthMm": 800,
            "heightMm": 2100,
            "tags": ["interior", "single"],
            "style": "flush",
            "previewAssetId": None,
        },
        {
            "id": "door-900",
            "kind": "door",
            "widthMm": 900,
            "heightMm": 2100,
            "tags": ["exterior", "single"],
            "style": "panel",
            "previewAssetId": None,
        },
        {
            "id": "window-600",
            "kind": "window",
            "widthMm": 600,
            "heightMm": 1200,
            "tags": ["casement"],
            "style": "casement",
            "previewAssetId": None,
        },
        {
            "id": "window-1200",
            "kind": "window",
            "widthMm": 1200,
            "heightMm": 1400,
            "tags": ["fixed"],
            "style": "fixed",
            "previewAssetId": None,
        },
        {
            "id": "sofa-2400",
            "kind": "sofa",
            "widthMm": 2400,
            "heightMm": 900,
            "tags": ["lounge", "3-seat"],
            "style": "modern",
            "previewAssetId": None,
        },
    ]
