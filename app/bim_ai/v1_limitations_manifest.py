"""Deterministic v1 limitations manifest (prompt-5 / WP-A02, WP-X06).

Emits an explicit 'not in v1' ledger: deferred workpackages, PRD §16 non-goals,
and parity dashboard partial areas. Content is curated as in-module constants —
do NOT derive at runtime from tracker or PRD files; this is the audited closeout
statement.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

# ---------------------------------------------------------------------------
# Curated constants
# ---------------------------------------------------------------------------

_SCHEMA_VERSION: int = 1

_DEFERRED_WORKPACKAGES: list[dict[str, str]] = [
    {
        "id": "WP-X06",
        "title": "RVT bridge",
        "reason": (
            "Explicitly deferred from v1 wave. RVT-native (.rvt) file import/export is "
            "blocked pending OpenBIM semantics stabilisation. Aligns with PRD §16 "
            "non-goal: 'Do not implement RVT native import/export before OpenBIM "
            "semantics stabilize.'"
        ),
    },
    {
        "id": "WP-X03-unconstrained-merge",
        "title": "Unconstrained IFC merge",
        "reason": (
            "Arbitrary IFC merge without collision/reference preflight is deferred. "
            "Only authoritative replay slices with validated identity mappings are "
            "supported in v1; unconstrained merge remains out of scope."
        ),
    },
    {
        "id": "WP-P02",
        "title": "Collaboration model",
        "reason": (
            "Real-time multi-user collaboration and live sync are out of v1 scope. "
            "The collaboration model workpackage remains at stub/design level pending "
            "a dedicated implementation wave."
        ),
    },
]

# Verbatim from PRD §16 "Non-Goals and Guardrails"
_NON_GOALS: list[str] = [
    "Do not clone Revit UI pixels or proprietary behavior.",
    "Do not introduce a second drawing-only source of truth for documentation.",
    "Do not treat screenshots as static mockups; they express product workflows and artifacts.",
    "Do not hide missing engine behavior behind fake UI panels.",
    "Do not implement RVT native import/export before OpenBIM semantics stabilize.",
    "Do not let AI write unreviewed model mutations outside the command path.",
]

# Mirrored from parity dashboard rows that remain `partial` at v1 closeout
_PARTIAL_AREAS: list[dict[str, str]] = [
    {"area": "Evidence baseline", "parityRead": "~62%"},
    {"area": "Residential semantic kernel", "parityRead": "~42%"},
    {"area": "Production plan views", "parityRead": "~60%"},
    {"area": "Families/types/materials/schedules", "parityRead": "~50%"},
    {"area": "Sections/3D/sheets/export", "parityRead": "~62%"},
    {"area": "AI-agent production loop", "parityRead": "~42%"},
    {"area": "OpenBIM exchange", "parityRead": "~55%"},
    {"area": "Validation/advisor", "parityRead": "~48%"},
    {"area": "Performance/collaboration", "parityRead": "~42%"},
]


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------


def build_v1_limitations_manifest_v1() -> dict[str, Any]:
    """Return a deterministic ``v1LimitationsManifest_v1`` token.

    Pure function — no document arg, no file I/O. All content is sourced from
    the in-module curated constants above.
    """
    body: dict[str, Any] = {
        "format": "v1LimitationsManifest_v1",
        "schemaVersion": _SCHEMA_VERSION,
        "deferredWorkpackages": sorted(_DEFERRED_WORKPACKAGES, key=lambda r: r["id"]),
        "nonGoals": list(_NON_GOALS),
        "partialAreas": list(_PARTIAL_AREAS),
    }

    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**body, "aggregateDigest": digest}
