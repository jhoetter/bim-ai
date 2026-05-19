from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from typing import Any, Literal

from pydantic import BaseModel

try:  # Imported lazily by callers in normal app code; keep this module pure-data.
    from bim_ai.document import Document
except Exception:  # pragma: no cover - protects schema rebuild edge cases in tooling.
    Document = Any  # type: ignore[misc,assignment]


IntegritySeverity = Literal["error", "warning", "info"]
ModelRole = Literal[
    "physical",
    "analytical",
    "helper",
    "annotation",
    "documentation",
    "imported_proxy",
    "type_definition",
    "project_datum",
    "issue",
    "configuration",
    "presentation",
]


@dataclass(frozen=True)
class ModelIntegrityFinding:
    rule_id: str
    severity: IntegritySeverity
    message: str
    element_ids: tuple[str, ...] = ()
    field: str | None = None
    expected: str | None = None
    actual: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["ruleId"] = payload.pop("rule_id")
        payload["elementIds"] = list(payload.pop("element_ids"))
        tracker_items = _tracker_items_for_rule(payload["ruleId"])
        if tracker_items:
            payload["trackerItems"] = tracker_items
        recommendation = _recommendation_for_rule(payload["ruleId"])
        if recommendation:
            payload["recommendation"] = recommendation
        return {key: value for key, value in payload.items() if value is not None}


@dataclass(frozen=True)
class ReferenceSpec:
    field: str
    allowed_kinds: frozenset[str] | None = None
    required: bool = False
    many: bool = False
    validate_only_if_target_kind_exists: str | None = None
    source_kinds: frozenset[str] | None = None


PHYSICAL_KINDS: frozenset[str] = frozenset(
    {
        "wall",
        "door",
        "window",
        "wall_opening",
        "floor",
        "roof",
        "stair",
        "slab_opening",
        "roof_opening",
        "railing",
        "balcony",
        "sweep",
        "dormer",
        "soffit",
        "text_3d",
        "family_instance",
        "column",
        "beam",
        "ceiling",
        "mass",
        "void_cut",
        "placed_asset",
        "family_kit_instance",
        "pipe",
        "duct",
        "cable_tray",
        "mep_equipment",
        "fixture",
        "mep_terminal",
        "mep_opening_request",
    }
)

ANALYTICAL_KINDS: frozenset[str] = frozenset(
    {
        "room",
    }
)

HELPER_KINDS: frozenset[str] = frozenset(
    {
        "room_separation",
        "plan_region",
        "selection_set",
        "clash_test",
        "validation_rule",
        "agent_assumption",
        "agent_deviation",
        "constructability_suppression",
        "constructability_issue",
        "roof_join",
        "edge_profile_run",
        "concept_seed",
        "neighborhood_import_session",
    }
)

ANNOTATION_KINDS: frozenset[str] = frozenset(
    {
        "dimension",
        "angular_dimension",
        "placed_tag",
        "detail_line",
        "detail_region",
        "text_note",
        "annotation_symbol",
        "masking_region",
        "revision_cloud",
        "spot_elevation",
        "spot_coordinate",
        "spot_slope",
        "insulation_annotation",
        "material_tag",
        "multi_category_tag",
        "tread_number",
        "keynote",
        "span_direction",
        "detail_component",
        "repeating_detail",
        "detail_group",
        "color_fill_legend",
        "radial_dimension",
        "diameter_dimension",
        "arc_length_dimension",
    }
)

DOCUMENTATION_KINDS: frozenset[str] = frozenset(
    {
        "viewpoint",
        "section_cut",
        "elevation_view",
        "plan_view",
        "view_template",
        "sheet",
        "schedule",
        "callout",
        "bcf",
        "window_legend_view",
        "view",
        "frame",
        "saved_view",
        "presentation_canvas",
        "presentation_link",
    }
)

TYPE_DEFINITION_KINDS: frozenset[str] = frozenset(
    {
        "wall_type",
        "floor_type",
        "roof_type",
        "family_type",
        "tag_definition",
        "plan_tag_style",
        "titleblock_type",
        "asset_library_entry",
        "hatch_pattern_def",
        "material",
        "property_definition",
        "brand_template",
        "pipe_legend",
        "duct_legend",
    }
)

PROJECT_DATUM_KINDS: frozenset[str] = frozenset(
    {
        "project_settings",
        "level",
        "grid_line",
        "reference_plane",
        "property_line",
        "project_base_point",
        "survey_point",
        "internal_origin",
        "sun_settings",
        "phase",
        "site",
        "toposolid",
        "toposolid_subdivision",
        "graded_region",
        "toposolid_excavation",
        "area",
        "room_color_scheme",
        "renovation_scenario",
        "building_services_handoff",
    }
)

IMPORTED_PROXY_KINDS: frozenset[str] = frozenset(
    {
        "link_model",
        "link_dxf",
        "link_external",
        "external_link",
        "image_underlay",
        "neighborhood_mass",
    }
)

ISSUE_KINDS: frozenset[str] = frozenset({"issue", "construction_qa_checklist"})
CONFIGURATION_KINDS: frozenset[str] = frozenset(
    {"constraint", "join_geometry", "construction_package", "construction_logistics"}
)
PRESENTATION_KINDS: frozenset[str] = frozenset({"image_asset", "decal"})

ROLE_BY_KIND: dict[str, ModelRole] = {
    **{kind: "physical" for kind in PHYSICAL_KINDS},
    **{kind: "analytical" for kind in ANALYTICAL_KINDS},
    **{kind: "helper" for kind in HELPER_KINDS},
    **{kind: "annotation" for kind in ANNOTATION_KINDS},
    **{kind: "documentation" for kind in DOCUMENTATION_KINDS},
    **{kind: "type_definition" for kind in TYPE_DEFINITION_KINDS},
    **{kind: "project_datum" for kind in PROJECT_DATUM_KINDS},
    **{kind: "imported_proxy" for kind in IMPORTED_PROXY_KINDS},
    **{kind: "issue" for kind in ISSUE_KINDS},
    **{kind: "configuration" for kind in CONFIGURATION_KINDS},
    **{kind: "presentation" for kind in PRESENTATION_KINDS},
}

VALID_MODEL_ROLES: frozenset[str] = frozenset(
    {
        "physical",
        "analytical",
        "helper",
        "annotation",
        "documentation",
        "imported_proxy",
        "type_definition",
        "project_datum",
        "issue",
        "configuration",
        "presentation",
    }
)

VIEW_KINDS: frozenset[str] = frozenset(
    {
        "viewpoint",
        "plan_view",
        "section_cut",
        "elevation_view",
        "sheet",
        "schedule",
        "window_legend_view",
        "view",
    }
)

CANONICAL_LENGTH_UNIT = "millimeter"
SUPPORTED_LENGTH_UNITS: frozenset[str] = frozenset({"millimeter", "millimetre", "mm"})
SUPPORTED_SCHEMA_VERSIONS: frozenset[str] = frozenset(
    {
        "cmd-v3.0",
        "bim-ai.seed-artifact.v1",
        "sketch-understanding-ir.v0",
        "seed-dsl.v0",
        "tkn-v3.0",
    }
)
STABLE_ELEMENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")

POINT_COORDINATE_FIELDS: tuple[str, ...] = (
    "start",
    "end",
    "positionMm",
    "originMm",
    "center",
    "basePointMm",
    "surveyPointMm",
)
POINT_LIST_COORDINATE_FIELDS: tuple[str, ...] = (
    "boundaryMm",
    "footprintMm",
    "points",
    "polylineMm",
    "outlineMm",
)
FINITE_LENGTH_FIELDS: tuple[str, ...] = (
    "elevationMm",
    "offsetFromParentMm",
    "thicknessMm",
    "structureThicknessMm",
    "finishThicknessMm",
    "heightMm",
    "widthMm",
    "sillHeightMm",
    "overhangMm",
    "unitScaleToMm",
)

TYPE_INSTANCE_SPECS: dict[str, tuple[str, str, bool]] = {
    "wall": ("wallTypeId", "wall_type", False),
    "floor": ("floorTypeId", "floor_type", False),
    "roof": ("roofTypeId", "roof_type", False),
    "door": ("familyTypeId", "family_type", False),
    "window": ("familyTypeId", "family_type", False),
    "family_instance": ("familyTypeId", "family_type", True),
}

FAMILY_CONTENT_TRACKED_ITEMS: tuple[str, ...] = (
    "BIR-V01",
    "BIR-V02",
    "BIR-V03",
    "BIR-V04",
    "BIR-V05",
)
FAMILY_TYPE_SCHEMA_FIELDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("requiredDimensions", ("requiredDimensions", "dimensions")),
    ("hostSupport", ("hostSupport", "hostingMode", "hostKind")),
    ("materialSlots", ("materialSlots",)),
    ("scheduleFields", ("scheduleFields", "scheduleMetadata")),
    ("ifcMapping", ("ifcMapping",)),
    ("renderSupport", ("renderSupport", "rendererSupport")),
)
FAMILY_PARITY_FIELDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("visualGeometry", ("visualGeometry", "renderGeometry", "renderSupport")),
    ("materialSlots", ("materialSlots",)),
    ("planSymbol", ("planSymbol", "planSymbolKind")),
    ("scheduleFields", ("scheduleFields", "scheduleMetadata")),
    ("ifcMapping", ("ifcMapping",)),
    ("gltfMapping", ("gltfMapping", "exportSupport", "exportMetadata")),
)
ASSET_CATALOG_FIELDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("category", ("category",)),
    ("dimensions", ("widthMm", "thumbnailWidthMm")),
    ("clearance", ("clearanceMm", "clearanceZoneMm")),
    ("maintenanceZones", ("maintenanceZoneMm", "mepZoneMm")),
    ("materialSlots", ("materialSlots",)),
    ("renderSupport", ("renderSupport", "renderProxyKind")),
    ("scheduleFields", ("scheduleFields", "scheduleMetadata")),
    ("exportMetadata", ("exportMetadata", "ifcMapping", "gltfMapping")),
)
FAMILY_OVERRIDE_SCHEDULED_KEYS: frozenset[str] = frozenset(
    {
        "widthMm",
        "heightMm",
        "depthMm",
        "lengthMm",
        "materialKey",
        "operation",
        "operationType",
    }
)
FAMILY_CONTENT_RULE_TRACKER_ITEMS: dict[str, list[str]] = {
    "model_integrity_family_type_schema_incomplete": ["BIR-V01"],
    "model_integrity_family_type_host_support_invalid": ["BIR-V01", "BIR-C07"],
    "model_integrity_family_type_required_parameter_missing": ["BIR-V01"],
    "model_integrity_family_type_parameter_constraint_violation": ["BIR-V01"],
    "model_integrity_family_type_required_dimension_undeclared": ["BIR-V01"],
    "model_integrity_family_instance_override_invalid": ["BIR-V02"],
    "model_integrity_family_instance_override_unknown": ["BIR-V02"],
    "model_integrity_family_instance_override_not_allowed": ["BIR-V02"],
    "model_integrity_family_instance_override_unscheduled": ["BIR-V02"],
    "model_integrity_family_instance_material_override_inconsistent": ["BIR-V02"],
    "model_integrity_family_instance_host_constraint_violation": ["BIR-V02"],
    "model_integrity_asset_catalog_metadata_incomplete": ["BIR-V03"],
    "model_integrity_asset_catalog_host_support_invalid": ["BIR-V03", "BIR-C07"],
    "model_integrity_asset_catalog_param_schema_invalid": ["BIR-V03"],
    "model_integrity_asset_placement_support_invalid": ["BIR-V04"],
    "model_integrity_asset_placement_floating": ["BIR-V04"],
    "model_integrity_asset_placement_embedded_without_intent": ["BIR-V04"],
    "model_integrity_asset_placement_circulation_overlap": ["BIR-V04"],
    "model_integrity_family_render_export_parity_gap": ["BIR-V05"],
}
FAMILY_CONTENT_RULE_RECOMMENDATIONS: dict[str, str] = {
    "model_integrity_family_type_schema_incomplete": "Complete the family type schema before treating the content as strict production content.",
    "model_integrity_family_type_host_support_invalid": "Use a supported hostSupport value: wall_hosted, face_hosted, level_hosted, floor_hosted, ceiling_hosted, workplane_hosted, or freestanding.",
    "model_integrity_family_type_required_parameter_missing": "Add the required type parameter value or mark it optional in the parameter schema.",
    "model_integrity_family_type_parameter_constraint_violation": "Update the family type parameter value to satisfy its declared schema constraints.",
    "model_integrity_family_type_required_dimension_undeclared": "Declare every required dimension in parameters and parameterSchema.",
    "model_integrity_family_instance_override_invalid": "Change or remove the instance override so it satisfies the family type parameter schema.",
    "model_integrity_family_instance_override_unknown": "Declare the parameter on the family type schema or remove the override.",
    "model_integrity_family_instance_override_not_allowed": "Move the value to the type or mark the parameter instanceOverridable when instance variation is intended.",
    "model_integrity_family_instance_override_unscheduled": "Add the overridden parameter to scheduleFields or remove it from instance override scope.",
    "model_integrity_family_instance_material_override_inconsistent": "Use a material declared by the family type material slots or explicitly allow the material override.",
    "model_integrity_family_instance_host_constraint_violation": "Resize, rehost, or move the family instance so it fits its declared host constraints.",
    "model_integrity_asset_catalog_host_support_invalid": "Use a supported placementSupport/hostSupport value before publishing the asset catalog entry.",
}
KERNEL_RULE_TRACKER_ITEMS: dict[str, list[str]] = {
    "model_integrity_missing_element_id": ["BIR-P01"],
    "model_integrity_element_key_mismatch": ["BIR-P01"],
    "model_integrity_element_id_not_stable": ["BIR-P01"],
    "model_integrity_missing_kind": ["BIR-P01"],
    "model_integrity_unclassified_kind": ["BIR-P01", "BIR-P05"],
    "model_integrity_unresolved_reference": ["BIR-P02"],
    "model_integrity_reference_wrong_kind": ["BIR-P02"],
    "model_integrity_required_reference_missing": ["BIR-P02"],
    "model_integrity_unsupported_length_unit": ["BIR-P03"],
    "model_integrity_coordinate_not_normalized": ["BIR-P03"],
    "model_integrity_coordinate_invalid_shape": ["BIR-P03"],
    "model_integrity_coordinate_non_finite": ["BIR-P03"],
    "model_integrity_coordinate_list_invalid": ["BIR-P03"],
    "model_integrity_unit_value_non_finite": ["BIR-P03"],
    "model_integrity_physical_level_missing": ["BIR-P04"],
    "model_integrity_physical_level_invalid": ["BIR-P04"],
    "model_integrity_level_parent_elevation_mismatch": ["BIR-P04"],
    "model_integrity_level_span_order_invalid": ["BIR-P04"],
    "model_integrity_physical_height_invalid": ["BIR-P04"],
    "model_integrity_host_level_mismatch": ["BIR-P04"],
    "model_integrity_invalid_model_role": ["BIR-P05"],
    "model_integrity_missing_explicit_model_role": ["BIR-P05"],
    "model_integrity_physical_element_marked_nonphysical": ["BIR-P05"],
    "model_integrity_nonphysical_element_marked_physical": ["BIR-P05"],
    "model_integrity_role_kind_mismatch": ["BIR-P05"],
    "model_integrity_type_reference_missing": ["BIR-P06"],
    "model_integrity_type_reference_unresolved": ["BIR-P06"],
    "model_integrity_type_reference_wrong_kind": ["BIR-P06"],
    "model_integrity_type_layers_invalid": ["BIR-P06"],
    "model_integrity_type_layer_thickness_invalid": ["BIR-P06"],
    "model_integrity_type_layer_function_missing": ["BIR-P06"],
    "model_integrity_type_layer_material_missing": ["BIR-P06"],
    "model_integrity_instance_material_not_in_type": ["BIR-P06"],
    "model_integrity_group_members_invalid": ["BIR-P02", "BIR-P06"],
    "model_integrity_group_members_empty": ["BIR-P02", "BIR-P06"],
    "model_integrity_group_self_reference": ["BIR-P02", "BIR-P06"],
    "model_integrity_group_member_role_invalid": ["BIR-P02", "BIR-P06"],
    "model_integrity_schema_version_unsupported": ["BIR-P07"],
}
HOST_SUPPORT_ALIASES: dict[str, str] = {
    "wall": "wall_hosted",
    "wall-hosted": "wall_hosted",
    "wall_hosted": "wall_hosted",
    "hosted": "wall_hosted",
    "face": "face_hosted",
    "face-hosted": "face_hosted",
    "face_hosted": "face_hosted",
    "level": "level_hosted",
    "level-hosted": "level_hosted",
    "level_hosted": "level_hosted",
    "floor": "floor_hosted",
    "floor-hosted": "floor_hosted",
    "floor_hosted": "floor_hosted",
    "ceiling": "ceiling_hosted",
    "ceiling-hosted": "ceiling_hosted",
    "ceiling_hosted": "ceiling_hosted",
    "workplane": "workplane_hosted",
    "workplane-hosted": "workplane_hosted",
    "workplane_hosted": "workplane_hosted",
    "free": "freestanding",
    "freestanding": "freestanding",
    "free-standing": "freestanding",
}
VALID_HOST_SUPPORT_CLASSES: frozenset[str] = frozenset(
    {
        "wall_hosted",
        "face_hosted",
        "level_hosted",
        "floor_hosted",
        "ceiling_hosted",
        "workplane_hosted",
        "freestanding",
    }
)
PLACED_ASSET_HOST_KIND_REQUIREMENTS: dict[str, frozenset[str]] = {
    "wall_hosted": frozenset({"wall"}),
    "face_hosted": frozenset({"wall", "floor", "roof", "ceiling"}),
    "ceiling_hosted": frozenset({"ceiling"}),
    "workplane_hosted": frozenset({"reference_plane"}),
}

REFERENCE_SPECS: tuple[ReferenceSpec, ...] = (
    ReferenceSpec("levelId", frozenset({"level"})),
    ReferenceSpec("underlayLevelId", frozenset({"level"})),
    ReferenceSpec("referenceLevelId", frozenset({"level"})),
    ReferenceSpec("baseLevelId", frozenset({"level"}), required=True, source_kinds=frozenset({"stair"})),
    ReferenceSpec("topLevelId", frozenset({"level"}), required=True, source_kinds=frozenset({"stair"})),
    ReferenceSpec("upperLimitLevelId", frozenset({"level"})),
    ReferenceSpec("parentLevelId", frozenset({"level"})),
    ReferenceSpec("baseConstraintLevelId", frozenset({"level"})),
    ReferenceSpec("topConstraintLevelId", frozenset({"level"})),
    ReferenceSpec("wallId", frozenset({"wall"}), required=True),
    ReferenceSpec("hostWallId", frozenset({"wall"}), required=True),
    ReferenceSpec("floatingHostWallId", frozenset({"wall"})),
    ReferenceSpec("hostFloorId", frozenset({"floor"}), required=True),
    ReferenceSpec("hostRoofId", frozenset({"roof"}), required=True),
    ReferenceSpec("primaryRoofId", frozenset({"roof"}), required=True),
    ReferenceSpec("secondaryRoofId", frozenset({"roof"}), required=True),
    ReferenceSpec("hostedStairId", frozenset({"stair"})),
    ReferenceSpec("startColumnId", frozenset({"column"})),
    ReferenceSpec("endColumnId", frozenset({"column"})),
    ReferenceSpec("hostElementId"),
    ReferenceSpec("elementId"),
    ReferenceSpec("hostElementIds", many=True),
    ReferenceSpec("requesterElementIds", many=True),
    ReferenceSpec("memberIds", many=True),
    ReferenceSpec("elementIds", many=True),
    ReferenceSpec("targetElementIds", many=True),
    ReferenceSpec("hiddenElementIds", many=True),
    ReferenceSpec("stairElementId", frozenset({"stair"}), required=True),
    ReferenceSpec("roomId", frozenset({"room"})),
    ReferenceSpec("hostViewId", VIEW_KINDS),
    ReferenceSpec("viewId", VIEW_KINDS),
    ReferenceSpec("viewIds", VIEW_KINDS, many=True),
    ReferenceSpec("baseViewId", VIEW_KINDS, required=True),
    ReferenceSpec("viewpointId", frozenset({"viewpoint"})),
    ReferenceSpec("viewpointRef", frozenset({"viewpoint"})),
    ReferenceSpec("planViewId", frozenset({"plan_view"})),
    ReferenceSpec("planOverlaySourcePlanViewId", frozenset({"plan_view"})),
    ReferenceSpec("sectionCutId", frozenset({"section_cut"})),
    ReferenceSpec("sheetId", frozenset({"sheet"})),
    ReferenceSpec("parentSheetId", frozenset({"sheet"}), required=True, source_kinds=frozenset({"callout"})),
    ReferenceSpec("scheduleId", frozenset({"schedule"})),
    ReferenceSpec("tagDefinitionId", frozenset({"tag_definition"})),
    ReferenceSpec("planOpeningTagStyleId", frozenset({"plan_tag_style"})),
    ReferenceSpec("planRoomTagStyleId", frozenset({"plan_tag_style"})),
    ReferenceSpec("viewTemplateId", frozenset({"view_template"})),
    ReferenceSpec("templateId", frozenset({"view_template"})),
    ReferenceSpec("titleblockTypeId", frozenset({"titleblock_type"}), validate_only_if_target_kind_exists="titleblock_type"),
    ReferenceSpec("brandTemplateId", frozenset({"brand_template"}), validate_only_if_target_kind_exists="brand_template"),
    ReferenceSpec("familyTypeId", frozenset({"family_type"})),
    ReferenceSpec("wallTypeId", frozenset({"wall_type"})),
    ReferenceSpec("floorTypeId", frozenset({"floor_type"})),
    ReferenceSpec("roofTypeId", frozenset({"roof_type"})),
    ReferenceSpec("assetId", frozenset({"asset_library_entry"}), required=True),
    ReferenceSpec("materialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("defaultMaterialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("structuralMaterialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("wallMaterialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("roofMaterialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("materialId", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("countertopMaterialId", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("phaseId", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("phaseCreated", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("phaseDemolished", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("optionSetId"),
    ReferenceSpec("optionId"),
    ReferenceSpec("linkId", IMPORTED_PROXY_KINDS, validate_only_if_target_kind_exists="link_model"),
    ReferenceSpec("_linkedFromLinkId", IMPORTED_PROXY_KINDS, validate_only_if_target_kind_exists="link_model"),
)

NESTED_REFERENCE_FIELDS: frozenset[str] = frozenset(spec.field for spec in REFERENCE_SPECS)


def model_integrity_invariant_contract_v1() -> dict[str, Any]:
    return {
        "format": "modelIntegrityInvariantContract_v1",
        "roles": sorted(VALID_MODEL_ROLES),
        "roleByKind": dict(sorted(ROLE_BY_KIND.items())),
        "physicalKinds": sorted(PHYSICAL_KINDS),
        "analyticalKinds": sorted(ANALYTICAL_KINDS),
        "helperKinds": sorted(HELPER_KINDS),
        "documentationKinds": sorted(DOCUMENTATION_KINDS),
        "importedProxyKinds": sorted(IMPORTED_PROXY_KINDS),
        "unitContracts": {
            "canonicalLengthUnit": CANONICAL_LENGTH_UNIT,
            "acceptedLengthUnitAliases": sorted(SUPPORTED_LENGTH_UNITS),
            "pointCoordinateFields": sorted(POINT_COORDINATE_FIELDS),
            "pointListCoordinateFields": sorted(POINT_LIST_COORDINATE_FIELDS),
            "finiteLengthFields": sorted(FINITE_LENGTH_FIELDS),
        },
        "typeInstanceRelations": [
            {
                "instanceKind": instance_kind,
                "field": spec[0],
                "typeKind": spec[1],
                "required": spec[2],
            }
            for instance_kind, spec in sorted(TYPE_INSTANCE_SPECS.items())
        ],
        "familyContentContracts": {
            "familyTypeSchemaFields": [
                {"field": field, "aliases": list(aliases)}
                for field, aliases in FAMILY_TYPE_SCHEMA_FIELDS
            ],
            "familyRenderExportParityFields": [
                {"field": field, "aliases": list(aliases)}
                for field, aliases in FAMILY_PARITY_FIELDS
            ],
            "assetCatalogFields": [
                {"field": field, "aliases": list(aliases)}
                for field, aliases in ASSET_CATALOG_FIELDS
            ],
            "hostSupportTokens": sorted(set(HOST_SUPPORT_ALIASES.values())),
            "scheduledOverrideKeys": sorted(FAMILY_OVERRIDE_SCHEDULED_KEYS),
        },
        "schemaMigrationCompatibility": {
            "supportedSchemaVersions": sorted(SUPPORTED_SCHEMA_VERSIONS),
            "missingSchemaVersionPolicy": "model snapshots without schemaVersion are accepted as current in-memory snapshots",
        },
        "stableIdentity": {
            "elementIdPattern": STABLE_ELEMENT_ID_PATTERN.pattern,
            "mapKeyPolicy": "element map keys must match element ids exactly",
            "linkedSourcePolicy": "linked-source monitors resolve linkId in the host model and preserve source-side elementId as external identity",
        },
        "referenceFields": [
            {
                "field": spec.field,
                "allowedKinds": sorted(spec.allowed_kinds) if spec.allowed_kinds else None,
                "required": spec.required,
                "many": spec.many,
                "conditionalOnTargetKind": spec.validate_only_if_target_kind_exists,
                "sourceKinds": sorted(spec.source_kinds) if spec.source_kinds else None,
            }
            for spec in REFERENCE_SPECS
        ],
        "nestedReferenceFieldPolicy": {
            "checkedFields": sorted(NESTED_REFERENCE_FIELDS),
            "scope": "root elements and nested dictionaries/lists such as type layers, material slots, sheet view placements, evidence refs, and option locks",
        },
        "levelStoreySemantics": {
            "physicalLevelKinds": sorted(PHYSICAL_KINDS),
            "rules": [
                "physical elements requiring a level/storey reference must resolve to level",
                "level parent elevation must match parent elevation plus offset",
                "base/top level or constraint spans must have top elevation above base elevation",
                "hosted openings with explicit levelId must match host wall levelId",
                "height-bearing physical elements must have positive finite height",
            ],
        },
        "groupAssemblySemantics": {
            "detailGroupMembers": "detail_group memberIds must resolve to annotation or documentation elements and cannot include the group itself",
            "typeAssemblies": "wall/floor/roof type layers require positive thickness and layer function; resolved assembly thickness is deterministic evidence",
        },
        "trackedItems": [
            "BIR-P01",
            "BIR-P02",
            "BIR-P03",
            "BIR-P04",
            "BIR-P05",
            "BIR-P06",
            "BIR-P07",
            "BIR-P08",
            *FAMILY_CONTENT_TRACKED_ITEMS,
        ],
    }


def check_model_integrity_invariants(
    subject: Any,
    *,
    require_explicit_roles: bool = False,
) -> list[ModelIntegrityFinding]:
    elements = _elements_mapping(subject)
    design_option_sets = _design_option_sets(subject)
    findings: list[ModelIntegrityFinding] = []

    if elements is None:
        return [
            ModelIntegrityFinding(
                rule_id="model_integrity_invalid_document_shape",
                severity="error",
                message="Model integrity check requires a Document, an elements mapping, or a snapshot with an elements object.",
                expected="Document | Mapping[str, Element] | {'elements': Mapping}",
                actual=type(subject).__name__,
            )
        ]

    element_kinds = _kind_index(elements)
    level_elevations = _level_elevations(elements)
    for map_id, element in sorted(elements.items(), key=lambda item: str(item[0])):
        element_id = _read(element, "id")
        kind = _read(element, "kind")
        if not element_id:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_missing_element_id",
                    severity="error",
                    message="Element is missing a non-empty id.",
                    element_ids=(str(map_id),),
                    field="id",
                )
            )
            continue
        element_id = str(element_id)
        findings.extend(_stable_id_findings(element_id, str(map_id)))
        if str(map_id) != element_id:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_element_key_mismatch",
                    severity="error",
                    message=f"Element map key '{map_id}' does not match element id '{element_id}'.",
                    element_ids=(element_id,),
                    field="id",
                    expected=str(map_id),
                    actual=element_id,
                )
            )
        if not kind:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_missing_kind",
                    severity="error",
                    message=f"Element '{element_id}' is missing a kind discriminator.",
                    element_ids=(element_id,),
                    field="kind",
                )
            )
            continue
        kind = str(kind)
        if kind not in ROLE_BY_KIND:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_unclassified_kind",
                    severity="warning",
                    message=f"Element '{element_id}' has no model role classification for kind '{kind}'.",
                    element_ids=(element_id,),
                    field="kind",
                    actual=kind,
                )
            )
        findings.extend(_role_findings(element, element_id, kind, require_explicit_roles))
        findings.extend(_reference_findings(element, elements, element_kinds, design_option_sets))
        if kind == "level":
            findings.extend(_level_definition_findings(element, elements, level_elevations))
        findings.extend(_level_semantic_findings(element, elements, level_elevations))
        findings.extend(_unit_coordinate_findings(element))
        findings.extend(_type_instance_findings(element, elements))
        findings.extend(_group_semantic_findings(element, elements))
        findings.extend(_family_content_findings(element, elements))

    findings.extend(_schema_compatibility_findings(subject))
    return findings


def model_integrity_smoke_v1(subject: Any, *, require_explicit_roles: bool = False) -> dict[str, Any]:
    elements = _elements_mapping(subject) or {}
    findings = check_model_integrity_invariants(
        subject, require_explicit_roles=require_explicit_roles
    )
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1
    role_counts = _role_counts(elements)
    return {
        "format": "modelIntegritySmoke_v1",
        "trackedItems": [
            "BIR-P01",
            "BIR-P02",
            "BIR-P03",
            "BIR-P04",
            "BIR-P05",
            "BIR-P06",
            "BIR-P07",
            "BIR-P08",
            *FAMILY_CONTENT_TRACKED_ITEMS,
        ],
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": dict(sorted(counts.items())),
        "roleCounts": role_counts,
        "coverage": {
            "checkedReferenceFields": sorted(NESTED_REFERENCE_FIELDS),
            "checkedRoleKinds": sorted(ROLE_BY_KIND),
            "checkedPhysicalKinds": sorted(PHYSICAL_KINDS),
            "checkedAnalyticalKinds": sorted(ANALYTICAL_KINDS),
            "checkedLevelSemanticKinds": sorted(PHYSICAL_KINDS | ANALYTICAL_KINDS),
            "stableElementIdPattern": STABLE_ELEMENT_ID_PATTERN.pattern,
            "requireExplicitRoles": require_explicit_roles,
        },
        "findings": [finding.to_dict() for finding in findings],
    }


def model_integrity_units_coordinate_normalization_v1(subject: Any) -> dict[str, Any]:
    elements = _elements_mapping(subject) or {}
    findings: list[ModelIntegrityFinding] = []
    for element in elements.values():
        findings.extend(_unit_coordinate_findings(element))
    counts = _counts_by_severity(findings)
    return {
        "format": "modelIntegrityUnitsCoordinateNormalization_v1",
        "trackedItems": ["BIR-P03"],
        "canonicalLengthUnit": CANONICAL_LENGTH_UNIT,
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": counts,
        "findings": [finding.to_dict() for finding in findings],
    }


def resolve_type_instance_inheritance_v1(subject: Any) -> dict[str, Any]:
    elements = _elements_mapping(subject) or {}
    rows: list[dict[str, Any]] = []
    for element_id, element in sorted(elements.items(), key=lambda item: str(item[0])):
        kind = str(_read(element, "kind", default=""))
        spec = TYPE_INSTANCE_SPECS.get(kind)
        if spec is None:
            continue
        field, type_kind, _required = spec
        type_id = _read(element, field)
        if type_id in (None, ""):
            continue
        type_id = str(type_id)
        type_element = elements.get(type_id)
        if type_element is None or str(_read(type_element, "kind", default="")) != type_kind:
            continue
        resolved = _resolved_type_values(element, type_element, kind)
        rows.append(
            {
                "elementId": str(_read(element, "id", default=element_id)),
                "kind": kind,
                "typeField": field,
                "typeId": type_id,
                "typeKind": type_kind,
                "overrideKeys": _type_override_keys(element, type_element, kind),
                "resolved": resolved,
            }
        )
    return {
        "format": "modelIntegrityTypeInstanceInheritance_v1",
        "trackedItems": ["BIR-P06"],
        "ok": True,
        "resolvedCount": len(rows),
        "rows": rows,
        "digestSha256": _stable_digest({"rows": rows}),
    }


def schema_migration_compatibility_v1(subject: Any) -> dict[str, Any]:
    findings = _schema_compatibility_findings(subject)
    counts = _counts_by_severity(findings)
    schema_version = _read(subject, "schemaVersion") if isinstance(subject, Mapping) else None
    return {
        "format": "modelIntegritySchemaMigrationCompatibility_v1",
        "trackedItems": ["BIR-P07"],
        "schemaVersion": schema_version,
        "supportedSchemaVersions": sorted(SUPPORTED_SCHEMA_VERSIONS),
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": counts,
        "findings": [finding.to_dict() for finding in findings],
    }


def family_type_content_integrity_v1(subject: Any) -> dict[str, Any]:
    elements = _elements_mapping(subject) or {}
    findings: list[ModelIntegrityFinding] = []
    rows: list[dict[str, Any]] = []
    for element_id, element in sorted(elements.items(), key=lambda item: str(item[0])):
        kind = str(_read(element, "kind", default=""))
        if kind not in {"family_type", "family_instance", "asset_library_entry", "placed_asset"}:
            continue
        element_findings = _family_content_findings(element, elements)
        findings.extend(element_findings)
        rows.append(
            {
                "elementId": str(_read(element, "id", default=element_id)),
                "kind": kind,
                "findingRuleIds": sorted({finding.rule_id for finding in element_findings}),
                "trackedItems": _family_content_tracked_items(kind),
            }
        )
    counts = _counts_by_severity(findings)
    payload = {
        "format": "familyTypeContentIntegrity_v1",
        "trackedItems": list(FAMILY_CONTENT_TRACKED_ITEMS),
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": counts,
        "rows": rows,
        "findings": [finding.to_dict() for finding in sorted(findings, key=_finding_sort_key)],
    }
    payload["digestSha256"] = _stable_digest(payload)
    return payload


def model_integrity_smoke_command_evidence_v1(subject: Any) -> dict[str, Any]:
    smoke = model_integrity_smoke_v1(subject)
    strict_role_smoke = model_integrity_smoke_v1(subject, require_explicit_roles=True)
    units = model_integrity_units_coordinate_normalization_v1(subject)
    inheritance = resolve_type_instance_inheritance_v1(subject)
    schema = schema_migration_compatibility_v1(subject)
    family_content = family_type_content_integrity_v1(subject)
    evidence = {
        "format": "modelIntegritySmokeCommandEvidence_v1",
        "trackedItems": [
            "BIR-P01",
            "BIR-P02",
            "BIR-P03",
            "BIR-P04",
            "BIR-P05",
            "BIR-P06",
            "BIR-P07",
            "BIR-P08",
            *FAMILY_CONTENT_TRACKED_ITEMS,
        ],
        "command": {
            "cli": "bim-ai invariant smoke --input <snapshot.json> --format json",
            "api": "POST /api/v3/invariants/smoke",
        },
        "artifacts": {
            "smoke": smoke,
            "strictRoleSmoke": strict_role_smoke,
            "unitsCoordinateNormalization": units,
            "typeInstanceInheritance": inheritance,
            "schemaMigrationCompatibility": schema,
            "familyTypeContentIntegrity": family_content,
        },
    }
    evidence["digestSha256"] = _stable_digest(evidence)
    return evidence


def _family_content_findings(
    element: Any, elements: Mapping[str, Any]
) -> list[ModelIntegrityFinding]:
    kind = str(_read(element, "kind", default=""))
    element_id = str(_read(element, "id", default=""))
    if kind == "family_type":
        return [
            *_family_type_schema_findings(element, element_id),
            *_family_type_render_export_parity_findings(element, element_id),
        ]
    if kind == "family_instance":
        return _family_instance_override_findings(element, elements, element_id)
    if kind == "asset_library_entry":
        return _asset_catalog_metadata_findings(element, element_id)
    if kind == "placed_asset":
        return _placed_asset_findings(element, elements, element_id)
    return []


def _family_type_schema_findings(element: Any, element_id: str) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    missing = [
        field
        for field, aliases in FAMILY_TYPE_SCHEMA_FIELDS
        if not _has_any_field_value(element, aliases)
    ]
    if missing:
        severity: IntegritySeverity = "error" if _strict_family_schema(element) else "warning"
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_family_type_schema_incomplete",
                severity=severity,
                message=(
                    f"Family type '{element_id}' is missing required schema metadata: "
                    f"{', '.join(missing)}."
                ),
                element_ids=(element_id,),
                field="familyTypeSchema",
                expected=", ".join(field for field, _aliases in FAMILY_TYPE_SCHEMA_FIELDS),
                actual=", ".join(missing),
            )
        )

    host_support = _read_any(element, ("hostSupport", "hostingMode", "hostKind"))
    normalized_host_support = _normalize_host_support(host_support)
    if host_support not in (None, "") and normalized_host_support not in VALID_HOST_SUPPORT_CLASSES:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_family_type_host_support_invalid",
                severity="error" if _strict_family_schema(element) else "warning",
                message=(
                    f"Family type '{element_id}' declares unsupported hostSupport "
                    f"'{host_support}'."
                ),
                element_ids=(element_id,),
                field="hostSupport",
                expected=", ".join(sorted(VALID_HOST_SUPPORT_CLASSES)),
                actual=str(host_support),
            )
        )

    params = _read(element, "parameters", default={}) or {}
    schema = _parameter_schema_map(element)
    required_dimensions = _string_list(_read_any(element, ("requiredDimensions", "dimensions")))
    for dimension_key in required_dimensions:
        has_parameter = isinstance(params, Mapping) and dimension_key in params
        if dimension_key not in schema or not has_parameter:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_type_required_dimension_undeclared",
                    severity="error" if _strict_family_schema(element) else "warning",
                    message=(
                        f"Family type '{element_id}' required dimension '{dimension_key}' "
                        "is not declared in both parameters and parameterSchema."
                    ),
                    element_ids=(element_id,),
                    field=f"requiredDimensions.{dimension_key}",
                    expected="dimension present in parameters and parameterSchema",
                    actual="missing",
                )
            )
    for key, entry in sorted(schema.items()):
        value = params.get(key) if isinstance(params, Mapping) else None
        if value in (None, "") and _truthy(_read(entry, "required", default=False)):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_type_required_parameter_missing",
                    severity="error",
                    message=f"Family type '{element_id}' is missing required parameter '{key}'.",
                    element_ids=(element_id,),
                    field=f"parameters.{key}",
                    expected="required parameter value",
                )
            )
            continue
        if value not in (None, ""):
            findings.extend(
                _parameter_value_findings(
                    element_id=element_id,
                    field=f"parameters.{key}",
                    value=value,
                    entry=entry,
                    rule_id="model_integrity_family_type_parameter_constraint_violation",
                )
            )
    return findings


def _family_type_render_export_parity_findings(
    element: Any, element_id: str
) -> list[ModelIntegrityFinding]:
    missing = [
        field for field, aliases in FAMILY_PARITY_FIELDS if not _has_any_field_value(element, aliases)
    ]
    findings: list[ModelIntegrityFinding] = []
    if missing:
        severity: IntegritySeverity = "error" if _strict_family_schema(element) else "warning"
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_family_render_export_parity_gap",
                severity=severity,
                message=(
                    f"Family type '{element_id}' lacks render/export parity evidence for "
                    f"{', '.join(missing)}."
                ),
                element_ids=(element_id,),
                field="renderExportParity",
                expected=", ".join(field for field, _aliases in FAMILY_PARITY_FIELDS),
                actual=", ".join(missing),
            )
        )
    render_support = _read_any(element, ("renderSupport", "rendererSupport"))
    export_support = _read_any(element, ("exportSupport", "exportMetadata"))
    if isinstance(render_support, Mapping) and isinstance(export_support, Mapping):
        if _truthy(render_support.get("geometry")) and not (
            _truthy(export_support.get("ifc")) and _truthy(export_support.get("gltf"))
        ):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_render_export_parity_gap",
                    severity="error",
                    message=(
                        f"Family type '{element_id}' declares renderable visual geometry but "
                        "does not declare both IFC and glTF export support."
                    ),
                    element_ids=(element_id,),
                    field="exportSupport",
                    expected="ifc=true and gltf=true when renderSupport.geometry=true",
                    actual=json.dumps(export_support, sort_keys=True, default=str),
                )
            )
    return findings


def _family_instance_override_findings(
    element: Any, elements: Mapping[str, Any], element_id: str
) -> list[ModelIntegrityFinding]:
    type_id = _read(element, "familyTypeId")
    type_element = elements.get(str(type_id)) if type_id not in (None, "") else None
    if type_element is None or str(_read(type_element, "kind", default="")) != "family_type":
        return []

    schema = _parameter_schema_map(type_element)
    overrides = _read(element, "paramValues", default={}) or {}
    if not isinstance(overrides, Mapping):
        return [
            ModelIntegrityFinding(
                rule_id="model_integrity_family_instance_override_invalid",
                severity="error",
                message=f"Family instance '{element_id}' has non-object paramValues.",
                element_ids=(element_id,),
                field="paramValues",
                expected="object",
                actual=type(overrides).__name__,
            )
        ]

    findings: list[ModelIntegrityFinding] = []
    schedule_fields = set(_string_list(_read_any(type_element, ("scheduleFields",))))
    for key, value in sorted(overrides.items(), key=lambda item: str(item[0])):
        key = str(key)
        entry = schema.get(key)
        if schema and entry is None:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_instance_override_unknown",
                    severity="error",
                    message=(
                        f"Family instance '{element_id}' overrides unknown type parameter '{key}'."
                    ),
                    element_ids=(element_id, str(type_id)),
                    field=f"paramValues.{key}",
                    expected="declared parameterSchema key",
                    actual=key,
                )
            )
            continue
        if entry is not None and _read(entry, "instanceOverridable", default=True) is False:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_instance_override_not_allowed",
                    severity="error",
                    message=(
                        f"Family instance '{element_id}' overrides non-instance parameter '{key}'."
                    ),
                    element_ids=(element_id, str(type_id)),
                    field=f"paramValues.{key}",
                    expected="instanceOverridable=true",
                    actual="false",
                )
            )
        if entry is not None:
            findings.extend(
                _parameter_value_findings(
                    element_id=element_id,
                    field=f"paramValues.{key}",
                    value=value,
                    entry=entry,
                    rule_id="model_integrity_family_instance_override_invalid",
                )
            )
        if key in FAMILY_OVERRIDE_SCHEDULED_KEYS and schedule_fields and key not in schedule_fields:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_instance_override_unscheduled",
                    severity="warning",
                    message=(
                        f"Family instance '{element_id}' overrides '{key}' but its type schedule "
                        "fields do not include that parameter."
                    ),
                    element_ids=(element_id, str(type_id)),
                    field=f"paramValues.{key}",
                    expected="override key included in scheduleFields",
                    actual=", ".join(sorted(schedule_fields)),
                )
            )

    findings.extend(_family_instance_material_override_findings(element, type_element, element_id, str(type_id)))
    findings.extend(_host_geometry_constraint_findings(element, type_element, elements, element_id))
    return findings


def _family_instance_material_override_findings(
    element: Any, type_element: Any, element_id: str, type_id: str
) -> list[ModelIntegrityFinding]:
    overrides = _read(element, "paramValues", default={}) or {}
    if not isinstance(overrides, Mapping):
        return []
    material_slots = _material_slot_values(_read_any(type_element, ("materialSlots",), default={}))
    if not material_slots or _truthy(_read_any(element, ("allowMaterialOverride",))):
        return []
    findings: list[ModelIntegrityFinding] = []
    for key, value in sorted(overrides.items(), key=lambda item: str(item[0])):
        if "material" not in str(key).lower() or value in (None, ""):
            continue
        if str(value) in material_slots:
            continue
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_family_instance_material_override_inconsistent",
                severity="error",
                message=(
                    f"Family instance '{element_id}' material override '{key}' is not declared "
                    f"by family type '{type_id}' material slots."
                ),
                element_ids=(element_id, type_id),
                field=f"paramValues.{key}",
                expected=", ".join(sorted(material_slots)),
                actual=str(value),
            )
        )
    return findings


def _asset_catalog_metadata_findings(element: Any, element_id: str) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    missing = [
        field for field, aliases in ASSET_CATALOG_FIELDS if not _has_any_field_value(element, aliases)
    ]
    if missing:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_asset_catalog_metadata_incomplete",
                severity="warning",
                message=(
                    f"Asset catalog entry '{element_id}' is missing metadata: "
                    f"{', '.join(missing)}."
                ),
                element_ids=(element_id,),
                field="assetCatalogMetadata",
                expected=", ".join(field for field, _aliases in ASSET_CATALOG_FIELDS),
                actual=", ".join(missing),
            )
        )
    placement_support = _read_any(element, ("placementSupport", "hostSupport"))
    normalized_support = _normalize_host_support(placement_support)
    if placement_support not in (None, "") and normalized_support not in VALID_HOST_SUPPORT_CLASSES:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_asset_catalog_host_support_invalid",
                severity="error",
                message=(
                    f"Asset catalog entry '{element_id}' declares unsupported placementSupport "
                    f"'{placement_support}'."
                ),
                element_ids=(element_id,),
                field="placementSupport",
                expected=", ".join(sorted(VALID_HOST_SUPPORT_CLASSES)),
                actual=str(placement_support),
            )
        )
    schema = _asset_parameter_schema_map(element)
    for key, entry in sorted(schema.items()):
        default = _read(entry, "default")
        findings.extend(
            _parameter_value_findings(
                element_id=element_id,
                field=f"paramSchema.{key}.default",
                value=default,
                entry=entry,
                rule_id="model_integrity_asset_catalog_param_schema_invalid",
            )
        )
    return findings


def _placed_asset_findings(
    element: Any, elements: Mapping[str, Any], element_id: str
) -> list[ModelIntegrityFinding]:
    asset_id = _read(element, "assetId")
    entry = elements.get(str(asset_id)) if asset_id not in (None, "") else None
    if entry is None or str(_read(entry, "kind", default="")) != "asset_library_entry":
        return []
    support = _placement_support_for_asset(element, entry)
    findings: list[ModelIntegrityFinding] = []
    host_id = _read(element, "hostElementId")
    host = elements.get(str(host_id)) if host_id not in (None, "") else None
    required_host_kinds = PLACED_ASSET_HOST_KIND_REQUIREMENTS.get(support)
    if support not in VALID_HOST_SUPPORT_CLASSES:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_asset_placement_support_invalid",
                severity="error",
                message=f"Placed asset '{element_id}' declares unsupported support '{support}'.",
                element_ids=(element_id, str(asset_id)),
                field="placementSupport",
                expected=", ".join(sorted(VALID_HOST_SUPPORT_CLASSES)),
                actual=support,
            )
        )
    if required_host_kinds is not None:
        if host is None:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_asset_placement_support_invalid",
                    severity="error",
                    message=(
                        f"Placed asset '{element_id}' requires a host of kind "
                        f"{', '.join(sorted(required_host_kinds))} for "
                        f"support '{support}'."
                    ),
                    element_ids=(element_id, str(asset_id)),
                    field="hostElementId",
                    expected=", ".join(sorted(required_host_kinds)),
                    actual=str(host_id or ""),
                )
            )
        elif str(_read(host, "kind", default="")) not in required_host_kinds:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_asset_placement_support_invalid",
                    severity="error",
                    message=(
                        f"Placed asset '{element_id}' support '{support}' is hosted by "
                        f"'{host_id}' of kind '{_read(host, 'kind')}'."
                    ),
                    element_ids=(element_id, str(asset_id), str(host_id)),
                    field="hostElementId",
                    expected=", ".join(sorted(required_host_kinds)),
                    actual=str(_read(host, "kind", default="")),
                )
            )

    if support in {"floor_hosted", "level_hosted", "freestanding"} and host_id in (None, ""):
        if not _position_supported_by_floor(element, elements):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_asset_placement_floating",
                    severity="error",
                    message=(
                        f"Placed asset '{element_id}' is not supported by a floor footprint on "
                        f"level '{_read(element, 'levelId')}'."
                    ),
                    element_ids=(element_id, str(asset_id)),
                    field="positionMm",
                    expected="position inside a floor boundary on the same level",
                )
            )
        embedded_wall = _embedded_wall_at_position(element, elements)
        if embedded_wall is not None and not _truthy(_read_any(element, ("allowEmbedded",))):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_asset_placement_embedded_without_intent",
                    severity="error",
                    message=(
                        f"Placed asset '{element_id}' intersects wall '{embedded_wall}' without "
                        "an explicit recess/opening/embedded intent."
                    ),
                    element_ids=(element_id, str(asset_id), embedded_wall),
                    field="positionMm",
                    expected="clear of wall or allowEmbedded=true",
                    actual=embedded_wall,
                )
            )
        circulation_overlap = _circulation_overlap_at_position(element, elements)
        if circulation_overlap is not None and not _truthy(
            _read_any(element, ("allowCirculationOverlap", "allowStairOverlap"))
        ):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_asset_placement_circulation_overlap",
                    severity="error",
                    message=(
                        f"Placed asset '{element_id}' overlaps vertical circulation "
                        f"'{circulation_overlap}' without explicit intent."
                    ),
                    element_ids=(element_id, str(asset_id), circulation_overlap),
                    field="positionMm",
                    expected="clear of stairs/ramps/vertical circulation or allowCirculationOverlap=true",
                    actual=circulation_overlap,
                )
            )
    return findings


def _host_geometry_constraint_findings(
    element: Any, type_element: Any, elements: Mapping[str, Any], element_id: str
) -> list[ModelIntegrityFinding]:
    support = _normalize_host_support(_read_any(type_element, ("hostSupport", "hostingMode")))
    host_id = _read(element, "hostElementId")
    host = elements.get(str(host_id)) if host_id not in (None, "") else None
    findings: list[ModelIntegrityFinding] = []
    if support == "wall_hosted":
        if host is None or str(_read(host, "kind", default="")) != "wall":
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_instance_host_constraint_violation",
                    severity="error",
                    message=f"Family instance '{element_id}' requires a valid wall host.",
                    element_ids=(element_id, str(_read(type_element, "id", default=""))),
                    field="hostElementId",
                    expected="wall",
                    actual=str(_read(host, "kind", default="missing")),
                )
            )
            return findings
        resolved = _resolved_type_values(element, type_element, "family_instance").get(
            "parameters", {}
        )
        width = _numeric_from_mapping(resolved, ("widthMm", "lengthMm"))
        height = _numeric_from_mapping(resolved, ("heightMm", "headHeightMm"))
        wall_len = _wall_length_mm(host)
        wall_height = _read(host, "heightMm")
        if width is not None and wall_len is not None and width > wall_len:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_instance_host_constraint_violation",
                    severity="error",
                    message=(
                        f"Family instance '{element_id}' width {width:g} mm exceeds host wall "
                        f"length {wall_len:g} mm."
                    ),
                    element_ids=(element_id, str(host_id)),
                    field="paramValues.widthMm",
                    expected=f"<= {wall_len:g}",
                    actual=f"{width:g}",
                )
            )
        if (
            height is not None
            and _is_finite_number(wall_height)
            and height > float(wall_height)
        ):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_family_instance_host_constraint_violation",
                    severity="error",
                    message=(
                        f"Family instance '{element_id}' height {height:g} mm exceeds host wall "
                        f"height {float(wall_height):g} mm."
                    ),
                    element_ids=(element_id, str(host_id)),
                    field="paramValues.heightMm",
                    expected=f"<= {float(wall_height):g}",
                    actual=f"{height:g}",
                )
            )
    return findings


def _elements_mapping(subject: Any) -> Mapping[str, Any] | None:
    if hasattr(subject, "elements"):
        elements = subject.elements
        return elements if isinstance(elements, Mapping) else None
    if isinstance(subject, Mapping):
        if "elements" in subject:
            elements = subject.get("elements")
            return elements if isinstance(elements, Mapping) else None
        return subject
    return None


def _design_option_sets(subject: Any) -> list[Any]:
    if hasattr(subject, "design_option_sets"):
        raw = subject.design_option_sets
        return list(raw or [])
    if isinstance(subject, Mapping):
        raw = subject.get("designOptionSets") or subject.get("design_option_sets") or []
        return list(raw) if isinstance(raw, list) else []
    return []


def _kind_index(elements: Mapping[str, Any]) -> dict[str, set[str]]:
    by_kind: dict[str, set[str]] = {}
    for map_id, element in elements.items():
        kind = _read(element, "kind")
        eid = _read(element, "id", default=map_id)
        if kind and eid:
            by_kind.setdefault(str(kind), set()).add(str(eid))
    return by_kind


def _level_elevations(elements: Mapping[str, Any]) -> dict[str, float]:
    elevations: dict[str, float] = {}
    for map_id, element in elements.items():
        if str(_read(element, "kind", default="")) != "level":
            continue
        element_id = _read(element, "id", default=map_id)
        elevation = _read(element, "elevationMm", default=0)
        if element_id not in (None, "") and _is_finite_number(elevation):
            elevations[str(element_id)] = float(elevation)
    return elevations


def _role_counts(elements: Mapping[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for element in elements.values():
        kind = str(_read(element, "kind", default=""))
        role = _declared_model_role(element) or ROLE_BY_KIND.get(kind) or "unclassified"
        counts[role] = counts.get(role, 0) + 1
    return dict(sorted(counts.items()))


def _role_findings(
    element: Any,
    element_id: str,
    kind: str,
    require_explicit_roles: bool,
) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    expected = ROLE_BY_KIND.get(kind)
    declared = _declared_model_role(element)
    if declared is None:
        if require_explicit_roles and kind in ROLE_BY_KIND and expected != "project_datum":
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_missing_explicit_model_role",
                    severity="warning",
                    message=(
                        f"Element '{element_id}' kind '{kind}' does not declare an explicit "
                        f"model role; contract classifies it as '{expected}'."
                    ),
                    element_ids=(element_id,),
                    field="modelRole",
                    expected=expected,
                )
            )
        return findings

    if declared not in VALID_MODEL_ROLES:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_invalid_model_role",
                severity="error",
                message=f"Element '{element_id}' declares unknown model role '{declared}'.",
                element_ids=(element_id,),
                field="modelRole",
                expected=" | ".join(sorted(VALID_MODEL_ROLES)),
                actual=declared,
            )
        )
        return findings

    if expected is not None and declared != expected:
        if expected == "physical" and declared != "physical":
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_physical_element_marked_nonphysical",
                    severity="error",
                    message=(
                        f"Physical element '{element_id}' kind '{kind}' declares role "
                        f"'{declared}', so it would leak physical BIM semantics into a "
                        "nonphysical role."
                    ),
                    element_ids=(element_id,),
                    field="modelRole",
                    expected="physical",
                    actual=declared,
                )
            )
        elif expected != "physical" and declared == "physical":
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_nonphysical_element_marked_physical",
                    severity="error",
                    message=(
                        f"Nonphysical element '{element_id}' kind '{kind}' declares role "
                        "'physical'."
                    ),
                    element_ids=(element_id,),
                    field="modelRole",
                    expected=expected,
                    actual=declared,
                )
            )
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_role_kind_mismatch",
                severity="error",
                message=(
                    f"Element '{element_id}' kind '{kind}' declares role '{declared}', "
                    f"but the invariant contract classifies it as '{expected}'."
                ),
                element_ids=(element_id,),
                field="modelRole",
                expected=expected,
                actual=declared,
            )
        )
    return findings


def _stable_id_findings(element_id: str, map_id: str) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    for field, value in (("id", element_id), ("mapKey", map_id)):
        if STABLE_ELEMENT_ID_PATTERN.fullmatch(value):
            continue
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_element_id_not_stable",
                severity="error",
                message=(
                    f"Element {field} '{value}' is not a stable ASCII token suitable for "
                    "references, exports, and deterministic evidence."
                ),
                element_ids=(element_id,),
                field=field,
                expected=STABLE_ELEMENT_ID_PATTERN.pattern,
                actual=value,
            )
        )
    return findings


def _reference_findings(
    element: Any,
    elements: Mapping[str, Any],
    element_kinds: dict[str, set[str]],
    design_option_sets: list[Any],
) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    element_id = str(_read(element, "id", default=""))
    kind = str(_read(element, "kind", default=""))
    for spec in REFERENCE_SPECS:
        if spec.source_kinds and kind not in spec.source_kinds:
            continue
        if spec.validate_only_if_target_kind_exists and not element_kinds.get(
            spec.validate_only_if_target_kind_exists
        ):
            continue
        value = _read(element, spec.field)
        if value in (None, ""):
            if spec.required and _field_present(element, spec.field):
                findings.append(_missing_required_ref(element_id, spec))
            continue
        values = list(value) if spec.many and isinstance(value, list | tuple | set) else [value]
        for raw_ref in values:
            if raw_ref in (None, ""):
                continue
            ref_id = str(raw_ref)
            if spec.field == "optionSetId":
                if design_option_sets and ref_id not in _option_set_ids(design_option_sets):
                    findings.append(_unresolved_ref(element_id, spec, ref_id))
                continue
            if spec.field == "optionId":
                option_set_id = _read(element, "optionSetId")
                if design_option_sets and option_set_id:
                    option_ids = _option_ids_for_set(design_option_sets, str(option_set_id))
                    if option_ids and ref_id not in option_ids:
                        findings.append(_unresolved_ref(element_id, spec, ref_id))
                continue
            target = elements.get(ref_id)
            if target is None:
                findings.append(_unresolved_ref(element_id, spec, ref_id))
                continue
            target_kind = str(_read(target, "kind", default=""))
            if spec.allowed_kinds and target_kind not in spec.allowed_kinds:
                findings.append(_wrong_kind_ref(element_id, spec, ref_id, target_kind))
    findings.extend(
        _nested_reference_findings(element, elements, element_kinds, design_option_sets)
    )
    findings.extend(_option_lock_findings(element, design_option_sets))
    return findings


def _nested_reference_findings(
    element: Any,
    elements: Mapping[str, Any],
    element_kinds: dict[str, set[str]],
    design_option_sets: list[Any],
) -> list[ModelIntegrityFinding]:
    root = _plain_value(element)
    if not isinstance(root, Mapping):
        return []
    element_id = str(root.get("id") or _read(element, "id", default=""))
    findings: list[ModelIntegrityFinding] = []
    specs = {spec.field: spec for spec in REFERENCE_SPECS}

    def visit(
        value: Any,
        path: str,
        *,
        is_root: bool = False,
        parent: Mapping[str, Any] | None = None,
    ) -> None:
        if isinstance(value, Mapping):
            for key, child in value.items():
                key_str = str(key)
                child_path = key_str if not path else f"{path}.{key_str}"
                if not is_root and key_str in specs:
                    spec = specs[key_str]
                    if spec.source_kinds:
                        continue
                    findings.extend(
                        _reference_value_findings(
                            element_id,
                            spec,
                            child,
                            child_path,
                            elements,
                            element_kinds,
                            design_option_sets,
                            value,
                        )
                    )
                visit(child, child_path, parent=value)
            return
        if isinstance(value, list | tuple):
            for index, child in enumerate(value):
                visit(child, f"{path}[{index}]", parent=parent)

    visit(root, "", is_root=True)
    return findings


def _reference_value_findings(
    element_id: str,
    spec: ReferenceSpec,
    value: Any,
    field_path: str,
    elements: Mapping[str, Any],
    element_kinds: dict[str, set[str]],
    design_option_sets: list[Any],
    parent: Mapping[str, Any] | None = None,
) -> list[ModelIntegrityFinding]:
    if spec.validate_only_if_target_kind_exists and not element_kinds.get(
        spec.validate_only_if_target_kind_exists
    ):
        return []
    if value in (None, ""):
        return []
    values = list(value) if spec.many and isinstance(value, list | tuple | set) else [value]
    findings: list[ModelIntegrityFinding] = []
    for raw_ref in values:
        if raw_ref in (None, ""):
            continue
        ref_id = str(raw_ref)
        if spec.field == "elementId" and parent is not None:
            sibling_link_id = _read(parent, "linkId")
            if sibling_link_id not in (None, ""):
                continue
        if spec.field == "optionSetId":
            if design_option_sets and ref_id not in _option_set_ids(design_option_sets):
                findings.append(_unresolved_ref(element_id, spec, ref_id, field_path))
            continue
        if spec.field == "optionId":
            option_set_id = _read(parent, "optionSetId") if parent is not None else None
            if design_option_sets and option_set_id:
                option_ids = _option_ids_for_set(design_option_sets, str(option_set_id))
                if option_ids and ref_id not in option_ids:
                    findings.append(_unresolved_ref(element_id, spec, ref_id, field_path))
            continue
        target = elements.get(ref_id)
        if target is None:
            findings.append(_unresolved_ref(element_id, spec, ref_id, field_path))
            continue
        target_kind = str(_read(target, "kind", default=""))
        if spec.allowed_kinds and target_kind not in spec.allowed_kinds:
            findings.append(_wrong_kind_ref(element_id, spec, ref_id, target_kind, field_path))
    return findings


def _option_lock_findings(element: Any, design_option_sets: list[Any]) -> list[ModelIntegrityFinding]:
    if not design_option_sets:
        return []
    option_locks = _read(element, "optionLocks", default={}) or {}
    if not isinstance(option_locks, Mapping):
        return []
    element_id = str(_read(element, "id", default=""))
    findings: list[ModelIntegrityFinding] = []
    option_set_ids = _option_set_ids(design_option_sets)
    for option_set_id, option_id in sorted(option_locks.items(), key=lambda item: str(item[0])):
        option_set_id = str(option_set_id)
        if option_set_id not in option_set_ids:
            findings.append(
                _unresolved_ref(
                    element_id,
                    ReferenceSpec("optionLocks"),
                    option_set_id,
                    f"optionLocks.{option_set_id}",
                )
            )
            continue
        option_ids = _option_ids_for_set(design_option_sets, option_set_id)
        if option_ids and str(option_id) not in option_ids:
            findings.append(
                _unresolved_ref(
                    element_id,
                    ReferenceSpec("optionLocks"),
                    str(option_id),
                    f"optionLocks.{option_set_id}",
                )
            )
    return findings


def _group_semantic_findings(
    element: Any, elements: Mapping[str, Any]
) -> list[ModelIntegrityFinding]:
    kind = str(_read(element, "kind", default=""))
    if kind != "detail_group":
        return []
    element_id = str(_read(element, "id", default=""))
    members = _read(element, "memberIds", default=[]) or []
    if not isinstance(members, list | tuple):
        return [
            ModelIntegrityFinding(
                rule_id="model_integrity_group_members_invalid",
                severity="error",
                message=f"Detail group '{element_id}' memberIds must be a list.",
                element_ids=(element_id,),
                field="memberIds",
                expected="list of element ids",
                actual=type(members).__name__,
            )
        ]
    findings: list[ModelIntegrityFinding] = []
    if not members:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_group_members_empty",
                severity="warning",
                message=f"Detail group '{element_id}' has no members.",
                element_ids=(element_id,),
                field="memberIds",
                expected="at least one member id",
            )
        )
    allowed_member_kinds = ANNOTATION_KINDS | DOCUMENTATION_KINDS
    for index, raw_member_id in enumerate(members):
        if raw_member_id in (None, ""):
            continue
        member_id = str(raw_member_id)
        if member_id == element_id:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_group_self_reference",
                    severity="error",
                    message=f"Detail group '{element_id}' cannot include itself as a member.",
                    element_ids=(element_id,),
                    field=f"memberIds[{index}]",
                    expected="member id different from group id",
                    actual=member_id,
                )
            )
            continue
        member = elements.get(member_id)
        if member is None:
            continue
        member_kind = str(_read(member, "kind", default=""))
        if member_kind not in allowed_member_kinds:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_group_member_role_invalid",
                    severity="error",
                    message=(
                        f"Detail group '{element_id}' member '{member_id}' is kind "
                        f"'{member_kind}', but detail groups may only group annotation or "
                        "documentation elements."
                    ),
                    element_ids=(element_id, member_id),
                    field=f"memberIds[{index}]",
                    expected="annotation or documentation kind",
                    actual=member_kind,
                )
            )
    return findings


def _unit_coordinate_findings(element: Any) -> list[ModelIntegrityFinding]:
    element_id = str(_read(element, "id", default=""))
    kind = str(_read(element, "kind", default=""))
    findings: list[ModelIntegrityFinding] = []

    if kind == "project_settings":
        length_unit = _read(element, "lengthUnit", default=CANONICAL_LENGTH_UNIT)
        if str(length_unit) not in SUPPORTED_LENGTH_UNITS:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_unsupported_length_unit",
                    severity="error",
                    message=(
                        f"Project settings '{element_id}' declare lengthUnit '{length_unit}', "
                        "but model snapshots must normalize geometry to millimeters."
                    ),
                    element_ids=(element_id,),
                    field="lengthUnit",
                    expected=" | ".join(sorted(SUPPORTED_LENGTH_UNITS)),
                    actual=str(length_unit),
                )
            )

    for field in POINT_COORDINATE_FIELDS:
        if _field_present(element, field):
            findings.extend(_coordinate_point_findings(element, element_id, field, _read(element, field)))

    for field in POINT_LIST_COORDINATE_FIELDS:
        if not _field_present(element, field):
            continue
        value = _read(element, field)
        if not isinstance(value, list | tuple):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_coordinate_list_invalid",
                    severity="error",
                    message=f"Element '{element_id}' field '{field}' must be a coordinate list.",
                    element_ids=(element_id,),
                    field=field,
                    expected="list of {xMm, yMm}",
                    actual=type(value).__name__,
                )
            )
            continue
        for index, point in enumerate(value):
            findings.extend(
                _coordinate_point_findings(element, element_id, f"{field}[{index}]", point)
            )

    for field in FINITE_LENGTH_FIELDS:
        if _field_present(element, field):
            value = _read(element, field)
            if value is None:
                continue
            if not _is_finite_number(value):
                findings.append(
                    ModelIntegrityFinding(
                        rule_id="model_integrity_unit_value_non_finite",
                        severity="error",
                        message=f"Element '{element_id}' field '{field}' must be a finite millimeter value.",
                        element_ids=(element_id,),
                        field=field,
                        expected="finite number",
                        actual=str(value),
                    )
                )
    findings.extend(_recursive_unit_coordinate_findings(element, element_id))
    return findings


def _coordinate_point_findings(
    element: Any, element_id: str, field: str, point: Any
) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    coordinates = _coordinate_components(point)
    if coordinates == "legacy_xy":
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_coordinate_not_normalized",
                severity="error",
                message=(
                    f"Element '{element_id}' field '{field}' uses legacy x/y coordinates; "
                    "canonical snapshots must use xMm/yMm."
                ),
                element_ids=(element_id,),
                field=field,
                expected="{xMm, yMm}",
                actual="{x, y}",
            )
        )
        return findings
    if coordinates is None:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_coordinate_invalid_shape",
                severity="error",
                message=f"Element '{element_id}' field '{field}' is not a normalized coordinate.",
                element_ids=(element_id,),
                field=field,
                expected="{xMm, yMm}",
                actual=type(point).__name__,
            )
        )
        return findings
    bad_values = [value for value in coordinates if not _is_finite_number(value)]
    if bad_values:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_coordinate_non_finite",
                severity="error",
                message=f"Element '{element_id}' field '{field}' contains non-finite coordinate values.",
                element_ids=(element_id,),
                field=field,
                expected="finite millimeter coordinates",
                actual=", ".join(str(value) for value in bad_values),
            )
        )
    return findings


def _coordinate_components(point: Any) -> tuple[Any, ...] | Literal["legacy_xy"] | None:
    if isinstance(point, Mapping):
        if "xMm" in point and ("yMm" in point or "zMm" in point):
            values = [point.get("xMm")]
            values.append(point.get("yMm") if "yMm" in point else point.get("zMm"))
            if "zMm" in point and "yMm" in point:
                values.append(point.get("zMm"))
            return tuple(values)
        if "x_mm" in point and ("y_mm" in point or "z_mm" in point):
            values = [point.get("x_mm")]
            values.append(point.get("y_mm") if "y_mm" in point else point.get("z_mm"))
            if "z_mm" in point and "y_mm" in point:
                values.append(point.get("z_mm"))
            return tuple(values)
        if "x" in point and "y" in point:
            return "legacy_xy"
        return None
    x_value = _read(point, "xMm")
    y_value = _read(point, "yMm")
    z_value = _read(point, "zMm")
    if x_value is not None and (y_value is not None or z_value is not None):
        return (x_value, y_value if y_value is not None else z_value)
    return None


def _recursive_unit_coordinate_findings(
    element: Any, element_id: str
) -> list[ModelIntegrityFinding]:
    root = _plain_value(element)
    if not isinstance(root, Mapping):
        return []
    findings: list[ModelIntegrityFinding] = []

    def visit(value: Any, path: str) -> None:
        if isinstance(value, Mapping):
            coordinates = _coordinate_components(value)
            if coordinates is not None and path:
                findings.extend(_coordinate_point_findings(element, element_id, path, value))
                return
            for key, child in value.items():
                key_str = str(key)
                child_path = key_str if not path else f"{path}.{key_str}"
                if _is_mm_field(key_str) and child is not None and not isinstance(
                    child, Mapping | list | tuple
                ):
                    if not _is_finite_number(child):
                        findings.append(
                            ModelIntegrityFinding(
                                rule_id="model_integrity_unit_value_non_finite",
                                severity="error",
                                message=(
                                    f"Element '{element_id}' field '{child_path}' must be "
                                    "a finite millimeter value."
                                ),
                                element_ids=(element_id,),
                                field=child_path,
                                expected="finite number",
                                actual=str(child),
                            )
                        )
                    continue
                visit(child, child_path)
            return
        if isinstance(value, list | tuple):
            for index, child in enumerate(value):
                visit(child, f"{path}[{index}]")

    visit(root, "")
    return findings


def _is_mm_field(field: str) -> bool:
    return field.endswith("Mm") or field.endswith("_mm")


def _type_instance_findings(
    element: Any, elements: Mapping[str, Any]
) -> list[ModelIntegrityFinding]:
    element_id = str(_read(element, "id", default=""))
    kind = str(_read(element, "kind", default=""))
    findings: list[ModelIntegrityFinding] = []

    if kind in {"wall_type", "floor_type", "roof_type"}:
        findings.extend(_type_layer_findings(element, element_id))

    spec = TYPE_INSTANCE_SPECS.get(kind)
    if spec is None:
        return findings
    field, expected_kind, required = spec
    type_id = _read(element, field)
    if type_id in (None, ""):
        if required:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_type_reference_missing",
                    severity="error",
                    message=f"Element '{element_id}' is missing required type field '{field}'.",
                    element_ids=(element_id,),
                    field=field,
                    expected=expected_kind,
                )
            )
        return findings
    type_id = str(type_id)
    target = elements.get(type_id)
    if target is None:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_type_reference_unresolved",
                severity="error",
                message=f"Element '{element_id}' field '{field}' references missing type '{type_id}'.",
                element_ids=(element_id,),
                field=field,
                expected=expected_kind,
                actual=type_id,
            )
        )
        return findings
    target_kind = str(_read(target, "kind", default=""))
    if target_kind != expected_kind:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_type_reference_wrong_kind",
                severity="error",
                message=(
                    f"Element '{element_id}' field '{field}' references '{type_id}' "
                    f"of kind '{target_kind}', expected '{expected_kind}'."
                ),
                element_ids=(element_id, type_id),
                field=field,
                expected=expected_kind,
                actual=target_kind,
            )
        )
        return findings
    findings.extend(_type_material_consistency_findings(element, target, element_id, kind, type_id))
    return findings


def _type_material_consistency_findings(
    element: Any,
    type_element: Any,
    element_id: str,
    kind: str,
    type_id: str,
) -> list[ModelIntegrityFinding]:
    if kind not in {"wall", "floor", "roof"}:
        return []
    type_materials = _type_layer_material_keys(type_element)
    findings: list[ModelIntegrityFinding] = []
    if not type_materials:
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_type_layer_material_missing",
                severity="warning",
                message=f"Type '{type_id}' has no layer material keys for material/type consistency.",
                element_ids=(type_id,),
                field="layers.materialKey",
                expected="at least one layer materialKey",
            )
        )
        return findings

    for field in ("materialKey", "defaultMaterialKey", "structuralMaterialKey"):
        material_key = _read(element, field)
        if material_key in (None, ""):
            continue
        if str(material_key) in type_materials or _truthy(_read_any(element, ("allowMaterialOverride",))):
            continue
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_instance_material_not_in_type",
                severity="warning",
                message=(
                    f"Element '{element_id}' {field} '{material_key}' is not declared by "
                    f"type '{type_id}' layers."
                ),
                element_ids=(element_id, type_id),
                field=field,
                expected=", ".join(sorted(type_materials)),
                actual=str(material_key),
            )
        )
    return findings


def _type_layer_findings(element: Any, element_id: str) -> list[ModelIntegrityFinding]:
    layers = _read(element, "layers", default=[])
    if not isinstance(layers, list | tuple):
        return [
            ModelIntegrityFinding(
                rule_id="model_integrity_type_layers_invalid",
                severity="error",
                message=f"Type element '{element_id}' has non-list layers.",
                element_ids=(element_id,),
                field="layers",
                expected="list",
                actual=type(layers).__name__,
            )
        ]
    findings: list[ModelIntegrityFinding] = []
    for index, layer in enumerate(layers):
        thickness = _read(layer, "thicknessMm")
        function = _read(layer, "function")
        if function in (None, ""):
            function = _read(layer, "layerFunction")
        if not _is_finite_number(thickness) or float(thickness) <= 0:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_type_layer_thickness_invalid",
                    severity="error",
                    message=(
                        f"Type element '{element_id}' layer {index} has invalid thicknessMm."
                    ),
                    element_ids=(element_id,),
                    field=f"layers[{index}].thicknessMm",
                    expected="positive finite millimeter value",
                    actual=str(thickness),
                )
            )
        if function in (None, ""):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_type_layer_function_missing",
                    severity="error",
                    message=f"Type element '{element_id}' layer {index} is missing function.",
                    element_ids=(element_id,),
                    field=f"layers[{index}].function",
                    expected="layer function",
                )
            )
        if _read(layer, "materialKey") in (None, "") and _read(layer, "materialId") in (None, ""):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_type_layer_material_missing",
                    severity="warning",
                    message=f"Type element '{element_id}' layer {index} is missing materialKey.",
                    element_ids=(element_id,),
                    field=f"layers[{index}].materialKey",
                    expected="materialKey or materialId",
                )
            )
    return findings


def _schema_compatibility_findings(subject: Any) -> list[ModelIntegrityFinding]:
    if not isinstance(subject, Mapping):
        return []
    schema_version = subject.get("schemaVersion") or subject.get("schema_version")
    if schema_version in (None, ""):
        return []
    if str(schema_version) in SUPPORTED_SCHEMA_VERSIONS:
        return []
    return [
        ModelIntegrityFinding(
            rule_id="model_integrity_schema_version_unsupported",
            severity="error",
            message=(
                f"Schema version '{schema_version}' is not supported by model integrity checks; "
                "migrate to a supported schema before applying commands or accepting artifacts."
            ),
            field="schemaVersion",
            expected=" | ".join(sorted(SUPPORTED_SCHEMA_VERSIONS)),
            actual=str(schema_version),
        )
    ]


def _level_definition_findings(
    element: Any,
    elements: Mapping[str, Any],
    level_elevations: dict[str, float],
) -> list[ModelIntegrityFinding]:
    element_id = str(_read(element, "id", default=""))
    parent_id = _read(element, "parentLevelId")
    if parent_id in (None, ""):
        return []
    parent_id = str(parent_id)
    parent = elements.get(parent_id)
    if parent is None or str(_read(parent, "kind", default="")) != "level":
        return []
    elevation = level_elevations.get(element_id)
    parent_elevation = level_elevations.get(parent_id)
    offset = _read(element, "offsetFromParentMm", default=0)
    if elevation is None or parent_elevation is None or not _is_finite_number(offset):
        return []
    expected = parent_elevation + float(offset)
    if math.isclose(elevation, expected, rel_tol=0.0, abs_tol=1e-6):
        return []
    return [
        ModelIntegrityFinding(
            rule_id="model_integrity_level_parent_elevation_mismatch",
            severity="error",
            message=(
                f"Level '{element_id}' elevation does not match parent level '{parent_id}' "
                "plus offsetFromParentMm."
            ),
            element_ids=(element_id, parent_id),
            field="elevationMm",
            expected=str(expected),
            actual=str(elevation),
        )
    ]


def _level_semantic_findings(
    element: Any,
    elements: Mapping[str, Any],
    level_elevations: dict[str, float],
) -> list[ModelIntegrityFinding]:
    kind = str(_read(element, "kind", default=""))
    element_id = str(_read(element, "id", default=""))
    if kind not in PHYSICAL_KINDS and kind not in ANALYTICAL_KINDS:
        return []

    findings: list[ModelIntegrityFinding] = []
    for field in _required_level_fields_for_kind(kind):
        value = _read(element, field)
        if value in (None, ""):
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_physical_level_missing",
                    severity="error",
                    message=f"Physical element '{element_id}' is missing required level field '{field}'.",
                    element_ids=(element_id,),
                    field=field,
                    expected="level id",
                )
            )
            continue
        ref_id = str(value)
        target = elements.get(ref_id)
        target_kind = str(_read(target, "kind", default="")) if target is not None else None
        if target_kind != "level":
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_physical_level_invalid",
                    severity="error",
                    message=(
                        f"Physical element '{element_id}' field '{field}' references '{ref_id}', "
                        "which is not a level."
                    ),
                    element_ids=(element_id, ref_id) if target is not None else (element_id,),
                    field=field,
                    expected="level",
                    actual=target_kind or "missing",
                )
            )
    findings.extend(_height_semantic_findings(element, element_id, kind))
    findings.extend(_level_span_findings(element, elements, level_elevations))
    findings.extend(_host_level_findings(element, elements))
    return findings


def _required_level_fields_for_kind(kind: str) -> tuple[str, ...]:
    if kind == "room":
        return ("levelId",)
    if kind == "roof":
        return ("referenceLevelId",)
    if kind == "stair":
        return ("baseLevelId", "topLevelId")
    if kind in {"door", "window", "wall_opening", "slab_opening", "roof_opening", "void_cut"}:
        return ()
    if kind in {"railing", "balcony", "dormer", "soffit", "text_3d", "family_kit_instance"}:
        return ()
    return ("levelId",)


def _height_semantic_findings(
    element: Any,
    element_id: str,
    kind: str,
) -> list[ModelIntegrityFinding]:
    if kind not in {"wall", "window", "floor", "roof", "ceiling", "column", "beam", "mass"}:
        return []
    if not _field_present(element, "heightMm"):
        return []
    height = _read(element, "heightMm")
    if _is_finite_number(height) and float(height) > 0:
        return []
    return [
        ModelIntegrityFinding(
            rule_id="model_integrity_physical_height_invalid",
            severity="error",
            message=f"Physical element '{element_id}' has non-positive or non-finite heightMm.",
            element_ids=(element_id,),
            field="heightMm",
            expected="positive finite millimeter value",
            actual=str(height),
        )
    ]


def _level_span_findings(
    element: Any,
    elements: Mapping[str, Any],
    level_elevations: dict[str, float],
) -> list[ModelIntegrityFinding]:
    element_id = str(_read(element, "id", default=""))
    spans = (
        ("baseLevelId", "topLevelId"),
        ("baseConstraintLevelId", "topConstraintLevelId"),
        ("levelId", "topConstraintLevelId"),
        ("levelId", "upperLimitLevelId"),
    )
    findings: list[ModelIntegrityFinding] = []
    for base_field, top_field in spans:
        base_id = _read(element, base_field)
        top_id = _read(element, top_field)
        if base_id in (None, "") or top_id in (None, ""):
            continue
        base_id = str(base_id)
        top_id = str(top_id)
        if str(_read(elements.get(base_id), "kind", default="")) != "level":
            continue
        if str(_read(elements.get(top_id), "kind", default="")) != "level":
            continue
        base_elevation = level_elevations.get(base_id)
        top_elevation = level_elevations.get(top_id)
        if base_elevation is None or top_elevation is None:
            continue
        if top_elevation > base_elevation:
            continue
        findings.append(
            ModelIntegrityFinding(
                rule_id="model_integrity_level_span_order_invalid",
                severity="error",
                message=(
                    f"Element '{element_id}' has top level '{top_id}' at or below "
                    f"base level '{base_id}'."
                ),
                element_ids=(element_id, base_id, top_id),
                field=top_field,
                expected=f">{base_elevation}",
                actual=str(top_elevation),
            )
        )
    return findings


def _host_level_findings(element: Any, elements: Mapping[str, Any]) -> list[ModelIntegrityFinding]:
    element_id = str(_read(element, "id", default=""))
    level_id = _read(element, "levelId")
    if level_id in (None, ""):
        return []
    host_field = None
    if _field_present(element, "wallId"):
        host_field = "wallId"
    elif _field_present(element, "hostWallId"):
        host_field = "hostWallId"
    if host_field is None:
        return []
    host_id = _read(element, host_field)
    host = elements.get(str(host_id)) if host_id not in (None, "") else None
    if host is None or str(_read(host, "kind", default="")) != "wall":
        return []
    host_level_id = _read(host, "levelId")
    if host_level_id in (None, "") or str(host_level_id) == str(level_id):
        return []
    return [
        ModelIntegrityFinding(
            rule_id="model_integrity_host_level_mismatch",
            severity="error",
            message=(
                f"Hosted element '{element_id}' levelId '{level_id}' does not match "
                f"host wall '{host_id}' levelId '{host_level_id}'."
            ),
            element_ids=(element_id, str(host_id), str(level_id), str(host_level_id)),
            field="levelId",
            expected=str(host_level_id),
            actual=str(level_id),
        )
    ]


def _declared_model_role(element: Any) -> str | None:
    for field in ("modelRole", "model_role", "physicalRole", "physical_role"):
        value = _read(element, field)
        if value not in (None, ""):
            return str(value)
    props = _read(element, "props")
    if isinstance(props, Mapping):
        for field in ("modelRole", "model_role", "physicalRole", "physical_role"):
            value = props.get(field)
            if value not in (None, ""):
                return str(value)
    return None


def _resolved_type_values(element: Any, type_element: Any, kind: str) -> dict[str, Any]:
    if kind in {"wall", "floor", "roof"}:
        layers = _read(type_element, "layers", default=[]) or []
        layer_thicknesses = [
            float(_read(layer, "thicknessMm"))
            for layer in layers
            if _is_finite_number(_read(layer, "thicknessMm"))
        ]
        resolved: dict[str, Any] = {
            "typeName": _read(type_element, "name", default=""),
            "assemblyThicknessMm": round(sum(layer_thicknesses), 6),
            "layerCount": len(layers),
        }
        instance_thickness = _read(element, "thicknessMm")
        if _is_finite_number(instance_thickness):
            resolved["instanceThicknessMm"] = float(instance_thickness)
        return resolved

    type_parameters = _read(type_element, "parameters", default={}) or {}
    instance_parameters = _read(element, "paramValues", default={}) or {}
    resolved_parameters: dict[str, Any] = {}
    if isinstance(type_parameters, Mapping):
        resolved_parameters.update(dict(type_parameters))
    if isinstance(instance_parameters, Mapping):
        resolved_parameters.update(dict(instance_parameters))
    return {
        "typeName": _read(type_element, "name", default=""),
        "parameters": dict(sorted(resolved_parameters.items())),
    }


def _type_override_keys(element: Any, type_element: Any, kind: str) -> list[str]:
    if kind in {"wall", "floor", "roof"}:
        overrides: list[str] = []
        layers = _read(type_element, "layers", default=[]) or []
        layer_thickness = sum(
            float(_read(layer, "thicknessMm"))
            for layer in layers
            if _is_finite_number(_read(layer, "thicknessMm"))
        )
        instance_thickness = _read(element, "thicknessMm")
        if _is_finite_number(instance_thickness) and not math.isclose(
            float(instance_thickness), layer_thickness, rel_tol=0.0, abs_tol=1e-6
        ):
            overrides.append("thicknessMm")
        return overrides
    param_values = _read(element, "paramValues", default={}) or {}
    if isinstance(param_values, Mapping):
        return sorted(str(key) for key in param_values)
    return []


def _type_layer_material_keys(type_element: Any) -> set[str]:
    layers = _read(type_element, "layers", default=[]) or []
    if not isinstance(layers, list | tuple):
        return set()
    keys: set[str] = set()
    for layer in layers:
        for field in ("materialKey", "materialId"):
            value = _read(layer, field)
            if value not in (None, ""):
                keys.add(str(value))
    return keys


def _finding_sort_key(finding: ModelIntegrityFinding) -> tuple[str, tuple[str, ...], str]:
    return (finding.rule_id, finding.element_ids, finding.message)


def _family_content_tracked_items(kind: str) -> list[str]:
    if kind == "family_type":
        return ["BIR-V01", "BIR-V05"]
    if kind == "family_instance":
        return ["BIR-V02"]
    if kind == "asset_library_entry":
        return ["BIR-V03"]
    if kind == "placed_asset":
        return ["BIR-V04", "BIR-V05"]
    return []


def _tracker_items_for_rule(rule_id: str) -> list[str]:
    return KERNEL_RULE_TRACKER_ITEMS.get(
        rule_id, FAMILY_CONTENT_RULE_TRACKER_ITEMS.get(rule_id, [])
    )


def _recommendation_for_rule(rule_id: str) -> str | None:
    return FAMILY_CONTENT_RULE_RECOMMENDATIONS.get(rule_id)


def _read_any(element: Any, fields: tuple[str, ...], default: Any = None) -> Any:
    for field in fields:
        value = _read(element, field)
        if value not in (None, "", [], {}):
            return value
    params = _read(element, "parameters", default={}) or {}
    if isinstance(params, Mapping):
        for field in fields:
            value = _read(params, field)
            if value not in (None, "", [], {}):
                return value
    props = _read(element, "props", default={}) or {}
    if isinstance(props, Mapping):
        for field in fields:
            value = _read(props, field)
            if value not in (None, "", [], {}):
                return value
    return default


def _has_any_field_value(element: Any, fields: tuple[str, ...]) -> bool:
    return _read_any(element, fields) not in (None, "", [], {})


def _strict_family_schema(element: Any) -> bool:
    return _truthy(_read(element, "strictFamilySchema")) or _read(
        element, "familySchemaVersion"
    ) not in (None, "")


def _parameter_schema_map(element: Any) -> dict[str, Any]:
    raw = _read_any(element, ("parameterSchema", "paramSchema"), default=[])
    if not isinstance(raw, list | tuple):
        return {}
    out: dict[str, Any] = {}
    for entry in raw:
        key = _read(entry, "key")
        if key not in (None, ""):
            out[str(key)] = entry
    return out


def _asset_parameter_schema_map(element: Any) -> dict[str, Any]:
    return _parameter_schema_map(element)


def _material_slot_values(raw: Any) -> set[str]:
    if isinstance(raw, Mapping):
        return {str(value) for value in raw.values() if value not in (None, "")}
    if isinstance(raw, list | tuple | set):
        values: set[str] = set()
        for item in raw:
            if isinstance(item, Mapping):
                value = _read(item, "materialKey", default=_read(item, "default"))
                if value not in (None, ""):
                    values.add(str(value))
            elif item not in (None, ""):
                values.add(str(item))
        return values
    return set()


def _parameter_value_findings(
    *,
    element_id: str,
    field: str,
    value: Any,
    entry: Any,
    rule_id: str,
) -> list[ModelIntegrityFinding]:
    findings: list[ModelIntegrityFinding] = []
    value_kind = str(_read(entry, "kind", default=_read(entry, "type", default="")))
    if value_kind in {"mm", "length_mm", "angle_deg"}:
        if not _is_finite_number(value):
            findings.append(
                ModelIntegrityFinding(
                    rule_id=rule_id,
                    severity="error",
                    message=f"Element '{element_id}' field '{field}' must be a finite number.",
                    element_ids=(element_id,),
                    field=field,
                    expected="finite number",
                    actual=str(value),
                )
            )
            return findings
        minimum = _read(entry, "min", default=_read_nested(entry, ("constraints", "min")))
        maximum = _read(entry, "max", default=_read_nested(entry, ("constraints", "max")))
        if _is_finite_number(minimum) and float(value) < float(minimum):
            findings.append(
                ModelIntegrityFinding(
                    rule_id=rule_id,
                    severity="error",
                    message=f"Element '{element_id}' field '{field}' is below its minimum.",
                    element_ids=(element_id,),
                    field=field,
                    expected=f">= {float(minimum):g}",
                    actual=f"{float(value):g}",
                )
            )
        if _is_finite_number(maximum) and float(value) > float(maximum):
            findings.append(
                ModelIntegrityFinding(
                    rule_id=rule_id,
                    severity="error",
                    message=f"Element '{element_id}' field '{field}' exceeds its maximum.",
                    element_ids=(element_id,),
                    field=field,
                    expected=f"<= {float(maximum):g}",
                    actual=f"{float(value):g}",
                )
            )
    elif value_kind in {"enum", "option"}:
        options = _string_list(_read(entry, "options", default=[]))
        if options and str(value) not in set(options):
            findings.append(
                ModelIntegrityFinding(
                    rule_id=rule_id,
                    severity="error",
                    message=f"Element '{element_id}' field '{field}' is not one of the options.",
                    element_ids=(element_id,),
                    field=field,
                    expected=", ".join(options),
                    actual=str(value),
                )
            )
    elif value_kind in {"bool", "boolean"} and not isinstance(value, bool):
        findings.append(
            ModelIntegrityFinding(
                rule_id=rule_id,
                severity="error",
                message=f"Element '{element_id}' field '{field}' must be boolean.",
                element_ids=(element_id,),
                field=field,
                expected="boolean",
                actual=type(value).__name__,
            )
        )
    return findings


def _read_nested(element: Any, fields: tuple[str, ...], default: Any = None) -> Any:
    current = element
    for field in fields:
        current = _read(current, field)
        if current is None:
            return default
    return current


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list | tuple | set):
        return sorted(str(v) for v in value if v not in (None, ""))
    if isinstance(value, Mapping):
        return sorted(str(k) for k in value if k not in (None, ""))
    return []


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def _normalize_host_support(value: Any) -> str:
    token = str(value or "freestanding").strip().lower().replace(" ", "_")
    return HOST_SUPPORT_ALIASES.get(token, token)


def _placement_support_for_asset(element: Any, entry: Any) -> str:
    support = _read_any(element, ("placementSupport", "hostSupport"))
    if support in (None, ""):
        support = _read_any(entry, ("placementSupport", "hostSupport"))
    if support not in (None, ""):
        return _normalize_host_support(support)
    category = str(_read(entry, "category", default="")).lower()
    if category in {"door", "window"}:
        return "wall_hosted"
    return "freestanding"


def _position_supported_by_floor(element: Any, elements: Mapping[str, Any]) -> bool:
    point = _point_xy(_read(element, "positionMm"))
    if point is None:
        return False
    level_id = str(_read(element, "levelId", default=""))
    floors = [
        candidate
        for candidate in elements.values()
        if str(_read(candidate, "kind", default="")) == "floor"
        and str(_read(candidate, "levelId", default="")) == level_id
    ]
    if not floors:
        return True
    return any(_point_in_polygon(point, _polygon_xy(_read(floor, "boundaryMm"))) for floor in floors)


def _embedded_wall_at_position(element: Any, elements: Mapping[str, Any]) -> str | None:
    point = _point_xy(_read(element, "positionMm"))
    if point is None:
        return None
    level_id = str(_read(element, "levelId", default=""))
    for wall in elements.values():
        if str(_read(wall, "kind", default="")) != "wall":
            continue
        if str(_read(wall, "levelId", default="")) != level_id:
            continue
        start = _point_xy(_read(wall, "start"))
        end = _point_xy(_read(wall, "end"))
        if start is None or end is None:
            continue
        thickness = _read(wall, "thicknessMm")
        tolerance = max(25.0, float(thickness) / 2.0 if _is_finite_number(thickness) else 100.0)
        if _point_segment_distance_mm(point, start, end) <= tolerance:
            wall_id = _read(wall, "id")
            return str(wall_id) if wall_id not in (None, "") else None
    return None


def _circulation_overlap_at_position(element: Any, elements: Mapping[str, Any]) -> str | None:
    point = _point_xy(_read(element, "positionMm"))
    if point is None:
        return None
    level_id = str(_read(element, "levelId", default=""))
    for candidate in elements.values():
        kind = str(_read(candidate, "kind", default=""))
        if kind not in {"stair", "ramp"}:
            continue
        if not _circulation_can_overlap_level(candidate, level_id):
            continue
        if _point_in_polygon(point, _polygon_xy(_read(candidate, "boundaryMm"))):
            candidate_id = _read(candidate, "id")
            return str(candidate_id) if candidate_id not in (None, "") else None
    return None


def _circulation_can_overlap_level(candidate: Any, level_id: str) -> bool:
    if not level_id:
        return True
    candidate_level_ids = {
        str(value)
        for value in (
            _read(candidate, "levelId"),
            _read(candidate, "baseLevelId"),
            _read(candidate, "topLevelId"),
        )
        if value not in (None, "")
    }
    return not candidate_level_ids or level_id in candidate_level_ids


def _point_xy(value: Any) -> tuple[float, float] | None:
    x = _read(value, "xMm")
    y = _read(value, "yMm")
    if _is_finite_number(x) and _is_finite_number(y):
        return (float(x), float(y))
    return None


def _polygon_xy(value: Any) -> list[tuple[float, float]]:
    if not isinstance(value, list | tuple):
        return []
    pts: list[tuple[float, float]] = []
    for point in value:
        xy = _point_xy(point)
        if xy is not None:
            pts.append(xy)
    return pts


def _point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    if len(polygon) < 3:
        return False
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        crosses = (yi > y) != (yj > y)
        if crosses:
            x_at_y = (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi
            if x < x_at_y:
                inside = not inside
        j = i
    return inside


def _point_segment_distance_mm(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    px, py = point
    ax, ay = start
    bx, by = end
    dx = bx - ax
    dy = by - ay
    denom = dx * dx + dy * dy
    if denom <= 1e-9:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _wall_length_mm(wall: Any) -> float | None:
    start = _point_xy(_read(wall, "start"))
    end = _point_xy(_read(wall, "end"))
    if start is None or end is None:
        return None
    return math.hypot(end[0] - start[0], end[1] - start[1])


def _numeric_from_mapping(mapping: Any, keys: tuple[str, ...]) -> float | None:
    if not isinstance(mapping, Mapping):
        return None
    for key in keys:
        value = mapping.get(key)
        if _is_finite_number(value):
            return float(value)
    return None


def _counts_by_severity(findings: list[ModelIntegrityFinding]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1
    return dict(sorted(counts.items()))


def _stable_digest(payload: Any) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()


def _plain_value(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(by_alias=True)
    if isinstance(value, Mapping):
        return value
    return value


def _is_finite_number(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return False
    return math.isfinite(float(value))


def _missing_required_ref(element_id: str, spec: ReferenceSpec) -> ModelIntegrityFinding:
    return ModelIntegrityFinding(
        rule_id="model_integrity_required_reference_missing",
        severity="error",
        message=f"Element '{element_id}' is missing required reference field '{spec.field}'.",
        element_ids=(element_id,),
        field=spec.field,
        expected="element id",
    )


def _unresolved_ref(
    element_id: str,
    spec: ReferenceSpec,
    ref_id: str,
    field_path: str | None = None,
) -> ModelIntegrityFinding:
    return ModelIntegrityFinding(
        rule_id="model_integrity_unresolved_reference",
        severity="error",
        message=(
            f"Element '{element_id}' field '{field_path or spec.field}' references "
            f"missing element '{ref_id}'."
        ),
        element_ids=(element_id,),
        field=field_path or spec.field,
        expected="resolvable element id",
        actual=ref_id,
    )


def _wrong_kind_ref(
    element_id: str,
    spec: ReferenceSpec,
    ref_id: str,
    target_kind: str,
    field_path: str | None = None,
) -> ModelIntegrityFinding:
    return ModelIntegrityFinding(
        rule_id="model_integrity_reference_wrong_kind",
        severity="error",
        message=(
            f"Element '{element_id}' field '{field_path or spec.field}' references "
            f"'{ref_id}' of kind '{target_kind}', expected {sorted(spec.allowed_kinds or [])}."
        ),
        element_ids=(element_id, ref_id),
        field=field_path or spec.field,
        expected=" | ".join(sorted(spec.allowed_kinds or [])),
        actual=target_kind,
    )


def _option_set_ids(design_option_sets: list[Any]) -> set[str]:
    return {
        str(_read(option_set, "id"))
        for option_set in design_option_sets
        if _read(option_set, "id") not in (None, "")
    }


def _option_ids_for_set(design_option_sets: list[Any], option_set_id: str) -> set[str]:
    for option_set in design_option_sets:
        if str(_read(option_set, "id", default="")) != option_set_id:
            continue
        options = _read(option_set, "options", default=[]) or []
        return {
            str(_read(option, "id"))
            for option in options
            if _read(option, "id") not in (None, "")
        }
    return set()


def _field_present(element: Any, field: str) -> bool:
    if isinstance(element, Mapping):
        return field in element or _snake_case(field) in element
    if isinstance(element, BaseModel):
        return field in element.model_fields_set or _snake_case(field) in element.model_fields_set
    return hasattr(element, field) or hasattr(element, _snake_case(field))


def _read(element: Any, field: str, default: Any = None) -> Any:
    if element is None:
        return default
    names = (field, _snake_case(field))
    if isinstance(element, Mapping):
        for name in names:
            if name in element:
                return element[name]
        return default
    for name in names:
        if hasattr(element, name):
            return getattr(element, name)
    return default


def _snake_case(name: str) -> str:
    chars: list[str] = []
    for char in name:
        if char.isupper():
            chars.append("_")
            chars.append(char.lower())
        else:
            chars.append(char)
    return "".join(chars).lstrip("_")
