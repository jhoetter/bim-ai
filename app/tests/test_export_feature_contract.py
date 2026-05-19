from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FamilyInstanceElem,
    FloorElem,
    LevelElem,
    RailingElem,
    RoofElem,
    RoofOpeningElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.export_feature_contract import build_export_manifest_feature_diagnostics_v1
from bim_ai.export_gltf import build_visual_export_manifest
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload


def _contract_drift_doc() -> Document:
    return Document(
        revision=501,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl-a": FloorElem(
                kind="floor",
                id="fl-a",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2600},
                    {"xMm": 0, "yMm": 2600},
                ],
            ),
            "roof-a": RoofElem(
                kind="roof",
                id="roof-a",
                name="R",
                referenceLevelId="lvl-g",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2600},
                    {"xMm": 0, "yMm": 2600},
                ],
            ),
            "roof-open-a": RoofOpeningElem(
                kind="roof_opening",
                id="roof-open-a",
                hostRoofId="roof-a",
                boundaryMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 1500, "yMm": 1000},
                    {"xMm": 1500, "yMm": 1500},
                    {"xMm": 1000, "yMm": 1500},
                ],
            ),
            "door-bad": DoorElem(
                kind="door",
                id="door-bad",
                name="Detached",
                wallId="missing-wall",
                alongT=0.5,
                widthMm=900,
            ),
            "rail-a": RailingElem(
                kind="railing",
                id="rail-a",
                pathMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=3000, yMm=0)],
            ),
            "fam-a": FamilyInstanceElem(
                kind="family_instance",
                id="fam-a",
                name="Casework",
                familyTypeId="ft-a",
                positionMm={"xMm": 1200, "yMm": 800},
            ),
        },
    )


def _rows_by_feature(rows: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    out: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        out.setdefault(str(row.get("feature")), []).append(row)
    return out


def test_gltf_export_contract_reports_skips_unsupported_features_and_drift() -> None:
    diagnostics = build_export_manifest_feature_diagnostics_v1(
        _contract_drift_doc(),
        export_format="gltf",
    )

    unsupported = diagnostics["exportGeometryUnsupportedSkipped_v1"]["unsupportedRows"]
    unsupported_by_feature = _rows_by_feature(unsupported)
    assert {row["elementKind"] for row in unsupported_by_feature["roof-opening"]} == {
        "roof_opening"
    }
    assert {row["elementKind"] for row in unsupported_by_feature["railing-geometry"]} == {
        "railing"
    }
    assert {row["elementKind"] for row in unsupported_by_feature["family-instance"]} == {
        "family_instance"
    }

    skipped = diagnostics["exportGeometryUnsupportedSkipped_v1"]["skippedRows"]
    assert skipped == [
        {
            "exportFormat": "gltf",
            "elementKind": "door",
            "feature": "wall-cut",
            "reasonCode": "door_missing_host_wall",
            "count": 1,
            "elementIds": ["door-bad"],
        }
    ]

    drift_rows = diagnostics["rendererExportContractDrift_v1"]["driftRows"]
    drift_features = {row["feature"] for row in drift_rows}
    assert {"roof-opening", "railing-geometry", "family-instance"} <= drift_features
    assert all(row["diagnosticCode"] == "renderer.export_contract.viewport_export_drift" for row in drift_rows)


def test_ifc_export_contract_reports_ifc_specific_unsupported_features() -> None:
    diagnostics = build_export_manifest_feature_diagnostics_v1(
        _contract_drift_doc(),
        export_format="ifc",
    )
    unsupported = diagnostics["exportGeometryUnsupportedSkipped_v1"]["unsupportedRows"]
    unsupported_kinds = {row["elementKind"] for row in unsupported}
    assert "railing" in unsupported_kinds
    assert "family_instance" in unsupported_kinds
    assert "roof_opening" not in unsupported_kinds

    drift_features = {
        row["feature"] for row in diagnostics["rendererExportContractDrift_v1"]["driftRows"]
    }
    assert "railing-geometry" in drift_features
    assert "family-instance" in drift_features
    assert "roof-opening" not in drift_features


def test_export_manifests_embed_feature_contract_diagnostics() -> None:
    doc = _contract_drift_doc()

    gltf_ext = build_visual_export_manifest(doc)["extensions"]["BIM_AI_exportManifest_v0"]
    assert gltf_ext["exportFeatureSupportMatrix_v1"]["format"] == "exportFeatureSupportMatrix_v1"
    assert gltf_ext["exportGeometryUnsupportedSkipped_v1"]["summary"]["unsupportedElementCount"] >= 3
    assert gltf_ext["rendererExportContractDrift_v1"]["summary"]["driftRowCount"] >= 3

    ifc_manifest = build_ifc_exchange_manifest_payload(doc)
    assert ifc_manifest["exportFeatureSupportMatrix_v1"]["format"] == "exportFeatureSupportMatrix_v1"
    assert ifc_manifest["exportGeometryUnsupportedSkipped_v1"]["summary"]["unsupportedElementCount"] >= 2
    assert ifc_manifest["rendererExportContractDrift_v1"]["summary"]["driftRowCount"] >= 2
