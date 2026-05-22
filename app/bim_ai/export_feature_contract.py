"""Shared export/renderer feature diagnostics for exchange manifests.

The rows here are intentionally document-derived and offline-safe. They do not
prove a STEP/glTF artifact round-trip; they make skipped or unsupported geometry
explicit in manifests before readback is available.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    PlacedAssetElem,
    RoofElem,
    RoofOpeningElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)

ExportFormat = Literal["gltf", "ifc"]
SupportStatus = Literal["supported", "partial", "unsupported", "not_applicable"]

_IGNORED_NON_GEOMETRY_KINDS = frozenset(
    {
        "asset_library_entry",
        "family_type",
        "floor_type",
        "level",
        "material",
        "roof_type",
        "schedule",
        "site",
        "validation_rule",
        "viewpoint",
        "wall_type",
    }
)


@dataclass(frozen=True, slots=True)
class ExportFeatureContractRow:
    id: str
    element_kind: str
    feature: str
    required_kinds: tuple[str, ...]
    viewport3d: SupportStatus
    gltf_export: SupportStatus
    ifc_export: SupportStatus
    diagnostic_codes: tuple[str, ...]
    tracker_items: tuple[str, ...]
    limitation: str

    def export_status(self, export_format: ExportFormat) -> SupportStatus:
        return self.gltf_export if export_format == "gltf" else self.ifc_export

    def to_manifest_row(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "elementKind": self.element_kind,
            "feature": self.feature,
            "requiredElementKinds": list(self.required_kinds),
            "surface": {
                "viewport3d": self.viewport3d,
                "gltfExport": self.gltf_export,
                "ifcExport": self.ifc_export,
            },
            "diagnosticCodes": list(self.diagnostic_codes),
            "trackerItems": list(self.tracker_items),
            "limitation": self.limitation,
        }


EXPORT_FEATURE_CONTRACT: tuple[ExportFeatureContractRow, ...] = (
    ExportFeatureContractRow(
        id="efc-hosted-wall-cut",
        element_kind="door/window",
        feature="wall-cut",
        required_kinds=("door", "window"),
        viewport3d="partial",
        gltf_export="partial",
        ifc_export="partial",
        diagnostic_codes=(
            "renderer.hosted_opening.no_cut",
            "export.geometry.hosted_opening_skipped",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-I02"),
        limitation="Hosted inserts require a resolvable wall; missing hosts are skipped by exports.",
    ),
    ExportFeatureContractRow(
        id="efc-roof-opening",
        element_kind="roof_opening",
        feature="roof-opening",
        required_kinds=("roof_opening",),
        viewport3d="partial",
        gltf_export="unsupported",
        ifc_export="partial",
        diagnostic_codes=(
            "renderer.roof_opening.unsupported",
            "export.geometry.roof_opening_unsupported",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J02"),
        limitation="glTF export does not yet physicalize roof-hosted void geometry.",
    ),
    ExportFeatureContractRow(
        id="efc-slab-opening",
        element_kind="slab_opening",
        feature="slab-opening",
        required_kinds=("slab_opening",),
        viewport3d="partial",
        gltf_export="partial",
        ifc_export="partial",
        diagnostic_codes=(
            "renderer.slab_opening.unsupported",
            "export.geometry.slab_opening_skipped",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J03"),
        limitation="Slab openings require a slab-capable floor host and a polygonal boundary.",
    ),
    ExportFeatureContractRow(
        id="efc-stair-geometry",
        element_kind="stair",
        feature="stair-geometry",
        required_kinds=("stair",),
        viewport3d="partial",
        gltf_export="partial",
        ifc_export="partial",
        diagnostic_codes=(
            "renderer.stair_geometry.degraded",
            "export.geometry.stair_skipped",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J04"),
        limitation="Straight stair prism support is present; advanced stair forms remain approximated.",
    ),
    ExportFeatureContractRow(
        id="efc-railing-geometry",
        element_kind="railing",
        feature="railing-geometry",
        required_kinds=("railing",),
        viewport3d="partial",
        gltf_export="unsupported",
        ifc_export="unsupported",
        diagnostic_codes=(
            "renderer.railing_geometry.unsupported",
            "export.geometry.railing_unsupported",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J04"),
        limitation="Viewport diagnostics know railings, but exchange exporters do not emit railing bodies yet.",
    ),
    ExportFeatureContractRow(
        id="efc-family-instance",
        element_kind="family_instance",
        feature="family-instance",
        required_kinds=("family_instance",),
        viewport3d="partial",
        gltf_export="unsupported",
        ifc_export="unsupported",
        diagnostic_codes=(
            "renderer.family_instance.unsupported",
            "export.geometry.family_instance_unsupported",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J05"),
        limitation="Family instances can have viewport proxies, but exchange exporters lack family body mapping.",
    ),
    ExportFeatureContractRow(
        id="efc-placed-asset",
        element_kind="placed_asset",
        feature="family-instance",
        required_kinds=("placed_asset",),
        viewport3d="partial",
        gltf_export="unsupported",
        ifc_export="partial",
        diagnostic_codes=(
            "renderer.family_instance.proxy_fallback",
            "export.geometry.placed_asset_unsupported",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J05"),
        limitation="IFC can emit placed assets with library entries; glTF export does not emit asset proxies yet.",
    ),
    ExportFeatureContractRow(
        id="efc-room-visualization",
        element_kind="room",
        feature="room-visualization",
        required_kinds=("room",),
        viewport3d="partial",
        gltf_export="partial",
        ifc_export="partial",
        diagnostic_codes=(
            "renderer.room_visualization.degraded",
            "export.geometry.room_skipped",
        ),
        tracker_items=("BIR-K01", "BIR-K03", "BIR-J06"),
        limitation="Rooms require polygonal outlines for exportable space/visualization evidence.",
    ),
)


def _kind_counts(doc: Document) -> dict[str, int]:
    counts: dict[str, int] = {}
    for elem in doc.elements.values():
        kind = str(getattr(elem, "kind", ""))
        counts[kind] = counts.get(kind, 0) + 1
    return dict(sorted(counts.items()))


def _ids_by_kind(doc: Document) -> dict[str, list[str]]:
    ids: dict[str, list[str]] = {}
    for elem_id, elem in doc.elements.items():
        kind = str(getattr(elem, "kind", ""))
        ids.setdefault(kind, []).append(str(getattr(elem, "id", elem_id)))
    return {kind: sorted(set(values)) for kind, values in sorted(ids.items())}


def _contract_by_kind() -> dict[str, ExportFeatureContractRow]:
    out: dict[str, ExportFeatureContractRow] = {}
    for row in EXPORT_FEATURE_CONTRACT:
        for kind in row.required_kinds:
            out[kind] = row
    return out


def _add_grouped_row(
    rows: dict[tuple[str, str, str], set[str]],
    *,
    element_kind: str,
    feature: str,
    reason_code: str,
    element_id: str,
) -> None:
    rows.setdefault((element_kind, feature, reason_code), set()).add(element_id)


def _is_slab_capable_floor(elem: Any) -> bool:
    return isinstance(elem, FloorElem) and len(getattr(elem, "boundary_mm", ()) or ()) >= 3


def _export_skipped_rows(doc: Document, export_format: ExportFormat) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str], set[str]] = {}
    wall_ids = {eid for eid, elem in doc.elements.items() if isinstance(elem, WallElem)}
    level_ids = {eid for eid, elem in doc.elements.items() if isinstance(elem, LevelElem)}
    floor_ids = {eid for eid, elem in doc.elements.items() if _is_slab_capable_floor(elem)}
    roof_ids = {
        eid
        for eid, elem in doc.elements.items()
        if isinstance(elem, RoofElem) and len(getattr(elem, "footprint_mm", ()) or ()) >= 3
    }
    asset_library_ids = {
        eid
        for eid, elem in doc.elements.items()
        if str(getattr(elem, "kind", "")) == "asset_library_entry"
    }

    for elem in doc.elements.values():
        elem_id = str(getattr(elem, "id", ""))
        if isinstance(elem, DoorElem) and elem.wall_id not in wall_ids:
            _add_grouped_row(
                grouped,
                element_kind="door",
                feature="wall-cut",
                reason_code="door_missing_host_wall",
                element_id=elem_id,
            )
        elif isinstance(elem, WindowElem) and elem.wall_id not in wall_ids:
            _add_grouped_row(
                grouped,
                element_kind="window",
                feature="wall-cut",
                reason_code="window_missing_host_wall",
                element_id=elem_id,
            )
        elif isinstance(elem, SlabOpeningElem):
            bad_host = elem.host_floor_id not in floor_ids
            bad_outline = len(getattr(elem, "boundary_mm", ()) or ()) < 3
            if bad_host or bad_outline:
                reason = (
                    "slab_opening_missing_host_floor" if bad_host else "slab_opening_bad_outline"
                )
                _add_grouped_row(
                    grouped,
                    element_kind="slab_opening",
                    feature="slab-opening",
                    reason_code=reason,
                    element_id=elem_id,
                )
        elif isinstance(elem, RoofElem) and len(getattr(elem, "footprint_mm", ()) or ()) < 3:
            _add_grouped_row(
                grouped,
                element_kind="roof",
                feature="roof-geometry",
                reason_code="roof_bad_footprint",
                element_id=elem_id,
            )
        elif isinstance(elem, RoofOpeningElem):
            bad_host = elem.host_roof_id not in roof_ids
            bad_outline = len(getattr(elem, "boundary_mm", ()) or ()) < 3
            if bad_host or bad_outline:
                reason = (
                    "roof_opening_missing_host_roof" if bad_host else "roof_opening_bad_outline"
                )
                _add_grouped_row(
                    grouped,
                    element_kind="roof_opening",
                    feature="roof-opening",
                    reason_code=reason,
                    element_id=elem_id,
                )
        elif isinstance(elem, RoomElem) and len(getattr(elem, "outline_mm", ()) or ()) < 3:
            _add_grouped_row(
                grouped,
                element_kind="room",
                feature="room-visualization",
                reason_code="room_bad_outline",
                element_id=elem_id,
            )
        elif (
            isinstance(elem, StairElem)
            and export_format == "ifc"
            and (elem.base_level_id not in level_ids or elem.top_level_id not in level_ids)
        ):
            _add_grouped_row(
                grouped,
                element_kind="stair",
                feature="stair-geometry",
                reason_code="stair_missing_level",
                element_id=elem_id,
            )
        elif (
            isinstance(elem, PlacedAssetElem)
            and export_format == "ifc"
            and elem.asset_id not in asset_library_ids
        ):
            _add_grouped_row(
                grouped,
                element_kind="placed_asset",
                feature="family-instance",
                reason_code="placed_asset_missing_library_entry",
                element_id=elem_id,
            )

    out: list[dict[str, Any]] = []
    for (element_kind, feature, reason_code), ids in sorted(grouped.items()):
        out.append(
            {
                "exportFormat": export_format,
                "elementKind": element_kind,
                "feature": feature,
                "reasonCode": reason_code,
                "count": len(ids),
                "elementIds": sorted(ids),
            }
        )
    return out


def _export_unsupported_rows(doc: Document, export_format: ExportFormat) -> list[dict[str, Any]]:
    ids_by_kind = _ids_by_kind(doc)
    contract = _contract_by_kind()
    rows: list[dict[str, Any]] = []

    for kind, ids in ids_by_kind.items():
        row = contract.get(kind)
        if row is None:
            if kind in _IGNORED_NON_GEOMETRY_KINDS:
                continue
            rows.append(
                {
                    "exportFormat": export_format,
                    "elementKind": kind,
                    "feature": "document-kind",
                    "reasonCode": f"{export_format}_unsupported_document_kind",
                    "supportStatus": "unsupported",
                    "count": len(ids),
                    "elementIds": ids,
                    "trackerItems": ["BIR-K01"],
                }
            )
            continue

        export_status = row.export_status(export_format)
        if export_status == "unsupported":
            rows.append(
                {
                    "exportFormat": export_format,
                    "elementKind": kind,
                    "feature": row.feature,
                    "reasonCode": f"{export_format}_{row.feature.replace('-', '_')}_unsupported",
                    "supportStatus": export_status,
                    "count": len(ids),
                    "elementIds": ids,
                    "diagnosticCodes": list(row.diagnostic_codes),
                    "trackerItems": list(row.tracker_items),
                }
            )

    return sorted(rows, key=lambda item: (item["elementKind"], item["feature"], item["reasonCode"]))


def _has_applicable_elements(counts_by_kind: dict[str, int], row: ExportFeatureContractRow) -> bool:
    return any(counts_by_kind.get(kind, 0) > 0 for kind in row.required_kinds)


def _affected_ids(ids_by_kind: dict[str, list[str]], row: ExportFeatureContractRow) -> list[str]:
    ids: list[str] = []
    for kind in row.required_kinds:
        ids.extend(ids_by_kind.get(kind, []))
    return sorted(set(ids))


def _is_viewport_export_drift(row: ExportFeatureContractRow, export_format: ExportFormat) -> bool:
    viewport_can_render = row.viewport3d in {"supported", "partial"}
    export_can_emit = row.export_status(export_format) in {"supported", "partial"}
    return viewport_can_render != export_can_emit


def build_export_manifest_feature_diagnostics_v1(
    doc: Document,
    *,
    export_format: ExportFormat,
) -> dict[str, Any]:
    counts_by_kind = _kind_counts(doc)
    ids_by_kind = _ids_by_kind(doc)
    applicable_contract = [
        row for row in EXPORT_FEATURE_CONTRACT if _has_applicable_elements(counts_by_kind, row)
    ]
    unsupported_rows = _export_unsupported_rows(doc, export_format)
    skipped_rows = _export_skipped_rows(doc, export_format)

    drift_rows: list[dict[str, Any]] = []
    for row in applicable_contract:
        if not _is_viewport_export_drift(row, export_format):
            continue
        export_status = row.export_status(export_format)
        affected_ids = _affected_ids(ids_by_kind, row)
        drift_rows.append(
            {
                "exportFormat": export_format,
                "contractId": row.id,
                "elementKind": row.element_kind,
                "feature": row.feature,
                "requiredElementKinds": list(row.required_kinds),
                "viewport3dSupport": row.viewport3d,
                "exportSupport": export_status,
                "affectedElementIds": affected_ids,
                "affectedElementCount": len(affected_ids),
                "diagnosticCode": "renderer.export_contract.viewport_export_drift",
                "message": (
                    f"Viewport 3D support for {row.feature} is {row.viewport3d}, "
                    f"but {export_format} export support is {export_status}."
                ),
                "trackerItems": sorted(set(row.tracker_items) | {"BIR-K03"}),
            }
        )

    return {
        "exportFeatureSupportMatrix_v1": {
            "format": "exportFeatureSupportMatrix_v1",
            "rows": [row.to_manifest_row() for row in applicable_contract],
        },
        "exportGeometryUnsupportedSkipped_v1": {
            "format": "exportGeometryUnsupportedSkipped_v1",
            "exportFormat": export_format,
            "unsupportedRows": unsupported_rows,
            "skippedRows": skipped_rows,
            "summary": {
                "unsupportedRowCount": len(unsupported_rows),
                "unsupportedElementCount": sum(int(row["count"]) for row in unsupported_rows),
                "skippedRowCount": len(skipped_rows),
                "skippedElementCount": sum(int(row["count"]) for row in skipped_rows),
            },
        },
        "rendererExportContractDrift_v1": {
            "format": "rendererExportContractDrift_v1",
            "exportFormat": export_format,
            "driftRows": drift_rows,
            "summary": {
                "driftRowCount": len(drift_rows),
                "affectedElementCount": sum(int(row["affectedElementCount"]) for row in drift_rows),
            },
        },
    }
