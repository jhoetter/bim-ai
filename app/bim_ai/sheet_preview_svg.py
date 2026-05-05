"""Deterministic A1-ish sheet SVG for exports and regression probes."""

from __future__ import annotations

import hashlib
import html
import math
import re
import struct
import zlib
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
from bim_ai.plan_projection_wire import resolve_plan_projection_wire
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.section_projection_primitives import build_section_projection_primitives

SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1 = "sheetPrintRasterPlaceholder_v1"

SHEET_PRINT_RASTER_LAYOUT_STAMP_CONTRACT_V1 = "sheetPrintRasterLayoutStamp_v1"

SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2 = "sheetPrintRasterPrintSurrogate_v2"

SHEET_PRINT_RASTER_STAMP_WIDTH_PX = 128
SHEET_PRINT_RASTER_STAMP_HEIGHT_PX = 96
SHEET_PRINT_RASTER_TITLEBLOCK_BAND_PX = 16
SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX = (
    SHEET_PRINT_RASTER_STAMP_HEIGHT_PX + SHEET_PRINT_RASTER_TITLEBLOCK_BAND_PX
)

SHEET_PRINT_RASTER_PRINT_CONTRACT_V3_FORMAT = "sheetPrintRasterPrintContract_v3"


def sheet_svg_utf8_sha256(svg_text: str) -> str:
    return hashlib.sha256(svg_text.encode("utf-8")).hexdigest()


def _png_pack_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack("!I", len(data)) + chunk_type + data + struct.pack("!I", crc)


def sheet_print_raster_placeholder_png_bytes_v1(svg_text: str) -> bytes:
    """1x1 RGB PNG; bytes derived deterministically from the SVG UTF-8 string (hash-correlated placeholder)."""

    digest = hashlib.sha256(svg_text.encode("utf-8")).digest()
    r, g, b = int(digest[0]), int(digest[1]), int(digest[2])
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack("!IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw_scanline = bytes([0, r, g, b])
    idat = zlib.compress(raw_scanline, level=9)
    return (
        signature
        + _png_pack_chunk(b"IHDR", ihdr)
        + _png_pack_chunk(b"IDAT", idat)
        + _png_pack_chunk(b"IEND", b"")
    )


def _encode_png_rgb8_rgb(width: int, height: int, rows_rgb: list[bytes]) -> bytes:
    """RGB8 truecolor PNG, filter type 0 per row."""

    raw = bytearray()
    for row in rows_rgb:
        raw.append(0)
        raw.extend(row)
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=9)
    return (
        signature
        + _png_pack_chunk(b"IHDR", ihdr)
        + _png_pack_chunk(b"IDAT", idat)
        + _png_pack_chunk(b"IEND", b"")
    )


def png_ihdr_wh_bit_depth_color_type(png: bytes) -> tuple[int, int, int, int] | None:
    """Return ``(width, height, bit_depth, color_type)`` from the first IHDR chunk, or ``None``."""

    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        return None
    pos = 8
    while pos + 8 <= len(png):
        ln = int.from_bytes(png[pos : pos + 4], "big")
        ctype = png[pos + 4 : pos + 8]
        chunk = png[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if ctype == b"IHDR":
            if len(chunk) < 13:
                return None
            w = int.from_bytes(chunk[0:4], "big")
            h = int.from_bytes(chunk[4:8], "big")
            return (w, h, int(chunk[8]), int(chunk[9]))
        if ctype == b"IEND":
            break
    return None


def _stamp_bg_rgb(svg_digest: bytes) -> tuple[int, int, int]:
    d = svg_digest
    r = 165 + (d[0] % 45)
    g = 170 + (d[1] % 45)
    b = 175 + (d[2] % 45)
    return r, g, b


def _stamp_viewport_fill_rgb(digest: bytes) -> tuple[int, int, int]:
    d = digest
    r = 40 + (d[0] % 160)
    g = 50 + (d[1] % 150)
    b = 60 + (d[2] % 140)
    return r, g, b


def _sheet_print_raster_layout_stamp_rows(
    _doc: Document, sh: SheetElem, svg_text: str
) -> list[bytes]:
    """RGB scanlines for the viewport layout stamp region (96 rows × 128 cols)."""

    w_px, h_px = SHEET_PRINT_RASTER_STAMP_WIDTH_PX, SHEET_PRINT_RASTER_STAMP_HEIGHT_PX
    svg_digest = hashlib.sha256(svg_text.encode("utf-8")).digest()
    bg = _stamp_bg_rgb(svg_digest)

    rects: list[tuple[str, float, float, float, float]] = []
    for i, vp_any in enumerate(sh.viewports_mm or []):
        if not isinstance(vp_any, dict):
            continue
        vp = vp_any
        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
        if not vid:
            vid = f"__implicit_{i}"
        x_mm, y_mm, w_mm, h_mm = read_viewport_mm_box(vp)
        rects.append((vid, x_mm, y_mm, w_mm, h_mm))

    rows_buf: list[bytearray] = [bytearray([bg[0], bg[1], bg[2]] * w_px) for _ in range(h_px)]

    def set_px(rx: int, ry: int, rgb: tuple[int, int, int]) -> None:
        if 0 <= rx < w_px and 0 <= ry < h_px:
            off = rx * 3
            row = rows_buf[ry]
            row[off] = rgb[0]
            row[off + 1] = rgb[1]
            row[off + 2] = rgb[2]

    if rects:
        ux0 = min(t[1] for t in rects)
        uy0 = min(t[2] for t in rects)
        ux1 = max(t[1] + t[3] for t in rects)
        uy1 = max(t[2] + t[4] for t in rects)
        margin = 4
        span_x = max(ux1 - ux0, 1.0)
        span_y = max(uy1 - uy0, 1.0)
        inner_w = w_px - 2 * margin
        inner_h = h_px - 2 * margin
        scale = min(inner_w / span_x, inner_h / span_y)

        ordered = sorted(rects, key=lambda t: (t[0], t[1], t[2]))
        for idx, (vid, vx, vy, vw, vh) in enumerate(ordered):
            filler_digest = hashlib.sha256(
                svg_text.encode("utf-8")
                + b"|"
                + vid.encode("utf-8")
                + b"|"
                + str(idx).encode("ascii")
            ).digest()
            fr, fg, fb = _stamp_viewport_fill_rgb(filler_digest)
            outline = (max(0, fr - 45), max(0, fg - 45), max(0, fb - 45))
            px0 = margin + int(math.floor((vx - ux0) * scale))
            py0 = margin + int(math.floor((vy - uy0) * scale))
            px1 = margin + int(math.ceil((vx + vw - ux0) * scale)) - 1
            py1 = margin + int(math.ceil((vy + vh - uy0) * scale)) - 1
            px0 = max(0, min(px0, w_px - 1))
            px1 = max(0, min(px1, w_px - 1))
            py0 = max(0, min(py0, h_px - 1))
            py1 = max(0, min(py1, h_px - 1))
            if px1 < px0:
                px0, px1 = px1, px0
            if py1 < py0:
                py0, py1 = py1, py0
            for y in range(py0, py1 + 1):
                for x in range(px0, px1 + 1):
                    edge = x == px0 or x == px1 or y == py0 or y == py1
                    set_px(x, y, outline if edge else (fr, fg, fb))

    return [bytes(r) for r in rows_buf]


def sheet_print_raster_layout_stamp_png_bytes_v1(
    doc: Document, sh: SheetElem, svg_text: str
) -> bytes:
    """128x96 RGB8 PNG from viewport mm rectangles + SVG UTF-8 salt (layout stamp, not SVG raster)."""

    rows = _sheet_print_raster_layout_stamp_rows(doc, sh, svg_text)
    return _encode_png_rgb8_rgb(
        SHEET_PRINT_RASTER_STAMP_WIDTH_PX, SHEET_PRINT_RASTER_STAMP_HEIGHT_PX, rows
    )


def _titleblock_surrogate_payload_bytes(sh: SheetElem) -> bytes:
    """Canonical titleblock + paper fields for the surrogate strip (mirrors SVG export inputs)."""

    tb = sh.titleblock_parameters or {}
    sheet_no_raw = tb.get("sheetNumber") or tb.get("sheetNo") or ""
    revision_raw = tb.get("revision") or ""
    project_raw = tb.get("projectName") or tb.get("project") or ""
    drawn_raw = tb.get("drawnBy") or ""
    chk_raw = tb.get("checkedBy") or ""
    issued_raw = tb.get("issueDate") or tb.get("date") or ""
    parts = (
        sh.name or "",
        sh.title_block or "",
        f"{float(sh.paper_width_mm):g}",
        f"{float(sh.paper_height_mm):g}",
        str(sheet_no_raw),
        str(revision_raw),
        str(project_raw),
        str(drawn_raw),
        str(chk_raw),
        str(issued_raw),
    )
    return "\n".join(parts).encode("utf-8")


def _titleblock_surrogate_band_rows(sh: SheetElem, svg_text: str) -> list[bytes]:
    w_px = SHEET_PRINT_RASTER_STAMP_WIDTH_PX
    band = SHEET_PRINT_RASTER_TITLEBLOCK_BAND_PX
    svg_digest = hashlib.sha256(svg_text.encode("utf-8")).digest()
    payload = _titleblock_surrogate_payload_bytes(sh)
    out: list[bytes] = []
    for r in range(band):
        seed = hashlib.sha256(
            b"sheetPrintRasterTitleblockBand_v2\x00" + svg_digest + bytes([r]) + payload
        ).digest()
        buf = bytearray()
        cur = seed
        while len(buf) < w_px * 3:
            cur = hashlib.sha256(cur + bytes([len(buf) & 0xFF])).digest()
            buf.extend(cur)
        out.append(bytes(buf[: w_px * 3]))
    return out


def sheet_print_raster_print_surrogate_png_bytes_v2(
    doc: Document, sh: SheetElem, svg_text: str
) -> bytes:
    """128×112 RGB8: 96px layout stamp + 16px deterministic titleblock band (not SVG raster)."""

    rows = _sheet_print_raster_layout_stamp_rows(doc, sh, svg_text)
    rows.extend(_titleblock_surrogate_band_rows(sh, svg_text))
    return _encode_png_rgb8_rgb(
        SHEET_PRINT_RASTER_STAMP_WIDTH_PX, SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX, rows
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


def sheet_viewport_stamp_rects_mm_ordered(sh: SheetElem) -> list[tuple[str, float, float, float, float]]:
    """Viewport rectangles sorted like ``_sheet_print_raster_layout_stamp_rows`` fill order."""

    rects: list[tuple[str, float, float, float, float]] = []
    for i, vp_any in enumerate(sh.viewports_mm or []):
        if not isinstance(vp_any, dict):
            continue
        vp = vp_any
        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
        if not vid:
            vid = f"__implicit_{i}"
        x_mm, y_mm, w_mm, h_mm = read_viewport_mm_box(vp)
        rects.append((vid, x_mm, y_mm, w_mm, h_mm))
    return sorted(rects, key=lambda t: (t[0], t[1], t[2]))


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


def format_plan_projection_export_segment(wire: dict[str, Any]) -> str:
    """Compact deterministic summary of plan projection primitives (sheet export / regression)."""

    prim = wire.get("primitives") or {}
    nw = len(prim.get("walls") or [])
    nf = len(prim.get("floors") or [])
    nr = len(prim.get("rooms") or [])
    nd = len(prim.get("doors") or [])
    nwi = len(prim.get("windows") or [])
    ns = len(prim.get("stairs") or [])
    return f"planPrim[w={nw},f={nf},r={nr},d={nd},wi={nwi},s={ns}]"


def format_sheet_plan_viewport_projection_segment(doc: Document, vp: dict[str, Any]) -> str:
    """Plan projection slice for a sheet viewport row when viewRef targets a plan_view."""

    vr = vp.get("viewRef") or vp.get("view_ref")
    if not isinstance(vr, str) or ":" not in vr:
        return ""
    kind_raw, ref_raw = vr.split(":", 1)
    if kind_raw.strip().lower() != "plan":
        return ""
    pv_id = ref_raw.strip()
    if not pv_id:
        return ""
    wire = resolve_plan_projection_wire(
        doc,
        plan_view_id=pv_id,
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=vp,
    )
    return format_plan_projection_export_segment(wire)


def format_section_viewport_documentation_segment(doc: Document, view_ref: str) -> str:
    """Stable documentation substring for sheet exports when viewport references a section cut.

    Includes level counts / elevation span, optional along-cut geometry span ``uGeomSpanMm`` (integer
    millimetres from ``sectionGeometryExtentMm``), optional callout ids, optional wall hatch mix
    ``wh=E{n}A{m}`` (edge-on vs along-cut ``walls[]`` rows) when any walls are present, and optional
    ``mh={n}`` (count of ``sectionDocMaterialHints``) when that list is non-empty.
    """

    if not view_ref.strip() or ":" not in view_ref:
        return ""
    kind_raw, ref_raw = view_ref.split(":", 1)
    kind = kind_raw.strip().lower()
    ref = ref_raw.strip()
    if kind not in {"section", "sec"} or not ref:
        return ""
    el = doc.elements.get(ref)
    if not isinstance(el, SectionCutElem):
        return ""

    prim, _ = build_section_projection_primitives(doc, el)
    markers_raw = prim.get("levelMarkers") or []
    if not isinstance(markers_raw, list) or len(markers_raw) == 0:
        return ""

    def _elev_id(m: Any) -> tuple[float, str]:
        if not isinstance(m, dict):
            return 0.0, ""
        z = m.get("elevationMm") if "elevationMm" in m else m.get("elevation_mm")
        try:
            zz = float(z) if z is not None else 0.0
        except (TypeError, ValueError):
            zz = 0.0
        sid = str(m.get("id") or "")
        return zz, sid

    ordered = sorted(markers_raw, key=_elev_id)
    count = len(ordered)

    inner_parts: list[str] = [f"lvl={count}"]
    if count > 1:
        z_vals = [_elev_id(m)[0] for m in ordered]
        z_span = round(max(z_vals) - min(z_vals))
        inner_parts.append(f"zSpanMm={z_span}")

    geom_raw = prim.get("sectionGeometryExtentMm")
    if isinstance(geom_raw, dict):
        try:
            gu0 = float(geom_raw.get("uMinMm", 0.0))
            gu1 = float(geom_raw.get("uMaxMm", 0.0))
        except (TypeError, ValueError):
            gu0, gu1 = 0.0, 0.0
        if math.isfinite(gu0) and math.isfinite(gu1) and abs(gu1 - gu0) > 0.5:
            inner_parts.append(f"uGeomSpanMm={round(abs(gu1 - gu0))}")

    sc_raw = prim.get("sheetCallouts") or []
    if isinstance(sc_raw, list) and sc_raw:
        co_ids = sorted(
            str(item.get("id") or "").strip()
            for item in sc_raw
            if isinstance(item, dict) and str(item.get("id") or "").strip()
        )
        if co_ids:
            inner_parts.append(f"co={','.join(co_ids)}")

    walls_raw = prim.get("walls") or []
    edge_on = 0
    along_cut = 0
    if isinstance(walls_raw, list):
        for w in walls_raw:
            if not isinstance(w, dict):
                continue
            if str(w.get("cutHatchKind") or "") == "edgeOn":
                edge_on += 1
            else:
                along_cut += 1
    if edge_on > 0 or along_cut > 0:
        inner_parts.append(f"wh=E{edge_on}A{along_cut}")

    mh_raw = prim.get("sectionDocMaterialHints") or []
    if isinstance(mh_raw, list) and len(mh_raw) > 0:
        inner_parts.append(f"mh={len(mh_raw)}")

    return "secDoc[" + " ".join(inner_parts) + "]"


def format_schedule_viewport_documentation_segment(doc: Document, view_ref: str) -> str:
    """Compact deterministic summary when a sheet viewport references ``schedule:``."""

    if not view_ref.strip() or ":" not in view_ref:
        return ""
    kind_raw, ref_raw = view_ref.split(":", 1)
    kind = kind_raw.strip().lower()
    ref = ref_raw.strip()
    if kind != "schedule" or not ref:
        return ""
    el = doc.elements.get(ref)
    if not isinstance(el, ScheduleElem):
        return "schDoc[missing_schedule_element]"
    try:
        tbl = derive_schedule_table(doc, ref)
    except (ValueError, TypeError, KeyError):
        return "schDoc[derive_error]"
    cols = tbl.get("columns") or []
    ncols = len(cols) if isinstance(cols, list) else 0
    try:
        total_rows = int(tbl.get("totalRows", 0))
    except (TypeError, ValueError):
        total_rows = 0
    cat = str(tbl.get("category") or "")
    sid = str(tbl.get("scheduleId") or ref)
    return f"schDoc[id={sid} rows={total_rows} cols={ncols} cat={cat}]"


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


def plan_room_programme_legend_hints_v0(doc: Document, vps_raw: list[Any]) -> list[dict[str, Any]]:
    """Per ``plan:`` viewport: legend digest tying sheet manifest rows to ``plan_projection_wire``."""

    out: list[dict[str, Any]] = []

    for i, vp_any in enumerate(vps_raw):
        if not isinstance(vp_any, dict):
            continue
        vp = vp_any
        vr = vp.get("viewRef") or vp.get("view_ref")
        if not isinstance(vr, str) or ":" not in vr:
            continue
        kind_raw, ref_raw = vr.split(":", 1)
        if kind_raw.strip().lower() != "plan":
            continue
        pv_id = ref_raw.strip()
        if not pv_id:
            continue
        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
        if not vid:
            vid = f"__implicit_{i}"
        wire = resolve_plan_projection_wire(
            doc,
            plan_view_id=pv_id,
            fallback_level_id=None,
            global_plan_presentation="default",
            sheet_viewport_row_for_crop=vp,
        )
        ev = wire.get("roomProgrammeLegendEvidence_v0")
        if not isinstance(ev, dict):
            continue
        digest_raw = ev.get("legendDigestSha256") or ev.get("legend_digest_sha256")
        digest = str(digest_raw).strip()
        if not digest:
            continue
        rows_raw = ev.get("rowCount", ev.get("row_count"))
        try:
            row_count = int(rows_raw)
        except (TypeError, ValueError):
            continue
        out.append(
            {"viewportId": vid, "legendDigestSha256": digest, "rowCount": row_count}
        )

    return sorted(out, key=lambda r: str(r.get("viewportId") or ""))


def viewport_evidence_hints_v1(doc: Document, vps_raw: list[Any]) -> list[dict[str, Any]]:
    """Like ``viewport_evidence_hints_v0`` plus plan / section export segments from ``doc``."""

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

        vr = vp.get("viewRef") or vp.get("view_ref")
        plan_seg = format_sheet_plan_viewport_projection_segment(doc, vp)
        sec_seg = (
            format_section_viewport_documentation_segment(doc, str(vr)) if isinstance(vr, str) else ""
        )
        sch_seg = format_schedule_viewport_documentation_segment(doc, str(vr)) if isinstance(vr, str) else ""

        hints.append(
            {
                "viewportId": vid,
                "geom": geom,
                "crop": crop,
                "planProjectionSegment": plan_seg,
                "sectionDocumentationSegment": sec_seg,
                "scheduleDocumentationSegment": sch_seg,
            }
        )

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


def sheet_viewport_export_listing_lines(doc: Document, sh: SheetElem) -> list[str]:
    """Stable viewport lines for PDF exports and deterministic evidence correlations."""

    lines: list[str] = []

    raw_vps = sh.viewports_mm or []

    for i, vp in enumerate(raw_vps):
        if not isinstance(vp, dict):
            continue
        label = vp.get("label") or vp.get("Label") or f"Viewport {i + 1}"
        vr_raw = vp.get("viewRef") or vp.get("view_ref")

        ttl = ""

        suffix = ""

        if isinstance(vr_raw, str) and vr_raw:

            ttl = resolve_view_ref_title(doc, vr_raw) or ""

            ttl_part = f" — {ttl}" if ttl else ""

            suffix = f" · {vr_raw}{ttl_part}"

        elif vr_raw:

            suffix = f" · {vr_raw}"

        x_mm, y_mm, w_mm, h_mm = read_viewport_mm_box(vp)

        geo = f" [{x_mm:g},{y_mm:g}] {w_mm:g}×{h_mm:g} mm"

        crop_seg = format_viewport_crop_export_segment(vp)

        doc_seg = (
            format_section_viewport_documentation_segment(doc, str(vr_raw))
            if isinstance(vr_raw, str)
            else ""
        )

        proj_seg = format_sheet_plan_viewport_projection_segment(doc, vp) if isinstance(vp, dict) else ""

        sch_seg = (
            format_schedule_viewport_documentation_segment(doc, str(vr_raw))
            if isinstance(vr_raw, str)
            else ""
        )

        geo_tail = (
            geo
            + (f" · {crop_seg}" if crop_seg else "")
            + (f" · {doc_seg}" if doc_seg else "")
            + (f" · {proj_seg}" if proj_seg else "")
            + (f" · {sch_seg}" if sch_seg else "")
        )

        lines.append(str(f"{label}{suffix}{geo_tail}")[:220])

    if not lines:
        lines.append("No viewports on sheet.")

    return lines


def _viewport_export_correlation_segment_bytes(hint_row: dict[str, Any]) -> bytes:
    crop = str(hint_row.get("crop") or "")
    plan_s = str(hint_row.get("planProjectionSegment") or "")
    sec_s = str(hint_row.get("sectionDocumentationSegment") or "")
    sch_s = str(hint_row.get("scheduleDocumentationSegment") or "")
    return f"{crop}\n{plan_s}\n{sec_s}\n{sch_s}".encode()


def build_sheet_print_raster_print_contract_v3(
    doc: Document, sh: SheetElem, svg_text: str, png_bytes: bytes
) -> dict[str, Any]:
    """Deterministic surrogate print-raster correlation metadata (+ explicit validation checks)."""

    svg_sha = sheet_svg_utf8_sha256(svg_text)
    png_sha = hashlib.sha256(png_bytes).hexdigest()

    hints = viewport_evidence_hints_v1(doc, list(sh.viewports_mm or []))
    viewport_segment_correlation = [
        {
            "viewportId": str(row.get("viewportId") or ""),
            "segmentCorrelationDigestSha256": hashlib.sha256(
                _viewport_export_correlation_segment_bytes(row)
            ).hexdigest(),
        }
        for row in hints
    ]

    ordered_rects = sheet_viewport_stamp_rects_mm_ordered(sh)
    layout_bands_mm = [
        {"viewportId": vid, "xMm": x_mm, "yMm": y_mm, "widthMm": w_mm, "heightMm": h_mm}
        for vid, x_mm, y_mm, w_mm, h_mm in ordered_rects
    ]

    listing_blob = "\n".join(sheet_viewport_export_listing_lines(doc, sh)).encode("utf-8")
    pdf_list_digest = hashlib.sha256(listing_blob).hexdigest()

    tb_digest = hashlib.sha256(_titleblock_surrogate_payload_bytes(sh)).hexdigest()

    pw = float(sh.paper_width_mm or 42_000.0)
    ph = float(sh.paper_height_mm or 29_700.0)
    paper_key = f"{int(round(pw))}x{int(round(ph))}mm"

    expected_png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg_text)
    ihdr = png_ihdr_wh_bit_depth_color_type(png_bytes)

    checks: list[dict[str, Any]] = []
    ihdr_ok = ihdr is not None
    checks.append({"id": "png_ihdr_wh", "ok": ihdr_ok})
    wh_ok = False
    rgb_ok = False
    if ihdr:
        w_px, h_px, bd, ct = ihdr
        wh_ok = w_px == SHEET_PRINT_RASTER_STAMP_WIDTH_PX and h_px == SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX
        rgb_ok = bd == 8 and ct == 2
    checks.append({"id": "png_wh_surrogate_v2", "ok": wh_ok})
    checks.append({"id": "png_rgb8", "ok": rgb_ok})
    checks.append({"id": "png_sha256", "ok": True})
    surrogate_ok = png_bytes == expected_png
    checks.append({"id": "surrogate_png_bytes_match_v2", "ok": surrogate_ok})
    checks.append({"id": "segments_recomputed", "ok": True})

    valid = bool(all(bool(c.get("ok")) for c in checks))

    return {
        "format": SHEET_PRINT_RASTER_PRINT_CONTRACT_V3_FORMAT,
        "artifactName": "sheet-print-raster.png",
        "surrogateVersion": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
        "widthPx": SHEET_PRINT_RASTER_STAMP_WIDTH_PX,
        "heightPx": SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX,
        "colorMode": "rgb8",
        "paperWidthMm": pw,
        "paperHeightMm": ph,
        "paperSizeKey": paper_key,
        "titleblockSymbol": "title_block",
        "titleblockParameterDigestSha256": tb_digest,
        "layoutBandsMm": layout_bands_mm,
        "viewportSegmentCorrelation": viewport_segment_correlation,
        "pdfListingSegmentsDigestSha256": pdf_list_digest,
        "svgContentSha256": svg_sha,
        "pngByteSha256": png_sha,
        "checks": checks,
        "valid": valid,
    }


def validate_sheet_print_raster_print_contract_v3(
    contract: dict[str, Any],
    png_bytes: bytes,
    doc: Document,
    sh: SheetElem,
    svg_text: str,
) -> tuple[bool, list[str]]:
    """Rebuild the contract from inputs and verify digests + segments match."""

    errors: list[str] = []

    if str(contract.get("format") or "") != SHEET_PRINT_RASTER_PRINT_CONTRACT_V3_FORMAT:
        errors.append("contract_format_invalid")

    act_png_sha = hashlib.sha256(png_bytes).hexdigest()
    if str(contract.get("pngByteSha256") or "") != act_png_sha:
        errors.append("png_byte_sha256_mismatch_actual_bytes")

    rebuilt = build_sheet_print_raster_print_contract_v3(doc, sh, svg_text, png_bytes)
    for field in (
        "svgContentSha256",
        "pngByteSha256",
        "titleblockParameterDigestSha256",
        "pdfListingSegmentsDigestSha256",
        "layoutBandsMm",
        "viewportSegmentCorrelation",
    ):
        if contract.get(field) != rebuilt.get(field):
            errors.append(f"field_mismatch:{field}")

    if not rebuilt.get("valid"):
        errors.append("rebuilt_contract_not_valid")

    return (len(errors) == 0, errors)


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

        sec_seg = ""
        if isinstance(vr, str):
            sec_seg = format_section_viewport_documentation_segment(doc, str(vr))
        doc_block = ""
        if sec_seg:
            esc_sec = html.escape(sec_seg)
            mh_match = re.search(r"\bmh=(\d+)\b", sec_seg)
            mh_attr = (
                f' data-section-doc-mh="{mh_match.group(1)}"' if mh_match is not None else ""
            )
            doc_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 2200}" '
                f'data-section-doc-token="sectionDocumentationSegment"{mh_attr} '
                f'fill="#5b21b6" font-size="280px">{esc_sec}</text>'
            )

        proj_seg = format_sheet_plan_viewport_projection_segment(doc, vp)
        proj_block = ""
        if proj_seg:
            esc_proj = html.escape(proj_seg)
            proj_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 2600}" '
                f'fill="#b45309" font-size="280px">{esc_proj}</text>'
            )

        sch_seg_svg = format_schedule_viewport_documentation_segment(doc, str(vr)) if isinstance(vr, str) else ""
        sch_block = ""
        if sch_seg_svg:
            esc_sch = html.escape(sch_seg_svg)
            sch_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 3000}" '
                f'data-schedule-doc-token="scheduleDocumentationSegment" '
                f'fill="#15803d" font-size="280px">{esc_sch}</text>'
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
            f"{doc_block}"
            f"{proj_block}"
            f"{sch_block}"
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
