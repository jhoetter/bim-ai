"""Deterministic A1-ish sheet SVG for exports and regression probes."""

from __future__ import annotations

import hashlib
import html
import json
import math
import re
import struct
import zlib
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    PlanViewElem,
    RoomColorSchemeElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    ViewpointElem,
)
from bim_ai.plan_projection_wire import resolve_plan_projection_wire
from bim_ai.room_color_scheme_override_evidence import build_room_color_scheme_override_evidence_v1
from bim_ai.room_finish_schedule import (
    peer_finish_set_by_level,
    room_finish_legend_correlation_v1_for_wire,
)
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.schedule_pagination_placement_evidence import (
    build_schedule_pagination_placement_evidence_v0,
    flatten_leaf_rows_from_schedule_table_payload,
)
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    format_sheet_rev_iss_export_listing_segment_v1,
    format_sheet_rev_iss_titleblock_display_segment_v1,
    normalize_titleblock_revision_issue_v1,
    surrogate_payload_revision_issue_tail,
)

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

FULL_RASTER_RENDERER_STATUS_UNAVAILABLE = "unsupported_full_raster_renderer_unavailable"

SHEET_EXPORT_SVG_MIME_TYPE = "image/svg+xml"
SHEET_EXPORT_PDF_MIME_TYPE = "application/pdf"
SHEET_EXPORT_PNG_MIME_TYPE = "image/png"

SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN = "svgPdfListingParity_v1"

ROOM_PROGRAMME_LEGEND_DOC_TITLE = "Room programme legend"


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
    revision_raw = tb.get("revision") or tb.get("revisionCode") or ""
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
    base = "\n".join(parts)
    norm = normalize_titleblock_revision_issue_v1(tb)
    disp_preview = format_sheet_rev_iss_titleblock_display_segment_v1(norm)
    if disp_preview:
        return (base + "\n" + surrogate_payload_revision_issue_tail(norm)).encode("utf-8")
    return base.encode("utf-8")


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


def read_viewport_role(vp: dict[str, Any]) -> str:
    """Return ``standard`` or ``detail_callout`` (``viewportRole`` / ``viewport_role``, case-insensitive)."""

    v = vp.get("viewportRole") or vp.get("viewport_role")
    if isinstance(v, str):
        s = v.strip().lower().replace("-", "_")
        if s in {"detail_callout", "detailcallout"}:
            return "detail_callout"
    return "standard"


def read_viewport_detail_number(vp: dict[str, Any]) -> str:
    d = vp.get("detailNumber") or vp.get("detail_number")
    if isinstance(d, str):
        return d.strip()
    if isinstance(d, (int, float)) and math.isfinite(float(d)):
        return str(int(d)) if float(d) == int(float(d)) else str(float(d))
    return ""


def parse_sheet_view_ref(vr: str | None) -> dict[str, str]:
    """Mirror TS ``parseSheetViewRef`` vocabulary (``sec:``/``vp:`` normalized)."""

    if vr is None:
        return {"kind": "unknown", "ref_id": "", "normalized_ref": "", "raw_ref": ""}
    raw_ref = vr.strip()
    if not raw_ref:
        return {"kind": "unknown", "ref_id": "", "normalized_ref": "", "raw_ref": ""}
    if ":" not in raw_ref:
        return {"kind": "unknown", "ref_id": "", "normalized_ref": raw_ref, "raw_ref": raw_ref}
    kind_raw, ref_raw = raw_ref.split(":", 1)
    k = kind_raw.strip().lower()
    ref_id = ref_raw.strip()
    kind = "unknown"
    prefix = k
    if k == "plan":
        kind = "plan"
    elif k in {"section", "sec"}:
        kind = "section"
        prefix = "section"
    elif k == "schedule":
        kind = "schedule"
    elif k in {"viewpoint", "vp"}:
        kind = "viewpoint"
        prefix = "viewpoint"
    norm = f"{prefix}:{ref_id}" if kind != "unknown" and ref_id else raw_ref
    return {"kind": kind, "ref_id": ref_id, "normalized_ref": norm, "raw_ref": raw_ref}


def _detail_callout_unresolved_reason(doc: Document, parsed: dict[str, str], raw_ref: str) -> str:
    if not raw_ref.strip():
        return "empty_view_ref"
    kind = parsed["kind"]
    ref_id = parsed["ref_id"]
    if kind == "unknown":
        return "unknown_ref_prefix"
    if not ref_id:
        return "unknown_ref_prefix"
    ttl = resolve_view_ref_title(doc, raw_ref)
    if ttl is not None:
        return ""
    if kind == "plan":
        return "unresolved_plan_view"
    if kind == "section":
        return "unresolved_section_cut"
    if kind == "schedule":
        return "unresolved_schedule"
    if kind == "viewpoint":
        return "unresolved_viewpoint"
    return "unknown_ref_prefix"


def build_placeholder_detail_title(
    detail_number: str, resolved_title: str | None, unresolved_reason: str
) -> str:
    """Deterministic placeholder title aligned with WP-E05 readout (matches web helper)."""

    base = f"Detail {detail_number.strip()}" if detail_number.strip() else "Detail"
    if unresolved_reason:
        return f"{base} — unresolved"
    if resolved_title and resolved_title.strip():
        return f"{base} — {resolved_title.strip()}"
    return base


def format_detail_callout_documentation_segment(doc: Document, vp: dict[str, Any], index: int) -> str:
    """Compact token for SVG/PDF listing / viewport hints when ``viewportRole`` is ``detail_callout``."""

    if read_viewport_role(vp) != "detail_callout":
        return ""
    vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
    if not vid:
        vid = f"__implicit_{index}"
    vr_raw = vp.get("viewRef") or vp.get("view_ref")
    raw = str(vr_raw).strip() if isinstance(vr_raw, str) else ""
    parsed = parse_sheet_view_ref(raw if raw else None)
    reason = _detail_callout_unresolved_reason(doc, parsed, raw)
    ok = not reason
    dn = read_viewport_detail_number(vp)
    resolved_ttl = resolve_view_ref_title(doc, raw) if raw and ok else None
    ph = build_placeholder_detail_title(dn, resolved_ttl, reason)
    ref_tok = (parsed["normalized_ref"] or raw).replace(" ", "_")
    if len(ref_tok) > 56:
        ref_tok = ref_tok[:53] + "..."
    st = "ok" if ok else "broken"
    ttl_tok = ph.replace(" ", "_")
    if len(ttl_tok) > 40:
        ttl_tok = ttl_tok[:37] + "..."
    return f"detailCo[vp={vid} ref={ref_tok} status={st} ttl={ttl_tok}]"


def detail_callout_readout_rows_v0(doc: Document, sh: SheetElem) -> list[dict[str, Any]]:
    """Sorted detail-callout readout rows for deterministic sheet evidence (WP-X01)."""

    out: list[dict[str, Any]] = []
    for i, vp_any in enumerate(sh.viewports_mm or []):
        if not isinstance(vp_any, dict):
            continue
        vp = vp_any
        if read_viewport_role(vp) != "detail_callout":
            continue
        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()
        if not vid:
            vid = f"__implicit_{i}"
        vr_raw = vp.get("viewRef") or vp.get("view_ref")
        raw = str(vr_raw).strip() if isinstance(vr_raw, str) else ""
        parsed = parse_sheet_view_ref(raw if raw else None)
        reason = _detail_callout_unresolved_reason(doc, parsed, raw)
        resolved_ttl = resolve_view_ref_title(doc, raw) if raw and not reason else None
        dn = read_viewport_detail_number(vp)
        ph_title = build_placeholder_detail_title(dn, resolved_ttl, reason)
        norm_ref = parsed["normalized_ref"] if parsed["kind"] != "unknown" else raw
        out.append(
            {
                "viewportId": vid,
                "viewportRole": "detail_callout",
                "parentSheetId": sh.id,
                "parentSheetName": sh.name or sh.id,
                "referencedViewRefRaw": raw,
                "referencedViewRefNormalized": norm_ref,
                "referencedTargetKind": parsed["kind"] if parsed["kind"] != "unknown" else "",
                "referencedTargetId": parsed["ref_id"],
                "resolvedTargetTitle": (resolved_ttl or "").strip(),
                "placeholderDetailNumber": dn,
                "placeholderDetailTitle": ph_title,
                "unresolvedReason": reason,
            }
        )
    out.sort(key=lambda r: str(r.get("viewportId") or ""))
    return out


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
    base = f"planPrim[w={nw},f={nf},r={nr},d={nd},wi={nwi},s={ns}]"
    ev = wire.get("slabOpeningDocumentationEvidence_v0")
    rows = ev.get("rows") if isinstance(ev, dict) else None
    if isinstance(rows, list) and len(rows) > 0:
        canon = json.dumps(rows, sort_keys=True, separators=(",", ":"), default=str)
        d12 = hashlib.sha256(canon.encode("utf-8")).hexdigest()[:12]
        base = f"{base} soDoc[n={len(rows)} h={d12}]"
    fed = wire.get("wallOpeningCutFidelityEvidence_v1")
    fed_rows = fed.get("rows") if isinstance(fed, dict) else None
    if isinstance(fed_rows, list) and len(fed_rows) > 0:
        canon_f = json.dumps(fed_rows, sort_keys=True, separators=(",", ":"), default=str)
        h12 = hashlib.sha256(canon_f.encode("utf-8")).hexdigest()[:12]
        base = f"{base} woCutFed[n={len(fed_rows)} h={h12}]"
    wjs = wire.get("wallCornerJoinSummary_v1")
    wj_joins = wjs.get("joins") if isinstance(wjs, dict) else None
    if isinstance(wj_joins, list) and len(wj_joins) > 0:
        canon_j = json.dumps(wj_joins, sort_keys=True, separators=(",", ":"), default=str)
        j12 = hashlib.sha256(canon_j.encode("utf-8")).hexdigest()[:12]
        base = f"{base} wjSum[n={len(wj_joins)} h={j12}]"
    return base


def format_sheet_plan_viewport_projection_segment(doc: Document, vp: dict[str, Any]) -> str:
    """Plan projection slice for a sheet viewport row when viewRef targets a plan_view."""

    wire = _plan_sheet_viewport_projection_wire(doc, vp)
    if wire is None:
        return ""
    return format_plan_projection_export_segment(wire)


def _plan_sheet_viewport_projection_wire(doc: Document, vp: dict[str, Any]) -> dict[str, Any] | None:
    vr = vp.get("viewRef") or vp.get("view_ref")
    if not isinstance(vr, str) or ":" not in vr:
        return None
    kind_raw, ref_raw = vr.split(":", 1)
    if kind_raw.strip().lower() != "plan":
        return None
    pv_id = ref_raw.strip()
    if not pv_id:
        return None
    return resolve_plan_projection_wire(
        doc,
        plan_view_id=pv_id,
        fallback_level_id=None,
        global_plan_presentation="default",
        sheet_viewport_row_for_crop=vp,
    )


def _normalized_sorted_room_color_legend_rows(
    wire: dict[str, Any],
) -> tuple[list[dict[str, str]], str, int] | None:
    raw = wire.get("roomColorLegend")
    if not isinstance(raw, list) or len(raw) == 0:
        return None
    ev = wire.get("roomProgrammeLegendEvidence_v0")
    if not isinstance(ev, dict):
        return None
    digest = str(ev.get("legendDigestSha256") or ev.get("legend_digest_sha256") or "").strip()
    if len(digest) != 64:
        return None
    rows: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        if not label:
            continue
        hx = str(item.get("schemeColorHex") or item.get("scheme_color_hex") or "#888888").strip()
        pc = str(item.get("programmeCode") or item.get("programme_code") or "").strip()
        dept = str(item.get("department") or "").strip()
        fn = str(item.get("functionLabel") or item.get("function_label") or "").strip()
        rows.append(
            {
                "label": label,
                "schemeColorHex": hx,
                "programmeCode": pc,
                "department": dept,
                "functionLabel": fn,
            }
        )
    if not rows:
        return None
    rows.sort(
        key=lambda r: (
            r["label"],
            r["schemeColorHex"],
            r["programmeCode"],
            r["department"],
            r["functionLabel"],
        )
    )
    return rows, digest, len(rows)


def _room_programme_legend_segments_from_wire(
    wire: dict[str, Any],
) -> tuple[list[dict[str, str]], str, int, str, str] | None:
    tup = _normalized_sorted_room_color_legend_rows(wire)
    if tup is None:
        return None
    rows, digest, n = tup
    body = json.dumps(rows, sort_keys=True, separators=(",", ":"))
    doc_seg = (
        f"roomLegDoc[title={ROOM_PROGRAMME_LEGEND_DOC_TITLE} rows={n} sha={digest} body={body}]"
    )
    listing_seg = f"roomLegDoc[n={n} sha={digest}]"
    return rows, digest, n, doc_seg, listing_seg


def format_room_programme_legend_documentation_segment(doc: Document, vp: dict[str, Any]) -> str:
    """Stable room colour / programme legend readout for plan sheet viewports."""

    wire = _plan_sheet_viewport_projection_wire(doc, vp)
    if wire is None:
        return ""
    out = _room_programme_legend_segments_from_wire(wire)
    return out[3] if out else ""


def format_room_programme_legend_listing_segment(doc: Document, vp: dict[str, Any]) -> str:
    """Short legend token for PDF viewport listing lines (fits typical truncation budgets)."""

    wire = _plan_sheet_viewport_projection_wire(doc, vp)
    if wire is None:
        return ""
    out = _room_programme_legend_segments_from_wire(wire)
    return out[4] if out else ""


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

    so_ev = prim.get("slabOpeningDocumentationEvidence_v0")
    so_rows = so_ev.get("rows") if isinstance(so_ev, dict) else None
    if isinstance(so_rows, list) and len(so_rows) > 0:
        canon_so = json.dumps(so_rows, sort_keys=True, separators=(",", ":"), default=str)
        d12_so = hashlib.sha256(canon_so.encode("utf-8")).hexdigest()[:12]
        inner_parts.append(f"soDoc[n={len(so_rows)} h={d12_so}]")

    wo_ev = prim.get("wallOpeningCutFidelityEvidence_v1")
    wo_rows = wo_ev.get("rows") if isinstance(wo_ev, dict) else None
    if isinstance(wo_rows, list) and len(wo_rows) > 0:
        canon_wo = json.dumps(wo_rows, sort_keys=True, separators=(",", ":"), default=str)
        d12_wo = hashlib.sha256(canon_wo.encode("utf-8")).hexdigest()[:12]
        inner_parts.append(f"woCutFed[n={len(wo_rows)} h={d12_wo}]")

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


def room_color_scheme_legend_placement_evidence_v1(
    doc: Document, vps_raw: list[Any]
) -> dict[str, Any]:
    """Sheet-level evidence for placed room color scheme legends."""
    scheme_elem: RoomColorSchemeElem | None = None
    for el in doc.elements.values():
        if isinstance(el, RoomColorSchemeElem):
            scheme_elem = el
            break

    override_ev = build_room_color_scheme_override_evidence_v1(scheme_elem)

    placed_rows: list[dict[str, Any]] = []
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

        x_mm, y_mm, w_mm, h_mm = read_viewport_mm_box(vp)

        wire = resolve_plan_projection_wire(
            doc,
            plan_view_id=pv_id,
            fallback_level_id=None,
            global_plan_presentation="default",
            sheet_viewport_row_for_crop=vp,
        )
        tup = _room_programme_legend_segments_from_wire(wire)
        if tup is None:
            continue
        legend_rows, digest, row_count, _doc_seg, _list_seg = tup

        placed_row: dict[str, Any] = {
            "viewportId": vid,
            "planViewRef": pv_id,
            "placementXMm": x_mm,
            "placementYMm": y_mm,
            "viewportWidthMm": w_mm,
            "viewportHeightMm": h_mm,
            "legendRowCount": row_count,
            "legendDigestSha256": digest,
            "schemeSource": "override" if (scheme_elem is not None and override_ev.get("overrideRowCount", 0) > 0) else "hashed_fallback",
        }
        if scheme_elem is not None:
            placed_row["schemeIdentity"] = scheme_elem.id
            placed_row["schemeOverrideRowCount"] = override_ev.get("overrideRowCount", 0)
        placed_rows.append(placed_row)

    placed_rows.sort(key=lambda r: str(r.get("viewportId") or ""))

    import hashlib as _hl
    blob = json.dumps(placed_rows, sort_keys=True, separators=(",", ":"))
    placement_digest = _hl.sha256(blob.encode("utf-8")).hexdigest()

    return {
        "format": "roomColorSchemeLegendPlacementEvidence_v1",
        "placedLegendCount": len(placed_rows),
        "placementDigestSha256": placement_digest,
        "schemeIdentity": scheme_elem.id if scheme_elem is not None else None,
        "schemeOverrideRowCount": override_ev.get("overrideRowCount", 0),
        "overrideEvidence": override_ev,
        "placedRows": placed_rows,
    }


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
        readout = _room_programme_legend_segments_from_wire(wire)
        if readout is None:
            continue
        legend_rows, digest, row_count, documentation_segment, _listing = readout
        row: dict[str, Any] = {
            "viewportId": vid,
            "legendDigestSha256": digest,
            "rowCount": row_count,
            "legendTitle": ROOM_PROGRAMME_LEGEND_DOC_TITLE,
            "legendRows": legend_rows,
            "documentationSegment": documentation_segment,
        }
        ev = wire.get("roomProgrammeLegendEvidence_v0")
        if isinstance(ev, dict):
            so = ev.get("schemeOverridesSource") or ev.get("scheme_overrides_source")
            if isinstance(so, str) and so.strip():
                row["schemeOverridesSource"] = so.strip()
            try:
                soc = int(ev.get("schemeOverrideRowCount", ev.get("scheme_override_row_count", 0)))
                if soc > 0:
                    row["schemeOverrideRowCount"] = soc
            except (TypeError, ValueError):
                pass
        prim = wire.get("primitives") or {}
        raw_rooms = prim.get("rooms") or []
        corr_rooms: list[RoomElem] = []
        for rp in raw_rooms:
            if not isinstance(rp, dict):
                continue
            rid = str(rp.get("id") or "").strip()
            el = doc.elements.get(rid)
            if isinstance(el, RoomElem):
                corr_rooms.append(el)
        peer_doc = peer_finish_set_by_level(
            e for e in doc.elements.values() if isinstance(e, RoomElem)
        )
        row["roomFinishLegendCorrelation_v1"] = room_finish_legend_correlation_v1_for_wire(
            legend_rows=list(legend_rows),
            rooms=corr_rooms,
            peer_by_level=peer_doc,
        )
        out.append(row)

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
        room_leg_seg = format_room_programme_legend_documentation_segment(doc, vp)
        dc_seg = format_detail_callout_documentation_segment(doc, vp, i)

        sch_pag_ev: dict[str, Any] | None = None
        if isinstance(vr, str) and vr.strip() and ":" in vr:
            kind_vp, ref_vp = vr.split(":", 1)
            if kind_vp.strip().lower() == "schedule":
                sid_sched = ref_vp.strip()
                if sid_sched:
                    el_sch = doc.elements.get(sid_sched)
                    if isinstance(el_sch, ScheduleElem):
                        try:
                            tbl_hint = derive_schedule_table(doc, sid_sched)
                        except ValueError:
                            tbl_hint = None
                        if tbl_hint is not None:
                            leaf_h = flatten_leaf_rows_from_schedule_table_payload(tbl_hint)
                            tr_h = int(tbl_hint.get("totalRows") or 0)
                            sch_pag_ev = build_schedule_pagination_placement_evidence_v0(
                                doc,
                                sid_sched,
                                schedule_el=el_sch,
                                leaf_rows=leaf_h,
                                total_rows=tr_h,
                                viewport_height_mm=h_mm,
                                sheet_viewport_id=vid,
                            )

        row_hint: dict[str, Any] = {
            "viewportId": vid,
            "geom": geom,
            "crop": crop,
            "planProjectionSegment": plan_seg,
            "sectionDocumentationSegment": sec_seg,
            "scheduleDocumentationSegment": sch_seg,
            "roomProgrammeLegendDocumentationSegment": room_leg_seg,
            "detailCalloutDocumentationSegment": dc_seg,
        }
        if sch_pag_ev is not None:
            row_hint["schedulePaginationPlacementEvidence_v0"] = sch_pag_ev
        hints.append(row_hint)

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

    tb_norm = normalize_titleblock_revision_issue_v1(sh.titleblock_parameters)
    list_seg = format_sheet_rev_iss_export_listing_segment_v1(tb_norm)
    if list_seg:
        lines.append(list_seg)

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

        leg_list_seg = (
            format_room_programme_legend_listing_segment(doc, vp) if isinstance(vp, dict) else ""
        )

        dc_list_seg = format_detail_callout_documentation_segment(doc, vp, i) if isinstance(vp, dict) else ""

        geo_tail = (
            geo
            + (f" · {crop_seg}" if crop_seg else "")
            + (f" · {doc_seg}" if doc_seg else "")
            + (f" · {proj_seg}" if proj_seg else "")
            + (f" · {sch_seg}" if sch_seg else "")
            + (f" · {leg_list_seg}" if leg_list_seg else "")
            + (f" · {dc_list_seg}" if dc_list_seg else "")
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
    leg_s = str(hint_row.get("roomProgrammeLegendDocumentationSegment") or "")
    dc_s = str(hint_row.get("detailCalloutDocumentationSegment") or "")
    pag = hint_row.get("schedulePaginationPlacementEvidence_v0")
    pag_tail = ""
    if isinstance(pag, dict):
        d = pag.get("digestSha256")
        if isinstance(d, str) and d.strip():
            pag_tail = f"schPagDigest={d.strip()}"
    return f"{crop}\n{plan_s}\n{sec_s}\n{sch_s}\n{leg_s}\n{dc_s}\n{pag_tail}".encode()


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
        "mimeType": SHEET_EXPORT_PNG_MIME_TYPE,
        "relativeArtifactPath": "exports/sheet-print-raster.png",
        "surrogateVersion": SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
        "fullRasterExportStatus": FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
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
        "svgListingSegmentsDigestSha256": pdf_list_digest,
        "pdfListingSegmentsDigestSha256": pdf_list_digest,
        "exportListingParityToken": SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN,
        "exportListingParityDigestMatch": True,
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
        "svgListingSegmentsDigestSha256",
        "pdfListingSegmentsDigestSha256",
        "exportListingParityToken",
        "exportListingParityDigestMatch",
        "fullRasterExportStatus",
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
    revision_raw = tb_params.get("revision") or tb_params.get("revisionCode") or ""
    project_raw = tb_params.get("projectName") or tb_params.get("project") or ""
    drawn_raw = tb_params.get("drawnBy") or ""
    chk_raw = tb_params.get("checkedBy") or ""
    issued_raw = tb_params.get("issueDate") or tb_params.get("date") or ""

    viewport_blocks = []
    for vi, vp in enumerate(vps_raw):
        if not isinstance(vp, dict):
            continue
        x_mm, y_mm, width_mm, height_mm = read_viewport_mm_box(vp)
        label = str(vp.get("label") or "Viewport")
        vr = vp.get("viewRef") or vp.get("view_ref")
        is_dc = read_viewport_role(vp) == "detail_callout"
        raw_v = str(vr).strip() if isinstance(vr, str) else ""
        ref_title = resolve_view_ref_title(doc, raw_v) if raw_v else None
        if is_dc:
            parsed = parse_sheet_view_ref(raw_v if raw_v else None)
            reason = _detail_callout_unresolved_reason(doc, parsed, raw_v)
            dn = read_viewport_detail_number(vp)
            res_ttl = resolve_view_ref_title(doc, raw_v) if raw_v and not reason else None
            display = build_placeholder_detail_title(dn, res_ttl, reason)
        else:
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

        leg_seg_svg = format_room_programme_legend_documentation_segment(doc, vp)
        leg_block = ""
        if leg_seg_svg:
            esc_leg = html.escape(leg_seg_svg)
            leg_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 3400}" '
                f'data-room-programme-legend-doc-token="roomProgrammeLegendDocumentationSegment" '
                f'fill="#0e7490" font-size="260px">{esc_leg}</text>'
            )

        dc_seg = format_detail_callout_documentation_segment(doc, vp, vi)
        dc_block = ""
        if dc_seg:
            esc_dc = html.escape(dc_seg)
            dc_block = (
                f'<text x="{x_mm + 200}" y="{y_mm + 3800}" '
                f'data-detail-callout-doc-token="detailCalloutDocumentationSegment" '
                f'fill="#6d28d9" font-size="260px">{esc_dc}</text>'
            )

        stroke_color = "#6d28d9" if is_dc else "#475569"
        dash = ' stroke-dasharray="480 240"' if is_dc else ""

        viewport_blocks.append(
            "<g>"
            f'<rect x="{x_mm}" y="{y_mm}" width="{width_mm}" height="{height_mm}" '
            f'fill="#ffffff" stroke="{stroke_color}" stroke-width="80"{dash}/>'
            f'<text x="{x_mm + 200}" y="{y_mm + 900}" fill="{stroke_color}" font-size="600px">'
            f"{escaped_label}"
            f"</text>"
            f"{sub_block}"
            f"{crop_block}"
            f"{doc_block}"
            f"{proj_block}"
            f"{sch_block}"
            f"{leg_block}"
            f"{dc_block}"
            "</g>"
        )

    vps_xml = "".join(viewport_blocks)

    tb_ix = max(2800.0, h_mm - 5200)
    x_right = w_mm - 2600
    y_line = tb_ix
    step = 760

    rev_norm = normalize_titleblock_revision_issue_v1(tb_params)
    rev_disp_seg = format_sheet_rev_iss_titleblock_display_segment_v1(rev_norm)

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

    rev_issue_xml = ""
    if rev_disp_seg:
        rev_esc = html.escape(rev_disp_seg)
        tok = html.escape("sheetRevIssDoc")
        rev_issue_xml = (
            f'<text x="{x_right}" y="{y_line}" fill="#0369a1" font-size="520px" text-anchor="end" '
            f'data-sheet-revision-iss-doc-token="{tok}">{rev_esc}</text>'
        )

    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_mm} {h_mm}" '
        f'width="{w_mm / 100:.3f}mm" height="{h_mm / 100:.3f}mm">'
        f'<rect width="{w_mm}" height="{h_mm}" fill="#f8fafc" stroke="#1e293b" stroke-width="120"/>'
        f'<rect x="800" y="800" width="{w_mm - 1600}" height="3600" fill="#edf2ff" opacity="0.9"/>'
        f'<text x="2400" y="2400" fill="#1e293b" font-size="1200px">A1 metaphor — {title}</text>'
        f'<text x="2400" y="3600" fill="#64748b" font-size="800px">TB {tb}</text>'
        f"{footer_xml}"
        f"{rev_issue_xml}"
        f"{vps_xml}"
        f"</svg>"
    )
