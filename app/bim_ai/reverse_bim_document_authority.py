"""Document authority and supersession checks for reverse-BIM source folders."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from typing import Any


CRITICAL_DOCUMENT_ROLES = {
    "floor_plan",
    "section",
    "elevation",
    "site_plan",
    "area_calculation",
}

ROLE_BASE_SCORES = {
    "floor_plan": 70.0,
    "section": 68.0,
    "elevation": 66.0,
    "site_plan": 65.0,
    "area_calculation": 64.0,
    "construction_description": 54.0,
    "drainage_doc": 52.0,
    "energy_doc": 48.0,
    "legal_admin": 45.0,
    "photo": 36.0,
    "unknown": 10.0,
}

LEVEL_SCOPE_TOKENS = (
    "kg",
    "ug",
    "eg",
    "dg",
    "og",
    "erdgeschoss",
    "dachgeschoss",
    "kellergeschoss",
    "keller",
    "untergeschoss",
    "obergeschoss",
)

ELEVATION_SCOPE_TOKENS = (
    "nord",
    "sued",
    "sud",
    "ost",
    "west",
    "front",
    "rear",
    "left",
    "right",
)


def build_reverse_bim_document_authority_report(
    *,
    manifest: dict[str, Any] | list[dict[str, Any]] | None = None,
    classifications: dict[str, Any] | list[dict[str, Any]] | None = None,
    facts: list[dict[str, Any]] | None = None,
    authority_hints: list[dict[str, Any]] | dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Rank source documents and expose unresolved authority conflicts.

    The report is intentionally deterministic. AI readers may provide authority
    hints, but this helper only normalizes and checks those hints; it does not
    call a model and it does not mutate BIM state.
    """

    file_index = {
        str(row.get("sourceDocumentId") or row.get("documentId") or ""): row
        for row in _manifest_files(manifest)
        if isinstance(row, dict)
    }
    hint_index = _authority_hint_index(authority_hints)
    facts_by_document = _facts_by_document(facts or [])
    rows = []
    for doc in _classification_rows(classifications, file_index):
        doc_id = str(doc.get("sourceDocumentId") or doc.get("documentId") or "")
        file_row = file_index.get(doc_id, {})
        hint = hint_index.get(doc_id) or hint_index.get(str(doc.get("relativePath") or ""))
        row = _document_row(
            classification=doc,
            file_row=file_row,
            hint=hint,
            fact_count=len(facts_by_document.get(doc_id, [])),
        )
        rows.append(row)

    if not rows:
        for file_row in file_index.values():
            doc_id = str(file_row.get("sourceDocumentId") or "")
            hint = hint_index.get(doc_id) or hint_index.get(str(file_row.get("relativePath") or ""))
            rows.append(
                _document_row(
                    classification={},
                    file_row=file_row,
                    hint=hint,
                    fact_count=len(facts_by_document.get(doc_id, [])),
                )
            )

    groups = _authority_groups(rows)
    findings = _authority_findings(groups)
    blocker_count = sum(1 for row in findings if row.get("severity") == "error")
    status_counts = Counter(str(row.get("authorityStatus") or "unknown") for row in rows)
    role_counts = Counter(str(row.get("role") or "unknown") for row in rows)
    payload = {
        "ok": blocker_count == 0,
        "format": "reverseBimDocumentAuthorityReport_v1",
        "summary": {
            "documentCount": len(rows),
            "authorityGroupCount": len(groups),
            "criticalGroupCount": sum(1 for row in groups if row.get("critical")),
            "unresolvedGroupCount": sum(1 for row in groups if row.get("status") == "unresolved"),
            "blockerCount": blocker_count,
            "statusCounts": dict(sorted(status_counts.items())),
            "roleCounts": dict(sorted(role_counts.items())),
            "authoritativeByRole": _authoritative_by_role(groups),
        },
        "documents": sorted(rows, key=lambda row: (str(row.get("groupKey")), -float(row.get("authorityScore") or 0))),
        "groups": groups,
        "findings": findings,
        "nextStep": (
            "Document authority is resolved for source preflight."
            if blocker_count == 0
            else "Resolve authoritative documents or provide authority hints before source facts drive MCP authoring."
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def _document_row(
    *,
    classification: dict[str, Any],
    file_row: dict[str, Any],
    hint: dict[str, Any] | None,
    fact_count: int,
) -> dict[str, Any]:
    doc_id = str(
        classification.get("sourceDocumentId")
        or classification.get("documentId")
        or file_row.get("sourceDocumentId")
        or ""
    )
    relative_path = str(classification.get("relativePath") or file_row.get("relativePath") or "")
    source_path = classification.get("sourcePath") or file_row.get("absolutePath")
    role = str(
        (hint or {}).get("role")
        or (hint or {}).get("classification")
        or classification.get("classification")
        or "unknown"
    )
    normalized = _normalize_search_text(relative_path)
    scope_tokens = _scope_tokens(role, normalized)
    revision_number = _revision_number(normalized, hint)
    issue_date = _issue_date(normalized, hint)
    explicit_status = str((hint or {}).get("status") or "").lower()
    authority_rank = (hint or {}).get("authorityRank")
    score = _authority_score(
        role=role,
        classification_confidence=classification.get("confidence"),
        revision_number=revision_number,
        issue_date=issue_date,
        authority_rank=authority_rank,
        explicit_status=explicit_status,
        fact_count=fact_count,
    )
    group_key = f"{role}:{','.join(scope_tokens) if scope_tokens else 'general'}"
    return {
        "sourceDocumentId": doc_id,
        "relativePath": relative_path,
        "sourcePath": source_path,
        "role": role,
        "groupKey": group_key,
        "scopeTokens": scope_tokens,
        "classificationConfidence": classification.get("confidence"),
        "kind": classification.get("kind") or file_row.get("kind"),
        "sha256": file_row.get("sha256"),
        "sizeBytes": file_row.get("sizeBytes"),
        "mtimeMs": file_row.get("mtimeMs"),
        "factCount": fact_count,
        "revisionNumber": revision_number,
        "issueDate": issue_date,
        "authorityScore": round(score, 3),
        "authorityStatus": "candidate",
        "supersedes": _string_list((hint or {}).get("supersedes")),
        "supersededBy": None,
        "explicitStatus": explicit_status or None,
        "authorityHint": hint or None,
        "authorityReasons": _authority_reasons(
            role=role,
            revision_number=revision_number,
            issue_date=issue_date,
            explicit_status=explicit_status,
            authority_rank=authority_rank,
            fact_count=fact_count,
        ),
    }


def _authority_groups(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_group[str(row.get("groupKey") or "unknown:general")].append(row)

    groups = []
    for group_key, group_rows in sorted(by_group.items()):
        sorted_rows = sorted(
            group_rows,
            key=lambda row: (
                _status_sort_weight(str(row.get("explicitStatus") or "")),
                -float(row.get("authorityScore") or 0),
                str(row.get("relativePath") or ""),
            ),
        )
        primary = _first_non_suppressed(sorted_rows)
        role = str(sorted_rows[0].get("role") or "unknown")
        critical = role in CRITICAL_DOCUMENT_ROLES
        unresolved = _group_unresolved(sorted_rows, primary=primary, critical=critical)
        authoritative_id = primary.get("sourceDocumentId") if primary else None
        for row in sorted_rows:
            _apply_group_status(row, primary=primary, unresolved=unresolved, group_rows=sorted_rows)
        groups.append(
            {
                "groupKey": group_key,
                "role": role,
                "scopeTokens": sorted_rows[0].get("scopeTokens") or [],
                "critical": critical,
                "status": "unresolved" if unresolved else "resolved",
                "authoritativeDocumentId": authoritative_id,
                "documentIds": [row.get("sourceDocumentId") for row in sorted_rows],
                "candidateCount": len(sorted_rows),
                "topScore": primary.get("authorityScore") if primary else None,
                "blockingReason": (
                    "critical document authority tie or missing explicit authority"
                    if unresolved
                    else None
                ),
            }
        )
    return groups


def _apply_group_status(
    row: dict[str, Any],
    *,
    primary: dict[str, Any] | None,
    unresolved: bool,
    group_rows: list[dict[str, Any]],
) -> None:
    explicit_status = str(row.get("explicitStatus") or "")
    if explicit_status in {"context", "supplemental"}:
        row["authorityStatus"] = "supplemental"
        return
    if explicit_status in {"superseded", "deprecated", "void"}:
        row["authorityStatus"] = "superseded"
        row["supersededBy"] = primary.get("sourceDocumentId") if primary else None
        return
    if primary is None:
        row["authorityStatus"] = "candidate"
        return
    if row.get("sourceDocumentId") == primary.get("sourceDocumentId"):
        row["authorityStatus"] = "ambiguous" if unresolved else "authoritative"
        return
    if row.get("sha256") and row.get("sha256") == primary.get("sha256"):
        row["authorityStatus"] = "duplicate"
        row["supersededBy"] = primary.get("sourceDocumentId")
        return
    if primary.get("sourceDocumentId") in _string_list(row.get("supersedes")):
        row["authorityStatus"] = "candidate"
        return
    if _row_explicitly_supersedes_primary(row, primary, group_rows):
        row["authorityStatus"] = "candidate"
        return
    row["authorityStatus"] = "ambiguous" if unresolved else "superseded"
    row["supersededBy"] = primary.get("sourceDocumentId")


def _group_unresolved(
    rows: list[dict[str, Any]],
    *,
    primary: dict[str, Any] | None,
    critical: bool,
) -> bool:
    if not critical or not primary:
        return False
    active = [
        row
        for row in rows
        if str(row.get("explicitStatus") or "") not in {"context", "supplemental", "superseded", "deprecated", "void"}
    ]
    if len(active) <= 1:
        return False
    if any(str(row.get("explicitStatus") or "") == "authoritative" for row in active):
        return False
    top = float(primary.get("authorityScore") or 0)
    tied = [row for row in active if abs(float(row.get("authorityScore") or 0) - top) < 2.0]
    return len(tied) > 1


def _authority_findings(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    findings = []
    for group in groups:
        if group.get("status") == "unresolved":
            findings.append(
                {
                    "severity": "error",
                    "code": "document_authority_unresolved",
                    "groupKey": group.get("groupKey"),
                    "documentIds": group.get("documentIds") or [],
                    "message": (
                        "Critical reverse-BIM document group has multiple plausible authoritative documents. "
                        "A reader or operator must select authority before modeling."
                    ),
                }
            )
    return findings


def _authoritative_by_role(groups: list[dict[str, Any]]) -> dict[str, list[str]]:
    by_role: dict[str, list[str]] = defaultdict(list)
    for group in groups:
        doc_id = group.get("authoritativeDocumentId")
        if group.get("status") == "resolved" and doc_id:
            by_role[str(group.get("role") or "unknown")].append(str(doc_id))
    return {role: sorted(ids) for role, ids in sorted(by_role.items())}


def _first_non_suppressed(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    for row in rows:
        if str(row.get("explicitStatus") or "") not in {"context", "supplemental", "superseded", "deprecated", "void"}:
            return row
    return rows[0] if rows else None


def _status_sort_weight(status: str) -> int:
    if status == "authoritative":
        return 0
    if status in {"context", "supplemental"}:
        return 5
    if status in {"superseded", "deprecated", "void"}:
        return 8
    return 2


def _row_explicitly_supersedes_primary(
    row: dict[str, Any],
    primary: dict[str, Any],
    group_rows: list[dict[str, Any]],
) -> bool:
    primary_id = str(primary.get("sourceDocumentId") or "")
    row_id = str(row.get("sourceDocumentId") or "")
    if primary_id in _string_list(row.get("supersedes")):
        return True
    for candidate in group_rows:
        if row_id in _string_list(candidate.get("supersedes")):
            return False
    return False


def _authority_score(
    *,
    role: str,
    classification_confidence: Any,
    revision_number: int | None,
    issue_date: int | None,
    authority_rank: Any,
    explicit_status: str,
    fact_count: int,
) -> float:
    score = ROLE_BASE_SCORES.get(role, 10.0)
    if isinstance(classification_confidence, int | float):
        score += float(classification_confidence) * 10.0
    if revision_number is not None:
        if revision_number >= 1900:
            score += (revision_number - 1900) * 0.25
        else:
            score += min(revision_number, 99) * 0.25
    if issue_date is not None:
        score += (issue_date // 10000 - 1900) * 0.25
    if fact_count:
        score += min(fact_count, 20) * 0.1
    if isinstance(authority_rank, int | float):
        score += max(0.0, 50.0 - float(authority_rank))
    if explicit_status == "authoritative":
        score += 100.0
    if explicit_status in {"superseded", "deprecated", "void"}:
        score -= 100.0
    if explicit_status in {"context", "supplemental"}:
        score -= 40.0
    return score


def _authority_reasons(
    *,
    role: str,
    revision_number: int | None,
    issue_date: int | None,
    explicit_status: str,
    authority_rank: Any,
    fact_count: int,
) -> list[str]:
    reasons = [f"role={role}"]
    if revision_number is not None:
        reasons.append(f"revisionNumber={revision_number}")
    if issue_date is not None:
        reasons.append(f"issueDate={issue_date}")
    if explicit_status:
        reasons.append(f"hintStatus={explicit_status}")
    if isinstance(authority_rank, int | float):
        reasons.append(f"authorityRank={authority_rank}")
    if fact_count:
        reasons.append(f"sourceFactCount={fact_count}")
    return reasons


def _scope_tokens(role: str, normalized_path: str) -> list[str]:
    tokens = []
    if role in {"floor_plan", "area_calculation"}:
        tokens.extend(token for token in LEVEL_SCOPE_TOKENS if re.search(rf"\b{token}\b", normalized_path))
    if role in {"elevation", "section"}:
        tokens.extend(token for token in ELEVATION_SCOPE_TOKENS if re.search(rf"\b{token}\b", normalized_path))
    if role == "site_plan":
        tokens.extend(token for token in ("lageplan", "site", "parcel", "flurkarte", "kataster") if token in normalized_path)
    return sorted(set(tokens))


def _revision_number(normalized_path: str, hint: dict[str, Any] | None) -> int | None:
    raw = (hint or {}).get("revisionNumber") or (hint or {}).get("revision")
    if isinstance(raw, int):
        return raw
    if isinstance(raw, str) and raw.isdigit():
        return int(raw)
    candidates = []
    for match in re.finditer(r"\b(?:rev|revision|index|stand|version|v)\s*[-_ ]?(\d{1,3})\b", normalized_path):
        candidates.append(int(match.group(1)))
    for match in re.finditer(r"\b(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})\b", normalized_path):
        year = int(match.group(1))
        if 1900 <= year <= 2200:
            candidates.append(year)
    return max(candidates) if candidates else None


def _issue_date(normalized_path: str, hint: dict[str, Any] | None) -> int | None:
    raw = (hint or {}).get("issueDate") or (hint or {}).get("date")
    parsed = _parse_date_token(str(raw)) if raw else None
    if parsed:
        return parsed
    dates = []
    for match in re.finditer(r"\b(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})\b", normalized_path):
        dates.append(int(f"{match.group(1)}{match.group(2)}{match.group(3)}"))
    for match in re.finditer(r"\b(\d{2})[-_. ](\d{2})[-_. ](\d{4})\b", normalized_path):
        dates.append(int(f"{match.group(3)}{match.group(2)}{match.group(1)}"))
    return max(dates) if dates else None


def _parse_date_token(value: str) -> int | None:
    normalized = _normalize_search_text(value)
    match = re.search(r"\b(\d{4})[-_. ]?(\d{2})[-_. ]?(\d{2})\b", normalized)
    if match:
        return int(f"{match.group(1)}{match.group(2)}{match.group(3)}")
    match = re.search(r"\b(\d{2})[-_. ](\d{2})[-_. ](\d{4})\b", normalized)
    if match:
        return int(f"{match.group(3)}{match.group(2)}{match.group(1)}")
    return None


def _manifest_files(value: dict[str, Any] | list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if not isinstance(value, dict):
        return []
    rows = value.get("files") or value.get("documents") or []
    return [row for row in rows if isinstance(row, dict)]


def _classification_rows(
    classifications: dict[str, Any] | list[dict[str, Any]] | None,
    file_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    if isinstance(classifications, list):
        return [row for row in classifications if isinstance(row, dict)]
    if isinstance(classifications, dict):
        rows = classifications.get("documents") or classifications.get("rows") or []
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return [
        {
            "sourceDocumentId": row.get("sourceDocumentId"),
            "relativePath": row.get("relativePath"),
            "sourcePath": row.get("absolutePath"),
            "kind": row.get("kind"),
            "classification": "unknown",
            "confidence": 0.0,
        }
        for row in file_index.values()
    ]


def _authority_hint_index(value: list[dict[str, Any]] | dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    hints = []
    if isinstance(value, list):
        hints = [row for row in value if isinstance(row, dict)]
    elif isinstance(value, dict):
        raw = value.get("hints") or value.get("documents") or value.get("rows") or []
        if isinstance(raw, list):
            hints = [row for row in raw if isinstance(row, dict)]
    index: dict[str, dict[str, Any]] = {}
    for row in hints:
        for key in ("sourceDocumentId", "documentId", "relativePath", "sourcePath"):
            value_for_key = row.get(key)
            if value_for_key:
                index[str(value_for_key)] = row
    return index


def _facts_by_document(facts: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by_document: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        provenance = fact.get("provenance") if isinstance(fact.get("provenance"), dict) else {}
        doc_id = fact.get("sourceDocumentId") or provenance.get("sourceDocumentId")
        if doc_id:
            by_document[str(doc_id)].append(fact)
    return by_document


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if value:
        return [str(value)]
    return []


def _normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return (
        asciiish.replace("ß", "ss")
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .lower()
    )


def _digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
