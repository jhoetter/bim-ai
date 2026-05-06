"""Minimal PDF companion to sheet_preview_svg — one-page placemark."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdf_canvas

from bim_ai.document import Document
from bim_ai.elements import SheetElem
from bim_ai.sheet_preview_svg import sheet_viewport_export_listing_lines


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

    lines = sheet_viewport_export_listing_lines(doc, sh)

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
