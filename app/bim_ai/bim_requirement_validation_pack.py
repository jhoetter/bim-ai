from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any
from xml.etree import ElementTree

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
IDS_XML_SCHEMA_VERSION = "buildingSMART-IDS-1.0"
IDS_NAMESPACE = "http://standards.buildingsmart.org/IDS"
IDS_FACET_TYPES = ("entity", "attribute", "classification", "property", "material", "partOf")

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


def import_building_smart_ids_xml(source: Any) -> dict[str, Any] | None:
    xml = ""
    if isinstance(source, str):
        xml = source.strip()
    elif isinstance(source, Mapping):
        for key in ("idsXml", "xml", "buildingSmartIdsXml"):
            if isinstance(source.get(key), str) and source[key].strip():
                xml = source[key].strip()
                break
    if not xml:
        return None
    root = ElementTree.fromstring(xml)
    if _xml_local(root.tag) != "ids":
        raise ValueError("Expected buildingSMART IDS XML root element <ids:ids>.")
    namespace = root.attrib.get("xmlns") or IDS_NAMESPACE
    info = _xml_child(root, "info")
    title = _xml_text(_xml_child(info, "title")) or "buildingSMART IDS"
    specs_node = _xml_child(root, "specifications")
    specs: list[dict[str, Any]] = []
    for index, spec_node in enumerate(_xml_children(specs_node, "specification")):
        applicability = [
            facet
            for facet in (_parse_ids_facet(child) for child in _xml_children(_xml_child(spec_node, "applicability")))
            if facet
        ]
        requirements = [
            facet
            for facet in (_parse_ids_facet(child) for child in _xml_children(_xml_child(spec_node, "requirements")))
            if facet
        ]
        spec_name = str(spec_node.attrib.get("name") or f"Specification {index + 1}").strip()
        specs.append(
            {
                "id": str(spec_node.attrib.get("identifier") or _slug(spec_name) or f"spec-{index + 1}"),
                "name": spec_name,
                "ifcVersion": _string_list(spec_node.attrib.get("ifcVersion")),
                "minOccurs": _parse_cardinality(spec_node.attrib.get("minOccurs"), 0),
                "maxOccurs": _parse_cardinality(spec_node.attrib.get("maxOccurs"), None),
                "applicability": applicability,
                "requirements": requirements,
            }
        )
    facet_types = _string_list(
        [
            facet["type"]
            for spec in specs
            for facet in [*spec["applicability"], *spec["requirements"]]
        ]
    )
    return {
        "schemaVersion": IDS_XML_SCHEMA_VERSION,
        "namespace": namespace,
        "title": title,
        "specificationCount": len(specs),
        "facetTypes": facet_types,
        "specifications": specs,
    }


def compile_bim_requirement_validation_pack(
    source: Mapping[str, Any] | str,
    *,
    pack_id: str | None = None,
) -> dict[str, Any]:
    ids_import = import_building_smart_ids_xml(source)
    requirements = _requirements_from(source)
    checks = [
        *_compile_output_checks(requirements),
        *_compile_room_checks(requirements),
        *_compile_semantic_checks(requirements),
        *_compile_layer_set_checks(requirements),
        *_compile_schedule_checks(requirements),
        *_compile_classification_checks(requirements),
        *_compile_data_quality_checks(requirements),
        *_compile_ids_specification_checks(ids_import),
    ]
    checks.sort(key=lambda row: str(row["id"]))
    delivery_targets = [
        _output_key(output) for output in _string_list(requirements.get("exportRequirements", {}).get("outputs"))
    ]
    if ids_import and not delivery_targets:
        delivery_targets = ["ifc"]
    source_map = source if isinstance(source, Mapping) else {}
    resolved_pack_id = pack_id or str(
        source_map.get("id") or source_map.get("packId") or (ids_import or {}).get("title") or "bir-pack"
    )
    compiled = {
        "schemaVersion": BIM_REQUIREMENT_VALIDATION_PACK_SCHEMA_VERSION,
        "packId": resolved_pack_id,
        "qualityTarget": source_map.get("qualityTarget") or requirements.get("qualityTarget"),
        "deliveryTargets": delivery_targets,
        "sourceDigestSha256": _digest(ids_import or requirements),
        "summary": {
            "checkCount": len(checks),
            "evidenceBlockerCount": sum(1 for check in checks if check["evidenceBlocker"]),
            "deliveryTargetCount": len(delivery_targets),
        },
        "checks": checks,
    }
    if ids_import:
        compiled["sourceFormat"] = "buildingSMART_IDS_XML"
        compiled["idsImport"] = {
            "schemaVersion": ids_import["schemaVersion"],
            "namespace": ids_import["namespace"],
            "title": ids_import["title"],
            "specificationCount": ids_import["specificationCount"],
            "facetTypes": ids_import["facetTypes"],
        }
        compiled["summary"]["idsSpecificationCount"] = ids_import["specificationCount"]
        compiled["summary"]["idsFacetTypes"] = ids_import["facetTypes"]
    return compiled


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
    if pred_type == "ids_applicability_cardinality":
        return _evaluate_ids_applicability(predicate, evidence)
    if pred_type == "ids_requirement_facet":
        return _evaluate_ids_requirement_facet(predicate, evidence)
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


def _ids_facet_check_title(spec: Mapping[str, Any], facet: Mapping[str, Any], cardinality: str) -> str:
    requirement = "prohibits" if cardinality == "prohibited" else "requires"
    if facet.get("type") == "property":
        return (
            f"IDS {spec.get('name')} {requirement} property "
            f"{_value_spec_label(facet.get('propertySet'))}.{_value_spec_label(facet.get('baseName'))}"
        )
    if facet.get("type") == "attribute":
        return f"IDS {spec.get('name')} {requirement} attribute {_value_spec_label(facet.get('name'))}"
    if facet.get("type") == "classification":
        return (
            f"IDS {spec.get('name')} {requirement} classification "
            f"{_value_spec_label(facet.get('system'))}:{_value_spec_label(facet.get('value'))}"
        )
    if facet.get("type") == "material":
        return f"IDS {spec.get('name')} {requirement} material {_value_spec_label(facet.get('value'))}"
    if facet.get("type") == "partOf":
        return f"IDS {spec.get('name')} {requirement} partOf relationship"
    return f"IDS {spec.get('name')} {requirement} entity {_value_spec_label(facet.get('name'))}"


def _compile_ids_specification_checks(ids_import: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    if not ids_import:
        return []
    checks: list[dict[str, Any]] = []
    for spec_index, spec in enumerate(ids_import.get("specifications") or []):
        if not isinstance(spec, Mapping):
            continue
        spec_id = str(spec.get("id") or f"spec-{spec_index + 1}")
        checks.append(
            _compile_check(
                f"ids_{_slug(spec_id)}_applicability",
                f"IDS applicability cardinality: {spec.get('name') or spec_id}",
                {
                    "type": "ids_applicability_cardinality",
                    "specId": spec_id,
                    "applicability": spec.get("applicability") or [],
                    "minOccurs": spec.get("minOccurs"),
                    "maxOccurs": spec.get("maxOccurs"),
                },
                delivery_targets=["ifc"],
                source_path=f"ids.specifications.{spec_index}.applicability",
                requirement_refs=["BIR-K07"],
            )
        )
        for facet_index, facet in enumerate(spec.get("requirements") or []):
            if not isinstance(facet, Mapping):
                continue
            cardinality = str(facet.get("cardinality") or "required")
            label = _value_spec_label(
                facet.get("name")
                or facet.get("baseName")
                or facet.get("value")
                or facet.get("system")
                or facet.get("relation")
            )
            checks.append(
                _compile_check(
                    f"ids_{_slug(spec_id)}_{_slug(str(facet.get('type')))}_{facet_index + 1}_{_slug(label)}",
                    _ids_facet_check_title(spec, facet, cardinality),
                    {
                        "type": "ids_requirement_facet",
                        "specId": spec_id,
                        "facet": dict(facet),
                        "cardinality": cardinality,
                        "applicability": spec.get("applicability") or [],
                    },
                    delivery_targets=["ifc"],
                    source_path=f"ids.specifications.{spec_index}.requirements.{facet_index}",
                    requirement_refs=["BIR-K07"],
                )
            )
    return checks


def _requirements_from(source: Mapping[str, Any]) -> Mapping[str, Any]:
    if not isinstance(source, Mapping):
        return {}
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
    out.setdefault("idsFacetRows", _ids_rows_from_document(doc))
    out.setdefault(
        "modelStats",
        {
            "countsByKind": _counts_by_kind(doc),
            "rooms": _room_rows(doc),
            "elements": _ids_rows_from_document(doc),
        },
    )
    return out


def _ids_rows_from_document(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    entity_by_kind = {
        "wall": "IfcWall",
        "floor": "IfcSlab",
        "roof": "IfcRoof",
        "room": "IfcSpace",
        "door": "IfcDoor",
        "window": "IfcWindow",
        "stair": "IfcStair",
        "railing": "IfcRailing",
    }
    for elem in doc.elements.values():
        kind = str(getattr(elem, "kind", ""))
        ifc_entity = entity_by_kind.get(kind)
        if not ifc_entity:
            continue
        props = getattr(elem, "props", None) if isinstance(getattr(elem, "props", None), dict) else {}
        attributes = {"Name": getattr(elem, "name", None), "GlobalId": getattr(elem, "id", None)}
        classifications = props.get("classifications", [])
        if getattr(elem, "ifc_classification_code", None):
            classifications = [
                *classifications,
                {"system": "Uniclass", "value": elem.ifc_classification_code},
            ]
        materials = _string_list(
            props.get("materials")
            or props.get("material")
            or getattr(elem, "material_key", None)
            or getattr(elem, "structural_material", None)
        )
        properties: dict[str, Any] = dict(props)
        if getattr(elem, "fire_resistance_rating", None):
            properties.setdefault("Pset_WallCommon", {})["FireRating"] = elem.fire_resistance_rating
        part_of = props.get("partOf", [])
        level_id = getattr(elem, "level_id", None)
        if level_id:
            part_of = [
                *part_of,
                {
                    "entity": "IfcBuildingStorey",
                    "relation": "IFCRELCONTAINEDINSPATIALSTRUCTURE",
                    "name": level_id,
                },
            ]
        rows.append(
            {
                "id": getattr(elem, "id", ""),
                "ifcEntity": ifc_entity,
                "attributes": {key: value for key, value in attributes.items() if value is not None},
                "properties": properties,
                "classifications": classifications,
                "materials": materials,
                "partOf": part_of,
            }
        )
    return rows


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


def _ids_evidence_rows(evidence: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows: list[Any] = []
    for key in ("idsFacetRows",):
        value = evidence.get(key)
        if isinstance(value, list):
            rows.extend(value)
    if isinstance(evidence.get("ifcManifest"), Mapping):
        value = evidence["ifcManifest"].get("idsFacetRows")
        if isinstance(value, list):
            rows.extend(value)
    if isinstance(evidence.get("evidencePackage"), Mapping):
        value = evidence["evidencePackage"].get("idsFacetRows")
        if isinstance(value, list):
            rows.extend(value)
    if isinstance(evidence.get("modelStats"), Mapping) and isinstance(
        evidence["modelStats"].get("elements"), list
    ):
        rows.extend(evidence["modelStats"]["elements"])
    normalized: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        materials = row.get("materials")
        normalized.append(
            {
                **dict(row),
                "ifcEntity": str(
                    row.get("ifcEntity") or row.get("entity") or row.get("ifcKind") or row.get("type") or ""
                ).strip(),
                "attributes": row.get("attributes") if isinstance(row.get("attributes"), Mapping) else {},
                "properties": row.get("properties") if isinstance(row.get("properties"), Mapping) else {},
                "classifications": row.get("classifications")
                if isinstance(row.get("classifications"), list)
                else [],
                "materials": materials
                if isinstance(materials, list)
                else _string_list(row.get("material") or row.get("materialName")),
                "partOf": row.get("partOf") if isinstance(row.get("partOf"), list) else [],
            }
        )
    return normalized


def _equals_fold(actual: Any, expected: Any) -> bool:
    return str(actual or "").strip().lower() == str(expected or "").strip().lower()


def _value_matches_spec(actual: Any, spec: Any) -> bool:
    if not isinstance(spec, Mapping):
        return actual is not None and str(actual).strip() != ""
    actual_text = str(actual or "").strip()
    if spec.get("simple") is not None:
        return _equals_fold(actual_text, spec.get("simple"))
    if isinstance(spec.get("enumeration"), list) and not any(
        _equals_fold(actual_text, value) for value in spec["enumeration"]
    ):
        return False
    if spec.get("pattern"):
        import re

        try:
            if not re.search(str(spec["pattern"]), actual_text):
                return False
        except re.error:
            return False
    numeric_keys = ("minInclusive", "maxInclusive", "minExclusive", "maxExclusive")
    if any(spec.get(key) is not None for key in numeric_keys):
        try:
            actual_number = float(actual_text)
        except ValueError:
            return False
        if spec.get("minInclusive") is not None and actual_number < float(spec["minInclusive"]):
            return False
        if spec.get("maxInclusive") is not None and actual_number > float(spec["maxInclusive"]):
            return False
        if spec.get("minExclusive") is not None and actual_number <= float(spec["minExclusive"]):
            return False
        if spec.get("maxExclusive") is not None and actual_number >= float(spec["maxExclusive"]):
            return False
    return True


def _attribute_value(row: Mapping[str, Any], name_spec: Any) -> Any:
    wanted = str(name_spec.get("simple") if isinstance(name_spec, Mapping) else "").strip()
    if not wanted:
        return None
    attrs = row.get("attributes") if isinstance(row.get("attributes"), Mapping) else {}
    for key, value in attrs.items():
        if _equals_fold(key, wanted):
            return value
    return row.get(wanted) or row.get(wanted.lower())


def _property_value(row: Mapping[str, Any], property_set_spec: Any, base_name_spec: Any) -> Any:
    pset_name = str(
        property_set_spec.get("simple") if isinstance(property_set_spec, Mapping) else ""
    ).strip()
    base_name = str(base_name_spec.get("simple") if isinstance(base_name_spec, Mapping) else "").strip()
    if not base_name:
        return None
    props = row.get("properties") if isinstance(row.get("properties"), Mapping) else {}
    candidates: list[Mapping[str, Any]] = []
    if pset_name:
        for key, value in props.items():
            if _equals_fold(key, pset_name) and isinstance(value, Mapping):
                candidates.append(value)
    candidates.append(props)
    for candidate in candidates:
        for key, value in candidate.items():
            if _equals_fold(key, base_name):
                return value
    return None


def _row_matches_ids_facet(row: Mapping[str, Any], facet: Any) -> bool:
    if not isinstance(facet, Mapping):
        return True
    facet_type = facet.get("type")
    if facet_type == "entity":
        if facet.get("name") and not _value_matches_spec(row.get("ifcEntity"), facet.get("name")):
            return False
        predefined = _attribute_value(row, {"simple": "PredefinedType"}) or row.get("predefinedType")
        if facet.get("predefinedType") and not _value_matches_spec(
            predefined, facet.get("predefinedType")
        ):
            return False
        return True
    if facet_type == "attribute":
        return _value_matches_spec(_attribute_value(row, facet.get("name")), facet.get("value"))
    if facet_type == "property":
        return _value_matches_spec(
            _property_value(row, facet.get("propertySet"), facet.get("baseName")),
            facet.get("value"),
        )
    if facet_type == "classification":
        for classification in row.get("classifications") or []:
            if isinstance(classification, str):
                if _value_matches_spec(classification, facet.get("value") or facet.get("system")):
                    return True
                continue
            if not isinstance(classification, Mapping):
                continue
            if facet.get("system") and not _value_matches_spec(
                classification.get("system"), facet.get("system")
            ):
                continue
            if facet.get("value") and not _value_matches_spec(
                classification.get("value")
                or classification.get("code")
                or classification.get("identification"),
                facet.get("value"),
            ):
                continue
            if facet.get("uri") and not _value_matches_spec(
                classification.get("uri") or classification.get("location"), facet.get("uri")
            ):
                continue
            return True
        return False
    if facet_type == "material":
        return any(_value_matches_spec(material, facet.get("value")) for material in row.get("materials") or [])
    if facet_type == "partOf":
        for part in row.get("partOf") or []:
            if not isinstance(part, Mapping):
                continue
            relation_ok = not facet.get("relation") or _value_matches_spec(
                part.get("relation") or part.get("type"), facet.get("relation")
            )
            entity_ok = True
            if facet.get("entity"):
                entity_ok = _row_matches_ids_facet(
                    {
                        "ifcEntity": part.get("ifcEntity") or part.get("entity"),
                        "attributes": {
                            "Name": part.get("name"),
                            "PredefinedType": part.get("predefinedType"),
                        },
                        "properties": {},
                        "classifications": [],
                        "materials": [],
                        "partOf": [],
                    },
                    facet.get("entity"),
                )
            if relation_ok and entity_ok:
                return True
        return False
    return False


def _applicable_ids_rows(predicate: Mapping[str, Any], evidence: Mapping[str, Any]) -> list[dict[str, Any]]:
    applicability = predicate.get("applicability") if isinstance(predicate.get("applicability"), list) else []
    return [
        row
        for row in _ids_evidence_rows(evidence)
        if all(_row_matches_ids_facet(row, facet) for facet in applicability)
    ]


def _evaluate_ids_applicability(
    predicate: Mapping[str, Any], evidence: Mapping[str, Any]
) -> dict[str, Any]:
    rows = _applicable_ids_rows(predicate, evidence)
    min_occurs = int(predicate.get("minOccurs") or 0)
    max_occurs = predicate.get("maxOccurs")
    max_ok = max_occurs is None or len(rows) <= int(max_occurs)
    passed = len(rows) >= min_occurs and max_ok
    return {
        "passed": passed,
        "actual": len(rows),
        "expected": 0 if max_occurs == 0 else min_occurs,
        "message": (
            f"IDS applicability for {predicate.get('specId')} must match no IFC rows; found {len(rows)}."
            if max_occurs == 0
            else f"IDS applicability for {predicate.get('specId')} expected at least {min_occurs} IFC row(s); found {len(rows)}."
        ),
    }


def _evaluate_ids_requirement_facet(
    predicate: Mapping[str, Any], evidence: Mapping[str, Any]
) -> dict[str, Any]:
    rows = _applicable_ids_rows(predicate, evidence)
    facet = predicate.get("facet") if isinstance(predicate.get("facet"), Mapping) else {}
    matching_rows = [row for row in rows if _row_matches_ids_facet(row, facet)]
    cardinality = str(predicate.get("cardinality") or "required")
    if cardinality == "optional":
        passed = True
    elif cardinality == "prohibited":
        passed = not matching_rows
    else:
        passed = bool(rows) and len(matching_rows) == len(rows)
    return {
        "passed": passed,
        "actual": len(matching_rows),
        "expected": 0 if cardinality == "prohibited" else len(rows) or 1,
        "message": (
            f"IDS {predicate.get('specId')} prohibits {facet.get('type')} facet matches; found {len(matching_rows)}."
            if cardinality == "prohibited"
            else f"IDS {predicate.get('specId')} requires {facet.get('type')} facet on {len(rows)} applicable row(s); {len(matching_rows)} matched."
        ),
    }


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


def _xml_local(tag: str) -> str:
    return str(tag).split("}", 1)[-1].split(":")[-1]


def _xml_children(node: ElementTree.Element | None, local_name: str | None = None) -> list[ElementTree.Element]:
    if node is None:
        return []
    return [
        child
        for child in list(node)
        if local_name is None or _xml_local(child.tag) == local_name
    ]


def _xml_child(node: ElementTree.Element | None, local_name: str) -> ElementTree.Element | None:
    children = _xml_children(node, local_name)
    return children[0] if children else None


def _xml_text(node: ElementTree.Element | None) -> str:
    return "" if node is None or node.text is None else str(node.text).strip()


def _value_spec_from_node(node: ElementTree.Element | None) -> dict[str, Any] | None:
    if node is None:
        return None
    simple = _xml_text(_xml_child(node, "simpleValue"))
    if simple:
        return {"simple": simple}
    restriction = _xml_child(node, "restriction")
    if restriction is not None:
        spec: dict[str, Any] = {}
        if restriction.attrib.get("base"):
            spec["base"] = restriction.attrib["base"]
        enumerations = [
            child.attrib["value"].strip()
            for child in _xml_children(restriction, "enumeration")
            if child.attrib.get("value")
        ]
        if enumerations:
            spec["enumeration"] = enumerations
        pattern = _xml_child(restriction, "pattern")
        if pattern is not None and pattern.attrib.get("value"):
            spec["pattern"] = pattern.attrib["value"]
        for key in ("minInclusive", "maxInclusive", "minExclusive", "maxExclusive"):
            child = _xml_child(restriction, key)
            if child is not None and child.attrib.get("value"):
                spec[key] = child.attrib["value"]
        return spec or None
    text = _xml_text(node)
    return {"simple": text} if text else None


def _parse_ids_facet(node: ElementTree.Element | None) -> dict[str, Any] | None:
    if node is None:
        return None
    facet_type = _xml_local(node.tag)
    if facet_type not in IDS_FACET_TYPES:
        return None
    facet: dict[str, Any] = {
        "type": facet_type,
        "cardinality": node.attrib.get("cardinality"),
        "instructions": node.attrib.get("instructions"),
    }
    if facet_type == "entity":
        name = _value_spec_from_node(_xml_child(node, "name"))
        predefined_type = _value_spec_from_node(_xml_child(node, "predefinedType"))
        if name:
            facet["name"] = name
        if predefined_type:
            facet["predefinedType"] = predefined_type
    elif facet_type == "attribute":
        name = _value_spec_from_node(_xml_child(node, "name"))
        value = _value_spec_from_node(_xml_child(node, "value"))
        if name:
            facet["name"] = name
        if value:
            facet["value"] = value
    elif facet_type == "classification":
        for key in ("system", "value", "uri"):
            value = _value_spec_from_node(_xml_child(node, key))
            if value:
                facet[key] = value
    elif facet_type == "property":
        for key in ("propertySet", "baseName", "value"):
            value = _value_spec_from_node(_xml_child(node, key))
            if value:
                facet[key] = value
        if node.attrib.get("dataType"):
            facet["dataType"] = node.attrib["dataType"]
    elif facet_type == "material":
        value = _value_spec_from_node(_xml_child(node, "value"))
        if value:
            facet["value"] = value
    elif facet_type == "partOf":
        relation = _value_spec_from_node(_xml_child(node, "relation"))
        entity = _parse_ids_facet(_xml_child(node, "entity"))
        if relation:
            facet["relation"] = relation
        if entity:
            facet["entity"] = entity
    return {key: value for key, value in facet.items() if value not in (None, "")}


def _parse_cardinality(value: Any, fallback: int | None) -> int | None:
    raw = str(value or "").strip()
    if not raw:
        return fallback
    if raw == "unbounded":
        return None
    try:
        return int(raw)
    except ValueError:
        return fallback


def _value_spec_label(spec: Any) -> str:
    if not isinstance(spec, Mapping):
        return "present"
    if spec.get("simple") is not None:
        return str(spec["simple"]).strip()
    if isinstance(spec.get("enumeration"), list):
        return "|".join(str(value) for value in spec["enumeration"])
    if spec.get("pattern"):
        return f"pattern:{spec['pattern']}"
    return "|".join(f"{key}:{value}" for key, value in spec.items())
