"""EXP-V3-01 — deterministic render-pipeline export tool."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Literal

ExportFormat = Literal["gltf", "gltf-pbr", "ifc-bundle", "metadata-only"]


@dataclass
class RenderExportBundle:
    schema_version: str = "exp-v3.0"
    format: ExportFormat = "metadata-only"
    primary_asset: dict | None = None  # {kind, pathInArchive}
    metadata: dict = field(
        default_factory=lambda: {
            "cameras": [],
            "sunSettings": {
                "azimuthDeg": 180.0,
                "elevationDeg": 45.0,
                "intensity": 1.0,
            },
            "materials": [],
            "annotations": [],
        }
    )
    export_timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ"))

    def to_dict(self) -> dict:
        return {
            "schemaVersion": self.schema_version,
            "format": self.format,
            "primaryAsset": self.primary_asset,
            "metadata": self.metadata,
            "exportTimestamp": self.export_timestamp,
        }


def build_export_bundle(
    model_state: dict,
    fmt: ExportFormat,
    view_id: str | None = None,
) -> RenderExportBundle:
    elements = model_state.get("elements", [])

    cameras = []
    for el in elements:
        if el.get("kind") in ("viewpoint", "saved_view"):
            cameras.append(
                {
                    "viewId": el.get("id", ""),
                    "positionMm": el.get("cameraState", {}).get(
                        "positionMm", {"xMm": 0, "yMm": -10000, "zMm": 3000}
                    ),
                    "targetMm": el.get("cameraState", {}).get(
                        "targetMm", {"xMm": 0, "yMm": 0, "zMm": 0}
                    ),
                    "fovDeg": el.get("cameraState", {}).get("fovDeg", 60.0),
                }
            )
    if view_id:
        cameras = [c for c in cameras if c["viewId"] == view_id]

    materials = [
        {"id": el.get("id", ""), "pbr": el.get("pbr", {})}
        for el in elements
        if el.get("kind") == "material"
    ]

    sun = {"azimuthDeg": 180.0, "elevationDeg": 45.0, "intensity": 1.0}
    for el in elements:
        if el.get("kind") == "project_settings":
            if "sunAzimuthDeg" in el:
                sun["azimuthDeg"] = el["sunAzimuthDeg"]
            if "sunElevationDeg" in el:
                sun["elevationDeg"] = el["sunElevationDeg"]

    primary_asset = None
    if fmt in ("gltf", "gltf-pbr"):
        primary_asset = {"kind": "gltf", "pathInArchive": "model.glb"}
    elif fmt == "ifc-bundle":
        primary_asset = {"kind": "ifc", "pathInArchive": "model.ifc"}

    bundle = RenderExportBundle(format=fmt, primary_asset=primary_asset)
    bundle.metadata = {
        "cameras": cameras,
        "sunSettings": sun,
        "materials": materials,
        "annotations": [],
    }
    return bundle
