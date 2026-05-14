from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    ConstructionLogisticsElem,
    ConstructionPackageElem,
    ConstructionQaChecklistElem,
    ConstructabilityIssueElem,
    EvidenceRef,
    IssueElem,
    PhaseElem,
)

CONSTRUCTION_PROGRESS_STATUSES = {
    "not_started",
    "in_progress",
    "installed",
    "inspected",
    "accepted",
}

CONSTRUCTION_LOGISTICS_KINDS = {
    "temporary_partition",
    "scaffolding_zone",
    "crane_lift_zone",
    "laydown_area",
    "access_route",
    "site_safety_zone",
}

CONSTRUCTION_METADATA_KEY = "construction"


def construction_metadata_for_element(elem: object) -> dict[str, Any]:
    props = getattr(elem, "props", None)
    if not isinstance(props, dict):
        return {}
    raw = props.get(CONSTRUCTION_METADATA_KEY)
    return dict(raw) if isinstance(raw, dict) else {}


def normalized_construction_metadata(raw: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in (
        "constructionPackageId",
        "plannedStart",
        "plannedEnd",
        "actualStart",
        "actualEnd",
        "installationSequence",
        "progressStatus",
        "responsibleCompany",
    ):
        value = raw.get(key)
        if value not in (None, ""):
            out[key] = value
    status = str(out.get("progressStatus") or "").strip()
    if status:
        if status not in CONSTRUCTION_PROGRESS_STATUSES:
            raise ValueError(
                "progressStatus must be not_started|in_progress|installed|inspected|accepted"
            )
        out["progressStatus"] = status
    for list_key in ("dependencies", "issueIds", "punchItemIds"):
        value = raw.get(list_key)
        if isinstance(value, list):
            out[list_key] = [str(x).strip() for x in value if str(x).strip()]
    evidence = raw.get("evidenceRefs")
    if isinstance(evidence, list):
        out["evidenceRefs"] = [
            ref.model_dump(by_alias=True, exclude_none=True)
            if isinstance(ref, EvidenceRef)
            else dict(ref)
            for ref in evidence
            if isinstance(ref, EvidenceRef | dict)
        ]
    checklist = raw.get("inspectionChecklist")
    if isinstance(checklist, list):
        out["inspectionChecklist"] = [dict(x) for x in checklist if isinstance(x, dict)]
    return out


def set_element_construction_metadata(elem: object, metadata: dict[str, Any]) -> object:
    props = dict(getattr(elem, "props", None) or {})
    props[CONSTRUCTION_METADATA_KEY] = normalized_construction_metadata(metadata)
    return elem.model_copy(update={"props": props})  # type: ignore[attr-defined]


def construction_progress_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for elem in doc.elements.values():
        meta = construction_metadata_for_element(elem)
        if not meta:
            continue
        rows.append(
            {
                "elementId": getattr(elem, "id", ""),
                "name": getattr(elem, "name", "") or getattr(elem, "id", ""),
                "kind": getattr(elem, "kind", ""),
                "phaseCreated": getattr(elem, "phase_created", None) or "",
                "phaseDemolished": getattr(elem, "phase_demolished", None) or "",
                "constructionPackageId": meta.get("constructionPackageId", ""),
                "plannedStart": meta.get("plannedStart", ""),
                "plannedEnd": meta.get("plannedEnd", ""),
                "actualStart": meta.get("actualStart", ""),
                "actualEnd": meta.get("actualEnd", ""),
                "installationSequence": meta.get("installationSequence", ""),
                "dependencies": "; ".join(meta.get("dependencies", []) or []),
                "progressStatus": meta.get("progressStatus", "not_started"),
                "responsibleCompany": meta.get("responsibleCompany", ""),
                "evidenceCount": len(meta.get("evidenceRefs", []) or []),
                "issueCount": len(meta.get("issueIds", []) or []),
                "punchItemCount": len(meta.get("punchItemIds", []) or []),
                "checklistItemCount": len(meta.get("inspectionChecklist", []) or []),
            }
        )
    return rows


def build_construction_lens_payload(doc: Document) -> dict[str, Any]:
    packages = [
        p.model_dump(by_alias=True, exclude_none=True)
        for p in doc.elements.values()
        if isinstance(p, ConstructionPackageElem)
    ]
    logistics = [
        l.model_dump(by_alias=True, exclude_none=True)
        for l in doc.elements.values()
        if isinstance(l, ConstructionLogisticsElem)
    ]
    qa = [
        q.model_dump(by_alias=True, exclude_none=True)
        for q in doc.elements.values()
        if isinstance(q, ConstructionQaChecklistElem)
    ]
    phases = [
        p.model_dump(by_alias=True, exclude_none=True)
        for p in sorted(
            (e for e in doc.elements.values() if isinstance(e, PhaseElem)),
            key=lambda x: (x.ord, x.id),
        )
    ]
    issues = [
        i.model_dump(by_alias=True, exclude_none=True)
        for i in doc.elements.values()
        if isinstance(i, IssueElem | ConstructabilityIssueElem)
    ]
    progress = construction_progress_rows(doc)
    return {
        "lens": {
            "id": "construction",
            "englishName": "Construction / Execution",
            "germanName": "Bauausfuehrung",
            "alternateGermanLabels": ["Ausfuehrung", "Baustelle"],
        },
        "progressStatuses": sorted(CONSTRUCTION_PROGRESS_STATUSES),
        "logisticsKinds": sorted(CONSTRUCTION_LOGISTICS_KINDS),
        "phases": phases,
        "packages": packages,
        "progress": progress,
        "logistics": logistics,
        "qaChecklists": qa,
        "issues": issues,
        "summary": {
            "packageCount": len(packages),
            "progressElementCount": len(progress),
            "logisticsElementCount": len(logistics),
            "qaChecklistCount": len(qa),
            "issueCount": len(issues),
        },
    }
