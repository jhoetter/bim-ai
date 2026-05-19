from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    FloorTypeElem,
    RoofTypeElem,
    RoomElem,
    ScheduleElem,
    SheetElem,
    ValidationRuleElem,
    WallTypeElem,
)

BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION = "bim-requirement-validation-pack.v1"
BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION = "bim-requirement-validation-report.v1"

IFC_ENTITY_TO_SNAPSHOT_KINDS = {
    "IfcSpace": ["room", "space"],
    "IfcWall": ["wall"],
    "IfcWallStandardCase": ["wall"],
    "IfcSlab": ["floor", "slab"],
    "IfcRoof": ["roof"],
    "IfcStair": ["stair"],
    "IfcDoor": ["door"],
    "IfcWindow": ["window"],
    "IfcRailing": ["railing"],
    "IfcFurnishingElement": ["asset", "furniture", "family_instance", "placed_asset"],
    "IfcBuildingElementProxy": ["mass", "proxy"],
}

REQUIRED_ROOM_FIELDS = ("name", "number", "level", "function", "targetAreaM2", "boundingStatus")


def compile_bim_requirement_validation_pack(
    source: Mapping[str, Any],
    *,
    pack_id: str | None = None,
) -> dict[str, Any]:
    requirements = _requirements_from(source)
    checks = [
        *_compile_output_checks(requirements),
        *_compile_room_checks(requirements),
        *_compile_semantic_checks(requirements),
        *_compile_layer_set_checks(requirements),
        *_compile_schedule_checks(requirements),
        *_compile_classification_checks(requirements),
        *_compile_data_quality_checks(requirements),
    ]
    checks.sort(key=lambda row: str(row["id"]))
    delivery_targets = [
        _output_key(output) for output in _string_list(requirements.get("exportRequirements", {}).get("outputs"))
    ]
    return {
        "schemaVersion": BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
        "packId": pack_id or str(source.get("id") or source.get("packId") or "bir-pack"),
        "qualityTarget": source.get("qualityTarget") or requirements.get("qualityTarget"),
        "deliveryTargets": delivery_targets,
        "sourceDigestSha256": _digest(requirements),
        "summary": {
            "checkCount": len(checks),
            "evidenceBlockerCount": sum(1 for check in checks if check["evidenceBlocker"]),
            "deliveryTargetCount": len(delivery_targets),
        },
        "checks": checks,
    }


def validate_bim_requirement_validation_pack(
    pack: Mapping[str, Any],
    *,
    doc: Document,
    evidence: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    counts_by_kind = _counts_by_kind(doc)
    room_rows = _room_rows(doc)
    doc_evidence = _document_validation_evidence(doc, evidence)
    blockers: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for check in pack.get("checks") or []:
        if not isinstance(check, Mapping):
            continue
        predicate = check.get("predicate") if isinstance(check.get("predicate"), Mapping) else {}
        code = str(check.get("id") or "unknown")
        evaluation = _evaluate_predicate(
            predicate,
            doc=doc,
            evidence=doc_evidence,
            counts_by_kind=counts_by_kind,
            room_rows=room_rows,
        )
        status = "pass" if evaluation["passed"] else str(check.get("severity") or "error")
        if not evaluation["passed"] and check.get("evidenceBlocker", True):
            blocker: dict[str, Any] = {
                "code": code,
                "severity": check.get("severity") or "error",
                "message": evaluation["message"],
                "requirementRefs": check.get("requirementRefs") or [],
            }
            if check.get("deliveryTargets"):
                blocker["deliveryTargets"] = check.get("deliveryTargets")
            details = evaluation.get("details")
            if isinstance(details, dict):
                blocker.update(details)
            blockers.append(blocker)
        rows.append(
            {
                "checkId": code,
                "status": status,
                "actual": evaluation["actual"],
                "expected": evaluation["expected"],
            }
        )

    severity_counts: dict[str, int] = {}
    for blocker in blockers:
        severity = str(blocker.get("severity") or "error")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
    return {
        "schemaVersion": BIM_REQUIREMENT_VALIDATION_REPORT_SCHEMA_VERSION,
        "ok": not blockers,
        "summary": {
            "checkCount": len(rows),
            "passCount": sum(1 for row in rows if row["status"] == "pass"),
            "blockerCount": len(blockers),
            "errorCount": severity_counts.get("error", 0),
            "severityCounts": dict(sorted(severity_counts.items())),
        },
        "checks": rows,
        "blockers": blockers,
    }


def _evaluate_predicate(
    predicate: Mapping[str, Any],
    *,
    doc: Document,
    evidence: Mapping[str, Any],
    counts_by_kind: Mapping[str, int],
    room_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    pred_type = predicate.get("type")
    if pred_type == "artifact_present":
        output = _output_key(str(predicate.get("output") or ""))
        passed = _artifact_present(output, doc, evidence)
        return {
            "passed": passed,
            "actual": 1 if passed else 0,
            "expected": 1,
            "message": f"Required {output} exchange artifact must be present.",
        }
    if pred_type == "min_kind_count":
        actual = sum(int(counts_by_kind.get(kind, 0)) for kind in predicate.get("kinds") or [])
        expected = int(predicate.get("min") or 0)
        return {
            "passed": actual >= expected,
            "actual": actual,
            "expected": expected,
            "message": f"Expected at least {expected} matching elements; found {actual}.",
        }
    if pred_type == "required_row_fields":
        fields = _string_list(predicate.get("fields"))
        missing_rows = [
            row["id"] for row in room_rows if any(row.get(field) in (None, "") for field in fields)
        ]
        return {
            "passed": bool(room_rows) and not missing_rows,
            "actual": len(room_rows) - len(missing_rows),
            "expected": len(room_rows) or 1,
            "message": (
                "Required room/schedule fields are missing."
                if missing_rows
                else "Room/schedule rows include required fields."
            ),
            "details": {"elementIds": missing_rows} if missing_rows else {},
        }
    if pred_type == "schedule_columns_present":
        actual_columns = _schedule_columns(str(predicate.get("scheduleId") or ""), evidence)
        required_columns = _string_list(predicate.get("requiredColumns"))
        missing_columns = [c for c in required_columns if c not in actual_columns]
        return {
            "passed": bool(required_columns) and not missing_columns,
            "actual": len(actual_columns),
            "expected": len(required_columns),
            "message": (
                f"Schedule {predicate.get('scheduleId')} is missing column(s): "
                + ", ".join(missing_columns)
                if missing_columns
                else f"Schedule {predicate.get('scheduleId')} has required columns."
            ),
            "details": {"missingColumns": missing_columns} if missing_columns else {},
        }
    if pred_type == "material_layer_set_present":
        passed = _material_layer_set_present(predicate, evidence)
        return {
            "passed": passed,
            "actual": 1 if passed else 0,
            "expected": 1,
            "message": f"Material layer-set evidence is required for {predicate.get('id')}.",
        }
    if pred_type == "object_present":
        return {"passed": True, "actual": 1, "expected": 1, "message": "Requirement object compiled."}
    if pred_type == "data_quality_evidence_present":
        passed = _data_quality_evidence_present(str(predicate.get("checkId") or ""), evidence)
        return {
            "passed": passed,
            "actual": 1 if passed else 0,
            "expected": 1,
            "message": f"Data quality evidence is required for {predicate.get('checkId')}.",
        }
    if pred_type == "require_compiled_value":
        return {
            "passed": False,
            "actual": 0,
            "expected": 1,
            "message": "Compiled requirement is incomplete.",
        }
    return {
        "passed": False,
        "actual": 0,
        "expected": 1,
        "message": "Unknown validation predicate.",
    }


def build_document_bim_requirement_validation_payload(
    model_id: str,
    doc: Document,
) -> dict[str, Any]:
    rules = [
        elem
        for elem in doc.elements.values()
        if isinstance(elem, ValidationRuleElem) and isinstance(elem.rule_json, dict)
    ]
    packs = [
        compile_bim_requirement_validation_pack(rule.rule_json, pack_id=rule.id) for rule in rules
    ]
    reports = [validate_bim_requirement_validation_pack(pack, doc=doc) for pack in packs]
    return {
        "format": "bimRequirementValidationApiParity_v1",
        "modelId": model_id,
        "revision": doc.revision,
        "validationRuleCount": len(rules),
        "packs": packs,
        "reports": reports,
        "summary": {
            "packCount": len(packs),
            "blockerCount": sum(int(report["summary"]["blockerCount"]) for report in reports),
            "ok": all(report["ok"] for report in reports),
        },
    }


def _compile_check(
    check_id: str,
    title: str,
    predicate: Mapping[str, Any],
    *,
    delivery_targets: list[str] | None = None,
    source_path: str | None = None,
    requirement_refs: list[str] | None = None,
    severity: str = "error",
) -> dict[str, Any]:
    return {
        "id": check_id,
        "title": title,
        "severity": severity,
        "layer": "methodology-exchange",
        "evidenceBlocker": True,
        "deliveryTargets": delivery_targets or [],
        "sourcePath": source_path,
        "requirementRefs": requirement_refs or ["BIR-K07"],
        "predicate": dict(predicate),
    }


def _compile_output_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    outputs = _string_list(requirements.get("exportRequirements", {}).get("outputs"))
    return [
        _compile_check(
            f"bir_export_output_{_output_key(output)}",
            f"Required delivery output: {_output_key(output)}",
            {"type": "artifact_present", "output": _output_key(output)},
            delivery_targets=[_output_key(output)],
            source_path="informationRequirements.exportRequirements.outputs",
            requirement_refs=["BIR-K07"],
        )
        for output in outputs
    ]


def _compile_room_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    rooms = requirements.get("rooms")
    if not isinstance(rooms, list) or not rooms:
        return []
    return [
        _compile_check(
            "bir_rooms_min_count",
            "Required rooms/spaces are represented",
            {"type": "min_kind_count", "kinds": ["room", "space"], "min": len(rooms)},
            source_path="informationRequirements.rooms",
            requirement_refs=["BIR-K07", "BIR-D06"],
        ),
        _compile_check(
            "bir_rooms_required_fields",
            "Required room fields are present in schedule/evidence rows",
            {"type": "required_row_fields", "rowSet": "rooms", "fields": list(REQUIRED_ROOM_FIELDS)},
            source_path="informationRequirements.rooms",
            requirement_refs=["BIR-K07", "BIR-D06"],
        ),
    ]


def _compile_semantic_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows = requirements.get("elementSemanticRequirements")
    if not isinstance(rows, list):
        return []
    checks: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        if not isinstance(row, Mapping):
            continue
        entity = str(row.get("ifcEntityIntent") or "").strip()
        category = str(row.get("category") or f"semantic-{index + 1}").strip()
        if not entity:
            checks.append(
                _compile_check(
                    f"bir_semantic_{_slug(category)}_ifc_intent_missing",
                    f"IFC intent declared for {category}",
                    {"type": "require_compiled_value", "field": "ifcEntityIntent"},
                    source_path=f"informationRequirements.elementSemanticRequirements.{index}",
                    requirement_refs=["BIR-K04", "BIR-K07"],
                    severity="warning",
                )
            )
            continue
        checks.append(
            _compile_check(
                f"bir_semantic_{_slug(category)}_{_slug(entity)}",
                f"Required IFC/entity representation for {category}",
                {
                    "type": "min_kind_count",
                    "kinds": IFC_ENTITY_TO_SNAPSHOT_KINDS.get(
                        entity, [str(row.get("expectedBimCategory") or category)]
                    ),
                    "min": int(row.get("minCount") or 1),
                    "ifcEntity": entity,
                },
                delivery_targets=["ifc"],
                source_path=f"informationRequirements.elementSemanticRequirements.{index}",
                requirement_refs=["BIR-K04", "BIR-K07"],
            )
        )
    return checks


def _compile_layer_set_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows = requirements.get("materialLayerSetRequirements")
    if not isinstance(rows, list):
        return []
    return [
        _compile_check(
            f"bir_layer_set_{_slug(str(row.get('id') or row.get('layerSetName') or index + 1))}",
            f"Material layer set is evidenced: {row.get('id') or row.get('layerSetName') or index + 1}",
            {
                "type": "material_layer_set_present",
                "id": row.get("id") or row.get("layerSetName") or str(index + 1),
                "layerSetName": row.get("layerSetName"),
                "appliesToCategories": _string_list(row.get("appliesToCategories")),
            },
            source_path=f"informationRequirements.materialLayerSetRequirements.{index}",
            requirement_refs=["BIR-K04", "BIR-K07"],
        )
        for index, row in enumerate(rows)
        if isinstance(row, Mapping)
    ]


def _compile_schedule_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows = requirements.get("schedules") or requirements.get("scheduleRequirements")
    if not isinstance(rows, list):
        return []
    return [
        _compile_check(
            f"bir_schedule_{_slug(str(row.get('id') or row.get('title') or index + 1))}_columns",
            f"Required schedule columns are present: {row.get('id') or row.get('title') or index + 1}",
            {
                "type": "schedule_columns_present",
                "scheduleId": row.get("id") or row.get("title") or str(index + 1),
                "requiredColumns": _string_list(row.get("requiredColumns")),
            },
            delivery_targets=["schedules"],
            source_path=f"informationRequirements.schedules.{index}",
            requirement_refs=["BIR-K05", "BIR-K07"],
        )
        for index, row in enumerate(rows)
        if isinstance(row, Mapping)
    ]


def _compile_classification_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(requirements.get("classificationRequirements"), Mapping):
        return []
    return [
        _compile_check(
            "bir_classification_placeholders_present",
            "Classification placeholder system is documented",
            {"type": "object_present", "path": "classificationRequirements"},
            delivery_targets=["ifc"],
            source_path="informationRequirements.classificationRequirements",
            requirement_refs=["BIR-K04", "BIR-K07"],
        )
    ]


def _compile_data_quality_checks(requirements: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [
        _compile_check(
            f"bir_data_quality_{_slug(check_id)}",
            f"BIM data quality evidence is present: {check_id}",
            {"type": "data_quality_evidence_present", "checkId": check_id},
            source_path="informationRequirements.dataQualityChecks",
            requirement_refs=["BIR-K07"],
        )
        for check_id in _string_list(requirements.get("dataQualityChecks"))
    ]


def _requirements_from(source: Mapping[str, Any]) -> Mapping[str, Any]:
    for key in ("informationRequirements", "requirements"):
        value = source.get(key)
        if isinstance(value, Mapping):
            return value
    ir = source.get("ir")
    if isinstance(ir, Mapping) and isinstance(ir.get("informationRequirements"), Mapping):
        return ir["informationRequirements"]
    return source


def _counts_by_kind(doc: Document) -> dict[str, int]:
    counts: dict[str, int] = {}
    for elem in doc.elements.values():
        kind = str(getattr(elem, "kind", "unknown"))
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def _room_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for elem in doc.elements.values():
        if not isinstance(elem, RoomElem):
            continue
        props = elem.props if isinstance(elem.props, dict) else {}
        rows.append(
            {
                "id": elem.id,
                "name": elem.name,
                "number": props.get("number") or props.get("roomNumber"),
                "level": elem.level_id,
                "function": props.get("function") or elem.function_label,
                "targetAreaM2": getattr(elem, "target_area_m2", None),
                "boundingStatus": props.get("boundingStatus"),
            }
        )
    return rows


def _document_validation_evidence(
    doc: Document, evidence: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    out: dict[str, Any] = dict(evidence or {})
    out.setdefault("rooms", _room_rows(doc))
    out.setdefault("schedules", _schedule_rows(doc))
    out.setdefault("materialLayerSets", _material_layer_set_rows(doc))
    out.setdefault("dataQualityResults", _data_quality_rows(doc))
    out.setdefault("modelStats", {"countsByKind": _counts_by_kind(doc), "rooms": _room_rows(doc)})
    return out


def _schedule_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for elem in doc.elements.values():
        if not isinstance(elem, ScheduleElem):
            continue
        columns: list[str] = []
        for col in elem.columns:
            if not isinstance(col, Mapping):
                continue
            for key in ("key", "id", "name", "label", "field"):
                raw = col.get(key)
                if isinstance(raw, str) and raw.strip():
                    columns.append(raw.strip())
                    break
        rows.append({"id": elem.id, "title": elem.name, "columns": _string_list(columns)})
    return rows


def _material_layer_set_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for elem in doc.elements.values():
        if isinstance(elem, WallTypeElem) and elem.layers:
            rows.append(
                {
                    "id": elem.id,
                    "layerSetName": elem.name,
                    "name": elem.name,
                    "category": "wall",
                    "appliesToCategory": "wall",
                }
            )
        elif isinstance(elem, FloorTypeElem) and elem.layers:
            rows.append(
                {
                    "id": elem.id,
                    "layerSetName": elem.name,
                    "name": elem.name,
                    "category": "floor",
                    "appliesToCategory": "floor",
                }
            )
        elif isinstance(elem, RoofTypeElem) and elem.layers:
            rows.append(
                {
                    "id": elem.id,
                    "layerSetName": elem.name,
                    "name": elem.name,
                    "category": "roof",
                    "appliesToCategory": "roof",
                }
            )
    return rows


def _data_quality_rows(doc: Document) -> list[dict[str, Any]]:
    room_rows = _room_rows(doc)
    required_room_fields_present = bool(room_rows) and all(
        all(row.get(field) not in (None, "") for field in REQUIRED_ROOM_FIELDS) for row in room_rows
    )
    return [
        {
            "id": "rooms_spaces_bounded_accessible_schedulable",
            "status": "pass" if required_room_fields_present else "fail",
        }
    ]


def _artifact_present(output: str, doc: Document, evidence: Mapping[str, Any]) -> bool:
    if output == "ifc":
        return True
    if output in {"glb", "gltf"}:
        return True
    if output == "evidence-package":
        return True
    if output == "source-bundle":
        return True
    if output in {"pdf", "pdf-sheets"}:
        return any(isinstance(elem, SheetElem) for elem in doc.elements.values())
    if output.endswith("-schedule"):
        return bool(_schedule_columns(output, evidence))
    if output == "schedules":
        return bool(evidence.get("schedules"))
    raw_artifacts = evidence.get("artifacts")
    artifacts = _string_list(raw_artifacts)
    return any(output in _slug(artifact) for artifact in artifacts)


def _schedule_columns(schedule_id: str, evidence: Mapping[str, Any]) -> list[str]:
    wanted = _slug(schedule_id)
    for row in evidence.get("schedules") or []:
        if not isinstance(row, Mapping):
            continue
        if _slug(row.get("id") or "") != wanted and _slug(row.get("title") or "") != wanted:
            continue
        return _string_list(row.get("columns") or row.get("requiredColumns") or row.get("fields"))
    return []


def _material_layer_set_present(predicate: Mapping[str, Any], evidence: Mapping[str, Any]) -> bool:
    ids = {
        _slug(predicate.get("id") or ""),
        _slug(predicate.get("layerSetName") or ""),
        *(_slug(value) for value in _string_list(predicate.get("appliesToCategories"))),
    }
    ids.discard("")
    for row in evidence.get("materialLayerSets") or []:
        if not isinstance(row, Mapping):
            continue
        values = [
            row.get("id"),
            row.get("layerSetName"),
            row.get("name"),
            row.get("category"),
            row.get("appliesToCategory"),
        ]
        if any(_slug(value or "") in ids for value in values):
            return True
    return False


def _data_quality_evidence_present(check_id: str, evidence: Mapping[str, Any]) -> bool:
    wanted = _slug(check_id)
    for row in evidence.get("dataQualityResults") or []:
        if not isinstance(row, Mapping):
            continue
        row_ids = {
            _slug(row.get("id") or ""),
            _slug(row.get("checkId") or ""),
            _slug(row.get("code") or ""),
        }
        if wanted not in row_ids:
            continue
        status = str(row.get("status") or row.get("result") or "").strip().lower()
        if status in {"", "pass", "passed", "ok", "present"}:
            return True
    return False


def _digest(value: Any) -> str:
    blob = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(blob.encode("utf8")).hexdigest()


def _string_list(value: Any) -> list[str]:
    raw = value if isinstance(value, list) else ([] if value is None else [value])
    return sorted({str(item).strip() for item in raw if str(item).strip()})


def _slug(value: str) -> str:
    out = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(value).replace("&", " and "))
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-") or "unknown"


def _output_key(value: str) -> str:
    raw = _slug(value)
    if raw in {
        "pdf-sheets",
        "room-schedule",
        "door-window-schedule",
        "evidence-package",
        "ifc",
        "glb",
        "gltf",
        "pdf",
        "schedules",
    }:
        return raw
    if raw in {"source-bundle", "source-command-bundle"}:
        return "source-bundle"
    return raw
