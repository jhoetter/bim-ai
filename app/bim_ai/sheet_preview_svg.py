"""Deterministic A1-ish sheet SVG for exports and regression probes."""

from __future__ import annotations

import html
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import SheetElem


def pick_sheet(doc: Document, sheet_id: str | None) -> SheetElem:
    if sheet_id:
        el = doc.elements.get(sheet_id)
        if not isinstance(el, SheetElem):
            raise ValueError(f"sheet id '{sheet_id}' not found or not a sheet")
        return el
    for e in doc.elements.values():
        if isinstance(e, SheetElem):
            return e
    raise ValueError("no sheet elements in model")


def sheet_elem_to_svg(sh: SheetElem) -> str:
    w_mm = 42_000
    h_mm = 29_700
    vps_raw: list[Any] = list(sh.viewports_mm or [])

    title = html.escape(sh.name or sh.id or "Sheet")
    tb = html.escape(sh.title_block or "—")

    viewport_blocks = []
    for vp in vps_raw:
        if not isinstance(vp, dict):
            continue
        x_mm = float(vp.get("xMm") or vp.get("x_mm") or 0)
        y_mm = float(vp.get("yMm") or vp.get("y_mm") or 0)
        width_mm = float(vp.get("widthMm") or vp.get("width_mm") or 1000)
        height_mm = float(vp.get("heightMm") or vp.get("height_mm") or 1000)
        label = html.escape(str(vp.get("label") or "Viewport"))
        viewport_blocks.append(
            '<g>'
            f'<rect x="{x_mm}" y="{y_mm}" width="{width_mm}" height="{height_mm}" '
            f'fill="#ffffff" stroke="#475569" stroke-width="80"/>'
            f'<text x="{x_mm + 200}" y="{y_mm + 900}" fill="#475569" font-size="600px">{label}</text>'
            '</g>'
        )

    vps_xml = "".join(viewport_blocks)

    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_mm} {h_mm}" '
        f'width="420mm" height="297mm">'
        f'<rect width="{w_mm}" height="{h_mm}" fill="#f8fafc" stroke="#1e293b" stroke-width="120"/>'
        f'<rect x="800" y="800" width="{w_mm - 1600}" height="3600" fill="#edf2ff" opacity="0.9"/>'
        f'<text x="2400" y="2400" fill="#1e293b" font-size="1200px">A1 metaphor — {title}</text>'
        f'<text x="2400" y="3600" fill="#64748b" font-size="800px">TB {tb}</text>'
        f"{vps_xml}"
        f"</svg>"
    )
