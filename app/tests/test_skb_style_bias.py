"""Tests for SKB-20 style bias vectors."""

from __future__ import annotations

from bim_ai.skb.style_bias import STYLE_BIASES, known_style_ids, style_for_brief_hint


def test_known_styles_sorted_and_complete() -> None:
    ids = known_style_ids()
    assert ids
    assert ids == sorted(ids)
    assert "modernist" in ids
    assert "traditional" in ids


def test_style_for_brief_hint_modernist_synonyms() -> None:
    for hint in ("Modernist", "modern", "minimalist", "contemporary"):
        s = style_for_brief_hint(hint)
        assert s is not None
        assert s.style_id == "modernist"


def test_style_for_brief_hint_traditional() -> None:
    for hint in ("traditional", "classical", "Georgian"):
        s = style_for_brief_hint(hint)
        assert s is not None
        assert s.style_id == "traditional"


def test_style_for_brief_hint_unknown_returns_none() -> None:
    assert style_for_brief_hint("brutalist") is None
    assert style_for_brief_hint("") is None


def test_each_style_has_complete_palette() -> None:
    required = {"ground_cladding", "upper_cladding", "accent_cladding", "roof", "frames", "balustrade"}
    for s in STYLE_BIASES.values():
        missing = required - set(s.palette.keys())
        assert not missing, f"{s.style_id} missing palette keys: {missing}"


def test_glazing_ratio_in_unit_range() -> None:
    for s in STYLE_BIASES.values():
        assert 0.0 <= s.glazing_ratio <= 1.0


def test_roof_bias_nonempty() -> None:
    for s in STYLE_BIASES.values():
        assert s.roof_bias
