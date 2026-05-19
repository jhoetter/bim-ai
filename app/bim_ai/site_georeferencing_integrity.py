from __future__ import annotations

import math
from collections import Counter, defaultdict
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from typing import Any, Literal

from bim_ai.document import Document

SITE_GEOREFERENCING_TRACKER_ITEMS = (
    "BIR-S01",
    "BIR-S02",
    "BIR-S03",
    "BIR-S04",
    "BIR-S05",
    "BIR-S06",
)

SITE_GEO_IMPORT_DIAGNOSTIC_CODES = frozenset(
    {
        "unsupported_product",
        "lost_geometry",
        "category_mapping_fallback",
        "transform_drift",
        "material_fallback",
        "type_fallback",
        "unit_normalization",
    }
)

SITE_GEO_DISCIPLINE = "site"
SITE_GEO_PERSPECTIVE = "coordination"
LINK_TRANSLATION_TOLERANCE_MM = 1.0
LINK_ROTATION_TOLERANCE_DEG = 0.001

Severity = Literal["error", "warning", "info"]


@dataclass(frozen=True)
class SiteGeoreferencingFinding:
    rule_id: str
    severity: Severity
    message: str
    element_ids: tuple[str, ...] = ()
    tracker_items: tuple[str, ...] = ()
    field: str | None = None
    expected: str | None = None
    actual: str | None = None
    recommendation: str | None = None
    code: str | None = None
    discipline: str = SITE_GEO_DISCIPLINE
    perspective: str = SITE_GEO_PERSPECTIVE
    layer: str = "domain_integrity"

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["ruleId"] = payload.pop("rule_id")
        payload["elementIds"] = list(payload.pop("element_ids"))
        payload["trackerItems"] = list(payload.pop("tracker_items"))
        if payload.get("code") is None:
            payload["code"] = payload["ruleId"]
        return {key: value for key, value in payload.items() if value not in (None, [], ())}


def site_georeferencing_report_v1(subject: Any) -> dict[str, Any]:
    """Deterministic BIR-S01 through BIR-S06 diagnostics for site exchange work."""

    elements = _elements(subject)
    findings = [
        *project_coordinate_system_diagnostics_v1(elements),
        *linked_model_transform_diagnostics_v1(elements),
        *site_relationship_diagnostics_v1(elements),
        *multi_building_shared_coordinate_diagnostics_v1(elements),
    ]
    severity_counts = Counter(f.severity for f in findings)
    tracker_counts = Counter(item for f in findings for item in f.tracker_items)
    return {
        "format": "siteGeoreferencingIntegrityReport_v1",
        "deterministic": True,
        "trackerItems": list(SITE_GEOREFERENCING_TRACKER_ITEMS),
        "ok": not any(f.severity == "error" for f in findings),
        "summary": {
            "findingCount": len(findings),
            "severityCounts": dict(sorted(severity_counts.items())),
            "trackerItemCounts": dict(sorted(tracker_counts.items())),
        },
        "coordinateSystems": project_coordinate_system_summary_v1(elements),
        "linkTransforms": linked_model_transform_summary_v1(elements),
        "siteRelationships": site_relationship_summary_v1(elements),
        "multiBuilding": multi_building_shared_coordinate_summary_v1(elements),
        "findings": [f.to_dict() for f in _sort_findings(findings)],
    }


def check_site_georeferencing_integrity(subject: Any) -> list[dict[str, Any]]:
    """Return normalized findings suitable for the domain integrity aggregator."""

    report = site_georeferencing_report_v1(subject)
    out: list[dict[str, Any]] = []
    for finding in report["findings"]:
        row = dict(finding)
        row.setdefault("priority", _priority_for(row.get("trackerItems") or []))
        row.setdefault("source", "site_georeferencing")
        row.setdefault("blocking", row.get("severity") == "error")
        row.setdefault("blockingClass", "domain_integrity")
        out.append(row)
    return out


def project_coordinate_system_summary_v1(subject: Any) -> dict[str, Any]:
    elements = _elements(subject)
    pbps = _by_kind(elements, "project_base_point")
    surveys = _by_kind(elements, "survey_point")
    origins = _by_kind(elements, "internal_origin")
    settings = _by_kind(elements, "project_settings")
    levels = _by_kind(elements, "level")

    pbp = pbps[0] if pbps else None
    survey = surveys[0] if surveys else None
    georef = _get(settings[0], "georeference") if settings else None
    true_north = _num(_get(pbp, "angle_to_true_north_deg", "angleToTrueNorthDeg"), 0.0)
    level_datums = [
        {
            "id": _id(level),
            "elevationMm": _num(_get(level, "elevation_mm", "elevationMm"), 0.0),
            "datumKind": _get(level, "datum_kind", "datumKind"),
        }
        for level in levels
    ]

    return {
        "schemaVersion": 1,
        "projectBasePointIds": [_id(e) for e in pbps],
        "surveyPointIds": [_id(e) for e in surveys],
        "internalOriginIds": [_id(e) for e in origins],
        "projectSettingsIds": [_id(e) for e in settings],
        "trueNorthDeg": true_north,
        "projectNorthDeg": 0.0,
        "georeferencePresent": isinstance(georef, Mapping),
        "levelDatumCount": len(level_datums),
        "levelDatums": sorted(level_datums, key=lambda row: (row["elevationMm"], row["id"])),
        "exportable": bool(pbp and survey and origins and levels),
    }


def project_coordinate_system_diagnostics_v1(subject: Any) -> list[SiteGeoreferencingFinding]:
    elements = _elements(subject)
    findings: list[SiteGeoreferencingFinding] = []

    for kind, label in (
        ("project_base_point", "project base point"),
        ("survey_point", "survey point"),
        ("internal_origin", "internal origin"),
    ):
        rows = _by_kind(elements, kind)
        if not rows:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_coordinate_system_missing_datum",
                    severity="error" if kind != "internal_origin" else "warning",
                    message=f"Missing {label}; project/site coordinates are not explicit.",
                    tracker_items=("BIR-S01",),
                    field=kind,
                    expected="one explicit datum",
                    actual="missing",
                    recommendation="Create the missing project datum before exchange or link alignment.",
                )
            )
        elif len(rows) > 1:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_coordinate_system_duplicate_datum",
                    severity="warning",
                    message=f"Multiple {label} elements make coordinate export ambiguous.",
                    element_ids=tuple(_id(e) for e in rows),
                    tracker_items=("BIR-S01",),
                    field=kind,
                    expected="one explicit datum",
                    actual=str(len(rows)),
                    recommendation="Keep a single authoritative datum row.",
                )
            )

    for elem in [*_by_kind(elements, "project_base_point"), *_by_kind(elements, "survey_point")]:
        pos = _point3(_get(elem, "position_mm", "positionMm"))
        if pos is None:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_coordinate_system_invalid_datum_position",
                    severity="error",
                    message="Datum position is missing or non-finite.",
                    element_ids=(_id(elem),),
                    tracker_items=("BIR-S01",),
                    field="positionMm",
                    expected="finite xMm/yMm/zMm",
                    actual=str(_get(elem, "position_mm", "positionMm")),
                )
            )

    for pbp in _by_kind(elements, "project_base_point"):
        angle = _num(_get(pbp, "angle_to_true_north_deg", "angleToTrueNorthDeg"))
        lat = _num(_get(pbp, "latitude_deg", "latitudeDeg"))
        lon = _num(_get(pbp, "longitude_deg", "longitudeDeg"))
        if angle is None or abs(angle) > 360:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_coordinate_system_invalid_true_north",
                    severity="warning",
                    message="Project base point true-north angle is missing or outside +/-360 degrees.",
                    element_ids=(_id(pbp),),
                    tracker_items=("BIR-S01",),
                    field="angleToTrueNorthDeg",
                )
            )
        if lat is not None and not (-90 <= lat <= 90):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_coordinate_system_invalid_latitude",
                    severity="warning",
                    message="Project base point latitude is outside [-90, 90].",
                    element_ids=(_id(pbp),),
                    tracker_items=("BIR-S01",),
                    field="latitudeDeg",
                )
            )
        if lon is not None and not (-180 <= lon <= 180):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_coordinate_system_invalid_longitude",
                    severity="warning",
                    message="Project base point longitude is outside [-180, 180].",
                    element_ids=(_id(pbp),),
                    tracker_items=("BIR-S01",),
                    field="longitudeDeg",
                )
            )

    if not _by_kind(elements, "level"):
        findings.append(
            SiteGeoreferencingFinding(
                rule_id="site_coordinate_system_missing_level_datum",
                severity="error",
                message="No level datum exists for project/site elevation reconciliation.",
                tracker_items=("BIR-S01",),
                field="level",
                expected="at least one level",
                actual="0",
            )
        )

    return _sort_findings(findings)


def linked_model_transform_summary_v1(subject: Any) -> dict[str, Any]:
    elements = _elements(subject)
    rows = []
    for link in _link_rows(elements):
        transform = _link_transform_row(link)
        rows.append(transform)
    return {
        "schemaVersion": 1,
        "linkCount": len(rows),
        "linkIds": [row["id"] for row in rows],
        "links": sorted(rows, key=lambda row: row["id"]),
    }


def linked_model_transform_diagnostics_v1(subject: Any) -> list[SiteGeoreferencingFinding]:
    elements = _elements(subject)
    has_pbp = bool(_by_kind(elements, "project_base_point"))
    has_survey = bool(_by_kind(elements, "survey_point"))
    findings: list[SiteGeoreferencingFinding] = []

    for link in _link_rows(elements):
        link_id = _id(link)
        kind = _kind(link)
        mode = str(_get(link, "origin_alignment_mode", "originAlignmentMode") or "origin_to_origin")
        transform = _link_transform_row(link)
        if kind == "link_model" and not _get(link, "source_model_id", "sourceModelId"):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_missing_source_model",
                    severity="error",
                    message="Linked model is missing sourceModelId.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02",),
                    field="sourceModelId",
                )
            )
        if not _link_has_explicit_transform(link):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_transform_not_recorded",
                    severity="warning",
                    message="Link/import row has no explicit translation/origin transform.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02", "BIR-S03"),
                    field="translationMm",
                    recommendation="Record the import/link transform so placement can be audited.",
                )
            )
        if not _transform_row_is_finite(transform):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_transform_non_finite",
                    severity="error",
                    message="Link/import transform contains missing or non-finite values.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02",),
                    field="translationMm",
                    expected="finite translation, rotation, and unit scale values",
                    actual=str(transform),
                )
            )
        rotation = _num(_get(link, "rotation_deg", "rotationDeg"))
        if rotation is not None and abs(rotation) > 360:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_rotation_out_of_range",
                    severity="warning",
                    message="Link/import rotation is outside +/-360 degrees.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02",),
                    field="rotationDeg",
                    expected="-360..360",
                    actual=str(rotation),
                )
            )
        if kind in {"link_dxf", "link_external"} and not (
            _get(link, "source_path", "sourcePath")
            or _get(link, "source_name", "sourceName")
            or _get(link, "source_metadata", "sourceMetadata")
        ):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_import_missing_source_metadata",
                    severity="warning",
                    message="Imported/link row has no source path, source name, or source metadata.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02", "BIR-S03"),
                    field="sourceMetadata",
                )
            )
        if mode == "project_origin" and not has_pbp:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_project_origin_missing_base_point",
                    severity="error",
                    message="Link uses project-origin alignment but the host has no project base point.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02",),
                    field="originAlignmentMode",
                )
            )
        if mode == "shared_coords" and not has_survey:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_shared_coords_missing_survey_point",
                    severity="error",
                    message="Link uses shared coordinates but the host has no survey point.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02", "BIR-S06"),
                    field="originAlignmentMode",
                )
            )
        if _num(_get(link, "unit_scale_to_mm", "unitScaleToMm")) is None and kind == "link_dxf":
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_import_unit_scale_not_recorded",
                    severity="warning",
                    message="DXF link has no unitScaleToMm; imported coordinates cannot be audited.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02", "BIR-S03"),
                    field="unitScaleToMm",
                )
            )
        stale = _link_is_stale(link)
        if stale:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_source_stale_or_unloaded",
                    severity="warning",
                    message="Link/import source is stale, missing, parse-failed, or unloaded.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02", "BIR-S03"),
                    field="reloadStatus",
                    actual=str(_get(link, "reload_status", "reloadStatus")),
                )
            )
        findings.extend(_link_transform_drift_findings(link))

    return _sort_findings(findings)


def normalize_import_diagnostic_v1(
    diagnostic: Mapping[str, Any],
    *,
    operation_id: str,
    source_name: str | None = None,
) -> dict[str, Any]:
    code = str(diagnostic.get("code") or "").strip()
    category = str(diagnostic.get("category") or code).strip()
    severity = str(diagnostic.get("severity") or "warning").strip()
    if category not in SITE_GEO_IMPORT_DIAGNOSTIC_CODES:
        category = "unsupported_product"
    if severity not in {"error", "warning", "info"}:
        severity = "warning"
    element_ids = sorted(
        dict.fromkeys(str(eid) for eid in diagnostic.get("elementIds", ()) if str(eid).strip())
    )
    tracker_items = sorted(
        {"BIR-S03", *[str(item) for item in diagnostic.get("trackerItems", ()) if str(item)]}
    )
    if category == "transform_drift":
        tracker_items = sorted({*tracker_items, "BIR-S02", "BIR-S04"})
    return {
        "schemaVersion": 1,
        "operationId": operation_id,
        "sourceName": source_name,
        "code": code or f"import.{category}",
        "category": category,
        "severity": severity,
        "message": str(diagnostic.get("message") or category.replace("_", " ")),
        "elementIds": element_ids,
        "trackerItems": tracker_items,
        "discipline": SITE_GEO_DISCIPLINE,
        "perspective": SITE_GEO_PERSPECTIVE,
        "mapping": _mapping_diagnostic_payload(diagnostic),
        "expected": diagnostic.get("expected"),
        "actual": diagnostic.get("actual"),
    } | ({"blocking": True} if severity == "error" else {})


def import_diagnostic_report_v1(
    diagnostics: list[Mapping[str, Any]],
    *,
    operation_id: str,
    source_name: str | None = None,
) -> dict[str, Any]:
    rows = [
        normalize_import_diagnostic_v1(row, operation_id=operation_id, source_name=source_name)
        for row in diagnostics
    ]
    rows.sort(key=lambda row: (row["severity"], row["category"], row["code"], row["elementIds"]))
    category_counts = Counter(row["category"] for row in rows)
    severity_counts = Counter(row["severity"] for row in rows)
    tracker_counts = Counter(item for row in rows for item in row["trackerItems"])
    return {
        "format": "importDiagnosticContract_v1",
        "operationId": operation_id,
        "sourceName": source_name,
        "deterministic": True,
        "trackerItems": sorted(tracker_counts) or ["BIR-S03"],
        "ok": not any(row["severity"] == "error" for row in rows),
        "summary": {
            "diagnosticCount": len(rows),
            "categoryCounts": dict(sorted(category_counts.items())),
            "severityCounts": dict(sorted(severity_counts.items())),
            "trackerItemCounts": dict(sorted(tracker_counts.items())),
        },
        "mappingEvidence": [
            {
                "operationId": row["operationId"],
                "sourceName": row.get("sourceName"),
                "code": row["code"],
                "category": row["category"],
                "severity": row["severity"],
                "elementIds": row["elementIds"],
                "trackerItems": row["trackerItems"],
                "discipline": row["discipline"],
                "perspective": row["perspective"],
                "mapping": row["mapping"],
            }
            for row in rows
            if row.get("mapping")
        ],
        "diagnostics": rows,
    }


def roundtrip_drift_report_v1(
    source: Any,
    readback: Any,
    *,
    placement_tolerance_mm: float = 1.0,
) -> dict[str, Any]:
    source_elements = _elements(source)
    readback_elements = _elements(readback)
    source_ids = set(source_elements)
    readback_ids = set(readback_elements)
    all_ids = sorted(source_ids | readback_ids)
    rows: list[dict[str, Any]] = []

    for eid in all_ids:
        src = source_elements.get(eid)
        rb = readback_elements.get(eid)
        if src is None:
            rows.append(_roundtrip_row(eid, "unexpected_in_readback", "id"))
            continue
        if rb is None:
            rows.append(_roundtrip_row(eid, "missing_in_readback", "id"))
            continue
        src_fp = _element_fingerprint(src)
        rb_fp = _element_fingerprint(rb)
        if src_fp["kind"] != rb_fp["kind"]:
            rows.append(
                _roundtrip_row(
                    eid,
                    "category_drift",
                    "kind",
                    expected=src_fp["kind"],
                    actual=rb_fp["kind"],
                )
            )
        for field in ("typeId", "materialKey"):
            if src_fp.get(field) != rb_fp.get(field):
                rows.append(
                    _roundtrip_row(
                        eid,
                        f"{field}_drift",
                        field,
                        expected=src_fp.get(field),
                        actual=rb_fp.get(field),
                    )
                )
        placement_delta = _max_point_delta(src_fp["points"], rb_fp["points"])
        if placement_delta is None:
            if src_fp["points"] or rb_fp["points"]:
                rows.append(_roundtrip_row(eid, "geometry_point_count_drift", "points"))
        elif placement_delta > placement_tolerance_mm:
            rows.append(
                _roundtrip_row(
                    eid,
                    "placement_drift",
                    "points",
                    deltaMm=round(placement_delta, 6),
                    toleranceMm=placement_tolerance_mm,
                )
            )

    count_rows = _kind_count_drift_rows(source_elements, readback_elements)
    rows.extend(count_rows)
    rows.sort(key=lambda row: (str(row.get("status")), str(row.get("id")), str(row.get("field"))))
    status_counts = Counter(str(row.get("status")) for row in rows)
    return {
        "format": "roundtripDriftReport_v1",
        "deterministic": True,
        "trackerItems": ["BIR-S04"],
        "placementToleranceMm": placement_tolerance_mm,
        "ok": not rows,
        "summary": {
            "sourceElementCount": len(source_elements),
            "readbackElementCount": len(readback_elements),
            "driftCount": len(rows),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "drifts": rows,
    }


def site_relationship_summary_v1(subject: Any) -> dict[str, Any]:
    elements = _elements(subject)
    sites = _by_kind(elements, "site")
    topos = _by_kind(elements, "toposolid")
    floors = _by_kind(elements, "floor")
    property_lines = _by_kind(elements, "property_line")
    return {
        "schemaVersion": 1,
        "siteIds": [_id(e) for e in sites],
        "toposolidIds": [_id(e) for e in topos],
        "buildingFootprintIds": [_id(e) for e in floors if len(_polygon(e, "boundary_mm", "boundaryMm")) >= 3],
        "propertyLineIds": [_id(e) for e in property_lines],
        "setbackLineIds": [
            _id(e) for e in property_lines if _num(_get(e, "setback_mm", "setbackMm")) is not None
        ],
    }


def site_relationship_diagnostics_v1(subject: Any) -> list[SiteGeoreferencingFinding]:
    elements = _elements(subject)
    findings: list[SiteGeoreferencingFinding] = []
    sites = _by_kind(elements, "site")
    topos = _by_kind(elements, "toposolid")
    floors = _by_kind(elements, "floor")
    property_lines = _by_kind(elements, "property_line")
    topo_polys = [(topo, _polygon(topo, "boundary_mm", "boundaryMm")) for topo in topos]
    requires_site_context = bool(
        sites
        or topos
        or property_lines
        or any(
            _get(
                elem,
                "site_host_id",
                "siteHostId",
                "site_id",
                "siteId",
                "toposolid_id",
                "toposolidId",
                "hostToposolidId",
            )
            not in (None, "")
            for elem in elements.values()
        )
    )

    if requires_site_context and not sites:
        findings.append(
            SiteGeoreferencingFinding(
                rule_id="site_relationship_missing_site",
                severity="warning",
                message="No site element defines the parcel/site boundary.",
                tracker_items=("BIR-S05",),
            )
        )
    if requires_site_context and not topos:
        findings.append(
            SiteGeoreferencingFinding(
                rule_id="site_relationship_missing_toposolid",
                severity="warning",
                message="No toposolid terrain exists for site/building relationship checks.",
                tracker_items=("BIR-S05",),
            )
        )

    topo_ids = {_id(t) for t in topos}
    for wall in _by_kind(elements, "wall"):
        site_host_id = _get(wall, "site_host_id", "siteHostId")
        if site_host_id and site_host_id not in topo_ids:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_wall_invalid_toposolid_host",
                    severity="error",
                    message="Wall siteHostId does not reference an existing toposolid.",
                    element_ids=(_id(wall), str(site_host_id)),
                    tracker_items=("BIR-S05",),
                    field="siteHostId",
                )
            )

    for floor in floors:
        boundary = _polygon(floor, "boundary_mm", "boundaryMm")
        if len(boundary) < 3:
            continue
        centroid = _centroid(boundary)
        if topo_polys and not any(_point_in_polygon(centroid, poly) for _, poly in topo_polys if poly):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_building_outside_toposolid",
                    severity="warning",
                    message="Building footprint centroid is outside all toposolid boundaries.",
                    element_ids=(_id(floor),),
                    tracker_items=("BIR-S05",),
                    field="boundaryMm",
                )
            )
        if topo_polys and not any(
            _polygon_inside_polygon(boundary, poly) for _, poly in topo_polys if poly
        ):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_building_partially_outside_toposolid",
                    severity="error",
                    message="Building footprint is not fully contained by any toposolid boundary.",
                    element_ids=(_id(floor),),
                    tracker_items=("BIR-S05",),
                    field="boundaryMm",
                )
            )

    site_polys = [(site, _polygon(site, "boundary_mm", "boundaryMm")) for site in sites]
    site_ids = {_id(site) for site in sites}
    for topo, topo_poly in topo_polys:
        topo_id = _id(topo)
        if len(topo_poly) < 3 or abs(_polygon_area(topo_poly)) < 1e-6:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_toposolid_degenerate_boundary",
                    severity="error",
                    message="Toposolid boundary is missing, degenerate, or has fewer than three points.",
                    element_ids=(topo_id,),
                    tracker_items=("BIR-S05",),
                    field="boundaryMm",
                    expected="non-degenerate polygon with at least three points",
                    actual=str(len(topo_poly)),
                )
            )
            continue
        site_host_id = _get(topo, "site_id", "siteId")
        if site_host_id and site_host_id not in site_ids:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_toposolid_invalid_site_host",
                    severity="error",
                    message="Toposolid siteId does not reference an existing site.",
                    element_ids=(topo_id, str(site_host_id)),
                    tracker_items=("BIR-S05",),
                    field="siteId",
                )
            )
        topo_centroid = _centroid(topo_poly)
        if site_polys and not any(_point_in_polygon(topo_centroid, poly) for _, poly in site_polys if poly):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_toposolid_outside_site",
                    severity="warning",
                    message="Toposolid centroid is outside all site boundaries.",
                    element_ids=(topo_id,),
                    tracker_items=("BIR-S05",),
                    field="boundaryMm",
                )
            )
        if site_polys and not any(
            _polygon_inside_polygon(topo_poly, poly) for _, poly in site_polys if poly
        ):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_toposolid_partially_outside_site",
                    severity="error",
                    message="Toposolid boundary is not fully contained by any site boundary.",
                    element_ids=(topo_id,),
                    tracker_items=("BIR-S05",),
                    field="boundaryMm",
                )
            )

    for floor in floors:
        topo_host_id = _get(floor, "site_host_id", "siteHostId", "toposolid_id", "toposolidId", "hostToposolidId")
        if not topo_host_id:
            continue
        floor_id = _id(floor)
        host_poly = next((poly for topo, poly in topo_polys if _id(topo) == str(topo_host_id)), None)
        if host_poly is None:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_building_invalid_toposolid_host",
                    severity="error",
                    message="Building footprint references a missing toposolid host.",
                    element_ids=(floor_id, str(topo_host_id)),
                    tracker_items=("BIR-S05",),
                    field="siteHostId",
                )
            )
            continue
        boundary = _polygon(floor, "boundary_mm", "boundaryMm")
        if len(boundary) >= 3 and not _point_in_polygon(_centroid(boundary), host_poly):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_building_outside_host_toposolid",
                    severity="error",
                    message="Building footprint centroid is outside its referenced toposolid host.",
                    element_ids=(floor_id, str(topo_host_id)),
                    tracker_items=("BIR-S05",),
                    field="siteHostId",
                )
            )
        if len(boundary) >= 3 and not _polygon_inside_polygon(boundary, host_poly):
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_building_partially_outside_host_toposolid",
                    severity="error",
                    message="Building footprint is not fully contained by its referenced toposolid host.",
                    element_ids=(floor_id, str(topo_host_id)),
                    tracker_items=("BIR-S05",),
                    field="siteHostId",
                )
            )

    for prop in property_lines:
        closure_error = _num(_get(prop, "closure_error_mm", "closureErrorMm"))
        if closure_error is not None and closure_error > 10:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_relationship_property_line_closure_error",
                    severity="warning",
                    message="Property line closure error exceeds 10 mm.",
                    element_ids=(_id(prop),),
                    tracker_items=("BIR-S05",),
                    field="closureErrorMm",
                    actual=str(closure_error),
                    expected="<= 10",
                )
            )

    return _sort_findings(findings)


def multi_building_shared_coordinate_summary_v1(subject: Any) -> dict[str, Any]:
    elements = _elements(subject)
    groups: dict[str, list[str]] = defaultdict(list)
    for elem in elements.values():
        if _kind(elem) not in {"floor", "wall", "roof", "mass"}:
            continue
        groups[_building_id(elem)].append(_id(elem))
    buildings = [
        {"buildingId": bid, "elementIds": sorted(ids), "elementCount": len(ids)}
        for bid, ids in sorted(groups.items())
    ]
    shared_links = [
        _id(link)
        for link in _link_rows(elements)
        if str(_get(link, "origin_alignment_mode", "originAlignmentMode") or "") == "shared_coords"
    ]
    shared_rows = [
        {
            "id": _id(link),
            "kind": _kind(link),
            "sourceModelId": _get(link, "source_model_id", "sourceModelId"),
            "sourceName": _get(link, "source_name", "sourceName"),
            "transform": _link_transform_row(link),
        }
        for link in _link_rows(elements)
        if str(_get(link, "origin_alignment_mode", "originAlignmentMode") or "") == "shared_coords"
    ]
    survey_point_count = len(_by_kind(elements, "survey_point"))
    return {
        "schemaVersion": 1,
        "buildingCount": len(buildings),
        "buildingIds": [row["buildingId"] for row in buildings],
        "buildings": buildings,
        "sharedCoordinateLinkIds": sorted(shared_links),
        "sharedCoordinateRows": sorted(shared_rows, key=lambda row: row["id"]),
        "surveyPointCount": survey_point_count,
        "hasSharedCoordinateAnchor": survey_point_count > 0 and bool(shared_links),
    }


def multi_building_shared_coordinate_diagnostics_v1(subject: Any) -> list[SiteGeoreferencingFinding]:
    elements = _elements(subject)
    summary = multi_building_shared_coordinate_summary_v1(elements)
    findings: list[SiteGeoreferencingFinding] = []
    if summary["buildingCount"] > 1 and summary["surveyPointCount"] == 0:
        all_ids = tuple(eid for building in summary["buildings"] for eid in building["elementIds"][:3])
        findings.append(
            SiteGeoreferencingFinding(
                rule_id="site_multi_building_missing_shared_coordinates",
                severity="warning",
                message="Multiple buildings are modeled without a survey point/shared-coordinate anchor.",
                element_ids=all_ids,
                tracker_items=("BIR-S06",),
                field="survey_point",
            )
        )
    if summary["buildingCount"] > 1 and not summary["sharedCoordinateLinkIds"]:
        findings.append(
            SiteGeoreferencingFinding(
                rule_id="site_multi_building_no_shared_coordinate_links",
                severity="info",
                message="Multiple buildings exist, but no link/import row uses shared-coordinate alignment.",
                tracker_items=("BIR-S06",),
                field="originAlignmentMode",
            )
        )
    return _sort_findings(findings)


def _priority_for(tracker_items: list[str]) -> str:
    if any(item in {"BIR-S01", "BIR-S02"} for item in tracker_items):
        return "P0"
    if any(item in {"BIR-S03", "BIR-S04", "BIR-S05"} for item in tracker_items):
        return "P1"
    return "P2"


def _elements(subject: Any) -> dict[str, Any]:
    if isinstance(subject, Document):
        return dict(subject.elements)
    if hasattr(subject, "elements") and isinstance(subject.elements, Mapping):
        return dict(subject.elements)
    if isinstance(subject, Mapping):
        raw = subject.get("elements")
        if isinstance(raw, Mapping):
            return dict(raw)
        if all(isinstance(key, str) for key in subject.keys()):
            return dict(subject)
    return {}


def _by_kind(elements: Mapping[str, Any], kind: str) -> list[Any]:
    return [elem for _, elem in sorted(elements.items()) if _kind(elem) == kind]


def _kind(elem: Any) -> str:
    value = _get(elem, "kind")
    return str(value or "")


def _id(elem: Any) -> str:
    return str(_get(elem, "id") or "")


def _get(elem: Any, *names: str) -> Any:
    if elem is None:
        return None
    if isinstance(elem, Mapping):
        for name in names:
            if name in elem:
                return elem[name]
        return None
    for name in names:
        if hasattr(elem, name):
            return getattr(elem, name)
    return None


def _num(value: Any, default: float | None = None) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return default


def _point2(value: Any) -> tuple[float, float] | None:
    if isinstance(value, Mapping):
        x = _num(value.get("xMm"))
        y = _num(value.get("yMm"))
    else:
        x = _num(_get(value, "x_mm", "xMm"))
        y = _num(_get(value, "y_mm", "yMm"))
    if x is None or y is None:
        return None
    return (x, y)


def _point3(value: Any) -> tuple[float, float, float] | None:
    if isinstance(value, Mapping):
        x = _num(value.get("xMm"))
        y = _num(value.get("yMm"))
        z = _num(value.get("zMm"))
    else:
        x = _num(_get(value, "x_mm", "xMm"))
        y = _num(_get(value, "y_mm", "yMm"))
        z = _num(_get(value, "z_mm", "zMm"))
    if x is None or y is None or z is None:
        return None
    return (x, y, z)


def _polygon(elem: Any, *names: str) -> list[tuple[float, float]]:
    raw = _get(elem, *names)
    if not isinstance(raw, list):
        return []
    points = [_point2(row) for row in raw]
    return [pt for pt in points if pt is not None]


def _centroid(points: list[tuple[float, float]]) -> tuple[float, float]:
    if not points:
        return (0.0, 0.0)
    return (
        sum(point[0] for point in points) / len(points),
        sum(point[1] for point in points) / len(points),
    )


def _point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    if len(polygon) < 3:
        return False
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        ):
            inside = not inside
        j = i
    return inside


def _point_on_segment(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
    tolerance: float = 1e-6,
) -> bool:
    px, py = point
    sx, sy = start
    ex, ey = end
    cross = (py - sy) * (ex - sx) - (px - sx) * (ey - sy)
    if abs(cross) > tolerance:
        return False
    dot = (px - sx) * (ex - sx) + (py - sy) * (ey - sy)
    if dot < -tolerance:
        return False
    length_sq = (ex - sx) ** 2 + (ey - sy) ** 2
    return dot <= length_sq + tolerance


def _point_in_or_on_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    if len(polygon) < 3:
        return False
    for idx, start in enumerate(polygon):
        if _point_on_segment(point, start, polygon[(idx + 1) % len(polygon)]):
            return True
    return _point_in_polygon(point, polygon)


def _polygon_inside_polygon(
    inner: list[tuple[float, float]], outer: list[tuple[float, float]]
) -> bool:
    return (
        len(inner) >= 3
        and len(outer) >= 3
        and all(_point_in_or_on_polygon(point, outer) for point in inner)
    )


def _polygon_area(points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    for idx, (x1, y1) in enumerate(points):
        x2, y2 = points[(idx + 1) % len(points)]
        area += x1 * y2 - x2 * y1
    return area / 2.0


def _link_rows(elements: Mapping[str, Any]) -> list[Any]:
    return [
        elem
        for _, elem in sorted(elements.items())
        if _kind(elem) in {"link_model", "link_dxf", "link_external"}
    ]


def _link_transform_row(link: Any) -> dict[str, Any]:
    pos3 = _point3(_get(link, "position_mm", "positionMm"))
    origin2 = _point2(_get(link, "origin_mm", "originMm"))
    translation3 = _point3(_get(link, "translation_mm", "translationMm"))
    translation = translation3 or pos3
    if translation is not None:
        x_mm, y_mm, z_mm = translation
    elif origin2 is not None:
        x_mm, y_mm, z_mm = origin2[0], origin2[1], 0.0
    else:
        x_mm, y_mm, z_mm = 0.0, 0.0, 0.0
    return {
        "id": _id(link),
        "kind": _kind(link),
        "originAlignmentMode": str(
            _get(link, "origin_alignment_mode", "originAlignmentMode") or "origin_to_origin"
        ),
        "translationMm": {
            "xMm": x_mm,
            "yMm": y_mm,
            "zMm": z_mm,
        },
        "rotationDeg": _num(_get(link, "rotation_deg", "rotationDeg"), 0.0),
        "unitScaleToMm": _num(_get(link, "unit_scale_to_mm", "unitScaleToMm")),
        "loaded": _get(link, "loaded") is not False,
        "reloadStatus": _get(link, "reload_status", "reloadStatus"),
        "visibilityMode": _get(link, "visibility_mode", "visibilityMode"),
        "hidden": bool(_get(link, "hidden") or False),
        "pinned": bool(_get(link, "pinned") or False),
    }


def _link_has_explicit_transform(link: Any) -> bool:
    return any(
        _get(link, *names) is not None
        for names in (
            ("position_mm", "positionMm"),
            ("origin_mm", "originMm"),
            ("translation_mm", "translationMm"),
        )
    )


def _transform_row_is_finite(row: Mapping[str, Any]) -> bool:
    translation = row.get("translationMm")
    if not isinstance(translation, Mapping):
        return False
    if any(_num(translation.get(axis)) is None for axis in ("xMm", "yMm", "zMm")):
        return False
    if _num(row.get("rotationDeg")) is None:
        return False
    unit = row.get("unitScaleToMm")
    return unit is None or _num(unit) is not None


def _link_is_stale(link: Any) -> bool:
    if _get(link, "loaded") is False:
        return True
    if _get(link, "stale", "isStale") is True:
        return True
    status = str(_get(link, "reload_status", "reloadStatus") or "")
    return status in {"source_missing", "parse_error", "unloaded", "stale", "out_of_date", "needs_reload"}


def _link_transform_drift_findings(link: Any) -> list[SiteGeoreferencingFinding]:
    expected = _transform_payload(
        _get(link, "expected_transform", "expectedTransform", "sourceTransform")
    )
    actual = _transform_payload(
        _get(link, "actual_transform", "actualTransform", "readbackTransform")
    )
    if expected is None or actual is None:
        return []

    findings: list[SiteGeoreferencingFinding] = []
    link_id = _id(link)
    for axis in ("xMm", "yMm", "zMm"):
        exp = _num(expected["translationMm"].get(axis))
        act = _num(actual["translationMm"].get(axis))
        if exp is None or act is None:
            continue
        delta = abs(act - exp)
        if delta > LINK_TRANSLATION_TOLERANCE_MM:
            findings.append(
                SiteGeoreferencingFinding(
                    rule_id="site_link_transform_drift",
                    severity="error",
                    message="Link/import readback transform drift exceeds placement tolerance.",
                    element_ids=(link_id,),
                    tracker_items=("BIR-S02", "BIR-S04"),
                    field=f"translationMm.{axis}",
                    expected=str(exp),
                    actual=str(act),
                    recommendation="Re-acquire coordinates or reject the import/readback as placement drift.",
                )
            )
    exp_rot = _num(expected.get("rotationDeg"))
    act_rot = _num(actual.get("rotationDeg"))
    if exp_rot is not None and act_rot is not None and abs(act_rot - exp_rot) > LINK_ROTATION_TOLERANCE_DEG:
        findings.append(
            SiteGeoreferencingFinding(
                rule_id="site_link_transform_drift",
                severity="error",
                message="Link/import readback rotation drift exceeds tolerance.",
                element_ids=(link_id,),
                tracker_items=("BIR-S02", "BIR-S04"),
                field="rotationDeg",
                expected=str(exp_rot),
                actual=str(act_rot),
                recommendation="Re-acquire coordinates or reject the import/readback as rotation drift.",
            )
        )
    return findings


def _transform_payload(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    translation = value.get("translationMm") or value.get("positionMm") or value.get("originMm")
    if not isinstance(translation, Mapping):
        return None
    return {
        "translationMm": {
            "xMm": _num(translation.get("xMm"), 0.0),
            "yMm": _num(translation.get("yMm"), 0.0),
            "zMm": _num(translation.get("zMm"), 0.0),
        },
        "rotationDeg": _num(value.get("rotationDeg"), 0.0),
    }


def _mapping_diagnostic_payload(diagnostic: Mapping[str, Any]) -> dict[str, Any] | None:
    keys = ("sourceCategory", "mappedCategory", "mappingSupported", "fallbackCategory")
    payload = {key: diagnostic.get(key) for key in keys if key in diagnostic}
    return payload or None


def _element_fingerprint(elem: Any) -> dict[str, Any]:
    kind = _kind(elem)
    points: list[tuple[float, float]] = []
    for names in (
        ("start",),
        ("end",),
        ("position_mm", "positionMm"),
        ("origin_mm", "originMm"),
    ):
        point = _point2(_get(elem, *names))
        if point is not None:
            points.append(point)
    for names in (("boundary_mm", "boundaryMm"), ("footprint_mm", "footprintMm")):
        points.extend(_polygon(elem, *names))
    type_id = next(
        (
            str(value)
            for value in (
                _get(elem, "wall_type_id", "wallTypeId"),
                _get(elem, "floor_type_id", "floorTypeId"),
                _get(elem, "roof_type_id", "roofTypeId"),
                _get(elem, "family_type_id", "familyTypeId"),
            )
            if value
        ),
        None,
    )
    material = _get(elem, "material_key", "materialKey", "default_material_key", "defaultMaterialKey")
    return {
        "kind": kind,
        "points": points,
        "typeId": type_id,
        "materialKey": str(material) if material else None,
    }


def _max_point_delta(
    source: list[tuple[float, float]], readback: list[tuple[float, float]]
) -> float | None:
    if len(source) != len(readback):
        return None
    if not source:
        return 0.0
    return max(math.dist(a, b) for a, b in zip(source, readback, strict=True))


def _kind_count_drift_rows(
    source: Mapping[str, Any], readback: Mapping[str, Any]
) -> list[dict[str, Any]]:
    src_counts = Counter(_kind(elem) for elem in source.values())
    rb_counts = Counter(_kind(elem) for elem in readback.values())
    rows = []
    for kind in sorted(set(src_counts) | set(rb_counts)):
        if src_counts[kind] != rb_counts[kind]:
            rows.append(
                _roundtrip_row(
                    f"kind:{kind}",
                    "element_count_drift",
                    "kindCount",
                    expected=src_counts[kind],
                    actual=rb_counts[kind],
                )
            )
    return rows


def _roundtrip_row(eid: str, status: str, field: str, **extra: Any) -> dict[str, Any]:
    severity = "error" if status in {"missing_in_readback", "category_drift", "placement_drift"} else "warning"
    return {
        "schemaVersion": 1,
        "id": eid,
        "status": status,
        "field": field,
        "severity": severity,
        "trackerItems": ["BIR-S04"],
        "discipline": SITE_GEO_DISCIPLINE,
        "perspective": SITE_GEO_PERSPECTIVE,
        **{key: value for key, value in extra.items() if value is not None},
    }


def _building_id(elem: Any) -> str:
    props = _get(elem, "props") or {}
    if isinstance(props, Mapping):
        raw = props.get("buildingId") or props.get("building_id")
        if raw:
            return str(raw)
    raw = _get(elem, "building_id", "buildingId")
    return str(raw) if raw else "default"


def _sort_findings(
    findings: list[SiteGeoreferencingFinding],
) -> list[SiteGeoreferencingFinding]:
    return sorted(
        findings,
        key=lambda f: (
            f.severity,
            f.rule_id,
            f.element_ids,
            f.field or "",
        ),
    )
