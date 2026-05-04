"""Deterministic A1-ish sheet SVG for exports and regression probes."""

from __future__ import annotations

import html
import math
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    PlanViewElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    ViewpointElem,
)


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


def read_viewport_mm_box(vp: dict[str, Any]) -> tuple[float, float, float, float]:
    """Mirror TS `readViewportMmBox`: camelCase plus legacy ``wMm``/``hMm`` with min dimension 10mm."""
    x_mm = float(vp.get("xMm") or vp.get("x_mm") or 0)
    y_mm = float(vp.get("yMm") or vp.get("y_mm") or 0)
    width_mm = float(
        vp.get("widthMm") or vp.get("width_mm") or vp.get("wMm") or vp.get("w_mm") or 1000
    )
    height_mm = float(
        vp.get("heightMm") or vp.get("height_mm") or vp.get("hMm") or vp.get("h_mm") or 1000
    )
    nw = width_mm if math.isfinite(width_mm) else 1000.0
    nh = height_mm if math.isfinite(height_mm) else 1000.0
    nx = x_mm if math.isfinite(x_mm) else 0.0
    ny = y_mm if math.isfinite(y_mm) else 0.0
    return (nx, ny, max(10.0, nw), max(10.0, nh))


def _vp_axis_xy(
    obj: Any, keys_x: tuple[str, ...], keys_y: tuple[str, ...]
) -> tuple[float | None, float | None]:
    """Read x,y from viewport corner dict ({xMm,yMm} aliases)."""

    if obj is None or not isinstance(obj, dict):
        return None, None

    d = obj

    def pick(keys: tuple[str, ...]) -> float | None:
        for key in keys:
            val = d.get(key)
            if val is None:
                continue
            num = float(val)
            if math.isfinite(num):
                return num
        return None

    xa = pick(keys_x)
    ya = pick(keys_y)
    return xa, ya


def read_viewport_crop_min_max(
    vp: dict[str, Any],
) -> tuple[tuple[float, float] | None, tuple[float, float] | None]:
    """Optional model-space crop corners on replayable viewport row (camelCase + snake_case aliases)."""

    mn = vp.get("cropMinMm") or vp.get("crop_min_mm")
    mx = vp.get("cropMaxMm") or vp.get("crop_max_mm")

    xmin, ymin = _vp_axis_xy(mn, ("xMm", "x_mm"), ("yMm", "y_mm"))
    xmax, ymax = _vp_axis_xy(mx, ("xMm", "x_mm"), ("yMm", "y_mm"))
    if None in (xmin, ymin, xmax, ymax):
        return None, None
    assert xmin is not None and ymin is not None and xmax is not None and ymax is not None
    return (xmin, ymin), (xmax, ymax)


def format_viewport_crop_export_segment(vp: dict[str, Any]) -> str:
    """Deterministic substring for SVG/PDF/Manifest regressions when both crop corners exist."""

    cmn, cmx = read_viewport_crop_min_max(vp)
    if cmn is None or cmx is None:
        return ""

    xmin, ymin = cmn
    xmax, ymax = cmx
    return f"crop[mn={xmin:g},{ymin:g} mx={xmax:g},{ymax:g}]"


def viewport_evidence_hints_v0(vps_raw: list[Any]) -> list[dict[str, Any]]:
    """Sorted hints for deterministic manifest consumption (WP-X01)."""

    hints: list[dict[str, Any]] = []

    for i, vp_any in enumerate(vps_raw):
        if not isinstance(vp_any, dict):
            continue

        vp = vp_any

        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
        if not vid:
            vid = f"__implicit_{i}"

        x_mm, y_mm, w_mm, h_mm = read_viewport_mm_box(vp)

        geom = f"[{x_mm:g},{y_mm:g}] {w_mm:g}×{h_mm:g} mm"

        crop_seg = format_viewport_crop_export_segment(vp)
        crop = crop_seg.replace("crop[", "").replace("]", "").strip() if crop_seg else "omit"

        hints.append({"viewportId": vid, "geom": geom, "crop": crop})

    return sorted(hints, key=lambda r: str(r.get("viewportId") or ""))


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
    if kind in {"viewpoint", "vp"}:
        if isinstance(el, ViewpointElem):
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
        x_mm, y_mm, width_mm, height_mm = read_viewport_mm_box(vp)
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

        crop_seg = format_viewport_crop_export_segment(vp)

        crop_block = ""
        if crop_seg:
            esc_crop = html.escape(crop_seg)
            crop_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 1800}" '
                f'fill="#0f766e" font-size="300px">{esc_crop}</text>'
            )

        viewport_blocks.append(
            "<g>"
            f'<rect x="{x_mm}" y="{y_mm}" width="{width_mm}" height="{height_mm}" '
            f'fill="#ffffff" stroke="#475569" stroke-width="80"/>'
            f'<text x="{x_mm + 200}" y="{y_mm + 900}" fill="#475569" font-size="600px">'
            f"{escaped_label}"
            f"</text>"
            f"{sub_block}"
            f"{crop_block}"
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
