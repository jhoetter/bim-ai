"""Sheet SVG / PDF listing correlation for revision/issue segments (Prompt 4)."""

from __future__ import annotations

import hashlib

from bim_ai.document import Document
from bim_ai.elements import SheetElem
from bim_ai.sheet_preview_svg import (
    build_sheet_print_raster_print_contract_v3,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_viewport_export_listing_lines,
)


def _minimal_sheet(**kwargs: object) -> SheetElem:
    return SheetElem(kind="sheet", id="sx", name="Sx", **kwargs)  # type: ignore[arg-type]


def test_sheet_svg_contains_revision_issue_doc_token_when_set() -> None:
    doc = Document(
        revision=1,
        elements={
            "sx": _minimal_sheet(
                titleblockParameters={
                    "revisionCode": "C",
                    "revisionDescription": "x",
                },
            ),
        },
    )
    sh = doc.elements["sx"]
    assert isinstance(sh, SheetElem)
    svg = sheet_elem_to_svg(doc, sh)
    assert 'data-sheet-revision-iss-doc-token="sheetRevIssDoc"' in svg
    assert "sheetRevIssDoc[" in svg


def test_sheet_viewport_export_listing_prepends_revision_line() -> None:
    doc = Document(
        revision=1,
        elements={
            "sx": _minimal_sheet(
                viewportsMm=[
                    {
                        "viewportId": "v1",
                        "viewRef": "",
                        "label": "L1",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 10,
                        "heightMm": 10,
                    },
                ],
                titleblockParameters={"revisionId": "R9"},
            ),
        },
    )
    sh = doc.elements["sx"]
    assert isinstance(sh, SheetElem)
    lines = sheet_viewport_export_listing_lines(doc, sh)
    assert lines[0].startswith("sheetRevIssList[")
    assert lines[1].startswith("L1")


def test_print_contract_listing_digest_depends_on_revision_metadata() -> None:
    doc = Document(revision=1, elements={})
    base = _minimal_sheet()
    sh_a = base.model_copy(
        update={
            "titleblock_parameters": {"revisionCode": "A"},
        }
    )
    sh_b = base.model_copy(
        update={
            "titleblock_parameters": {"revisionCode": "B"},
        }
    )
    svg_a = sheet_elem_to_svg(doc, sh_a)
    svg_b = sheet_elem_to_svg(doc, sh_b)
    png_a = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh_a, svg_a)
    png_b = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh_b, svg_b)
    c_a = build_sheet_print_raster_print_contract_v3(doc, sh_a, svg_a, png_a)
    c_b = build_sheet_print_raster_print_contract_v3(doc, sh_b, svg_b, png_b)
    assert c_a["pdfListingSegmentsDigestSha256"] != c_b["pdfListingSegmentsDigestSha256"]
    blob_a = "\n".join(sheet_viewport_export_listing_lines(doc, sh_a)).encode("utf-8")
    blob_b = "\n".join(sheet_viewport_export_listing_lines(doc, sh_b)).encode("utf-8")
    assert hashlib.sha256(blob_a).hexdigest() == c_a["pdfListingSegmentsDigestSha256"]
    assert hashlib.sha256(blob_b).hexdigest() == c_b["pdfListingSegmentsDigestSha256"]
