"""TKN-V3-01 — validate acceptance tests."""

from __future__ import annotations

from bim_ai.elements import (
    DoorElem,
    LevelElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.tkn import encode, validate
from bim_ai.tkn.types import EntityToken, TknScale, TokenSequence


def _good_elements() -> dict:
    return {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
        "wall-1": WallElem(
            kind="wall",
            id="wall-1",
            name="Wall",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=5000, yMm=0),
            thicknessMm=200,
            heightMm=2800,
        ),
        "door-1": DoorElem(
            kind="door",
            id="door-1",
            name="Door",
            wallId="wall-1",
            alongT=0.4,
            widthMm=900,
        ),
    }


def test_validate_clean_sequence_no_advisories() -> None:
    els = _good_elements()
    seq = encode(els)
    advisories = validate(seq, els)
    assert advisories == []


def test_validate_orphan_host_emits_advisory() -> None:
    """Acceptance criterion (d): token referencing deleted host → tkn_orphan_host."""
    els = _good_elements()
    seq = encode(els)

    # Simulate state where wall-1 is gone
    els_without_wall = {k: v for k, v in els.items() if k != "wall-1"}
    advisories = validate(seq, els_without_wall)

    orphan_codes = [a.code for a in advisories]
    assert "tkn_orphan_host" in orphan_codes
    orphan = next(a for a in advisories if a.code == "tkn_orphan_host")
    assert orphan.element_id == "door-1"


def test_validate_without_kernel_state_skips_host_checks() -> None:
    """validate(seq) without kernel_state only checks structural constraints."""
    # Build a sequence with an arbitrary hostId — no orphan check
    tok = EntityToken(
        elementId="x-1",
        hostId="nonexistent-host",
        hostKind="wall",
        tAlongHost=0.5,
        offsetNormalMm=0.0,
        scale=TknScale(),
        rotationRad=0.0,
        classKey="door",
    )
    seq = TokenSequence(schemaVersion="tkn-v3.0", envelopes=[], entities=[tok])
    advisories = validate(seq)
    # No kernel_state provided → no tkn_orphan_host
    assert all(a.code != "tkn_orphan_host" for a in advisories)


def test_validate_orphan_envelope_room() -> None:
    """Envelope with unknown roomId emits tkn_orphan_host."""
    from bim_ai.tkn.types import EnvelopeToken

    env = EnvelopeToken(
        roomId="ghost-room",
        roomTypeKey="room",
        layoutAttrs={},
        hostWallIds=[],
        hostFloorId=None,
        doorIds=[],
        windowIds=[],
    )
    seq = TokenSequence(schemaVersion="tkn-v3.0", envelopes=[env], entities=[])
    advisories = validate(seq, {})
    assert any(a.code == "tkn_orphan_host" and a.element_id == "ghost-room" for a in advisories)
