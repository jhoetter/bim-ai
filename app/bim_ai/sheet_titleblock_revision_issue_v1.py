"""Deterministic sheet titleblock revision/issue metadata (Prompt 4 slice)."""

from __future__ import annotations

import hashlib
from typing import Any

from bim_ai.elements import SheetElem

_TITLEBLOCK_EXPECTED_FIELDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("projectName", ("projectName", "project")),
    ("projectNumber", ("projectNumber",)),
    ("sheetName", ("sheetName",)),
    ("sheetNumber", ("sheetNumber", "sheetNo")),
    ("drawnBy", ("drawnBy",)),
    ("checkedBy", ("checkedBy",)),
    ("date", ("issueDate", "date")),
    ("revision", ("revisionCode", "revision")),
)

SHEET_TITLEBLOCK_REVISION_ISSUE_MANIFEST_V1 = "sheetTitleblockRevisionIssueManifest_v1"


def _str_param(tb: dict[str, Any], *keys: str) -> str:
    for k in keys:
        v = tb.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return ""


def normalize_titleblock_revision_issue_v1(tb: dict[str, Any] | None) -> dict[str, str]:
    """Trimmed canonical fields from titleblockParameters (camel + legacy aliases)."""

    raw = tb if isinstance(tb, dict) else {}
    revision_id = _str_param(raw, "revisionId", "revision_id")
    revision_code = _str_param(raw, "revisionCode", "revision")
    revision_date = _str_param(raw, "revisionDate", "revDate", "revision_date")
    revision_description = _str_param(
        raw, "revisionDescription", "revDescription", "revision_description"
    )
    issue_status = _str_param(raw, "issueStatus", "issue_status", "sheetIssueStatus")
    return {
        "revisionId": revision_id,
        "revisionCode": revision_code,
        "revisionDate": revision_date,
        "revisionDescription": revision_description,
        "issueStatus": issue_status,
    }


def revision_description_digest_prefix(description: str) -> str:
    if not description.strip():
        return ""
    return hashlib.sha256(description.encode("utf-8")).hexdigest()[:8]


def _segment_token_esc(value: str) -> str:
    s = " ".join(value.split())
    return s.replace("]", "?").replace("[", "(")


def _build_rev_iss_inner_token_string(norm: dict[str, str]) -> str:
    parts: list[str] = []
    if norm["revisionId"]:
        parts.append(f"id={_segment_token_esc(norm['revisionId'])}")
    if norm["revisionCode"]:
        parts.append(f"code={_segment_token_esc(norm['revisionCode'])}")
    if norm["revisionDate"]:
        parts.append(f"dt={_segment_token_esc(norm['revisionDate'])}")
    if norm["issueStatus"]:
        parts.append(f"iss={_segment_token_esc(norm['issueStatus'])}")
    d8 = revision_description_digest_prefix(norm["revisionDescription"])
    if d8:
        parts.append(f"d8={d8}")
    return " ".join(parts)


def format_sheet_rev_iss_titleblock_display_segment_v1(norm: dict[str, str]) -> str:
    inner = _build_rev_iss_inner_token_string(norm)
    if not inner:
        return ""
    return f"sheetRevIssDoc[{inner}]"


def format_sheet_rev_iss_export_listing_segment_v1(norm: dict[str, str]) -> str:
    inner = _build_rev_iss_inner_token_string(norm)
    if not inner:
        return ""
    return f"sheetRevIssList[{inner}]"


def sheet_revision_issue_metadata_present(norm: dict[str, str]) -> bool:
    return bool(norm.get("revisionId") or norm.get("revisionCode"))


def build_sheet_titleblock_revision_issue_manifest_v1(sh: SheetElem) -> dict[str, Any]:
    norm = normalize_titleblock_revision_issue_v1(sh.titleblock_parameters)
    d8 = revision_description_digest_prefix(norm["revisionDescription"])
    return {
        "format": SHEET_TITLEBLOCK_REVISION_ISSUE_MANIFEST_V1,
        "revisionId": norm["revisionId"],
        "revisionCode": norm["revisionCode"],
        "revisionDate": norm["revisionDate"],
        "revisionDescription": norm["revisionDescription"],
        "issueStatus": norm["issueStatus"],
        "revisionDescriptionDigestPrefix8": d8,
        "titleblockDisplaySegment": format_sheet_rev_iss_titleblock_display_segment_v1(norm),
        "exportListingSegment": format_sheet_rev_iss_export_listing_segment_v1(norm),
    }


def titleblockFieldCompleteness_v1(sh: SheetElem) -> dict[str, Any]:
    """Expected vs populated titleblock fields with coverage percentage (WP-E05 hardening)."""
    tb = sh.titleblock_parameters or {}
    fields: list[dict[str, Any]] = []

    for field_name, keys in _TITLEBLOCK_EXPECTED_FIELDS:
        value = ""
        if field_name == "sheetName":
            value = (sh.name or "").strip()
        else:
            for k in keys:
                v = tb.get(k)
                if v is not None:
                    s = str(v).strip()
                    if s:
                        value = s
                        break
        fields.append({"field": field_name, "populated": bool(value), "value": value})

    total = len(fields)
    populated = sum(1 for f in fields if f["populated"])
    coverage_pct = round(100.0 * populated / total, 1) if total > 0 else 0.0

    return {
        "format": "titleblockFieldCompleteness_v1",
        "sheetId": sh.id,
        "fields": fields,
        "populatedCount": populated,
        "totalCount": total,
        "coveragePercent": coverage_pct,
    }


def surrogate_payload_revision_issue_tail(norm: dict[str, str]) -> str:
    """Appendix block for print-surrogate titleblock digest (deterministic line order)."""

    disp = format_sheet_rev_iss_titleblock_display_segment_v1(norm)
    lst = format_sheet_rev_iss_export_listing_segment_v1(norm)
    lines = (
        "sheetRevisionIssue_v1",
        norm["revisionId"],
        norm["revisionCode"],
        norm["revisionDate"],
        norm["revisionDescription"],
        norm["issueStatus"],
        disp,
        lst,
    )
    return "\n".join(lines)
