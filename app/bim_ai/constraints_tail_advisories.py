from __future__ import annotations

from typing import Any, Literal

from bim_ai.constraints_core import (
    _RULE_BLOCKING_CLASS,
    _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
    _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
    AdvisorBlockingClass,
    Violation,
)
from bim_ai.document import Document
from bim_ai.elements import (
    DormerElem,
    Element,
    RoofElem,
    RoomColorSchemeElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
)
from bim_ai.room_color_scheme_override_evidence import scheme_override_advisory_violations_for_doc
from bim_ai.room_derivation import detect_unbounded_rooms_v1
from bim_ai.section_on_sheet_integration_evidence_v1 import (
    section_cut_line_present,
    section_profile_token_from_primitives,
)
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    normalize_titleblock_revision_issue_v1,
    sheet_revision_issue_metadata_present,
)


def _room_color_scheme_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    scheme_elem: RoomColorSchemeElem | None = None
    for el in elements.values():
        if isinstance(el, RoomColorSchemeElem):
            scheme_elem = el
            break
    has_rooms = any(isinstance(el, RoomElem) for el in elements.values())
    if not has_rooms:
        return []
    raw_findings = scheme_override_advisory_violations_for_doc(scheme_elem)
    out: list[Violation] = []
    for f in raw_findings:
        code = str(f.get("code") or "")
        severity_raw = str(f.get("severity") or "info")
        severity: Literal["error", "warning", "info"] = (
            severity_raw if severity_raw in {"error", "warning", "info"} else "info"
        )
        eids = [scheme_elem.id] if scheme_elem is not None else []
        out.append(
            Violation(
                rule_id=code,
                severity=severity,
                message=str(f.get("message") or code),
                element_ids=eids,
            )
        )
    return out


def _section_on_sheet_advisory_violations(elements: dict[str, Element]) -> list[Violation]:
    """Advisory rules for section/elevation viewports placed on sheets (WP-E03/E05/V01)."""
    out: list[Violation] = []
    sheets = sorted(
        (el for el in elements.values() if isinstance(el, SheetElem)),
        key=lambda s: s.id,
    )
    for sh in sheets:
        tb_norm = normalize_titleblock_revision_issue_v1(sh.titleblock_parameters)
        rev_iss_present = sheet_revision_issue_metadata_present(tb_norm)

        for vp in list(sh.viewports_mm or []):
            if not isinstance(vp, dict):
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            if not isinstance(vr, str) or ":" not in vr:
                continue
            kind_raw, ref_raw = vr.split(":", 1)
            kind = kind_raw.strip().lower()
            if kind not in {"section", "sec"}:
                continue
            sec_id = ref_raw.strip()
            if not sec_id:
                continue
            el = elements.get(sec_id)
            if not isinstance(el, SectionCutElem):
                continue
            vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip() or sec_id

            if not section_cut_line_present(el):
                out.append(
                    Violation(
                        rule_id="section_on_sheet_cut_line_missing",
                        severity="warning",
                        message=(
                            f"Section viewport '{vid}' on sheet '{sh.id}' references section cut "
                            f"'{sec_id}' whose cut line endpoints coincide; no cut-line digest can "
                            "be produced for the section-on-sheet integration evidence."
                        ),
                        element_ids=[sh.id, sec_id],
                    )
                )

            _doc = Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]
            prim, _ = build_section_projection_primitives(_doc, el)
            token = section_profile_token_from_primitives(prim)
            if token == "noGeometry_v1":
                out.append(
                    Violation(
                        rule_id="section_on_sheet_profile_token_missing",
                        severity="info",
                        message=(
                            f"Section viewport '{vid}' on sheet '{sh.id}' references section cut "
                            f"'{sec_id}' with no resolvable profile token (no roof witness, geometry "
                            "extent, or level markers found)."
                        ),
                        element_ids=[sh.id, sec_id],
                    )
                )

            if not rev_iss_present:
                out.append(
                    Violation(
                        rule_id="section_on_sheet_revision_issue_unresolved",
                        severity="info",
                        message=(
                            f"Section viewport '{vid}' on sheet '{sh.id}' references section cut "
                            f"'{sec_id}' but the sheet titleblock revision/issue cross-reference is "
                            "empty (revisionId and revisionCode are both absent)."
                        ),
                        element_ids=[sh.id, sec_id],
                    )
                )
    return out


def advisorBlockingClassSummary_v1(doc: Document) -> dict[str, Any]:
    """Per-class violation counts at each severity for a document."""
    from bim_ai.constraints_evaluation import evaluate

    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    counts: dict[str, dict[str, int]] = {
        cls.value: {"error": 0, "warning": 0, "info": 0} for cls in AdvisorBlockingClass
    }
    for v in viols:
        bc = _RULE_BLOCKING_CLASS.get(v.rule_id, AdvisorBlockingClass.documentation.value)
        sev = v.severity
        if bc in counts and sev in counts[bc]:
            counts[bc][sev] += 1
    return {
        "format": "advisorBlockingClassSummary_v1",
        "perClass": counts,
        "totalViolations": len(viols),
    }


def fix_schedule_sheet_placement(doc: Document) -> dict[str, Any]:
    """Quick-fix: assign unplaced schedules to the first available sheet and add viewports.

    Returns quickFixResult_v1 with {applied, skipped, reason}.
    """
    from bim_ai.engine import try_commit_bundle

    schedules = sorted(
        (e for e in doc.elements.values() if isinstance(e, ScheduleElem)),
        key=lambda s: s.id,
    )
    sheets = sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)),
        key=lambda s: s.id,
    )
    unplaced = [s for s in schedules if not (s.sheet_id or "").strip()]

    if not unplaced:
        return {"applied": False, "skipped": True, "reason": "no_unplaced_schedules"}
    if not sheets:
        return {"applied": False, "skipped": True, "reason": "no_sheets_available"}

    target_sheet = sheets[0]
    new_vps = list(target_sheet.viewports_mm or [])
    for sch in unplaced:
        new_vps.append(
            {
                "viewportId": f"vp-autoplace-schedule-{sch.id}",
                "label": sch.name or "Schedule",
                "viewRef": f"schedule:{sch.id}",
                "xMm": _SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
                "yMm": _SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
                "widthMm": _SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
                "heightMm": _SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
            }
        )

    commands: list[dict[str, Any]] = [
        {
            "type": "upsertSheetViewports",
            "sheetId": target_sheet.id,
            "viewportsMm": new_vps,
        }
    ]
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(doc, commands)
    return {
        "applied": ok,
        "skipped": not ok,
        "reason": f"placed_{len(unplaced)}_on_{target_sheet.id}" if ok else f"commit_failed:{code}",
    }


def fix_sheet_viewport_refresh(doc: Document) -> dict[str, Any]:
    """Quick-fix: update stale schedule viewport rowCounts to match current derivation.

    Returns quickFixResult_v1 with {applied, skipped, reason}.
    """
    from bim_ai.engine import try_commit_bundle
    from bim_ai.schedule_derivation import derive_schedule_table

    stale_count = 0
    commands: list[dict[str, Any]] = []

    for sh_el in sorted(
        (e for e in doc.elements.values() if isinstance(e, SheetElem)), key=lambda s: s.id
    ):
        needs_update = False
        updated_vps: list[Any] = []
        for vp in sh_el.viewports_mm or []:
            if not isinstance(vp, dict):
                updated_vps.append(vp)
                continue
            vr = vp.get("viewRef") or vp.get("view_ref")
            cached_rc = vp.get("rowCount")
            if isinstance(vr, str) and vr.startswith("schedule:") and cached_rc is not None:
                sc_id = vr.split(":", 1)[1].strip()
                try:
                    cached_int = int(cached_rc)
                    tbl = derive_schedule_table(doc, sc_id)
                    derived_rc = int(tbl.get("totalRows") or 0)
                    if derived_rc != cached_int:
                        updated_vps.append({**vp, "rowCount": derived_rc})
                        needs_update = True
                        stale_count += 1
                        continue
                except (ValueError, TypeError, AttributeError):
                    pass
            updated_vps.append(vp)
        if needs_update:
            commands.append(
                {
                    "type": "upsertSheetViewports",
                    "sheetId": sh_el.id,
                    "viewportsMm": updated_vps,
                }
            )

    if not commands:
        return {"applied": False, "skipped": True, "reason": "no_stale_viewports"}

    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(doc, commands)
    return {
        "applied": ok,
        "skipped": not ok,
        "reason": f"refreshed_{stale_count}_viewport(s)" if ok else f"commit_failed:{code}",
    }


def _dormer_overflow_advisory_violations(
    elements: dict[str, Element],
) -> list[Violation]:
    """KRN-14: warn when a dormer footprint vertex falls outside the host
    roof's footprint polygon.

    The engine's createDormer command rejects bbox overflow up-front; this
    rule catches the polygon-precision case where a vertex sits inside the
    host roof's bounding box but outside the actual (non-rectangular)
    footprint polygon.
    """
    out: list[Violation] = []
    for el in elements.values():
        if not isinstance(el, DormerElem):
            continue
        host = elements.get(el.host_roof_id)
        if not isinstance(host, RoofElem):
            continue
        verts = _dormer_overflow_footprint_vertices(el, host)
        host_poly = [(p.x_mm, p.y_mm) for p in host.footprint_mm]
        if any(not _dormer_overflow_point_in_polygon(vx, vy, host_poly) for vx, vy in verts):
            out.append(
                Violation(
                    rule_id="dormer_overflow_v1",
                    severity="warning",
                    message=(
                        f"Dormer '{el.name}' ({el.id}) extends past the host roof "
                        f"'{host.name}' ({host.id}) footprint polygon."
                    ),
                    element_ids=sorted({el.id, host.id}),
                )
            )
    return out


def _dormer_overflow_footprint_vertices(
    dormer: DormerElem,
    host: RoofElem,
) -> list[tuple[float, float]]:
    xs = [p.x_mm for p in host.footprint_mm]
    ys = [p.y_mm for p in host.footprint_mm]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    span_x = max(xs) - min(xs)
    span_y = max(ys) - min(ys)
    ridge_along_x = span_x >= span_y
    if ridge_along_x:
        centre_x = cx + dormer.position_on_roof.along_ridge_mm
        centre_y = cy + dormer.position_on_roof.across_ridge_mm
        half_w = dormer.width_mm / 2
        half_d = dormer.depth_mm / 2
        min_x, max_x = centre_x - half_w, centre_x + half_w
        min_y, max_y = centre_y - half_d, centre_y + half_d
    else:
        centre_x = cx + dormer.position_on_roof.across_ridge_mm
        centre_y = cy + dormer.position_on_roof.along_ridge_mm
        half_w = dormer.width_mm / 2
        half_d = dormer.depth_mm / 2
        min_x, max_x = centre_x - half_d, centre_x + half_d
        min_y, max_y = centre_y - half_w, centre_y + half_w
    return [(min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y)]


def _dormer_overflow_point_in_polygon(
    px: float, py: float, poly: list[tuple[float, float]]
) -> bool:
    n = len(poly)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def _room_boundary_open_violations(elements: dict[str, Element]) -> list[Violation]:
    doc_snap = Document(revision=0, elements=dict(elements))
    unbounded_ids = detect_unbounded_rooms_v1(doc_snap)
    out: list[Violation] = []
    for rid in unbounded_ids:
        el = elements.get(rid)
        name = el.name if hasattr(el, "name") else rid
        out.append(
            Violation(
                rule_id="room_boundary_open",
                severity="warning",
                message=(
                    f"Room '{name}' ({rid}) has an open boundary — "
                    "it is not fully enclosed by axis-aligned walls or room separations."
                ),
                element_ids=[rid],
            )
        )
    return out


def _monitored_source_drift_advisory_violations(
    elements: dict[str, Element],
) -> list[Violation]:
    """FED-03: surface elements whose ``monitor_source.drifted`` flag is set.

    The drift state is computed lazily by the ``BumpMonitoredRevisions``
    command (which has access to a source provider); this rule just reads
    what the bump command wrote so it can run inside the synchronous
    constraint evaluator.
    """
    from bim_ai.monitored import monitored_source_drift_violations

    out: list[Violation] = []
    for elem_id, drifted_fields in monitored_source_drift_violations(elements):
        host_el = elements.get(elem_id)
        host_name = getattr(host_el, "name", elem_id)
        fields_str = ", ".join(drifted_fields) if drifted_fields else "<unknown>"
        out.append(
            Violation(
                rule_id="monitored_source_drift",
                severity="warning",
                message=(
                    f"Monitored element '{host_name}' ({elem_id}) has drifted from its "
                    f"source — fields differ: {fields_str}. Reconcile via Inspector "
                    "(Accept source or Keep host)."
                ),
                element_ids=[elem_id],
            )
        )
    return out
