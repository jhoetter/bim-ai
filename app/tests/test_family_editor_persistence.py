from __future__ import annotations

from bim_ai.commands import UpsertFamilyTypeCmd
from bim_ai.document import Document
from bim_ai.elements import FamilyTypeElem
from bim_ai.engine import apply_inplace


def test_upsert_family_type_preserves_authored_family_identity_and_document() -> None:
    doc = Document(revision=1, elements={})
    authored_document = {
        "id": "fam:casework:bench",
        "name": "Parametric Bench",
        "template": "furniture",
        "params": [{"key": "Width", "type": "length_mm", "default": 1200}],
        "familyTypes": [{"id": "family-type-1", "name": "1200 Bench", "values": {"Width": 1200}}],
    }

    apply_inplace(
        doc,
        UpsertFamilyTypeCmd(
            type="upsertFamilyType",
            id="ft-bench",
            name="1200 Bench",
            familyId="fam:casework:bench",
            discipline="generic",
            parameters={
                "name": "1200 Bench",
                "familyId": "fam:casework:bench",
                "Width": 1200,
                "__familyEditorDocument": authored_document,
            },
        ),
    )

    family_type = doc.elements["ft-bench"]
    assert isinstance(family_type, FamilyTypeElem)
    assert family_type.name == "1200 Bench"
    assert family_type.family_id == "fam:casework:bench"
    assert family_type.parameters["__familyEditorDocument"]["id"] == "fam:casework:bench"
