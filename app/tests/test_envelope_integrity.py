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
                "typeLayers": ["brick", "insulation", "finish"],
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
                "typeLayers": ["slab", "screed"],
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
                "typeLayers": ["deck", "insulation", "membrane"],
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
                "sideReturnIds": ["loggia-return-a", "loggia-return-b"],
                "topReturnId": "roof-1",
                "bottomReturnId": "floor-1",
                "guardId": "guard-1",
                "accessOpeningId": "door-1",
                "floorId": "floor-1",
                "ceilingId": "ceiling-1",
            },
        },
        "loggia-return-a": {"kind": "wall", "id": "loggia-return-a"},
        "loggia-return-b": {"kind": "wall", "id": "loggia-return-b"},
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
    assert finding["trackerItems"] == ["BIR-F03"]
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


def test_strict_envelope_profile_requires_type_layer_metadata_for_assemblies() -> None:
    elements = _clean_elements()
    elements["roof-1"]["props"].pop("typeLayers")

    findings = check_envelope_integrity(elements, profile="strict")

    assert _codes(findings) == {"performance_metadata_missing"}
    assert findings[0]["ruleId"] == "bir_f07_performance_metadata_missing"
    assert findings[0]["elementIds"] == ["roof-1"]
    assert findings[0]["missing"] == ["layers"]
    assert findings[0]["trackerItems"] == ["BIR-F07"]


def test_declared_facade_rhythm_invalid_count_is_reported_not_crashed() -> None:
    elements = _clean_elements()
    elements["facade-n"]["props"]["facadeRhythm"] = {
        "bayCount": "two",
        "bayIds": ["bay-a", "bay-b"],
    }

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"facade_rhythm_count_invalid"}
    assert findings[0]["trackerItems"] == ["BIR-F05"]


def test_roof_opening_outside_host_and_occupied_void_contract_are_reported() -> None:
    elements = _clean_elements()
    elements["roof-terrace-cut"] = {
        "kind": "roof_opening",
        "id": "roof-terrace-cut",
        "hostRoofId": "roof-1",
        "boundaryMm": [
            {"xMm": 1000, "yMm": 1000},
            {"xMm": 5000, "yMm": 1000},
            {"xMm": 5000, "yMm": 3000},
            {"xMm": 1000, "yMm": 3000},
        ],
        "props": {"occupiedRoofVoid": True},
    }
    elements["roof-1"]["footprintMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 4000},
        {"xMm": 0, "yMm": 4000},
    ]

    findings = check_envelope_integrity(elements)

    assert {
        "roof_opening_outside_host_footprint",
        "occupied_roof_void_evidence_missing",
    } <= _codes(findings)
    occupied = next(
        finding for finding in findings if finding["code"] == "occupied_roof_void_evidence_missing"
    )
    assert {
        "cut",
        "occupiedFloorId",
        "returnIds",
        "guardId",
        "accessOpeningId",
        "drainage",
        "support",
        "evidenceView",
    } <= set(occupied["missing"])


def test_occupied_roof_void_contract_accepts_physical_evidence_refs() -> None:
    elements = _clean_elements()
    elements.update(
        {
            "roof-terrace-cut": {
                "kind": "roof_opening",
                "id": "roof-terrace-cut",
                "hostRoofId": "roof-1",
                "boundaryMm": [
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 3000, "yMm": 1000},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 1000, "yMm": 3000},
                ],
                "props": {
                    "occupiedRoofVoid": True,
                    "occupiedVoidEvidence": {
                        "cut": True,
                        "occupiedFloorId": "floor-1",
                        "returnIds": ["return-a", "return-b"],
                        "guardId": "guard-1",
                        "accessOpeningId": "door-1",
                        "drainage": "slope to scupper",
                    "support": "bearing curb and trimmed roof framing",
                    "evidenceView": "roof-court-high",
                },
                "largeVoidIntent": "trimmed roof court with occupied terrace support",
            },
        },
            "return-a": {"kind": "wall", "id": "return-a"},
            "return-b": {"kind": "wall", "id": "return-b"},
        }
    )
    elements["roof-1"]["footprintMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 4000},
        {"xMm": 0, "yMm": 4000},
    ]

    findings = check_envelope_integrity(elements)

    assert "occupied_roof_void_evidence_missing" not in _codes(findings)
    assert "roof_opening_outside_host_footprint" not in _codes(findings)


def test_large_roof_opening_requires_explicit_void_support_metadata() -> None:
    elements = _clean_elements()
    elements["large-roof-cut"] = {
        "kind": "roof_opening",
        "id": "large-roof-cut",
        "hostRoofId": "roof-1",
        "boundaryMm": [
            {"xMm": 500, "yMm": 500},
            {"xMm": 3500, "yMm": 500},
            {"xMm": 3500, "yMm": 3500},
            {"xMm": 500, "yMm": 3500},
        ],
    }
    elements["roof-1"]["footprintMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 4000},
        {"xMm": 0, "yMm": 4000},
    ]

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"large_roof_opening_metadata_missing"}
    assert findings[0]["elementIds"] == ["large-roof-cut", "roof-1"]
    assert findings[0]["trackerItems"] == ["BIR-F01"]


def test_terrace_floor_requires_guard_access_drainage_and_support_refs() -> None:
    elements = _clean_elements()
    elements["terrace-floor"] = {
        "kind": "floor",
        "id": "terrace-floor",
        "levelId": "level-1",
        "props": {"exteriorSpaceType": "terrace"},
    }

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"occupied_exterior_space_relation_incomplete"}
    assert set(findings[0]["missing"]) == {"guard", "access", "drainage", "support"}


def test_contained_loggia_or_terrace_floor_must_stay_inside_declared_host_boundary() -> None:
    elements = _clean_elements()
    elements["contained-loggia-floor"] = {
        "kind": "floor",
        "id": "contained-loggia-floor",
        "levelId": "level-1",
        "boundaryMm": [
            {"xMm": 1000, "yMm": 1000},
            {"xMm": 4500, "yMm": 1000},
            {"xMm": 4500, "yMm": 3000},
            {"xMm": 1000, "yMm": 3000},
        ],
        "props": {
            "exteriorSpaceType": "loggia",
            "guardId": "guard-1",
            "accessOpeningId": "door-1",
            "drainageIntent": "internal trench drain",
            "supportedByIds": ["wall-n"],
            "containedByFloorId": "floor-1",
        },
    }

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"occupied_exterior_space_containment_invalid"}
    assert findings[0]["trackerItems"] == ["BIR-F04"]


def test_declared_facade_opening_and_glazing_support_refs_are_validated() -> None:
    elements = _clean_elements()
    elements["facade-n"]["props"]["facadeRhythm"] = {
        "bayCount": 1,
        "openingIds": ["missing-window"],
        "requiresGlazingSupport": True,
        "glazingSupportIds": ["missing-mullion"],
    }

    findings = check_envelope_integrity(elements)

    assert {
        "facade_opening_reference_missing",
        "facade_glazing_support_missing",
    } <= _codes(findings)
    support = next(
        finding for finding in findings if finding["code"] == "facade_glazing_support_missing"
    )
    assert support["elementIds"] == ["facade-n", "missing-mullion"]


def test_declared_facade_rhythm_openings_must_attach_to_declared_facade_wall() -> None:
    elements = _clean_elements()
    elements["wall-south"] = {"kind": "wall", "id": "wall-south"}
    elements["window-south"] = {"kind": "window", "id": "window-south", "wallId": "wall-south"}
    elements["facade-n"]["props"]["facadeRhythm"] = {
        "bayCount": 1,
        "openingIds": ["window-south"],
    }

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"facade_opening_attachment_mismatch"}
    assert findings[0]["elementIds"] == ["facade-n", "window-south"]
    assert findings[0]["trackerItems"] == ["BIR-F05"]


def test_roof_attached_wall_ids_must_resolve() -> None:
    elements = _clean_elements()
    elements["roof-1"]["props"]["attachedWallIds"] = ["missing-wall"]

    findings = check_envelope_integrity(elements)

    assert _codes(findings) == {"roof_attached_wall_reference_missing"}
    assert findings[0]["trackerItems"] == ["BIR-F06"]


def test_derived_envelope_wall_loop_gap_is_reported_from_geometry() -> None:
    elements = _clean_elements()
    elements.update(
        {
            "wall-e": {
                "kind": "wall",
                "id": "wall-e",
                "levelId": "level-1",
                "start": {"xMm": 4000, "yMm": 0},
                "end": {"xMm": 4000, "yMm": 3000},
                "props": {"envelopeRole": "exterior_wall"},
            },
            "wall-s": {
                "kind": "wall",
                "id": "wall-s",
                "levelId": "level-1",
                "start": {"xMm": 4000, "yMm": 3000},
                "end": {"xMm": 0, "yMm": 3000},
                "props": {"envelopeRole": "exterior_wall"},
            },
        }
    )
    elements["wall-n"]["start"] = {"xMm": 0, "yMm": 0}
    elements["wall-n"]["end"] = {"xMm": 4000, "yMm": 0}
    elements["zone-1"]["requiredElementIds"] = ["wall-n", "wall-e", "wall-s", "floor-1"]
    elements["floor-1"]["boundaryMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 3000},
        {"xMm": 0, "yMm": 3000},
    ]

    findings = check_envelope_integrity(elements)

    assert "derived_envelope_closure_gap" in _codes(findings)
    gap = next(finding for finding in findings if finding["code"] == "derived_envelope_closure_gap")
    assert gap["ruleId"] == "bir_f03_derived_envelope_closure_gap"
    assert gap["trackerItems"] == ["BIR-F03"]
    assert gap["gapEndpointCount"] == 2


def test_derived_envelope_wall_loop_and_floor_boundary_accept_clean_geometry() -> None:
    elements = _clean_elements()
    for wall_id, start, end in [
        ("wall-n", (0, 0), (4000, 0)),
        ("wall-e", (4000, 0), (4000, 3000)),
        ("wall-s", (4000, 3000), (0, 3000)),
        ("wall-w", (0, 3000), (0, 0)),
    ]:
        elements[wall_id] = {
            "kind": "wall",
            "id": wall_id,
            "levelId": "level-1",
            "start": {"xMm": start[0], "yMm": start[1]},
            "end": {"xMm": end[0], "yMm": end[1]},
            "roofAttachmentId": "roof-1",
            "props": {"envelopeRole": "exterior_wall"},
        }
    elements["floor-1"]["boundaryMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 3000},
        {"xMm": 0, "yMm": 3000},
    ]
    elements["roof-1"]["footprintMm"] = [
        {"xMm": -450, "yMm": -450},
        {"xMm": 4450, "yMm": -450},
        {"xMm": 4450, "yMm": 3450},
        {"xMm": -450, "yMm": 3450},
    ]
    elements["roof-1"]["props"]["attachedWallIds"] = ["wall-n", "wall-e", "wall-s", "wall-w"]
    elements["zone-1"]["requiredElementIds"] = [
        "wall-n",
        "wall-e",
        "wall-s",
        "wall-w",
        "floor-1",
        "roof-1",
    ]

    findings = check_envelope_integrity(elements)

    assert "derived_envelope_closure_gap" not in _codes(findings)
    assert "derived_envelope_boundary_mismatch" not in _codes(findings)
    assert "derived_roof_wall_attachment_invalid" not in _codes(findings)


def test_derived_loggia_recess_side_returns_must_touch_floor_boundary() -> None:
    elements = _clean_elements()
    elements["floor-1"]["boundaryMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 3000, "yMm": 0},
        {"xMm": 3000, "yMm": 1600},
        {"xMm": 0, "yMm": 1600},
    ]
    elements["loggia-return-a"].update(
        {"start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 0, "yMm": 1600}}
    )
    elements["loggia-return-b"].update(
        {"start": {"xMm": 4200, "yMm": 0}, "end": {"xMm": 4200, "yMm": 1600}}
    )

    findings = check_envelope_integrity(elements)

    assert "derived_loggia_recess_geometry_invalid" in _codes(findings)
    finding = next(
        finding for finding in findings if finding["code"] == "derived_loggia_recess_geometry_invalid"
    )
    assert finding["trackerItems"] == ["BIR-F04"]


def test_derived_roof_attachment_flags_walls_outside_roof_overhang() -> None:
    elements = _clean_elements()
    elements["roof-1"]["footprintMm"] = [
        {"xMm": 0, "yMm": 0},
        {"xMm": 4000, "yMm": 0},
        {"xMm": 4000, "yMm": 3000},
        {"xMm": 0, "yMm": 3000},
    ]
    elements["roof-1"]["overhangMm"] = 250
    elements["roof-1"]["props"]["attachedWallIds"] = ["wall-n"]
    elements["wall-n"]["start"] = {"xMm": 0, "yMm": 700}
    elements["wall-n"]["end"] = {"xMm": 4000, "yMm": 700}

    findings = check_envelope_integrity(elements)

    assert "derived_roof_wall_attachment_invalid" in _codes(findings)
    finding = next(
        finding for finding in findings if finding["code"] == "derived_roof_wall_attachment_invalid"
    )
    assert finding["elementIds"] == ["roof-1", "wall-n"]
    assert finding["trackerItems"] == ["BIR-F06"]
