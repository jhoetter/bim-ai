"""Coordinate-frame alignment gates for reverse-BIM source packages."""

from __future__ import annotations

from typing import Any

GEOMETRY_FRAME_CLASSES = {
    "floor_plan",
    "section",
    "elevation",
    "site_plan",
    "drainage_doc",
}

GEOMETRY_FACT_KINDS = {
    "wall_line",
    "wall_chain",
    "room",
    "opening",
    "door",
    "window",
    "stair",
    "slab_opening",
    "roof",
    "dormer",
    "roof_opening",
    "basement",
    "drainage",
    "terrain",
    "parcel_boundary",
    "site_context",
}

REQUIRED_ALIGNMENT_FIELDS = [
    "coordinateFrameId",
    "scale",
    "originPx",
    "rotationDeg",
    "modelOriginMm",
    "controlPoints",
    "residualErrorMm",
    "acceptedBy",
]


def build_coordinate_frame_alignment_worklist(
    coordinate_frames: dict[str, Any],
    *,
    facts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return page-to-model alignment actions required before geometry authoring."""

    actions = []
    required_frame_ids = _required_frame_ids(coordinate_frames, facts)
    for frame in coordinate_frames.get("coordinateFrames") or []:
        if not isinstance(frame, dict):
            continue
        status = str(frame.get("status") or "")
        classification = str(frame.get("classification") or "unknown")
        if status == "accepted":
            continue
        if classification not in GEOMETRY_FRAME_CLASSES:
            continue
        if (
            required_frame_ids is not None
            and str(frame.get("coordinateFrameId") or "") not in required_frame_ids
        ):
            continue
        actions.append(
            {
                "id": f"coordinate-frame:{frame.get('coordinateFrameId')}",
                "kind": "coordinate_frame_alignment",
                "status": "blocked_needs_alignment",
                "coordinateFrameId": frame.get("coordinateFrameId"),
                "sourceDocumentId": frame.get("sourceDocumentId"),
                "sourcePageId": frame.get("sourcePageId"),
                "page": frame.get("page"),
                "classification": classification,
                "levelOrSiteAssociation": frame.get("levelOrSiteAssociation"),
                "currentScale": frame.get("scale"),
                "requiredAlignmentFields": REQUIRED_ALIGNMENT_FIELDS,
                "acceptanceRole": "blocks_geometry_authoring",
                "sourcePrompt": (
                    "Align this source page to model coordinates. Return scale, origin, "
                    "rotation, model origin, at least two control points, residual error, "
                    "and provenance for the alignment."
                ),
            }
        )

    counts: dict[str, int] = {}
    for action in actions:
        classification = str(action.get("classification") or "unknown")
        counts[classification] = counts.get(classification, 0) + 1
    return {
        "format": "reverseBimCoordinateFrameAlignmentWorklist_v1",
        "summary": {
            "actionCount": len(actions),
            "blockedAlignmentCount": sum(
                1 for action in actions if str(action.get("status") or "").startswith("blocked")
            ),
            "classificationCounts": counts,
        },
        "actions": actions,
    }


def apply_coordinate_frame_alignments(
    coordinate_frames: dict[str, Any],
    alignments: list[dict[str, Any]] | dict[str, Any] | None,
    *,
    facts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Apply accepted page-to-model alignments and report remaining blockers."""

    alignment_rows = _alignment_rows(alignments)
    required_frame_ids = _required_frame_ids(coordinate_frames, facts)
    alignments_by_id = {
        str(row.get("coordinateFrameId")): row
        for row in alignment_rows
        if isinstance(row, dict) and row.get("coordinateFrameId")
    }
    frames = []
    rows = []
    for frame in coordinate_frames.get("coordinateFrames") or []:
        if not isinstance(frame, dict):
            continue
        frame_id = str(frame.get("coordinateFrameId") or "")
        classification = str(frame.get("classification") or "unknown")
        alignment = alignments_by_id.get(frame_id)
        frame_required = required_frame_ids is None or frame_id in required_frame_ids
        if not alignment:
            frames.append(frame)
            rows.append(
                {
                    "coordinateFrameId": frame_id,
                    "status": "missing_alignment"
                    if frame_required and classification in GEOMETRY_FRAME_CLASSES
                    else "not_required",
                }
            )
            continue
        errors = _validate_alignment(alignment)
        if errors:
            frames.append(frame)
            rows.append(
                {
                    "coordinateFrameId": frame_id,
                    "status": "invalid_alignment",
                    "errors": errors,
                }
            )
            continue
        frames.append(
            {
                **frame,
                "status": "accepted",
                "scale": alignment.get("scale"),
                "originPx": alignment.get("originPx"),
                "rotationDeg": alignment.get("rotationDeg"),
                "modelOriginMm": alignment.get("modelOriginMm"),
                "controlPoints": alignment.get("controlPoints"),
                "residualErrorMm": alignment.get("residualErrorMm"),
                "confidence": alignment.get("confidence", frame.get("confidence")),
                "alignmentProvenance": {
                    "acceptedBy": alignment.get("acceptedBy"),
                    "sourceRefs": alignment.get("sourceRefs") or [],
                    "reason": alignment.get("reason"),
                },
            }
        )
        rows.append({"coordinateFrameId": frame_id, "status": "accepted"})

    blocking_rows = [
        row
        for row in rows
        if row.get("status") in {"missing_alignment", "invalid_alignment"}
        and (
            required_frame_ids is None
            or str(row.get("coordinateFrameId") or "") in required_frame_ids
        )
        and _frame_classification(row.get("coordinateFrameId"), frames) in GEOMETRY_FRAME_CLASSES
    ]
    updated = {
        **coordinate_frames,
        "coordinateFrameCount": len(frames),
        "coordinateFrames": frames,
    }
    return {
        "format": "reverseBimCoordinateFrameAlignmentReport_v1",
        "accepted": not blocking_rows,
        "summary": {
            "coordinateFrameCount": len(frames),
            "acceptedFrameCount": sum(1 for frame in frames if frame.get("status") == "accepted"),
            "blockingAlignmentCount": len(blocking_rows),
            "invalidAlignmentCount": sum(
                1 for row in rows if row.get("status") == "invalid_alignment"
            ),
            "missingAlignmentCount": sum(
                1 for row in rows if row.get("status") == "missing_alignment"
            ),
        },
        "coordinateFrames": updated,
        "rows": rows,
    }


def _alignment_rows(
    alignments: list[dict[str, Any]] | dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if alignments is None:
        return []
    if isinstance(alignments, dict) and isinstance(alignments.get("alignments"), list):
        return [row for row in alignments["alignments"] if isinstance(row, dict)]
    if isinstance(alignments, dict):
        return [
            {**value, "coordinateFrameId": key}
            for key, value in alignments.items()
            if isinstance(value, dict)
        ]
    return [row for row in alignments if isinstance(row, dict)]


def _required_frame_ids(
    coordinate_frames: dict[str, Any],
    facts: list[dict[str, Any]] | None,
) -> set[str] | None:
    if facts is None:
        return None
    frame_by_doc_page = {
        (str(frame.get("sourceDocumentId") or ""), int(frame.get("page") or 0)): str(
            frame.get("coordinateFrameId") or ""
        )
        for frame in coordinate_frames.get("coordinateFrames") or []
        if isinstance(frame, dict)
    }
    required: set[str] = set()
    for fact in facts:
        if not isinstance(fact, dict) or fact.get("kind") not in GEOMETRY_FACT_KINDS:
            continue
        provenance = fact.get("provenance") if isinstance(fact.get("provenance"), dict) else {}
        doc_id = str(provenance.get("sourceDocumentId") or "")
        page = int(provenance.get("page") or 0)
        frame_id = frame_by_doc_page.get((doc_id, page))
        if frame_id:
            required.add(frame_id)
    return required


def _validate_alignment(alignment: dict[str, Any]) -> list[str]:
    errors = []
    for field in REQUIRED_ALIGNMENT_FIELDS:
        if alignment.get(field) in (None, "", []):
            errors.append(f"missing required field: {field}")
    if isinstance(alignment.get("controlPoints"), list) and len(alignment["controlPoints"]) < 2:
        errors.append("controlPoints must include at least two points")
    return errors


def _frame_classification(frame_id: Any, frames: list[dict[str, Any]]) -> str:
    for frame in frames:
        if str(frame.get("coordinateFrameId") or "") == str(frame_id or ""):
            return str(frame.get("classification") or "unknown")
    return "unknown"
