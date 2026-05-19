from __future__ import annotations

from bim_ai.jobs.heavy_diagnostics import (
    HEAVY_DIAGNOSTIC_CACHE_SCOPE,
    build_heavy_diagnostic_inputs,
    build_heavy_diagnostic_job,
    build_heavy_diagnostic_job_evidence,
    heavy_diagnostic_cache_key,
)
from bim_ai.jobs.types import JobProgress


def test_heavy_diagnostic_cache_key_is_stable_for_mapping_order() -> None:
    first = heavy_diagnostic_cache_key(
        diagnostic_kind="ifc_export",
        model_id="model-a",
        model_revision=12,
        inputs={"view": "3d", "options": {"b": 2, "a": 1}},
        check_ids=["geometry-readback", "manifest"],
        source_digests={"doc": "sha256:doc", "types": "sha256:types"},
        tool_versions={"ifc": "0.8.1", "kernel": "2026.05"},
    )
    second = heavy_diagnostic_cache_key(
        diagnostic_kind="ifc_export",
        model_id="model-a",
        model_revision="12",
        inputs={"options": {"a": 1, "b": 2}, "view": "3d"},
        check_ids=["manifest", "geometry-readback"],
        source_digests={"types": "sha256:types", "doc": "sha256:doc"},
        tool_versions={"kernel": "2026.05", "ifc": "0.8.1"},
    )

    assert first == second
    assert first.startswith("bir-l05:ifc_export:sha256:")


def test_build_heavy_diagnostic_inputs_embeds_cache_key_evidence_fields() -> None:
    inputs = build_heavy_diagnostic_inputs(
        diagnostic_kind="render_still",
        model_id="model-r",
        model_revision=3,
        inputs={"cameraId": "saved-main"},
        check_ids=["nonblank", "framing", "unsupported-render-features"],
    )

    metadata = inputs["heavyDiagnosticMetadata_v1"]
    assert inputs["cameraId"] == "saved-main"
    assert metadata["cacheScope"] == HEAVY_DIAGNOSTIC_CACHE_SCOPE
    assert metadata["jobKind"] == "render_still"
    assert metadata["modelRevision"] == "3"
    assert metadata["checkIds"] == ["framing", "nonblank", "unsupported-render-features"]
    assert metadata["cacheKey"].startswith("bir-l05:render_still:sha256:")


def test_build_heavy_diagnostic_job_sets_kind_inputs_and_cache_evidence() -> None:
    job = build_heavy_diagnostic_job(
        diagnostic_kind="geometry",
        model_id="model-g",
        model_revision=9,
        inputs={"changedIds": ["wall-1"]},
        check_ids=["detached-geometry", "opening-voids"],
        created_at="2026-05-19T10:00:00+00:00",
    )

    assert job.kind == "csg_solve"
    assert job.created_at == "2026-05-19T10:00:00+00:00"
    assert job.cache_evidence is not None
    assert job.cache_evidence.cache_scope == HEAVY_DIAGNOSTIC_CACHE_SCOPE
    assert job.cache_evidence.cache_key == job.inputs["heavyDiagnosticMetadata_v1"]["cacheKey"]


def test_build_heavy_diagnostic_job_evidence_includes_progress_cancellation_and_cache() -> None:
    job = build_heavy_diagnostic_job(
        diagnostic_kind="gltf_export",
        model_id="model-x",
        model_revision=4,
        created_at="2026-05-19T10:00:00+00:00",
    )
    job = job.model_copy(
        update={
            "status": "running",
            "progress": JobProgress(current=2, total=4, percent=50.0, phase="export_mesh"),
        }
    )

    evidence = build_heavy_diagnostic_job_evidence(
        job,
        evidence_refs=["gltf-manifest.json", "geometry-readback.json"],
        evidence_digest="sha256:evidence",
    )["heavyDiagnosticJobEvidence_v1"]

    assert evidence["jobId"] == job.id
    assert evidence["status"] == "running"
    assert evidence["progress"]["percent"] == 50.0
    assert evidence["cancellation"]["cancellable"] is True
    assert evidence["cache"]["cacheKey"].startswith("bir-l05:gltf_export:sha256:")
    assert evidence["evidenceRefs"] == ["geometry-readback.json", "gltf-manifest.json"]
    assert evidence["evidenceDigest"] == "sha256:evidence"
