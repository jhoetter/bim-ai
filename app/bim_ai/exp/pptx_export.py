"""OUT-V3-02 — deterministic PPTX export from PresentationCanvas frames.

Note: actual .pptx binary writing (via python-pptx) would require an additional
dep. For v3, this module ships a structured JSON bundle as the PPTX contract —
the binary write can be added later. The export endpoint returns the bundle JSON.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Slide:
    view_id: str
    caption: str | None
    position_mm: dict
    size_mm: dict
    sort_order: int


@dataclass
class PptxBundle:
    schema_version: str = "out-v3.0"
    title: str = "bim-ai presentation"
    slides: list[Slide] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schema_version,
            "title": self.title,
            "slides": [
                {
                    "viewId": s.view_id,
                    "caption": s.caption,
                    "positionMm": s.position_mm,
                    "sizeMm": s.size_mm,
                    "sortOrder": s.sort_order,
                }
                for s in sorted(self.slides, key=lambda s: s.sort_order)
            ],
        }


def build_pptx_bundle(canvas: dict, frames: list[dict]) -> PptxBundle:
    """Build a PptxBundle from a canvas dict and a list of frame wire-format dicts.

    Only frames whose presentationCanvasId matches canvas["id"] are included.
    Slides are ordered by sortOrder ascending.
    """
    slides = [
        Slide(
            view_id=f["viewId"],
            caption=f.get("caption"),
            position_mm=f["positionMm"],
            size_mm=f["sizeMm"],
            sort_order=f.get("sortOrder", 0),
        )
        for f in frames
        if f.get("presentationCanvasId") == canvas["id"]
    ]
    return PptxBundle(title=canvas.get("name", "Presentation"), slides=slides)
