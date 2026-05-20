from __future__ import annotations

import hashlib
import json
from collections import Counter
from typing import Any

REQUIRED_IR_KEYS = {
    "sourceManifest",
    "extractedFacts",
    "levels",
    "floorPlanGraphs",
    "rooms",
    "openings",
    "site",
    "conflicts",
}

SOURCE_FACT_STATUSES = {
    "candidate",
    "accepted",
    "rejected",
    "conflicting",
    "superseded",
    "modeled",
    "deferred",
}

FINDING_DISPOSITIONS = {
    "fixed",
    "not_applicable",
    "source_conflict",
    "later_phase",
    "tolerated",
    "blocked",
}

FACT_KIND_TO_AUTHORING_TOOL = {
    "level": "author.level",
    "wall_line": "author.wall",
    "wall_chain": "author.wall_chain",
    "floor_boundary": "author.floor_from_boundary",
    "room": "author.room_outline",
    "door": "opening.door_on_wall",
    "window": "opening.window_on_wall",
    "opening": "opening.door_on_wall",
    "roof": "author.roof_from_boundary",
    "dormer": "author.dormer_on_roof",
    "roof_opening": "opening.roof_opening",
    "stair": "author.stair_between_levels",
    "slab_opening": "opening.slab_opening",
    "parcel_boundary": "site.property-line-create",
    "terrain": "toposolid-create",
}

NON_AUTHORING_SOURCE_FACT_KINDS = {
    "area",
    "volume",
    "wall_thickness",
    "material",
    "construction_history",
    "photo_observation",
    "drainage",
    "basement",
    "conflict",
    "site_context",
}


def validate_existing_building_ir(ir: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    if not isinstance(ir, dict):
        return _result(
            ok=False,
            format_name="existingBuildingIrValidation_v1",
            summary={"errorCount": 1, "warningCount": 0},
            findings=[
                {
                    "code": "ir_not_object",
                    "severity": "error",
                    "message": "ExistingBuildingIR must be a JSON object.",
                }
            ],
        )

    missing = sorted(REQUIRED_IR_KEYS - set(ir))
    for key in missing:
        findings.append(
            {
                "code": "ir_required_key_missing",
                "severity": "error",
                "field": key,
                "message": f"ExistingBuildingIR is missing required key '{key}'.",
            }
        )

    facts = ir.get("extractedFacts", [])
    if not isinstance(facts, list):
        findings.append(
            {
                "code": "ir_extracted_facts_not_array",
                "severity": "error",
                "field": "extractedFacts",
                "message": "extractedFacts must be an array.",
            }
        )
        facts = []
    fact_ids: set[str] = set()
    duplicate_ids: set[str] = set()
    facts_missing_provenance = 0
    for idx, fact in enumerate(facts):
        if not isinstance(fact, dict):
            findings.append(
                {
                    "code": "ir_fact_not_object",
                    "severity": "error",
                    "field": f"extractedFacts[{idx}]",
                    "message": "Source fact must be an object.",
                }
            )
            continue
        fact_id = str(fact.get("factId") or "")
        if not fact_id:
            findings.append(
                {
                    "code": "ir_fact_id_missing",
                    "severity": "error",
                    "field": f"extractedFacts[{idx}].factId",
                    "message": "Source fact is missing factId.",
                }
            )
        elif fact_id in fact_ids:
            duplicate_ids.add(fact_id)
        else:
            fact_ids.add(fact_id)
        if not isinstance(fact.get("provenance"), dict):
            facts_missing_provenance += 1
        status = str(fact.get("status") or "candidate")
        if status not in SOURCE_FACT_STATUSES:
            findings.append(
                {
                    "code": "ir_fact_status_invalid",
                    "severity": "warning",
                    "field": f"extractedFacts[{idx}].status",
                    "message": f"Unsupported source fact status '{status}'.",
                }
            )
        confidence = fact.get("confidence")
        if confidence is None:
            findings.append(
                {
                    "code": "ir_fact_confidence_missing",
                    "severity": "warning",
                    "field": f"extractedFacts[{idx}].confidence",
                    "message": "Source fact should carry confidence.",
                }
            )
        elif not isinstance(confidence, int | float) or not 0 <= confidence <= 1:
            findings.append(
                {
                    "code": "ir_fact_confidence_invalid",
                    "severity": "error",
                    "field": f"extractedFacts[{idx}].confidence",
                    "message": "Source fact confidence must be between 0 and 1.",
                }
            )
    for fact_id in sorted(duplicate_ids):
        findings.append(
            {
                "code": "ir_fact_id_duplicate",
                "severity": "error",
                "message": f"Duplicate source fact id '{fact_id}'.",
            }
        )
    if facts_missing_provenance:
        findings.append(
            {
                "code": "ir_fact_provenance_missing",
                "severity": "error",
                "message": f"{facts_missing_provenance} source fact(s) are missing provenance.",
            }
        )

    for collection_key in ("levels", "rooms", "openings", "conflicts"):
        value = ir.get(collection_key, [])
        if value is not None and not isinstance(value, list):
            findings.append(
                {
                    "code": "ir_collection_not_array",
                    "severity": "error",
                    "field": collection_key,
                    "message": f"{collection_key} must be an array.",
                }
            )

    severity_counts = Counter(str(row.get("severity") or "warning") for row in findings)
    return _result(
        ok=severity_counts.get("error", 0) == 0,
        format_name="existingBuildingIrValidation_v1",
        summary={
            "factCount": len(facts),
            "findingCount": len(findings),
            "errorCount": severity_counts.get("error", 0),
            "warningCount": severity_counts.get("warning", 0),
            "duplicateFactCount": len(duplicate_ids),
            "factsMissingProvenance": facts_missing_provenance,
        },
        findings=findings,
    )


def build_existing_building_ir_seed(
    *,
    source_manifest: dict[str, Any],
    source_facts: dict[str, Any] | None = None,
    classifications: dict[str, Any] | None = None,
) -> dict[str, Any]:
    facts = list((source_facts or {}).get("facts") or [])
    drawing_docs = [
        row
        for row in (classifications or {}).get("documents", [])
        if row.get("classification") in {"floor_plan", "section", "elevation", "site_plan"}
    ]
    return {
        "format": "ExistingBuildingIR_v1",
        "sourceManifest": {
            "manifestDigestSha256": source_manifest.get("manifestDigestSha256"),
            "fileCount": source_manifest.get("fileCount", 0),
            "rootPath": source_manifest.get("rootPath"),
        },
        "coordinateFrames": [],
        "extractedFacts": facts,
        "conflicts": [],
        "levels": [],
        "site": {"drawingDocumentIds": [row.get("sourceDocumentId") for row in drawing_docs]},
        "buildingShell": {},
        "floorPlanGraphs": [],
        "rooms": [],
        "openings": [],
        "stairs": [],
        "roofsDormers": [],
        "basementCellar": {},
        "materialsHistory": [],
        "areasVolumes": [],
        "modelingPlan": [],
        "acceptanceRequirements": [],
    }


def build_source_coverage_matrix(
    *,
    facts: list[dict[str, Any]],
    fact_to_element_refs: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    refs = fact_to_element_refs or {}
    rows: list[dict[str, Any]] = []
    for fact in facts:
        fact_id = str(fact.get("factId") or "")
        element_ids = [str(eid) for eid in refs.get(fact_id, [])]
        source_status = str(fact.get("status") or "candidate")
        coverage_status = "modeled" if element_ids else source_status
        rows.append(
            {
                "factId": fact_id,
                "kind": fact.get("kind"),
                "sourceStatus": source_status,
                "coverageStatus": coverage_status,
                "elementIds": element_ids,
                "confidence": fact.get("confidence"),
                "provenance": fact.get("provenance"),
            }
        )
    counts = Counter(str(row["coverageStatus"]) for row in rows)
    uncovered = [
        row
        for row in rows
        if row["coverageStatus"] in {"candidate", "accepted", "conflicting"} and not row["elementIds"]
    ]
    payload = {
        "format": "reverseBimSourceCoverageMatrix_v1",
        "factCount": len(rows),
        "coverageCounts": dict(sorted(counts.items())),
        "uncoveredBlockingFactCount": len(uncovered),
        "rows": rows,
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def plan_mcp_authoring_actions(
    *,
    facts: list[dict[str, Any]],
    target_phase: str | None = None,
) -> dict[str, Any]:
    """Map source facts to MCP authoring tools or resolver prerequisites.

    This planner is intentionally conservative. It does not invent geometry or
    author raw bundles. It names the first-class MCP surface to use when a fact
    already carries enough structured value; otherwise it records which resolver
    or AI/refinement step is required before modeling can proceed.
    """

    actions: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        fact_id = str(fact.get("factId") or "")
        kind = str(fact.get("kind") or "")
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        if _is_metadata_fact(kind, value):
            continue
        tool = _tool_for_fact(kind, value)
        if tool is None:
            blockers.append(
                {
                    "factId": fact_id,
                    "kind": kind,
                    "code": "reverse_bim_authoring_tool_unmapped",
                    "message": f"No first-class MCP authoring tool is mapped for source fact kind '{kind}'.",
                }
            )
            continue

        requirements = _requirements_for_tool(tool, value)
        payload_draft = _payload_draft_for_tool(tool, value)
        ready = not requirements
        action = {
            "factId": fact_id,
            "kind": kind,
            "tool": tool,
            "phase": target_phase,
            "readyForDryRun": ready,
            "sourceConfidence": fact.get("confidence"),
            "sourceProvenance": fact.get("provenance"),
            "requiredBeforeDryRun": requirements,
            "payloadDraft": payload_draft,
            "expectedReadback": _expected_readback_for_tool(
                tool=tool,
                payload=payload_draft,
                source_value=value,
                fact_id=fact_id,
            ),
            "transactionPolicy": {
                "dryRunFirst": True,
                "commitVia": "model.commit_bundle",
                "queryAfterCommit": True,
                "qaAfterCommit": ["qa.advisor", "qa.constructability", "qa.integrity_preflight"],
            },
        }
        actions.append(action)
        if not ready:
            blockers.append(
                {
                    "factId": fact_id,
                    "kind": kind,
                    "tool": tool,
                    "code": "reverse_bim_authoring_requirements_missing",
                    "requiredBeforeDryRun": requirements,
                }
            )

    summary = {
        "factCount": len(facts),
        "actionCount": len(actions),
        "readyActionCount": sum(1 for action in actions if action["readyForDryRun"]),
        "blockedActionCount": len(blockers),
    }
    payload = {
        "ok": len(blockers) == 0,
        "format": "reverseBimMcpAuthoringPlan_v1",
        "phase": target_phase,
        "summary": summary,
        "actions": actions,
        "blockers": blockers,
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def build_mcp_authoring_readiness(
    *,
    facts: list[dict[str, Any]],
    target_phase: str | None = None,
) -> dict[str, Any]:
    """Classify normalized source facts by how an agent can feed MCP tools.

    This is the deterministic bridge between AI document understanding and live
    BIM authoring. It does not call MCP tools. It tells the agent which facts
    already have a complete authoring payload, which require resolver/query
    tools, which need another source-reading pass, and which are metadata or
    conflict facts that inform modeling but are not directly authored.
    """

    plan = plan_mcp_authoring_actions(facts=facts, target_phase=target_phase)
    actions_by_fact = {
        str(action.get("factId") or ""): action
        for action in plan.get("actions", [])
        if isinstance(action, dict)
    }
    rows: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    for fact in facts:
        if not isinstance(fact, dict):
            continue
        fact_id = str(fact.get("factId") or "")
        kind = str(fact.get("kind") or "")
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        action = actions_by_fact.get(fact_id)
        if action is None:
            status = _non_authoring_status(kind, value)
            row = {
                "factId": fact_id,
                "kind": kind,
                "status": status,
                "readyForMcpAuthoring": status in {"metadata_for_authoring", "reference_only"},
                "mcpTool": None,
                "mcpInputDraft": None,
                "requiredBeforeMcp": [],
                "sourceConfidence": fact.get("confidence"),
                "sourceProvenance": fact.get("provenance"),
                "recommendation": _non_authoring_recommendation(kind, status),
            }
            if status in {"source_conflict_disposition_required", "missing_mcp_tool"}:
                blockers.append(
                    {
                        "factId": fact_id,
                        "kind": kind,
                        "status": status,
                        "code": "reverse_bim_mcp_readiness_blocked",
                    }
                )
            rows.append(row)
            continue

        requirements = list(action.get("requiredBeforeDryRun") or [])
        status = _mcp_action_status(requirements)
        row = {
            "factId": fact_id,
            "kind": kind,
            "status": status,
            "readyForMcpAuthoring": status == "ready_for_mcp_authoring",
            "mcpTool": action.get("tool"),
            "mcpInputDraft": action.get("payloadDraft"),
            "expectedReadback": action.get("expectedReadback"),
            "requiredBeforeMcp": requirements,
            "sourceConfidence": fact.get("confidence"),
            "sourceProvenance": fact.get("provenance"),
            "transactionPolicy": action.get("transactionPolicy"),
            "recommendation": _mcp_action_recommendation(status, requirements),
        }
        if status != "ready_for_mcp_authoring":
            blockers.append(
                {
                    "factId": fact_id,
                    "kind": kind,
                    "tool": action.get("tool"),
                    "status": status,
                    "code": "reverse_bim_mcp_readiness_blocked",
                    "requiredBeforeMcp": requirements,
                }
            )
        rows.append(row)

    status_counts = Counter(str(row.get("status")) for row in rows)
    payload = {
        "ok": len(blockers) == 0,
        "format": "reverseBimMcpAuthoringReadiness_v1",
        "phase": target_phase,
        "summary": {
            "factCount": len(facts),
            "rowCount": len(rows),
            "readyForMcpAuthoringCount": status_counts.get("ready_for_mcp_authoring", 0),
            "needsResolverCount": status_counts.get("needs_mcp_resolver", 0),
            "needsSourceRefinementCount": status_counts.get("needs_source_refinement", 0),
            "needsResolverAndSourceRefinementCount": status_counts.get(
                "needs_mcp_resolver_and_source_refinement", 0
            ),
            "metadataForAuthoringCount": status_counts.get("metadata_for_authoring", 0),
            "referenceOnlyCount": status_counts.get("reference_only", 0),
            "sourceConflictCount": status_counts.get("source_conflict_disposition_required", 0),
            "missingMcpToolCount": status_counts.get("missing_mcp_tool", 0),
            "blockerCount": len(blockers),
            "statusCounts": dict(sorted(status_counts.items())),
        },
        "rows": rows,
        "blockers": blockers,
        "authoringPlan": plan,
        "nextStep": (
            "Proceed with MCP dry-run authoring transactionally, then query model and QA."
            if not blockers
            else "Resolve requiredBeforeMcp items or source conflicts before authoring blocked facts."
        ),
    }
    payload["digestSha256"] = _digest(payload)
    return payload


def build_reverse_bim_phase_packet(
    *,
    phase_id: str,
    start_revision: int | None = None,
    end_revision: int | None = None,
    source_fact_ids: list[str] | None = None,
    transactions: list[dict[str, Any]] | None = None,
    advisor: dict[str, Any] | None = None,
    constructability: dict[str, Any] | None = None,
    integrity_preflight: dict[str, Any] | None = None,
    evidence_package: dict[str, Any] | None = None,
    finding_dispositions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    dispositions = finding_dispositions or []
    findings: list[dict[str, Any]] = []
    required_reports = {
        "advisor": advisor,
        "constructability": constructability,
        "integrityPreflight": integrity_preflight,
    }
    for report_name, report_payload in required_reports.items():
        if not _has_report_payload(report_payload):
            findings.append(
                {
                    "code": "phase_required_report_missing",
                    "severity": "error",
                    "field": report_name,
                    "message": f"Phase packet is missing required {report_name} report.",
                }
            )
    for idx, disposition in enumerate(dispositions):
        value = str(disposition.get("disposition") or "")
        if value not in FINDING_DISPOSITIONS:
            findings.append(
                {
                    "code": "phase_disposition_invalid",
                    "severity": "error",
                    "field": f"findingDispositions[{idx}].disposition",
                    "message": f"Unsupported finding disposition '{value}'.",
                }
            )
        if value == "tolerated" and not disposition.get("reason"):
            findings.append(
                {
                    "code": "phase_tolerance_reason_missing",
                    "severity": "error",
                    "field": f"findingDispositions[{idx}].reason",
                    "message": "Tolerated findings require a reason.",
                }
            )

    open_blockers = [
        row
        for row in dispositions
        if str(row.get("disposition") or "") in {"blocked", "source_conflict"}
    ]
    advisor_counts = _severity_counts_from_payload(advisor or {})
    constructability_counts = _severity_counts_from_payload(constructability or {})
    integrity_counts = _severity_counts_from_payload(integrity_preflight or {})
    blocking_warning_count = (
        int(advisor_counts.get("warning", 0))
        + int(constructability_counts.get("warning", 0))
        + int(integrity_counts.get("warning", 0))
    )
    payload = {
        "format": "reverseBimPhasePacket_v1",
        "phaseId": phase_id,
        "startRevision": start_revision,
        "endRevision": end_revision,
        "sourceFactIds": source_fact_ids or [],
        "transactions": transactions or [],
        "advisor": advisor or {},
        "constructability": constructability or {},
        "integrityPreflight": integrity_preflight or {},
        "evidencePackage": evidence_package or {},
        "findingDispositions": dispositions,
        "openBlockers": open_blockers,
        "packetFindings": findings,
        "summary": {
            "transactionCount": len(transactions or []),
            "sourceFactCount": len(source_fact_ids or []),
            "advisorSeverityCounts": advisor_counts,
            "constructabilitySeverityCounts": constructability_counts,
            "integritySeverityCounts": integrity_counts,
            "blockingWarningCount": blocking_warning_count,
            "openBlockerCount": len(open_blockers),
            "packetErrorCount": sum(1 for row in findings if row.get("severity") == "error"),
            "missingRequiredReportCount": sum(
                1 for row in findings if row.get("code") == "phase_required_report_missing"
            ),
        },
    }
    payload["acceptedForNextPhase"] = (
        payload["summary"]["openBlockerCount"] == 0
        and payload["summary"]["packetErrorCount"] == 0
        and int(advisor_counts.get("error", 0)) == 0
        and int(constructability_counts.get("error", 0)) == 0
        and int(integrity_counts.get("error", 0)) == 0
        and blocking_warning_count == 0
    )
    payload["digestSha256"] = _digest(payload)
    return payload


def _is_metadata_fact(kind: str, value: dict[str, Any]) -> bool:
    return (
        kind == "room"
        and value.get("areaM2") is not None
        and not (value.get("boundaryMm") or value.get("boundary") or value.get("boundaryPointsMm"))
    )


def _tool_for_fact(kind: str, value: dict[str, Any]) -> str | None:
    disposition = value.get("disposition") if isinstance(value.get("disposition"), dict) else {}
    if kind == "terrain" and disposition.get("decision") == "accept_context_only_no_toposolid":
        return None
    if kind == "parcel_boundary" and disposition.get("decision") == "accept_context_only":
        return None
    if kind == "opening":
        opening_kind = str(
            value.get("openingKind")
            or value.get("openingType")
            or value.get("type")
            or value.get("name")
            or ""
        ).lower()
        if any(token in opening_kind for token in ("roof", "skylight", "dachfenster")):
            return "opening.roof_opening"
        if "window" in opening_kind or "fenster" in opening_kind:
            return "opening.window_on_wall"
        return "opening.door_on_wall"
    return FACT_KIND_TO_AUTHORING_TOOL.get(kind)


def _requirements_for_tool(tool: str, value: dict[str, Any]) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    if tool in {"author.wall", "author.wall_chain", "author.floor_from_boundary", "author.room_outline"}:
        if not (value.get("levelId") or value.get("levelName")):
            requirements.append({"resolver": "resolve.active_or_default_level", "reason": "level required"})
    if tool == "author.wall":
        if not (value.get("start") and value.get("end")):
            requirements.append({"source": "ai_document_read", "reason": "wall start/end required"})
    if tool == "author.wall_chain":
        if not value.get("points"):
            requirements.append({"source": "ai_document_read", "reason": "wall chain points required"})
        if value.get("thicknessMm") is None:
            requirements.append({"source": "ai_document_read", "reason": "wall thickness required"})
    if tool in {"author.floor_from_boundary", "author.room_outline", "author.roof_from_boundary"}:
        if not (value.get("boundaryMm") or value.get("boundary")):
            requirements.append({"source": "ai_document_read", "reason": "closed boundary required"})
    if tool in {"opening.door_on_wall", "opening.window_on_wall"}:
        if not value.get("wallId"):
            requirements.append({"resolver": "resolve.wall_by_line", "reason": "host wall required"})
        if value.get("alongT") is None:
            requirements.append({"resolver": "query.nearest_wall", "reason": "normalized host position required"})
    if tool == "opening.roof_opening" and not value.get("hostRoofId"):
        requirements.append({"resolver": "resolve.roof_host_region", "reason": "host roof required"})
    if tool == "author.dormer_on_roof":
        if not value.get("hostRoofId"):
            requirements.append({"resolver": "resolve.roof_host_region", "reason": "host roof required"})
        if not value.get("positionOnRoof"):
            requirements.append(
                {
                    "resolver": "resolve.roof_position_from_source_point",
                    "reason": "roof-local dormer position required",
                }
            )
        for key in ("widthMm", "depthMm"):
            if key not in value:
                requirements.append({"source": "ai_document_read", "reason": f"{key} required"})
        if not (value.get("wallHeightMm") or value.get("heightMm")):
            requirements.append({"source": "ai_document_read", "reason": "wallHeightMm required"})
    if tool == "author.stair_between_levels":
        for key in ("baseLevelId", "topLevelId", "runStartMm", "runEndMm"):
            if key not in value:
                requirements.append({"source": "ai_document_read", "reason": f"{key} required"})
    if tool == "site.property-line-create" and not value.get("boundary"):
        requirements.append({"source": "ai_document_read", "reason": "property boundary points required"})
    if tool == "toposolid-create":
        if not (value.get("elevationPoints") or value.get("contours") or value.get("mesh")):
            requirements.append(
                {
                    "source": "ai_document_read",
                    "reason": "terrain elevation points, contours, or mesh required",
                }
            )
    return requirements


def _payload_draft_for_tool(tool: str, value: dict[str, Any]) -> dict[str, Any]:
    aliases = {
        "boundary": "boundaryMm",
        "boundaryPointsMm": "boundaryMm",
        "referenceLevel": "referenceLevelId",
        "level": "levelId",
        "fromLevelId": "baseLevelId",
        "toLevelId": "topLevelId",
        "hostWallId": "wallId",
    }
    draft = {aliases.get(key, key): val for key, val in value.items()}
    if tool == "author.dormer_on_roof":
        if "heightMm" in value and "wallHeightMm" not in draft:
            draft["wallHeightMm"] = value["heightMm"]
        dormer_type = str(value.get("dormerType") or "").lower()
        if "shed" in dormer_type and "dormerRoofKind" not in draft:
            draft["dormerRoofKind"] = "shed"
    position = value.get("position")
    if isinstance(position, dict) and "alongT" in position and "alongT" not in draft:
        draft["alongT"] = position["alongT"]
    if tool == "opening.door_on_wall":
        draft.setdefault("widthMm", 900)
    if tool == "opening.window_on_wall":
        draft.setdefault("widthMm", 1200)
        draft.setdefault("heightMm", 1200)
        draft.setdefault("sillHeightMm", 900)
    return draft


def _expected_readback_for_tool(
    *,
    tool: str,
    payload: dict[str, Any],
    source_value: dict[str, Any],
    fact_id: str,
) -> dict[str, Any]:
    element_kind = _expected_element_kind(tool, payload)
    element_count = _expected_element_count(tool, payload)
    geometry_fields = _expected_geometry_fields(tool, payload)
    parameter_fields = _expected_parameter_fields(tool, payload)
    host_fields = _expected_host_fields(tool, payload)
    return {
        "format": "reverseBimExpectedReadback_v1",
        "expectationId": f"readback:{fact_id}",
        "sourceFactId": fact_id,
        "mcpTool": tool,
        "querySurfaces": _query_surfaces_for_tool(tool),
        "expected": {
            "elementKind": element_kind,
            "elementCount": element_count,
            "elementId": payload.get("id") or payload.get("elementId"),
            "levelId": payload.get("levelId") or payload.get("referenceLevelId"),
            "hostIds": host_fields,
            "geometry": geometry_fields,
            "parameters": parameter_fields,
        },
        "tolerances": _readback_tolerances(tool),
        "sourceComparison": {
            "sourceValueKeys": sorted(source_value.keys()),
            "requiresOverlayCheck": tool
            in {
                "author.wall",
                "author.wall_chain",
                "author.floor_from_boundary",
                "author.room_outline",
                "author.roof_from_boundary",
                "author.dormer_on_roof",
                "opening.door_on_wall",
                "opening.window_on_wall",
                "opening.roof_opening",
                "opening.slab_opening",
                "author.stair_between_levels",
                "site.property-line-create",
                "toposolid-create",
            },
        },
        "requiredAfterCommit": [
            "created_or_modified_element_ids_present",
            "source_fact_reference_preserved",
            "query_readback_matches_expected_kind_count_and_geometry",
        ],
        "blockingFailureCodes": [
            "readback_expected_element_missing",
            "readback_kind_mismatch",
            "readback_geometry_mismatch",
            "readback_host_mismatch",
            "readback_source_fact_ref_missing",
        ],
    }


def _expected_element_kind(tool: str, payload: dict[str, Any]) -> str:
    mapping = {
        "author.level": "level",
        "author.wall": "wall",
        "author.wall_chain": "wall",
        "author.floor_from_boundary": "floor",
        "author.room_outline": "room",
        "opening.door_on_wall": "door",
        "opening.window_on_wall": "window",
        "opening.roof_opening": "roof_opening",
        "author.roof_from_boundary": "roof",
        "author.dormer_on_roof": "dormer",
        "author.stair_between_levels": "stair",
        "opening.slab_opening": "slab_opening",
        "site.property-line-create": "property_line",
        "toposolid-create": "toposolid",
    }
    return mapping.get(tool, str(payload.get("kind") or "element"))


def _expected_element_count(tool: str, payload: dict[str, Any]) -> dict[str, int]:
    if tool == "author.wall_chain":
        points = payload.get("points")
        if isinstance(points, list):
            segment_count = max(len(points) - 1, 0)
            if payload.get("closed") and len(points) > 2:
                segment_count += 1
            return {"min": segment_count, "max": segment_count}
    return {"min": 1, "max": 1}


def _expected_geometry_fields(tool: str, payload: dict[str, Any]) -> dict[str, Any]:
    fields = [
        "start",
        "end",
        "points",
        "boundaryMm",
        "boundary",
        "position",
        "positionOnRoof",
        "runStartMm",
        "runEndMm",
        "elevationPoints",
        "contours",
        "mesh",
    ]
    out = {field: payload[field] for field in fields if payload.get(field) is not None}
    if tool in {"opening.door_on_wall", "opening.window_on_wall"} and payload.get("alongT") is not None:
        out["alongT"] = payload.get("alongT")
    return out


def _expected_parameter_fields(tool: str, payload: dict[str, Any]) -> dict[str, Any]:
    fields = [
        "name",
        "elevationMm",
        "thicknessMm",
        "widthMm",
        "heightMm",
        "depthMm",
        "wallHeightMm",
        "sillHeightMm",
        "stepCount",
        "pitchDeg",
        "eaveHeightMm",
        "ridgeHeightMm",
        "roofType",
        "dormerRoofKind",
        "materialKey",
        "wallTypeId",
        "roofTypeId",
        "floorTypeId",
    ]
    return {field: payload[field] for field in fields if payload.get(field) is not None}


def _expected_host_fields(tool: str, payload: dict[str, Any]) -> dict[str, Any]:
    fields = ["wallId", "hostWallRef", "hostRoofId", "hostFloorRef", "baseLevelId", "topLevelId"]
    return {field: payload[field] for field in fields if payload.get(field) is not None}


def _query_surfaces_for_tool(tool: str) -> list[str]:
    if tool.startswith("opening."):
        return ["model.summary", "query.elements", "query.hosted_openings", "qa.physical_topology"]
    if tool in {"author.stair_between_levels", "opening.slab_opening"}:
        return ["model.summary", "query.elements", "query.vertical_circulation", "qa.physical_topology"]
    if tool in {"author.room_outline"}:
        return ["model.summary", "query.rooms", "qa.physical_topology"]
    if tool in {"site.property-line-create", "toposolid-create"}:
        return ["model.summary", "query.site", "qa.source_overlay_compare"]
    return ["model.summary", "query.elements"]


def _readback_tolerances(tool: str) -> dict[str, float]:
    tolerances = {
        "lengthMm": 25.0,
        "pointMm": 25.0,
        "areaM2": 0.25,
        "angleDeg": 0.75,
        "positionAlongT": 0.02,
    }
    if tool in {"opening.door_on_wall", "opening.window_on_wall", "opening.roof_opening"}:
        tolerances["lengthMm"] = 15.0
    if tool in {"author.room_outline"}:
        tolerances["areaM2"] = 0.15
    return tolerances


def _non_authoring_status(kind: str, value: dict[str, Any] | None = None) -> str:
    if value is not None and _is_metadata_fact(kind, value):
        return "metadata_for_authoring"
    disposition = value.get("disposition") if isinstance(value, dict) and isinstance(value.get("disposition"), dict) else {}
    if kind == "terrain" and disposition.get("decision") == "accept_context_only_no_toposolid":
        return "reference_only"
    if kind == "parcel_boundary" and disposition.get("decision") == "accept_context_only":
        return "reference_only"
    if kind == "conflict":
        if value and value.get("disposition"):
            return "metadata_for_authoring"
        return "source_conflict_disposition_required"
    if kind in {"area", "volume", "wall_thickness", "material", "construction_history"}:
        return "metadata_for_authoring"
    if kind in {"photo_observation", "drainage", "basement", "site_context"}:
        return "reference_only"
    if kind in NON_AUTHORING_SOURCE_FACT_KINDS:
        return "reference_only"
    return "missing_mcp_tool"


def _non_authoring_recommendation(kind: str, status: str) -> str:
    if kind == "area":
        return "Use as room-area reconciliation evidence after room creation."
    if kind == "volume":
        return "Use as schedule/quantity reconciliation evidence after shell creation."
    if kind == "wall_thickness":
        return "Use to select or create wall types before authoring wall chains."
    if kind == "material":
        return "Use to assign construction/material metadata after element creation."
    if kind == "construction_history":
        return "Use to populate existing-condition metadata and renovation history."
    if kind == "conflict":
        return "Resolve the source conflict before accepting affected modeling facts."
    if status == "missing_mcp_tool":
        return "Add or map a first-class MCP tool contract before this fact can be authored."
    return "Keep as provenance-backed context for validation and acceptance."


def _mcp_action_status(requirements: list[dict[str, Any]]) -> str:
    if not requirements:
        return "ready_for_mcp_authoring"
    has_resolver = any("resolver" in req for req in requirements if isinstance(req, dict))
    has_source = any("source" in req for req in requirements if isinstance(req, dict))
    if has_resolver and has_source:
        return "needs_mcp_resolver_and_source_refinement"
    if has_resolver:
        return "needs_mcp_resolver"
    return "needs_source_refinement"


def _mcp_action_recommendation(status: str, requirements: list[dict[str, Any]]) -> str:
    if status == "ready_for_mcp_authoring":
        return "Call the listed MCP tool in a dry-run transaction, then query and QA before commit."
    resolvers = [str(req.get("resolver")) for req in requirements if isinstance(req, dict) and req.get("resolver")]
    if status == "needs_mcp_resolver":
        return f"Run resolver/query tools first: {', '.join(resolvers)}."
    if status == "needs_mcp_resolver_and_source_refinement":
        return f"Run resolver/query tools and request missing source geometry: {', '.join(resolvers)}."
    return "Send a focused repair request to the AI document reader for the missing modelable fields."


def _result(
    *,
    ok: bool,
    format_name: str,
    summary: dict[str, Any],
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    payload = {"ok": ok, "format": format_name, "summary": summary, "findings": findings}
    payload["digestSha256"] = _digest(payload)
    return payload


def _severity_counts_from_payload(payload: dict[str, Any]) -> dict[str, int]:
    data = payload.get("data")
    if isinstance(data, dict):
        nested = _severity_counts_from_payload(data)
        if nested:
            return nested
    summary = payload.get("summary")
    if isinstance(summary, dict):
        counts = summary.get("severityCounts")
        if isinstance(counts, dict):
            return {str(k): int(v) for k, v in counts.items() if isinstance(v, int)}
    findings = payload.get("findings")
    if isinstance(findings, list):
        return dict(Counter(str(row.get("severity") or "warning") for row in findings if isinstance(row, dict)))
    return {}


def _has_report_payload(payload: dict[str, Any] | None) -> bool:
    if not isinstance(payload, dict) or not payload:
        return False
    if payload.get("summary") or payload.get("findings"):
        return True
    data = payload.get("data")
    return isinstance(data, dict) and bool(data.get("summary") or data.get("findings"))


def _digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
