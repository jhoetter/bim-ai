from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass
from typing import Any, Literal

from bim_ai.elements import (
    CeilingElem,
    ColumnElem,
    FamilyInstanceElem,
    FloorElem,
    HandrailSupport,
    LevelElem,
    PlacedAssetElem,
    RailingElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    Vec2Mm,
    WallElem,
)

try:
    from bim_ai.document import Document
except Exception:  # pragma: no cover
    Document = Any  # type: ignore[misc,assignment]


Severity = Literal["error", "warning", "info"]
Priority = Literal["P0", "P1", "P2", "P3"]

DEFAULT_TOLERANCE_MM = 75.0
DEFAULT_MAX_BALUSTER_SPACING_MM = 125.0
DEFAULT_MIN_GUARD_HEIGHT_MM = 900.0
DEFAULT_MIN_EXTERIOR_GUARD_HEIGHT_MM = 1000.0
DEFAULT_MIN_RAILING_COVERAGE_RATIO = 0.75
DEFAULT_MIN_STAIR_HEADROOM_MM = 2100.0
DEFAULT_MAX_RISER_MM = 190.0
DEFAULT_MIN_TREAD_MM = 260.0
DEFAULT_MIN_LANDING_DEPTH_MM = 900.0


@dataclass(frozen=True)
class VerticalCirculationFinding:
    rule_id: str
    code: str
    severity: Severity
    priority: Priority
    discipline: str
    perspective: str
    message: str
    element_ids: tuple[str, ...]
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["ruleId"] = payload.pop("rule_id")
        payload["elementIds"] = list(payload.pop("element_ids"))
        return payload


def check_vertical_circulation_integrity(
    doc_or_elements: Document | Mapping[str, Any],
    *,
    tolerance_mm: float = DEFAULT_TOLERANCE_MM,
    max_baluster_spacing_mm: float = DEFAULT_MAX_BALUSTER_SPACING_MM,
    min_guard_height_mm: float = DEFAULT_MIN_GUARD_HEIGHT_MM,
    min_exterior_guard_height_mm: float = DEFAULT_MIN_EXTERIOR_GUARD_HEIGHT_MM,
) -> list[dict[str, Any]]:
    """Return deterministic floor/stair/railing integrity findings.

    This checker is intentionally standalone: it reads canonical element fields plus
    optional ``props`` metadata and does not mutate the document or shared schemas.
    """

    elements = doc_or_elements.elements if hasattr(doc_or_elements, "elements") else doc_or_elements
    if not isinstance(elements, Mapping):
        raise TypeError(
            "check_vertical_circulation_integrity expects a Document or element mapping"
        )

    typed_elements = _typed_elements(elements)
    floors = sorted(
        [elem for elem in typed_elements.values() if isinstance(elem, FloorElem)],
        key=lambda elem: elem.id,
    )
    stairs = sorted(
        [elem for elem in typed_elements.values() if isinstance(elem, StairElem)],
        key=lambda elem: elem.id,
    )
    railings = sorted(
        [elem for elem in typed_elements.values() if isinstance(elem, RailingElem)],
        key=lambda elem: elem.id,
    )
    ceilings = sorted(
        [elem for elem in typed_elements.values() if isinstance(elem, CeilingElem)],
        key=lambda elem: elem.id,
    )
    slab_openings = sorted(
        [elem for elem in typed_elements.values() if isinstance(elem, SlabOpeningElem)],
        key=lambda elem: elem.id,
    )
    rooms = sorted(
        [elem for elem in typed_elements.values() if isinstance(elem, RoomElem)],
        key=lambda elem: elem.id,
    )
    placed_content = sorted(
        [
            elem
            for elem in typed_elements.values()
            if isinstance(elem, PlacedAssetElem | FamilyInstanceElem)
        ],
        key=lambda elem: elem.id,
    )

    findings: list[VerticalCirculationFinding] = []
    findings.extend(
        _detached_slab_findings(floors, stairs, typed_elements, tolerance_mm=tolerance_mm)
    )
    findings.extend(_unsupported_slab_findings(floors, typed_elements))
    findings.extend(
        _slab_opening_findings(
            slab_openings,
            floors,
            stairs,
            typed_elements,
            tolerance_mm=tolerance_mm,
        )
    )
    findings.extend(
        _stair_graph_findings(stairs, floors, typed_elements, tolerance_mm=tolerance_mm)
    )
    findings.extend(_stair_comfort_headroom_findings(stairs, ceilings, typed_elements))
    findings.extend(
        _stair_overlap_findings(
            stairs,
            rooms,
            placed_content,
            tolerance_mm=tolerance_mm,
        )
    )
    findings.extend(
        _occupied_exterior_space_findings(
            floors,
            stairs,
            railings,
            typed_elements,
            tolerance_mm=tolerance_mm,
        )
    )
    findings.extend(_stair_guard_findings(stairs, railings))
    findings.extend(
        _railing_findings(
            railings,
            typed_elements,
            max_baluster_spacing_mm=max_baluster_spacing_mm,
            min_guard_height_mm=min_guard_height_mm,
            min_exterior_guard_height_mm=min_exterior_guard_height_mm,
        )
    )

    return [
        finding.to_dict()
        for finding in sorted(
            findings, key=lambda item: (item.rule_id, item.element_ids, item.code)
        )
    ]


def _detached_slab_findings(
    floors: list[FloorElem],
    stairs: list[StairElem],
    elements: Mapping[str, Any],
    *,
    tolerance_mm: float,
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for floor in floors:
        if _floor_bool(floor, "allowDetached", "allow_detached"):
            continue
        if _floor_bool(floor, "isCantilever", "cantilever"):
            continue
        if _floor_has_physical_context(floor, floors, stairs, elements, tolerance_mm=tolerance_mm):
            continue
        findings.append(
            _finding(
                "BIR-E02",
                "detached_slab_fragment",
                "error",
                "P1",
                f"Floor '{floor.id}' is isolated from same-level slabs, vertical circulation, and structural context.",
                [floor.id],
                "Join the fragment to the main slab/terrace, host it with support metadata, or mark it intentionally detached.",
            )
        )
    return findings


def _unsupported_slab_findings(
    floors: list[FloorElem],
    elements: Mapping[str, Any],
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    levels = {elem.id: elem for elem in elements.values() if isinstance(elem, LevelElem)}
    for floor in floors:
        props = _props(floor)
        support_ids = _floor_ref_ids(floor, "supportedByIds", "supportIds", "hostIds")
        cantilever = _floor_bool(floor, "isCantilever", "cantilever")
        if support_ids and _all_refs_exist(support_ids, elements):
            continue
        if support_ids:
            findings.append(
                _finding(
                    "BIR-E02",
                    "slab_support_reference_missing",
                    "error",
                    "P1",
                    f"Floor '{floor.id}' has support metadata with unresolved references.",
                    [floor.id, *support_ids],
                    "Point supportedByIds/supportIds at existing walls, columns, beams, or host slabs.",
                )
            )
            continue
        if cantilever and _has_truthy(props, "cantileverSupportIntent", "cantileverAnchorIds"):
            continue
        level = levels.get(floor.level_id)
        if level is not None and level.elevation_mm <= 1.0:
            continue
        findings.append(
            _finding(
                "BIR-E02",
                "unsupported_slab",
                "error",
                "P1",
                f"Elevated floor '{floor.id}' has no support or cantilever intent metadata.",
                [floor.id],
                "Add supportedByIds/supportIds, model bearing walls or columns below it, or record cantilever support intent.",
            )
        )
    return findings


def _slab_opening_findings(
    slab_openings: list[SlabOpeningElem],
    floors: list[FloorElem],
    stairs: list[StairElem],
    elements: Mapping[str, Any],
    *,
    tolerance_mm: float,
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    floors_by_id = {floor.id: floor for floor in floors}
    openings_by_floor: dict[str, list[SlabOpeningElem]] = {}
    for opening in slab_openings:
        openings_by_floor.setdefault(opening.host_floor_id, []).append(opening)
        host = floors_by_id.get(opening.host_floor_id)
        if host is None:
            findings.append(
                _finding(
                    "BIR-E01",
                    "slab_opening_host_missing",
                    "error",
                    "P0",
                    f"Slab opening '{opening.id}' references a missing host floor.",
                    [opening.id, opening.host_floor_id],
                    "Host the slab opening to an existing floor or delete the orphan opening.",
                )
            )
            continue
        opening_polygon = _opening_polygon(opening)
        if _polygon_area_abs(opening_polygon) < 2500.0:
            findings.append(
                _finding(
                    "BIR-E01",
                    "slab_opening_degenerate",
                    "error",
                    "P0",
                    f"Slab opening '{opening.id}' has a degenerate boundary.",
                    [opening.id, host.id],
                    "Provide a non-degenerate polygonal slab/shaft opening boundary.",
                )
            )
        host_polygon = _polygon(host)
        if not opening_polygon or not all(
            _point_tuple_in_polygon_or_on_edge(point, host_polygon, tolerance_mm)
            for point in opening_polygon
        ):
            findings.append(
                _finding(
                    "BIR-E01",
                    "slab_opening_outside_host",
                    "error",
                    "P0",
                    f"Slab opening '{opening.id}' is not fully inside host floor '{host.id}'.",
                    [opening.id, host.id],
                    "Move or resize the opening so every boundary vertex lies within the host slab.",
                )
            )

    for stair in stairs:
        top_floor = _floor_at_point(floors, stair.top_level_id, stair.run_end, tolerance_mm)
        if top_floor is None:
            continue
        stair_polygon = _stair_footprint(stair)
        if any(
            _polygons_touch_or_overlap(
                stair_polygon,
                _opening_polygon(opening),
                tolerance_mm,
            )
            or _point_in_polygon_or_on_edge(stair.run_end, _opening_polygon(opening), tolerance_mm)
            for opening in openings_by_floor.get(top_floor.id, [])
        ):
            continue
        findings.append(
            _finding(
                "BIR-E01",
                "stair_missing_slab_opening",
                "error",
                "P0",
                f"Stair '{stair.id}' reaches floor '{top_floor.id}' without a matching slab/shaft opening.",
                [stair.id, top_floor.id],
                "Add a slab/shaft opening on the upper floor that overlaps the stair penetration.",
            )
        )
    return findings


def _stair_graph_findings(
    stairs: list[StairElem],
    floors: list[FloorElem],
    elements: Mapping[str, Any],
    *,
    tolerance_mm: float,
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for stair in stairs:
        missing_levels = [
            level_id
            for level_id in (stair.base_level_id, stair.top_level_id)
            if not isinstance(elements.get(level_id), LevelElem)
        ]
        if missing_levels:
            findings.append(
                _finding(
                    "BIR-E05",
                    "stair_level_reference_missing",
                    "error",
                    "P1",
                    f"Stair '{stair.id}' references missing graph levels.",
                    [stair.id, *missing_levels],
                    "Reconnect the stair base/top levels to existing level datum elements.",
                )
            )
            continue

        base_level = elements.get(stair.base_level_id)
        top_level = elements.get(stair.top_level_id)
        if isinstance(base_level, LevelElem) and isinstance(top_level, LevelElem):
            if stair.base_level_id == stair.top_level_id or (
                top_level.elevation_mm <= base_level.elevation_mm
            ):
                findings.append(
                    _finding(
                        "BIR-E05",
                        "stair_level_transition_invalid",
                        "error",
                        "P1",
                        f"Stair '{stair.id}' does not connect an upward pair of levels.",
                        [stair.id, stair.base_level_id, stair.top_level_id],
                        "Set distinct base/top levels with the top level above the base level.",
                    )
                )

        base_floor = _floor_at_point(floors, stair.base_level_id, stair.run_start, tolerance_mm)
        top_floor = _floor_at_point(floors, stair.top_level_id, stair.run_end, tolerance_mm)
        if base_floor is None or top_floor is None:
            element_ids = [stair.id]
            if base_floor is not None:
                element_ids.append(base_floor.id)
            if top_floor is not None:
                element_ids.append(top_floor.id)
            findings.append(
                _finding(
                    "BIR-E05",
                    "stair_graph_connection_missing",
                    "error",
                    "P1",
                    f"Stair '{stair.id}' does not land on connected floor footprints at both levels.",
                    element_ids,
                    "Move stair endpoints onto base/top floor footprints or add landing slabs at the connected levels.",
                )
            )
    return findings


def _stair_comfort_headroom_findings(
    stairs: list[StairElem],
    ceilings: list[CeilingElem],
    elements: Mapping[str, Any],
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for stair in stairs:
        if stair.riser_mm > DEFAULT_MAX_RISER_MM or stair.tread_mm < DEFAULT_MIN_TREAD_MM:
            findings.append(
                _finding(
                    "BIR-E04",
                    "stair_riser_tread_comfort_failure",
                    "error",
                    "P1",
                    f"Stair '{stair.id}' riser/tread does not meet the residential comfort proxy.",
                    [stair.id],
                    "Use riserMm <= 190 and treadMm >= 260, or route the stair through a profile-specific exception.",
                )
            )

        if stair.authoring_mode == "by_sketch":
            findings.extend(_by_sketch_stair_comfort_findings(stair))

        findings.extend(_stair_headroom_findings(stair, ceilings, elements))
    return findings


def _by_sketch_stair_comfort_findings(stair: StairElem) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    if not stair.landings:
        findings.append(
            _finding(
                "BIR-E04",
                "stair_landing_missing",
                "error",
                "P1",
                f"By-sketch stair '{stair.id}' has no modeled landing footprint.",
                [stair.id],
                "Add landing polygons for by-sketch stair runs or switch to a component stair with generated landings.",
            )
        )
    else:
        for landing in stair.landings:
            landing_area = _polygon_area_abs(
                [(point.x_mm, point.y_mm) for point in landing.boundary_mm]
            )
            min_area = max(stair.width_mm, DEFAULT_MIN_LANDING_DEPTH_MM) * stair.width_mm
            if landing_area + 1e-6 < min_area:
                findings.append(
                    _finding(
                        "BIR-E04",
                        "stair_landing_too_small",
                        "error",
                        "P1",
                        f"Stair landing '{landing.id}' is smaller than the stair width/depth proxy.",
                        [stair.id, landing.id],
                        "Resize the landing footprint so it is at least stair-width by landing-depth.",
                    )
                )

    if not stair.tread_lines:
        return findings

    missing_or_invalid = [
        index
        for index, line in enumerate(stair.tread_lines)
        if line.riser_height_mm is None or line.riser_height_mm <= 0
    ]
    if missing_or_invalid:
        findings.append(
            _finding(
                "BIR-E04",
                "stair_by_sketch_riser_metadata_missing",
                "error",
                "P1",
                f"By-sketch stair '{stair.id}' has tread lines without usable riser heights.",
                [stair.id],
                "Balance by-sketch tread lines so every treadLine has a positive riserHeightMm.",
            )
        )
        return findings

    high_risers = [
        index
        for index, line in enumerate(stair.tread_lines)
        if (line.riser_height_mm or 0.0) > DEFAULT_MAX_RISER_MM
    ]
    if high_risers:
        findings.append(
            _finding(
                "BIR-E04",
                "stair_by_sketch_riser_too_high",
                "error",
                "P1",
                f"By-sketch stair '{stair.id}' has riser lines above {DEFAULT_MAX_RISER_MM:g} mm.",
                [stair.id],
                "Rebalance the by-sketch stair tread lines or increase the run count.",
            )
        )
    return findings


def _stair_headroom_findings(
    stair: StairElem,
    ceilings: list[CeilingElem],
    elements: Mapping[str, Any],
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    base_level = elements.get(stair.base_level_id)
    top_level = elements.get(stair.top_level_id)
    total_rise = _stair_total_rise_mm(stair, base_level, top_level)
    samples = _stair_headroom_sample_points(stair)
    for ceiling in ceilings:
        if ceiling.level_id != stair.base_level_id:
            continue
        ceiling_polygon = [(point.x_mm, point.y_mm) for point in ceiling.boundary_mm]
        if len(ceiling_polygon) < 3:
            continue
        for t, point in samples:
            if not _point_tuple_in_polygon_or_on_edge(point, ceiling_polygon, DEFAULT_TOLERANCE_MM):
                continue
            stair_z = total_rise * t
            clearance = ceiling.height_offset_mm - stair_z
            if clearance + 1e-6 >= DEFAULT_MIN_STAIR_HEADROOM_MM:
                continue
            findings.append(
                _finding(
                    "BIR-E04",
                    "stair_headroom_clearance_conflict",
                    "error",
                    "P1",
                    f"Stair '{stair.id}' has {clearance:.1f} mm clear headroom below ceiling '{ceiling.id}'.",
                    [stair.id, ceiling.id],
                    "Raise or cut the overhead ceiling/slab, move the stair, or document a profile-specific headroom exception.",
                )
            )
            break
    return findings


def _stair_guard_findings(
    stairs: list[StairElem],
    railings: list[RailingElem],
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    guarded_stair_ids = {railing.hosted_stair_id for railing in railings if railing.hosted_stair_id}
    for stair in stairs:
        if stair.id in guarded_stair_ids:
            continue
        findings.append(
            _finding(
                "BIR-E03",
                "stair_guardrail_missing",
                "error",
                "P0",
                f"Stair '{stair.id}' has no hosted guardrail or railing.",
                [stair.id],
                "Add at least one railing hosted to the stair or document an approved unguarded-stair exception.",
            )
        )
    return findings


def _stair_overlap_findings(
    stairs: list[StairElem],
    rooms: list[RoomElem],
    placed_content: list[PlacedAssetElem | FamilyInstanceElem],
    *,
    tolerance_mm: float,
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for stair in stairs:
        stair_polygon = _stair_footprint(stair)
        for room in rooms:
            if room.level_id not in {stair.base_level_id, stair.top_level_id}:
                continue
            if not _is_sleeping_room(room):
                continue
            room_polygon = _room_polygon(room)
            if not _polygons_touch_or_overlap(stair_polygon, room_polygon, tolerance_mm):
                continue
            findings.append(
                _finding(
                    "BIR-E05",
                    "stair_sleeping_room_overlap",
                    "error",
                    "P1",
                    f"Stair '{stair.id}' overlaps sleeping-room footprint '{room.id}'.",
                    [stair.id, room.id],
                    "Move the stair into a circulation/landing zone or revise the room boundary so the bedroom is not occupied by vertical circulation.",
                )
            )
        for content in placed_content:
            content_level = getattr(content, "level_id", None)
            if content_level not in {stair.base_level_id, stair.top_level_id}:
                continue
            position = getattr(content, "position_mm", None)
            if not isinstance(position, Vec2Mm):
                continue
            if not _point_in_polygon_or_on_edge(position, stair_polygon, tolerance_mm):
                continue
            findings.append(
                _finding(
                    "BIR-E05",
                    "stair_furniture_overlap",
                    "error",
                    "P1",
                    f"Placed content '{content.id}' occupies stair footprint '{stair.id}'.",
                    [stair.id, content.id],
                    "Move furniture/family content clear of stair runs and landings.",
                )
            )
    return findings


def _occupied_exterior_space_findings(
    floors: list[FloorElem],
    stairs: list[StairElem],
    railings: list[RailingElem],
    elements: Mapping[str, Any],
    *,
    tolerance_mm: float,
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for floor in floors:
        if not _is_occupied_exterior_space(floor):
            continue
        missing: list[str] = []
        if not (
            _has_truthy(_props(floor), "guardIntent", "guarded")
            or _has_railing_guard(floor, railings)
        ):
            missing.append("guard")
        if not _has_truthy(_props(floor), "drainageIntent", "drainage", "drainageSlopePercent"):
            missing.append("drainage")
        if not (
            _has_truthy(_props(floor), "accessIntent", "accessElementIds", "accessRouteIds")
            or _has_stair_access(floor, stairs, tolerance_mm=tolerance_mm)
        ):
            missing.append("access")
        if not _has_truthy(_props(floor), "boundaryIntent", "edgeBoundaryIds", "parapetIds"):
            missing.append("boundary")
        if not _has_truthy(
            _props(floor), "scheduleIntent", "scheduleCategory", "occupancySchedule"
        ):
            missing.append("schedule")
        if not missing:
            continue
        findings.append(
            _finding(
                "BIR-E06",
                "occupied_exterior_space_metadata_missing",
                "error",
                "P1",
                f"Occupied exterior floor '{floor.id}' is missing {', '.join(missing)} intent.",
                [floor.id],
                "Record guard, drainage, access, boundary, and schedule intent for terrace/loggia floors.",
            )
        )
    return findings


def _railing_findings(
    railings: list[RailingElem],
    elements: Mapping[str, Any],
    *,
    max_baluster_spacing_mm: float,
    min_guard_height_mm: float,
    min_exterior_guard_height_mm: float,
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for railing in railings:
        host_ids = _railing_host_ids(railing)
        if not host_ids:
            findings.append(
                _finding(
                    "BIR-E03",
                    "railing_host_reference_missing",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' has no stair, floor, wall, or edge host reference.",
                    [railing.id],
                    "Set hostedStairId or props.hostFloorId/hostWallId/hostEdgeId so the railing remains attached.",
                )
            )
        elif not _all_refs_exist(host_ids, elements, allow_edge_refs=True):
            findings.append(
                _finding(
                    "BIR-E03",
                    "railing_host_reference_unresolved",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' references a missing host.",
                    [railing.id, *host_ids],
                    "Point railing host references at existing stairs, floors, walls, or documented edge ids.",
                )
            )

        exterior = _railing_bool(railing, "isExteriorGuard", "exteriorGuard")
        min_height = min_exterior_guard_height_mm if exterior else min_guard_height_mm
        if railing.guard_height_mm < min_height:
            findings.append(
                _finding(
                    "BIR-E03",
                    "railing_guard_height_too_low",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' guard height {railing.guard_height_mm:g} mm is below {min_height:g} mm.",
                    [railing.id],
                    "Increase guardHeightMm or mark the railing as non-guard decorative geometry.",
                )
            )

        continuity = _railing_continuity_finding(railing, elements)
        if continuity is not None:
            findings.append(continuity)

        if railing.baluster_pattern is None:
            findings.append(
                _finding(
                    "BIR-E07",
                    "railing_baluster_profile_missing",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' has no baluster pattern.",
                    [railing.id],
                    "Add a balusterPattern with spacing/profile intent or use a glass/cable rule with material slots.",
                )
            )
        elif railing.baluster_pattern.rule == "regular":
            spacing = railing.baluster_pattern.spacing_mm
            if spacing is None or spacing > max_baluster_spacing_mm:
                findings.append(
                    _finding(
                        "BIR-E07",
                        "railing_baluster_spacing_too_wide",
                        "error",
                        "P1",
                        f"Railing '{railing.id}' baluster spacing exceeds {max_baluster_spacing_mm:g} mm.",
                        [railing.id],
                        "Reduce balusterPattern.spacingMm or switch to a validated panel/cable guard rule.",
                    )
                )
            if not railing.baluster_pattern.profile_family_id:
                findings.append(
                    _finding(
                        "BIR-E07",
                        "railing_baluster_profile_missing",
                        "error",
                        "P1",
                        f"Railing '{railing.id}' has regular balusters without a profile family.",
                        [railing.id],
                        "Set balusterPattern.profileFamilyId for regular baluster profiles.",
                    )
                )

        if not railing.handrail_supports:
            findings.append(
                _finding(
                    "BIR-E07",
                    "railing_post_or_handrail_support_missing",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' has no handrail support/post pattern.",
                    [railing.id],
                    "Add handrailSupports with bracket family and host references.",
                )
            )
        else:
            findings.extend(
                _handrail_support_findings(railing, railing.handrail_supports, elements)
            )

        missing_material_slots = _missing_material_slots(railing)
        if missing_material_slots:
            findings.append(
                _finding(
                    "BIR-E07",
                    "railing_material_slots_missing",
                    "error",
                    "P2",
                    f"Railing '{railing.id}' is missing material slots: {', '.join(missing_material_slots)}.",
                    [railing.id],
                    "Populate materialSlots for handrail, post, and baluster/panel components.",
                )
            )
    return findings


def _railing_continuity_finding(
    railing: RailingElem,
    elements: Mapping[str, Any],
) -> VerticalCirculationFinding | None:
    path_length = _polyline_length(railing.path_mm)
    if len(railing.path_mm) < 2 or path_length < 600.0:
        return _finding(
            "BIR-E03",
            "railing_path_discontinuous",
            "error",
            "P1",
            f"Railing '{railing.id}' path is too short or discontinuous for guard intent.",
            [railing.id],
            "Author a continuous railing/guard path with at least two usable points.",
        )
    if not railing.hosted_stair_id:
        return None
    stair = elements.get(railing.hosted_stair_id)
    if not isinstance(stair, StairElem):
        return None
    stair_length = _point_distance(stair.run_start, stair.run_end)
    if stair_length <= 1.0:
        return None
    if path_length >= stair_length * DEFAULT_MIN_RAILING_COVERAGE_RATIO:
        return None
    return _finding(
        "BIR-E03",
        "railing_stair_continuity_gap",
        "error",
        "P1",
        f"Railing '{railing.id}' covers less than {DEFAULT_MIN_RAILING_COVERAGE_RATIO:.0%} of hosted stair '{stair.id}'.",
        [railing.id, stair.id],
        "Extend the hosted railing path so it continuously protects the stair run and landing context.",
    )


def _handrail_support_findings(
    railing: RailingElem,
    supports: list[HandrailSupport],
    elements: Mapping[str, Any],
) -> list[VerticalCirculationFinding]:
    findings: list[VerticalCirculationFinding] = []
    for support in supports:
        missing: list[str] = []
        if not support.bracket_family_id:
            missing.append("bracketFamilyId")
        if not support.host_wall_id:
            missing.append("hostWallId")
        elif not isinstance(elements.get(support.host_wall_id), WallElem):
            findings.append(
                _finding(
                    "BIR-E07",
                    "railing_handrail_support_host_invalid",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' has a handrail support hosted by a missing/non-wall element.",
                    [railing.id, support.host_wall_id],
                    "Host handrail supports to an existing wall or remove wall-hosted support metadata.",
                )
            )
        if missing:
            findings.append(
                _finding(
                    "BIR-E07",
                    "railing_handrail_support_profile_missing",
                    "error",
                    "P1",
                    f"Railing '{railing.id}' has incomplete handrail support fields: {', '.join(missing)}.",
                    [railing.id],
                    "Provide bracketFamilyId and hostWallId for every handrail support.",
                )
            )
    return findings


def _finding(
    rule_id: str,
    code: str,
    severity: Severity,
    priority: Priority,
    message: str,
    element_ids: list[str],
    recommendation: str,
) -> VerticalCirculationFinding:
    return VerticalCirculationFinding(
        rule_id=rule_id,
        code=code,
        severity=severity,
        priority=priority,
        discipline="architecture",
        perspective="vertical_circulation",
        message=message,
        element_ids=tuple(sorted(dict.fromkeys(str(eid) for eid in element_ids if eid))),
        recommendation=recommendation,
    )


def _props(element: Any) -> Mapping[str, Any]:
    props = getattr(element, "props", None)
    return props if isinstance(props, Mapping) else {}


def _typed_elements(elements: Mapping[str, Any]) -> dict[str, Any]:
    typed: dict[str, Any] = {}
    for fallback_id, element in elements.items():
        typed_element = _typed_element(element)
        element_id = getattr(typed_element, "id", None) or getattr(element, "id", None)
        if isinstance(element, Mapping):
            element_id = element.get("id", element_id)
        typed[str(element_id or fallback_id)] = typed_element
    return typed


def _typed_element(element: Any) -> Any:
    if not isinstance(element, Mapping):
        return element
    kind = str(element.get("kind") or "")
    model_by_kind = {
        "column": ColumnElem,
        "family_instance": FamilyInstanceElem,
        "floor": FloorElem,
        "level": LevelElem,
        "placed_asset": PlacedAssetElem,
        "ceiling": CeilingElem,
        "railing": RailingElem,
        "room": RoomElem,
        "slab_opening": SlabOpeningElem,
        "stair": StairElem,
        "wall": WallElem,
    }
    model = model_by_kind.get(kind)
    if model is None:
        return element
    try:
        return model.model_validate(element)
    except Exception:
        return element


def _has_truthy(props: Mapping[str, Any], *keys: str) -> bool:
    return any(bool(props.get(key)) for key in keys)


def _floor_bool(floor: FloorElem, *keys: str) -> bool:
    props = _props(floor)
    return any(props.get(key) is True for key in keys)


def _railing_bool(railing: RailingElem, *keys: str) -> bool:
    props = _props(railing)
    return any(props.get(key) is True for key in keys)


def _floor_ref_ids(floor: FloorElem, *keys: str) -> list[str]:
    ids: list[str] = []
    props = _props(floor)
    for key in keys:
        value = props.get(key)
        if isinstance(value, str):
            ids.append(value)
        elif isinstance(value, list | tuple | set):
            ids.extend(str(item) for item in value if item)
    return sorted(dict.fromkeys(ids))


def _railing_host_ids(railing: RailingElem) -> list[str]:
    ids: list[str] = []
    if railing.hosted_stair_id:
        ids.append(railing.hosted_stair_id)
    for value in (railing.host_floor_id, railing.host_wall_id, railing.host_edge_id):
        if value:
            ids.append(value)
    props = _props(railing)
    for key in ("hostFloorId", "hostWallId", "hostEdgeId", "hostIds"):
        value = props.get(key)
        if isinstance(value, str):
            ids.append(value)
        elif isinstance(value, list | tuple | set):
            ids.extend(str(item) for item in value if item)
    return sorted(dict.fromkeys(ids))


def _all_refs_exist(
    ids: list[str],
    elements: Mapping[str, Any],
    *,
    allow_edge_refs: bool = False,
) -> bool:
    for element_id in ids:
        if element_id in elements:
            continue
        if allow_edge_refs and ":edge:" in element_id:
            continue
        return False
    return True


def _has_implicit_structural_support(floor: FloorElem, elements: Mapping[str, Any]) -> bool:
    polygon = _polygon(floor)
    for element in elements.values():
        if isinstance(element, WallElem) and element.level_id == floor.level_id:
            if _point_in_polygon_or_on_edge(element.start, polygon, DEFAULT_TOLERANCE_MM):
                return True
            if _point_in_polygon_or_on_edge(element.end, polygon, DEFAULT_TOLERANCE_MM):
                return True
        if isinstance(element, ColumnElem) and element.level_id == floor.level_id:
            if _point_in_polygon_or_on_edge(element.position_mm, polygon, DEFAULT_TOLERANCE_MM):
                return True
    return False


def _floor_has_physical_context(
    floor: FloorElem,
    floors: list[FloorElem],
    stairs: list[StairElem],
    elements: Mapping[str, Any],
    *,
    tolerance_mm: float,
) -> bool:
    polygon = _polygon(floor)
    for other in floors:
        if other.id == floor.id or other.level_id != floor.level_id:
            continue
        if _polygons_touch_or_overlap(polygon, _polygon(other), tolerance_mm):
            return True
    for stair in stairs:
        if (
            stair.base_level_id == floor.level_id
            and _point_in_polygon_or_on_edge(stair.run_start, polygon, tolerance_mm)
        ) or (
            stair.top_level_id == floor.level_id
            and _point_in_polygon_or_on_edge(stair.run_end, polygon, tolerance_mm)
        ):
            return True
    return _has_implicit_structural_support(floor, elements)


def _floor_at_point(
    floors: list[FloorElem],
    level_id: str,
    point: Vec2Mm,
    tolerance_mm: float,
) -> FloorElem | None:
    candidates = [
        floor
        for floor in floors
        if floor.level_id == level_id
        and _point_in_polygon_or_on_edge(point, _polygon(floor), tolerance_mm)
    ]
    return sorted(candidates, key=lambda floor: floor.id)[0] if candidates else None


def _is_occupied_exterior_space(floor: FloorElem) -> bool:
    props = _props(floor)
    exterior_type = str(props.get("exteriorSpaceType") or props.get("spaceType") or "").lower()
    name = f"{floor.id} {floor.name}".lower()
    return exterior_type in {"terrace", "loggia", "balcony", "roof_terrace"} or any(
        token in name for token in ("terrace", "loggia")
    )


def _has_railing_guard(floor: FloorElem, railings: list[RailingElem]) -> bool:
    for railing in railings:
        if (
            floor.id in _railing_host_ids(railing)
            and railing.guard_height_mm >= DEFAULT_MIN_GUARD_HEIGHT_MM
        ):
            return True
    return False


def _has_stair_access(floor: FloorElem, stairs: list[StairElem], *, tolerance_mm: float) -> bool:
    polygon = _polygon(floor)
    for stair in stairs:
        if stair.base_level_id == floor.level_id and _point_in_polygon_or_on_edge(
            stair.run_start, polygon, tolerance_mm
        ):
            return True
        if stair.top_level_id == floor.level_id and _point_in_polygon_or_on_edge(
            stair.run_end, polygon, tolerance_mm
        ):
            return True
    return False


def _missing_material_slots(railing: RailingElem) -> list[str]:
    slots = railing.material_slots or {}
    required = ("handrail", "post")
    missing = [slot for slot in required if not slots.get(slot)]
    pattern = railing.baluster_pattern
    if pattern is None or pattern.rule == "regular":
        if not slots.get("baluster"):
            missing.append("baluster")
    elif pattern.rule == "glass_panel" and not slots.get("panel"):
        missing.append("panel")
    elif pattern.rule == "cable" and not slots.get("cable"):
        missing.append("cable")
    return missing


def _polygon(floor: FloorElem) -> list[tuple[float, float]]:
    return [(point.x_mm, point.y_mm) for point in floor.boundary_mm]


def _opening_polygon(opening: SlabOpeningElem) -> list[tuple[float, float]]:
    return [(point.x_mm, point.y_mm) for point in opening.boundary_mm]


def _room_polygon(room: RoomElem) -> list[tuple[float, float]]:
    return [(point.x_mm, point.y_mm) for point in room.outline_mm]


def _stair_footprint(stair: StairElem) -> list[tuple[float, float]]:
    if stair.boundary_mm and len(stair.boundary_mm) >= 3:
        return [(point.x_mm, point.y_mm) for point in stair.boundary_mm]
    start = stair.run_start
    end = stair.run_end
    dx = end.x_mm - start.x_mm
    dy = end.y_mm - start.y_mm
    length = (dx * dx + dy * dy) ** 0.5
    if length <= 1.0:
        half = max(stair.width_mm * 0.5, 1.0)
        return [
            (start.x_mm - half, start.y_mm - half),
            (start.x_mm + half, start.y_mm - half),
            (start.x_mm + half, start.y_mm + half),
            (start.x_mm - half, start.y_mm + half),
        ]
    nx = -dy / length
    ny = dx / length
    half_width = stair.width_mm * 0.5
    return [
        (start.x_mm + nx * half_width, start.y_mm + ny * half_width),
        (end.x_mm + nx * half_width, end.y_mm + ny * half_width),
        (end.x_mm - nx * half_width, end.y_mm - ny * half_width),
        (start.x_mm - nx * half_width, start.y_mm - ny * half_width),
    ]


def _stair_headroom_sample_points(stair: StairElem) -> list[tuple[float, tuple[float, float]]]:
    samples: list[tuple[float, tuple[float, float]]] = []
    for t in (0.0, 0.5, 1.0):
        x = stair.run_start.x_mm + (stair.run_end.x_mm - stair.run_start.x_mm) * t
        y = stair.run_start.y_mm + (stair.run_end.y_mm - stair.run_start.y_mm) * t
        samples.append((t, (x, y)))
    if stair.boundary_mm:
        cx = sum(point.x_mm for point in stair.boundary_mm) / len(stair.boundary_mm)
        cy = sum(point.y_mm for point in stair.boundary_mm) / len(stair.boundary_mm)
        samples.append((_projection_t_on_stair(stair, (cx, cy)), (cx, cy)))
    return samples


def _projection_t_on_stair(stair: StairElem, point: tuple[float, float]) -> float:
    dx = stair.run_end.x_mm - stair.run_start.x_mm
    dy = stair.run_end.y_mm - stair.run_start.y_mm
    denom = dx * dx + dy * dy
    if denom <= 1e-9:
        return 0.0
    raw = ((point[0] - stair.run_start.x_mm) * dx + (point[1] - stair.run_start.y_mm) * dy) / denom
    return max(0.0, min(1.0, raw))


def _stair_total_rise_mm(stair: StairElem, base_level: Any, top_level: Any) -> float:
    if stair.total_rise_mm is not None:
        return max(0.0, float(stair.total_rise_mm))
    if isinstance(base_level, LevelElem) and isinstance(top_level, LevelElem):
        return max(0.0, float(top_level.elevation_mm) - float(base_level.elevation_mm))
    return max(0.0, float(stair.riser_mm) * 16.0)


def _is_sleeping_room(room: RoomElem) -> bool:
    props = _props(room)
    tokens = " ".join(
        str(value or "")
        for value in (
            room.id,
            room.name,
            room.programme_code,
            room.department,
            room.function_label,
            props.get("roomType"),
            props.get("spaceType"),
            props.get("programme"),
        )
    ).lower()
    return any(token in tokens for token in ("bedroom", "bed room", "sleep", "schlaf"))


def _polygon_area_abs(polygon: list[tuple[float, float]]) -> float:
    if len(polygon) < 3:
        return 0.0
    area = 0.0
    for idx, (x0, y0) in enumerate(polygon):
        x1, y1 = polygon[(idx + 1) % len(polygon)]
        area += x0 * y1 - x1 * y0
    return abs(area) * 0.5


def _polyline_length(points: list[Vec2Mm]) -> float:
    if len(points) < 2:
        return 0.0
    return sum(
        _point_distance(start, end)
        for start, end in zip(points, points[1:], strict=False)
    )


def _point_distance(start: Vec2Mm, end: Vec2Mm) -> float:
    return ((end.x_mm - start.x_mm) ** 2 + (end.y_mm - start.y_mm) ** 2) ** 0.5


def _point_in_polygon_or_on_edge(
    point: Vec2Mm,
    polygon: list[tuple[float, float]],
    tolerance_mm: float,
) -> bool:
    pt = (point.x_mm, point.y_mm)
    if len(polygon) < 3:
        return False
    if any(
        _point_segment_distance(pt, polygon[i], polygon[(i + 1) % len(polygon)]) <= tolerance_mm
        for i in range(len(polygon))
    ):
        return True
    inside = False
    x, y = pt
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        intersects = (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def _polygons_touch_or_overlap(
    a: list[tuple[float, float]],
    b: list[tuple[float, float]],
    tolerance_mm: float,
) -> bool:
    for point in a:
        if _point_tuple_in_polygon_or_on_edge(point, b, tolerance_mm):
            return True
    for point in b:
        if _point_tuple_in_polygon_or_on_edge(point, a, tolerance_mm):
            return True
    for i in range(len(a)):
        for j in range(len(b)):
            if _segments_intersect(a[i], a[(i + 1) % len(a)], b[j], b[(j + 1) % len(b)]):
                return True
            if (
                _segment_distance(a[i], a[(i + 1) % len(a)], b[j], b[(j + 1) % len(b)])
                <= tolerance_mm
            ):
                return True
    return False


def _point_tuple_in_polygon_or_on_edge(
    point: tuple[float, float],
    polygon: list[tuple[float, float]],
    tolerance_mm: float,
) -> bool:
    return _point_in_polygon_or_on_edge(Vec2Mm(xMm=point[0], yMm=point[1]), polygon, tolerance_mm)


def _segments_intersect(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
) -> bool:
    def orient(p: tuple[float, float], q: tuple[float, float], r: tuple[float, float]) -> float:
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    def on_segment(p: tuple[float, float], q: tuple[float, float], r: tuple[float, float]) -> bool:
        return min(p[0], r[0]) <= q[0] <= max(p[0], r[0]) and min(p[1], r[1]) <= q[1] <= max(
            p[1], r[1]
        )

    o1 = orient(a, b, c)
    o2 = orient(a, b, d)
    o3 = orient(c, d, a)
    o4 = orient(c, d, b)
    if o1 == 0 and on_segment(a, c, b):
        return True
    if o2 == 0 and on_segment(a, d, b):
        return True
    if o3 == 0 and on_segment(c, a, d):
        return True
    if o4 == 0 and on_segment(c, b, d):
        return True
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)


def _segment_distance(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
) -> float:
    return min(
        _point_segment_distance(a, c, d),
        _point_segment_distance(b, c, d),
        _point_segment_distance(c, a, b),
        _point_segment_distance(d, a, b),
    )


def _point_segment_distance(
    p: tuple[float, float],
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    ax, ay = a
    bx, by = b
    px, py = p
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    if length_sq <= 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    proj = (ax + t * dx, ay + t * dy)
    return ((px - proj[0]) ** 2 + (py - proj[1]) ** 2) ** 0.5
