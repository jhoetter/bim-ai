"""M3-F sketch-to-BIM product tool contracts."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status

sketch_product_router = APIRouter(prefix="/v3/sketch")

_QUALITY_TARGETS = {
    "massing_only",
    "concept_bim",
    "project_initiation_bim",
    "documentation_ready",
}
_PRIORITIES = {"critical", "high", "medium", "low"}


def _object_body(body: dict[str, Any], key: str) -> dict[str, Any]:
    value = body.get(key)
    if not isinstance(value, dict):
        raise HTTPException(status_code=422, detail=f"{key} must be an object")
    return value


def _string_body(body: dict[str, Any], key: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=422, detail=f"{key} must be a non-empty string")
    return value


def _issue(severity: str, code: str, path: str, message: str) -> dict[str, str]:
    return {"severity": severity, "code": code, "path": path, "message": message}


def _require_string(issues: list[dict[str, str]], obj: dict[str, Any], key: str, path: str) -> None:
    if not isinstance(obj.get(key), str) or not obj[key].strip():
        issues.append(_issue("error", "missing_string", f"{path}.{key}", f"{key} is required."))


def _validate_ir(ir: dict[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    if ir.get("schemaVersion") != "sketch-understanding-ir.v0":
        issues.append(
            _issue(
                "error",
                "schema_version",
                "$.schemaVersion",
                "Expected sketch-understanding-ir.v0.",
            )
        )
    _require_string(issues, ir, "projectType", "$")
    _require_string(issues, ir, "qualityTarget", "$")
    if isinstance(ir.get("qualityTarget"), str) and ir["qualityTarget"] not in _QUALITY_TARGETS:
        issues.append(
            _issue(
                "error",
                "invalid_quality_target",
                "$.qualityTarget",
                f"qualityTarget must be one of {', '.join(sorted(_QUALITY_TARGETS))}.",
            )
        )
    features = ir.get("features")
    if not isinstance(features, list) or not features:
        issues.append(_issue("error", "missing_array", "$.features", "features is required."))
    else:
        for index, feature in enumerate(features):
            path = f"$.features[{index}]"
            if not isinstance(feature, dict):
                issues.append(
                    _issue("error", "invalid_feature", path, "Feature must be an object.")
                )
                continue
            _require_string(issues, feature, "id", path)
            _require_string(issues, feature, "kind", path)
            if feature.get("visualPriority") not in _PRIORITIES:
                issues.append(
                    _issue(
                        "error",
                        "invalid_priority",
                        f"{path}.visualPriority",
                        "visualPriority must be critical, high, medium, or low.",
                    )
                )
            if (
                not isinstance(feature.get("mustRenderInViews"), list)
                or not feature["mustRenderInViews"]
            ):
                issues.append(
                    _issue(
                        "error",
                        "missing_array",
                        f"{path}.mustRenderInViews",
                        "mustRenderInViews is required.",
                    )
                )
    required_views = ir.get("requiredViews")
    if not isinstance(required_views, list) or not required_views:
        issues.append(
            _issue("error", "missing_array", "$.requiredViews", "requiredViews is required.")
        )
    source_inputs = ir.get("sourceInputs")
    if not isinstance(source_inputs, dict) or not isinstance(source_inputs.get("images"), list):
        issues.append(
            _issue(
                "error",
                "missing_array",
                "$.sourceInputs.images",
                "sourceInputs.images is required.",
            )
        )
    return issues


@sketch_product_router.post("/ir/validate")
async def sketch_ir_validate(body: dict[str, Any]) -> dict[str, Any]:
    issues = _validate_ir(_object_body(body, "ir"))
    matrix = body.get("capabilityMatrix")
    if matrix is not None and matrix.get("schemaVersion") != "sketch-to-bim-capability-matrix.v0":
        issues.append(
            _issue(
                "error",
                "capability_schema_version",
                "$.capabilityMatrix.schemaVersion",
                "Expected sketch-to-bim-capability-matrix.v0.",
            )
        )
    return {
        "schemaVersion": "sketch.ir.validate.result.v0",
        "ok": not any(issue["severity"] == "error" for issue in issues),
        "summary": {
            "errorCount": sum(1 for issue in issues if issue["severity"] == "error"),
            "warningCount": sum(1 for issue in issues if issue["severity"] == "warning"),
        },
        "issues": issues,
        "cliEquivalent": "bim-ai sketch ir validate --ir sketch-ir.json --capabilities spec/sketch-to-bim-capability-matrix.json --out packet",
    }


@sketch_product_router.post("/seed/compile")
async def sketch_seed_compile(body: dict[str, Any]) -> dict[str, Any]:
    recipe = _object_body(body, "recipe")
    if recipe.get("schemaVersion") != "seed-dsl.v0":
        raise HTTPException(status_code=422, detail="recipe.schemaVersion must be seed-dsl.v0")
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "backend_seed_compiler_blocked",
            "message": (
                "Seed DSL compilation is implemented in the product CLI; the Python API "
                "contract is reserved but does not yet host the compiler."
            ),
            "cliEquivalent": "bim-ai sketch seed compile --recipe seed.json --out bundle.json",
            "outputSchema": "cmd-v3.0 CommandBundle",
        },
    )


@sketch_product_router.post("/phase/apply")
async def sketch_phase_apply(body: dict[str, Any]) -> dict[str, Any]:
    model_id = _string_body(body, "modelId")
    phase_id = _string_body(body, "phaseId")
    bundle = _object_body(body, "bundle")
    mode = body.get("mode", "dry_run")
    if mode not in {"dry_run", "commit"}:
        raise HTTPException(status_code=422, detail="mode must be dry_run or commit")
    if bundle.get("schemaVersion") not in {None, "cmd-v3.0"}:
        raise HTTPException(status_code=422, detail="bundle.schemaVersion must be cmd-v3.0")
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "backend_phase_apply_wrapper_blocked",
            "message": (
                "Sketch phase apply must delegate to the existing bundle transaction route. "
                "Use the CLI wrapper or POST the returned bundle shape to /api/models/{model_id}/bundles."
            ),
            "bundleRequest": {
                "modelId": model_id,
                "phaseId": phase_id,
                "featureIds": body.get("featureIds", []),
                "mode": mode,
                "userId": body.get("userId"),
                "bundle": {**bundle, "parentRevision": body.get("parentRevision")},
            },
            "cliEquivalent": "bim-ai sketch phase apply --model MODEL --bundle phase.json --base REV --dry-run",
        },
    )


@sketch_product_router.post("/phase/accept")
async def sketch_phase_accept(body: dict[str, Any]) -> dict[str, Any]:
    phase_id = _string_body(body, "phaseId")
    packet = _object_body(body, "packet")
    require_current_head = body.get("requireCurrentHead", True)
    blockers: list[dict[str, Any]] = []
    coverage = packet.get("coverage") or packet.get("capabilityCoverage")
    acceptance = packet.get("acceptanceGates") or packet.get("acceptance")
    evidence_head = packet.get("evidenceHead")
    current_head = packet.get("currentHead")

    if not isinstance(coverage, dict):
        blockers.append({"code": "coverage_missing", "message": "Capability coverage is required."})
    elif coverage.get("summary", {}).get("errorCount", 0) > 0:
        blockers.append(
            {
                "code": "coverage_errors",
                "message": f"{coverage['summary']['errorCount']} coverage error(s) remain.",
            }
        )

    if not isinstance(acceptance, dict):
        blockers.append(
            {"code": "acceptance_gates_missing", "message": "acceptance-gates.json is required."}
        )
    elif acceptance.get("ok") is False:
        blockers.extend(acceptance.get("blockers") or [{"code": "acceptance_blocked"}])

    if require_current_head and evidence_head is not None and current_head is not None:
        if evidence_head != current_head:
            blockers.append(
                {
                    "code": "stale_evidence_head",
                    "message": "Evidence was not captured from the current model head.",
                    "evidenceHead": evidence_head,
                    "currentHead": current_head,
                }
            )
    elif require_current_head:
        blockers.append(
            {
                "code": "current_head_unverified",
                "message": "Provide evidenceHead and currentHead to prove non-stale acceptance.",
            }
        )

    return {
        "schemaVersion": "sketch.phase.accept.result.v0",
        "generatedAt": datetime.now(UTC).isoformat(),
        "phaseId": phase_id,
        "ok": not blockers,
        "summary": {"blockerCount": len(blockers)},
        "blockers": blockers,
        "cliEquivalent": "bim-ai sketch phase accept --ir sketch-ir.json --capabilities spec/sketch-to-bim-capability-matrix.json --out packet --fail-on-acceptance",
    }
