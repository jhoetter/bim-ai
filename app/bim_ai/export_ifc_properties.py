"""Property set and classification helpers for IFC kernel export."""

from __future__ import annotations

import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import BeamElem, CeilingElem, ColumnElem, LevelElem, RailingElem, StairElem


def stair_common_pset_properties(stair: StairElem, doc: Document) -> dict[str, Any]:
    bl = doc.elements.get(stair.base_level_id)
    tl = doc.elements.get(stair.top_level_id)
    rise_mm = (
        abs(tl.elevation_mm - bl.elevation_mm)
        if isinstance(bl, LevelElem) and isinstance(tl, LevelElem)
        else float(stair.riser_mm) * 16.0
    )
    riser_mm_val = float(stair.riser_mm) if stair.riser_mm > 0 else 175.0
    riser_count = max(1, round(rise_mm / riser_mm_val))
    return {
        "NumberOfRiser": int(riser_count),
        "NumberOfTreads": int(max(0, riser_count - 1)),
        "RiserHeight": float(riser_mm_val) / 1000.0,
        "TreadLength": float(stair.tread_mm) / 1000.0,
    }


def column_common_pset_properties(column: ColumnElem) -> dict[str, Any]:
    return {
        "Reference": str(column.id),
        "LoadBearing": True,
        "IsExternal": False,
    }


def beam_common_pset_properties(beam: BeamElem) -> dict[str, Any]:
    sx = float(beam.start_mm.x_mm) / 1000.0
    sy = float(beam.start_mm.y_mm) / 1000.0
    ex = float(beam.end_mm.x_mm) / 1000.0
    ey = float(beam.end_mm.y_mm) / 1000.0
    span_m = math.hypot(ex - sx, ey - sy)
    return {
        "Reference": str(beam.id),
        "Span": float(span_m),
        "LoadBearing": True,
        "IsExternal": False,
    }


def ceiling_common_pset_properties(ceiling: CeilingElem) -> dict[str, Any]:
    return {
        "Reference": str(ceiling.id),
        "IsExternal": False,
    }


def railing_common_pset_properties(railing: RailingElem) -> dict[str, Any]:
    return {
        "Reference": str(railing.id),
        "Height": float(railing.guard_height_mm) / 1000.0,
        "IsExternal": False,
    }


def try_attach_qto(f: Any, product: Any, qto_name: str, properties: dict[str, float]) -> None:
    """Narrow QTO slice — ignored when IfcOpenShell build lacks qto use-cases."""

    try:
        from ifcopenshell.api.pset.add_qto import add_qto  # type: ignore import-not-found
        from ifcopenshell.api.pset.edit_qto import edit_qto  # type: ignore import-not-found

        qto = add_qto(f, product=product, name=qto_name)
        edit_qto(f, qto=qto, properties=dict(properties))
    except Exception:
        return


def try_attach_classification_reference(
    f: Any,
    product: Any,
    *,
    classification_code: str | None,
    classification_cache: dict[str, Any],
    classification_ref_cache: dict[str, Any],
) -> None:
    """Best-effort IfcClassificationReference attachment for a bim-ai element code."""

    if not classification_code:
        return
    code = str(classification_code).strip()
    if not code:
        return
    try:
        import ifcopenshell.api.classification  # noqa: PLC0415
    except ImportError:
        return
    try:
        sys_name = code.split(":", 1)[0].split("_", 1)[0] or "BimAi"
        cls_ent = classification_cache.get(sys_name)
        if cls_ent is None:
            cls_ent = ifcopenshell.api.classification.add_classification(
                f, classification=str(sys_name)[:64]
            )
            classification_cache[sys_name] = cls_ent
        ref_ent = classification_ref_cache.get(code)
        if ref_ent is None:
            ref_ent = ifcopenshell.api.classification.add_reference(
                f,
                products=[product],
                classification=cls_ent,
                identification=str(code)[:128],
                name=str(code)[:128],
            )
            classification_ref_cache[code] = ref_ent
        else:
            try:
                ifcopenshell.api.classification.add_reference(
                    f,
                    products=[product],
                    reference=ref_ent,
                )
            except Exception:
                ifcopenshell.api.classification.add_reference(
                    f,
                    products=[product],
                    classification=cls_ent,
                    identification=str(code)[:128],
                    name=str(code)[:128],
                )
    except Exception:
        return


def maybe_attach_classification(
    f: Any,
    product: Any,
    element: Any,
    *,
    classification_cache: dict[str, Any],
    classification_ref_cache: dict[str, Any],
) -> None:
    try_attach_classification_reference(
        f,
        product,
        classification_code=getattr(element, "ifc_classification_code", None),
        classification_cache=classification_cache,
        classification_ref_cache=classification_ref_cache,
    )


def safe_edit_pset(f: Any, product: Any, *, name: str, properties: dict[str, Any]) -> None:
    """Best-effort attach Pset_*Common to a product."""

    if not properties:
        return
    try:
        from ifcopenshell.api.pset.add_pset import add_pset  # noqa: PLC0415
        from ifcopenshell.api.pset.edit_pset import edit_pset  # noqa: PLC0415
    except ImportError:
        return
    try:
        ps = add_pset(f, product=product, name=name)
        edit_pset(f, pset=ps, properties=dict(properties))
    except Exception:
        return


def energy_handoff_pset_properties(element: Any) -> dict[str, Any]:
    props: dict[str, Any] = {}
    classification = getattr(element, "thermal_classification", None)
    if classification:
        props["BimAiThermalClassification"] = str(classification)
    source = getattr(element, "thermal_classification_source", None)
    if source:
        props["BimAiThermalClassificationSource"] = str(source)
    scenario_id = getattr(element, "energy_scenario_id", None)
    if scenario_id:
        props["BimAiEnergyScenarioId"] = str(scenario_id)
    for attr, key in (
        ("u_value", "BimAiUValueWPerM2K"),
        ("g_value", "BimAiGValue"),
        ("frame_fraction", "BimAiFrameFraction"),
        ("annual_shading_factor_estimate", "BimAiAnnualShadingFactorEstimate"),
    ):
        value = getattr(element, attr, None)
        if value is not None:
            props[key] = float(value)
    for attr, key in (
        ("air_tightness_class", "BimAiAirTightnessClass"),
        ("installation_thermal_bridge_note", "BimAiInstallationThermalBridgeNote"),
        ("shading_device", "BimAiShadingDevice"),
    ):
        value = getattr(element, attr, None)
        if value:
            props[key] = str(value)
    return props


def attach_energy_handoff_pset(f: Any, product: Any, element: Any) -> None:
    safe_edit_pset(
        f,
        product,
        name="Pset_BimAiEnergyHandoff",
        properties=energy_handoff_pset_properties(element),
    )


def attach_stair_common_pset(f: Any, ifc_stair: Any, stair: StairElem, doc: Document) -> None:
    safe_edit_pset(
        f,
        ifc_stair,
        name="Pset_StairCommon",
        properties=stair_common_pset_properties(stair, doc),
    )


def attach_column_common_pset(f: Any, ifc_column: Any, column: ColumnElem) -> None:
    safe_edit_pset(
        f,
        ifc_column,
        name="Pset_ColumnCommon",
        properties=column_common_pset_properties(column),
    )


def attach_beam_common_pset(f: Any, ifc_beam: Any, beam: BeamElem) -> None:
    safe_edit_pset(
        f,
        ifc_beam,
        name="Pset_BeamCommon",
        properties=beam_common_pset_properties(beam),
    )


def attach_ceiling_common_pset(f: Any, ifc_covering: Any, ceiling: CeilingElem) -> None:
    safe_edit_pset(
        f,
        ifc_covering,
        name="Pset_CoveringCommon",
        properties=ceiling_common_pset_properties(ceiling),
    )


def attach_railing_common_pset(f: Any, ifc_railing: Any, railing: RailingElem) -> None:
    safe_edit_pset(
        f,
        ifc_railing,
        name="Pset_RailingCommon",
        properties=railing_common_pset_properties(railing),
    )
