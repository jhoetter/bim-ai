"""FED-01 polish — revision pinning + drift exposed via snapshot.linkSourceRevisions."""

from __future__ import annotations

from bim_ai.commands import UpdateLinkModelCmd
from bim_ai.document import Document
from bim_ai.elements import LinkModelElem, Vec3Mm
from bim_ai.engine import apply_inplace, try_commit


def test_create_link_model_can_pin_to_a_revision():
    ok, new_doc, _c, _v, code = try_commit(
        Document(revision=1, elements={}),
        {
            "type": "createLinkModel",
            "id": "link-1",
            "sourceModelId": "55555555-5555-5555-5555-555555555555",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "sourceModelRevision": 5,
        },
    )
    assert ok, code
    assert new_doc is not None
    link = new_doc.elements["link-1"]
    assert isinstance(link, LinkModelElem)
    assert link.source_model_revision == 5


def test_update_link_model_can_unpin_via_explicit_null():
    base = Document(revision=1, elements={})
    base.elements["link-1"] = LinkModelElem(
        id="link-1",
        sourceModelId="55555555-5555-5555-5555-555555555555",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
        sourceModelRevision=5,
    )
    cmd = UpdateLinkModelCmd(linkId="link-1", sourceModelRevision=None)
    apply_inplace(base, cmd)
    after = base.elements["link-1"]
    assert isinstance(after, LinkModelElem)
    # Explicit None means "follow latest" — the field should be None.
    assert after.source_model_revision is None


def test_update_link_model_can_bump_pinned_revision_for_drift_update():
    """User clicks "Update" on a drift badge → pinnedRev advances to the
    current source revision."""

    base = Document(revision=1, elements={})
    base.elements["link-1"] = LinkModelElem(
        id="link-1",
        sourceModelId="55555555-5555-5555-5555-555555555555",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
        sourceModelRevision=5,
    )
    apply_inplace(base, UpdateLinkModelCmd(linkId="link-1", sourceModelRevision=7))
    after = base.elements["link-1"]
    assert isinstance(after, LinkModelElem)
    assert after.source_model_revision == 7


def test_link_source_revisions_field_keys_and_values_are_serializable():
    """The snapshot's linkSourceRevisions field is a {uuid: int} dict —
    smoke-tested by serialising a representative dict the route would emit."""

    payload = {
        "modelId": "00000000-0000-0000-0000-0000000000aa",
        "revision": 12,
        "elements": {},
        "violations": [],
        "linkSourceRevisions": {
            "55555555-5555-5555-5555-555555555555": 7,
        },
    }
    import json

    rt = json.loads(json.dumps(payload))
    assert rt["linkSourceRevisions"]["55555555-5555-5555-5555-555555555555"] == 7
