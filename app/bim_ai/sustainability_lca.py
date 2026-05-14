"""Sustainability lens readouts over the shared material and assembly model."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Literal, cast

from bim_ai.document import DesignOption, Document
from bim_ai.elements import (
    CircularityProperties,
    FloorElem,
    MaterialElem,
    MaterialImpactProperties,
    RoofElem,
    WallElem,
)
from bim_ai.material_assembly_resolve import (
    assembly_material_keys_digest,
    material_catalog_audit_rows,
    resolved_layers_for_floor,
    resolved_layers_for_roof,
    resolved_layers_for_wall,
)
from bim_ai.type_material_registry import material_display_label

SUSTAINABILITY_LENS_ID = "sustainability"

ImpactStatus = Literal[
    "calculated",
    "missing_material",
    "missing_impact_data",
    "missing_epd_reference",
    "missing_source_reference",
    "unsupported_unit",
    "missing_density",
]


@dataclass(frozen=True)
class HostLayerQuantity:
    host_element_id: str
    host_kind: Literal["wall", "floor", "roof"]
    host_name: str
    assembly_type_id: str
    material_keys_digest: str
    layer_index: int
    layer_function: str
    material_key: str
    gross_area_m2: float
    gross_volume_m3: float
    level_id: str
    option_set_id: str
    option_id: str


def sustainability_schedule_defaults() -> list[dict[str, Any]]:
    """Default schedules required by the Sustainability / LCA lens."""

    return [
        {
            "id": "sustainability-material-impact",
            "name": "Material impact schedule",
            "category": "material_impact",
        },
        {
            "id": "sustainability-element-carbon",
            "name": "Element carbon schedule",
            "category": "element_carbon",
        },
        {
            "id": "sustainability-assembly-carbon",
            "name": "Assembly carbon schedule",
            "category": "assembly_carbon",
        },
        {
            "id": "sustainability-circularity",
            "name": "Reuse/circularity schedule",
            "category": "circularity",
        },
        {
            "id": "sustainability-scenario-comparison",
            "name": "Scenario impact comparison",
            "category": "scenario_impact_comparison",
        },
        {
            "id": "sustainability-missing-epd",
            "name": "Missing EPD/data-quality report",
            "category": "missing_sustainability_data",
        },
    ]


def _polygon_area_m2(points: list[Any]) -> float:
    if len(points) < 3:
        return 0.0
    acc = 0.0
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        acc += float(p.x_mm) * float(q.y_mm) - float(q.x_mm) * float(p.y_mm)
    return abs(acc) / 2_000_000.0


def _wall_length_m(wall: WallElem) -> float:
    dx = float(wall.end.x_mm) - float(wall.start.x_mm)
    dy = float(wall.end.y_mm) - float(wall.start.y_mm)
    return (dx * dx + dy * dy) ** 0.5 / 1000.0


def collect_host_layer_quantities(doc: Document) -> list[HostLayerQuantity]:
    """Layer quantities for the LCA lens, derived from the same assemblies as schedules/IFC."""

    rows: list[HostLayerQuantity] = []

    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WallElem)):
        wall = cast(WallElem, doc.elements[eid])
        layers = resolved_layers_for_wall(doc, wall)
        material_keys = [str(layer.get("materialKey") or "").strip() for layer in layers]
        area_m2 = _wall_length_m(wall) * float(wall.height_mm) / 1000.0
        for idx, layer in enumerate(layers):
            thickness_m = float(layer["thicknessMm"]) / 1000.0
            rows.append(
                HostLayerQuantity(
                    host_element_id=wall.id,
                    host_kind="wall",
                    host_name=wall.name,
                    assembly_type_id=(wall.wall_type_id or "").strip(),
                    material_keys_digest=assembly_material_keys_digest(material_keys),
                    layer_index=idx,
                    layer_function=str(layer.get("function") or ""),
                    material_key=str(layer.get("materialKey") or "").strip(),
                    gross_area_m2=area_m2,
                    gross_volume_m3=area_m2 * thickness_m,
                    level_id=wall.level_id,
                    option_set_id=(wall.option_set_id or "").strip(),
                    option_id=(wall.option_id or "").strip(),
                )
            )

    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, FloorElem)):
        floor = cast(FloorElem, doc.elements[eid])
        layers = resolved_layers_for_floor(doc, floor)
        material_keys = [str(layer.get("materialKey") or "").strip() for layer in layers]
        area_m2 = _polygon_area_m2(list(floor.boundary_mm))
        for idx, layer in enumerate(layers):
            thickness_m = float(layer["thicknessMm"]) / 1000.0
            rows.append(
                HostLayerQuantity(
                    host_element_id=floor.id,
                    host_kind="floor",
                    host_name=floor.name,
                    assembly_type_id=(floor.floor_type_id or "").strip(),
                    material_keys_digest=assembly_material_keys_digest(material_keys),
                    layer_index=idx,
                    layer_function=str(layer.get("function") or ""),
                    material_key=str(layer.get("materialKey") or "").strip(),
                    gross_area_m2=area_m2,
                    gross_volume_m3=area_m2 * thickness_m,
                    level_id=floor.level_id,
                    option_set_id=(floor.option_set_id or "").strip(),
                    option_id=(floor.option_id or "").strip(),
                )
            )

    for eid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        roof = cast(RoofElem, doc.elements[eid])
        layers = resolved_layers_for_roof(doc, roof)
        if not layers:
            continue
        material_keys = [str(layer.get("materialKey") or "").strip() for layer in layers]
        area_m2 = _polygon_area_m2(list(roof.footprint_mm))
        for idx, layer in enumerate(layers):
            thickness_m = float(layer["thicknessMm"]) / 1000.0
            rows.append(
                HostLayerQuantity(
                    host_element_id=roof.id,
                    host_kind="roof",
                    host_name=roof.name,
                    assembly_type_id=(roof.roof_type_id or "").strip(),
                    material_keys_digest=assembly_material_keys_digest(material_keys),
                    layer_index=idx,
                    layer_function=str(layer.get("function") or ""),
                    material_key=str(layer.get("materialKey") or "").strip(),
                    gross_area_m2=area_m2,
                    gross_volume_m3=area_m2 * thickness_m,
                    level_id=roof.reference_level_id,
                    option_set_id=(roof.option_set_id or "").strip(),
                    option_id=(roof.option_id or "").strip(),
                )
            )

    rows.sort(key=lambda r: (r.host_kind, r.host_element_id, r.layer_index))
    return rows


def _material_impact(doc: Document, material_key: str) -> MaterialImpactProperties | None:
    material = doc.elements.get(material_key)
    if isinstance(material, MaterialElem):
        if material.sustainability is not None:
            return material.sustainability
        raw = (material.physical or {}).get("sustainability") or {}
        if isinstance(raw, dict) and raw:
            return MaterialImpactProperties.model_validate(raw)
    return None


def _material_circularity(doc: Document, material_key: str) -> CircularityProperties | None:
    material = doc.elements.get(material_key)
    if isinstance(material, MaterialElem):
        return material.circularity
    return None


def _density_kg_per_m3(doc: Document, material_key: str) -> float | None:
    material = doc.elements.get(material_key)
    if not isinstance(material, MaterialElem):
        return None
    raw = (material.physical or {}).get("densityKgPerM3")
    if raw is None:
        raw = (material.physical or {}).get("density_kg_per_m3")
    try:
        density = float(raw)
    except (TypeError, ValueError):
        return None
    return density if density > 0 else None


def impact_readout_for_quantity(doc: Document, q: HostLayerQuantity) -> dict[str, Any]:
    material_key = q.material_key
    material = doc.elements.get(material_key) if material_key else None
    impact = _material_impact(doc, material_key) if material_key else None

    status: ImpactStatus
    kg_co2e: float | None = None
    source_status = "complete"
    if not material_key or material is None:
        status = "missing_material"
    elif impact is None or impact.gwp_per_unit is None or not impact.gwp_unit:
        status = "missing_impact_data"
    elif not (impact.epd_reference or "").strip():
        status = "missing_epd_reference"
    elif not (impact.epd_source_url or "").strip():
        status = "missing_source_reference"
    elif impact.gwp_unit == "kgco2e_per_m3":
        status = "calculated"
        kg_co2e = float(impact.gwp_per_unit) * q.gross_volume_m3
    elif impact.gwp_unit == "kgco2e_per_m2":
        status = "calculated"
        kg_co2e = float(impact.gwp_per_unit) * q.gross_area_m2
    elif impact.gwp_unit == "kgco2e_per_kg":
        density = _density_kg_per_m3(doc, material_key)
        if density is None:
            status = "missing_density"
        else:
            status = "calculated"
            kg_co2e = float(impact.gwp_per_unit) * q.gross_volume_m3 * density
    else:
        status = "unsupported_unit"
    if status != "calculated":
        source_status = status

    circularity = _material_circularity(doc, material_key) if material_key else None
    return {
        "materialKey": material_key,
        "materialDisplay": material_display_label(doc, material_key or None),
        "epdReference": impact.epd_reference if impact else "",
        "epdSourceUrl": impact.epd_source_url if impact else "",
        "gwpPerUnit": impact.gwp_per_unit if impact else "",
        "gwpUnit": impact.gwp_unit if impact else "",
        "dataQualityLevel": impact.data_quality_level if impact else "",
        "biogenicCarbonNotes": impact.biogenic_carbon_notes if impact else "",
        "recycledContentPercent": impact.recycled_content_percent if impact else "",
        "reusePotential": impact.reuse_potential if impact else "",
        "serviceLifeYears": impact.service_life_years if impact else "",
        "endOfLifeScenario": impact.end_of_life_scenario if impact else "",
        "recyclability": circularity.recyclability if circularity else "",
        "hazardousMaterialWarning": circularity.hazardous_material_warning if circularity else "",
        "impactStatus": status,
        "impactSourceStatus": source_status,
        "embodiedCarbonKgCO2e": round(kg_co2e, 8) if kg_co2e is not None else "",
        "embodiedCarbonIntensityKgCO2ePerM2": (
            round(kg_co2e / q.gross_area_m2, 8)
            if kg_co2e is not None and q.gross_area_m2 > 0
            else ""
        ),
    }


def assembly_carbon_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    audit_by_host = {str(r["hostElementId"]): r for r in material_catalog_audit_rows(doc)}
    for q in collect_host_layer_quantities(doc):
        row: dict[str, Any] = {
            "elementId": f"{q.host_element_id}:layer-{q.layer_index}",
            "hostElementId": q.host_element_id,
            "hostKind": q.host_kind,
            "name": q.host_name,
            "assemblyTypeId": q.assembly_type_id,
            "assemblyMaterialKeysDigest": q.material_keys_digest,
            "layerIndex": q.layer_index,
            "layerFunction": q.layer_function,
            "grossAreaM2": round(q.gross_area_m2, 8),
            "grossVolumeM3": round(q.gross_volume_m3, 12),
            "levelId": q.level_id,
            "optionSetId": q.option_set_id,
            "optionId": q.option_id,
        }
        row.update(impact_readout_for_quantity(doc, q))
        audit_row = audit_by_host.get(q.host_element_id)
        if audit_row:
            row["catalogAuditStatus"] = audit_row.get("catalogStatus", "")
        rows.append(row)
    return rows


def element_carbon_rows(doc: Document) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in assembly_carbon_rows(doc):
        grouped[str(row["hostElementId"])].append(row)
    out: list[dict[str, Any]] = []
    for host_id in sorted(grouped):
        layers = grouped[host_id]
        first = layers[0]
        calculated = [
            float(r["embodiedCarbonKgCO2e"])
            for r in layers
            if isinstance(r.get("embodiedCarbonKgCO2e"), int | float)
        ]
        missing = [r for r in layers if r.get("impactStatus") != "calculated"]
        area = max(float(first.get("grossAreaM2") or 0.0), 0.0)
        total = round(sum(calculated), 8)
        out.append(
            {
                "elementId": host_id,
                "name": first["name"],
                "hostKind": first["hostKind"],
                "assemblyTypeId": first.get("assemblyTypeId", ""),
                "assemblyMaterialKeysDigest": first.get("assemblyMaterialKeysDigest", ""),
                "layerCount": len(layers),
                "grossAreaM2": round(area, 8),
                "embodiedCarbonKgCO2e": total,
                "embodiedCarbonIntensityKgCO2ePerM2": round(total / area, 8) if area > 0 else "",
                "impactStatus": "calculated" if not missing else "incomplete",
                "missingImpactLayerCount": len(missing),
                "levelId": first.get("levelId", ""),
                "optionSetId": first.get("optionSetId", ""),
                "optionId": first.get("optionId", ""),
            }
        )
    return out


def material_impact_rows(doc: Document) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in assembly_carbon_rows(doc):
        grouped[str(row.get("materialKey") or "")].append(row)
    out: list[dict[str, Any]] = []
    for key in sorted(grouped):
        rows = grouped[key]
        total = sum(
            float(r["embodiedCarbonKgCO2e"])
            for r in rows
            if isinstance(r.get("embodiedCarbonKgCO2e"), int | float)
        )
        first = rows[0]
        out.append(
            {
                "elementId": key or "__missing_material__",
                "materialKey": key,
                "materialDisplay": first.get("materialDisplay", ""),
                "hostCount": len({str(r.get("hostElementId") or "") for r in rows}),
                "layerCount": len(rows),
                "grossAreaM2": round(sum(float(r.get("grossAreaM2") or 0.0) for r in rows), 8),
                "grossVolumeM3": round(sum(float(r.get("grossVolumeM3") or 0.0) for r in rows), 12),
                "embodiedCarbonKgCO2e": round(total, 8),
                "impactStatus": "calculated"
                if all(r.get("impactStatus") == "calculated" for r in rows)
                else "incomplete",
                "missingImpactLayerCount": sum(
                    1 for r in rows if r.get("impactStatus") != "calculated"
                ),
                "epdReference": first.get("epdReference", ""),
                "epdSourceUrl": first.get("epdSourceUrl", ""),
                "gwpPerUnit": first.get("gwpPerUnit", ""),
                "gwpUnit": first.get("gwpUnit", ""),
                "dataQualityLevel": first.get("dataQualityLevel", ""),
                "biogenicCarbonNotes": first.get("biogenicCarbonNotes", ""),
                "recycledContentPercent": first.get("recycledContentPercent", ""),
                "reusePotential": first.get("reusePotential", ""),
                "serviceLifeYears": first.get("serviceLifeYears", ""),
                "endOfLifeScenario": first.get("endOfLifeScenario", ""),
            }
        )
    return out


def missing_sustainability_data_rows(doc: Document) -> list[dict[str, Any]]:
    return [
        {
            "elementId": row["elementId"],
            "hostElementId": row["hostElementId"],
            "hostKind": row["hostKind"],
            "name": row["name"],
            "layerIndex": row["layerIndex"],
            "materialKey": row.get("materialKey", ""),
            "materialDisplay": row.get("materialDisplay", ""),
            "impactStatus": row.get("impactStatus", ""),
            "epdReference": row.get("epdReference", ""),
            "epdSourceUrl": row.get("epdSourceUrl", ""),
            "dataQualityLevel": row.get("dataQualityLevel", ""),
        }
        for row in assembly_carbon_rows(doc)
        if row.get("impactStatus") != "calculated"
    ]


def _circularity_for_host(doc: Document, host_id: str) -> CircularityProperties | None:
    host = doc.elements.get(host_id)
    c = getattr(host, "circularity", None)
    return c if isinstance(c, CircularityProperties) else None


def circularity_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    material_by_host: dict[str, set[str]] = defaultdict(set)
    for q in collect_host_layer_quantities(doc):
        if q.material_key:
            material_by_host[q.host_element_id].add(q.material_key)
    for host in element_carbon_rows(doc):
        host_id = str(host["elementId"])
        circularity = _circularity_for_host(doc, host_id)
        material_warnings: list[str] = []
        material_reuse: list[str] = []
        for key in sorted(material_by_host.get(host_id, set())):
            mat_c = _material_circularity(doc, key)
            if mat_c and mat_c.hazardous_material_warning:
                material_warnings.append(f"{key}: {mat_c.hazardous_material_warning}")
            mat_i = _material_impact(doc, key)
            if mat_i and mat_i.reuse_potential:
                material_reuse.append(f"{key}: {mat_i.reuse_potential}")
        rows.append(
            {
                "elementId": host_id,
                "name": host["name"],
                "hostKind": host["hostKind"],
                "reusedComponent": circularity.reused_component if circularity else False,
                "demountability": circularity.demountability if circularity else "unknown",
                "recyclability": circularity.recyclability if circularity else "unknown",
                "materialPassportNotes": circularity.material_passport_notes if circularity else "",
                "hazardousMaterialWarning": (
                    circularity.hazardous_material_warning
                    if circularity and circularity.hazardous_material_warning
                    else "; ".join(material_warnings)
                ),
                "reusePotential": "; ".join(material_reuse),
                "materialKeyCount": len(material_by_host.get(host_id, set())),
                "embodiedCarbonKgCO2e": host.get("embodiedCarbonKgCO2e", ""),
                "impactStatus": host.get("impactStatus", ""),
            }
        )
    return rows


def _option_label(doc: Document, option_set_id: str, option_id: str) -> tuple[str, bool]:
    if not option_set_id or not option_id:
        return ("Base model", True)
    for option_set in doc.design_option_sets:
        if option_set.id != option_set_id:
            continue
        opt: DesignOption | None = next((o for o in option_set.options if o.id == option_id), None)
        if opt is not None:
            return (f"{option_set.name}: {opt.name}", bool(opt.is_primary))
    return (f"{option_set_id}: {option_id}", False)


def scenario_impact_comparison_rows(doc: Document) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in element_carbon_rows(doc):
        grouped[(str(row.get("optionSetId") or ""), str(row.get("optionId") or ""))].append(row)
    if not grouped:
        return []
    totals: dict[tuple[str, str], float] = {
        key: sum(float(r.get("embodiedCarbonKgCO2e") or 0.0) for r in rows)
        for key, rows in grouped.items()
    }
    baseline_key = next((key for key in totals if _option_label(doc, *key)[1]), sorted(totals)[0])
    baseline = totals[baseline_key]
    out: list[dict[str, Any]] = []
    for key in sorted(grouped):
        label, is_primary = _option_label(doc, *key)
        total = round(totals[key], 8)
        out.append(
            {
                "elementId": f"scenario:{key[0] or 'base'}:{key[1] or 'base'}",
                "optionSetId": key[0],
                "optionId": key[1],
                "scenarioName": label,
                "isBaseline": key == baseline_key,
                "isPrimaryOption": is_primary,
                "elementCount": len(grouped[key]),
                "embodiedCarbonKgCO2e": total,
                "scenarioDeltaKgCO2e": round(total - baseline, 8),
                "scenarioDeltaPercent": round((total - baseline) / baseline * 100.0, 6)
                if baseline
                else "",
            }
        )
    return out


def sustainability_rows_for_category(doc: Document, category: str) -> list[dict[str, Any]]:
    cat = category.lower().strip()
    if cat == "material_impact":
        return material_impact_rows(doc)
    if cat == "element_carbon":
        return element_carbon_rows(doc)
    if cat == "assembly_carbon":
        return assembly_carbon_rows(doc)
    if cat == "circularity":
        return circularity_rows(doc)
    if cat == "scenario_impact_comparison":
        return scenario_impact_comparison_rows(doc)
    if cat == "missing_sustainability_data":
        return missing_sustainability_data_rows(doc)
    return []


def sustainability_lens_manifest_v1(doc: Document) -> dict[str, Any]:
    element_rows = element_carbon_rows(doc)
    missing_rows = missing_sustainability_data_rows(doc)
    total = round(sum(float(r.get("embodiedCarbonKgCO2e") or 0.0) for r in element_rows), 8)
    return {
        "format": "sustainabilityLensManifest_v1",
        "lensId": SUSTAINABILITY_LENS_ID,
        "englishName": "Sustainability / LCA",
        "germanName": "Nachhaltigkeit / Oekobilanz",
        "schedules": sustainability_schedule_defaults(),
        "views": [
            {
                "id": "embodied-carbon-intensity",
                "name": "Color by embodied carbon intensity",
                "mode": "color_by_embodied_carbon_intensity",
                "sourceScheduleCategory": "element_carbon",
            },
            {
                "id": "missing-epd-data",
                "name": "Highlight missing EPD data",
                "mode": "highlight_missing_epd",
                "sourceScheduleCategory": "missing_sustainability_data",
            },
            {
                "id": "scenario-impact-comparison",
                "name": "Scenario comparison view",
                "mode": "scenario_delta",
                "sourceScheduleCategory": "scenario_impact_comparison",
            },
        ],
        "sheets": [
            {"id": "material-passport", "name": "Material passport sheet"},
            {"id": "sustainability-summary", "name": "Sustainability summary sheet"},
        ],
        "summary": {
            "elementCount": len(element_rows),
            "embodiedCarbonKgCO2e": total,
            "missingDataCount": len(missing_rows),
        },
        "apiContract": {
            "materialQuantities": True,
            "impactFactors": True,
            "epdReferences": True,
            "calculatedReadouts": True,
            "scenarioDeltas": True,
        },
    }


def sustainability_lca_export_v1(doc: Document) -> dict[str, Any]:
    return {
        "format": "sustainabilityLcaExport_v1",
        "lens": sustainability_lens_manifest_v1(doc),
        "materialImpactRows": material_impact_rows(doc),
        "elementCarbonRows": element_carbon_rows(doc),
        "assemblyCarbonRows": assembly_carbon_rows(doc),
        "circularityRows": circularity_rows(doc),
        "scenarioImpactComparisonRows": scenario_impact_comparison_rows(doc),
        "missingDataRows": missing_sustainability_data_rows(doc),
    }
