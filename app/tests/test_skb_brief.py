"""Tests for SKB-21 sketch brief format."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from bim_ai.skb.brief import (
    SAMPLE_BRIEF,
    SketchBrief,
    brief_from_dict,
    brief_to_evidence_dict,
)


def test_sample_brief_round_trips() -> None:
    brief = brief_from_dict(SAMPLE_BRIEF)
    out = brief_to_evidence_dict(brief)
    re_brief = brief_from_dict(out)
    assert re_brief == brief


def test_sample_brief_has_expected_fields() -> None:
    brief = brief_from_dict(SAMPLE_BRIEF)
    assert brief.title == "Asymmetric two-storey demo house"
    assert brief.style_hint == "modernist"
    assert brief.archetype_hint == "modernist_gable_two_story"
    assert len(brief.program) >= 4
    assert len(brief.key_dimensions) >= 3
    assert len(brief.material_intent) >= 3
    assert len(brief.special_features) >= 1


def test_minimal_brief_just_title() -> None:
    brief = SketchBrief(title="Empty brief")
    assert brief.program == []
    assert brief.key_dimensions == []


def test_extra_fields_rejected_in_strict_mode() -> None:
    with pytest.raises(ValidationError):
        SketchBrief(title="x", garbage_field="oops")  # type: ignore


def test_key_dimension_confidence_enum() -> None:
    brief = brief_from_dict({
        "title": "x",
        "keyDimensions": [
            {"label": "width", "valueMm": 5000, "confidence": "explicit"},
        ],
    })
    assert brief.key_dimensions[0].confidence == "explicit"


def test_key_dimension_invalid_confidence_rejected() -> None:
    with pytest.raises(ValidationError):
        brief_from_dict({
            "title": "x",
            "keyDimensions": [
                {"label": "width", "valueMm": 5000, "confidence": "guessed"},
            ],
        })


def test_evidence_dict_uses_camelcase_aliases() -> None:
    brief = brief_from_dict(SAMPLE_BRIEF)
    out = brief_to_evidence_dict(brief)
    assert "schemaVersion" in out
    assert "styleHint" in out
    assert "siteOrientationDeg" in out
    assert "keyDimensions" in out
    assert "specialFeatures" in out
    assert "referenceImages" in out
