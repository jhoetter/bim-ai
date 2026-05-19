from __future__ import annotations

from bim_ai.envelope_integrity import check_envelope_integrity


def _clean_elements() -> dict[str, dict]:
    return {
        "level-1": {"kind": "level", "id": "level-1"},
        "wall-n": {
            "kind": "wall",
            "id": "wall-n",
            "levelId": "level-1",
            "roofAttachmentId": "roof-1",
            "props": {
                "envelopeRole": "exterior_wall",
                "thermalProfile": "placeholder",
                "fireRating": "REI30",
                "acousticRating": "Rw40",
            },
        },
        "floor-1": {
            "kind": "floor",
            "id": "floor-1",
            "levelId": "level-1",
            "props": {
                "envelopeRole": "floor",
                "thermalProfile": "placeholder",
                "fireRating": "REI30",
                "acousticRating": "LnT,w",
            },
        },
        "roof-1": {
            "kind": "roof",
            "id": "roof-1",
            "referenceLevelId": "level-1",
            "overhangMm": 450,
            "props": {
                "envelopeRole": "roof",
                "attachedWallIds": ["wall-n"],
                "requiresWrapperRelationship": True,
                "overhangSemantics": "eave",
                "thermalProfile": "placeholder",
                "fireRating": "REI30",
                "acousticRating": "rain-noise-placeholder",
            },
        },
        "door-1": {
            "kind": "door",
            "id": "door-1",
            "wallId": "wall-n",
            "props": {
                "envelopeRole": "opening",
                "thermalProfile": "placeholder",
                "fireRating": "T30",
                "acousticRating": "Rw32",
            },
        },
        "zone-1": {
            "kind": "envelope_zone",
            "id": "zone-1",
            "levelId": "level-1",
            "requiredElementIds": ["wall-n", "floor-1", "roof-1", "door-1"],
        },
        "loggia-1": {
            "kind": "balcony",
            "id": "loggia-1",
            "props": {
                "isLoggia": True,
                "sideReturnIds": ["wall-n", "wall-n"],
                "topReturnId": "roof-1",
                "bottomReturnId": "floor-1",
                "guardId": "guard-1",
                "accessOpeningId": "door-1",
                "floorId": "floor-1",
                "ceilingId": "ceiling-1",
            },
        },
        "guard-1": {"kind": "railing", "id": "guard-1"},
        "ceiling-1": {"kind": "ceiling", "id": "ceiling-1"},
        "facade-n": {
            "kind": "wall",
            "id": "facade-n",
            "levelId": "level-1",
            "props": {"facadeRhythm": {"bayCount": 2, "bayIds": ["bay-a", "bay-b"]}},
        },
        "bay-a": {"kind": "facade_bay", "id": "bay-a"},
        "bay-b": {"kind": "facade_bay", "id": "bay-b"},
    }


def _codes(findings: list[dict]) -> set[str]:
    return {finding["code"] for finding in findings}


def test_clean_envelope_and_loggia_metadata_has_no_findings_under_strict_profile() -> None:
    assert check_envelope_integrity(_clean_elements(), profile="strict") == []


def test_unresolved_declared_envelope_gap_is_reported() -> None:
    elements = _clean_elements()
    elements["zone-1"]["unresolvedGapIds"] = ["gap-east"]

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"unresolved_envelope_gap"}
    finding = findings[0]
    assert finding["ruleId"] == "bir_f03_unresolved_envelope_gap"
    assert finding["severity"] == "error"
    assert finding["priority"] == "high"
    assert finding["discipline"] == "architecture"
    assert finding["perspective"] == "envelope"
    assert finding["elementIds"] == ["zone-1", "gap-east"]
    assert "recommendation" in finding


def test_loggia_missing_returns_guard_and_access_is_reported() -> None:
    elements = _clean_elements()
    elements["loggia-1"]["props"] = {"isLoggia": True, "floorId": "floor-1"}

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"loggia_relation_incomplete"}
    missing = set(findings[0]["missing"])
    assert {
        "sideReturnIds",
        "topReturnId",
        "bottomReturnId",
        "guardId",
        "accessOpeningId",
        "ceilingId",
    } <= missing


def test_declared_facade_rhythm_mismatch_is_reported_only_when_count_declared() -> None:
    elements = _clean_elements()
    elements["facade-n"]["props"]["facadeRhythm"] = {
        "bayCount": 3,
        "bayIds": ["bay-a", "bay-b"],
    }
    elements["wall-no-rhythm"] = {"kind": "wall", "id": "wall-no-rhythm", "props": {}}

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"facade_rhythm_mismatch"}
    assert findings[0]["expected"] == "3"
    assert findings[0]["actual"] == "2"


def test_floating_roof_wrapper_relationship_missing_is_reported() -> None:
    elements = _clean_elements()
    elements["roof-1"]["props"].pop("attachedWallIds")

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"roof_wrapper_relationship_missing"}
    assert findings[0]["elementIds"] == ["roof-1"]


def test_missing_performance_metadata_under_strict_profile_is_reported() -> None:
    elements = _clean_elements()
    elements["wall-n"]["props"].pop("thermalProfile")
    elements["wall-n"]["props"].pop("fireRating")
    elements["wall-n"]["props"].pop("acousticRating")

    findings = check_envelope_integrity(elements, profile="strict")

    assert _codes(findings) == {"performance_metadata_missing"}
    assert findings[0]["ruleId"] == "bir_f07_performance_metadata_missing"
    assert findings[0]["missing"] == ["thermal", "fire", "acoustic"]
