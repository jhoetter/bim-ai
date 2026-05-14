"""Energy Lens helpers for German Energieberatung handoff.

This module provides auditable model enrichment only. It computes type-level
U-value readouts and QA handoff rows; it does not implement GEG, DIN V 18599,
BEG, or BAFA compliance calculations.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    BuildingServicesHandoffElem,
    DoorElem,
    FloorElem,
    FloorTypeElem,
    MaterialElem,
    RenovationScenarioElem,
    RoofElem,
    RoofTypeElem,
    RoomElem,
    ThermalBridgeMarkerElem,
    WallElem,
    WallTypeElem,
    WindowElem,
)
from bim_ai.material_assembly_resolve import (
    resolved_layers_for_floor,
    resolved_layers_for_roof,
    resolved_layers_for_wall,
)


@dataclass(frozen=True)
class ThermalMaterialSpec:
    material_key: str
    display_name: str
    lambda_w_per_mk: float | None
    rho_kg_per_m3: float | None = None
    specific_heat_j_per_kgk: float | None = None
    mu: float | None = None
    source_reference: str = "DIN 4108-4 / DIN EN ISO 10456 typical value"


R_SI_M2K_PER_W = 0.13
R_SE_M2K_PER_W = 0.04

THERMAL_MATERIAL_LIBRARY: dict[str, ThermalMaterialSpec] = {
    "mineral_wool_wlg_035": ThermalMaterialSpec("mineral_wool_wlg_035", "Mineral wool WLG 035", 0.035, 35, 1030, 1),
    "eps_wlg_032": ThermalMaterialSpec("eps_wlg_032", "EPS WLG 032", 0.032, 20, 1450, 40),
    "sand_lime_brick": ThermalMaterialSpec("sand_lime_brick", "Sand-lime brick", 0.99, 1800, 1000, 15),
    "reinforced_concrete": ThermalMaterialSpec("reinforced_concrete", "Reinforced concrete", 2.3, 2400, 1000, 80),
    "gypsum_board": ThermalMaterialSpec("gypsum_board", "Gypsum board", 0.25, 850, 1090, 10),
    "osb": ThermalMaterialSpec("osb", "OSB", 0.13, 650, 1700, 50),
    "timber": ThermalMaterialSpec("timber", "Timber", 0.13, 500, 1600, 50),
    "aerated_concrete": ThermalMaterialSpec("aerated_concrete", "Aerated concrete", 0.16, 500, 1000, 5),
    "clay_brick": ThermalMaterialSpec("clay_brick", "Clay brick", 0.52, 1200, 1000, 10),
    "screed": ThermalMaterialSpec("screed", "Cement screed", 1.4, 2000, 1000, 30),
    "membrane": ThermalMaterialSpec("membrane", "Membrane", 0.17, 900, 1400, 10000),
    "roof_insulation_pir": ThermalMaterialSpec("roof_insulation_pir", "PIR roof insulation", 0.026, 32, 1400, 60),
    # Existing material keys used by the architecture/material catalogs.
    "timber_frame_insulation": ThermalMaterialSpec("timber_frame_insulation", "Timber frame + insulation", 0.04, 80, 1200, 2),
    "timber_stud": ThermalMaterialSpec("timber_stud", "Timber stud", 0.13, 500, 1600, 50),
    "plasterboard": ThermalMaterialSpec("plasterboard", "Plasterboard", 0.25, 850, 1090, 10),
    "plaster": ThermalMaterialSpec("plaster", "Plaster", 0.7, 1400, 1000, 10),
    "masonry_brick": ThermalMaterialSpec("masonry_brick", "Masonry brick", 0.52, 1200, 1000, 10),
    "masonry_block": ThermalMaterialSpec("masonry_block", "Masonry block", 0.35, 900, 1000, 8),
    "concrete_smooth": ThermalMaterialSpec("concrete_smooth", "Smooth concrete", 2.1, 2300, 1000, 80),
    "concrete": ThermalMaterialSpec("concrete", "Concrete", 2.1, 2300, 1000, 80),
    "screed_cement": ThermalMaterialSpec("screed_cement", "Cement screed", 1.4, 2000, 1000, 30),
    "vcl_membrane": ThermalMaterialSpec("vcl_membrane", "VCL membrane", 0.17, 900, 1400, 10000),
    "air": ThermalMaterialSpec("air", "Air layer", None, None, None, None, "Ventilated/unventilated air layer requires specialist handling"),
}


def _thermal_dict(material_el: MaterialElem) -> dict[str, Any]:
    return material_el.thermal if isinstance(material_el.thermal, dict) else {}


def _physical_dict(material_el: MaterialElem) -> dict[str, Any]:
    return material_el.physical if isinstance(material_el.physical, dict) else {}


def material_thermal_spec(doc: Document, material_key: str | None) -> ThermalMaterialSpec | None:
    key = (material_key or "").strip()
    if not key:
        return None
    material_el = doc.elements.get(key)
    if isinstance(material_el, MaterialElem):
        thermal = _thermal_dict(material_el)
        physical = _physical_dict(material_el)
        lambda_val = thermal.get("lambdaWPerMK", thermal.get("conductivityWPerMK"))
        rho_val = thermal.get("rhoKgPerM3", physical.get("densityKgPerM3"))
        try:
            lambda_num = float(lambda_val) if lambda_val not in (None, "") else None
        except (TypeError, ValueError):
            lambda_num = None
        try:
            rho_num = float(rho_val) if rho_val not in (None, "") else None
        except (TypeError, ValueError):
            rho_num = None
        return ThermalMaterialSpec(
            material_key=key,
            display_name=material_el.name or key,
            lambda_w_per_mk=lambda_num,
            rho_kg_per_m3=rho_num,
            specific_heat_j_per_kgk=_optional_float(thermal.get("specificHeatJPerKgK")),
            mu=_optional_float(thermal.get("mu")),
            source_reference=str(thermal.get("sourceReference") or "project material"),
        )
    return THERMAL_MATERIAL_LIBRARY.get(key)


def _optional_float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _layers_for_type(type_el: WallTypeElem | FloorTypeElem | RoofTypeElem) -> list[dict[str, Any]]:
    return [
        {
            "thicknessMm": float(layer.thickness_mm),
            "function": layer.layer_function,
            "materialKey": layer.material_key or "",
        }
        for layer in type_el.layers
    ]


def u_value_for_layers(
    doc: Document,
    layers: Iterable[dict[str, Any]],
    *,
    r_si: float = R_SI_M2K_PER_W,
    r_se: float = R_SE_M2K_PER_W,
) -> dict[str, Any]:
    layer_rows: list[dict[str, Any]] = []
    missing: list[str] = []
    r_layers = 0.0
    source_refs: list[str] = []
    for idx, layer in enumerate(layers):
        material_key = str(layer.get("materialKey") or "").strip()
        thickness_mm = _optional_float(layer.get("thicknessMm")) or 0.0
        spec = material_thermal_spec(doc, material_key)
        lambda_val = spec.lambda_w_per_mk if spec else None
        resistance = None
        if thickness_mm > 0 and lambda_val and lambda_val > 0:
            resistance = (thickness_mm / 1000.0) / lambda_val
            r_layers += resistance
        else:
            missing.append(material_key or f"layer-{idx}")
        if spec and spec.source_reference:
            source_refs.append(spec.source_reference)
        layer_rows.append(
            {
                "layerIndex": idx,
                "materialKey": material_key,
                "materialDisplay": spec.display_name if spec else "",
                "thicknessMm": round(thickness_mm, 3),
                "lambdaWPerMK": lambda_val if lambda_val is not None else "",
                "rhoKgPerM3": spec.rho_kg_per_m3 if spec else "",
                "specificHeatJPerKgK": spec.specific_heat_j_per_kgk if spec else "",
                "mu": spec.mu if spec else "",
                "thermalResistanceM2KPerW": round(resistance, 6) if resistance is not None else "",
                "sourceReference": spec.source_reference if spec else "",
            }
        )
    r_total = r_si + r_layers + r_se
    complete = not missing and r_layers > 0
    return {
        "rSiM2KPerW": r_si,
        "rSeM2KPerW": r_se,
        "rLayersM2KPerW": round(r_layers, 6),
        "rTotalM2KPerW": round(r_total, 6) if complete else "",
        "uValueWPerM2K": round(1.0 / r_total, 4) if complete else "",
        "isComplete": complete,
        "missingMaterialKeys": missing,
        "sourceReferences": sorted(set(source_refs)),
        "layers": layer_rows,
        "calculationScope": "modeling_readout_not_geg_or_din_v_18599",
    }


def type_u_value_readout(
    doc: Document,
    type_el: WallTypeElem | FloorTypeElem | RoofTypeElem,
) -> dict[str, Any]:
    return {
        "typeId": type_el.id,
        "typeName": type_el.name,
        "typeKind": type_el.kind,
        **u_value_for_layers(doc, _layers_for_type(type_el)),
    }


def type_u_value_summary_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for element in doc.elements.values():
        if isinstance(element, (WallTypeElem, FloorTypeElem, RoofTypeElem)):
            rows.append(type_u_value_readout(doc, element))
    return sorted(rows, key=lambda r: (str(r["typeKind"]), str(r["typeId"])))


def _props(el: Any) -> dict[str, Any]:
    props = getattr(el, "props", None)
    return props if isinstance(props, dict) else {}


def thermal_classification(el: Any) -> str:
    return str(
        getattr(el, "thermal_classification", None)
        or _props(el).get("thermalClassification")
        or ""
    )


def opening_energy_value(el: DoorElem | WindowElem, key: str) -> Any:
    attr = {
        "uValue": "u_value",
        "gValue": "g_value",
        "frameFraction": "frame_fraction",
        "annualShadingFactorEstimate": "annual_shading_factor_estimate",
    }.get(key)
    if attr:
        value = getattr(el, attr, None)
        if value is not None:
            return value
    return _props(el).get(key, "")


def energy_qa_rows(doc: Document) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for el in doc.elements.values():
        if isinstance(el, (WallElem, FloorElem, RoofElem)) and not thermal_classification(el):
            rows.append(
                {
                    "elementId": el.id,
                    "issueCode": "energy_envelope_classification_missing",
                    "severity": "warning",
                    "message": "Envelope candidate lacks thermal classification.",
                }
            )
        if isinstance(el, (DoorElem, WindowElem)):
            if not thermal_classification(el):
                rows.append(
                    {
                        "elementId": el.id,
                        "issueCode": "energy_opening_classification_missing",
                        "severity": "warning",
                        "message": "Opening lacks thermal envelope classification.",
                    }
                )
            if opening_energy_value(el, "uValue") in ("", None) or opening_energy_value(el, "gValue") in ("", None):
                rows.append(
                    {
                        "elementId": el.id,
                        "issueCode": "energy_opening_u_or_g_value_missing",
                        "severity": "warning",
                        "message": "Window/door lacks U-value or g-value for handoff.",
                    }
                )
        if isinstance(el, RoomElem):
            heating = getattr(el, "heating_status", None) or _props(el).get("heatingStatus")
            zone = getattr(el, "zone_id", None) or _props(el).get("zoneId")
            if heating in {"heated", "low_heated"} and not zone:
                rows.append(
                    {
                        "elementId": el.id,
                        "issueCode": "energy_heated_room_zone_missing",
                        "severity": "warning",
                        "message": "Heated room has no thermal zone.",
                    }
                )
    for row in type_u_value_summary_rows(doc):
        if not row["isComplete"]:
            rows.append(
                {
                    "elementId": row["typeId"],
                    "issueCode": "energy_type_lambda_missing",
                    "severity": "warning",
                    "message": "Layered type lacks thermal lambda data.",
                    "missingMaterialKeys": row["missingMaterialKeys"],
                }
            )
    return rows


def build_energy_handoff_payload(doc: Document, *, scenario_id: str | None = None) -> dict[str, Any]:
    scenarios = [
        e.model_dump(by_alias=True, exclude_none=True)
        for e in doc.elements.values()
        if isinstance(e, RenovationScenarioElem)
        and (scenario_id is None or e.id == scenario_id or e.base_scenario_id == scenario_id)
    ]
    services = [
        e.model_dump(by_alias=True, exclude_none=True)
        for e in doc.elements.values()
        if isinstance(e, BuildingServicesHandoffElem)
        and (scenario_id is None or e.scenario_id in (None, scenario_id))
    ]
    bridges = [
        e.model_dump(by_alias=True, exclude_none=True)
        for e in doc.elements.values()
        if isinstance(e, ThermalBridgeMarkerElem)
    ]
    return {
        "format": "bimAiEnergyHandoff_v1",
        "scope": "model_enrichment_and_handoff_not_compliance_calculation",
        "scenarioId": scenario_id or "",
        "uValueSummary": type_u_value_summary_rows(doc),
        "thermalBridges": bridges,
        "renovationScenarios": scenarios,
        "buildingServices": services,
        "qa": energy_qa_rows(doc),
    }


def envelope_surface_area_m2(doc: Document, el: WallElem | FloorElem | RoofElem) -> float:
    if isinstance(el, WallElem):
        dx = el.end.x_mm - el.start.x_mm
        dy = el.end.y_mm - el.start.y_mm
        return round(((dx * dx + dy * dy) ** 0.5 / 1000.0) * (el.height_mm / 1000.0), 6)
    if isinstance(el, FloorElem):
        layers = resolved_layers_for_floor(doc, el)
        _ = layers
        return _polygon_area_m2(el.boundary_mm)
    layers = resolved_layers_for_roof(doc, el)
    _ = layers
    return _polygon_area_m2(el.footprint_mm)


def _polygon_area_m2(points: list[Any]) -> float:
    if len(points) < 3:
        return 0.0
    acc = 0.0
    for idx, p0 in enumerate(points):
        p1 = points[(idx + 1) % len(points)]
        acc += float(p0.x_mm) * float(p1.y_mm) - float(p1.x_mm) * float(p0.y_mm)
    return round(abs(acc) / 2_000_000.0, 6)


def resolved_layers_for_envelope_element(doc: Document, el: WallElem | FloorElem | RoofElem) -> list[dict[str, Any]]:
    if isinstance(el, WallElem):
        return resolved_layers_for_wall(doc, el)
    if isinstance(el, FloorElem):
        return resolved_layers_for_floor(doc, el)
    return resolved_layers_for_roof(doc, el)
