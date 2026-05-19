from __future__ import annotations

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

REFERENCE_SPECS: tuple[ReferenceSpec, ...] = (
    ReferenceSpec("levelId", frozenset({"level"})),
    ReferenceSpec("referenceLevelId", frozenset({"level"})),
    ReferenceSpec("baseLevelId", frozenset({"level"}), required=True),
    ReferenceSpec("topLevelId", frozenset({"level"}), required=True),
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
    ReferenceSpec("stairElementId", frozenset({"stair"}), required=True),
    ReferenceSpec("roomId", frozenset({"room"})),
    ReferenceSpec("hostViewId", VIEW_KINDS),
    ReferenceSpec("viewId", VIEW_KINDS),
    ReferenceSpec("baseViewId", VIEW_KINDS, required=True),
    ReferenceSpec("viewpointId", frozenset({"viewpoint"})),
    ReferenceSpec("planViewId", frozenset({"plan_view"})),
    ReferenceSpec("planOverlaySourcePlanViewId", frozenset({"plan_view"})),
    ReferenceSpec("sheetId", frozenset({"sheet"})),
    ReferenceSpec("scheduleId", frozenset({"schedule"})),
    ReferenceSpec("tagDefinitionId", frozenset({"tag_definition"})),
    ReferenceSpec("viewTemplateId", frozenset({"view_template"})),
    ReferenceSpec("familyTypeId", frozenset({"family_type"})),
    ReferenceSpec("assetId", frozenset({"asset_library_entry"}), required=True),
    ReferenceSpec("materialKey", frozenset({"material"}), validate_only_if_target_kind_exists="material"),
    ReferenceSpec("phaseId", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("phaseCreated", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("phaseDemolished", frozenset({"phase"}), validate_only_if_target_kind_exists="phase"),
    ReferenceSpec("optionSetId"),
    ReferenceSpec("optionId"),
)


def model_integrity_invariant_contract_v1() -> dict[str, Any]:
    return {
        "format": "modelIntegrityInvariantContract_v1",
        "roles": sorted(VALID_MODEL_ROLES),
        "roleByKind": dict(sorted(ROLE_BY_KIND.items())),
        "physicalKinds": sorted(PHYSICAL_KINDS),
        "referenceFields": [
            {
                "field": spec.field,
                "allowedKinds": sorted(spec.allowed_kinds) if spec.allowed_kinds else None,
                "required": spec.required,
                "many": spec.many,
                "conditionalOnTargetKind": spec.validate_only_if_target_kind_exists,
            }
            for spec in REFERENCE_SPECS
        ],
        "trackedItems": ["BIR-P01", "BIR-P02", "BIR-P04", "BIR-P05", "BIR-P08"],
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
        findings.extend(_level_semantic_findings(element, elements))

    return findings


def model_integrity_smoke_v1(subject: Any, *, require_explicit_roles: bool = False) -> dict[str, Any]:
    findings = check_model_integrity_invariants(
        subject, require_explicit_roles=require_explicit_roles
    )
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1
    return {
        "format": "modelIntegritySmoke_v1",
        "trackedItems": ["BIR-P01", "BIR-P02", "BIR-P04", "BIR-P05", "BIR-P08"],
        "ok": counts.get("error", 0) == 0,
        "findingCount": len(findings),
        "countsBySeverity": dict(sorted(counts.items())),
        "findings": [finding.to_dict() for finding in findings],
    }


def _elements_mapping(subject: Any) -> Mapping[str, Any] | None:
    if hasattr(subject, "elements"):
        elements = getattr(subject, "elements")
        return elements if isinstance(elements, Mapping) else None
    if isinstance(subject, Mapping):
        if "elements" in subject:
            elements = subject.get("elements")
            return elements if isinstance(elements, Mapping) else None
        return subject
    return None


def _design_option_sets(subject: Any) -> list[Any]:
    if hasattr(subject, "design_option_sets"):
        raw = getattr(subject, "design_option_sets")
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
        if require_explicit_roles and kind in PHYSICAL_KINDS:
            findings.append(
                ModelIntegrityFinding(
                    rule_id="model_integrity_missing_explicit_model_role",
                    severity="warning",
                    message=f"Physical element '{element_id}' does not declare an explicit model role.",
                    element_ids=(element_id,),
                    field="modelRole",
                    expected="physical",
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
    for spec in REFERENCE_SPECS:
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
                findings.append(
                    ModelIntegrityFinding(
                        rule_id="model_integrity_reference_wrong_kind",
                        severity="error",
                        message=(
                            f"Element '{element_id}' field '{spec.field}' references '{ref_id}' "
                            f"of kind '{target_kind}', expected {sorted(spec.allowed_kinds)}."
                        ),
                        element_ids=(element_id, ref_id),
                        field=spec.field,
                        expected=" | ".join(sorted(spec.allowed_kinds)),
                        actual=target_kind,
                    )
                )
    return findings


def _level_semantic_findings(element: Any, elements: Mapping[str, Any]) -> list[ModelIntegrityFinding]:
    kind = str(_read(element, "kind", default=""))
    element_id = str(_read(element, "id", default=""))
    if kind not in PHYSICAL_KINDS:
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
    return findings


def _required_level_fields_for_kind(kind: str) -> tuple[str, ...]:
    if kind == "roof":
        return ("referenceLevelId",)
    if kind == "stair":
        return ("baseLevelId", "topLevelId")
    if kind in {"door", "window", "wall_opening", "slab_opening", "roof_opening", "void_cut"}:
        return ()
    if kind in {"railing", "balcony", "dormer", "soffit", "text_3d", "family_kit_instance"}:
        return ()
    return ("levelId",)


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


def _missing_required_ref(element_id: str, spec: ReferenceSpec) -> ModelIntegrityFinding:
    return ModelIntegrityFinding(
        rule_id="model_integrity_required_reference_missing",
        severity="error",
        message=f"Element '{element_id}' is missing required reference field '{spec.field}'.",
        element_ids=(element_id,),
        field=spec.field,
        expected="element id",
    )


def _unresolved_ref(element_id: str, spec: ReferenceSpec, ref_id: str) -> ModelIntegrityFinding:
    return ModelIntegrityFinding(
        rule_id="model_integrity_unresolved_reference",
        severity="error",
        message=f"Element '{element_id}' field '{spec.field}' references missing element '{ref_id}'.",
        element_ids=(element_id,),
        field=spec.field,
        expected="resolvable element id",
        actual=ref_id,
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
