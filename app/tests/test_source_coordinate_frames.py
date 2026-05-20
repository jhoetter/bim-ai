from __future__ import annotations

from bim_ai.source_coordinate_frames import (
    apply_coordinate_frame_alignments,
    build_coordinate_frame_alignment_worklist,
)


def test_coordinate_frame_alignment_worklist_blocks_geometry_frames() -> None:
    frames = {
        "coordinateFrames": [
            {
                "coordinateFrameId": "frame-eg",
                "sourceDocumentId": "doc-eg",
                "classification": "floor_plan",
                "status": "candidate_needs_alignment",
                "scale": "1:100",
            },
            {
                "coordinateFrameId": "frame-photo",
                "classification": "photo",
                "status": "candidate_needs_alignment",
            },
        ]
    }

    worklist = build_coordinate_frame_alignment_worklist(frames)

    assert worklist["summary"] == {
        "actionCount": 1,
        "blockedAlignmentCount": 1,
        "classificationCounts": {"floor_plan": 1},
    }
    assert worklist["actions"][0]["coordinateFrameId"] == "frame-eg"
    assert worklist["actions"][0]["acceptanceRole"] == "blocks_geometry_authoring"


def test_apply_coordinate_frame_alignments_accepts_valid_alignment() -> None:
    frames = {
        "coordinateFrames": [
            {
                "coordinateFrameId": "frame-eg",
                "classification": "floor_plan",
                "status": "candidate_needs_alignment",
            }
        ]
    }
    alignments = [
        {
            "coordinateFrameId": "frame-eg",
            "scale": "1:100",
            "originPx": {"xPx": 10, "yPx": 20},
            "rotationDeg": 0,
            "modelOriginMm": {"xMm": 0, "yMm": 0},
            "controlPoints": [
                {"sourcePx": {"xPx": 10, "yPx": 20}, "modelMm": {"xMm": 0, "yMm": 0}},
                {"sourcePx": {"xPx": 110, "yPx": 20}, "modelMm": {"xMm": 5000, "yMm": 0}},
            ],
            "residualErrorMm": 12,
            "acceptedBy": "test",
            "sourceRefs": ["doc-eg:p1"],
            "reason": "Known dimension line.",
        }
    ]

    report = apply_coordinate_frame_alignments(frames, alignments)

    assert report["accepted"] is True
    assert report["summary"]["acceptedFrameCount"] == 1
    accepted = report["coordinateFrames"]["coordinateFrames"][0]
    assert accepted["status"] == "accepted"
    assert accepted["alignmentProvenance"]["acceptedBy"] == "test"


def test_apply_coordinate_frame_alignments_keeps_invalid_alignment_blocking() -> None:
    frames = {
        "coordinateFrames": [
            {
                "coordinateFrameId": "frame-eg",
                "classification": "floor_plan",
                "status": "candidate_needs_alignment",
            }
        ]
    }

    report = apply_coordinate_frame_alignments(
        frames,
        [{"coordinateFrameId": "frame-eg", "scale": "1:100"}],
    )

    assert report["accepted"] is False
    assert report["summary"]["invalidAlignmentCount"] == 1
    assert report["rows"][0]["status"] == "invalid_alignment"


def test_coordinate_frame_alignment_blocks_only_referenced_geometry_pages() -> None:
    frames = {
        "coordinateFrames": [
            {
                "coordinateFrameId": "frame-site-1",
                "sourceDocumentId": "doc-site",
                "page": 1,
                "classification": "site_plan",
                "status": "candidate_needs_alignment",
            },
            {
                "coordinateFrameId": "frame-site-2",
                "sourceDocumentId": "doc-site",
                "page": 2,
                "classification": "site_plan",
                "status": "candidate_needs_alignment",
            },
        ]
    }
    facts = [
        {
            "kind": "parcel_boundary",
            "provenance": {"sourceDocumentId": "doc-site", "page": 1},
        }
    ]

    worklist = build_coordinate_frame_alignment_worklist(frames, facts=facts)
    report = apply_coordinate_frame_alignments(frames, None, facts=facts)

    assert [action["coordinateFrameId"] for action in worklist["actions"]] == ["frame-site-1"]
    assert report["summary"]["missingAlignmentCount"] == 1
    assert report["rows"] == [
        {"coordinateFrameId": "frame-site-1", "status": "missing_alignment"},
        {"coordinateFrameId": "frame-site-2", "status": "not_required"},
    ]
