from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel

from .types import Job, JobCacheEvidence, JobKind

HeavyDiagnosticKind = Literal[
    "geometry",
    "ifc_export",
    "gltf_export",
    "render_still",
    "render_video",
]

HEAVY_DIAGNOSTIC_JOB_KINDS: dict[HeavyDiagnosticKind, JobKind] = {
    "geometry": "csg_solve",
    "ifc_export": "ifc_export",
    "gltf_export": "gltf_export",
    "render_still": "render_still",
    "render_video": "render_video",
}

HEAVY_DIAGNOSTIC_CACHE_SCOPE = "heavy-diagnostic-evidence-v1"


def canonical_json(value: Any) -> str:
    return json.dumps(
        _canonicalize(value), sort_keys=True, separators=(",", ":"), ensure_ascii=True
    )


def stable_digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def heavy_diagnostic_cache_key(
    *,
    diagnostic_kind: HeavyDiagnosticKind,
    model_id: str,
    model_revision: int | str,
    inputs: Mapping[str, Any] | None = None,
    check_ids: Sequence[str] | None = None,
    source_digests: Mapping[str, str] | None = None,
    tool_versions: Mapping[str, str] | None = None,
) -> str:
    fields = heavy_diagnostic_cache_key_fields(
        diagnostic_kind=diagnostic_kind,
        model_id=model_id,
        model_revision=model_revision,
        inputs=inputs,
        check_ids=check_ids,
        source_digests=source_digests,
        tool_versions=tool_versions,
    )
    return f"bir-l05:{diagnostic_kind}:sha256:{stable_digest(fields)}"


def heavy_diagnostic_cache_key_fields(
    *,
    diagnostic_kind: HeavyDiagnosticKind,
    model_id: str,
    model_revision: int | str,
    inputs: Mapping[str, Any] | None = None,
    check_ids: Sequence[str] | None = None,
    source_digests: Mapping[str, str] | None = None,
    tool_versions: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    return {
        "schema": HEAVY_DIAGNOSTIC_CACHE_SCOPE,
        "diagnosticKind": diagnostic_kind,
        "jobKind": HEAVY_DIAGNOSTIC_JOB_KINDS[diagnostic_kind],
        "modelId": model_id,
        "modelRevision": str(model_revision),
        "inputs": _canonicalize(dict(inputs or {})),
        "checkIds": sorted(str(check_id) for check_id in (check_ids or ())),
        "sourceDigests": {str(k): str(v) for k, v in sorted((source_digests or {}).items())},
        "toolVersions": {str(k): str(v) for k, v in sorted((tool_versions or {}).items())},
    }


def build_heavy_diagnostic_inputs(
    *,
    diagnostic_kind: HeavyDiagnosticKind,
    model_id: str,
    model_revision: int | str,
    inputs: Mapping[str, Any] | None = None,
    check_ids: Sequence[str] | None = None,
    source_digests: Mapping[str, str] | None = None,
    tool_versions: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    base_inputs = dict(inputs or {})
    fields = heavy_diagnostic_cache_key_fields(
        diagnostic_kind=diagnostic_kind,
        model_id=model_id,
        model_revision=model_revision,
        inputs=base_inputs,
        check_ids=check_ids,
        source_digests=source_digests,
        tool_versions=tool_versions,
    )
    base_inputs["heavyDiagnosticMetadata_v1"] = {
        "cacheKey": f"bir-l05:{diagnostic_kind}:sha256:{stable_digest(fields)}",
        "cacheKeyFieldsDigest": stable_digest(fields),
        "cacheScope": HEAVY_DIAGNOSTIC_CACHE_SCOPE,
        "diagnosticKind": diagnostic_kind,
        "jobKind": HEAVY_DIAGNOSTIC_JOB_KINDS[diagnostic_kind],
        "modelId": model_id,
        "modelRevision": str(model_revision),
        "checkIds": fields["checkIds"],
        "sourceDigests": fields["sourceDigests"],
        "toolVersions": fields["toolVersions"],
    }
    return base_inputs


def build_heavy_diagnostic_job(
    *,
    diagnostic_kind: HeavyDiagnosticKind,
    model_id: str,
    model_revision: int | str,
    inputs: Mapping[str, Any] | None = None,
    check_ids: Sequence[str] | None = None,
    source_digests: Mapping[str, str] | None = None,
    tool_versions: Mapping[str, str] | None = None,
    created_at: str | None = None,
) -> Job:
    job_inputs = build_heavy_diagnostic_inputs(
        diagnostic_kind=diagnostic_kind,
        model_id=model_id,
        model_revision=model_revision,
        inputs=inputs,
        check_ids=check_ids,
        source_digests=source_digests,
        tool_versions=tool_versions,
    )
    metadata = job_inputs["heavyDiagnosticMetadata_v1"]
    return Job(
        model_id=model_id,
        kind=HEAVY_DIAGNOSTIC_JOB_KINDS[diagnostic_kind],
        inputs=job_inputs,
        created_at=created_at or datetime.now(UTC).isoformat(),
        cache_evidence=JobCacheEvidence(
            cache_key=metadata["cacheKey"],
            cache_scope=metadata["cacheScope"],
            source_digests=metadata["sourceDigests"],
        ),
    )


def build_heavy_diagnostic_job_evidence(
    job: Job,
    *,
    evidence_refs: Sequence[str] | None = None,
    evidence_digest: str | None = None,
) -> dict[str, Any]:
    refs = sorted(str(ref) for ref in (evidence_refs or ()))
    cache = job.cache_evidence
    return {
        "heavyDiagnosticJobEvidence_v1": {
            "jobId": job.id,
            "modelId": job.model_id,
            "kind": job.kind,
            "status": job.status,
            "progress": job.progress.model_dump(by_alias=True) if job.progress else None,
            "cancellation": job.cancellation.model_dump(by_alias=True),
            "cache": cache.model_dump(by_alias=True) if cache else None,
            "evidenceRefs": refs,
            "evidenceDigest": evidence_digest or stable_digest({"job": job, "evidenceRefs": refs}),
        }
    }


def _canonicalize(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return _canonicalize(value.model_dump(by_alias=True, exclude_none=True))
    if isinstance(value, Mapping):
        return {
            str(k): _canonicalize(v)
            for k, v in sorted(value.items(), key=lambda item: str(item[0]))
        }
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    if isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
        return [_canonicalize(v) for v in value]
    return str(value)
