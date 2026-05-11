"""glTF 2.0 JSON export — axis-aligned boxes + TRS nodes aligned with packages/web/src/Viewport.tsx."""

from __future__ import annotations

import base64
import hashlib
import json
import math
import struct
from dataclasses import dataclass
from typing import Any, Literal, cast

from bim_ai.cut_solid_kernel import (
    collect_hosted_cut_manifest_warnings,
    collect_skew_wall_hosted_opening_evidence_v0,
    collect_wall_floor_slab_cut_boxes,
)
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    LevelElem,
    RoofElem,
    RoofTypeElem,
    RoomElem,
    SiteElem,
    StairElem,
    ViewpointElem,
    WallElem,
    WindowElem,
)
from bim_ai.material_assembly_resolve import (
    collect_layered_assembly_cut_alignment_evidence_v0,
    collect_layered_assembly_witness_v0,
    material_assembly_manifest_evidence,
    material_catalog_audit_evidence_v0,
    roof_surface_material_readout_v0,
)
from bim_ai.opening_cut_primitives import xz_bounds_mm_from_poly
from bim_ai.roof_geometry import (
    RidgeAxisPlan,
    gable_pitched_rectangle_elevation_supported_v0,
    gable_rectangle_fascia_edge_plan_token_v0,
    gable_ridge_rise_mm,
    gable_ridge_segment_plan_mm,
    outer_rect_extent,
    plan_polygon_signed_area_mm2,
    plan_polygon_winding_token,
    roof_geometry_support_token_v0,
    roof_plan_geometry_readout_v0,
)
from bim_ai.roof_layered_prism_evidence_v1 import (
    document_has_roof_layered_prism_witness_v1,
    roof_layered_prism_payload_for_merge_v1,
)
from bim_ai.stair_plan_proxy import (
    stair_documentation_diagnostics,
    stair_documentation_placeholders_v0,
    stair_plan_up_down_label,
    stair_riser_count_plan_proxy,
    stair_run_bearing_deg_ccw_from_plan_x,
    stair_schedule_row_extensions_v1,
    stair_tread_count_straight_plan_proxy,
)
from bim_ai.wall_join_evidence import (
    collect_wall_corner_join_evidence_v0,
    collect_wall_corner_join_summary_v1,
)
from bim_ai.wall_opening_cut_fidelity import collect_wall_opening_cut_fidelity_evidence_v1

EXPORT_GEOMETRY_KINDS: frozenset[str] = frozenset(
    {"wall", "floor", "roof", "door", "window", "room", "stair", "slab_opening"}
)
VERT_BYTES = 6 * 4  # POSITION(vec3)+NORMAL(vec3) as f32

# Canonical ordered list of all known glTF extension tokens emitted by the exporter.
GLTF_KNOWN_EXTENSION_TOKENS: tuple[str, ...] = (
    "bim_ai_box_primitive_v0",
    "bim_ai_gable_roof_v0",
    "bim_ai_roof_geometry_evidence_v1",
    "bim_ai_wall_corner_joins_v0",
    "bim_ai_wall_corner_join_summary_v1",
    "bim_ai_skew_wall_hosted_openings_v0",
    "bim_ai_wall_opening_cut_fidelity_v1",
    "bim_ai_layered_assembly_cut_alignment_v0",
    "bim_ai_layered_assembly_witness_v0",
    "bim_ai_site_context_v0",
    "bim_ai_roof_unsupported_shape_summary_v0",
    "bim_ai_roof_layered_prism_witness_v1",
    "bim_ai_saved_3d_view_clip_v1",
)

# Map: extension token → manifest payload key holding its evidence data.
# None means the token's digest is derived from the parity/geometry fields.
_EXTENSION_TOKEN_PAYLOAD_KEY: dict[str, str | None] = {
    "bim_ai_box_primitive_v0": None,
    "bim_ai_gable_roof_v0": "roofGeometryEvidence_v1",
    "bim_ai_roof_geometry_evidence_v1": "roofGeometryEvidence_v1",
    "bim_ai_wall_corner_joins_v0": "wallCornerJoinEvidence_v0",
    "bim_ai_wall_corner_join_summary_v1": "wallCornerJoinSummary_v1",
    "bim_ai_skew_wall_hosted_openings_v0": "skewWallHostedOpeningEvidence_v0",
    "bim_ai_wall_opening_cut_fidelity_v1": "wallOpeningCutFidelityEvidence_v1",
    "bim_ai_layered_assembly_cut_alignment_v0": "layeredAssemblyCutAlignmentEvidence_v0",
    "bim_ai_layered_assembly_witness_v0": "layeredAssemblyWitness_v0",
    "bim_ai_site_context_v0": "siteContextEvidence_v0",
    "bim_ai_roof_unsupported_shape_summary_v0": "roofGeometryUnsupportedShapeSummary_v0",
    "bim_ai_roof_layered_prism_witness_v1": "roofGeometryEvidence_v1",
    "bim_ai_saved_3d_view_clip_v1": "saved3dViewClipEvidence_v1",
}

# Map: extension token → element kind whose presence makes the extension "expected".
# Used by advisory rules to detect missing extensions on eligible models.
GLTF_EXTENSION_TOKEN_ELIGIBLE_KIND: dict[str, str] = {
    "bim_ai_gable_roof_v0": "roof",
    "bim_ai_roof_geometry_evidence_v1": "roof",
    "bim_ai_wall_corner_joins_v0": "wall",
    "bim_ai_wall_corner_join_summary_v1": "wall",
    "bim_ai_skew_wall_hosted_openings_v0": "wall",
    "bim_ai_wall_opening_cut_fidelity_v1": "wall",
    "bim_ai_layered_assembly_cut_alignment_v0": "wall",
    "bim_ai_layered_assembly_witness_v0": "wall",
    "bim_ai_site_context_v0": "site",
    "bim_ai_roof_unsupported_shape_summary_v0": "roof",
    "bim_ai_roof_layered_prism_witness_v1": "roof",
    "bim_ai_saved_3d_view_clip_v1": "viewpoint",
}


def _sha256_hex(obj: Any) -> str:
    blob = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode()).hexdigest()


def build_gltf_export_manifest_closure_v1(
    mesh_enc: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Build gltfExportManifestClosure_v1 from the completed manifest payload.

    Returns ordered extension token list, per-extension digests, total closure
    digest, and a presence matrix recording emitted vs skipped_ineligible status.
    The closure digest is stable under deterministic input element re-orderings
    because all digests are computed over sort_keys=True JSON serialisations.
    """
    emitted_set = set(mesh_enc.split("+"))
    parity_blob = {
        k: payload.get(k) for k in ("elementCount", "countsByKind", "exportedGeometryKinds")
    }

    extension_tokens: list[str] = []
    extension_digests: dict[str, str] = {}
    presence_matrix: list[dict[str, Any]] = []

    for token in GLTF_KNOWN_EXTENSION_TOKENS:
        if token in emitted_set:
            key = _EXTENSION_TOKEN_PAYLOAD_KEY.get(token)
            digest = _sha256_hex(parity_blob if key is None else payload.get(key))
            extension_tokens.append(token)
            extension_digests[token] = digest
            presence_matrix.append(
                {
                    "token": token,
                    "status": "emitted",
                    "digestSha256": digest,
                    "skipReasonCode": None,
                }
            )
        else:
            presence_matrix.append(
                {
                    "token": token,
                    "status": "skipped_ineligible",
                    "digestSha256": None,
                    "skipReasonCode": "no_eligible_elements",
                }
            )

    closure_digest = _sha256_hex(
        {"extensionTokens": extension_tokens, "extensionDigests": extension_digests}
    )
    return {
        "format": "gltfExportManifestClosure_v1",
        "extensionTokens": extension_tokens,
        "extensionDigests": extension_digests,
        "gltfExportManifestClosureDigestSha256": closure_digest,
        "extensionPresenceMatrix": presence_matrix,
    }


def _kind_counts(doc: Document) -> dict[str, int]:
    kinds: dict[str, int] = {}
    for e in doc.elements.values():
        k = getattr(e, "kind", "?")
        kinds[k] = kinds.get(k, 0) + 1
    return kinds


def _unsupported_geometry_entries(counts_by_kind: dict[str, int]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for k in sorted(counts_by_kind.keys()):
        if k in EXPORT_GEOMETRY_KINDS or k in {"level", "site"}:
            continue
        out.append({"kind": k, "count": counts_by_kind[k]})
    return out


def _exported_geometry_counts(counts_by_kind: dict[str, int]) -> dict[str, int]:
    return {k: counts_by_kind[k] for k in sorted(EXPORT_GEOMETRY_KINDS) if counts_by_kind.get(k)}


def exchange_parity_manifest_fields_from_document(doc: Document) -> dict[str, Any]:
    """Shared kernel statistics for exchange manifests (IFC/glTF symmetry)."""

    counts = _kind_counts(doc)
    return {
        "elementCount": len(doc.elements),
        "countsByKind": dict(sorted(counts.items())),
        "exportedGeometryKinds": _exported_geometry_counts(counts),
        "unsupportedDocumentKindsDetailed": _unsupported_geometry_entries(counts),
    }


def exchange_parity_manifest_fields(
    *,
    element_count: int,
    counts_by_kind: dict[str, int],
) -> dict[str, Any]:
    """Parity subset when only aggregated counts exist (fixtures / tests)."""

    return {
        "elementCount": element_count,
        "countsByKind": dict(sorted(counts_by_kind.items())),
        "exportedGeometryKinds": _exported_geometry_counts(counts_by_kind),
        "unsupportedDocumentKindsDetailed": _unsupported_geometry_entries(counts_by_kind),
    }


def _document_has_gable_roof_mesh(doc: Document) -> bool:
    return len(_collect_gable_roof_visual_slices(doc)) > 0


def _roof_geometry_evidence_v1_row(doc: Document, e: RoofElem) -> dict[str, Any] | None:
    pts = [(float(p.x_mm), float(p.y_mm)) for p in e.footprint_mm]
    if len(pts) < 3:
        return None
    lvl_ok = isinstance(doc.elements.get(e.reference_level_id), LevelElem)
    support_tok = roof_geometry_support_token_v0(
        footprint_mm=pts,
        roof_geometry_mode=e.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=e.slope_deg,
    )
    area_mm2 = plan_polygon_signed_area_mm2(pts)
    winding = plan_polygon_winding_token(area_mm2)
    x0_mm, x1_mm, z0_mm, z1_mm = outer_rect_extent(pts)
    span_x = float(x1_mm - x0_mm)
    span_z = float(z1_mm - z0_mm)
    slope = float(e.slope_deg or 25.0)
    oh = round(float(e.overhang_mm), 3)
    gable_ok = gable_pitched_rectangle_elevation_supported_v0(
        footprint_mm=pts,
        roof_geometry_mode=e.roof_geometry_mode,
        reference_level_resolves=lvl_ok,
        slope_deg=e.slope_deg,
    )
    row: dict[str, Any] = {
        "elementId": e.id,
        "roofGeometryMode": e.roof_geometry_mode,
        "footprintVertexCount": len(pts),
        "footprintPlanWinding": winding,
        "planSpanXmMm": round(span_x, 3),
        "planSpanZmMm": round(span_z, 3),
        "slopeDeg": round(slope, 3),
        "overhangMm": oh,
        "roofElementName": e.name,
        "roofPlanGeometryReadout_v0": roof_plan_geometry_readout_v0(
            roof_geometry_mode=e.roof_geometry_mode,
            roof_geometry_support_token=support_tok,
            gable_elevation_supported=gable_ok,
        ),
    }
    if support_tok is not None:
        row["roofGeometrySupportToken"] = support_tok
    tid = (e.roof_type_id or "").strip()
    if tid:
        row["roofTypeId"] = tid
        rt_el = doc.elements.get(tid)
        if isinstance(rt_el, RoofTypeElem):
            row["roofTypeName"] = rt_el.name

    if e.roof_geometry_mode == "mass_box":
        row["roofTopologyToken"] = "mass_box_proxy"
        row["ridgeInferable"] = False
    elif support_tok == "gable_pitched_rectangle_supported":
        rise_mm, axis_str = gable_ridge_rise_mm(span_x, span_z, slope)
        axis_plan = cast(RidgeAxisPlan, axis_str)
        lvl = doc.elements.get(e.reference_level_id)
        eave_mm = float(lvl.elevation_mm) if isinstance(lvl, LevelElem) else 0.0
        ridge_z = eave_mm + rise_mm
        seg_a, seg_b = gable_ridge_segment_plan_mm(x0_mm, x1_mm, z0_mm, z1_mm, axis_plan)
        row["roofTopologyToken"] = "gable"
        row["ridgeAxisPlan"] = axis_str
        row["ridgeSegmentPlanMm"] = [
            [round(seg_a[0], 3), round(seg_a[1], 3)],
            [round(seg_b[0], 3), round(seg_b[1], 3)],
        ]
        row["ridgeRiseMm"] = round(rise_mm, 3)
        row["ridgeZMm"] = round(ridge_z, 3)
        row["eavePlateZMm"] = round(eave_mm, 3)
    else:
        row["roofTopologyToken"] = "skipped_invalid_gable_footprint"

    row.update(roof_surface_material_readout_v0(doc, e))
    if row.get("roofTopologyToken") == "gable" and "ridgeAxisPlan" in row:
        row["roofFasciaEdgePlanToken"] = gable_rectangle_fascia_edge_plan_token_v0(
            cast(RidgeAxisPlan, row["ridgeAxisPlan"]),
        )
    row.update(roof_layered_prism_payload_for_merge_v1(doc, e))
    return row


def roof_geometry_unsupported_shape_summary_v0(doc: Document) -> dict[str, Any] | None:
    """Rollup of roof instances whose support token is neither gable-supported nor mass-box rectangle."""

    counts: dict[str, int] = {}
    deferred_n = 0
    for eid in sorted(doc.elements.keys()):
        el = doc.elements[eid]
        if not isinstance(el, RoofElem):
            continue
        pts = [(float(p.x_mm), float(p.y_mm)) for p in el.footprint_mm]
        if len(pts) < 3:
            continue
        lvl_ok = isinstance(doc.elements.get(el.reference_level_id), LevelElem)
        tok = roof_geometry_support_token_v0(
            footprint_mm=pts,
            roof_geometry_mode=el.roof_geometry_mode,
            reference_level_resolves=lvl_ok,
            slope_deg=el.slope_deg,
        )
        if tok in (None, "gable_pitched_rectangle_supported"):
            continue
        counts[tok] = counts.get(tok, 0) + 1
        deferred_n += 1
    if deferred_n == 0:
        return None
    return {
        "format": "roofGeometryUnsupportedShapeSummary_v0",
        "countsBySupportToken": dict(sorted(counts.items())),
        "deferredInstanceCount": deferred_n,
    }


def roof_geometry_manifest_evidence_v1(doc: Document) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        el = doc.elements[eid]
        if not isinstance(el, RoofElem):
            continue
        row = _roof_geometry_evidence_v1_row(doc, el)
        if row is not None:
            rows.append(row)
    if not rows:
        return None
    return {"format": "roofGeometryEvidence_v1", "roofs": rows}


def stair_geometry_manifest_evidence_v0(doc: Document) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, StairElem):
            continue
        bl = doc.elements.get(e.base_level_id)
        tl = doc.elements.get(e.top_level_id)
        if not isinstance(bl, LevelElem) or not isinstance(tl, LevelElem):
            continue
        z_lo = float(min(bl.elevation_mm, tl.elevation_mm))
        z_hi = float(max(bl.elevation_mm, tl.elevation_mm))
        rise_story = z_hi - z_lo
        if rise_story <= 1e-3:
            continue
        rx0, ry0 = float(e.run_start.x_mm), float(e.run_start.y_mm)
        rx1, ry1 = float(e.run_end.x_mm), float(e.run_end.y_mm)
        run_len = math.hypot(rx1 - rx0, ry1 - ry0)
        rc_proxy = stair_riser_count_plan_proxy(doc, e, run_length_mm=run_len)
        tc_proxy = stair_tread_count_straight_plan_proxy(rc_proxy)
        bearing = stair_run_bearing_deg_ccw_from_plan_x(rx0, ry0, rx1, ry1)
        ud_lab = stair_plan_up_down_label(float(bl.elevation_mm), float(tl.elevation_mm))
        row_ev: dict[str, Any] = {
            "elementId": eid,
            "baseLevelId": e.base_level_id,
            "topLevelId": e.top_level_id,
            "baseLevelName": bl.name,
            "topLevelName": tl.name,
            "storyRiseMm": round(rise_story, 3),
            "totalRiseMm": round(rise_story, 3),
            "midRunElevationMm": round(z_lo + rise_story * 0.5, 3),
            "riserCountPlanProxy": rc_proxy,
            "treadCountPlanProxy": tc_proxy,
            "runBearingDegCcFromPlanX": bearing,
            "planUpDownLabel": ud_lab,
        }
        ph = stair_documentation_placeholders_v0(
            e,
            run_length_mm=run_len,
            plan_up_down_label=ud_lab,
            riser_count_plan_proxy=rc_proxy,
            tread_count_plan_proxy=tc_proxy,
        )
        if ph is not None:
            row_ev["stairDocumentationPlaceholders_v0"] = ph
            row_ev["stairPlanSectionDocumentationLabel"] = ph["stairPlanSectionDocumentationLabel"]
        diags = stair_documentation_diagnostics(
            doc,
            e,
            riser_count_plan_proxy=rc_proxy,
            run_length_mm=run_len,
        )
        if diags:
            row_ev["stairDocumentationDiagnostics"] = diags
        row_ev.update(stair_schedule_row_extensions_v1(doc, e))
        rows.append(row_ev)
    if not rows:
        return None
    return {"format": "stairGeometryEvidence_v0", "stairs": rows}


def site_context_manifest_evidence_v0(doc: Document) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    for eid in sorted(doc.elements.keys()):
        e = doc.elements[eid]
        if not isinstance(e, SiteElem):
            continue
        row: dict[str, Any] = {
            "elementId": eid,
            "vertexCount": len(e.boundary_mm),
            "contextObjectCount": len(e.context_objects),
            "padThicknessMm": round(float(e.pad_thickness_mm), 6),
            "baseOffsetMm": round(float(e.base_offset_mm), 6),
        }
        if e.north_deg_cw_from_plan_x is not None:
            row["northDegCwFromPlanX"] = round(float(e.north_deg_cw_from_plan_x), 6)
        if e.uniform_setback_mm is not None:
            row["uniformSetbackMm"] = round(float(e.uniform_setback_mm), 6)
        rows.append(row)
    if not rows:
        return None
    return {"format": "siteContextEvidence_v0", "sites": rows}


def collect_saved_3d_view_clip_evidence_v1(doc: Document) -> dict[str, Any] | None:
    """Deterministic section box / clip evidence for all saved orbit_3d viewpoints (WP-E02/WP-X02)."""
    views = [
        e for e in doc.elements.values() if isinstance(e, ViewpointElem) and e.mode == "orbit_3d"
    ]
    if not views:
        return None
    rows: list[dict[str, Any]] = []
    for vp in sorted(views, key=lambda x: x.id):
        row: dict[str, Any] = {
            "viewId": vp.id,
            "viewName": vp.name,
            "clipEnabled": (
                vp.viewer_clip_cap_elev_mm is not None or vp.viewer_clip_floor_elev_mm is not None
            ),
            "viewerClipCapElevMm": vp.viewer_clip_cap_elev_mm,
            "viewerClipFloorElevMm": vp.viewer_clip_floor_elev_mm,
            "cutawayStyle": vp.cutaway_style,
            "hiddenCategoryCount": len(vp.hidden_semantic_kinds_3d or []),
            "sectionBoxEnabled": vp.section_box_enabled,
            "planOverlayEnabled": vp.plan_overlay_enabled,
            "planOverlaySourcePlanViewId": vp.plan_overlay_source_plan_view_id,
            "planOverlayOffsetMm": vp.plan_overlay_offset_mm,
            "planOverlayOpacity": vp.plan_overlay_opacity,
            "planOverlayLineOpacity": vp.plan_overlay_line_opacity,
            "planOverlayFillOpacity": vp.plan_overlay_fill_opacity,
            "planOverlayAnnotationsVisible": vp.plan_overlay_annotations_visible,
            "planOverlayWitnessLinesVisible": vp.plan_overlay_witness_lines_visible,
        }
        if vp.section_box_min_mm is not None:
            row["sectionBoxMinMm"] = {
                "xMm": vp.section_box_min_mm.x_mm,
                "yMm": vp.section_box_min_mm.y_mm,
                "zMm": vp.section_box_min_mm.z_mm,
            }
        if vp.section_box_max_mm is not None:
            row["sectionBoxMaxMm"] = {
                "xMm": vp.section_box_max_mm.x_mm,
                "yMm": vp.section_box_max_mm.y_mm,
                "zMm": vp.section_box_max_mm.z_mm,
            }
        rows.append(row)
    return {
        "format": "saved3dViewClipEvidence_v1",
        "viewCount": len(rows),
        "views": rows,
    }


def export_manifest_extension_payload(doc: Document) -> dict[str, Any]:
    parity = exchange_parity_manifest_fields_from_document(doc)
    cut_warns = collect_hosted_cut_manifest_warnings(doc)
    skew_hosted = collect_skew_wall_hosted_opening_evidence_v0(doc)
    rgeom_roofs = roof_geometry_manifest_evidence_v1(doc)
    stair_geom = stair_geometry_manifest_evidence_v0(doc)
    site_ctx = site_context_manifest_evidence_v0(doc)
    corner_joins = collect_wall_corner_join_evidence_v0(doc)
    corner_join_summary = collect_wall_corner_join_summary_v1(doc)
    wall_opening_cut_fidelity = collect_wall_opening_cut_fidelity_evidence_v1(doc)
    layer_cut_align = collect_layered_assembly_cut_alignment_evidence_v0(doc)
    layer_asm_witness = collect_layered_assembly_witness_v0(doc)
    roof_unsup_summary = roof_geometry_unsupported_shape_summary_v0(doc)
    saved_3d_clip = collect_saved_3d_view_clip_evidence_v1(doc)
    mesh_enc = "bim_ai_box_primitive_v0"
    if _document_has_gable_roof_mesh(doc):
        mesh_enc += "+bim_ai_gable_roof_v0"
    if rgeom_roofs:
        mesh_enc += "+bim_ai_roof_geometry_evidence_v1"
    if corner_joins:
        mesh_enc += "+bim_ai_wall_corner_joins_v0"
    if corner_join_summary:
        mesh_enc += "+bim_ai_wall_corner_join_summary_v1"
    if skew_hosted:
        mesh_enc += "+bim_ai_skew_wall_hosted_openings_v0"
    if wall_opening_cut_fidelity:
        mesh_enc += "+bim_ai_wall_opening_cut_fidelity_v1"
    if layer_cut_align:
        mesh_enc += "+bim_ai_layered_assembly_cut_alignment_v0"
    if layer_asm_witness:
        mesh_enc += "+bim_ai_layered_assembly_witness_v0"
    if site_ctx:
        mesh_enc += "+bim_ai_site_context_v0"
    if roof_unsup_summary:
        mesh_enc += "+bim_ai_roof_unsupported_shape_summary_v0"
    if document_has_roof_layered_prism_witness_v1(doc):
        mesh_enc += "+bim_ai_roof_layered_prism_witness_v1"
    if saved_3d_clip:
        mesh_enc += "+bim_ai_saved_3d_view_clip_v1"
    base: dict[str, Any] = {
        **parity,
        "meshEncoding": mesh_enc,
        "hint": "Meshes: GET /api/models/{id}/exports/model.gltf",
    }
    if cut_warns:
        base["hostedCutApproximationWarnings"] = cut_warns
    if skew_hosted:
        base["skewWallHostedOpeningEvidence_v0"] = skew_hosted
    if wall_opening_cut_fidelity:
        base["wallOpeningCutFidelityEvidence_v1"] = wall_opening_cut_fidelity
    asm_ev = material_assembly_manifest_evidence(doc)
    if asm_ev:
        base["materialAssemblyEvidence_v0"] = asm_ev
    cat_ev = material_catalog_audit_evidence_v0(doc)
    if cat_ev:
        base["materialCatalogAuditEvidence_v0"] = cat_ev
    if rgeom_roofs:
        base["roofGeometryEvidence_v1"] = rgeom_roofs
    if stair_geom:
        base["stairGeometryEvidence_v0"] = stair_geom
    if corner_joins:
        base["wallCornerJoinEvidence_v0"] = corner_joins
    if corner_join_summary:
        base["wallCornerJoinSummary_v1"] = corner_join_summary
    if layer_cut_align:
        base["layeredAssemblyCutAlignmentEvidence_v0"] = layer_cut_align
    if layer_asm_witness:
        base["layeredAssemblyWitness_v0"] = layer_asm_witness
    if site_ctx:
        base["siteContextEvidence_v0"] = site_ctx
    if roof_unsup_summary:
        base["roofGeometryUnsupportedShapeSummary_v0"] = roof_unsup_summary
    if saved_3d_clip:
        base["saved3dViewClipEvidence_v1"] = saved_3d_clip
    base["gltfExportManifestClosure_v1"] = build_gltf_export_manifest_closure_v1(mesh_enc, base)
    return base


def build_visual_export_manifest(doc: Document) -> dict[str, Any]:
    ext_payload = export_manifest_extension_payload(doc)
    return {
        "asset": {"version": "2.0", "generator": "bim-ai/export_manifest_v1"},
        "extensionsUsed": ["BIM_AI_exportManifest_v0"],
        "extensions": {"BIM_AI_exportManifest_v0": ext_payload},
        "scenes": [{"nodes": []}],
        "scene": 0,
        "nodes": [],
        "meshes": [],
    }


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _elev_m(doc: Document, level_id: str) -> float:
    el = doc.elements.get(level_id)
    return el.elevation_mm / 1000.0 if isinstance(el, LevelElem) else 0.0


def _hosted_xz_m(hosted: DoorElem | WindowElem, wall: WallElem) -> tuple[float, float]:
    sx = wall.start.x_mm / 1000.0
    sz = wall.start.y_mm / 1000.0
    dx = wall.end.x_mm / 1000.0 - sx
    dz = wall.end.y_mm / 1000.0 - sz
    length = max(1e-6, math.hypot(dx, dz))
    ux = dx / length
    uz = dz / length
    return sx + ux * hosted.along_t * length, sz + uz * hosted.along_t * length


def _wall_yaw(wall: WallElem) -> float:
    sx = wall.start.x_mm / 1000.0
    sz = wall.start.y_mm / 1000.0
    return math.atan2(wall.end.y_mm / 1000.0 - sz, wall.end.x_mm / 1000.0 - sx)


def _quat_yaw_y_rad(yaw: float) -> list[float]:
    """Unit quaternion [qx,qy,qz,qw] for RHS rotation yaw about +Y."""
    half = yaw * 0.5
    return [0.0, math.sin(half), 0.0, math.cos(half)]


def _emit_tri(
    buf: bytearray,
    v0: tuple[float, float, float],
    v1: tuple[float, float, float],
    v2: tuple[float, float, float],
    n: tuple[float, float, float],
) -> None:
    for p in (v0, v1, v2):
        buf.extend(struct.pack("<ffffff", p[0], p[1], p[2], n[0], n[1], n[2]))


def _box_interleaved_bytes(hx: float, hy: float, hz: float) -> tuple[bytes, int]:
    """36 vertices × 6 floats — axis-aligned [-hx,+hx]×[-hy,+hy]×[-hz,+hz]; 36 unique verts (indexed)."""
    x, y, z = hx, hy, hz
    buf = bytearray()
    nz_p = (0.0, 0.0, 1.0)
    _emit_tri(buf, (-x, -y, z), (x, -y, z), (x, y, z), nz_p)
    _emit_tri(buf, (-x, -y, z), (x, y, z), (-x, y, z), nz_p)

    nz_m = (0.0, 0.0, -1.0)
    _emit_tri(buf, (x, -y, -z), (-x, -y, -z), (-x, y, -z), nz_m)
    _emit_tri(buf, (x, -y, -z), (-x, y, -z), (x, y, -z), nz_m)

    nx_p = (1.0, 0.0, 0.0)
    _emit_tri(buf, (x, -y, -z), (x, -y, z), (x, y, z), nx_p)
    _emit_tri(buf, (x, -y, -z), (x, y, z), (x, y, -z), nx_p)

    nx_m = (-1.0, 0.0, 0.0)
    _emit_tri(buf, (-x, -y, z), (-x, -y, -z), (-x, y, -z), nx_m)
    _emit_tri(buf, (-x, -y, z), (-x, y, -z), (-x, y, z), nx_m)

    ny_p = (0.0, 1.0, 0.0)
    _emit_tri(buf, (-x, y, -z), (-x, y, z), (x, y, z), ny_p)
    _emit_tri(buf, (-x, y, -z), (x, y, z), (x, y, -z), ny_p)

    ny_m = (0.0, -1.0, 0.0)
    _emit_tri(buf, (-x, -y, z), (-x, -y, -z), (x, -y, -z), ny_m)
    _emit_tri(buf, (-x, -y, z), (x, -y, -z), (x, -y, z), ny_m)

    vcount = len(buf) // VERT_BYTES
    return bytes(buf), vcount


@dataclass(frozen=True, slots=True)
class _GeomBox:
    kind: str
    elem_id: str
    translation: tuple[float, float, float]
    yaw: float
    hx: float
    hy: float
    hz: float


@dataclass(frozen=True, slots=True)
class _GableRoofVisual:
    elem_id: str
    xmin_m: float
    xmax_m: float
    zmin_m: float
    zmax_m: float
    y_eave_m: float
    y_ridge_m: float
    ridge_axis: str


@dataclass(frozen=True, slots=True)
class _SitePadVisual:
    elem_id: str
    interleaved: bytes
    vertex_count: int
    translation_m: tuple[float, float, float]
    yaw_rad: float


def _triangle_unit_normal(
    v0: tuple[float, float, float],
    v1: tuple[float, float, float],
    v2: tuple[float, float, float],
) -> tuple[float, float, float]:
    ax = v1[0] - v0[0]
    ay = v1[1] - v0[1]
    az = v1[2] - v0[2]
    bx = v2[0] - v0[0]
    by = v2[1] - v0[1]
    bz = v2[2] - v0[2]
    nx = ay * bz - az * by
    ny = az * bx - ax * bz
    nz = ax * by - ay * bx
    L = math.hypot(nx, ny, nz)
    if L < 1e-12:
        return (0.0, 1.0, 0.0)
    return nx / L, ny / L, nz / L


def _gable_roof_interleaved_world_m(gr: _GableRoofVisual) -> tuple[bytes, int]:
    buf = bytearray()
    xmin, xmax = gr.xmin_m, gr.xmax_m
    zmin, zmax = gr.zmin_m, gr.zmax_m
    ye, yr = gr.y_eave_m, gr.y_ridge_m
    xc = 0.5 * (xmin + xmax)
    zc = 0.5 * (zmin + zmax)
    if max(xmax - xmin, zmax - zmin) < 1e-9:
        return bytes(buf), 0
    if gr.ridge_axis == "alongX":
        a0 = (xmin, ye, zmax)
        a1 = (xmax, ye, zmax)
        a2 = (xmax, yr, zc)
        a3 = (xmin, yr, zc)
        _emit_tri(buf, a0, a1, a2, _triangle_unit_normal(a0, a1, a2))
        _emit_tri(buf, a0, a2, a3, _triangle_unit_normal(a0, a2, a3))
        b0 = (xmax, ye, zmin)
        b1 = (xmin, ye, zmin)
        b2 = (xmin, yr, zc)
        b3 = (xmax, yr, zc)
        _emit_tri(buf, b0, b1, b2, _triangle_unit_normal(b0, b1, b2))
        _emit_tri(buf, b0, b2, b3, _triangle_unit_normal(b0, b2, b3))
        c0 = (xmin, ye, zmax)
        c1 = (xmax, ye, zmax)
        c2 = (xc, yr, zc)
        _emit_tri(buf, c0, c1, c2, _triangle_unit_normal(c0, c1, c2))
        d0 = (xmax, ye, zmin)
        d1 = (xmin, ye, zmin)
        d2 = (xc, yr, zc)
        _emit_tri(buf, d0, d1, d2, _triangle_unit_normal(d0, d1, d2))
    else:
        p0 = (xmax, ye, zmax)
        p1 = (xmax, ye, zmin)
        p2 = (xc, yr, zmin)
        p3 = (xc, yr, zmax)
        _emit_tri(buf, p0, p1, p2, _triangle_unit_normal(p0, p1, p2))
        _emit_tri(buf, p0, p2, p3, _triangle_unit_normal(p0, p2, p3))
        q0 = (xmin, ye, zmin)
        q1 = (xmin, ye, zmax)
        q2 = (xc, yr, zmax)
        q3 = (xc, yr, zmin)
        _emit_tri(buf, q0, q1, q2, _triangle_unit_normal(q0, q1, q2))
        _emit_tri(buf, q0, q2, q3, _triangle_unit_normal(q0, q2, q3))
        r0 = (xmax, ye, zmax)
        r1 = (xmax, ye, zmin)
        r2 = (xc, yr, zc)
        _emit_tri(buf, r0, r1, r2, _triangle_unit_normal(r0, r1, r2))
        s0 = (xmin, ye, zmin)
        s1 = (xmin, ye, zmax)
        s2 = (xc, yr, zc)
        _emit_tri(buf, s0, s1, s2, _triangle_unit_normal(s0, s1, s2))
    vcount = len(buf) // VERT_BYTES
    return bytes(buf), vcount


def _site_extruded_pad_interleaved_m(
    local_xz_m: list[tuple[float, float]],
    thickness_m: float,
) -> tuple[bytes, int]:
    """Extruded convex polygon in xz (local); bottom y=0, top y=thickness_m."""

    buf = bytearray()
    n = len(local_xz_m)
    if n < 3 or thickness_m <= 1e-12:
        return bytes(buf), 0
    y0 = 0.0
    y1 = thickness_m
    for i in range(1, n - 1):
        x0, z0 = local_xz_m[0]
        x1, z1 = local_xz_m[i]
        x2, z2 = local_xz_m[i + 1]
        p0 = (x0, y1, z0)
        p1 = (x1, y1, z1)
        p2 = (x2, y1, z2)
        _emit_tri(buf, p0, p1, p2, _triangle_unit_normal(p0, p1, p2))
    for i in range(1, n - 1):
        x0, z0 = local_xz_m[0]
        x1, z1 = local_xz_m[i]
        x2, z2 = local_xz_m[i + 1]
        b0 = (x0, y0, z0)
        b1 = (x1, y0, z1)
        b2 = (x2, y0, z2)
        _emit_tri(buf, b0, b2, b1, _triangle_unit_normal(b0, b2, b1))
    for i in range(n):
        x0, z0 = local_xz_m[i]
        x1, z1 = local_xz_m[(i + 1) % n]
        dx, dz = x1 - x0, z1 - z0
        nx_h = -dz
        nz_h = dx
        ln = math.hypot(nx_h, nz_h)
        if ln < 1e-12:
            continue
        nx_h /= ln
        nz_h /= ln
        p00 = (x0, y0, z0)
        p01 = (x0, y1, z0)
        p10 = (x1, y0, z1)
        p11 = (x1, y1, z1)
        _emit_tri(buf, p00, p10, p11, (nx_h, 0.0, nz_h))
        _emit_tri(buf, p00, p11, p01, (nx_h, 0.0, nz_h))
    return bytes(buf), len(buf) // VERT_BYTES


def _collect_gable_roof_visual_slices(doc: Document) -> list[_GableRoofVisual]:
    out: list[_GableRoofVisual] = []
    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        pts = [(float(p.x_mm), float(p.y_mm)) for p in rf.footprint_mm]
        if not gable_pitched_rectangle_elevation_supported_v0(
            footprint_mm=pts,
            roof_geometry_mode=rf.roof_geometry_mode,
            reference_level_resolves=isinstance(doc.elements.get(rf.reference_level_id), LevelElem),
            slope_deg=rf.slope_deg,
        ):
            continue
        x0_mm, x1_mm, z0_mm, z1_mm = outer_rect_extent(pts)
        rise_mm, axis = gable_ridge_rise_mm(
            float(x1_mm - x0_mm), float(z1_mm - z0_mm), float(rf.slope_deg or 25.0)
        )
        ye = _elev_m(doc, rf.reference_level_id)
        yr = ye + rise_mm / 1000.0
        out.append(
            _GableRoofVisual(
                elem_id=rid,
                xmin_m=x0_mm / 1000.0,
                xmax_m=x1_mm / 1000.0,
                zmin_m=z0_mm / 1000.0,
                zmax_m=z1_mm / 1000.0,
                y_eave_m=ye,
                y_ridge_m=yr,
                ridge_axis=axis,
            )
        )
    return out


def _collect_site_pad_visuals(doc: Document) -> list[_SitePadVisual]:
    out: list[_SitePadVisual] = []
    for sid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, SiteElem)):
        site = doc.elements[sid]
        assert isinstance(site, SiteElem)
        pts = [(float(p.x_mm), float(p.y_mm)) for p in site.boundary_mm]
        nv = len(pts)
        if nv < 3:
            continue
        cx_mm = sum(px for px, _ in pts) / nv
        cz_mm = sum(pz for _, pz in pts) / nv
        cx_m = cx_mm / 1000.0
        cz_m = cz_mm / 1000.0
        local_m = [(px / 1000.0 - cx_m, pz / 1000.0 - cz_m) for px, pz in pts]
        th_m = float(site.pad_thickness_mm) / 1000.0
        interleaved, vcount = _site_extruded_pad_interleaved_m(local_m, th_m)
        if vcount <= 0:
            continue
        lvl = doc.elements.get(site.reference_level_id)
        elev = lvl.elevation_mm / 1000.0 if isinstance(lvl, LevelElem) else 0.0
        elev_bottom = elev + float(site.base_offset_mm) / 1000.0
        nd = site.north_deg_cw_from_plan_x
        yaw_rad = math.radians(-float(nd)) if nd is not None else 0.0
        out.append(
            _SitePadVisual(
                elem_id=sid,
                interleaved=interleaved,
                vertex_count=vcount,
                translation_m=(cx_m, elev_bottom, cz_m),
                yaw_rad=yaw_rad,
            )
        )
    return out


def _interleaved_position_min_max(
    interleaved: bytes, vcount: int
) -> tuple[list[float], list[float]]:
    mn = [math.inf, math.inf, math.inf]
    mx = [-math.inf, -math.inf, -math.inf]
    for i in range(vcount):
        off = VERT_BYTES * i
        px, py, pz = struct.unpack_from("<fff", interleaved, off)
        mn[0] = min(mn[0], px)
        mn[1] = min(mn[1], py)
        mn[2] = min(mn[2], pz)
        mx[0] = max(mx[0], px)
        mx[1] = max(mx[1], py)
        mx[2] = max(mx[2], pz)
    return mn, mx


def _interleaved_bounds_world_y_trs(
    interleaved: bytes,
    vcount: int,
    trans: tuple[float, float, float],
    yaw: float,
) -> tuple[list[float], list[float]]:
    """Expand interleaved local POSITION normals into world AABB after yaw-Y + translation."""

    cy, sy = math.cos(yaw), math.sin(yaw)
    tx, ty, tz = trans
    mn = [math.inf, math.inf, math.inf]
    mx = [-math.inf, -math.inf, -math.inf]
    for i in range(vcount):
        off = VERT_BYTES * i
        lx, ly, lz = struct.unpack_from("<fff", interleaved, off)
        rx = lx * cy + lz * sy
        rz = -lx * sy + lz * cy
        px = rx + tx
        py = ly + ty
        pz = rz + tz
        mn[0] = min(mn[0], px)
        mn[1] = min(mn[1], py)
        mn[2] = min(mn[2], pz)
        mx[0] = max(mx[0], px)
        mx[1] = max(mx[1], py)
        mx[2] = max(mx[2], pz)
    return mn, mx


def _visual_geom_entry_sort_key(
    pair: tuple[Literal["box", "gable", "site_pad"], Any],
) -> tuple[str, str]:
    tag, payload = pair
    if tag == "box":
        gb = cast(_GeomBox, payload)
        return (gb.kind, gb.elem_id)
    if tag == "site_pad":
        sp = cast(_SitePadVisual, payload)
        return ("site", sp.elem_id)
    gv = cast(_GableRoofVisual, payload)
    return ("roof", gv.elem_id)


def _collect_visual_geom_entries(
    doc: Document,
) -> list[tuple[Literal["box", "gable", "site_pad"], Any]]:
    entries: list[tuple[Literal["box", "gable", "site_pad"], Any]] = [
        ("box", b) for b in _collect_geom_boxes(doc)
    ]
    for gv in _collect_gable_roof_visual_slices(doc):
        entries.append(("gable", gv))
    for sp in _collect_site_pad_visuals(doc):
        entries.append(("site_pad", sp))
    entries.sort(key=_visual_geom_entry_sort_key)
    return entries


def _collect_geom_boxes(doc: Document) -> list[_GeomBox]:
    boxes: list[_GeomBox] = []

    for cb in collect_wall_floor_slab_cut_boxes(doc):
        boxes.append(
            _GeomBox(cb.kind, cb.elem_id, cb.translation, cb.yaw, cb.hx, cb.hy, cb.hz),
        )

    for rid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoofElem)):
        rf = doc.elements[rid]
        assert isinstance(rf, RoofElem)
        pts = [(float(p.x_mm), float(p.y_mm)) for p in rf.footprint_mm]
        if gable_pitched_rectangle_elevation_supported_v0(
            footprint_mm=pts,
            roof_geometry_mode=rf.roof_geometry_mode,
            reference_level_resolves=isinstance(doc.elements.get(rf.reference_level_id), LevelElem),
            slope_deg=rf.slope_deg,
        ):
            continue
        if len(pts) < 3:
            continue
        cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts)
        ov = _clamp(float(rf.overhang_mm or 0) / 1000.0, 0.0, 5.0)
        elev = _elev_m(doc, rf.reference_level_id)
        rise = _clamp(float(rf.slope_deg or 25) / 70.0, 0.25, 2.8)
        sx_m = max(span_x / 1000.0 + ov * 0.08, 3.0)
        sz_m = max(span_z / 1000.0 + ov * 0.08, 3.0)
        tx = cx_mm / 1000.0
        tz = cz_mm / 1000.0
        ty = elev + ov * 0.12 + rise / 2.0
        boxes.append(_GeomBox("roof", rid, (tx, ty, tz), 0.0, sx_m / 2.0, rise / 2.0, sz_m / 2.0))

    for sid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, StairElem)):
        st = doc.elements[sid]
        assert isinstance(st, StairElem)
        sx = st.run_start.x_mm / 1000.0
        sz = st.run_start.y_mm / 1000.0
        dx = st.run_end.x_mm / 1000.0 - sx
        dz = st.run_end.y_mm / 1000.0 - sz
        length = max(1e-3, math.hypot(dx, dz))
        width = _clamp(st.width_mm / 1000.0, 0.3, 4.0)
        bl = doc.elements.get(st.base_level_id)
        tl = doc.elements.get(st.top_level_id)
        rise_mm = (
            abs(tl.elevation_mm - bl.elevation_mm)
            if isinstance(bl, LevelElem) and isinstance(tl, LevelElem)
            else float(st.riser_mm) * 16.0
        )
        rise = _clamp(rise_mm / 1000.0, 0.5, 12.0)
        elev_base = _elev_m(doc, st.base_level_id)
        yaw_stair = math.atan2(dx, dz)
        boxes.append(
            _GeomBox(
                "stair",
                sid,
                (sx + dx * 0.5, elev_base + rise / 2.0, sz + dz * 0.5),
                yaw_stair,
                length / 2.0,
                rise / 2.0,
                width / 2.0,
            )
        )

    for did in sorted(eid for eid, e in doc.elements.items() if isinstance(e, DoorElem)):
        d = doc.elements[did]
        assert isinstance(d, DoorElem)
        wall = doc.elements.get(d.wall_id)
        if not isinstance(wall, WallElem):
            continue
        px, pz = _hosted_xz_m(d, wall)
        elev = _elev_m(doc, wall.level_id)
        height = _clamp((wall.height_mm / 1000.0) * 0.86, 0.6, 2.2)
        width_d = _clamp(d.width_mm / 1000.0, 0.35, 4.0)
        depth = _clamp(wall.thickness_mm / 1000.0 + 0.08, 0.08, 2.0)
        yaw = _wall_yaw(wall)
        hy = height / 2.0
        boxes.append(
            _GeomBox("door", did, (px, elev + hy, pz), yaw, width_d / 2.0, hy, depth / 2.0)
        )

    for zid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, WindowElem)):
        win = doc.elements[zid]
        assert isinstance(win, WindowElem)
        wall = doc.elements.get(win.wall_id)
        if not isinstance(wall, WallElem):
            continue
        px, pz = _hosted_xz_m(win, wall)
        elev = _elev_m(doc, wall.level_id)
        sill = _clamp(win.sill_height_mm / 1000.0, 0.06, wall.height_mm / 1000.0 - 0.08)
        h_win = _clamp(
            win.height_mm / 1000.0,
            0.05,
            wall.height_mm / 1000.0 - sill - 0.06,
        )
        width_w = _clamp(win.width_mm / 1000.0, 0.14, 4.0)
        depth = _clamp(wall.thickness_mm / 1000.0 + 0.02, 0.06, 1.5)
        yaw = _wall_yaw(wall)
        boxes.append(
            _GeomBox(
                "window",
                zid,
                (px, elev + sill + h_win / 2.0, pz),
                yaw,
                width_w / 2.0,
                h_win / 2.0,
                depth / 2.0,
            )
        )

    for rm_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, RoomElem)):
        rm = doc.elements[rm_id]
        assert isinstance(rm, RoomElem)
        pts = [(p.x_mm, p.y_mm) for p in rm.outline_mm]
        if len(pts) < 3:
            continue
        cx_mm, cz_mm, span_x, span_z = xz_bounds_mm_from_poly(pts)
        elev = _elev_m(doc, rm.level_id)
        slab_half = 0.035  # ±0.035 m ≈ viewport ribbon slab
        ty = elev + slab_half + 1e-6
        hx = (span_x / 1000.0) / 2.0
        hz = (span_z / 1000.0) / 2.0
        boxes.append(
            _GeomBox("room", rm_id, (cx_mm / 1000.0, ty, cz_mm / 1000.0), 0.0, hx, slab_half, hz)
        )

    for site_id in sorted(eid for eid, e in doc.elements.items() if isinstance(e, SiteElem)):
        site = doc.elements[site_id]
        assert isinstance(site, SiteElem)
        bpts = [(float(p.x_mm), float(p.y_mm)) for p in site.boundary_mm]
        nv = len(bpts)
        if nv < 3:
            continue
        cx_mm = sum(px for px, _ in bpts) / nv
        cz_mm = sum(pz for _, pz in bpts) / nv
        cx_m = cx_mm / 1000.0
        cz_m = cz_mm / 1000.0
        nd = site.north_deg_cw_from_plan_x
        yaw = math.radians(-float(nd)) if nd is not None else 0.0
        c = math.cos(yaw)
        s = math.sin(yaw)
        lvl = doc.elements.get(site.reference_level_id)
        elev = lvl.elevation_mm / 1000.0 if isinstance(lvl, LevelElem) else 0.0
        elev_bottom = elev + float(site.base_offset_mm) / 1000.0
        th_m = float(site.pad_thickness_mm) / 1000.0
        marker_y = elev_bottom + th_m * 0.5 + 0.06
        for row in site.context_objects:
            px_m = row.position_mm.x_mm / 1000.0
            pz_m = row.position_mm.y_mm / 1000.0
            lx = px_m - cx_m
            lz = pz_m - cz_m
            wx = cx_m + lx * c + lz * s
            wz = cz_m + (-lx * s + lz * c)
            wy = marker_y
            sc = _clamp(float(row.scale), 0.2, 3.0)
            hx = hz = 0.12 * sc
            hy = 0.35 * sc
            boxes.append(
                _GeomBox(
                    "site",
                    f"{site_id}:ctx:{row.id}",
                    (wx, wy, wz),
                    0.0,
                    hx,
                    hy,
                    hz,
                )
            )

    return boxes


def bounds_position_world_aabb_geom_box(gb: _GeomBox) -> tuple[list[float], list[float]]:
    """World-space axis-aligned bounds for a yaw-Y box primitive at gb.translation."""

    yaw = gb.yaw
    c_y, s_y = math.cos(yaw), math.sin(yaw)
    mn = [math.inf, math.inf, math.inf]
    mx = [-math.inf, -math.inf, -math.inf]
    for lx in (-gb.hx, gb.hx):
        for ly in (-gb.hy, gb.hy):
            for lz in (-gb.hz, gb.hz):
                rx = lx * c_y + lz * s_y
                ry = ly
                rz = -lx * s_y + lz * c_y
                px = rx + gb.translation[0]
                py = ry + gb.translation[1]
                pz = rz + gb.translation[2]
                mn[0] = min(mn[0], px)
                mn[1] = min(mn[1], py)
                mn[2] = min(mn[2], pz)
                mx[0] = max(mx[0], px)
                mx[1] = max(mx[1], py)
                mx[2] = max(mx[2], pz)
    return mn, mx


_KIND_MAT_IDX = {
    "wall": 0,
    "floor": 1,
    "roof": 2,
    "door": 3,
    "window": 4,
    "room": 5,
    "stair": 6,
    "slab_opening": 7,
    "site": 8,
}

_GLB_MAT_SLOTS: tuple[tuple[str, tuple[float, float, float], float], ...] = (
    ("wall", (203 / 255, 213 / 255, 225 / 255), 0.92),
    ("floor", (34 / 255, 197 / 255, 94 / 255), 0.9),
    ("roof", (251 / 255, 146 / 255, 60 / 255), 0.74),
    ("door", (103 / 255, 232 / 255, 249 / 255), 0.88),
    ("window", (233 / 255, 213 / 255, 255 / 255), 0.9),
    ("room", (96 / 255, 165 / 255, 250 / 255), 0.85),
    ("stair", (202 / 255, 138 / 255, 4 / 255), 0.8),
    ("slab_opening", (236 / 255, 72 / 255, 153 / 255), 0.78),
    ("site", (87 / 255, 149 / 255, 92 / 255), 0.88),
)


def _category_materials_gltf() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for name, rgb, rough in _GLB_MAT_SLOTS:
        r, g, b = rgb
        out.append(
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [r, g, b, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": rough,
                },
            }
        )
    return out


def _document_to_gltf_tree_and_bins(doc: Document) -> tuple[dict[str, Any], bytes]:
    mf_payload = export_manifest_extension_payload(doc)

    meshes: list[dict[str, Any]] = []
    nodes: list[dict[str, Any]] = []
    bins = bytearray()
    buffer_views: list[dict[str, Any]] = []
    accessors: list[dict[str, Any]] = []

    def align4(off: int) -> int:
        pad = (-off) % 4
        return off + pad

    geo_entries = _collect_visual_geom_entries(doc)

    for lid in sorted(eid for eid, e in doc.elements.items() if isinstance(e, LevelElem)):
        lvl = doc.elements[lid]
        assert isinstance(lvl, LevelElem)
        em = lvl.elevation_mm / 1000.0
        nodes.append(
            {
                "name": f"level:{lid}",
                "rotation": _quat_yaw_y_rad(0.0),
                "scale": [1.0, 1.0, 1.0],
                "translation": [0.0, 0.0, 0.0],
                "extras": {
                    "bimAiSemantic": "level",
                    "elevationM": float(em),
                    "elementId": lid,
                    "note": "metadata node (no geometry)",
                },
            }
        )

    for tag, payload in geo_entries:
        geom_kind: str
        elem_id_f: str
        yaw: float
        trans_t: tuple[float, float, float]
        mat_kind: str
        extras: dict[str, Any]
        if tag == "box":
            gb = cast(_GeomBox, payload)
            vbytes, vcount = _box_interleaved_bytes(gb.hx, gb.hy, gb.hz)
            pos_min, pos_max = bounds_position_world_aabb_geom_box(gb)
            geom_kind = gb.kind
            elem_id_f = gb.elem_id
            yaw = gb.yaw
            trans_t = (float(gb.translation[0]), float(gb.translation[1]), float(gb.translation[2]))
            mat_kind = gb.kind
            extras = {"bimAiEncoding": mf_payload["meshEncoding"], "elementId": gb.elem_id}
        elif tag == "site_pad":
            sp = cast(_SitePadVisual, payload)
            vbytes = sp.interleaved
            vcount = sp.vertex_count
            if vcount <= 0:
                continue
            pos_min, pos_max = _interleaved_bounds_world_y_trs(
                vbytes, vcount, sp.translation_m, sp.yaw_rad
            )
            geom_kind = "site"
            elem_id_f = sp.elem_id
            yaw = sp.yaw_rad
            trans_t = (
                float(sp.translation_m[0]),
                float(sp.translation_m[1]),
                float(sp.translation_m[2]),
            )
            mat_kind = "site"
            extras = {
                "bimAiEncoding": mf_payload["meshEncoding"],
                "elementId": sp.elem_id,
                "bimAiSemantic": "site_pad",
            }
        else:
            gv = cast(_GableRoofVisual, payload)
            vbytes, vcount = _gable_roof_interleaved_world_m(gv)
            if vcount <= 0:
                continue
            pos_min, pos_max = _interleaved_position_min_max(vbytes, vcount)
            geom_kind = "roof"
            elem_id_f = gv.elem_id
            yaw = 0.0
            trans_t = (0.0, 0.0, 0.0)
            mat_kind = "roof"
            roof_el = doc.elements.get(gv.elem_id)
            roof_ev = (
                _roof_geometry_evidence_v1_row(doc, roof_el)
                if isinstance(roof_el, RoofElem)
                else None
            )
            extras = {
                "bimAiEncoding": mf_payload["meshEncoding"],
                "elementId": gv.elem_id,
                "bimAiRoofGeometryMode": "gable_pitched_rectangle",
            }
            if roof_ev is not None:
                extras["bimAiRoofGeometryEvidence_v1"] = roof_ev

        vtx_off = len(bins)
        bins.extend(vbytes)

        vtx_bvi = len(buffer_views)
        buffer_views.append(
            {
                "buffer": 0,
                "byteOffset": vtx_off,
                "byteLength": len(vbytes),
                "byteStride": 24,
                "target": 34962,
            }
        )

        acc_pos = len(accessors)
        accessors.append(
            {
                "bufferView": vtx_bvi,
                "byteOffset": 0,
                "componentType": 5126,
                "count": vcount,
                "type": "VEC3",
            }
        )

        accessors.append(
            {
                "bufferView": vtx_bvi,
                "byteOffset": 12,
                "componentType": 5126,
                "count": vcount,
                "type": "VEC3",
            }
        )
        acc_norm = acc_pos + 1

        tri_indices = list(range(vcount))

        accessors[acc_pos].update({"min": pos_min, "max": pos_max})

        idx_off_raw = vtx_off + len(vbytes)
        idx_off = align4(idx_off_raw)
        bins.extend(b"\x00" * (idx_off - idx_off_raw))
        ix_start = idx_off

        ix_bytes_len = len(tri_indices) * 2
        for ix in tri_indices:
            bins.extend(struct.pack("<H", ix))

        idx_bvi = len(buffer_views)

        ix_end_actual = ix_start + ix_bytes_len

        pad_after = (-ix_end_actual) % 4
        bins.extend(b"\x00" * pad_after)

        buffer_views.append(
            {"buffer": 0, "byteOffset": ix_start, "byteLength": ix_bytes_len, "target": 34963},
        )

        ix_acc_idx = len(accessors)
        accessors.append(
            {
                "bufferView": idx_bvi,
                "byteOffset": 0,
                "componentType": 5123,
                "count": len(tri_indices),
                "type": "SCALAR",
            }
        )

        mesh_idx = len(meshes)
        meshes.append(
            {
                "name": f"{geom_kind}:{elem_id_f}",
                "primitives": [
                    {
                        "attributes": {"POSITION": acc_pos, "NORMAL": acc_norm},
                        "indices": ix_acc_idx,
                        "material": _KIND_MAT_IDX[mat_kind],
                    }
                ],
            }
        )

        nodes.append(
            {
                "name": f"{geom_kind}:{elem_id_f}",
                "mesh": mesh_idx,
                "translation": [trans_t[0], trans_t[1], trans_t[2]],
                "rotation": _quat_yaw_y_rad(yaw),
                "scale": [1.0, 1.0, 1.0],
                "extras": extras,
            }
        )

    mats = _category_materials_gltf()

    scene_children = list(range(len(nodes)))

    tree: dict[str, Any] = {
        "asset": {"version": "2.0", "generator": "bim-ai/visual_gltf_v0"},
        "extensionsUsed": ["BIM_AI_exportManifest_v0"],
        "extensions": {"BIM_AI_exportManifest_v0": mf_payload},
        "buffers": [{"byteLength": len(bins)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "materials": mats,
        "meshes": meshes,
        "nodes": nodes,
        "scenes": [{"nodes": scene_children}],
        "scene": 0,
    }
    return tree, bytes(bins)


def document_to_gltf(doc: Document) -> dict[str, Any]:
    tree, bins = _document_to_gltf_tree_and_bins(doc)
    tex_b64 = base64.standard_b64encode(bins).decode("ascii")
    out = dict(tree)
    out["buffers"] = [
        {"byteLength": len(bins), "uri": f"data:application/octet-stream;base64,{tex_b64}"}
    ]
    return out


_GLTF_MAGIC = 0x46546C67
_GLB_JSON_CHUNK_TYPE = 0x4E4F534A
_GLB_BIN_CHUNK_TYPE = 0x004E4942


def encode_glb(gltf_without_uri: dict[str, Any], bin_data: bytes) -> bytes:
    """Pack glTF 2 JSON (first buffer omitted `uri`) + BIN chunk into `.glb` bytes."""

    buf_len = gltf_without_uri.get("buffers", [{}])[0].get("byteLength")
    if buf_len != len(bin_data):
        raise ValueError("gltf buffers[0].byteLength must match embedded BIN chunk size")

    json_bytes = json.dumps(gltf_without_uri, separators=(",", ":")).encode("utf-8")
    json_pad = (-len(json_bytes)) % 4
    json_bytes += b" " * json_pad

    bin_pad = (-len(bin_data)) % 4
    padded_bin = bin_data + (b"\x00" * bin_pad)

    json_chunk_len = len(json_bytes)
    bin_chunk_len = len(padded_bin)
    total = 12 + 8 + json_chunk_len + 8 + bin_chunk_len

    header = struct.pack("<III", _GLTF_MAGIC, 2, total)
    json_hdr = struct.pack("<II", json_chunk_len, _GLB_JSON_CHUNK_TYPE)
    bin_hdr = struct.pack("<II", bin_chunk_len, _GLB_BIN_CHUNK_TYPE)
    return header + json_hdr + json_bytes + bin_hdr + padded_bin


def document_to_glb_bytes(doc: Document) -> bytes:
    tree, bins = _document_to_gltf_tree_and_bins(doc)
    return encode_glb(tree, bins)


def dumps_gltf_json(doc: Document) -> str:
    return json.dumps(document_to_gltf(doc), indent=2)
