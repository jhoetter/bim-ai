"""Iter-10 — command normalizer for subagent emissions.

Background: iter-9 deep-corrector subagents produced commands that the kernel
rejected for systemic, fixable reasons:

  * The kernel uses two type-name casings — building edits are camelCase
    (createRoof, createDormer, createWindow), site/terrain commands are
    PascalCase (CreateToposolid, CreateGradedRegion). Subagents pattern-match
    on the prevailing camelCase and get site commands wrong.
  * CreateDormer with dormerRoofKind=gable|hipped requires ridgeHeightMm
    (semantic_authoring.py:486) but subagents emit dormerRoofPitchDeg only,
    expecting the ridge height to be derived.
  * CreateToposolid uses field alias toposolidId but subagents emit "id".

Rather than re-dispatch the correctors, normalize each command before it goes
on the wire. Each normalization is logged so the orchestrator can fold the
correction back into future subagent prompts.

This is methodology infrastructure, not a one-shot. Future iter-N drivers
should call normalize_bundle() before POSTing.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass, field
from typing import Any

# Site / terrain commands are PascalCase in the kernel. Map every variant a
# subagent might plausibly emit back to canonical PascalCase. See
# app/bim_ai/commands_site.py for ground truth.
SITE_PASCAL_MAP = {
    "createtoposolid": "CreateToposolid",
    "updatetoposolid": "UpdateToposolid",
    "deletetoposolid": "DeleteToposolid",
    "creategradedregion": "CreateGradedRegion",
    "updategradedregion": "UpdateGradedRegion",
    "deletegradedregion": "DeleteGradedRegion",
    "createtoposolidexcavation": "CreateToposolidExcavation",
    "updatetoposolidexcavation": "UpdateToposolidExcavation",
    "deletetoposolidexcavation": "DeleteToposolidExcavation",
}


@dataclass
class NormalizationRecord:
    """One change the normalizer made to a command. Surface these to the next
    subagent dispatch so the same mistakes don't recur."""

    command_index: int
    original_type: str
    canonical_type: str
    field_changes: dict[str, Any] = field(default_factory=dict)
    derived_fields: dict[str, Any] = field(default_factory=dict)
    note: str = ""


def _canonical_type(raw_type: str) -> str:
    """Resolve a (possibly mis-cased) command type to its canonical form."""
    lowered = raw_type.lower()
    if lowered in SITE_PASCAL_MAP:
        return SITE_PASCAL_MAP[lowered]
    return raw_type


def _derive_dormer_ridge_height(cmd: dict[str, Any]) -> float | None:
    """For gable/hipped dormers: ridgeHeightMm above the dormer wall top.

    Geometry: the dormer is a rectangular prism widthMm × depthMm × wallHeightMm,
    capped with a gable along the long axis. For a symmetric gable spanning the
    full width, the ridge sits (widthMm / 2) × tan(pitchDeg) above the wall top.
    We add a small safety margin so the validator's strict-positive check passes
    even when pitch is shallow.
    """
    pitch = cmd.get("dormerRoofPitchDeg")
    width = cmd.get("widthMm")
    if pitch is None or width is None:
        return None
    try:
        pitch_rad = math.radians(float(pitch))
        rise = (float(width) / 2.0) * math.tan(pitch_rad)
        return max(rise, 100.0)
    except (TypeError, ValueError):
        return None


def normalize_command(cmd: dict[str, Any], index: int) -> tuple[dict[str, Any], NormalizationRecord | None]:
    """Return (normalized_command, record_if_changed)."""
    original_type = cmd.get("type", "")
    canonical_type = _canonical_type(original_type)
    record_changes: dict[str, Any] = {}
    record_derived: dict[str, Any] = {}
    notes: list[str] = []
    new_cmd = copy.deepcopy(cmd)

    if canonical_type != original_type:
        new_cmd["type"] = canonical_type
        record_changes["type"] = {"from": original_type, "to": canonical_type}
        notes.append(f"casing: {original_type} → {canonical_type}")

    # CreateToposolid field-alias normalization: kernel requires toposolidId.
    if canonical_type == "CreateToposolid":
        if "toposolidId" not in new_cmd and "id" in new_cmd:
            new_cmd["toposolidId"] = new_cmd.pop("id")
            record_changes["toposolidId"] = {"from_field": "id", "value": new_cmd["toposolidId"]}
            notes.append("aliased id → toposolidId")

    # CreateDormer derived ridgeHeightMm for gable/hipped kinds.
    if canonical_type == "createDormer":
        kind = new_cmd.get("dormerRoofKind", "flat")
        if kind in {"gable", "hipped"} and not new_cmd.get("ridgeHeightMm"):
            derived = _derive_dormer_ridge_height(new_cmd)
            if derived is not None:
                new_cmd["ridgeHeightMm"] = round(derived, 1)
                record_derived["ridgeHeightMm"] = new_cmd["ridgeHeightMm"]
                notes.append(
                    f"derived ridgeHeightMm={new_cmd['ridgeHeightMm']} from (widthMm / 2) × tan(pitchDeg)"
                )

    if not record_changes and not record_derived:
        return new_cmd, None
    return new_cmd, NormalizationRecord(
        command_index=index,
        original_type=original_type,
        canonical_type=canonical_type,
        field_changes=record_changes,
        derived_fields=record_derived,
        note="; ".join(notes),
    )


def normalize_bundle(commands: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[NormalizationRecord]]:
    """Normalize every command in a bundle. Returns the rewritten list + records."""
    out: list[dict[str, Any]] = []
    records: list[NormalizationRecord] = []
    for i, cmd in enumerate(commands):
        normalized, rec = normalize_command(cmd, i)
        out.append(normalized)
        if rec is not None:
            records.append(rec)
    return out, records


def format_records(records: list[NormalizationRecord]) -> str:
    if not records:
        return "(no normalizations)"
    lines = []
    for r in records:
        lines.append(f"  [{r.command_index}] {r.original_type} → {r.canonical_type}: {r.note}")
    return "\n".join(lines)
