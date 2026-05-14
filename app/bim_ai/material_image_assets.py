from __future__ import annotations

import base64
import hashlib
import struct
from dataclasses import dataclass
from typing import Literal

from bim_ai.elements import ImageAssetElem

ImageAssetMapUsage = Literal["albedo", "normal", "roughness", "metalness", "height", "opacity"]

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_IMAGE_ASSET_BYTES = 5 * 1024 * 1024


@dataclass(frozen=True)
class ImageAssetUpload:
    filename: str
    mime_type: str
    data: bytes
    map_usage_hint: ImageAssetMapUsage
    source: str | None = None
    license: str | None = None
    provenance: str | None = None


def _sniff_mime(data: bytes, fallback: str) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return fallback


def _dimensions(data: bytes, mime_type: str) -> tuple[int | None, int | None]:
    if mime_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
        return int(width), int(height)
    if mime_type == "image/jpeg":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            i += 2
            if marker in {0xD8, 0xD9}:
                continue
            if i + 2 > len(data):
                break
            block_len = int.from_bytes(data[i : i + 2], "big")
            if marker in range(0xC0, 0xC4) and i + 7 < len(data):
                height = int.from_bytes(data[i + 3 : i + 5], "big")
                width = int.from_bytes(data[i + 5 : i + 7], "big")
                return width, height
            i += max(block_len, 2)
    return None, None


def build_image_asset_from_upload(upload: ImageAssetUpload) -> ImageAssetElem:
    if len(upload.data) == 0:
        raise ValueError("image asset upload is empty")
    if len(upload.data) > MAX_IMAGE_ASSET_BYTES:
        raise ValueError("image asset upload exceeds the 5 MiB limit")
    mime_type = _sniff_mime(upload.data, upload.mime_type)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError("image asset upload must be PNG, JPEG, or WebP")
    width_px, height_px = _dimensions(upload.data, mime_type)
    digest = hashlib.sha256(upload.data).hexdigest()
    data_url = f"data:{mime_type};base64,{base64.b64encode(upload.data).decode('ascii')}"
    stem = digest[:16]
    return ImageAssetElem(
        kind="image_asset",
        id=f"img-{stem}",
        filename=upload.filename or f"{stem}.{mime_type.split('/')[-1]}",
        mimeType=mime_type,
        byteSize=len(upload.data),
        widthPx=width_px,
        heightPx=height_px,
        contentHash=f"sha256:{digest}",
        mapUsageHint=upload.map_usage_hint,
        source=upload.source,
        license=upload.license,
        provenance=upload.provenance,
        dataUrl=data_url,
    )
