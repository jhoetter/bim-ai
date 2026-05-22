"""v1 evidence/contract emitters for the model-integrity surface.

Extracted from ``model_integrity.py`` to keep that file under the
sub-3000 LOC ceiling. These functions are pure assemblers that wrap
``check_model_integrity_invariants`` and helper utilities defined alongside
it, so re-imports remain unidirectional (``model_integrity_v1_reports`` →
``model_integrity``).
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from bim_ai.model_integrity import (
    ANALYTICAL_KINDS,
    ASSET_CATALOG_FIELDS,
    CANONICAL_LENGTH_UNIT,
    DOCUMENTATION_KINDS,
    FAMILY_CONTENT_TRACKED_ITEMS,
    FAMILY_OVERRIDE_SCHEDULED_KEYS,
    FAMILY_PARITY_FIELDS,
    FAMILY_TYPE_SCHEMA_FIELDS,
    FINITE_LENGTH_FIELDS,
    HELPER_KINDS,
    HOST_SUPPORT_ALIASES,
    IMPORTED_PROXY_KINDS,
    NESTED_REFERENCE_FIELDS,
    PHYSICAL_KINDS,
    POINT_COORDINATE_FIELDS,
    POINT_LIST_COORDINATE_FIELDS,
    REFERENCE_SPECS,
    ROLE_BY_KIND,
    STABLE_ELEMENT_ID_PATTERN,
    SUPPORTED_LENGTH_UNITS,
    SUPPORTED_SCHEMA_VERSIONS,
    TYPE_INSTANCE_SPECS,
    VALID_MODEL_ROLES,
    ModelIntegrityFinding,
    _counts_by_severity,
    _elements_mapping,
    _family_content_findings,
    _family_content_tracked_items,
    _finding_sort_key,
    _read,
    _resolved_type_values,
    _role_counts,
    _schema_compatibility_findings,
    _stable_digest,
    _type_override_keys,
    _unit_coordinate_findings,
    check_model_integrity_invariants,
)


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


def model_integrity_smoke_v1(
    subject: Any, *, require_explicit_roles: bool = False
) -> dict[str, Any]:
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
