"""Room finish metadata helpers for schedules, evidence, and advisor alignment."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from collections.abc import Iterable, Mapping
from typing import Any

from bim_ai.elements import RoomElem


def peer_finish_set_by_level(rooms: Iterable[RoomElem]) -> dict[str, str]:
    """First non-empty finishSet per level when rooms are sorted by id (matches constraints)."""

    grouped: dict[str, list[RoomElem]] = defaultdict(list)
    for r in rooms:
        grouped[r.level_id].append(r)
    out: dict[str, str] = {}
    for lid, mates in grouped.items():
        for r in sorted(mates, key=lambda rr: rr.id):
            donor_fs = (r.finish_set or "").strip()
            if donor_fs:
                out[lid] = donor_fs
                break
    return out


def legend_label_for_room_finish(room: RoomElem) -> str:
    """Same precedence as plan wire ``_room_color_legend_payload`` label."""

    return (
        (room.programme_code or "").strip()
        or (room.department or "").strip()
        or (room.function_label or "").strip()
        or (room.name or "").strip()
        or room.id
    )


def room_finish_schedule_row_extensions(
    room: RoomElem,
    *,
    peer_by_level: Mapping[str, str],
) -> dict[str, Any]:
    pc = (room.programme_code or "").strip()
    dept = (room.department or "").strip()
    fs = (room.finish_set or "").strip()
    peer_raw = peer_by_level.get(room.level_id) or ""
    peer = peer_raw.strip()
    need_finish = bool(pc or dept)

    if fs:
        finish_state = "complete"
    elif not need_finish:
        finish_state = "not_required"
    elif peer:
        finish_state = "peer_suggested"
    else:
        finish_state = "missing"

    row_ext: dict[str, Any] = {
        "finishState": finish_state,
        "legendLabel": legend_label_for_room_finish(room),
        "levelPeerFinishSet": peer,
    }
    if finish_state == "peer_suggested":
        row_ext["peerSuggestedFinishSet"] = peer
    return row_ext


def _evidence_row_from_table_row(row: Mapping[str, Any]) -> dict[str, Any]:
    eid = str(row.get("elementId") or "").strip()
    fs_state = str(row.get("finishState") or "")
    out: dict[str, Any] = {
        "elementId": eid,
        "name": str(row.get("name") or ""),
        "roomNumber": "",
        "levelId": str(row.get("levelId") or ""),
        "programmeCode": str(row.get("programmeCode") or ""),
        "department": str(row.get("department") or ""),
        "functionLabel": str(row.get("functionLabel") or ""),
        "finishSet": str(row.get("finishSet") or ""),
        "finishState": fs_state,
        "legendLabel": str(row.get("legendLabel") or ""),
        "levelPeerFinishSet": str(row.get("levelPeerFinishSet") or ""),
    }
    if fs_state == "peer_suggested":
        ps = row.get("peerSuggestedFinishSet")
        if ps is not None and str(ps).strip():
            out["peerSuggestedFinishSet"] = str(ps).strip()
    return out


def build_room_finish_schedule_evidence_v1(leaf_room_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Deterministic evidence from derived room schedule leaf rows (post filter/group/sort)."""

    sorted_rows = sorted(leaf_room_rows, key=lambda r: str(r.get("elementId") or ""))
    canon = [_evidence_row_from_table_row(r) for r in sorted_rows]
    blob = json.dumps(canon, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()
    summary: dict[str, int] = {
        "complete": 0,
        "not_required": 0,
        "missing": 0,
        "peer_suggested": 0,
    }
    for r in canon:
        st = r.get("finishState")
        if isinstance(st, str) and st in summary:
            summary[st] += 1

    return {
        "format": "roomFinishScheduleEvidence_v1",
        "order": "elementId",
        "rowDigestSha256": digest,
        "rows": canon,
        "summary": summary,
    }


def room_finish_legend_correlation_v1_for_wire(
    *,
    legend_rows: list[dict[str, Any]],
    rooms: Iterable[RoomElem],
    peer_by_level: Mapping[str, str],
) -> dict[str, Any]:
    """Per legend label: room counts and finish advisory counts (hint only; not part of legend digest)."""

    unique_labels: list[str] = []
    seen: set[str] = set()
    for lr in legend_rows:
        lb = str(lr.get("label") or "").strip()
        if not lb or lb in seen:
            continue
        seen.add(lb)
        unique_labels.append(lb)
    by_label: dict[str, dict[str, int]] = {
        lb: {"roomCount": 0, "missingFinishCount": 0, "peerSuggestedCount": 0} for lb in unique_labels
    }
    for room in rooms:
        lab = legend_label_for_room_finish(room)
        if lab not in by_label:
            continue
        ext = room_finish_schedule_row_extensions(room, peer_by_level=peer_by_level)
        by_label[lab]["roomCount"] += 1
        if ext["finishState"] == "missing":
            by_label[lab]["missingFinishCount"] += 1
        elif ext["finishState"] == "peer_suggested":
            by_label[lab]["peerSuggestedCount"] += 1
    ordered = [{"label": lb, **by_label[lb]} for lb in unique_labels]
    core: dict[str, Any] = {"format": "roomFinishLegendCorrelation_v1", "byLegendLabel": ordered}
    blob = json.dumps(core, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()
    return {**core, "correlationDigestSha256": digest}
