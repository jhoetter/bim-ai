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

    def _furniture(w: float, h: float) -> str:
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
        "kitchen": _plumbing,
        "bathroom": _plumbing,
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

from bim_ai.api.registry import ExitCode, RestEndpoint, ToolDescriptor, register  # noqa: E402

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
                "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
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
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/assets/search"),
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
