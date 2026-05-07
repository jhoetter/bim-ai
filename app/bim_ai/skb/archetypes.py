"""SKB-09 — architectural archetype library.

A library of starter command bundles the agent forks from rather than
authoring from a blank canvas. Each archetype:

  - Has a stable id matching SKB-13's element-count-priors keys
  - Carries a default style hint (SKB-20)
  - Produces a legal command bundle that commits with 0 blocking
    violations and renders credibly at vp-main-iso

This module owns:
  - `Archetype` data shape
  - `ARCHETYPES` registry (one full archetype + scaffolding for more)
  - `bundle_for(archetype_id, params)` returns the per-archetype command
    bundle as a list of dicts, ready to feed to `try_commit_bundle`.

Bundles use only kernel commands that already exist on main (createLevel,
createWall, createFloor, createRoof, createDoor, createWindow,
createRoomOutline, saveViewpoint). They tag every command with a SKB-01
phase. They reference SKB-16 camera presets via standard viewpoint ids.

Adding new archetypes: drop a builder function into this module + add an
entry to `ARCHETYPES`. Pass smoke tests + asserts the bundle commits.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from bim_ai.elements import SkbPhaseId


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


def _phase_tagged(phase: SkbPhaseId, cmd: dict[str, Any]) -> dict[str, Any]:
    """Wrap a command with `phase` metadata for SKB-01 phased commit."""
    return {"phase": phase, "command": cmd}


# ── single_family_two_story_modest ─────────────────────────────────────


def _single_family_two_story_modest(p: ArchetypeParams) -> list[dict[str, Any]]:
    """Two-storey rectangular envelope: 4 walls per floor, 2 floors,
    1 simple gable roof, 1 entry door, 4 windows, 1 stair shaft.

    Roughly the seed-house's shape minus the loggia / dormer / asymmetric
    gable — those are the agent's _modifications_ on top of this baseline.
    """
    w = p.width_mm
    d = p.depth_mm
    h = p.floor_height_mm
    upper = h
    roof_eave = h * p.storey_count

    cmds: list[dict[str, Any]] = []

    # ── massing: 2 levels ──
    cmds.append(_phase_tagged("massing", {
        "type": "createLevel", "id": "lvl-ground", "name": "Ground", "elevationMm": 0,
    }))
    cmds.append(_phase_tagged("massing", {
        "type": "createLevel", "id": "lvl-upper", "name": "First Floor", "elevationMm": upper,
    }))

    # ── skeleton: 4 walls per floor ──
    def wall(id_: str, level_id: str, sx: float, sy: float, ex: float, ey: float) -> dict[str, Any]:
        return _phase_tagged("skeleton", {
            "type": "createWall", "id": id_, "name": id_,
            "levelId": level_id,
            "start": {"xMm": sx, "yMm": sy},
            "end": {"xMm": ex, "yMm": ey},
            "thicknessMm": 200, "heightMm": h,
        })

    # ground floor walls (CCW)
    cmds.append(wall("w-gf-s", "lvl-ground", 0, 0, w, 0))
    cmds.append(wall("w-gf-e", "lvl-ground", w, 0, w, d))
    cmds.append(wall("w-gf-n", "lvl-ground", w, d, 0, d))
    cmds.append(wall("w-gf-w", "lvl-ground", 0, d, 0, 0))

    # upper floor walls
    cmds.append(wall("w-uf-s", "lvl-upper", 0, 0, w, 0))
    cmds.append(wall("w-uf-e", "lvl-upper", w, 0, w, d))
    cmds.append(wall("w-uf-n", "lvl-upper", w, d, 0, d))
    cmds.append(wall("w-uf-w", "lvl-upper", 0, d, 0, 0))

    # ── envelope: floor slabs + roof ──
    def floor(id_: str, level_id: str) -> dict[str, Any]:
        return _phase_tagged("envelope", {
            "type": "createFloor", "id": id_, "name": id_,
            "levelId": level_id,
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": w, "yMm": 0},
                {"xMm": w, "yMm": d},
                {"xMm": 0, "yMm": d},
            ],
            "thicknessMm": 200,
        })

    cmds.append(floor("flr-ground", "lvl-ground"))
    cmds.append(floor("flr-upper", "lvl-upper"))

    cmds.append(_phase_tagged("envelope", {
        "type": "createRoof", "id": "rf-main",
        "referenceLevelId": "lvl-upper",
        "footprintMm": [
            {"xMm": 0, "yMm": 0},
            {"xMm": w, "yMm": 0},
            {"xMm": w, "yMm": d},
            {"xMm": 0, "yMm": d},
        ],
        "roofGeometryMode": "gable_pitched_rectangle",
        "slopeDeg": 28.0, "overhangMm": 250,
    }))

    # ── openings: door + 4 windows on south facade ──
    cmds.append(_phase_tagged("openings", {
        "type": "insertDoorOnWall", "id": "dr-main",
        "wallId": "w-gf-s", "alongT": 0.5,
        "widthMm": 1000, "heightMm": 2200,
    }))
    for i, t in enumerate([0.18, 0.35, 0.65, 0.82]):
        cmds.append(_phase_tagged("openings", {
            "type": "insertWindowOnWall", "id": f"win-gf-s-{i}",
            "wallId": "w-gf-s", "alongT": t,
            "widthMm": 800, "heightMm": 1400, "sillHeightMm": 800,
        }))

    # ── interior: rooms ──
    cmds.append(_phase_tagged("interior", {
        "type": "createRoomOutline", "id": "rm-gf-living",
        "name": "Living + Kitchen", "levelId": "lvl-ground",
        "outlineMm": [
            {"xMm": 200, "yMm": 200},
            {"xMm": w - 200, "yMm": 200},
            {"xMm": w - 200, "yMm": d - 200},
            {"xMm": 200, "yMm": d - 200},
        ],
    }))
    cmds.append(_phase_tagged("interior", {
        "type": "createRoomOutline", "id": "rm-uf-bed",
        "name": "Bedroom", "levelId": "lvl-upper",
        "outlineMm": [
            {"xMm": 200, "yMm": 200},
            {"xMm": w - 200, "yMm": 200},
            {"xMm": w - 200, "yMm": d - 200},
            {"xMm": 200, "yMm": d - 200},
        ],
    }))

    # ── documentation: viewpoint matching SKB-16 vp-main-iso ──
    cmds.append(_phase_tagged("documentation", {
        "type": "saveViewpoint", "id": "vp-main-iso",
        "name": "Main isometric (SSW)",
        "camera": {
            "position": {"xMm": -w * 0.7, "yMm": -d * 1.5, "zMm": roof_eave * 1.6},
            "target": {"xMm": w * 0.5, "yMm": d * 0.5, "zMm": roof_eave * 0.5},
            "up": {"xMm": 0, "yMm": 0, "zMm": 1},
        },
        "mode": "orbit_3d",
    }))

    return cmds


# ── registry ────────────────────────────────────────────────────────────


ARCHETYPES: dict[str, Archetype] = {
    "single_family_two_story_modest": Archetype(
        archetype_id="single_family_two_story_modest",
        name="Single-family, two-storey, rectangular",
        description=(
            "Modest two-storey house with rectangular envelope, gable roof, "
            "one entry door, four south-facing windows, and one stair core. "
            "Default starting point for residential briefs."
        ),
        default_style_id="modernist",
        builder=_single_family_two_story_modest,
    ),
}


def known_archetype_ids() -> list[str]:
    """Sorted list of archetype ids."""
    return sorted(ARCHETYPES.keys())


def bundle_for(
    archetype_id: str,
    params: ArchetypeParams | None = None,
) -> list[dict[str, Any]]:
    """Build the phased command bundle for an archetype."""
    if archetype_id not in ARCHETYPES:
        raise ValueError(
            f"unknown archetype {archetype_id!r}; known: {known_archetype_ids()}"
        )
    p = params if params is not None else ArchetypeParams()
    return ARCHETYPES[archetype_id].builder(p)
