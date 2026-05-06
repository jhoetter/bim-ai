from __future__ import annotations

import hashlib
import struct
import zlib

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, SectionCutElem, SheetElem
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_EXPORT_PDF_MIME_TYPE,
    SHEET_EXPORT_PNG_MIME_TYPE,
    SHEET_EXPORT_SVG_MIME_TYPE,
    SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN,
    SHEET_PRINT_RASTER_LAYOUT_STAMP_CONTRACT_V1,
    SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1,
    SHEET_PRINT_RASTER_PRINT_CONTRACT_V3_FORMAT,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    SHEET_PRINT_RASTER_STAMP_HEIGHT_PX,
    SHEET_PRINT_RASTER_STAMP_WIDTH_PX,
    SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX,
    build_sheet_print_raster_print_contract_v3,
    png_ihdr_wh_bit_depth_color_type,
    sheet_elem_to_svg,
    sheet_print_raster_layout_stamp_png_bytes_v1,
    sheet_print_raster_placeholder_png_bytes_v1,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_svg_utf8_sha256,
    validate_sheet_print_raster_print_contract_v3,
    viewport_evidence_hints_v1,
)


def test_sheet_print_raster_placeholder_deterministic_per_svg() -> None:
    a = sheet_print_raster_placeholder_png_bytes_v1("<svg/>")
    b = sheet_print_raster_placeholder_png_bytes_v1("<svg/>")
    c = sheet_print_raster_placeholder_png_bytes_v1("<svg></svg>")
    assert a == b
    assert a != c
    assert a.startswith(b"\x89PNG\r\n\x1a\n")
    assert hashlib.sha256(a).hexdigest() == hashlib.sha256(b).hexdigest()


def test_sheet_svg_utf8_sha256_stable() -> None:
    assert sheet_svg_utf8_sha256("x") == hashlib.sha256(b"x").hexdigest()


def test_placeholder_contract_constant() -> None:
    assert SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1 == "sheetPrintRasterPlaceholder_v1"


def _png_ihdr_wh(png: bytes) -> tuple[int, int]:
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    ihdr_pos = png.find(b"IHDR")
    assert ihdr_pos >= 0
    off = ihdr_pos + 4
    return struct.unpack("!II", png[off : off + 8])


def test_layout_stamp_png_shape_and_determinism() -> None:
    sh = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        viewportsMm=[
            {"viewportId": "a", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000},
        ],
    )
    doc = Document(revision=1, elements={"s1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    p1 = sheet_print_raster_layout_stamp_png_bytes_v1(doc, sh, svg)
    p2 = sheet_print_raster_layout_stamp_png_bytes_v1(doc, sh, svg)
    assert p1 == p2
    w, h = _png_ihdr_wh(p1)
    assert w == SHEET_PRINT_RASTER_STAMP_WIDTH_PX and h == SHEET_PRINT_RASTER_STAMP_HEIGHT_PX


def test_layout_stamp_changes_when_viewport_geometry_changes() -> None:
    sh1 = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        viewportsMm=[{"viewportId": "a", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}],
    )
    sh2 = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        viewportsMm=[{"viewportId": "a", "xMm": 100, "yMm": 0, "widthMm": 1000, "heightMm": 1000}],
    )
    doc = Document(revision=1, elements={"s1": sh1})
    svg1 = sheet_elem_to_svg(doc, sh1)
    svg2 = sheet_elem_to_svg(doc, sh2)
    assert sheet_print_raster_layout_stamp_png_bytes_v1(
        doc, sh1, svg1
    ) != sheet_print_raster_layout_stamp_png_bytes_v1(doc, sh2, svg2)


def test_layout_stamp_contract_constant() -> None:
    assert SHEET_PRINT_RASTER_LAYOUT_STAMP_CONTRACT_V1 == "sheetPrintRasterLayoutStamp_v1"


def test_viewport_evidence_hints_v1_plan_and_section_segments() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl")
    sec = SectionCutElem(
        kind="section_cut",
        id="sec1",
        name="Cut",
        lineStartMm={"xMm": 0, "yMm": 0},
        lineEndMm={"xMm": 0, "yMm": 1000},
    )
    doc = Document(revision=1, elements={"lvl": lvl, "pv1": pv, "sec1": sec})

    hints = viewport_evidence_hints_v1(
        doc,
        [
            {
                "viewportId": "v",
                "viewRef": "plan:pv1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 1000,
                "heightMm": 1000,
            }
        ],
    )
    assert hints[0]["planProjectionSegment"].startswith("planPrim[")
    assert hints[0].get("roomProgrammeLegendDocumentationSegment") == ""
    hints2 = viewport_evidence_hints_v1(
        doc,
        [
            {
                "viewportId": "v2",
                "viewRef": "section:sec1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 1000,
                "heightMm": 1000,
            }
        ],
    )
    assert hints2[0]["sectionDocumentationSegment"].startswith("secDoc[")


def test_png_ihdr_reads_expected_wh_rgb8() -> None:
    png = sheet_print_raster_placeholder_png_bytes_v1("<svg/>")
    ihdr = png_ihdr_wh_bit_depth_color_type(png)
    assert ihdr == (1, 1, 8, 2)


def test_sheet_print_raster_print_contract_v3_segments_and_validation() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl")
    sec = SectionCutElem(
        kind="section_cut",
        id="sec1",
        name="Cut",
        lineStartMm={"xMm": 0, "yMm": 0},
        lineEndMm={"xMm": 0, "yMm": 1000},
    )
    sh = SheetElem(
        kind="sheet",
        id="s_plan_sec",
        name="S",
        titleBlock="TB",
        titleblockParameters={"revision": "B"},
        paperWidthMm=59400,
        paperHeightMm=42000,
        viewportsMm=[
            {
                "viewportId": "pv",
                "label": "Plan",
                "viewRef": "plan:pv1",
                "xMm": 100,
                "yMm": 50,
                "widthMm": 900,
                "heightMm": 700,
            },
            {
                "viewportId": "sx",
                "label": "Section",
                "viewRef": "section:sec1",
                "xMm": 1100,
                "yMm": 60,
                "widthMm": 800,
                "heightMm": 600,
            },
        ],
    )
    doc = Document(revision=8, elements={"lvl": lvl, "pv1": pv, "sec1": sec, "s_plan_sec": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    v3 = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)

    assert v3["format"] == SHEET_PRINT_RASTER_PRINT_CONTRACT_V3_FORMAT
    assert v3["surrogateVersion"] == SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
    assert v3["paperSizeKey"] == "59400x42000mm"
    assert len(v3["layoutBandsMm"]) == 2
    assert v3["layoutBandsMm"][0]["viewportId"] == "pv"
    corr = v3["viewportSegmentCorrelation"]
    assert len(corr) == 2
    by_id = {row["viewportId"]: row["segmentCorrelationDigestSha256"] for row in corr}
    assert by_id["pv"] != by_id["sx"]
    assert all(len(d) == 64 for d in by_id.values())
    assert len(v3["pdfListingSegmentsDigestSha256"]) == 64

    hints = viewport_evidence_hints_v1(doc, list(sh.viewports_mm or []))
    for row in hints:
        if row["viewportId"] == "pv":
            assert row["planProjectionSegment"]
    assert v3["valid"] is True

    ok, errs = validate_sheet_print_raster_print_contract_v3(v3, png, doc, sh, svg)
    assert ok and errs == []

    png_bad = bytearray(png)
    png_bad[-1] ^= 1
    bad_ok, bad_errs = validate_sheet_print_raster_print_contract_v3(
        v3, bytes(png_bad), doc, sh, svg
    )
    assert not bad_ok
    assert bad_errs

    forged = dict(v3)
    forged["pngByteSha256"] = "0" * 64
    forge_ok, forge_errs = validate_sheet_print_raster_print_contract_v3(forged, png, doc, sh, svg)
    assert not forge_ok
    assert any("png_byte_sha256" in e for e in forge_errs)


def _png_decompress_rgb_rows(png: bytes) -> tuple[int, int, list[bytes]]:
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    pos = 8
    width = height = 0
    idat: list[bytes] = []
    while pos + 8 <= len(png):
        ln = int.from_bytes(png[pos : pos + 4], "big")
        typ = png[pos + 4 : pos + 8]
        data = png[pos + 8 : pos + 8 + ln]
        pos += 12 + ln
        if typ == b"IHDR":
            width = int.from_bytes(data[0:4], "big")
            height = int.from_bytes(data[4:8], "big")
        elif typ == b"IDAT":
            idat.append(data)
        elif typ == b"IEND":
            break
    raw = zlib.decompress(b"".join(idat))
    stride = width * 3
    rows: list[bytes] = []
    i = 0
    for _ in range(height):
        ft = raw[i]
        i += 1
        assert ft == 0
        rows.append(bytes(raw[i : i + stride]))
        i += stride
    assert i == len(raw)
    return width, height, rows


def test_print_surrogate_v2_contract_constant() -> None:
    assert SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2 == "sheetPrintRasterPrintSurrogate_v2"


def test_print_surrogate_v2_shape_and_determinism() -> None:
    sh = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        viewportsMm=[
            {"viewportId": "a", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000},
        ],
    )
    doc = Document(revision=1, elements={"s1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    a = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    b = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    assert a == b
    w, h = _png_ihdr_wh(a)
    assert w == SHEET_PRINT_RASTER_STAMP_WIDTH_PX and h == SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX


def test_print_surrogate_v2_layout_rows_match_layout_stamp_v1() -> None:
    sh = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        titleBlock="TB",
        titleblockParameters={"revision": "A"},
        viewportsMm=[
            {"viewportId": "a", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000},
        ],
    )
    doc = Document(revision=1, elements={"s1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    v1 = sheet_print_raster_layout_stamp_png_bytes_v1(doc, sh, svg)
    v2 = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    _w1, _h1, rows1 = _png_decompress_rgb_rows(v1)
    _w2, h2, rows2 = _png_decompress_rgb_rows(v2)
    assert _w1 == _w2 == SHEET_PRINT_RASTER_STAMP_WIDTH_PX
    assert _h1 == SHEET_PRINT_RASTER_STAMP_HEIGHT_PX
    assert h2 == SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX
    assert rows1 == rows2[:SHEET_PRINT_RASTER_STAMP_HEIGHT_PX]


def test_print_surrogate_v2_titleblock_metadata_changes_png() -> None:
    base_vp = [{"viewportId": "a", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}]
    sh1 = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        titleBlock="TB",
        titleblockParameters={"revision": "A", "drawnBy": "x"},
        viewportsMm=base_vp,
    )
    sh2 = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        titleBlock="TB",
        titleblockParameters={"revision": "A", "drawnBy": "y"},
        viewportsMm=base_vp,
    )
    doc = Document(revision=1, elements={"s1": sh1})
    svg1 = sheet_elem_to_svg(doc, sh1)
    doc.elements["s1"] = sh2
    svg2 = sheet_elem_to_svg(doc, sh2)
    p1 = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh1, svg1)
    p2 = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh2, svg2)
    assert p1 != p2


def test_print_contract_v3_mime_type_and_artifact_path() -> None:
    sh = SheetElem(kind="sheet", id="s1", name="S")
    doc = Document(revision=1, elements={"s1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    c = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    assert c["mimeType"] == SHEET_EXPORT_PNG_MIME_TYPE
    assert c["mimeType"] == "image/png"
    assert c["relativeArtifactPath"] == "exports/sheet-print-raster.png"
    assert c["artifactName"] == "sheet-print-raster.png"


def test_print_contract_v3_full_raster_fallback_token() -> None:
    sh = SheetElem(kind="sheet", id="s1", name="S")
    doc = Document(revision=1, elements={"s1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    c = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    assert c["fullRasterExportStatus"] == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert c["fullRasterExportStatus"] == "unsupported_full_raster_renderer_unavailable"


def test_print_contract_v3_svg_pdf_listing_parity() -> None:
    sh = SheetElem(
        kind="sheet",
        id="s1",
        name="S",
        viewportsMm=[
            {"viewportId": "v1", "viewRef": "", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 100}
        ],
    )
    doc = Document(revision=1, elements={"s1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    c = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    assert c["svgListingSegmentsDigestSha256"] == c["pdfListingSegmentsDigestSha256"]
    assert len(c["svgListingSegmentsDigestSha256"]) == 64
    assert c["exportListingParityToken"] == SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN
    assert c["exportListingParityToken"] == "svgPdfListingParity_v1"
    assert c["exportListingParityDigestMatch"] is True


def test_print_contract_v3_mime_constants() -> None:
    assert SHEET_EXPORT_SVG_MIME_TYPE == "image/svg+xml"
    assert SHEET_EXPORT_PDF_MIME_TYPE == "application/pdf"
    assert SHEET_EXPORT_PNG_MIME_TYPE == "image/png"


def test_validate_contract_v3_checks_new_fields() -> None:
    sh = SheetElem(kind="sheet", id="sx", name="X")
    doc = Document(revision=1, elements={"sx": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    c = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    ok, errs = validate_sheet_print_raster_print_contract_v3(c, png, doc, sh, svg)
    assert ok and errs == []

    forged = dict(c)
    forged["fullRasterExportStatus"] = "some_other_status"
    bad_ok, bad_errs = validate_sheet_print_raster_print_contract_v3(forged, png, doc, sh, svg)
    assert not bad_ok
    assert any("fullRasterExportStatus" in e for e in bad_errs)
