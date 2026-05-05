"""Deterministic roof layered prism + section-cut witness payloads (Prompt 2 slice)."""

from __future__ import annotations

from typing import Any, cast

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoofElem
from bim_ai.material_assembly_resolve import resolved_layers_for_roof
from bim_ai.roof_geometry import (
    RidgeAxisPlan,
    gable_pitched_rectangle_elevation_supported_v0,
    gable_ridge_rise_mm,
    gable_ridge_segment_plan_mm,
    outer_rect_extent,
    roof_geometry_support_token_v0,
)


def build_roof_layered_prism_witness_v1(
    doc: Document,
    roof: RoofElem,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (witness_dict, None) when gable-supported with typed layers; else (None, skip_reason)."""

    poly = [(float(p.x_mm), float(p.y_mm)) for p in roof.footprint_mm]
    lvl_ok = isinstance(doc.elements.get(roof.reference_level_id), LevelElem)
    support_tok = roof_geometry_support_token_v0(
        footprint_mm=poly,
        roof_geometry_mode=roof.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=roof.slope_deg,
    )
    gable_ok = gable_pitched_rectangle_elevation_supported_v0(
        footprint_mm=poly,
        roof_geometry_mode=roof.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=roof.slope_deg,
    )

    rt_id = (roof.roof_type_id or "").strip()
    layers = resolved_layers_for_roof(doc, roof)

    if not gable_ok or support_tok != "gable_pitched_rectangle_supported":
        tok = (
            str(support_tok)
            if support_tok is not None
            else "skipped_not_gable_elevation_supported_v1"
        )
        return None, tok

    if not rt_id:
        return None, "roof_missing_roof_type_id"

    if not layers:
        return None, "roof_type_without_layers"

    lvl = doc.elements.get(roof.reference_level_id)
    zb = float(lvl.elevation_mm) if isinstance(lvl, LevelElem) else 0.0
    slope = float(roof.slope_deg or 25.0)
    x0_mm, x1_mm, z0_mm, z1_mm = outer_rect_extent(poly)
    span_x = float(x1_mm - x0_mm)
    span_z = float(z1_mm - z0_mm)
    rise_mm, axis_str = gable_ridge_rise_mm(span_x, span_z, slope)
    ridge_z = zb + rise_mm
    ridge_axis_plan = cast(RidgeAxisPlan, axis_str)
    seg_a, seg_b = gable_ridge_segment_plan_mm(x0_mm, x1_mm, z0_mm, z1_mm, ridge_axis_plan)

    cumulative = 0.0
    layer_rows: list[dict[str, Any]] = []
    for i, lyr in enumerate(layers):
        thick = round(float(lyr["thicknessMm"]), 3)
        bot = cumulative
        cumulative = round(cumulative + thick, 3)
        layer_rows.append(
            {
                "layerIndex": i,
                "function": str(lyr["function"]),
                "materialKey": str(lyr.get("materialKey") or "").strip(),
                "thicknessMm": thick,
                "cumulativeThicknessFromAssemblyBottomMm": cumulative,
                "offsetBottomMmAboveEave": round(bot, 3),
                "offsetTopMmAboveEave": round(cumulative, 3),
                "worldZBottomMm": round(bot + zb, 3),
                "worldZTopMm": round(cumulative + zb, 3),
            }
        )

    total_asm = cumulative
    witness: dict[str, Any] = {
        "format": "roofLayeredPrismWitness_v1",
        "roofLayeredPrismStackModel_v0": "vertical_stack_from_eave",
        "elementId": roof.id,
        "assemblyTotalThicknessMm": total_asm,
        "eavePlateZMm": round(zb, 3),
        "ridgeZMm": round(ridge_z, 3),
        "ridgeEnvelopeTopZMm": round(ridge_z + total_asm, 3),
        "ridgeAxisPlan": axis_str,
        "ridgeSegmentPlanMm": [
            [round(seg_a[0], 3), round(seg_a[1], 3)],
            [round(seg_b[0], 3), round(seg_b[1], 3)],
        ],
        "footprintPlanExtentsMm": {
            "xMin": round(x0_mm, 3),
            "xMax": round(x1_mm, 3),
            "zMin": round(z0_mm, 3),
            "zMax": round(z1_mm, 3),
        },
        "layerReadouts": layer_rows,
    }
    return witness, None


def roof_layered_prism_payload_for_merge_v1(
    doc: Document,
    roof: RoofElem,
) -> dict[str, Any]:
    """Keys to merge onto manifest/plan payloads (witness or skip, never both)."""

    w, skip = build_roof_layered_prism_witness_v1(doc, roof)
    if w is not None:
        return {"roofLayeredPrismWitness_v1": w}
    assert skip is not None
    return {"roofLayeredPrismWitnessSkipReason_v0": skip}


def build_roof_section_cut_witness_v0(
    *,
    proxy_kind: str,
    prism_witness: dict[str, Any] | None,
    prism_skip_reason: str | None,
    eave_plate_z_mm: float | None,
    ridge_z_mm: float | None,
) -> dict[str, Any]:
    """Section-roof-row nested witness for fixtures (intersects strip implied True when row exists)."""

    intersects = True

    has_full_prism = prism_witness is not None

    if has_full_prism:
        profile = "gableLayeredPrismChord_v1"
        support = "gable_rectangle_layered_prism_v1"
    elif proxy_kind == "gablePitchedRectangleChord":
        profile = "gableLayeredPrismChord_partial_v1"
        support = (
            f"skipped_prism_{prism_skip_reason}"
            if prism_skip_reason
            else "skipped_prism_unknown_v1"
        )
    else:
        profile = "footprintChord_skipLayeredPrism_v1"
        support = (
            f"skipped_prism_{prism_skip_reason}"
            if prism_skip_reason
            else "skipped_prism_not_gable_chord_v1"
        )

    out: dict[str, Any] = {
        "format": "roofSectionCutWitness_v0",
        "sectionCutIntersectsRoofFootprintStrip": intersects,
        "sectionProfileToken_v0": profile,
        "roofSectionCutSupportToken_v0": support,
    }
    if eave_plate_z_mm is not None:
        out["eavePlateZMm"] = round(float(eave_plate_z_mm), 3)
    if ridge_z_mm is not None:
        out["ridgeZMm"] = round(float(ridge_z_mm), 3)

    if prism_witness is not None:
        lr = prism_witness.get("layerReadouts")
        if isinstance(lr, list):
            out["layerReadouts"] = lr
    elif prism_skip_reason is not None:
        out["layerReadouts"] = []

    return out


def document_has_roof_layered_prism_witness_v1(doc: Document) -> bool:
    for eid in sorted(doc.elements.keys()):
        el = doc.elements[eid]
        if not isinstance(el, RoofElem):
            continue
        w, _ = build_roof_layered_prism_witness_v1(doc, el)
        if w is not None:
            return True
    return False
