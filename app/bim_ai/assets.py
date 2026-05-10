"""AST-V3-01 — Asset library indexing, fuzzy search, and schematic-thumbnail pipeline.

Owns:
- Token-based fuzzy search across name + tags + description (MiniSearch-style).
- Schematic-2D plan thumbnail generation at 1:50 paper scale using --draft-* /
  --cat-* CSS token variables (no inline hex literals).
- API-V3-01 tool descriptor registration for index-asset, search-assets, and
  place-asset so an external agent can drive the library programmatically.
"""

from __future__ import annotations

import re
from typing import Any

from bim_ai.elements import AssetLibraryEntryElem

# ---------------------------------------------------------------------------
# Fuzzy search — token-based, no external deps
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _score_entry(entry: AssetLibraryEntryElem, query_tokens: list[str]) -> float:
    corpus: set[str] = set(
        _tokenize(entry.name)
        + _tokenize(entry.description or "")
        + [t for tag in entry.tags for t in _tokenize(tag)]
    )
    if not query_tokens:
        return 1.0
    hits = 0
    for qt in query_tokens:
        if qt in corpus:
            hits += 2
        elif any(ct.startswith(qt) for ct in corpus):
            hits += 1
    return hits / (len(query_tokens) * 2)


def search_assets(
    query: str,
    elements: dict[str, Any],
    *,
    category: str | None = None,
    discipline_tag: str | None = None,
    limit: int = 20,
) -> list[AssetLibraryEntryElem]:
    """Return up to *limit* AssetLibraryEntryElems ranked by fuzzy match to *query*."""
    entries: list[AssetLibraryEntryElem] = [
        e for e in elements.values() if isinstance(e, AssetLibraryEntryElem)
    ]
    if category:
        entries = [e for e in entries if e.category == category]
    if discipline_tag:
        entries = [e for e in entries if discipline_tag in e.discipline_tags]

    tokens = _tokenize(query)
    if not tokens:
        return entries[:limit]

    scored = [(e, _score_entry(e, tokens)) for e in entries]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [e for e, s in scored if s > 0][:limit]


# ---------------------------------------------------------------------------
# Schematic-2D thumbnail SVG — 1:50 paper scale, --draft-* / --cat-* tokens
# ---------------------------------------------------------------------------


def render_schematic_thumbnail_svg(entry: AssetLibraryEntryElem) -> str:
    """Generate a schematic plan SVG thumbnail at 1:50 paper scale.

    All strokes use CSS custom property tokens (--draft-cut, --cat-fixture, etc.)
    so they inherit the live plan canvas line-weight stack.  No hex literals.
    """
    w = entry.thumbnail_width_mm or 60.0
    h = entry.thumbnail_height_mm or 60.0
    cat = entry.category
    symbol_kind = entry.plan_symbol_kind
    label_text = " ".join([entry.id, entry.name, *entry.tags, cat]).lower()

    def _furniture(w: float, h: float) -> str:
        if symbol_kind == "bed":
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
                f'<rect x="{w * 0.16:.1f}" y="{h * 0.14:.1f}" width="{w * 0.28:.1f}" '
                f'height="{h * 0.18:.1f}" fill="none" stroke="var(--draft-cut)" '
                f'stroke-width="0.25"/>'
                f'<rect x="{w * 0.56:.1f}" y="{h * 0.14:.1f}" width="{w * 0.28:.1f}" '
                f'height="{h * 0.18:.1f}" fill="none" stroke="var(--draft-cut)" '
                f'stroke-width="0.25"/>'
                f'<line x1="{w * 0.12:.1f}" y1="{h * 0.38:.1f}" '
                f'x2="{w * 0.88:.1f}" y2="{h * 0.86:.1f}" '
                f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
            )
        if symbol_kind == "wardrobe":
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
                f'<line x1="{w / 2:.1f}" y1="4" x2="{w / 2:.1f}" y2="{h - 4:.1f}" '
                f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
                f'<circle cx="{w * 0.42:.1f}" cy="{h * 0.62:.1f}" r="{min(w, h) * 0.03:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.25"/>'
                f'<circle cx="{w * 0.58:.1f}" cy="{h * 0.62:.1f}" r="{min(w, h) * 0.03:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.25"/>'
            )
        if symbol_kind == "lamp":
            return (
                f'<circle cx="{w / 2:.1f}" cy="{h / 2:.1f}" r="{min(w, h) * 0.34:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
                f'<circle cx="{w / 2:.1f}" cy="{h / 2:.1f}" r="{min(w, h) * 0.12:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.25"/>'
            )
        if symbol_kind == "rug":
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'rx="{min(w, h) * 0.05:.1f}" fill="none" stroke="var(--draft-cut)" '
                f'stroke-width="0.5"/>'
                f'<rect x="{w * 0.12:.1f}" y="{h * 0.16:.1f}" width="{w * 0.76:.1f}" '
                f'height="{h * 0.68:.1f}" fill="none" stroke="var(--draft-cut)" '
                f'stroke-width="0.25"/>'
            )
        return (
            f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
            f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
            f'<line x1="4" y1="{h / 2:.1f}" x2="{w - 4:.1f}" y2="{h / 2:.1f}" '
            f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
        )

    def _plumbing(w: float, h: float) -> str:
        r = min(w, h) * 0.15
        cx, cy = w / 2, h / 2
        return (
            f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
            f'rx="{r:.1f}" ry="{r:.1f}" fill="none" '
            f'stroke="var(--cat-fixture)" stroke-width="0.5"/>'
            f'<line x1="{cx:.1f}" y1="8" x2="{cx:.1f}" y2="{h - 8:.1f}" '
            f'stroke="var(--cat-fixture)" stroke-width="0.25"/>'
            f'<line x1="8" y1="{cy:.1f}" x2="{w - 8:.1f}" y2="{cy:.1f}" '
            f'stroke="var(--cat-fixture)" stroke-width="0.25"/>'
        )

    def _kitchen(w: float, h: float) -> str:
        if symbol_kind == "fridge" or any(
            token in label_text for token in ("fridge", "refrigerator", "freezer")
        ):
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
                f'<line x1="{w / 2:.1f}" y1="4" x2="{w / 2:.1f}" y2="{h - 4:.1f}" '
                f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
                f'<line x1="{w * 0.72:.1f}" y1="{h * 0.22:.1f}" '
                f'x2="{w * 0.72:.1f}" y2="{h * 0.78:.1f}" '
                f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
                f'<line x1="{w * 0.18:.1f}" y1="{h * 0.64:.1f}" '
                f'x2="{w * 0.82:.1f}" y2="{h * 0.64:.1f}" '
                f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
            )
        if symbol_kind == "oven" or any(
            token in label_text for token in ("oven", "cooktop", "range", "hob")
        ):
            r = min(w, h) * 0.07
            rings = "".join(
                f'<circle cx="{cx:.1f}" cy="{h * 0.28:.1f}" r="{r:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.25"/>'
                for cx in (w * 0.3, w * 0.5, w * 0.7)
            )
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
                f"{rings}"
                f'<rect x="{w * 0.24:.1f}" y="{h * 0.52:.1f}" width="{w * 0.52:.1f}" '
                f'height="{h * 0.26:.1f}" fill="none" stroke="var(--draft-cut)" '
                f'stroke-width="0.25"/>'
            )
        if symbol_kind == "sink" or "sink" in label_text:
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'fill="none" stroke="var(--cat-fixture)" stroke-width="0.5"/>'
                f'<rect x="{w * 0.18:.1f}" y="{h * 0.24:.1f}" width="{w * 0.64:.1f}" '
                f'height="{h * 0.52:.1f}" rx="{min(w, h) * 0.08:.1f}" '
                f'fill="none" stroke="var(--cat-fixture)" stroke-width="0.25"/>'
                f'<circle cx="{w / 2:.1f}" cy="{h / 2:.1f}" r="{min(w, h) * 0.04:.1f}" '
                f'fill="none" stroke="var(--cat-fixture)" stroke-width="0.25"/>'
            )
        return _furniture(w, h)

    def _bathroom(w: float, h: float) -> str:
        if symbol_kind == "toilet" or any(
            token in label_text for token in ("toilet", "wc")
        ):
            r = min(w, h) * 0.22
            return (
                f'<rect x="{w * 0.28:.1f}" y="4" width="{w * 0.44:.1f}" '
                f'height="{h * 0.26:.1f}" fill="none" stroke="var(--cat-fixture)" '
                f'stroke-width="0.5"/>'
                f'<ellipse cx="{w / 2:.1f}" cy="{h * 0.62:.1f}" rx="{r:.1f}" '
                f'ry="{r * 1.25:.1f}" fill="none" stroke="var(--cat-fixture)" '
                f'stroke-width="0.5"/>'
            )
        if symbol_kind in {"bath", "shower"} or any(
            token in label_text for token in ("bath", "bathtub", "tub", "shower")
        ):
            return (
                f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
                f'rx="{min(w, h) * 0.08:.1f}" fill="none" stroke="var(--cat-fixture)" '
                f'stroke-width="0.5"/>'
                f'<line x1="{w * 0.18:.1f}" y1="{h * 0.22:.1f}" '
                f'x2="{w * 0.82:.1f}" y2="{h * 0.78:.1f}" '
                f'stroke="var(--cat-fixture)" stroke-width="0.25"/>'
            )
        return _plumbing(w, h)

    def _door(w: float, h: float) -> str:
        r = min(w, h) - 8
        return (
            f'<line x1="4" y1="4" x2="4" y2="{4 + r:.1f}" '
            f'stroke="var(--draft-cut)" stroke-width="0.5"/>'
            f'<line x1="4" y1="4" x2="{4 + r:.1f}" y2="4" '
            f'stroke="var(--draft-cut)" stroke-width="0.5"/>'
            f'<path d="M {4 + r:.1f} 4 A {r:.1f} {r:.1f} 0 0 0 4 {4 + r:.1f}" '
            f'fill="none" stroke="var(--draft-cut)" stroke-width="0.25" stroke-dasharray="1 1"/>'
        )

    def _window(w: float, h: float) -> str:
        mid = h / 2
        return (
            f'<rect x="4" y="{mid - 2:.1f}" width="{w - 8:.1f}" height="4" '
            f'fill="var(--surface-canvas)" stroke="var(--draft-cut)" stroke-width="0.5"/>'
            f'<line x1="4" y1="{mid:.1f}" x2="{w - 4:.1f}" y2="{mid:.1f}" '
            f'stroke="var(--draft-cut)" stroke-width="0.25"/>'
        )

    def _default(w: float, h: float) -> str:
        return (
            f'<rect x="4" y="4" width="{w - 8:.1f}" height="{h - 8:.1f}" '
            f'fill="none" stroke="var(--draft-cut)" stroke-width="0.5"/>'
        )

    _SYMBOL_MAP = {
        "furniture": _furniture,
        "casework": _furniture,
        "kitchen": _kitchen,
        "bathroom": _bathroom,
        "door": _door,
        "window": _window,
        "decal": _default,
        "profile": _default,
    }
    body = _SYMBOL_MAP.get(cat, _default)(w, h)

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'width="{w}" height="{h}" style="overflow:visible">'
        f"{body}"
        f"</svg>"
    )


# ---------------------------------------------------------------------------
# API-V3-01 tool descriptor registration (import-time side effect)
# ---------------------------------------------------------------------------

from bim_ai.api.registry import (  # noqa: E402
    ExitCode,
    RestEndpoint,
    ToolDescriptor,
    register,
)

_ASSET_CATEGORY_ENUM = [
    "furniture",
    "kitchen",
    "bathroom",
    "door",
    "window",
    "decal",
    "profile",
    "casework",
]

_ASSET_KIND_ENUM = ["family_instance", "block_2d", "kit", "decal", "profile"]
_ASSET_SYMBOL_KIND_ENUM = [
    "bed",
    "wardrobe",
    "lamp",
    "rug",
    "fridge",
    "oven",
    "sink",
    "counter",
    "sofa",
    "table",
    "chair",
    "toilet",
    "bath",
    "shower",
    "bathroom_layout",
    "generic",
]

_COMMON_EXIT_CODES: dict[str, ExitCode] = {
    "ok": ExitCode(code=0, meaning="Success"),
    "not_found": ExitCode(code=1, meaning="Referenced element not found"),
    "duplicate_id": ExitCode(code=2, meaning="Element id already exists"),
    "error": ExitCode(code=3, meaning="Unexpected error"),
}

register(
    ToolDescriptor(
        name="asset-index",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "IndexAssetInput",
            "type": "object",
            "required": ["name", "category"],
            "properties": {
                "id": {"type": "string", "description": "Optional deterministic id."},
                "assetKind": {
                    "type": "string",
                    "enum": _ASSET_KIND_ENUM,
                    "default": "block_2d",
                },
                "name": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "category": {"type": "string", "enum": _ASSET_CATEGORY_ENUM},
                "disciplineTags": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["arch", "struct", "mep"]},
                },
                "thumbnailKind": {
                    "type": "string",
                    "enum": ["schematic_plan", "rendered_3d"],
                    "default": "schematic_plan",
                },
                "thumbnailWidthMm": {"type": "number"},
                "thumbnailHeightMm": {"type": "number"},
                "planSymbolKind": {
                    "type": "string",
                    "enum": _ASSET_SYMBOL_KIND_ENUM,
                    "description": "Explicit 2D plan symbol renderer to use for placed instances.",
                },
                "renderProxyKind": {
                    "type": "string",
                    "enum": _ASSET_SYMBOL_KIND_ENUM,
                    "description": "Explicit lightweight 3D proxy renderer to use for placed instances.",
                },
                "paramSchema": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["key", "kind", "default"],
                        "properties": {
                            "key": {"type": "string"},
                            "kind": {
                                "type": "string",
                                "enum": ["mm", "enum", "material", "bool"],
                            },
                            "default": {},
                            "constraints": {},
                        },
                    },
                },
                "description": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "IndexAssetOutput",
            "type": "object",
            "required": ["id"],
            "properties": {"id": {"type": "string"}},
        },
        exitCodes=_COMMON_EXIT_CODES,
        cliExample="bim-ai asset index --name 'Kitchen Sink, Double Basin' --category kitchen --tags sink,plumbing",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Wraps an IndexAsset command in a CommandBundle. "
            "assetKind defaults to 'block_2d'; thumbnailKind defaults to 'schematic_plan'. "
            "No side-effects outside the target model's element store."
        ),
    )
)

register(
    ToolDescriptor(
        name="asset-search",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SearchAssetsInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "query": {
                    "type": "string",
                    "description": "Fuzzy search string over name + tags + description.",
                    "default": "",
                },
                "category": {"type": "string", "enum": _ASSET_CATEGORY_ENUM},
                "disciplineTag": {
                    "type": "string",
                    "enum": ["arch", "struct", "mep"],
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20,
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SearchAssetsOutput",
            "type": "object",
            "required": ["results"],
            "properties": {
                "results": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "name", "category"],
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "category": {"type": "string"},
                            "tags": {"type": "array", "items": {"type": "string"}},
                            "thumbnailKind": {"type": "string"},
                        },
                    },
                }
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Results returned (may be empty)"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai asset search --model <id> --query sink --category kitchen",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/assets/search"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only. Returns ranked asset entries. Empty query returns all entries up to limit.",
    )
)

register(
    ToolDescriptor(
        name="asset-place",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PlaceAssetInput",
            "type": "object",
            "required": ["assetId", "levelId", "positionMm"],
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "assetId": {
                    "type": "string",
                    "description": "Id of an AssetLibraryEntry element in this model.",
                },
                "levelId": {"type": "string"},
                "positionMm": {
                    "type": "object",
                    "required": ["xMm", "yMm"],
                    "properties": {
                        "xMm": {"type": "number"},
                        "yMm": {"type": "number"},
                    },
                },
                "rotationDeg": {"type": "number", "default": 0},
                "paramValues": {
                    "type": "object",
                    "description": "Override values for entries in the asset's paramSchema.",
                    "additionalProperties": True,
                },
                "hostElementId": {
                    "type": "string",
                    "description": "Optional host (wall, floor, counter) for associative snap.",
                },
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "PlaceAssetOutput",
            "type": "object",
            "required": ["id"],
            "properties": {"id": {"type": "string"}},
        },
        exitCodes=_COMMON_EXIT_CODES,
        cliExample="bim-ai asset place --asset <assetId> --level <levelId> --x 1500 --y 2000",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/bundles"),
        sideEffects="mutates-kernel",
        agentSafetyNotes=(
            "Wraps a PlaceAsset command in a CommandBundle. "
            "assetId must reference an existing AssetLibraryEntry in the same model. "
            "levelId must reference an existing Level. "
            "positionMm is in plan mm (1 mm = 1 mm real-world at 1:1)."
        ),
    )
)
