"""Shared digest helpers (BRT-11).

Engine-wide canonical SHA-256 helpers. `digest()` and `sha256_json()`
expose two axes via keyword args:

1. `ensure_ascii` — toggle JSON ASCII escaping; both behaviors are
   in use across the package and must be preservable to keep
   persisted evidence-pack bytes stable.
2. `prefix=True` — return `"sha256:<hex>"` instead of bare hex
   (used by `bim_requirement_validation_pack._digest`).
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

    `ensure_ascii=True` (default) matches the most common existing
    callsite; `ensure_ascii=False` matches the `folder_output`
    variant. `prefix=True` matches the
    `bim_requirement_validation_pack` variant which prepends
    `"sha256:"`.
    """
    hex_digest = sha256_bytes(canonical_json_bytes(payload, ensure_ascii=ensure_ascii))
    return f"sha256:{hex_digest}" if prefix else hex_digest


def sha256_json(payload: Any, *, ensure_ascii: bool = True) -> str:
    """Alias for `digest(...)`. Kept because several call sites
    historically used the `_sha256_json` name."""
    return digest(payload, ensure_ascii=ensure_ascii)
