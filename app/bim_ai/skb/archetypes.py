"""SKB-09 — architectural archetype library.

A library of starter command bundles the agent forks from rather than
authoring from a blank canvas. Each archetype:

  - Has a stable id matching SKB-13's element-count-priors keys
  - Carries a default style hint (SKB-20)
  - Produces a legal command bundle that commits with 0 blocking
    violations and renders credibly at vp-main-iso

This module owns:
  - `Archetype` data shape
  - `ARCHETYPES` registry (four archetypes covering common residential
    shapes: single-family two-storey, single-storey L-bungalow, two-level
    A-frame cabin with mezzanine, three-storey row townhouse)
  - `bundle_for(archetype_id, params)` returns the per-archetype command
    bundle as a list of dicts, ready to feed to `try_commit_bundle`.

Bundles use only kernel commands that already exist on main (createLevel,
createWall, createFloor, createRoof, createDoor, createWindow,
createStair, createRoomOutline, pinElement, saveViewpoint). They tag
every command with a SKB-01 phase. They reference SKB-16 camera presets
via standard viewpoint ids.

Default footprint and floor-height values fall inside the residential
proportion ranges declared in `bim_ai.skb.proportions.PROPORTION_RANGES`.

Adding new archetypes: drop a builder function into this module + add an
entry to `ARCHETYPES`. Pass smoke tests + asserts the bundle commits.

Naming convention: walls whose id starts with ``ptn-`` are interior
partitions. Tests count partitions separately from perimeter walls by
filtering on this prefix.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from typing import Any

from bim_ai.elements import SkbPhaseId
from bim_ai.skb.camera_presets import CAMERA_PRESETS


@dataclass(frozen=True)
class ArchetypeParams:
    """Parameters every archetype builder accepts."""

    width_mm: float = 7000.0
    depth_mm: float = 8000.0
    floor_height_mm: float = 3000.0
    storey_count: int = 2
    style_id: str = "modernist"


@dataclass(frozen=True)
class Archetype:
    archetype_id: str
    name: str
    description: str
    default_style_id: str
    builder: Callable[[ArchetypeParams], list[dict[str, Any]]]
    # Per-archetype typical proportions used when ``bundle_for`` is called
    # without explicit ``params``. The caller's explicit overrides always
    # win — see ``bundle_for``.
    default_params: ArchetypeParams = ArchetypeParams()


# ── shared row helpers ─────────────────────────────────────────────────


def _phase_tagged(phase: SkbPhaseId, cmd: dict[str, Any]) -> dict[str, Any]:
    """Wrap a command with `phase` metadata for SKB-01 phased commit."""
    return {"phase": phase, "command": cmd}


Point = tuple[float, float]


def _level_row(
    level_id: str,
    name: str,
    elevation_mm: float,
    *,
    parent_level_id: str | None = None,
    offset_from_parent_mm: float = 0.0,
) -> dict[str, Any]:
    cmd: dict[str, Any] = {
        "type": "createLevel",
        "id": level_id,
        "name": name,
        "elevationMm": elevation_mm,
    }
    if parent_level_id is not None:
        cmd["parentLevelId"] = parent_level_id
        cmd["offsetFromParentMm"] = offset_from_parent_mm
    return _phase_tagged("massing", cmd)


def _wall_row(
    id_: str,
    level_id: str,
    sx: float,
    sy: float,
    ex: float,
    ey: float,
    height_mm: float,
    *,
    name: str | None = None,
    thickness_mm: float = 200.0,
) -> dict[str, Any]:
    return _phase_tagged("skeleton", {
        "type": "createWall",
        "id": id_,
        "name": name or id_,
        "levelId": level_id,
        "start": {"xMm": sx, "yMm": sy},
        "end": {"xMm": ex, "yMm": ey},
        "thicknessMm": thickness_mm,
        "heightMm": height_mm,
    })


def _floor_row(
    id_: str,
    level_id: str,
    boundary: Sequence[Point],
    *,
    name: str | None = None,
    thickness_mm: float = 200.0,
) -> dict[str, Any]:
    return _phase_tagged("envelope", {
        "type": "createFloor",
        "id": id_,
        "name": name or id_,
        "levelId": level_id,
        "boundaryMm": [{"xMm": x, "yMm": y} for x, y in boundary],
        "thicknessMm": thickness_mm,
    })


def _roof_row(
    id_: str,
    reference_level_id: str,
    footprint: Sequence[Point],
    mode: str,
    *,
    slope_deg: float = 28.0,
    overhang_mm: float = 250.0,
) -> dict[str, Any]:
    return _phase_tagged("envelope", {
        "type": "createRoof",
        "id": id_,
        "referenceLevelId": reference_level_id,
        "footprintMm": [{"xMm": x, "yMm": y} for x, y in footprint],
        "roofGeometryMode": mode,
        "slopeDeg": slope_deg,
        "overhangMm": overhang_mm,
    })


def _door_row(
    id_: str,
    wall_id: str,
    along_t: float,
    *,
    width_mm: float = 1000.0,
    height_mm: float = 2200.0,
) -> dict[str, Any]:
    return _phase_tagged("openings", {
        "type": "insertDoorOnWall",
        "id": id_,
        "wallId": wall_id,
        "alongT": along_t,
        "widthMm": width_mm,
        "heightMm": height_mm,
    })


def _window_row(
    id_: str,
    wall_id: str,
    along_t: float,
    *,
    width_mm: float = 1000.0,
    height_mm: float = 1400.0,
    sill_height_mm: float = 900.0,
) -> dict[str, Any]:
    return _phase_tagged("openings", {
        "type": "insertWindowOnWall",
        "id": id_,
        "wallId": wall_id,
        "alongT": along_t,
        "widthMm": width_mm,
        "heightMm": height_mm,
        "sillHeightMm": sill_height_mm,
    })


def _room_row(
    id_: str,
    name: str,
    level_id: str,
    outline: Sequence[Point],
) -> dict[str, Any]:
    return _phase_tagged("interior", {
        "type": "createRoomOutline",
        "id": id_,
        "name": name,
        "levelId": level_id,
        "outlineMm": [{"xMm": x, "yMm": y} for x, y in outline],
    })


def _stair_row(
    id_: str,
    base_level_id: str,
    top_level_id: str,
    start: Point,
    end: Point,
    *,
    name: str | None = None,
    width_mm: float = 1000.0,
) -> dict[str, Any]:
    return _phase_tagged("interior", {
        "type": "createStair",
        "id": id_,
        "name": name or id_,
        "baseLevelId": base_level_id,
        "topLevelId": top_level_id,
        "runStartMm": {"xMm": start[0], "yMm": start[1]},
        "runEndMm": {"xMm": end[0], "yMm": end[1]},
        "widthMm": width_mm,
    })


def _pin_row(element_id: str) -> dict[str, Any]:
    """Pin a wall (or other pinnable element) — used for party walls in
    the townhouse archetype."""
    return _phase_tagged("skeleton", {
        "type": "pinElement",
        "elementId": element_id,
    })


def _viewpoint_row(
    preset_id: str,
    width_mm: float,
    depth_mm: float,
    height_total_mm: float,
) -> dict[str, Any]:
    """Build a saveViewpoint command from a SKB-16 camera preset.

    The preset's azimuth / elevation / distance_factor are converted into
    a position around the model's bounding-box centre.
    """
    preset = CAMERA_PRESETS[preset_id]
    cx = width_mm / 2.0
    cy = depth_mm / 2.0
    cz = height_total_mm / 2.0
    diag = max(width_mm, depth_mm)
    distance = preset.distance_factor * diag
    az = math.radians(preset.azimuth_deg)
    el = math.radians(preset.elevation_deg)
    px = cx + distance * math.sin(az) * math.cos(el)
    py = cy - distance * math.cos(az) * math.cos(el)
    pz = cz + distance * math.sin(el)
    if preset.mode == "orbit_3d":
        mode: str = "orbit_3d"
    elif preset.elevation_deg >= 89.0:
        # top-down ortho — closest representation in saveViewpoint
        mode = "plan_2d"
    else:
        # side-on orthos saved as orbit_3d (saveViewpoint has no first-class
        # orthographic-elevation mode yet; the preset id keeps the intent)
        mode = "orbit_3d"
    return _phase_tagged("documentation", {
        "type": "saveViewpoint",
        "id": preset.id,
        "name": preset.name,
        "camera": {
            "position": {"xMm": px, "yMm": py, "zMm": pz},
            "target": {"xMm": cx, "yMm": cy, "zMm": cz},
            "up": {"xMm": 0, "yMm": 0, "zMm": 1},
        },
        "mode": mode,
    })


# ── single_family_two_story_modest ─────────────────────────────────────


def _single_family_two_story_modest(p: ArchetypeParams) -> list[dict[str, Any]]:
    """Two-storey rectangular envelope with interior partitions.

    Eight perimeter walls (4 per floor) plus six interior partition walls
    (3 per floor) carve the rectangular footprint into front-left,
    front-right, and back rooms on each level. One straight stair links
    ground → upper. South facade carries the entry door + four windows
    per floor.
    """
    w = p.width_mm
    d = p.depth_mm
    h = p.floor_height_mm
    upper = h
    storey_count = max(p.storey_count, 2)
    roof_eave = h * storey_count

    cmds: list[dict[str, Any]] = []

    # massing — 2 levels
    cmds.append(_level_row("lvl-ground", "Ground", 0))
    cmds.append(_level_row("lvl-upper", "First Floor", upper))

    # skeleton — perimeter walls (CCW)
    cmds.append(_wall_row("w-gf-s", "lvl-ground", 0, 0, w, 0, h))
    cmds.append(_wall_row("w-gf-e", "lvl-ground", w, 0, w, d, h))
    cmds.append(_wall_row("w-gf-n", "lvl-ground", w, d, 0, d, h))
    cmds.append(_wall_row("w-gf-w", "lvl-ground", 0, d, 0, 0, h))

    cmds.append(_wall_row("w-uf-s", "lvl-upper", 0, 0, w, 0, h))
    cmds.append(_wall_row("w-uf-e", "lvl-upper", w, 0, w, d, h))
    cmds.append(_wall_row("w-uf-n", "lvl-upper", w, d, 0, d, h))
    cmds.append(_wall_row("w-uf-w", "lvl-upper", 0, d, 0, 0, h))

    # skeleton — interior partitions (3 per floor: mid e-w + 2 short n-s)
    mid_y = d / 2.0
    mid_x = w / 2.0
    for prefix, lvl in (("gf", "lvl-ground"), ("uf", "lvl-upper")):
        cmds.append(_wall_row(
            f"ptn-{prefix}-mid-ew", lvl, 0, mid_y, w, mid_y, h,
            thickness_mm=120, name=f"Partition mid ({prefix})",
        ))
        cmds.append(_wall_row(
            f"ptn-{prefix}-front-ns", lvl, mid_x, 0, mid_x, mid_y, h,
            thickness_mm=120, name=f"Partition front ({prefix})",
        ))
        cmds.append(_wall_row(
            f"ptn-{prefix}-back-ns", lvl, mid_x, mid_y, mid_x, d, h,
            thickness_mm=120, name=f"Partition back ({prefix})",
        ))

    # envelope — floor slabs + roof
    rect: list[Point] = [(0, 0), (w, 0), (w, d), (0, d)]
    cmds.append(_floor_row("flr-ground", "lvl-ground", rect))
    cmds.append(_floor_row("flr-upper", "lvl-upper", rect))
    cmds.append(_roof_row(
        "rf-main", "lvl-upper", rect, "gable_pitched_rectangle",
        slope_deg=28.0, overhang_mm=250.0,
    ))

    # openings — door + windows on south facade (4 per floor)
    cmds.append(_door_row("dr-main", "w-gf-s", 0.5))
    for i, t in enumerate([0.18, 0.35, 0.65, 0.82]):
        cmds.append(_window_row(
            f"win-gf-s-{i}", "w-gf-s", t,
            width_mm=800, height_mm=1400, sill_height_mm=800,
        ))
    for i, t in enumerate([0.18, 0.35, 0.65, 0.82]):
        cmds.append(_window_row(
            f"win-uf-s-{i}", "w-uf-s", t,
            width_mm=800, height_mm=1400, sill_height_mm=800,
        ))

    # interior — 1 stair + 6 rooms (3 per floor)
    cmds.append(_stair_row(
        "st-main", "lvl-ground", "lvl-upper",
        (mid_x - 600, mid_y + 200), (mid_x - 600, mid_y + 4000),
        name="Main stair",
    ))
    for prefix, lvl, names in (
        ("gf", "lvl-ground", ("Living", "Kitchen", "Family")),
        ("uf", "lvl-upper", ("Bedroom 1", "Bedroom 2", "Bath + Hall")),
    ):
        cmds.append(_room_row(
            f"rm-{prefix}-front-l", names[0], lvl,
            [(200, 200), (mid_x - 100, 200),
             (mid_x - 100, mid_y - 100), (200, mid_y - 100)],
        ))
        cmds.append(_room_row(
            f"rm-{prefix}-front-r", names[1], lvl,
            [(mid_x + 100, 200), (w - 200, 200),
             (w - 200, mid_y - 100), (mid_x + 100, mid_y - 100)],
        ))
        cmds.append(_room_row(
            f"rm-{prefix}-back", names[2], lvl,
            [(200, mid_y + 100), (w - 200, mid_y + 100),
             (w - 200, d - 200), (200, d - 200)],
        ))

    # documentation — 3 viewpoints (front / rear / iso)
    cmds.append(_viewpoint_row("vp-main-iso", w, d, roof_eave))
    cmds.append(_viewpoint_row("vp-front-elev", w, d, roof_eave))
    cmds.append(_viewpoint_row("vp-rear-elev", w, d, roof_eave))

    return cmds


# ── l_shape_bungalow ───────────────────────────────────────────────────


def _l_shape_bungalow(p: ArchetypeParams) -> list[dict[str, Any]]:
    """Single-storey L-shape bungalow with hip/gable roof.

    Footprint: an axis-aligned 6-vertex L with the reflex corner at
    (w/2, d*0.6). Six perimeter walls trace the outline; five interior
    partitions plus six room outlines subdivide the plan into living,
    kitchen, bedrooms, bath, utility.
    """
    w = p.width_mm
    d = p.depth_mm
    h = p.floor_height_mm

    # L-shape vertices (CCW, axis-aligned, exactly one reflex corner)
    rx = w * 0.5
    ry = d * 0.6
    footprint: list[Point] = [
        (0, 0), (w, 0), (w, d),
        (rx, d), (rx, ry), (0, ry),
    ]

    cmds: list[dict[str, Any]] = []

    # massing
    cmds.append(_level_row("lvl-ground", "Ground", 0))

    # skeleton — 6 perimeter walls (one per L edge)
    for i, ((sx, sy), (ex, ey)) in enumerate(_edge_pairs(footprint)):
        cmds.append(_wall_row(
            f"w-perim-{i}", "lvl-ground", sx, sy, ex, ey, h,
            name=f"Perimeter {i}",
        ))

    # skeleton — 5 interior partitions
    cmds.append(_wall_row(
        "ptn-main-mid-ew", "lvl-ground", 0, ry * 0.5, rx, ry * 0.5, h,
        thickness_mm=120, name="Partition main mid",
    ))
    cmds.append(_wall_row(
        "ptn-main-front-ns", "lvl-ground",
        rx * 0.5, 0, rx * 0.5, ry * 0.5, h,
        thickness_mm=120, name="Partition main front",
    ))
    cmds.append(_wall_row(
        "ptn-main-back-ns", "lvl-ground",
        rx * 0.5, ry * 0.5, rx * 0.5, ry, h,
        thickness_mm=120, name="Partition main back",
    ))
    cmds.append(_wall_row(
        "ptn-wing-mid-ew", "lvl-ground",
        rx, (ry + d) / 2, w, (ry + d) / 2, h,
        thickness_mm=120, name="Partition wing mid",
    ))
    cmds.append(_wall_row(
        "ptn-wing-mid-ns", "lvl-ground",
        (rx + w) / 2, ry, (rx + w) / 2, d, h,
        thickness_mm=120, name="Partition wing centre",
    ))

    # envelope — 1 floor slab + 1 hip / gable_pitched_l_shape roof
    cmds.append(_floor_row("flr-ground", "lvl-ground", footprint))
    cmds.append(_roof_row(
        "rf-main", "lvl-ground", footprint, "gable_pitched_l_shape",
        slope_deg=30.0, overhang_mm=400.0,
    ))

    # openings — 1 door (south) + 8 windows
    cmds.append(_door_row("dr-main", "w-perim-0", 0.5,
                          width_mm=1000, height_mm=2200))
    # 4 windows on the front south facade
    for i, t in enumerate([0.10, 0.30, 0.70, 0.90]):
        cmds.append(_window_row(
            f"win-front-{i}", "w-perim-0", t,
            width_mm=900, height_mm=1400, sill_height_mm=900,
        ))
    # 2 windows on east wall (perim-1)
    for i, t in enumerate([0.25, 0.75]):
        cmds.append(_window_row(
            f"win-east-{i}", "w-perim-1", t,
            width_mm=900, height_mm=1400, sill_height_mm=900,
        ))
    # 2 windows on west wall (perim-5)
    for i, t in enumerate([0.30, 0.70]):
        cmds.append(_window_row(
            f"win-west-{i}", "w-perim-5", t,
            width_mm=900, height_mm=1400, sill_height_mm=900,
        ))

    # interior — 6 rooms
    inset = 200
    half_x = rx * 0.5
    half_y = ry * 0.5
    cmds.append(_room_row(
        "rm-living", "Living", "lvl-ground",
        [(inset, inset), (half_x - inset, inset),
         (half_x - inset, half_y - inset), (inset, half_y - inset)],
    ))
    cmds.append(_room_row(
        "rm-kitchen", "Kitchen", "lvl-ground",
        [(half_x + inset, inset), (rx - inset, inset),
         (rx - inset, half_y - inset), (half_x + inset, half_y - inset)],
    ))
    cmds.append(_room_row(
        "rm-bed-1", "Bedroom 1", "lvl-ground",
        [(inset, half_y + inset), (half_x - inset, half_y + inset),
         (half_x - inset, ry - inset), (inset, ry - inset)],
    ))
    cmds.append(_room_row(
        "rm-bed-2", "Bedroom 2", "lvl-ground",
        [(half_x + inset, half_y + inset),
         (rx - inset, half_y + inset),
         (rx - inset, ry - inset), (half_x + inset, ry - inset)],
    ))
    cmds.append(_room_row(
        "rm-bath", "Bathroom", "lvl-ground",
        [(rx + inset, ry + inset),
         ((rx + w) / 2 - inset, ry + inset),
         ((rx + w) / 2 - inset, d - inset),
         (rx + inset, d - inset)],
    ))
    cmds.append(_room_row(
        "rm-utility", "Utility", "lvl-ground",
        [((rx + w) / 2 + inset, ry + inset),
         (w - inset, ry + inset),
         (w - inset, d - inset),
         ((rx + w) / 2 + inset, d - inset)],
    ))

    # documentation
    cmds.append(_viewpoint_row("vp-main-iso", w, d, h))
    cmds.append(_viewpoint_row("vp-front-elev", w, d, h))
    cmds.append(_viewpoint_row("vp-rear-elev", w, d, h))

    return cmds


def _edge_pairs(vertices: Sequence[Point]) -> list[tuple[Point, Point]]:
    """Closed-polygon edges (last vertex wraps to first)."""
    n = len(vertices)
    return [(vertices[i], vertices[(i + 1) % n]) for i in range(n)]


# ── cabin_a_frame ──────────────────────────────────────────────────────


def _cabin_a_frame(p: ArchetypeParams) -> list[dict[str, Any]]:
    """A-frame cabin: ground level + mezzanine via a child LevelElem at
    ~2/3 of the floor-height, steep gable roof, large front glazing.

    Four perimeter walls live on the ground level (the gable roof carries
    the side enclosure above eave). Two interior partitions split living
    from circulation on the ground and storage from sleeping on the
    mezz. One stair links ground → mezz.
    """
    w = p.width_mm
    d = p.depth_mm
    h = p.floor_height_mm
    mezz_elev = h * (2.0 / 3.0)
    roof_apex = h * 1.8  # steep gable extends well above the eave

    cmds: list[dict[str, Any]] = []

    # massing — ground + mezzanine (mezz declared as child level via
    # parentLevelId/offsetFromParentMm, matching LevelElem's monitoring
    # fields).
    cmds.append(_level_row("lvl-ground", "Ground", 0))
    cmds.append(_level_row(
        "lvl-mezz", "Mezzanine", mezz_elev,
        parent_level_id="lvl-ground",
        offset_from_parent_mm=mezz_elev,
    ))

    # skeleton — 4 perimeter walls on ground (CCW)
    cmds.append(_wall_row("w-gf-s", "lvl-ground", 0, 0, w, 0, h))
    cmds.append(_wall_row("w-gf-e", "lvl-ground", w, 0, w, d, h))
    cmds.append(_wall_row("w-gf-n", "lvl-ground", w, d, 0, d, h))
    cmds.append(_wall_row("w-gf-w", "lvl-ground", 0, d, 0, 0, h))

    # skeleton — 2 partitions (1 per level)
    cmds.append(_wall_row(
        "ptn-gf-mid-ew", "lvl-ground",
        0, d * 0.55, w, d * 0.55, h,
        thickness_mm=120, name="Partition ground",
    ))
    # mezz partition is shorter — reflects the limited mezz floor area
    cmds.append(_wall_row(
        "ptn-mezz-mid-ew", "lvl-mezz",
        w * 0.2, d * 0.55, w * 0.8, d * 0.55, h * 0.6,
        thickness_mm=120, name="Partition mezz",
    ))

    # envelope — ground floor slab, mezz slab (covering rear half), steep gable roof
    rect: list[Point] = [(0, 0), (w, 0), (w, d), (0, d)]
    mezz_boundary: list[Point] = [
        (0, d * 0.5), (w, d * 0.5), (w, d), (0, d),
    ]
    cmds.append(_floor_row("flr-ground", "lvl-ground", rect))
    cmds.append(_floor_row(
        "flr-mezz", "lvl-mezz", mezz_boundary,
        thickness_mm=180,
    ))
    cmds.append(_roof_row(
        "rf-main", "lvl-ground", rect, "gable_pitched_rectangle",
        slope_deg=60.0, overhang_mm=600.0,
    ))

    # openings — 1 door (south) + 4 windows (south, large front glazing)
    cmds.append(_door_row(
        "dr-main", "w-gf-s", 0.5,
        width_mm=1100, height_mm=2200,
    ))
    for i, t in enumerate([0.15, 0.35, 0.65, 0.85]):
        cmds.append(_window_row(
            f"win-front-{i}", "w-gf-s", t,
            width_mm=1500, height_mm=1800, sill_height_mm=600,
        ))

    # interior — stair + 4 rooms (2 per level)
    cmds.append(_stair_row(
        "st-mezz", "lvl-ground", "lvl-mezz",
        (w * 0.15, d * 0.6), (w * 0.15, d * 0.85),
        name="Mezzanine stair",
    ))
    inset = 200
    cmds.append(_room_row(
        "rm-gf-living", "Living + Kitchen", "lvl-ground",
        [(inset, inset), (w - inset, inset),
         (w - inset, d * 0.55 - inset), (inset, d * 0.55 - inset)],
    ))
    cmds.append(_room_row(
        "rm-gf-bath", "Bath + Utility", "lvl-ground",
        [(inset, d * 0.55 + inset), (w - inset, d * 0.55 + inset),
         (w - inset, d - inset), (inset, d - inset)],
    ))
    cmds.append(_room_row(
        "rm-mezz-sleep", "Sleeping Loft", "lvl-mezz",
        [(w * 0.2 + inset, d * 0.5 + inset),
         (w * 0.8 - inset, d * 0.5 + inset),
         (w * 0.8 - inset, d * 0.55 - inset),
         (w * 0.2 + inset, d * 0.55 - inset)],
    ))
    cmds.append(_room_row(
        "rm-mezz-storage", "Storage", "lvl-mezz",
        [(w * 0.2 + inset, d * 0.55 + inset),
         (w * 0.8 - inset, d * 0.55 + inset),
         (w * 0.8 - inset, d - inset),
         (w * 0.2 + inset, d - inset)],
    ))

    # documentation
    cmds.append(_viewpoint_row("vp-main-iso", w, d, roof_apex))
    cmds.append(_viewpoint_row("vp-front-elev", w, d, roof_apex))
    cmds.append(_viewpoint_row("vp-side-elev-east", w, d, roof_apex))

    return cmds


# ── townhouse_three_story ──────────────────────────────────────────────


def _townhouse_three_story(p: ArchetypeParams) -> list[dict[str, Any]]:
    """Three-storey row townhouse with a narrow rectangular footprint and
    party walls flagged via `pinned=True`.

    Twelve perimeter walls (4 per level × 3 levels) bound a 5×12 m plan
    by default. The east and west long sides are party walls — emitted
    `pinElement` commands flip their `pinned` flag so the engine refuses
    to move them without an explicit `forcePinOverride`. Three partitions
    per level subdivide each storey into front, mid, and rear rooms; two
    stairs link consecutive levels.
    """
    w = p.width_mm
    d = p.depth_mm
    h = p.floor_height_mm
    storey_count = max(p.storey_count, 3)
    roof_eave = h * storey_count

    cmds: list[dict[str, Any]] = []

    # massing — 3 levels
    levels = [
        ("lvl-l0", "Ground", 0.0),
        ("lvl-l1", "First Floor", h),
        ("lvl-l2", "Second Floor", h * 2.0),
    ]
    for level_id, name, elev in levels:
        cmds.append(_level_row(level_id, name, elev))

    rect: list[Point] = [(0, 0), (w, 0), (w, d), (0, d)]

    # skeleton — perimeter walls + party-wall pin commands
    party_wall_ids: list[str] = []
    for prefix, level_id, _elev in [
        ("l0", "lvl-l0", 0.0), ("l1", "lvl-l1", h), ("l2", "lvl-l2", h * 2.0),
    ]:
        cmds.append(_wall_row(
            f"w-{prefix}-s", level_id, 0, 0, w, 0, h,
            name=f"Front wall ({prefix})",
        ))
        cmds.append(_wall_row(
            f"w-{prefix}-e", level_id, w, 0, w, d, h,
            name=f"Party wall east ({prefix})",
        ))
        cmds.append(_wall_row(
            f"w-{prefix}-n", level_id, w, d, 0, d, h,
            name=f"Rear wall ({prefix})",
        ))
        cmds.append(_wall_row(
            f"w-{prefix}-w", level_id, 0, d, 0, 0, h,
            name=f"Party wall west ({prefix})",
        ))
        party_wall_ids.extend([f"w-{prefix}-e", f"w-{prefix}-w"])

    # pin party walls (east + west on every level)
    for wid in party_wall_ids:
        cmds.append(_pin_row(wid))

    # skeleton — 3 partitions per level (split front/mid/rear)
    third_d = d / 3.0
    for prefix, level_id in [("l0", "lvl-l0"), ("l1", "lvl-l1"), ("l2", "lvl-l2")]:
        cmds.append(_wall_row(
            f"ptn-{prefix}-front", level_id, 0, third_d, w, third_d, h,
            thickness_mm=120, name=f"Partition front ({prefix})",
        ))
        cmds.append(_wall_row(
            f"ptn-{prefix}-mid", level_id, 0, third_d * 2, w, third_d * 2, h,
            thickness_mm=120, name=f"Partition mid ({prefix})",
        ))
        cmds.append(_wall_row(
            f"ptn-{prefix}-stair", level_id,
            w * 0.6, third_d * 1.6, w * 0.6, third_d * 2.4, h,
            thickness_mm=120, name=f"Partition stair ({prefix})",
        ))

    # envelope — 3 floor slabs + 1 flat roof
    cmds.append(_floor_row("flr-l0", "lvl-l0", rect))
    cmds.append(_floor_row("flr-l1", "lvl-l1", rect))
    cmds.append(_floor_row("flr-l2", "lvl-l2", rect))
    cmds.append(_roof_row(
        "rf-main", "lvl-l2", rect, "flat",
        slope_deg=2.0, overhang_mm=200.0,
    ))

    # openings — 1 door (ground south) + 9 windows (3 per level)
    cmds.append(_door_row("dr-main", "w-l0-s", 0.5,
                          width_mm=1000, height_mm=2200))
    for prefix in ("l0", "l1", "l2"):
        for i, t in enumerate([0.2, 0.5, 0.8]):
            cmds.append(_window_row(
                f"win-{prefix}-s-{i}", f"w-{prefix}-s", t,
                width_mm=1000, height_mm=1500, sill_height_mm=900,
            ))

    # interior — 2 stairs + 9 rooms (3 per level)
    cmds.append(_stair_row(
        "st-l0-l1", "lvl-l0", "lvl-l1",
        (w * 0.65, third_d * 1.7), (w * 0.65, third_d * 2.3),
        name="Stair l0→l1",
    ))
    cmds.append(_stair_row(
        "st-l1-l2", "lvl-l1", "lvl-l2",
        (w * 0.65, third_d * 1.7), (w * 0.65, third_d * 2.3),
        name="Stair l1→l2",
    ))
    inset = 200
    for prefix, level_id, names in [
        ("l0", "lvl-l0", ("Entry", "Living", "Kitchen + Dining")),
        ("l1", "lvl-l1", ("Bedroom Front", "Study", "Bedroom Rear")),
        ("l2", "lvl-l2", ("Master Bedroom", "Bath", "Roof Room")),
    ]:
        cmds.append(_room_row(
            f"rm-{prefix}-front", names[0], level_id,
            [(inset, inset), (w - inset, inset),
             (w - inset, third_d - inset), (inset, third_d - inset)],
        ))
        cmds.append(_room_row(
            f"rm-{prefix}-mid", names[1], level_id,
            [(inset, third_d + inset), (w - inset, third_d + inset),
             (w - inset, third_d * 2 - inset),
             (inset, third_d * 2 - inset)],
        ))
        cmds.append(_room_row(
            f"rm-{prefix}-rear", names[2], level_id,
            [(inset, third_d * 2 + inset),
             (w - inset, third_d * 2 + inset),
             (w - inset, d - inset), (inset, d - inset)],
        ))

    # documentation
    cmds.append(_viewpoint_row("vp-main-iso", w, d, roof_eave))
    cmds.append(_viewpoint_row("vp-front-elev", w, d, roof_eave))
    cmds.append(_viewpoint_row("vp-rear-elev", w, d, roof_eave))

    return cmds


# ── registry ────────────────────────────────────────────────────────────


ARCHETYPES: dict[str, Archetype] = {
    "single_family_two_story_modest": Archetype(
        archetype_id="single_family_two_story_modest",
        name="Single-family, two-storey, rectangular",
        description=(
            "Modest two-storey house with rectangular envelope, gable roof, "
            "one entry door, four south-facing windows per floor, six "
            "interior partitions, and a straight stair core. Default "
            "starting point for residential briefs."
        ),
        default_style_id="modernist",
        builder=_single_family_two_story_modest,
        default_params=ArchetypeParams(
            width_mm=7000.0, depth_mm=8000.0,
            floor_height_mm=3000.0, storey_count=2,
            style_id="modernist",
        ),
    ),
    "l_shape_bungalow": Archetype(
        archetype_id="l_shape_bungalow",
        name="L-shape bungalow",
        description=(
            "Single-storey L-shaped bungalow with a hip-style L-gable roof. "
            "Six perimeter walls trace the L footprint; five interior "
            "partitions split the plan into living, kitchen, two bedrooms, "
            "bath, and utility."
        ),
        default_style_id="farmhouse",
        builder=_l_shape_bungalow,
        default_params=ArchetypeParams(
            width_mm=10000.0, depth_mm=10000.0,
            floor_height_mm=3000.0, storey_count=1,
            style_id="farmhouse",
        ),
    ),
    "cabin_a_frame": Archetype(
        archetype_id="cabin_a_frame",
        name="A-frame cabin with mezzanine",
        description=(
            "Compact A-frame cabin with a steep gable roof, large front "
            "glazing, and a mezzanine declared via a child LevelElem at "
            "roughly 2/3 of the floor-to-ceiling height."
        ),
        default_style_id="scandinavian",
        builder=_cabin_a_frame,
        default_params=ArchetypeParams(
            width_mm=6000.0, depth_mm=8000.0,
            floor_height_mm=3000.0, storey_count=2,
            style_id="scandinavian",
        ),
    ),
    "townhouse_three_story": Archetype(
        archetype_id="townhouse_three_story",
        name="Three-storey row townhouse",
        description=(
            "Narrow three-storey row townhouse with a flat roof. East and "
            "west long-side walls are party walls and ship pinned (every "
            "level) so the engine refuses to move them without an explicit "
            "force-override."
        ),
        default_style_id="traditional",
        builder=_townhouse_three_story,
        default_params=ArchetypeParams(
            width_mm=5000.0, depth_mm=12000.0,
            floor_height_mm=3000.0, storey_count=3,
            style_id="traditional",
        ),
    ),
}


def known_archetype_ids() -> list[str]:
    """Sorted list of archetype ids."""
    return sorted(ARCHETYPES.keys())


def bundle_for(
    archetype_id: str,
    params: ArchetypeParams | None = None,
) -> list[dict[str, Any]]:
    """Build the phased command bundle for an archetype.

    ``params`` overrides ``ArchetypeParams`` defaults. Each archetype's
    builder picks its own footprint defaults when ``params`` is the
    library default — otherwise the caller's explicit dimensions win.
    """
    if archetype_id not in ARCHETYPES:
        raise ValueError(
            f"unknown archetype {archetype_id!r}; known: {known_archetype_ids()}"
        )
    archetype = ARCHETYPES[archetype_id]
    p = params if params is not None else archetype.default_params
    return archetype.builder(p)


# `replace` is re-exported for callers that want to tweak ArchetypeParams
# without depending directly on dataclasses.replace.
__all__ = [
    "Archetype",
    "ArchetypeParams",
    "ARCHETYPES",
    "bundle_for",
    "known_archetype_ids",
    "replace",
]
