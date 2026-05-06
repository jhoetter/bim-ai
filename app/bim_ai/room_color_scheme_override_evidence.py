"""Room color scheme override authoring evidence (prompt-2 v1 closeout)."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import RoomColorSchemeElem, RoomColorSchemeRow, RoomElem

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

_REQUIRED_LABEL_SOURCES = ("programme_code", "department")


def _override_key(row: RoomColorSchemeRow) -> tuple[str, str]:
    prog = (row.programme_code or "").strip().lower()
    dept = (row.department or "").strip().lower()
    return (prog, dept)


def _label_for_row(row: RoomColorSchemeRow) -> str:
    pc = (row.programme_code or "").strip()
    dept = (row.department or "").strip()
    return pc or dept or ""


def _validate_hex(hex_str: str) -> str | None:
    """Return canonical '#RRGGBB' or None if invalid."""
    s = str(hex_str).strip()
    if not _HEX_RE.match(s):
        return None
    return f"#{s[1:].upper()}"


def build_room_color_scheme_override_evidence_v1(
    scheme_elem: RoomColorSchemeElem | None,
) -> dict[str, Any]:
    """Deterministic evidence for room color scheme overrides authored via ``upsertRoomColorScheme``.

    Returns a dict with ``format``, ``schemeIdentity``, deterministic ``rows`` (sorted by
    canonical key), ``rowDigestSha256``, ``overrideRowCount``, and any ``advisoryFindings``.
    This is persistence evidence only — no room derivation or area semantics are touched.
    """
    if scheme_elem is None:
        return {
            "format": "roomColorSchemeOverrideEvidence_v1",
            "schemeIdentity": None,
            "overrideRowCount": 0,
            "rows": [],
            "rowDigestSha256": _digest([]),
            "advisoryFindings": [
                {
                    "code": "room_color_scheme_identity_missing",
                    "severity": "info",
                    "message": "No room color scheme element found. Use upsertRoomColorScheme to author overrides.",
                }
            ],
        }

    scheme_id = str(scheme_elem.id).strip()
    raw_rows = list(scheme_elem.scheme_rows)

    seen_keys: dict[tuple[str, str], int] = {}
    canonical: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []

    for idx, row in enumerate(raw_rows):
        key = _override_key(row)
        label = _label_for_row(row)
        hex_val = _validate_hex(row.scheme_color_hex)
        order_index = idx

        row_findings: list[str] = []

        if not label:
            row_findings.append("room_color_scheme_row_missing_label")

        if hex_val is None:
            row_findings.append("room_color_scheme_row_invalid_fill_color")
            hex_val = "#888888"

        if key in seen_keys:
            row_findings.append("room_color_scheme_row_duplicate_override_key")
            findings.append(
                {
                    "code": "room_color_scheme_row_duplicate_override_key",
                    "severity": "warning",
                    "message": (
                        f"Duplicate override key (programmeCode={row.programme_code!r}, "
                        f"department={row.department!r}) at position {order_index}; "
                        f"first seen at position {seen_keys[key]}."
                    ),
                    "overrideKey": {
                        "programmeCode": row.programme_code,
                        "department": row.department,
                    },
                }
            )
        else:
            seen_keys[key] = order_index

        for fc in row_findings:
            if fc != "room_color_scheme_row_duplicate_override_key":
                findings.append(
                    {
                        "code": fc,
                        "severity": "warning",
                        "message": _finding_message(fc, row, order_index),
                        "overrideKey": {
                            "programmeCode": row.programme_code,
                            "department": row.department,
                        },
                    }
                )

        canonical.append(
            {
                "programmeCode": (row.programme_code or "").strip() or None,
                "department": (row.department or "").strip() or None,
                "label": label or None,
                "schemeColorHex": hex_val,
                "orderIndex": order_index,
                "advisoryCodes": row_findings,
            }
        )

    canonical.sort(key=lambda r: _override_key_from_dict(r))
    for i, row in enumerate(canonical):
        row["orderIndex"] = i

    return {
        "format": "roomColorSchemeOverrideEvidence_v1",
        "schemeIdentity": scheme_id,
        "overrideRowCount": len(canonical),
        "rows": canonical,
        "rowDigestSha256": _digest(canonical),
        "advisoryFindings": findings,
    }


def _override_key_from_dict(row: dict[str, Any]) -> tuple[str, str]:
    prog = str(row.get("programmeCode") or "").lower()
    dept = str(row.get("department") or "").lower()
    return (prog, dept)


def _digest(rows: list[dict[str, Any]]) -> str:
    blob = json.dumps(rows, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _finding_message(code: str, row: RoomColorSchemeRow, idx: int) -> str:
    if code == "room_color_scheme_row_missing_label":
        return (
            f"Override row at position {idx} has neither programmeCode nor department; "
            "a label is required for legend readout."
        )
    if code == "room_color_scheme_row_invalid_fill_color":
        return (
            f"Override row at position {idx} has an invalid schemeColorHex value "
            f"({row.scheme_color_hex!r}); expected '#RRGGBB'."
        )
    return f"Override row at position {idx}: {code}."


def scheme_override_advisory_violations_for_doc(
    scheme_elem: RoomColorSchemeElem | None,
) -> list[dict[str, Any]]:
    """Return constraint-style advisor violation dicts for room color scheme override rows.

    These are injected into ``constraints`` so that existing advisor pathways surface them.
    """
    ev = build_room_color_scheme_override_evidence_v1(scheme_elem)
    return list(ev.get("advisoryFindings") or [])


def legend_rows_from_scheme_overrides(
    scheme_rows: Iterable[RoomColorSchemeRow],
) -> list[dict[str, Any]]:
    """Deterministic legend rows from authored override rows, sorted by canonical key."""
    seen: dict[tuple[str, str], dict[str, Any]] = {}
    for row in scheme_rows:
        key = _override_key(row)
        label = _label_for_row(row)
        hex_val = _validate_hex(row.scheme_color_hex) or "#888888"
        if key not in seen:
            entry: dict[str, Any] = {"label": label, "schemeColorHex": hex_val}
            if (row.programme_code or "").strip():
                entry["programmeCode"] = (row.programme_code or "").strip()
            if (row.department or "").strip():
                entry["department"] = (row.department or "").strip()
            seen[key] = entry
    return sorted(
        seen.values(), key=lambda r: (str(r.get("label", "")), str(r.get("schemeColorHex", "")))
    )


def _room_area_m2(room: RoomElem) -> float:
    pts = room.outline_mm
    n = len(pts)
    if n < 3:
        return 0.0
    a = 0.0
    for i in range(n):
        p = pts[i]
        q = pts[(i + 1) % n]
        a += p.x_mm * q.y_mm - q.x_mm * p.y_mm
    return abs(a / 2.0) / 1_000_000.0


def roomColourSchemeLegendEvidence_v1(doc: Document) -> dict[str, Any]:
    """Deterministic legend manifest: scheme name → sorted list of matching rooms with area.

    Returns a dict with ``format``, ``schemeIdentity``, ``legendRows`` (sorted by canonical
    key), ``legendRowCount``, and ``legendDigestSha256``.  Same doc always yields same digest.
    """
    scheme_elem: RoomColorSchemeElem | None = next(
        (e for e in doc.elements.values() if isinstance(e, RoomColorSchemeElem)),
        None,
    )
    scheme_id = scheme_elem.id if scheme_elem else None
    scheme_rows_list = list(scheme_elem.scheme_rows) if scheme_elem else []
    rooms = [e for e in doc.elements.values() if isinstance(e, RoomElem)]

    legend_entries: list[dict[str, Any]] = []
    for sr in scheme_rows_list:
        key_prog = (sr.programme_code or "").strip().lower()
        key_dept = (sr.department or "").strip().lower()
        hex_val = _validate_hex(sr.scheme_color_hex) or "#888888"
        label = _label_for_row(sr)

        matching_rooms: list[dict[str, Any]] = []
        for rm in rooms:
            rm_prog = (rm.programme_code or "").strip().lower()
            rm_dept = (rm.department or "").strip().lower()
            matched = False
            if key_prog and rm_prog == key_prog:
                matched = True
            if key_dept and rm_dept == key_dept:
                matched = True
            if not matched:
                continue
            area = _room_area_m2(rm)
            matching_rooms.append(
                {
                    "roomId": rm.id,
                    "roomName": rm.name,
                    "areaM2": round(area, 3),
                }
            )
        matching_rooms.sort(key=lambda r: (str(r["roomName"]), str(r["roomId"])))

        legend_entries.append(
            {
                "colourHex": hex_val,
                "label": label or None,
                "programmeCode": (sr.programme_code or "").strip() or None,
                "department": (sr.department or "").strip() or None,
                "matchingRooms": matching_rooms,
                "totalAreaM2": round(sum(r["areaM2"] for r in matching_rooms), 3),
            }
        )

    legend_entries.sort(key=lambda r: (str(r.get("label") or ""), str(r.get("colourHex") or "")))
    digest = hashlib.sha256(
        json.dumps(legend_entries, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

    return {
        "format": "roomColourSchemeLegendEvidence_v1",
        "schemeIdentity": scheme_id,
        "legendRowCount": len(legend_entries),
        "legendRows": legend_entries,
        "legendDigestSha256": digest,
    }
