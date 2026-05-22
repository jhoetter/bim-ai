"""Shared digest helpers (BRT-11).

Sixteen modules in the package each define their own `_digest` or
`_sha256_json`. They differ on two axes:

1. `ensure_ascii`: most use the json-module default (`True`); two
   (`folder_output._sha256_json`, `reverse_bim_reader_dispatch
   ._sha256_json`) use `False`.
2. Output prefix: `bim_requirement_validation_pack._digest`
   returns `"sha256:" + hex`; all others return raw hex.

`digest()` and `sha256_json()` expose both axes via keyword args so
each call site can migrate without changing the bytes it produces
into persisted evidence packs.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json_bytes(payload: Any, *, ensure_ascii: bool = True) -> bytes:
    """Serialize *payload* to canonical JSON bytes.

    Canonical = sorted keys, compact separators, `default=str` for
    non-serializable types. The previous local impls all use this
    exact shape; the only axis of variation is `ensure_ascii`.
    """
    text = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=ensure_ascii,
        default=str,
    )
    return text.encode("utf-8")


def sha256_bytes(blob: bytes) -> str:
    """Hex-encoded SHA-256 of raw bytes."""
    return hashlib.sha256(blob).hexdigest()


def digest(payload: Any, *, ensure_ascii: bool = True, prefix: bool = False) -> str:
    """Canonical SHA-256 hex of *payload*.

    Defaults match the most common existing implementation
    (`reverse_bim._digest`). Set `ensure_ascii=False` for
    parity with `folder_output._sha256_json` /
    `reverse_bim_reader_dispatch._sha256_json`. Set `prefix=True`
    for parity with `bim_requirement_validation_pack._digest`.
    """
    hex_digest = sha256_bytes(canonical_json_bytes(payload, ensure_ascii=ensure_ascii))
    return f"sha256:{hex_digest}" if prefix else hex_digest


def sha256_json(payload: Any, *, ensure_ascii: bool = True) -> str:
    """Alias for `digest(...)`. Kept because several call sites
    historically used the `_sha256_json` name."""
    return digest(payload, ensure_ascii=ensure_ascii)
