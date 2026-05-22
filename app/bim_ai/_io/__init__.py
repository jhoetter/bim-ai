"""Shared low-level I/O helpers for the bim_ai package.

This subpackage exists to break the copy-paste epidemic the
2026-05-22 backend audit identified: 16 modules each defined their
own `_digest` / `_sha256_json` / `_read_json` / `_write_json`. Per
BRT-10 / BRT-11 in `spec/backend-rework-tracker.md`, those duties
live here once.

The signatures preserve byte-for-byte parity with the most common
existing impls so persisted digests do not change on migration.
"""

from bim_ai._io.digest import canonical_json_bytes, digest, sha256_bytes, sha256_json
from bim_ai._io.json_io import read_json, write_json

__all__ = [
    "canonical_json_bytes",
    "digest",
    "read_json",
    "sha256_bytes",
    "sha256_json",
    "write_json",
]
