from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import RoomElem, ValidationRuleElem

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
    delivery_targets = _string_list(requirements.get("exportRequirements", {}).get("outputs"))
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
) -> dict[str, Any]:
    counts_by_kind = _counts_by_kind(doc)
    room_rows = _room_rows(doc)
    blockers: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for check in pack.get("checks") or []:
        if not isinstance(check, Mapping):
            continue
        predicate = check.get("predicate") if isinstance(check.get("predicate"), Mapping) else {}
        status = "pass"
        code = str(check.get("id") or "unknown")
        if predicate.get("type") == "min_kind_count":
            actual = sum(int(counts_by_kind.get(kind, 0)) for kind in predicate.get("kinds") or [])
            expected = int(predicate.get("min") or 0)
            if actual < expected:
                status = "fail"
                blockers.append(
                    {
                        "code": code,
                        "severity": check.get("severity") or "error",
                        "message": f"Expected at least {expected} matching elements; found {actual}.",
                        "requirementRefs": check.get("requirementRefs") or [],
                    }
                )
        elif predicate.get("type") == "required_row_fields":
            fields = _string_list(predicate.get("fields"))
            missing_rows = [
                row["id"]
                for row in room_rows
                if any(row.get(field) in (None, "") for field in fields)
            ]
            if missing_rows:
                status = "fail"
                blockers.append(
                    {
                        "code": code,
                        "severity": check.get("severity") or "error",
                        "message": "Required room/schedule fields are missing.",
                        "elementIds": missing_rows,
                        "requirementRefs": check.get("requirementRefs") or [],
                    }
                )
        rows.append({"checkId": code, "status": status})

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
            f"bir_export_output_{_slug(output)}",
            f"Required delivery output: {output}",
            {"type": "artifact_present", "output": output},
            delivery_targets=[output],
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
