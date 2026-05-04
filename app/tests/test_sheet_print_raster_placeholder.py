from __future__ import annotations

import hashlib
import struct
import zlib

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, SectionCutElem, SheetElem
from bim_ai.sheet_preview_svg import (
    SHEET_PRINT_RASTER_LAYOUT_STAMP_CONTRACT_V1,
    SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    SHEET_PRINT_RASTER_STAMP_HEIGHT_PX,
    SHEET_PRINT_RASTER_STAMP_WIDTH_PX,
    SHEET_PRINT_RASTER_SURROGATE_V2_HEIGHT_PX,
    sheet_elem_to_svg,
    sheet_print_raster_layout_stamp_png_bytes_v1,
    sheet_print_raster_placeholder_png_bytes_v1,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_svg_utf8_sha256,
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
    assert sheet_print_raster_layout_stamp_png_bytes_v1(doc, sh1, svg1) != sheet_print_raster_layout_stamp_png_bytes_v1(
        doc, sh2, svg2
    )


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
        [{"viewportId": "v", "viewRef": "plan:pv1", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}],
    )
    assert hints[0]["planProjectionSegment"].startswith("planPrim[")
    hints2 = viewport_evidence_hints_v1(
        doc,
        [{"viewportId": "v2", "viewRef": "section:sec1", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}],
    )
    assert hints2[0]["sectionDocumentationSegment"].startswith("secDoc[")

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
    assert rows1 == rows2[: SHEET_PRINT_RASTER_STAMP_HEIGHT_PX]


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

