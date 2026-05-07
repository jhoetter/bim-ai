"""SKB-16 — camera preset definitions matched to common sketch perspectives.

When the customer sketch contains panels like "main perspective from SSW",
"front elevation", "side elevation", "rear axonometric", the seed should
ship named viewpoints whose camera matches each panel's angle exactly.

That gives SKB-03 (visual checkpoint) and SKB-10 (per-phase visual gate)
deterministic anchors per sketch panel — the agent renders viewport
`vp-front-elev` and compares pixels against the sketch's front-elevation
panel, not against an arbitrary 3D angle.

Presets are pure data; consumers (agent loop, archetype bundles, seed
authoring) translate them into `saveViewpoint` commands at the right
position relative to the model's bounding box.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CameraMode = Literal["orbit_3d", "orthographic"]


@dataclass(frozen=True)
class CameraPreset:
    """Position is relative to the model's bounding-box center.

    `azimuth_deg` is the horizontal angle measured clockwise from north (0°)
    looking down on the plan. `elevation_deg` is the vertical angle of the
    camera above the ground plane. `distance_factor` is the camera distance
    expressed as a multiple of the model's longest plan dimension — keeps
    the preset model-size-independent.
    """

    id: str
    name: str
    description: str
    azimuth_deg: float
    elevation_deg: float
    distance_factor: float
    mode: CameraMode


# Standard preset library. Add presets here as new sketch conventions emerge.
CAMERA_PRESETS: dict[str, CameraPreset] = {
    "vp-main-iso": CameraPreset(
        id="vp-main-iso",
        name="Main isometric (SSW)",
        description="South-south-west isometric, ~30° elevation. Matches the typical perspective panel.",
        azimuth_deg=-25.0,
        elevation_deg=30.0,
        distance_factor=1.6,
        mode="orbit_3d",
    ),
    "vp-front-elev": CameraPreset(
        id="vp-front-elev",
        name="Front elevation (south)",
        description="Pure orthographic from due south, eye-level at first-floor mid-height.",
        azimuth_deg=180.0,
        elevation_deg=0.0,
        distance_factor=1.4,
        mode="orthographic",
    ),
    "vp-rear-elev": CameraPreset(
        id="vp-rear-elev",
        name="Rear elevation (north)",
        description="Pure orthographic from due north.",
        azimuth_deg=0.0,
        elevation_deg=0.0,
        distance_factor=1.4,
        mode="orthographic",
    ),
    "vp-side-elev-east": CameraPreset(
        id="vp-side-elev-east",
        name="Side elevation (east)",
        description="Pure orthographic from due east — shows east facade head-on.",
        azimuth_deg=270.0,
        elevation_deg=0.0,
        distance_factor=1.4,
        mode="orthographic",
    ),
    "vp-side-elev-west": CameraPreset(
        id="vp-side-elev-west",
        name="Side elevation (west)",
        description="Pure orthographic from due west.",
        azimuth_deg=90.0,
        elevation_deg=0.0,
        distance_factor=1.4,
        mode="orthographic",
    ),
    "vp-rear-axo": CameraPreset(
        id="vp-rear-axo",
        name="Rear axonometric (NE iso)",
        description="North-east axonometric, ~35° elevation. Often used to show the back of a house.",
        azimuth_deg=45.0,
        elevation_deg=35.0,
        distance_factor=1.6,
        mode="orbit_3d",
    ),
    "vp-roof-plan": CameraPreset(
        id="vp-roof-plan",
        name="Roof plan (top-down)",
        description="Pure top-down ortho — used to verify roof footprint matches plan sketch.",
        azimuth_deg=0.0,
        elevation_deg=90.0,
        distance_factor=1.4,
        mode="orthographic",
    ),
    "vp-cutaway-iso": CameraPreset(
        id="vp-cutaway-iso",
        name="Cutaway isometric (SE)",
        description="South-east isometric, used when the seed has a section_box active.",
        azimuth_deg=-45.0,
        elevation_deg=30.0,
        distance_factor=1.5,
        mode="orbit_3d",
    ),
}


def known_preset_ids() -> list[str]:
    """Sorted list of camera preset ids."""
    return sorted(CAMERA_PRESETS.keys())


def preset_for_sketch_panel(panel_label: str) -> CameraPreset | None:
    """Map a free-form sketch panel label (e.g. "front elevation",
    "ssw perspective") to the closest matching preset, or None if no
    confident match exists.
    """
    p = panel_label.strip().lower()
    if "ssw" in p or "south-south-west" in p or "main perspective" in p or "main iso" in p:
        return CAMERA_PRESETS["vp-main-iso"]
    if "front" in p and "elev" in p:
        return CAMERA_PRESETS["vp-front-elev"]
    if "rear" in p and "elev" in p:
        return CAMERA_PRESETS["vp-rear-elev"]
    if "side" in p and ("east" in p or "right" in p):
        return CAMERA_PRESETS["vp-side-elev-east"]
    if "side" in p and ("west" in p or "left" in p):
        return CAMERA_PRESETS["vp-side-elev-west"]
    if "rear" in p and ("axo" in p or "ne" in p or "northeast" in p):
        return CAMERA_PRESETS["vp-rear-axo"]
    if "roof" in p and ("plan" in p or "top" in p):
        return CAMERA_PRESETS["vp-roof-plan"]
    if "cut" in p or "section" in p:
        return CAMERA_PRESETS["vp-cutaway-iso"]
    return None
