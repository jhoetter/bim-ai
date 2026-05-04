"""Minimal PDF companion to sheet_preview_svg — one-page placemark."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdf_canvas

from bim_ai.elements import SheetElem


def sheet_elem_to_pdf_bytes(sh: SheetElem) -> bytes:
    buf = BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    pw, ph = A4

    margin = 40
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, ph - margin, str(sh.name or sh.id))
    c.setFont("Helvetica", 11)
    c.drawString(margin, ph - margin - 24, f"Titleblock {sh.title_block or '—'}")

    c.setFont("Helvetica", 9)
    y = ph - margin - 52

    lines = []

    raw_vps = sh.viewports_mm or []

    for i, vp in enumerate(raw_vps):
        if not isinstance(vp, dict):
            continue
        label = vp.get("label") or vp.get("Label") or f"Viewport {i + 1}"
        ref = vp.get("viewRef") or vp.get("view_ref") or ""
        suffix = f" · {ref}" if ref else ""
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
