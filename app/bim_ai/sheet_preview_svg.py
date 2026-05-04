"""Deterministic A1-ish sheet SVG for exports and regression probes."""

from __future__ import annotations

import html
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, ScheduleElem, SectionCutElem, SheetElem


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


def resolve_view_ref_title(doc: Document, view_ref: str) -> str | None:
    if not view_ref or ":" not in view_ref:
        return None
    kind_raw, ref_raw = view_ref.split(":", 1)
    kind = kind_raw.strip().lower()
    ref = ref_raw.strip()
    if not ref:
        return None
    el = doc.elements.get(ref)

    if kind == "plan":
        if isinstance(el, PlanViewElem):
            return el.name or el.id
        if isinstance(el, LevelElem):
            return f"Level {el.name}"
        return None
    if kind == "schedule":
        if isinstance(el, ScheduleElem):
            return el.name or el.id
        return None
    if kind in {"section", "sec"}:
        if isinstance(el, SectionCutElem):
            return el.name or el.id
        return None

    return None


def sheet_elem_to_svg(doc: Document, sh: SheetElem) -> str:
    w_mm = float(sh.paper_width_mm or 42_000)
    h_mm = float(sh.paper_height_mm or 29_700)
    vps_raw: list[Any] = list(sh.viewports_mm or [])

    title = html.escape(sh.name or sh.id or "Sheet")
    tb = html.escape(sh.title_block or "—")

    tb_params = sh.titleblock_parameters or {}
    sheet_no_raw = tb_params.get("sheetNumber") or tb_params.get("sheetNo") or ""
    revision_raw = tb_params.get("revision") or ""
    project_raw = tb_params.get("projectName") or tb_params.get("project") or ""
    drawn_raw = tb_params.get("drawnBy") or ""
    chk_raw = tb_params.get("checkedBy") or ""
    issued_raw = tb_params.get("issueDate") or tb_params.get("date") or ""

    viewport_blocks = []
    for vp in vps_raw:
        if not isinstance(vp, dict):
            continue
        x_mm = float(vp.get("xMm") or vp.get("x_mm") or 0)
        y_mm = float(vp.get("yMm") or vp.get("y_mm") or 0)
        width_mm = float(vp.get("widthMm") or vp.get("width_mm") or 1000)
        height_mm = float(vp.get("heightMm") or vp.get("height_mm") or 1000)
        label = str(vp.get("label") or "Viewport")
        vr = vp.get("viewRef") or vp.get("view_ref")
        ref_title = resolve_view_ref_title(doc, str(vr)) if isinstance(vr, str) else None
        display = ref_title or label
        escaped_label = html.escape(display)

        sub = html.escape(str(vr)) if isinstance(vr, str) and str(vr) else ""
        sub_block = ""
        if sub:
            sub_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 1400}" fill="#64748b" font-size="350px">{sub}</text>'
            )

        viewport_blocks.append(
            "<g>"
            f'<rect x="{x_mm}" y="{y_mm}" width="{width_mm}" height="{height_mm}" '
            f'fill="#ffffff" stroke="#475569" stroke-width="80"/>'
            f'<text x="{x_mm + 200}" y="{y_mm + 900}" fill="#475569" font-size="600px">'
            f"{escaped_label}"
            f"</text>"
            f"{sub_block}"
            "</g>"
        )

    vps_xml = "".join(viewport_blocks)

    tb_ix = max(2800.0, h_mm - 5200)
    x_right = w_mm - 2600
    y_line = tb_ix
    step = 760

    hdr_parts = []
    if sheet_no_raw.strip():
        hdr_parts.append(sheet_no_raw.strip())
    if revision_raw.strip():
        hdr_parts.append(f"Rev {revision_raw.strip()}")
    hdr = " · ".join(hdr_parts)

    footer_lines = [hdr, project_raw]
    if drawn_raw.strip() or chk_raw.strip():
        footer_lines.append(
            f"Drn {drawn_raw.strip()} · Chk {chk_raw.strip()}".strip(" ·").strip()
        )
    footer_lines.append(issued_raw)

    footer_xml_parts: list[str] = []
    for raw in footer_lines:
        txt = str(raw).strip()
        if not txt:
            continue
        escaped = html.escape(txt)
        footer_xml_parts.append(
            f'<text x="{x_right}" y="{y_line}" fill="#334155" '
            f'font-size="620px" text-anchor="end">{escaped}</text>'
        )
        y_line += step

    footer_xml = "".join(footer_xml_parts)

    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_mm} {h_mm}" '
        f'width="{w_mm / 100:.3f}mm" height="{h_mm / 100:.3f}mm">'
        f'<rect width="{w_mm}" height="{h_mm}" fill="#f8fafc" stroke="#1e293b" stroke-width="120"/>'
        f'<rect x="800" y="800" width="{w_mm - 1600}" height="3600" fill="#edf2ff" opacity="0.9"/>'
        f'<text x="2400" y="2400" fill="#1e293b" font-size="1200px">A1 metaphor — {title}</text>'
        f'<text x="2400" y="3600" fill="#64748b" font-size="800px">TB {tb}</text>'
        f"{footer_xml}"
        f"{vps_xml}"
        f"</svg>"
    )
