from __future__ import annotations

import hashlib

from bim_ai.sheet_preview_svg import (
    SHEET_PRINT_RASTER_PLACEHOLDER_CONTRACT_V1,
    sheet_print_raster_placeholder_png_bytes_v1,
    sheet_svg_utf8_sha256,
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
