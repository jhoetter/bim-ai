from __future__ import annotations

import hashlib
import json
import math
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

ANALYTICAL_KINDS: frozenset[str] = frozenset({"room"})

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

REFERENCE_SPECS: tuple[ReferenceSpec, ...] = (
    ReferenceSpec("levelId", frozenset({"level"})),
    ReferenceSpec("underlayLevelId", frozenset({"level"})),
    ReferenceSpec("referenceLevelId", frozenset({"level"})),
    ReferenceSpec(
        "baseLevelId",
        frozenset({"level"}),
        required=True,
        source_kinds=frozenset({"stair"}),
    ),
    ReferenceSpec(
        "topLevelId",
        frozenset({"level"}),
        required=True,
        source_kinds=frozenset({"stair"}),
    ),
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
    ReferenceSpec(
        "parentSheetId",
        frozenset({"sheet"}),
        required=True,
        source_kinds=frozenset({"callout"}),
    ),
    ReferenceSpec("scheduleId", frozenset({"schedule"})),
    ReferenceSpec("tagDefinitionId", frozenset({"tag_definition"})),
    ReferenceSpec("planOpeningTagStyleId", frozenset({"plan_tag_style"})),
    ReferenceSpec("planRoomTagStyleId", frozenset({"plan_tag_style"})),
    ReferenceSpec("viewTemplateId", frozenset({"view_template"})),
    ReferenceSpec("templateId", frozenset({"view_template"})),
    ReferenceSpec(
        "titleblockTypeId",
        frozenset({"titleblock_type"}),
        validate_only_if_target_kind_exists="titleblock_type",
    ),
    ReferenceSpec(
        "brandTemplateId",
        frozenset({"brand_template"}),
        validate_only_if_target_kind_exists="brand_template",
    ),
    ReferenceSpec("familyTypeId", frozenset({"family_type"})),
    ReferenceSpec("wallTypeId", frozenset({"wall_type"})),
    ReferenceSpec("floorTypeId", frozenset({"floor_type"})),
    ReferenceSpec("roofTypeId", frozenset({"roof_type"})),
    ReferenceSpec("assetId", frozenset({"asset_library_entry"}), required=True),
    ReferenceSpec("materialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec(
        "defaultMaterialKey",
        frozenset({"material"}),
        validate_only_if_target_kind_exists="material",
    ),
    ReferenceSpec(
        "structuralMaterialKey",
        frozenset({"material"}),
        validate_only_if_target_kind_exists="material",
    ),
    ReferenceSpec(
        "wallMaterialKey",
        frozenset({"material"}),
        validate_only_if_target_kind_exists="material",
    ),
    ReferenceSpec(
        "roofMaterialKey",
        frozenset({"material"}),
        validate_only_if_target_kind_exists="material",
    ),
    ReferenceSpec("materialId", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec(
        "countertopMaterialId",
        frozenset({"material"}),
        validate_only_if_target_kind_exists="material",
    ),
    ReferenceSpec("phaseId", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("phaseCreated", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("phaseDemolished", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("optionSetId"),
    ReferenceSpec("optionId"),
    ReferenceSpec("linkId", IMPORTED_PROXY_KINDS, validate_only_if_target_kind_exists="link_model"),
    ReferenceSpec(
        "_linkedFromLinkId",
        IMPORTED_PROXY_KINDS,
        validate_only_if_target_kind_exists="link_model",
    ),
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
        "schemaMigrationCompatibility": {
            "supportedSchemaVersions": sorted(SUPPORTED_SCHEMA_VERSIONS),
            "missingSchemaVersionPolicy": "model snapshots without schemaVersion are accepted as current in-memory snapshots",
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
        "trackedItems": [
            "BIR-P01",
            "BIR-P02",
            "BIR-P03",
            "BIR-P04",
            "BIR-P05",
            "BIR-P06",
            "BIR-P07",
            "BIR-P08",
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


def model_integrity_smoke_command_evidence_v1(subject: Any) -> dict[str, Any]:
    smoke = model_integrity_smoke_v1(subject)
    strict_role_smoke = model_integrity_smoke_v1(subject, require_explicit_roles=True)
    units = model_integrity_units_coordinate_normalization_v1(subject)
    inheritance = resolve_type_instance_inheritance_v1(subject)
    schema = schema_migration_compatibility_v1(subject)
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
        },
    }
    evidence["digestSha256"] = _stable_digest(evidence)
    return evidence


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

    def visit(value: Any, path: str, *, is_root: bool = False) -> None:
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
                        )
                    )
                visit(child, child_path)
            return
        if isinstance(value, list | tuple):
            for index, child in enumerate(value):
                visit(child, f"{path}[{index}]")

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
        if spec.field == "optionSetId":
            if design_option_sets and ref_id not in _option_set_ids(design_option_sets):
                findings.append(_unresolved_ref(element_id, spec, ref_id, field_path))
            continue
        if spec.field == "optionId":
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
