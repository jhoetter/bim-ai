"""Model-derived quantity takeoff and cost rows for the Cost and Quantity lens."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)
from bim_ai.material_assembly_resolve import (
    resolved_layers_for_floor,
    resolved_layers_for_roof,
    resolved_layers_for_wall,
)
from bim_ai.opening_cut_primitives import hosted_opening_half_span_mm

COST_QUANTITY_LENS_ID = "cost-quantity"
DEFAULT_SCENARIO_ID = "as-is"

MODEL_TAKEOFF_KINDS = (WallElem, FloorElem, RoofElem, DoorElem, WindowElem, RoomElem)


def _round(v: float, ndigits: int = 6) -> float:
    return round(float(v), ndigits)


def polygon_area_perimeter_m2_m(points: list[Any]) -> tuple[float, float]:
    if len(points) < 3:
        return 0.0, 0.0
    area2 = 0.0
    perimeter_m = 0.0
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        px, py = float(p.x_mm), float(p.y_mm)
        qx, qy = float(q.x_mm), float(q.y_mm)
        area2 += px * qy - qx * py
        perimeter_m += ((qx - px) ** 2 + (qy - py) ** 2) ** 0.5 / 1000.0
    return abs(area2 / 2.0) / 1_000_000.0, perimeter_m


def wall_length_m(wall: WallElem) -> float:
    dx = wall.end.x_mm - wall.start.x_mm
    dy = wall.end.y_mm - wall.start.y_mm
    return (dx * dx + dy * dy) ** 0.5 / 1000.0


def _props(e: Any) -> dict[str, Any]:
    raw = getattr(e, "props", None)
    return dict(raw) if isinstance(raw, dict) else {}


def _cost_props(e: Any) -> dict[str, Any]:
    props = _props(e)
    out = dict(props)
    for key in ("cost", "costQuantity", "costClassification", "cost_classification"):
        nested = props.get(key)
        if isinstance(nested, dict):
            out.update(nested)
    return out


def _first_str(data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _first_float(data: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = data.get(key)
        if value in (None, ""):
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def cost_classification_fields(e: Any) -> dict[str, Any]:
    data = _cost_props(e)
    return {
        "costGroup": _first_str(data, "costGroup", "cost_group", "din276Group", "DIN276"),
        "workPackage": _first_str(data, "workPackage", "work_package", "package"),
        "trade": _first_str(data, "trade", "tradeCode", "trade_code", "gewerk"),
        "unit": _first_str(data, "unit", "costUnit"),
        "unitRate": _first_float(data, "unitRate", "unit_rate", "rate"),
        "costSource": _first_str(data, "source", "costSource", "rateSource", "reference"),
        "estimateConfidence": _first_float(data, "estimateConfidence", "confidence"),
        "scenarioId": _first_str(data, "scenarioId", "scenario_id") or DEFAULT_SCENARIO_ID,
    }


def _wall_opening_area_m2(doc: Document, wall: WallElem) -> tuple[float, float, int]:
    gross = 0.0
    net = 0.0
    count = 0
    wall_len_mm = max(wall_length_m(wall) * 1000.0, 1.0)
    for e in doc.elements.values():
        if isinstance(e, DoorElem) and e.wall_id == wall.id:
            width = 2.0 * hosted_opening_half_span_mm(e)
            area = width * wall.height_mm / 1_000_000.0
            gross += area
            net += area
            count += 1
        elif isinstance(e, WindowElem) and e.wall_id == wall.id:
            width = 2.0 * hosted_opening_half_span_mm(e)
            area = width * e.height_mm / 1_000_000.0
            gross += area
            net += area
            count += 1
        elif isinstance(e, WallOpeningElem) and e.host_wall_id == wall.id:
            width = (e.along_t_end - e.along_t_start) * wall_len_mm
            height = e.head_height_mm - e.sill_height_mm
            area = width * height / 1_000_000.0
            gross += area
            net += area
            count += 1
    return gross, net, count


def _level_name_by_id(doc: Document) -> dict[str, str]:
    return {
        e.id: e.name or e.id for e in doc.elements.values() if isinstance(e, LevelElem)
    }


def _type_id(e: Any) -> str:
    for attr in ("wall_type_id", "floor_type_id", "roof_type_id", "family_type_id"):
        value = getattr(e, attr, None)
        if value:
            return str(value)
    return ""


def _default_quantity_unit(kind: str) -> str:
    if kind in {"wall", "floor", "roof", "room"}:
        return "m2"
    if kind in {"door", "window", "stair"}:
        return "ea"
    return "count"


def _quantity_value_for_unit(row: dict[str, Any], unit: str) -> float:
    u = unit.strip().lower()
    if u in {"m", "lm", "linear_m"}:
        return float(row.get("lengthM") or 0.0)
    if u in {"m2", "sqm", "area"}:
        return float(row.get("netAreaM2") or row.get("areaM2") or row.get("grossAreaM2") or 0.0)
    if u in {"m3", "cbm", "volume"}:
        return float(
            row.get("netVolumeM3") or row.get("volumeM3") or row.get("grossVolumeM3") or 0.0
        )
    return float(row.get("count") or 0.0)


def derive_quantity_takeoff_rows(doc: Document) -> list[dict[str, Any]]:
    level_names = _level_name_by_id(doc)
    rows: list[dict[str, Any]] = []
    for e in doc.elements.values():
        if not isinstance(e, MODEL_TAKEOFF_KINDS):
            continue
        cls = cost_classification_fields(e)
        kind = str(e.kind)
        base: dict[str, Any] = {
            "elementId": e.id,
            "name": getattr(e, "name", e.id),
            "elementKind": kind,
            "typeId": _type_id(e),
            "lensId": COST_QUANTITY_LENS_ID,
            "scenarioId": cls["scenarioId"],
            "traceability": "model_element",
            **{k: v for k, v in cls.items() if k != "unitRate"},
        }
        if cls["unitRate"] is not None:
            base["unitRate"] = cls["unitRate"]
        level_id = getattr(e, "level_id", None) or getattr(e, "reference_level_id", None)
        if level_id:
            base["levelId"] = str(level_id)
            base["level"] = level_names.get(str(level_id), str(level_id))

        if isinstance(e, WallElem):
            length_m = wall_length_m(e)
            gross_area = length_m * e.height_mm / 1000.0
            opening_gross, opening_net, opening_count = _wall_opening_area_m2(doc, e)
            net_area = max(gross_area - opening_net, 0.0)
            thickness_m = e.thickness_mm / 1000.0
            layers = resolved_layers_for_wall(doc, e)
            base.update(
                {
                    "lengthM": _round(length_m),
                    "grossAreaM2": _round(gross_area),
                    "netAreaM2": _round(net_area),
                    "grossOpeningAreaM2": _round(opening_gross),
                    "netOpeningAreaM2": _round(opening_net),
                    "openingCount": opening_count,
                    "grossVolumeM3": _round(gross_area * thickness_m),
                    "netVolumeM3": _round(net_area * thickness_m),
                    "count": 1,
                    "layerQuantityCount": len(layers),
                    "quantityDerivation": "wall_centerline_height_minus_hosted_openings",
                }
            )
        elif isinstance(e, FloorElem):
            area, perimeter = polygon_area_perimeter_m2_m(e.boundary_mm)
            layers = resolved_layers_for_floor(doc, e)
            base.update(
                {
                    "areaM2": _round(area),
                    "netAreaM2": _round(area),
                    "perimeterM": _round(perimeter),
                    "grossVolumeM3": _round(area * e.thickness_mm / 1000.0),
                    "netVolumeM3": _round(area * e.thickness_mm / 1000.0),
                    "count": 1,
                    "layerQuantityCount": len(layers),
                    "quantityDerivation": "floor_boundary_polygon",
                }
            )
        elif isinstance(e, RoofElem):
            area, perimeter = polygon_area_perimeter_m2_m(e.footprint_mm)
            slope = float(e.slope_deg or 0.0)
            slope_factor = 1.0
            if abs(slope) < 89.0:
                slope_factor = 1.0 / max(math.cos(math.radians(slope)), 0.1)
            roof_area = area * slope_factor
            layers = resolved_layers_for_roof(doc, e)
            base.update(
                {
                    "footprintAreaM2": _round(area),
                    "areaM2": _round(roof_area),
                    "netAreaM2": _round(roof_area),
                    "perimeterM": _round(perimeter),
                    "count": 1,
                    "layerQuantityCount": len(layers),
                    "quantityDerivation": "roof_footprint_slope_adjusted",
                }
            )
        elif isinstance(e, DoorElem):
            width = 2.0 * hosted_opening_half_span_mm(e)
            host = doc.elements.get(e.wall_id)
            host_height = host.height_mm if isinstance(host, WallElem) else 0.0
            base.update(
                {
                    "hostElementId": e.wall_id,
                    "widthMm": _round(width, 3),
                    "grossOpeningAreaM2": _round(width * host_height / 1_000_000.0),
                    "netOpeningAreaM2": _round(width * host_height / 1_000_000.0),
                    "count": 1,
                    "quantityDerivation": "hosted_door_rough_opening",
                }
            )
        elif isinstance(e, WindowElem):
            width = 2.0 * hosted_opening_half_span_mm(e)
            base.update(
                {
                    "hostElementId": e.wall_id,
                    "widthMm": _round(width, 3),
                    "heightMm": _round(e.height_mm, 3),
                    "grossOpeningAreaM2": _round(width * e.height_mm / 1_000_000.0),
                    "netOpeningAreaM2": _round(width * e.height_mm / 1_000_000.0),
                    "areaM2": _round(e.width_mm * e.height_mm / 1_000_000.0),
                    "count": 1,
                    "quantityDerivation": "hosted_window_rough_opening",
                }
            )
        elif isinstance(e, RoomElem):
            area, perimeter = polygon_area_perimeter_m2_m(e.outline_mm)
            base.update(
                {
                    "areaM2": _round(area),
                    "netAreaM2": _round(area),
                    "perimeterM": _round(perimeter),
                    "count": 1,
                    "roomId": e.id,
                    "finishSet": e.finish_set or "",
                    "quantityDerivation": "room_outline_polygon",
                }
            )
        rows.append(base)
    return rows


def derive_cost_estimate_rows(doc: Document) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in derive_quantity_takeoff_rows(doc):
        unit = str(row.get("unit") or "").strip() or _default_quantity_unit(
            str(row.get("elementKind") or "")
        )
        quantity = _quantity_value_for_unit(row, unit)
        rate = row.get("unitRate")
        source = str(row.get("costSource") or "").strip()
        status = "unclassified" if not row.get("costGroup") else "classified"
        total: float | str = ""
        if rate is None:
            status = "missing_rate"
        elif not source:
            status = "rate_missing_source"
        else:
            total = _round(float(rate) * quantity, 2)
        cost_row = {
            **row,
            "rowId": f"{row['elementId']}:{row.get('scenarioId', DEFAULT_SCENARIO_ID)}",
            "unit": unit,
            "quantity": _round(quantity),
            "totalCost": total,
            "currency": str(
                _cost_props_for_element_id(doc, str(row["elementId"])).get("currency") or "EUR"
            ),
            "costDataStatus": status,
        }
        out.append(cost_row)
    return out


def _cost_props_for_element_id(doc: Document, element_id: str) -> dict[str, Any]:
    e = doc.elements.get(element_id)
    return _cost_props(e) if e is not None else {}


def derive_scenario_delta_rows(
    doc: Document, *, baseline_scenario_id: str = DEFAULT_SCENARIO_ID
) -> list[dict[str, Any]]:
    costs: defaultdict[tuple[str, str, str, str], float] = defaultdict(float)
    row_counts: defaultdict[tuple[str, str, str, str], int] = defaultdict(int)
    source_ids: defaultdict[tuple[str, str, str, str], set[str]] = defaultdict(set)
    for row in derive_cost_estimate_rows(doc):
        scenario_id = str(row.get("scenarioId") or DEFAULT_SCENARIO_ID)
        key = (
            scenario_id,
            str(row.get("costGroup") or ""),
            str(row.get("workPackage") or ""),
            str(row.get("trade") or ""),
        )
        cost = row.get("totalCost")
        cost_value = float(cost) if isinstance(cost, int | float) else 0.0
        costs[key] += cost_value
        row_counts[key] += 1
        source_ids[key].add(str(row.get("elementId") or ""))

    rows: list[dict[str, Any]] = []
    for key in sorted(costs):
        scenario_id, cost_group, work_package, trade = key
        baseline_key = (baseline_scenario_id, cost_group, work_package, trade)
        scenario_cost = costs[key]
        baseline_cost = costs[baseline_key]
        row = {
            "scenarioId": scenario_id,
            "baselineScenarioId": baseline_scenario_id,
            "costGroup": cost_group,
            "workPackage": work_package,
            "trade": trade,
            "scenarioCost": _round(scenario_cost, 2),
            "baselineCost": _round(baseline_cost, 2),
            "deltaCost": _round(scenario_cost - baseline_cost, 2),
            "rowCount": row_counts[key],
            "sourceElementIds": ";".join(sorted(x for x in source_ids[key] if x)),
            "traceability": "aggregate_from_model_cost_rows",
        }
        row["elementId"] = ":".join(
            [
                "cost-delta",
                str(row["scenarioId"]) or "none",
                str(row["costGroup"]) or "unclassified",
                str(row["workPackage"]) or "unpackaged",
                str(row["trade"]) or "untraded",
            ]
        )
        rows.append(row)
    return rows


def cost_quantity_totals(rows: list[dict[str, Any]], *, kind: str) -> dict[str, Any]:
    totals: dict[str, Any] = {"kind": kind, "rowCount": len(rows)}
    if not rows:
        return totals
    for field in (
        "quantity",
        "lengthM",
        "areaM2",
        "netAreaM2",
        "grossAreaM2",
        "netVolumeM3",
        "grossVolumeM3",
        "grossOpeningAreaM2",
        "netOpeningAreaM2",
        "totalCost",
        "scenarioCost",
        "baselineCost",
        "deltaCost",
    ):
        values = [float(r[field]) for r in rows if isinstance(r.get(field), int | float)]
        if values:
            totals[field] = _round(sum(values), 4)
    totals["sourceElementIds"] = sorted(
        str(r["elementId"]) for r in rows if str(r.get("traceability") or "") == "model_element"
    )
    return totals
