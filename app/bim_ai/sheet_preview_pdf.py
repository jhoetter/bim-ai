"""Minimal PDF companion to sheet_preview_svg — one-page placemark."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdf_canvas

from bim_ai.document import Document
from bim_ai.elements import SheetElem
from bim_ai.sheet_preview_svg import resolve_view_ref_title


def sheet_elem_to_pdf_bytes(doc: Document, sh: SheetElem) -> bytes:
    buf = BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    pw, ph = A4

    margin = 40
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, ph - margin, str(sh.name or sh.id))
    c.setFont("Helvetica", 11)
    c.drawString(margin, ph - margin - 24, f"Titleblock {sh.title_block or '—'}")
    c.setDrawColor(0.15, 0.15, 0.15)

    c.setFont("Helvetica", 9)
    tb_p = sh.titleblock_parameters or {}
    line_y = margin + 50
    for key in ("sheetNumber", "revision", "projectName", "drawnBy", "checkedBy", "issueDate"):
        val = str(tb_p.get(key) or "").strip()
        if not val:
            continue
        c.drawRightString(pw - margin, line_y, f"{key}: {val}"[:120])
        line_y += 13

    # Deterministic placemarker grid echoed from SVG extents (normalized for evidence).
    c.line(margin, margin + 220, pw - margin, margin + 220)

    y = ph - margin - 52

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

        lines.append(f"{label}{suffix}")

    if not lines:

        lines.append("No viewports on sheet.")

    for ln in lines:

        c.drawString(margin, y, str(ln)[:120])

        y -= 14

        if y < margin:

            break

    meta = getattr(sh, "id", "")

    if meta:

        c.setFont("Helvetica", 8)

        c.drawString(margin, margin / 2, f"Semantic sheet element {meta}")

    c.showPage()

    c.save()

    buf.seek(0)

    return buf.read()
