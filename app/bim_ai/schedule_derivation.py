"""Derive tabular schedule rows from semantic model (server-side projection)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from bim_ai.construction_lens import construction_progress_rows
from bim_ai.document import Document
from bim_ai.elements import (
    AreaElem,
    BuildingServicesHandoffElem,
    ConstructabilityIssueElem,
    ConstructionLogisticsElem,
    ConstructionPackageElem,
    ConstructionQaChecklistElem,
    DoorElem,
    ElevationViewElem,
    FloorElem,
    FloorTypeElem,
    IssueElem,
    LevelElem,
    MaterialElem,
    PhaseElem,
    PlanViewElem,
    RenovationScenarioElem,
    RoofElem,
    RoofTypeElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    StairElem,
    ThermalBridgeMarkerElem,
    ViewpointElem,
    WallElem,
    WallTypeElem,
    WindowElem,
)
from bim_ai.construction_lens import construction_progress_rows
from bim_ai.cost_quantity import (
    COST_QUANTITY_LENS_ID,
    cost_quantity_totals,
    derive_cost_estimate_rows,
    derive_quantity_takeoff_rows,
    derive_scenario_delta_rows,
)
from bim_ai.energy_lens import (
    build_energy_handoff_payload,
    energy_qa_rows,
    envelope_surface_area_m2,
    material_thermal_spec,
    opening_energy_value,
    resolved_layers_for_envelope_element,
    thermal_classification,
    type_u_value_summary_rows,
    u_value_for_layers,
)
from bim_ai.fire_safety_lens import (
    FIRE_SAFETY_SCHEDULE_CATEGORIES,
    derive_fire_safety_schedule_rows,
)
from bim_ai.material_assembly_resolve import (
    material_catalog_audit_rows,
    resolved_layers_for_floor,
    resolved_layers_for_roof,
    resolved_layers_for_wall,
)
from bim_ai.material_catalog import resolve_material
from bim_ai.opening_cut_primitives import hosted_opening_half_span_mm
from bim_ai.room_derivation import (
    HEURISTIC_VERSION as ROOM_BOUNDARY_HEURISTIC_VERSION,
)
from bim_ai.room_derivation import (
    ROOM_CLOSURE_BLOCKING_DIAGNOSTIC_CODES,
    compute_room_boundary_derivation,
    detect_unbounded_rooms_v1,
    room_separation_axis_summary_v0_payload,
    vacant_derived_metrics_for_authority,
)
from bim_ai.room_finish_schedule import (
    build_room_finish_schedule_evidence_v1,
    peer_finish_set_by_level,
    room_finish_schedule_row_extensions,
)
from bim_ai.schedule_field_registry import column_metadata_bundle, stable_column_keys
from bim_ai.schedule_pagination_placement_evidence import (
    build_schedule_pagination_placement_evidence_v0,
)
from bim_ai.schedule_sheet_export_parity import (
    build_schedule_sheet_export_parity_evidence_v1_for_schedule,
)
from bim_ai.stair_plan_proxy import stair_schedule_row_extensions_v1
from bim_ai.type_material_registry import (
    family_type_display_label,
    material_display_label,
    wall_type_display_label,
)


def _material_contract_fields(doc: Document, material_key: str | None) -> dict[str, Any]:
    key = (material_key or "").strip()
    if not key:
        return {
            "materialClass": "",
            "materialSurfacePattern": "",
            "materialCutPattern": "",
            "materialAppearanceStatus": "none",
            "materialTextureScale": "",
            "materialDensityKgPerM3": "",
            "materialThermalConductivityWPerMK": "",
        }
    material_el = doc.elements.get(key)
    if isinstance(material_el, MaterialElem):
        graphics = material_el.graphics or {}
        appearance = material_el.appearance or {}
        physical = material_el.physical or {}
        thermal = material_el.thermal or {}
        scale = appearance.get("uvScaleMm") or material_el.uv_scale_mm
        has_map = any(
            [
                appearance.get("albedoMapId") or material_el.albedo_map_id,
                appearance.get("normalMapId") or material_el.normal_map_id,
                appearance.get("roughnessMapId") or material_el.roughness_map_id,
                appearance.get("metallicMapId") or material_el.metallic_map_id,
                appearance.get("heightMapId") or material_el.height_map_id,
            ]
        )
        return {
            "materialClass": str(physical.get("materialClass") or ""),
            "materialSurfacePattern": str(
                graphics.get("surfacePatternId") or material_el.hatch_pattern_id or ""
            ),
            "materialCutPattern": str(
                graphics.get("cutPatternId") or material_el.hatch_pattern_id or ""
            ),
            "materialAppearanceStatus": "mapped" if has_map else "color",
            "materialTextureScale": (
                f"{scale.get('uMm', '')}x{scale.get('vMm', '')}mm"
                if isinstance(scale, dict)
                else ""
            ),
            "materialDensityKgPerM3": physical.get("densityKgPerM3", ""),
            "materialThermalConductivityWPerMK": thermal.get("conductivityWPerMK", ""),
        }
    builtin = resolve_material(key)
    if builtin:
        return {
            "materialClass": builtin.category,
            "materialSurfacePattern": builtin.hatch_pattern or "",
            "materialCutPattern": builtin.hatch_pattern or "",
            "materialAppearanceStatus": "mapped" if builtin.normal_map_url else "catalog",
            "materialTextureScale": "",
            "materialDensityKgPerM3": "",
            "materialThermalConductivityWPerMK": "",
        }
    return {
        "materialClass": "",
        "materialSurfacePattern": "",
        "materialCutPattern": "",
        "materialAppearanceStatus": "missing",
        "materialTextureScale": "",
        "materialDensityKgPerM3": "",
        "materialThermalConductivityWPerMK": "",
    }


def _primary_exposed_layer_material_key(layers: list[dict[str, Any]]) -> str:
    for layer in layers:
        if str(layer.get("function") or "") == "air":
            continue
        key = str(layer.get("materialKey") or "").strip()
        if key:
            return key
    return ""


def _plan_view_id_to_owning_sheet(doc: Document) -> dict[str, tuple[str, str]]:
    """Map plan_view id -> (sheet_id, sheet_name); first sheet wins by sorted sheet id."""

    out: dict[str, tuple[str, str]] = {}
    sheet_ids = sorted(eid for eid, el in doc.elements.items() if isinstance(el, SheetElem))
    for sid in sheet_ids:
        sh = doc.elements[sid]
        if not isinstance(sh, SheetElem):
            continue
        for vp in sh.viewports_mm or ():
            ref = str(vp.get("viewRef") or "")
            if not ref.startswith("plan:"):
                continue
            pv_id = ref.split(":", 1)[1].strip()
            if not pv_id or pv_id in out:
                continue
            out[pv_id] = (sh.id, sh.name or "")
    return out


def _view_ref_id_to_owning_sheet(doc: Document) -> dict[str, tuple[str, str]]:
    """Map any sheet viewport ref id -> (sheet_id, sheet_name); first sheet wins."""

    out: dict[str, tuple[str, str]] = {}
    sheet_ids = sorted(eid for eid, el in doc.elements.items() if isinstance(el, SheetElem))
    for sid in sheet_ids:
        sh = doc.elements[sid]
        if not isinstance(sh, SheetElem):
            continue
        for vp in sh.viewports_mm or ():
            ref = str(vp.get("viewRef") or "")
            if ":" not in ref:
                continue
            prefix, raw_id = ref.split(":", 1)
            if prefix not in {"plan", "section", "sec", "viewpoint", "vp"}:
                continue
            view_id = raw_id.strip()
            if not view_id or view_id in out:
                continue
            out[view_id] = (sh.id, sh.name or "")
    return out


def _plan_view_names_on_sheet_csv(doc: Document, sheet: SheetElem) -> str:
    """Sorted unique plan: viewports -> display labels (name, else id), joined with '; '."""

    seen: set[str] = set()
    pv_ids: list[str] = []
    for vp in sheet.viewports_mm or ():
        ref = str(vp.get("viewRef") or "")
        if not ref.startswith("plan:"):
            continue
        pv_id = ref.split(":", 1)[1].strip()
        if pv_id and pv_id not in seen:
            seen.add(pv_id)
            pv_ids.append(pv_id)
    pv_ids.sort()
    parts: list[str] = []
    for pvid in pv_ids:
        el = doc.elements.get(pvid)
        label = el.name if isinstance(el, PlanViewElem) else ""
        parts.append(label.strip() if label else pvid)
    return "; ".join(parts)


_NUMERIC_SCHEDULE_FIELDS: frozenset[str] = frozenset(
    {
        "areaM2",
        "perimeterM",
        "targetAreaM2",
        "areaDeltaM2",
        "widthMm",
        "heightMm",
        "sillMm",
        "thicknessMm",
        "totalThicknessMm",
        "materialAssemblyLayers",
        "layerIndex",
        "grossAreaM2",
        "grossVolumeM3",
        "viewportCount",
        "overhangMm",
        "slopeDeg",
        "pitchDeg",
        "footprintAreaM2",
        "footprintPerimeterM",
        "riseMm",
        "runMm",
        "riserCount",
        "treadCount",
        "riserHeightMm",
        "treadDepthMm",
        "totalRiseMm",
        "totalRunMm",
        "landingCount",
        "cropDepthMm",
        "hostHeightMm",
        "roughOpeningWidthMm",
        "roughOpeningHeightMm",
        "roughOpeningAreaM2",
        "openingAreaM2",
        "aspectRatio",
        "headHeightMm",
        "assemblyTotalThicknessMm",
        "layerOffsetFromExteriorMm",
        "roomCount",
        "volumeM3",
        "travelDistanceM",
        "exitWidthMm",
        "uValueWPerM2K",
        "rTotalM2KPerW",
        "surfaceAreaM2",
        "lambdaWPerMK",
        "rhoKgPerM3",
        "specificHeatJPerKgK",
        "mu",
        "gValue",
        "frameFraction",
        "annualShadingFactorEstimate",
        "setpointC",
        "airChangeRate",
        "lengthM",
        "netAreaM2",
        "netVolumeM3",
        "grossOpeningAreaM2",
        "netOpeningAreaM2",
        "openingCount",
        "layerQuantityCount",
        "quantity",
        "unitRate",
        "totalCost",
        "scenarioCost",
        "baselineCost",
        "deltaCost",
        "rowCount",
    }
)


def _floor_type_name(doc: Document, floor_type_id: str | None) -> str:
    fid = (floor_type_id or "").strip()
    if not fid:
        return ""
    ft = doc.elements.get(fid)
    if isinstance(ft, FloorTypeElem):
        return (ft.name or "").strip()
    return ""


def _roof_type_name(doc: Document, roof_type_id: str | None) -> str:
    rid = (roof_type_id or "").strip()
    if not rid:
        return ""
    rt = doc.elements.get(rid)
    if isinstance(rt, RoofTypeElem):
        return (rt.name or "").strip()
    return ""


def _wall_type_name(doc: Document, wall_type_id: str | None) -> str:
    wid = (wall_type_id or "").strip()
    if not wid:
        return ""
    wt = doc.elements.get(wid)
    if isinstance(wt, WallTypeElem):
        return (wt.name or "").strip()
    return ""


def _resolve_sort_descending(filt: dict[str, Any], sch_group: dict[str, Any]) -> bool:
    for d in (filt, sch_group):
        v = d.get("sortDescending")
        if v is None:
            v = d.get("sort_descending")
        if isinstance(v, bool):
            return v
        if isinstance(v, str) and v.strip().lower() in {"true", "1", "yes"}:
            return True
    return False


def _scalar_for_group_bucket(v: Any) -> tuple[int, Any]:
    """Deterministic ordering for group-key tuples (bucket labels)."""

    if v is None:
        return (0, "")
    if isinstance(v, bool):
        return (1, int(v))
    if isinstance(v, int | float) and not isinstance(v, bool):
        return (2, float(v))
    return (3, str(v).strip().lower())


def _group_bucket_sort_key(bucket_tuple: tuple[Any, ...]) -> tuple[tuple[int, Any], ...]:
    return tuple(_scalar_for_group_bucket(x) for x in bucket_tuple)


def _coerce_float_for_sort(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return float(int(raw))
    if isinstance(raw, int | float):
        return float(raw)
    if isinstance(raw, str) and raw.strip():
        try:
            return float(raw)
        except ValueError:
            return None
    return None


def _primary_sort_key_part(row: dict[str, Any], field: str) -> tuple[int, float | str]:
    """Lower tuple orders first when sort ascending (ties use stable elementId pass)."""

    raw = row.get(field)
    if field in _NUMERIC_SCHEDULE_FIELDS:
        fv = _coerce_float_for_sort(raw)
        if fv is not None:
            return (0, fv)
        return (1, str(raw if raw is not None else "").strip().lower())
    if raw is None:
        return (2, "")
    if isinstance(raw, bool):
        return (2, str(int(raw)))
    if isinstance(raw, int | float) and not isinstance(raw, bool):
        return (0, float(raw))
    return (2, str(raw).strip().lower())


def _sort_rows_stable(
    rs: list[dict[str, Any]],
    *,
    sort_field: str | None,
    key_aliases: dict[str, str],
    sort_descending: bool,
    default_name_fallback: bool,
) -> list[dict[str, Any]]:
    """Stable sort: primary key with optional desc; Python stable sort + elementId prefetch fixes ties."""

    if not rs:
        return rs
    eid_ordered = sorted(rs, key=lambda r: str(r.get("elementId", "")))
    lk = key_aliases.get(sort_field, sort_field) if sort_field else None
    if sort_field and lk is not None and any(lk in r for r in rs):
        return sorted(
            eid_ordered,
            key=lambda r, lk=lk: _primary_sort_key_part(r, lk),
            reverse=sort_descending,
        )
    if default_name_fallback:
        return sorted(
            eid_ordered,
            key=lambda r: str(r.get("name", "") or r.get("elementId", "")).strip().lower(),
            reverse=sort_descending,
        )
    return eid_ordered


def _level_labels(doc: Document) -> dict[str, str]:
    out: dict[str, str] = {}
    for e in doc.elements.values():
        if isinstance(e, LevelElem):
            out[e.id] = e.name or e.id
    return out


def _wall_level(doc: Document) -> dict[str, str]:
    m: dict[str, str] = {}
    for e in doc.elements.values():
        if isinstance(e, WallElem):
            m[e.id] = e.level_id
    return m


def _wall_height_mm(doc: Document) -> dict[str, float]:
    m: dict[str, float] = {}
    for e in doc.elements.values():
        if isinstance(e, WallElem):
            m[e.id] = float(e.height_mm)
    return m


def _room_polygon_area_perimeter_sqm(
    outline: list[dict[str, float] | tuple],
) -> tuple[float, float]:
    n = len(outline)
    if n < 3:
        return 0.0, 0.0
    a2 = 0.0
    per_m = 0.0
    for i in range(n):
        p = outline[i]  # type: ignore[index]
        q = outline[(i + 1) % n]  # type: ignore[index]
        if isinstance(p, tuple):
            px, py = float(p[0]), float(p[1])
        else:
            px = float(p.get("xMm") or p.get("x_mm") or 0)
            py = float(p.get("yMm") or p.get("y_mm") or 0)
        if isinstance(q, tuple):
            qx, qy = float(q[0]), float(q[1])
        else:
            qx = float(q.get("xMm") or q.get("x_mm") or 0)
            qy = float(q.get("yMm") or q.get("y_mm") or 0)
        a2 += px * qy - qx * py
        per_m += ((qx - px) ** 2 + (qy - py) ** 2) ** 0.5 / 1000.0
    return abs(a2 / 2) / 1_000_000.0, per_m


def _filter_equals_from_filters(filt: dict[str, Any]) -> dict[str, Any]:
    """Optional AND equality filters on derived row keys (``filterEquals`` / ``filter_equals``)."""

    raw = filt.get("filterEquals") or filt.get("filter_equals")
    if not isinstance(raw, dict) or not raw:
        return {}
    out: dict[str, Any] = {}
    for k, v in raw.items():
        sk = str(k).strip()
        if sk and v is not None:
            out[sk] = v
    return out


def _filter_value_matches(want: Any, got: Any) -> bool:
    if got is None and want not in (False, 0, 0.0, ""):
        return False
    if isinstance(want, bool):
        return bool(got) == want
    if isinstance(want, int | float) and not isinstance(want, bool):
        try:
            return float(got) == float(want)
        except (TypeError, ValueError):
            return False
    if isinstance(want, str):
        return str(got).strip() == want.strip()
    return got == want


def _rows_after_filter_equals(
    rows: list[dict[str, Any]], feq: dict[str, Any]
) -> list[dict[str, Any]]:
    if not feq:
        return rows
    return [
        r
        for r in rows
        if all(_filter_value_matches(want, r.get(field)) for field, want in feq.items())
    ]


def _normalize_filter_rules(filt: dict[str, Any]) -> list[dict[str, Any]]:
    """Structured schedule row filters: ``gt`` / ``lt`` on numeric-coercible row fields."""

    raw = filt.get("filterRules") or filt.get("filter_rules")
    if not isinstance(raw, list) or not raw:
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        field = str(item.get("field") or "").strip()
        op = str(item.get("op") or "").strip().lower()
        if not field or op not in {"gt", "lt"}:
            continue
        val_raw = item.get("value")
        thr = _coerce_float_for_sort(val_raw)
        if thr is None:
            continue
        out.append({"field": field, "op": op, "value": float(thr)})
    out.sort(key=lambda r: (r["field"], r["op"], r["value"]))
    return out


def _row_matches_numeric_compare_rule(
    row: dict[str, Any],
    rule: dict[str, Any],
    key_aliases: dict[str, str],
) -> bool:
    field = str(rule["field"])
    op = str(rule["op"])
    threshold = float(rule["value"])
    lk = key_aliases.get(field, field)
    raw = row.get(lk)
    got = _coerce_float_for_sort(raw)
    if got is None:
        return False
    match op:
        case "gt":
            return got > threshold
        case "lt":
            return got < threshold
        case _:
            return False


def _rows_after_filter_rules(
    rows: list[dict[str, Any]],
    rules: list[dict[str, Any]],
    key_aliases: dict[str, str],
) -> list[dict[str, Any]]:
    if not rules:
        return rows
    return [
        r
        for r in rows
        if all(_row_matches_numeric_compare_rule(r, rule, key_aliases) for rule in rules)
    ]


def _resolve_group_keys(filt: dict[str, Any], sch_grouping: dict[str, Any]) -> list[str]:
    """Prefer ``filters.groupingHint``; else ``grouping.groupKeys`` (persisted canonical)."""

    hint = filt.get("groupingHint") or filt.get("group_by")
    if isinstance(hint, list) and hint:
        return [str(x) for x in hint]
    gk = sch_grouping.get("groupKeys") or sch_grouping.get("group_keys")
    if isinstance(gk, list) and gk:
        return [str(x) for x in gk]
    return []


def _allowed_levels_from_schedule_filter_equals(feq: dict[str, Any]) -> frozenset[str] | None:
    """When a schedule filter pins a single level id, scope derived-footprint closure."""
    if not feq:
        return None
    for k, v in feq.items():
        sk = str(k).strip().lower()
        if sk in ("levelid", "level_id", "level") and v is not None:
            return frozenset({str(v).strip()})
    return None


def _infer_schedule_category_from_name(name: str) -> str | None:
    lowered = name.strip().lower()
    if "scenario delta" in lowered or "scenario comparison" in lowered or "szenario" in lowered:
        return "scenario_delta"
    if "element cost group" in lowered or "kostengruppe" in lowered:
        return "element_cost_group"
    if "cost estimate" in lowered or "kosten" in lowered:
        return "cost_estimate"
    if "quantity takeoff" in lowered or "takeoff" in lowered or "mengen" in lowered:
        return "quantity_takeoff"
    if "fire compartment" in lowered or "brandschutzabschnitt" in lowered:
        return "fire_compartment"
    if "rated wall" in lowered or "rated floor" in lowered or "rated element" in lowered:
        return "rated_element"
    if "fire door" in lowered or "brandschutztuer" in lowered or "brandschutztür" in lowered:
        return "fire_door"
    if "escape route" in lowered or "egress" in lowered or "fluchtweg" in lowered:
        return "escape_route"
    if "firestop" in lowered or "penetration" in lowered or "abschottung" in lowered:
        return "firestop_penetration"
    if "smoke control" in lowered or "rauchschutz" in lowered:
        return "smoke_control_equipment"
    if "window" in lowered:
        return "window"
    if "door" in lowered:
        return "door"
    if "finish" in lowered:
        return "finish"
    if "room" in lowered:
        return "room"
    if "floor" in lowered:
        return "floor"
    if "roof" in lowered:
        return "roof"
    if "stair" in lowered:
        return "stair"
    if "sheet" in lowered:
        return "sheet"
    if "view list" in lowered or lowered == "views" or lowered == "view schedule":
        return "view"
    if "plan" in lowered:
        return "plan_view"
    if "assembly" in lowered or "assemblies" in lowered:
        return "material_assembly"
    if "envelope" in lowered or "thermal envelope" in lowered:
        return "energy_envelope"
    if "u-value" in lowered or "u value" in lowered:
        return "energy_u_value_summary"
    if "solar" in lowered or "shading" in lowered:
        return "energy_windows_solar_gains"
    if "thermal bridge" in lowered:
        return "energy_thermal_bridges"
    if "thermal zone" in lowered:
        return "energy_thermal_zones"
    if "building services" in lowered:
        return "energy_building_services"
    if "renovation" in lowered:
        return "energy_renovation_measures"
    if "export qa" in lowered or "energy qa" in lowered:
        return "energy_export_qa"
    if "thermal material" in lowered:
        return "energy_thermal_materials"
    if "package" in lowered:
        return "construction_package"
    if "phase" in lowered:
        return "phase"
    if "progress" in lowered:
        return "progress"
    if "punch" in lowered:
        return "punch"
    if "logistics" in lowered:
        return "site_logistics"
    if "qa" in lowered or "checklist" in lowered:
        return "qa_checklist"
    return None


def derive_schedule_table(doc: Document, schedule_id: str) -> dict[str, Any]:
    sch = doc.elements.get(schedule_id)
    if not isinstance(sch, ScheduleElem):
        raise ValueError(f"schedule id '{schedule_id}' not found or not a schedule")
    filt = dict(sch.filters or {})
    cat = str(
        filt.get("category")
        or filt.get("Category")
        or sch.category
        or _infer_schedule_category_from_name(sch.name)
        or "room"
    ).lower()
    sch_group = dict(sch.grouping or {})

    lvl_lab = _level_labels(doc)
    w_lv = _wall_level(doc)
    w_h_mm = _wall_height_mm(doc)

    group_keys = _resolve_group_keys(filt, sch_group)
    filter_equals = _filter_equals_from_filters(filt)
    filter_rules_norm = _normalize_filter_rules(filt)
    sort_descending = _resolve_sort_descending(filt, sch_group)
    key_aliases = {"familyTypeMark": "familyTypeId"}

    rows: list[dict[str, Any]] = []

    if cat == "quantity_takeoff":
        rows = derive_quantity_takeoff_rows(doc)

    elif cat in {"cost_estimate", "element_cost_group"}:
        rows = derive_cost_estimate_rows(doc)

    elif cat == "scenario_delta":
        baseline = str(
            filt.get("baselineScenarioId")
            or filt.get("baseScenarioId")
            or filt.get("baseline_scenario_id")
            or "as-is"
        )
        rows = derive_scenario_delta_rows(doc, baseline_scenario_id=baseline)

    elif cat in {"room", "finish"}:
        room_peer_finish = peer_finish_set_by_level(
            e for e in doc.elements.values() if isinstance(e, RoomElem)
        )
        unbounded_room_ids: frozenset[str] = frozenset(detect_unbounded_rooms_v1(doc))
        for e in doc.elements.values():
            if isinstance(e, RoomElem):
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.outline_mm]
                area, perimeter = _room_polygon_area_perimeter_sqm(pts)
                lev = lvl_lab.get(e.level_id, e.level_id)
                row: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "levelId": e.level_id,
                    "level": lev,
                    "areaM2": round(area, 3),
                    "perimeterM": round(perimeter, 3),
                    "familyTypeId": "",
                    "programmeCode": (e.programme_code or "").strip(),
                    "department": (e.department or "").strip(),
                    "programmeGroup": (e.programme_group or "").strip(),
                    "isBoundaryOpen": e.id in unbounded_room_ids,
                    "functionLabel": (e.function_label or "").strip(),
                    "finishSet": (e.finish_set or "").strip(),
                }
                row.update(
                    room_finish_schedule_row_extensions(e, peer_by_level=room_peer_finish),
                )
                if e.target_area_m2 is not None:
                    tgm = float(e.target_area_m2)
                    row["targetAreaM2"] = round(tgm, 3)
                    row["areaDeltaM2"] = round(area - tgm, 3)
                rows.append(row)

    elif cat == "door":
        for e in doc.elements.values():
            if isinstance(e, DoorElem):
                lid = w_lv.get(e.wall_id, "")
                host_h = float(w_h_mm.get(e.wall_id, 0.0))
                rough_w_mm = 2.0 * hosted_opening_half_span_mm(e)
                host_wall = doc.elements.get(e.wall_id)
                host_wt_id = ""
                if isinstance(host_wall, WallElem):
                    host_wt_id = (host_wall.wall_type_id or "").strip()
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "wallId": e.wall_id,
                        "hostWallTypeId": host_wt_id,
                        "hostWallTypeDisplay": wall_type_display_label(doc, host_wt_id or None),
                        "hostWallTypeName": _wall_type_name(doc, host_wt_id or None),
                        "levelId": lid,
                        "level": lvl_lab.get(lid, lid or "—"),
                        "widthMm": e.width_mm,
                        "hostHeightMm": round(host_h, 3),
                        "roughOpeningWidthMm": round(rough_w_mm, 3),
                        "roughOpeningHeightMm": round(host_h, 3),
                        "roughOpeningAreaM2": round(rough_w_mm * host_h / 1_000_000.0, 6),
                        "familyTypeId": getattr(e, "family_type_id", "") or "",
                        "discipline": getattr(e, "discipline", None) or "arch",
                        "materialKey": (getattr(e, "material_key", None) or "").strip(),
                        "materialDisplay": material_display_label(
                            doc,
                            getattr(e, "material_key", None),
                        ),
                        **_material_contract_fields(doc, getattr(e, "material_key", None)),
                        "familyTypeDisplay": family_type_display_label(
                            doc, getattr(e, "family_type_id", None)
                        ),
                    }
                )

    elif cat == "window":
        for e in doc.elements.values():
            if isinstance(e, WindowElem):
                lid = w_lv.get(e.wall_id, "")
                wmm = float(e.width_mm)
                hmm = float(e.height_mm)
                sill = float(e.sill_height_mm)
                rough_w_mm = 2.0 * hosted_opening_half_span_mm(e)
                opening_m2 = wmm * hmm / 1_000_000.0
                ar = round(wmm / hmm, 6) if hmm > 0 else 0.0
                host_wall = doc.elements.get(e.wall_id)
                host_wt_id = ""
                if isinstance(host_wall, WallElem):
                    host_wt_id = (host_wall.wall_type_id or "").strip()
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "wallId": e.wall_id,
                        "hostWallTypeId": host_wt_id,
                        "hostWallTypeDisplay": wall_type_display_label(doc, host_wt_id or None),
                        "hostWallTypeName": _wall_type_name(doc, host_wt_id or None),
                        "levelId": lid,
                        "level": lvl_lab.get(lid, lid or "—"),
                        "widthMm": e.width_mm,
                        "heightMm": e.height_mm,
                        "sillMm": e.sill_height_mm,
                        "roughOpeningWidthMm": round(rough_w_mm, 3),
                        "roughOpeningHeightMm": round(hmm, 3),
                        "roughOpeningAreaM2": round(rough_w_mm * hmm / 1_000_000.0, 6),
                        "openingAreaM2": round(opening_m2, 6),
                        "aspectRatio": ar,
                        "headHeightMm": round(sill + hmm, 3),
                        "familyTypeId": getattr(e, "family_type_id", "") or "",
                        "discipline": getattr(e, "discipline", None) or "arch",
                        "materialKey": (getattr(e, "material_key", None) or "").strip(),
                        "materialDisplay": material_display_label(
                            doc,
                            getattr(e, "material_key", None),
                        ),
                        **_material_contract_fields(doc, getattr(e, "material_key", None)),
                        "familyTypeDisplay": family_type_display_label(
                            doc, getattr(e, "family_type_id", None)
                        ),
                    }
                )

    elif cat == "floor":
        for e in doc.elements.values():
            if isinstance(e, FloorElem):
                lev = lvl_lab.get(e.level_id, e.level_id)
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.boundary_mm]
                area, perimeter = _room_polygon_area_perimeter_sqm(pts)
                ftid = (e.floor_type_id or "").strip()
                flayers = resolved_layers_for_floor(doc, e)
                total_thk = (
                    round(sum(float(ly["thicknessMm"]) for ly in flayers), 6)
                    if flayers
                    else round(float(e.thickness_mm), 3)
                )
                primary_material_key = _primary_exposed_layer_material_key(flayers)
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "levelId": e.level_id,
                        "level": lev,
                        "floorTypeId": ftid,
                        "typeName": _floor_type_name(doc, ftid or None),
                        "thicknessMm": round(float(e.thickness_mm), 3),
                        "materialAssemblyLayers": len(flayers),
                        "materialKey": primary_material_key,
                        "materialDisplay": material_display_label(
                            doc, primary_material_key or None
                        ),
                        "effectiveMaterialSource": "type-layer"
                        if ftid and primary_material_key
                        else "category-fallback",
                        **_material_contract_fields(doc, primary_material_key or None),
                        "totalThicknessMm": total_thk,
                        "areaM2": round(area, 3),
                        "perimeterM": round(perimeter, 3),
                        "familyTypeId": "",
                        "discipline": getattr(e, "discipline", None) or "arch",
                    }
                )

    elif cat == "roof":
        for e in doc.elements.values():
            if isinstance(e, RoofElem):
                rl = lvl_lab.get(e.reference_level_id, e.reference_level_id or "—")
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.footprint_mm]
                area, perimeter = _room_polygon_area_perimeter_sqm(pts)
                rlayers = resolved_layers_for_roof(doc, e)
                total_asm_thk = (
                    round(
                        sum(float(ly["thicknessMm"]) for ly in rlayers),
                        6,
                    )
                    if rlayers
                    else None
                )
                rtid = (e.roof_type_id or "").strip()
                slope = round(float(e.slope_deg or 0.0), 3)
                primary_material_key = _primary_exposed_layer_material_key(rlayers)
                effective_material_source = (
                    "type-layer"
                    if rtid and primary_material_key
                    else ("instance" if primary_material_key else "category-fallback")
                )
                row_root: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "referenceLevelId": e.reference_level_id,
                    "referenceLevel": rl,
                    "roofTypeId": rtid,
                    "typeName": _roof_type_name(doc, rtid or None),
                    "materialAssemblyLayers": len(rlayers),
                    "materialKey": primary_material_key,
                    "materialDisplay": material_display_label(doc, primary_material_key or None),
                    "effectiveMaterialSource": effective_material_source,
                    **_material_contract_fields(doc, primary_material_key or None),
                    "overhangMm": round(float(e.overhang_mm or 0.0), 3),
                    "slopeDeg": slope,
                    "pitchDeg": slope,
                    "footprintAreaM2": round(area, 3),
                    "footprintPerimeterM": round(perimeter, 3),
                    "familyTypeId": "",
                    "discipline": getattr(e, "discipline", None) or "arch",
                }
                if total_asm_thk is not None:
                    row_root["assemblyTotalThicknessMm"] = total_asm_thk
                rows.append(row_root)

    elif cat == "stair":
        bl = {eid: el for eid, el in doc.elements.items() if isinstance(el, LevelElem)}
        for e in doc.elements.values():
            if isinstance(e, StairElem):
                bs = bl.get(e.base_level_id)
                ts = bl.get(e.top_level_id)
                rise_mm = (
                    abs(ts.elevation_mm - bs.elevation_mm)
                    if isinstance(bs, LevelElem) and isinstance(ts, LevelElem)
                    else float(getattr(e, "riser_mm", 0.0)) * 16.0
                )
                p0 = e.run_start.x_mm, e.run_start.y_mm
                p1 = e.run_end.x_mm, e.run_end.y_mm
                run_mm = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
                row_st: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "baseLevelId": e.base_level_id,
                    "topLevelId": e.top_level_id,
                    "baseLevel": lvl_lab.get(e.base_level_id, e.base_level_id),
                    "topLevel": lvl_lab.get(e.top_level_id, e.top_level_id),
                    "riseMm": round(float(rise_mm), 3),
                    "runMm": round(float(run_mm), 3),
                    "widthMm": round(float(e.width_mm), 3),
                    "familyTypeId": "",
                    "discipline": getattr(e, "discipline", None) or "arch",
                }
                row_st.update(stair_schedule_row_extensions_v1(doc, e))
                rows.append(row_st)

    elif cat == "sheet":
        for e in doc.elements.values():
            if isinstance(e, SheetElem):
                vps = getattr(e, "viewports_mm", ()) or ()
                row_root: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "titleBlock": getattr(e, "title_block", "") or "",
                    "viewportCount": len(vps),
                    "familyTypeId": "",
                }
                pv_labels = _plan_view_names_on_sheet_csv(doc, e)
                if pv_labels:
                    row_root["planViewNames"] = pv_labels
                rows.append(row_root)

    elif cat in {"plan_view", "planview"}:
        owning = _plan_view_id_to_owning_sheet(doc)
        for e in doc.elements.values():
            if isinstance(e, PlanViewElem):
                lev = lvl_lab.get(e.level_id, e.level_id)
                row_pv: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "levelId": e.level_id,
                    "level": lev,
                    "planPresentation": e.plan_presentation,
                    "discipline": getattr(e, "discipline", "") or "",
                    "viewSubdiscipline": e.view_subdiscipline or "",
                    "planViewSubtype": e.plan_view_subtype or "floor_plan",
                    "areaScheme": e.area_scheme,
                    "familyTypeId": "",
                }
                own = owning.get(e.id)
                if own:
                    row_pv["sheetId"], row_pv["sheetName"] = own
                rows.append(row_pv)

    elif cat in {"section_cut", "sectioncut"}:
        for e in doc.elements.values():
            if isinstance(e, SectionCutElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "cropDepthMm": round(float(e.crop_depth_mm), 3),
                        "familyTypeId": "",
                    }
                )

    elif cat in {"view", "view_list", "viewlist"}:
        owning = _view_ref_id_to_owning_sheet(doc)
        for e in doc.elements.values():
            if isinstance(e, PlanViewElem):
                lev = lvl_lab.get(e.level_id, e.level_id)
                row_v: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "viewKind": "plan_view",
                    "viewType": e.plan_view_subtype or "floor_plan",
                    "levelId": e.level_id,
                    "level": lev,
                    "discipline": getattr(e, "discipline", "") or "",
                    "viewTemplateId": e.view_template_id or "",
                    "defaultLens": e.default_lens,
                    "cropEnabled": e.crop_enabled,
                    "scale": e.scale or "",
                    "familyTypeId": "",
                }
                own = owning.get(e.id)
                if own:
                    row_v["sheetId"], row_v["sheetName"] = own
                rows.append(row_v)
            elif isinstance(e, SectionCutElem):
                row_sec: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "viewKind": "section_cut",
                    "viewType": "section",
                    "cropDepthMm": round(float(e.crop_depth_mm), 3),
                    "familyTypeId": "",
                }
                own = owning.get(e.id)
                if own:
                    row_sec["sheetId"], row_sec["sheetName"] = own
                rows.append(row_sec)
            elif isinstance(e, ElevationViewElem):
                row_el: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "viewKind": "elevation_view",
                    "viewType": e.direction,
                    "familyTypeId": "",
                }
                own = owning.get(e.id)
                if own:
                    row_el["sheetId"], row_el["sheetName"] = own
                rows.append(row_el)
            elif isinstance(e, ViewpointElem):
                row_vp: dict[str, Any] = {
                    "elementId": e.id,
                    "name": e.name,
                    "viewKind": "viewpoint",
                    "viewType": e.mode,
                    "familyTypeId": "",
                }
                own = owning.get(e.id)
                if own:
                    row_vp["sheetId"], row_vp["sheetName"] = own
                rows.append(row_vp)

    elif cat == "material_assembly":
        audit_by_host = {str(r["hostElementId"]): r for r in material_catalog_audit_rows(doc)}
        for e in doc.elements.values():
            if isinstance(e, WallElem):
                layers = resolved_layers_for_wall(doc, e)
                lid = e.level_id
                lev = lvl_lab.get(lid, lid)
                dx = e.end.x_mm - e.start.x_mm
                dy = e.end.y_mm - e.start.y_mm
                length_m = (dx * dx + dy * dy) ** 0.5 / 1000.0
                height_m = e.height_mm / 1000.0
                gross_face_m2 = length_m * height_m
                asm_id = (e.wall_type_id or "").strip()
                total_thk = sum(float(lyr["thicknessMm"]) for lyr in layers)
                offset_mm = 0.0
                audit_row = audit_by_host.get(e.id)
                for idx, lyr in enumerate(layers):
                    tk = str(lyr.get("materialKey") or "").strip()
                    th_mm = float(lyr["thicknessMm"])
                    th_m = th_mm / 1000.0
                    fn = str(lyr.get("function") or "").strip()
                    vol = gross_face_m2 * th_m
                    row_w: dict[str, Any] = {
                        "elementId": f"{e.id}:layer-{idx}",
                        "name": e.name,
                        "hostElementId": e.id,
                        "hostKind": "wall",
                        "assemblyTypeId": asm_id,
                        "assemblyTotalThicknessMm": round(total_thk, 6),
                        "layerOffsetFromExteriorMm": round(offset_mm, 6),
                        "layerIndex": idx,
                        "layerFunction": fn,
                        "materialKey": tk,
                        "materialDisplay": material_display_label(doc, tk or None),
                        **_material_contract_fields(doc, tk or None),
                        "thicknessMm": round(th_mm, 6),
                        "grossAreaM2": round(gross_face_m2, 8),
                        "grossVolumeM3": round(vol, 12),
                        "levelId": lid,
                        "level": lev,
                        "familyTypeId": "",
                        "discipline": getattr(e, "discipline", None) or "arch",
                    }
                    if audit_row:
                        row_w["catalogAuditStatus"] = audit_row["catalogStatus"]
                        row_w["assemblyMaterialKeysDigest"] = audit_row[
                            "assemblyMaterialKeysDigest"
                        ]
                        row_w["layerPropagationStatus"] = audit_row["propagationStatus"]
                    rows.append(row_w)
                    offset_mm += th_mm
            elif isinstance(e, FloorElem):
                layers = resolved_layers_for_floor(doc, e)
                lev = lvl_lab.get(e.level_id, e.level_id)
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.boundary_mm]
                slab_m2, _perim = _room_polygon_area_perimeter_sqm(pts)
                asm_id = (e.floor_type_id or "").strip()
                total_thk = sum(float(lyr["thicknessMm"]) for lyr in layers)
                offset_mm = 0.0
                audit_row = audit_by_host.get(e.id)
                for idx, lyr in enumerate(layers):
                    tk = str(lyr.get("materialKey") or "").strip()
                    th_mm = float(lyr["thicknessMm"])
                    th_m = th_mm / 1000.0
                    fn = str(lyr.get("function") or "").strip()
                    vol = slab_m2 * th_m
                    row_f: dict[str, Any] = {
                        "elementId": f"{e.id}:layer-{idx}",
                        "name": e.name,
                        "hostElementId": e.id,
                        "hostKind": "floor",
                        "assemblyTypeId": asm_id,
                        "assemblyTotalThicknessMm": round(total_thk, 6),
                        "layerOffsetFromExteriorMm": round(offset_mm, 6),
                        "layerIndex": idx,
                        "layerFunction": fn,
                        "materialKey": tk,
                        "materialDisplay": material_display_label(doc, tk or None),
                        **_material_contract_fields(doc, tk or None),
                        "thicknessMm": round(th_mm, 6),
                        "grossAreaM2": round(slab_m2, 8),
                        "grossVolumeM3": round(vol, 12),
                        "levelId": e.level_id,
                        "level": lev,
                        "familyTypeId": "",
                        "discipline": getattr(e, "discipline", None) or "arch",
                    }
                    if audit_row:
                        row_f["catalogAuditStatus"] = audit_row["catalogStatus"]
                        row_f["assemblyMaterialKeysDigest"] = audit_row[
                            "assemblyMaterialKeysDigest"
                        ]
                        row_f["layerPropagationStatus"] = audit_row["propagationStatus"]
                    rows.append(row_f)
                    offset_mm += th_mm
            elif isinstance(e, RoofElem):
                layers = resolved_layers_for_roof(doc, e)
                if not layers:
                    continue
                lid = e.reference_level_id
                lev = lvl_lab.get(lid, lid)
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.footprint_mm]
                footprint_m2, _perim = _room_polygon_area_perimeter_sqm(pts)
                asm_id = (e.roof_type_id or "").strip()
                total_thk = sum(float(lyr["thicknessMm"]) for lyr in layers)
                offset_mm = 0.0
                audit_row = audit_by_host.get(e.id)
                for idx, lyr in enumerate(layers):
                    tk = str(lyr.get("materialKey") or "").strip()
                    th_mm = float(lyr["thicknessMm"])
                    th_m = th_mm / 1000.0
                    fn = str(lyr.get("function") or "").strip()
                    vol = footprint_m2 * th_m
                    row_r: dict[str, Any] = {
                        "elementId": f"{e.id}:layer-{idx}",
                        "name": e.name,
                        "hostElementId": e.id,
                        "hostKind": "roof",
                        "assemblyTypeId": asm_id,
                        "assemblyTotalThicknessMm": round(total_thk, 6),
                        "layerOffsetFromExteriorMm": round(offset_mm, 6),
                        "layerIndex": idx,
                        "layerFunction": fn,
                        "materialKey": tk,
                        "materialDisplay": material_display_label(doc, tk or None),
                        **_material_contract_fields(doc, tk or None),
                        "thicknessMm": round(th_mm, 6),
                        "grossAreaM2": round(footprint_m2, 8),
                        "grossVolumeM3": round(vol, 12),
                        "levelId": lid,
                        "level": lev,
                        "familyTypeId": "",
                        "discipline": getattr(e, "discipline", None) or "arch",
                    }
                    if audit_row:
                        row_r["catalogAuditStatus"] = audit_row["catalogStatus"]
                        row_r["assemblyMaterialKeysDigest"] = audit_row[
                            "assemblyMaterialKeysDigest"
                        ]
                        row_r["layerPropagationStatus"] = audit_row["propagationStatus"]
                    rows.append(row_r)
                    offset_mm += th_mm

    elif cat == "energy_envelope":
        for e in doc.elements.values():
            if isinstance(e, (WallElem, FloorElem, RoofElem)):
                type_id = ""
                type_name = ""
                if isinstance(e, WallElem):
                    type_id = (e.wall_type_id or "").strip()
                    type_name = _wall_type_name(doc, type_id or None)
                elif isinstance(e, FloorElem):
                    type_id = (e.floor_type_id or "").strip()
                    type_name = _floor_type_name(doc, type_id or None)
                else:
                    type_id = (e.roof_type_id or "").strip()
                    type_name = _roof_type_name(doc, type_id or None)
                uv = u_value_for_layers(doc, resolved_layers_for_envelope_element(doc, e))
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "hostKind": e.kind,
                        "typeId": type_id,
                        "typeName": type_name,
                        "thermalClassification": thermal_classification(e),
                        "classificationSource": getattr(
                            e, "thermal_classification_source", None
                        )
                        or "",
                        "surfaceAreaM2": envelope_surface_area_m2(doc, e),
                        "uValueWPerM2K": uv["uValueWPerM2K"],
                        "missingMaterialKeys": "; ".join(uv["missingMaterialKeys"]),
                        "sourceReferences": "; ".join(uv["sourceReferences"]),
                        "scenarioId": getattr(e, "energy_scenario_id", None) or "",
                        "familyTypeId": "",
                    }
                )
            elif isinstance(e, (DoorElem, WindowElem)):
                wall = doc.elements.get(e.wall_id)
                lid = wall.level_id if isinstance(wall, WallElem) else ""
                area_m2 = (
                    float(e.width_mm)
                    * float(getattr(e, "height_mm", getattr(wall, "height_mm", 2100.0)))
                    / 1_000_000.0
                )
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "hostKind": e.kind,
                        "typeId": getattr(e, "family_type_id", None) or "",
                        "typeName": family_type_display_label(
                            doc, getattr(e, "family_type_id", None)
                        ),
                        "levelId": lid,
                        "level": lvl_lab.get(lid, lid),
                        "wallId": e.wall_id,
                        "thermalClassification": thermal_classification(e),
                        "classificationSource": getattr(
                            e, "thermal_classification_source", None
                        )
                        or "",
                        "surfaceAreaM2": round(area_m2, 6),
                        "uValueWPerM2K": opening_energy_value(e, "uValue"),
                        "gValue": opening_energy_value(e, "gValue"),
                        "frameFraction": opening_energy_value(e, "frameFraction"),
                        "annualShadingFactorEstimate": opening_energy_value(
                            e, "annualShadingFactorEstimate"
                        ),
                        "familyTypeId": getattr(e, "family_type_id", "") or "",
                    }
                )

    elif cat == "energy_thermal_materials":
        material_keys: set[str] = set()
        for e in doc.elements.values():
            if isinstance(e, (WallElem, FloorElem, RoofElem)):
                for layer in resolved_layers_for_envelope_element(doc, e):
                    key = str(layer.get("materialKey") or "").strip()
                    if key:
                        material_keys.add(key)
        for key in sorted(material_keys):
            spec = material_thermal_spec(doc, key)
            rows.append(
                {
                    "elementId": key,
                    "materialKey": key,
                    "materialDisplay": spec.display_name if spec else material_display_label(doc, key),
                    "lambdaWPerMK": spec.lambda_w_per_mk if spec else "",
                    "rhoKgPerM3": spec.rho_kg_per_m3 if spec else "",
                    "specificHeatJPerKgK": spec.specific_heat_j_per_kgk if spec else "",
                    "mu": spec.mu if spec else "",
                    "sourceReference": spec.source_reference if spec else "",
                    "thermalDataStatus": "complete" if spec and spec.lambda_w_per_mk else "missing_lambda",
                    "familyTypeId": "",
                }
            )

    elif cat == "energy_u_value_summary":
        for row in type_u_value_summary_rows(doc):
            rows.append(
                {
                    "elementId": row["typeId"],
                    "typeId": row["typeId"],
                    "typeName": row["typeName"],
                    "hostKind": row["typeKind"].replace("_type", ""),
                    "uValueWPerM2K": row["uValueWPerM2K"],
                    "rTotalM2KPerW": row["rTotalM2KPerW"],
                    "layerCount": len(row["layers"]),
                    "missingMaterialKeys": "; ".join(row["missingMaterialKeys"]),
                    "sourceReferences": "; ".join(row["sourceReferences"]),
                    "calculationScope": row["calculationScope"],
                    "familyTypeId": "",
                }
            )

    elif cat == "energy_windows_solar_gains":
        for e in doc.elements.values():
            if isinstance(e, WindowElem):
                wall = doc.elements.get(e.wall_id)
                area_m2 = float(e.width_mm) * float(e.height_mm) / 1_000_000.0
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "wallId": e.wall_id,
                        "hostWallTypeId": wall.wall_type_id if isinstance(wall, WallElem) else "",
                        "widthMm": round(float(e.width_mm), 3),
                        "heightMm": round(float(e.height_mm), 3),
                        "openingAreaM2": round(area_m2, 6),
                        "uValueWPerM2K": opening_energy_value(e, "uValue"),
                        "gValue": opening_energy_value(e, "gValue"),
                        "frameFraction": opening_energy_value(e, "frameFraction"),
                        "shadingDevice": getattr(e, "shading_device", None) or "",
                        "annualShadingFactorEstimate": opening_energy_value(
                            e, "annualShadingFactorEstimate"
                        ),
                        "installationThermalBridgeNote": getattr(
                            e, "installation_thermal_bridge_note", None
                        )
                        or "",
                        "familyTypeId": getattr(e, "family_type_id", "") or "",
                    }
                )

    elif cat == "energy_thermal_bridges":
        for e in doc.elements.values():
            if isinstance(e, ThermalBridgeMarkerElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name or e.id,
                        "markerType": e.marker_type,
                        "hostElementIds": "; ".join(e.host_element_ids),
                        "description": e.description or "",
                        "suggestedMitigation": e.suggested_mitigation or "",
                        "handoffNote": e.handoff_note or "",
                        "psiValueReference": e.psi_value_reference or "",
                        "familyTypeId": "",
                    }
                )

    elif cat == "energy_thermal_zones":
        for e in doc.elements.values():
            if isinstance(e, RoomElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "levelId": e.level_id,
                        "level": lvl_lab.get(e.level_id, e.level_id),
                        "heatingStatus": getattr(e, "heating_status", None) or "",
                        "usageProfile": getattr(e, "usage_profile", None) or "",
                        "setpointC": getattr(e, "setpoint_c", None) or "",
                        "airChangeRate": getattr(e, "air_change_rate", None) or "",
                        "zoneId": getattr(e, "zone_id", None) or "",
                        "conditionedVolumeIncluded": getattr(
                            e, "conditioned_volume_included", None
                        ),
                        "familyTypeId": "",
                    }
                )

    elif cat == "energy_building_services":
        for e in doc.elements.values():
            if isinstance(e, BuildingServicesHandoffElem):
                services = e.services or {}
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "scenarioId": e.scenario_id or "",
                        "heatingGeneratorType": services.get("heatingGeneratorType", ""),
                        "energyCarrier": services.get("energyCarrier", ""),
                        "distributionType": services.get("distributionType", ""),
                        "domesticHotWaterSystem": services.get("domesticHotWaterSystem", ""),
                        "ventilationSystem": services.get("ventilationSystem", ""),
                        "renewableEnergyNotes": services.get("renewableEnergyNotes", ""),
                        "knownSystemAge": services.get("knownSystemAge", ""),
                        "measureCandidateNotes": services.get("measureCandidateNotes", ""),
                        "handoffNote": e.handoff_note or "",
                        "familyTypeId": "",
                    }
                )

    elif cat == "energy_renovation_measures":
        for e in doc.elements.values():
            if isinstance(e, RenovationScenarioElem):
                if e.measure_packages:
                    for measure in e.measure_packages:
                        rows.append(
                            {
                                "elementId": f"{e.id}:{measure.id}",
                                "scenarioId": e.id,
                                "scenarioName": e.name,
                                "scenarioStatus": e.scenario_status,
                                "measureId": measure.id,
                                "measureName": measure.name,
                                "measureNotes": measure.notes or "",
                                "costPlaceholder": measure.cost_placeholder or "",
                                "systemsNotes": e.systems_notes or "",
                                "familyTypeId": "",
                            }
                        )
                else:
                    rows.append(
                        {
                            "elementId": e.id,
                            "scenarioId": e.id,
                            "scenarioName": e.name,
                            "scenarioStatus": e.scenario_status,
                            "measureId": "",
                            "measureName": "",
                            "measureNotes": "",
                            "systemsNotes": e.systems_notes or "",
                            "familyTypeId": "",
                        }
                    )

    elif cat == "energy_export_qa":
        rows = [
            {
                "elementId": row.get("elementId", ""),
                "issueCode": row.get("issueCode", ""),
                "severity": row.get("severity", ""),
                "message": row.get("message", ""),
                "missingMaterialKeys": "; ".join(row.get("missingMaterialKeys", []) or []),
                "familyTypeId": "",
            }
            for row in energy_qa_rows(doc)
        ]

    elif cat == "area":
        # KRN-08 — area schedule. Lists name + level + perimeter + computed
        # area + ruleSet for each `area` element.
        for e in doc.elements.values():
            if isinstance(e, AreaElem):
                pts = [{"xMm": float(p.x_mm), "yMm": float(p.y_mm)} for p in e.boundary_mm]
                _area_unused, perimeter = _room_polygon_area_perimeter_sqm(pts)
                computed = (
                    float(e.computed_area_sq_mm) / 1_000_000.0
                    if e.computed_area_sq_mm is not None
                    else 0.0
                )
                lev = lvl_lab.get(e.level_id, e.level_id)
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "levelId": e.level_id,
                        "level": lev,
                        "perimeterM": round(perimeter, 3),
                        "computedAreaM2": round(computed, 3),
                        "ruleSet": e.rule_set,
                        "areaScheme": e.area_scheme,
                        "familyTypeId": "",
                    }
                )

    elif cat in FIRE_SAFETY_SCHEDULE_CATEGORIES:
        rows = derive_fire_safety_schedule_rows(doc, cat)

    elif cat == "construction_package":
        for e in doc.elements.values():
            if isinstance(e, ConstructionPackageElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "code": e.code or "",
                        "phaseId": e.phase_id or "",
                        "plannedStart": e.planned_start or "",
                        "plannedEnd": e.planned_end or "",
                        "actualStart": e.actual_start or "",
                        "actualEnd": e.actual_end or "",
                        "responsibleCompany": e.responsible_company or "",
                        "dependencies": "; ".join(e.dependencies),
                    }
                )

    elif cat == "phase":
        for e in doc.elements.values():
            if isinstance(e, PhaseElem):
                created_count = sum(
                    1
                    for other in doc.elements.values()
                    if getattr(other, "phase_created", None) == e.id
                )
                demolished_count = sum(
                    1
                    for other in doc.elements.values()
                    if getattr(other, "phase_demolished", None) == e.id
                )
                package_count = sum(
                    1
                    for other in doc.elements.values()
                    if isinstance(other, ConstructionPackageElem) and other.phase_id == e.id
                )
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "ord": e.ord,
                        "createdCount": created_count,
                        "demolishedCount": demolished_count,
                        "packageCount": package_count,
                    }
                )

    elif cat == "progress":
        rows = construction_progress_rows(doc)

    elif cat == "punch":
        for e in doc.elements.values():
            if isinstance(e, IssueElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "title": e.title,
                        "status": e.status,
                        "elementIds": "; ".join(e.element_ids),
                        "viewpointId": e.viewpoint_id or "",
                        "evidenceCount": len(e.evidence_refs),
                        "issueKind": "issue",
                    }
                )
            elif isinstance(e, ConstructabilityIssueElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "title": e.message or e.rule_id,
                        "status": e.status,
                        "elementIds": "; ".join(e.element_ids),
                        "viewpointId": "",
                        "evidenceCount": len(e.evidence_refs),
                        "issueKind": "constructability_issue",
                    }
                )

    elif cat == "site_logistics":
        for e in doc.elements.values():
            if isinstance(e, ConstructionLogisticsElem):
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "logisticsKind": e.logistics_kind,
                        "phaseId": e.phase_id or "",
                        "constructionPackageId": e.construction_package_id or "",
                        "plannedStart": e.planned_start or "",
                        "plannedEnd": e.planned_end or "",
                        "actualStart": e.actual_start or "",
                        "actualEnd": e.actual_end or "",
                        "progressStatus": e.progress_status,
                        "responsibleCompany": e.responsible_company or "",
                        "boundaryPointCount": len(e.boundary_mm),
                        "pathPointCount": len(e.path_mm),
                        "evidenceCount": len(e.evidence_refs),
                        "issueCount": len(e.issue_ids),
                    }
                )

    elif cat == "qa_checklist":
        for e in doc.elements.values():
            if isinstance(e, ConstructionQaChecklistElem):
                statuses = [item.status for item in e.checklist]
                rows.append(
                    {
                        "elementId": e.id,
                        "name": e.name,
                        "targetElementIds": "; ".join(e.target_element_ids),
                        "constructionPackageId": e.construction_package_id or "",
                        "phaseId": e.phase_id or "",
                        "responsibleCompany": e.responsible_company or "",
                        "progressStatus": e.progress_status,
                        "checklistItemCount": len(e.checklist),
                        "passedCount": statuses.count("pass"),
                        "failedCount": statuses.count("fail"),
                        "openCount": statuses.count("open"),
                        "evidenceCount": len(e.evidence_refs),
                        "issueCount": len(e.issue_ids),
                    }
                )

    else:
        rows = []

    rows = _rows_after_filter_equals(rows, filter_equals)
    rows = _rows_after_filter_rules(rows, filter_rules_norm, key_aliases)

    # Grouping / sorting on server hint
    grouped: dict[str, list[dict[str, Any]]] | None = None
    if group_keys:

        def gkey(row: dict[str, Any]) -> tuple:
            vals = []
            for k in group_keys:
                lk = key_aliases.get(k, k)

                vals.append(row.get(lk))
            return tuple(vals)

        buckets: defaultdict[tuple, list[dict[str, Any]]] = defaultdict(list)
        for r in rows:
            buckets[gkey(r)].append(r)
        grouped = {}
        for k in sorted(buckets.keys(), key=_group_bucket_sort_key):
            grouped[" / ".join(str(x) for x in k)] = list(buckets[k])

    stable_sort_field = filt.get("sortBy") or filt.get("SortBy") or sch_group.get("sortBy")
    ssf = str(stable_sort_field).strip() if stable_sort_field else None

    if grouped:
        grouped = {
            lbl: _sort_rows_stable(
                gs,
                sort_field=ssf,
                key_aliases=key_aliases,
                sort_descending=sort_descending,
                default_name_fallback=True,
            )
            for lbl, gs in grouped.items()
        }
        total_rows = sum(len(gs) for gs in grouped.values())
    else:
        rows = _sort_rows_stable(
            rows,
            sort_field=ssf,
            key_aliases=key_aliases,
            sort_descending=sort_descending,
            default_name_fallback=True,
        )
        total_rows = len(rows)

    leaf_rows: list[dict[str, Any]]
    if grouped:
        leaf_rows = []
        for grp in grouped.values():
            leaf_rows.extend(grp)
    else:
        leaf_rows = list(rows)

    observed_keys = {k for r in leaf_rows for k in r.keys()} if leaf_rows else set()
    columns = stable_column_keys(cat, observed_keys)
    dck_raw = filt.get("displayColumnKeys") or filt.get("display_column_keys")
    if isinstance(dck_raw, list) and dck_raw:
        want_list = [str(x) for x in dck_raw if str(x).strip()]
        if want_list:
            want_set = set(want_list)
            narrowed = [c for c in columns if c in want_set]
            if narrowed:
                columns = narrowed

    totals: dict[str, Any] = {}
    if cat in {"room", "finish"} and leaf_rows:
        tgt_vals = [
            float(r["targetAreaM2"]) for r in leaf_rows if r.get("targetAreaM2") is not None
        ]
        totals = {
            "kind": cat,
            "rowCount": len(leaf_rows),
            "areaM2": round(sum(float(r.get("areaM2") or 0.0) for r in leaf_rows), 4),
            "perimeterM": round(sum(float(r.get("perimeterM") or 0.0) for r in leaf_rows), 4),
            "finishCompleteCount": sum(1 for r in leaf_rows if r.get("finishState") == "complete"),
            "finishMissingCount": sum(1 for r in leaf_rows if r.get("finishState") == "missing"),
            "finishPeerSuggestedCount": sum(
                1 for r in leaf_rows if r.get("finishState") == "peer_suggested"
            ),
            "finishNotRequiredCount": sum(
                1 for r in leaf_rows if r.get("finishState") == "not_required"
            ),
            **({"targetAreaM2": round(sum(tgt_vals), 4)} if tgt_vals else {}),
        }
    elif cat == "window" and leaf_rows:
        totals = {
            "kind": "window",
            "rowCount": len(leaf_rows),
            "averageWidthMm": round(
                sum(float(r.get("widthMm") or 0.0) for r in leaf_rows) / max(len(leaf_rows), 1),
                3,
            ),
            "sumRoughOpeningWidthMm": round(
                sum(float(r.get("roughOpeningWidthMm") or 0.0) for r in leaf_rows), 3
            ),
            "sumRoughOpeningHeightMm": round(
                sum(float(r.get("roughOpeningHeightMm") or 0.0) for r in leaf_rows), 3
            ),
            "roughOpeningAreaM2": round(
                sum(float(r.get("roughOpeningAreaM2") or 0.0) for r in leaf_rows), 6
            ),
            "totalOpeningAreaM2": round(
                sum(float(r.get("openingAreaM2") or 0.0) for r in leaf_rows), 6
            ),
        }
    elif cat == "door" and leaf_rows:
        totals = {
            "kind": "door",
            "rowCount": len(leaf_rows),
            "sumRoughOpeningWidthMm": round(
                sum(float(r.get("roughOpeningWidthMm") or 0.0) for r in leaf_rows), 3
            ),
            "sumRoughOpeningHeightMm": round(
                sum(float(r.get("roughOpeningHeightMm") or 0.0) for r in leaf_rows), 3
            ),
            "roughOpeningAreaM2": round(
                sum(float(r.get("roughOpeningAreaM2") or 0.0) for r in leaf_rows), 6
            ),
        }
    elif cat == "floor" and leaf_rows:
        totals = {
            "kind": "floor",
            "rowCount": len(leaf_rows),
            "areaM2": round(sum(float(r.get("areaM2") or 0.0) for r in leaf_rows), 4),
        }
    elif cat == "roof" and leaf_rows:
        totals = {
            "kind": "roof",
            "rowCount": len(leaf_rows),
            "footprintAreaM2": round(
                sum(float(r.get("footprintAreaM2") or 0.0) for r in leaf_rows), 4
            ),
        }
    elif cat == "stair" and leaf_rows:
        totals = {
            "kind": "stair",
            "rowCount": len(leaf_rows),
            "totalRunMm": round(sum(float(r.get("runMm") or 0.0) for r in leaf_rows), 4),
        }
    elif cat == "sheet" and leaf_rows:
        totals = {
            "kind": "sheet",
            "rowCount": len(leaf_rows),
            "totalViewports": int(sum(int(r.get("viewportCount") or 0) for r in leaf_rows)),
        }
    elif cat == "material_assembly" and leaf_rows:
        totals = {
            "kind": "material_assembly",
            "rowCount": len(leaf_rows),
            "grossVolumeM3": round(sum(float(r.get("grossVolumeM3") or 0.0) for r in leaf_rows), 8),
        }
    elif cat.startswith("energy_") and leaf_rows:
        totals = {
            "kind": cat,
            "rowCount": len(leaf_rows),
        }
        if any("surfaceAreaM2" in r for r in leaf_rows):
            totals["surfaceAreaM2"] = round(
                sum(float(r.get("surfaceAreaM2") or 0.0) for r in leaf_rows), 6
            )
    elif cat in {
        "construction_package",
        "phase",
        "progress",
        "punch",
        "site_logistics",
        "qa_checklist",
    } and leaf_rows:
        totals = {"kind": cat, "rowCount": len(leaf_rows)}
    elif cat in {"quantity_takeoff", "cost_estimate", "element_cost_group", "scenario_delta"}:
        totals = cost_quantity_totals(leaf_rows, kind=cat)

    out: dict[str, Any] = {
        "scheduleId": schedule_id,
        "name": sch.name,
        "category": cat,
        "columns": columns,
        "columnMetadata": column_metadata_bundle(cat),
        "scheduleEngine": {
            "format": "scheduleDerivationEngine_v1",
            "category": cat,
            "groupKeys": group_keys,
            "sortBy": ssf,
            "sortTieBreak": "elementId",
            "supportsCsv": True,
            **({"sortDescending": True} if sort_descending else {}),
            **({"filterEquals": filter_equals} if filter_equals else {}),
            **({"filterRules": filter_rules_norm} if filter_rules_norm else {}),
        },
        "totalRows": total_rows,
        "groupKeys": group_keys,
        **({"groupedSections": grouped} if grouped else {"rows": rows}),
    }
    if cat in {"quantity_takeoff", "cost_estimate", "element_cost_group", "scenario_delta"}:
        out["scheduleEngine"].update(
            {
                "lensId": COST_QUANTITY_LENS_ID,
                "traceability": "elementId/typeId/scenarioId",
                "snapshotKind": "exportable_cost_snapshot"
                if cat in {"cost_estimate", "element_cost_group", "scenario_delta"}
                else "model_derived_quantity_takeoff",
            }
        )
    placement_sid = (sch.sheet_id or "").strip()
    if placement_sid:
        pel = doc.elements.get(placement_sid)
        if isinstance(pel, SheetElem):
            out["schedulePlacement"] = {"sheetId": placement_sid, "sheetName": pel.name or ""}
    if totals:
        out["totals"] = totals
    if cat.startswith("energy_"):
        out["energyHandoff"] = build_energy_handoff_payload(doc)
    if cat in {"room", "finish"}:
        lvl_allow = _allowed_levels_from_schedule_filter_equals(filter_equals)
        rb = compute_room_boundary_derivation(doc)
        vacant_m2, vacant_n = vacant_derived_metrics_for_authority(
            rb, allowed_level_ids=lvl_allow, authority="authoritative"
        )
        preview_m2, preview_n = vacant_derived_metrics_for_authority(
            rb, allowed_level_ids=lvl_allow, authority="preview_heuristic"
        )
        blocking_scope = False
        non_auth_reason_codes: set[str] = set()
        for diag in rb.get("diagnostics") or []:
            if not isinstance(diag, dict):
                continue
            code = str(diag.get("code") or "")
            if code not in ROOM_CLOSURE_BLOCKING_DIAGNOSTIC_CODES:
                continue
            lvl_d = str(diag.get("levelId") or "")
            if lvl_allow is not None and lvl_d not in lvl_allow:
                continue
            blocking_scope = True
            non_auth_reason_codes.add(code)

        incomplete_auth = preview_m2 > 0 and vacant_m2 == 0
        authoritative_closure_complete = not (incomplete_auth or blocking_scope)
        if preview_m2 > 0:
            non_auth_reason_codes.add("preview_heuristic_vacant_footprints_not_in_closure_totals")
        if incomplete_auth:
            non_auth_reason_codes.add("authoritative_vacant_unavailable_but_preview_present")

        closure = {
            "format": "roomProgrammeClosure_v0",
            "boundaryHeuristicVersion": ROOM_BOUNDARY_HEURISTIC_VERSION,
            "authoritativeVacantDerivedAreaM2": vacant_m2,
            "authoritativeVacantFootprintCount": vacant_n,
            "previewHeuristicVacantDerivedAreaM2": preview_m2,
            "previewHeuristicVacantFootprintCount": preview_n,
            "authoritativeVacantClosureComplete": authoritative_closure_complete,
            "nonAuthoritativeReasonCodes": sorted(non_auth_reason_codes),
            "roomSeparationAxisSummary_v0": room_separation_axis_summary_v0_payload(doc, rb),
        }
        if totals and "targetAreaM2" in totals:
            try:
                area_sum = float(totals.get("areaM2") or 0.0)
                tgt_sum = float(totals["targetAreaM2"])
                closure["programmeScheduleResidualM2"] = round(tgt_sum - area_sum - vacant_m2, 4)
            except (TypeError, ValueError):
                pass
        out["roomProgrammeClosure_v0"] = closure
        out["roomFinishScheduleEvidence_v1"] = build_room_finish_schedule_evidence_v1(leaf_rows)
    pag_ev = build_schedule_pagination_placement_evidence_v0(
        doc,
        schedule_id,
        schedule_el=sch,
        leaf_rows=leaf_rows,
        total_rows=total_rows,
    )
    out["schedulePaginationPlacementEvidence_v0"] = pag_ev
    out["scheduleSheetExportParityEvidence_v1"] = (
        build_schedule_sheet_export_parity_evidence_v1_for_schedule(
            doc, sch, payload=out, pagination_evidence=pag_ev
        )
    )
    return out


def list_schedule_ids(doc: Document) -> list[str]:
    return [e.id for e in doc.elements.values() if isinstance(e, ScheduleElem)]
