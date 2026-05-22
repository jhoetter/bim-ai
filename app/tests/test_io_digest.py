"""Parity tests for `bim_ai._io.digest` (BRT-11).

These tests lock the byte output of the shared `digest` /
`sha256_json` helpers against the 16 pre-existing in-module
implementations they replace. If a digest changes, evidence packs
on disk become invalid — so the parity matrix is the contract.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bim_ai._io.digest import (
    canonical_json_bytes,
    digest,
    sha256_bytes,
    sha256_json,
)


def _legacy_digest_default(payload: Any) -> str:
    """Inline copy of the most common existing _digest impl
    (reverse_bim, hybrid_reverse_bim, reverse_bim_visual_capture,
    reverse_bim_readback, reverse_bim_document_authority, etc.)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _legacy_sha256_json_no_ascii(payload: Any) -> str:
    """Inline copy of folder_output._sha256_json /
    reverse_bim_reader_dispatch._sha256_json."""
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _legacy_prefixed_digest(value: Any) -> str:
    """Inline copy of bim_requirement_validation_pack._digest."""
    blob = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(blob.encode("utf8")).hexdigest()


PAYLOADS: list[Any] = [
    {},
    {"a": 1, "b": [2, 3]},
    {"nested": {"deep": {"value": None, "bool": True}}},
    [1, "two", 3.0, None],
    {"unicode_key_ümlaut": "value", "z": ["a", "b"]},
    {"order_independence": {"z": 1, "a": 2, "m": [{"k": 1}]}},
]


def test_canonical_json_bytes_default_matches_legacy_default() -> None:
    for payload in PAYLOADS:
        bytes_out = canonical_json_bytes(payload)
        legacy = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
        assert bytes_out == legacy, payload


def test_canonical_json_bytes_no_ascii_matches_legacy_no_ascii() -> None:
    for payload in PAYLOADS:
        bytes_out = canonical_json_bytes(payload, ensure_ascii=False)
        legacy = json.dumps(
            payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        assert bytes_out == legacy, payload


def test_digest_matches_legacy_default() -> None:
    for payload in PAYLOADS:
        assert digest(payload) == _legacy_digest_default(payload), payload


def test_digest_no_ascii_matches_legacy_no_ascii() -> None:
    for payload in PAYLOADS:
        assert digest(payload, ensure_ascii=False) == _legacy_sha256_json_no_ascii(payload), payload


def test_sha256_json_alias() -> None:
    for payload in PAYLOADS:
        assert sha256_json(payload) == digest(payload)
        assert sha256_json(payload, ensure_ascii=False) == digest(payload, ensure_ascii=False)


def test_digest_with_prefix_matches_legacy_prefixed() -> None:
    for payload in PAYLOADS:
        assert digest(payload, prefix=True) == _legacy_prefixed_digest(payload), payload


def test_digest_handles_default_str_for_non_serializable() -> None:
    from pathlib import Path

    payload = {"path": Path("/tmp/x"), "set": {1, 2, 3}}
    # default=str must convert these without raising
    assert isinstance(digest(payload), str)
    assert len(digest(payload)) == 64  # hex SHA-256


def test_digest_order_independent() -> None:
    a = {"z": 1, "a": 2, "m": 3}
    b = {"a": 2, "m": 3, "z": 1}
    assert digest(a) == digest(b)


def test_sha256_bytes() -> None:
    blob = b"hello"
    assert sha256_bytes(blob) == hashlib.sha256(blob).hexdigest()
