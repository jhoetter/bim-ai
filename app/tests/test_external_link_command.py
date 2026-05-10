"""F-024 — generic IFC/PDF/image external-link command behavior."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import ExternalLinkElem
from bim_ai.engine import try_commit_bundle
from bim_ai.routes_commands import _expand_external_link_reload_command


def test_create_external_link_accepts_ifc_pdf_and_image_variants() -> None:
    doc = Document(revision=1, elements={})
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createExternalLink",
                "id": "ifc-link",
                "name": "Coordination IFC",
                "externalLinkType": "ifc",
                "sourcePath": "/models/coordination.ifc",
                "sourceName": "coordination.ifc",
                "sourceMetadata": {"sizeBytes": 1200},
                "reloadStatus": "ok",
                "originMm": {"xMm": 10.0, "yMm": 20.0},
                "originAlignmentMode": "project_origin",
            },
            {
                "type": "createExternalLink",
                "id": "pdf-link",
                "externalLinkType": "pdf",
                "sourcePath": "/underlays/site.pdf",
                "overlayOpacity": 0.4,
            },
            {
                "type": "createExternalLink",
                "id": "image-link",
                "externalLinkType": "image",
                "sourcePath": "/underlays/scan.png",
                "loaded": False,
            },
        ],
    )

    assert ok is True, code
    assert new_doc is not None
    ifc = new_doc.elements["ifc-link"]
    assert isinstance(ifc, ExternalLinkElem)
    assert ifc.external_link_type == "ifc"
    assert ifc.source_name == "coordination.ifc"
    assert ifc.source_metadata["sizeBytes"] == 1200
    assert ifc.reload_status == "ok"
    assert ifc.origin_mm is not None
    assert ifc.origin_mm.x_mm == 10.0
    assert ifc.origin_alignment_mode == "project_origin"

    pdf = new_doc.elements["pdf-link"]
    assert isinstance(pdf, ExternalLinkElem)
    assert pdf.external_link_type == "pdf"
    assert pdf.overlay_opacity == 0.4

    image = new_doc.elements["image-link"]
    assert isinstance(image, ExternalLinkElem)
    assert image.external_link_type == "image"
    assert image.loaded is False


def test_update_external_link_persists_status_path_visibility_and_alignment() -> None:
    doc = Document(revision=1, elements={})
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createExternalLink",
                "id": "pdf-link",
                "externalLinkType": "pdf",
                "sourcePath": "/old/site.pdf",
            },
            {
                "type": "updateExternalLink",
                "linkId": "pdf-link",
                "sourcePath": "/new/site.pdf",
                "sourceName": "site.pdf",
                "sourceMetadata": {"sizeBytes": 99},
                "reloadStatus": "ok",
                "lastReloadMessage": "Reloaded",
                "loaded": True,
                "hidden": True,
                "originAlignmentMode": "shared_coords",
                "overlayOpacity": 0.75,
            },
        ],
    )

    assert ok is True, code
    assert new_doc is not None
    link = new_doc.elements["pdf-link"]
    assert isinstance(link, ExternalLinkElem)
    assert link.source_path == "/new/site.pdf"
    assert link.source_name == "site.pdf"
    assert link.source_metadata["sizeBytes"] == 99
    assert link.reload_status == "ok"
    assert link.last_reload_message == "Reloaded"
    assert link.loaded is True
    assert link.hidden is True
    assert link.origin_alignment_mode == "shared_coords"
    assert link.overlay_opacity == 0.75


def test_external_link_rejects_bad_type_empty_path_and_pinned_delete() -> None:
    bad_type_ok, _new_doc, _cmds, _viols, bad_type_code = try_commit_bundle(
        Document(revision=1, elements={}),
        [
            {
                "type": "createExternalLink",
                "externalLinkType": "dwg",
                "sourcePath": "/bad.dwg",
            }
        ],
    )
    assert bad_type_ok is False
    assert "externalLinkType" in bad_type_code

    empty_path_ok, _new_doc, _cmds, _viols, empty_path_code = try_commit_bundle(
        Document(revision=1, elements={}),
        [
            {
                "type": "createExternalLink",
                "externalLinkType": "ifc",
                "sourcePath": "",
            }
        ],
    )
    assert empty_path_ok is False
    assert "sourcePath must be non-empty" in empty_path_code

    pinned_ok, _new_doc, _cmds, _viols, pinned_code = try_commit_bundle(
        Document(revision=1, elements={}),
        [
            {
                "type": "createExternalLink",
                "id": "ifc-link",
                "externalLinkType": "ifc",
                "sourcePath": "/model.ifc",
                "pinned": True,
            },
            {"type": "deleteExternalLink", "linkId": "ifc-link"},
        ],
    )
    assert pinned_ok is False
    assert "pinned_element_blocked" in pinned_code


def test_external_link_reload_source_updates_metadata(tmp_path) -> None:
    source = tmp_path / "sheet.pdf"
    source.write_bytes(b"%PDF-1.4\n")
    doc = Document(revision=1, elements={})
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createExternalLink",
                "id": "pdf-link",
                "externalLinkType": "pdf",
                "sourcePath": str(source),
                "loaded": False,
            }
        ],
    )
    assert ok is True, code
    assert new_doc is not None

    expanded = _expand_external_link_reload_command(
        new_doc,
        {"type": "updateExternalLink", "linkId": "pdf-link", "reloadSource": True},
    )

    assert expanded["reloadStatus"] == "ok"
    assert expanded["loaded"] is True
    assert expanded["sourceName"] == "sheet.pdf"
    assert expanded["sourceMetadata"]["sizeBytes"] == len(b"%PDF-1.4\n")
