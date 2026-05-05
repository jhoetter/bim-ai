"""Tests for agent evidence loop closure — manifest ingestion, diff metadata, regen guidance (prompt-6)."""

from __future__ import annotations

from bim_ai.agent_brief_acceptance_readout import agent_regeneration_guidance_v1
from bim_ai.agent_evidence_review_loop import (
    compute_evidence_diff_metadata_v1,
    ingest_evidence_artifact_manifest_v1,
)
from bim_ai.document import Document
from bim_ai.elements import SheetElem


def _doc_with_sheet() -> Document:
    return Document(
        revision=1,
        elements={"s1": SheetElem(kind="sheet", id="s1", name="Sheet A")},
    )


def _manifest(digest: str, keys: list[str]) -> dict:
    return {
        "format": "artifactManifest_v1",
        "packageDigestSha256": digest,
        "entries": [{"artifactKey": k, "digest": digest} for k in keys],
    }


def test_ingest_manifest_all_fresh() -> None:
    doc = _doc_with_sheet()
    digest = "a" * 64
    manifest = _manifest(digest, ["sheet-s1"])
    result = ingest_evidence_artifact_manifest_v1(doc, manifest, current_package_digest=digest)
    assert result["format"] == "ingestEvidenceArtifactManifest_v1"
    assert result["freshCount"] == 1
    assert result["staleCount"] == 0
    assert result["missingCount"] == 0
    assert result["fresh"][0]["artifactKey"] == "sheet-s1"


def test_ingest_manifest_stale_after_doc_change() -> None:
    doc = _doc_with_sheet()
    old_digest = "a" * 64
    new_digest = "b" * 64
    manifest = _manifest(old_digest, ["sheet-s1"])
    result = ingest_evidence_artifact_manifest_v1(doc, manifest, current_package_digest=new_digest)
    assert result["freshCount"] == 0
    assert result["staleCount"] == 1
    stale_entry = result["stale"][0]
    assert stale_entry["artifactKey"] == "sheet-s1"
    assert stale_entry["stalenessReason"] == "package_digest_changed"
    assert stale_entry["currentPackageDigest"] == new_digest
    assert stale_entry["manifestPackageDigest"] == old_digest


def test_ingest_manifest_detects_missing_entries() -> None:
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(kind="sheet", id="s1", name="Sheet A"),
            "s2": SheetElem(kind="sheet", id="s2", name="Sheet B"),
        },
    )
    digest = "c" * 64
    manifest = _manifest(digest, ["sheet-s1"])
    result = ingest_evidence_artifact_manifest_v1(doc, manifest, current_package_digest=digest)
    assert result["freshCount"] == 1
    assert result["missingCount"] == 1
    assert result["missing"][0]["artifactKey"] == "sheet-s2"
    assert result["missing"][0]["elementKind"] == "sheet"


def test_compute_diff_added_removed_changed() -> None:
    doc = Document(revision=1, elements={})
    prev = {
        "entries": [
            {"artifactKey": "sheet-a", "digest": "aaa"},
            {"artifactKey": "sheet-b", "digest": "bbb"},
        ]
    }
    curr = {
        "entries": [
            {"artifactKey": "sheet-b", "digest": "bbb"},
            {"artifactKey": "sheet-b2", "digest": "bbb2_modified"},
            {"artifactKey": "sheet-c", "digest": "ccc"},
        ]
    }
    result = compute_evidence_diff_metadata_v1(doc, prev, curr)
    assert result["format"] == "evidenceDiffMetadata_v1"
    added_keys = [e["artifactKey"] for e in result["added"]]
    removed_keys = [e["artifactKey"] for e in result["removed"]]
    assert "sheet-c" in added_keys
    assert "sheet-b2" in added_keys
    assert "sheet-a" in removed_keys
    assert len(result["changed"]) == 0


def test_compute_diff_detects_changed_digest() -> None:
    doc = Document(revision=1, elements={})
    prev = {"entries": [{"artifactKey": "sheet-x", "digest": "old_digest_value"}]}
    curr = {"entries": [{"artifactKey": "sheet-x", "digest": "new_digest_value"}]}
    result = compute_evidence_diff_metadata_v1(doc, prev, curr)
    assert len(result["changed"]) == 1
    ch = result["changed"][0]
    assert ch["artifactKey"] == "sheet-x"
    assert ch["oldDigest"] == "old_digest_value"
    assert ch["newDigest"] == "new_digest_value"
    assert "→" in ch["deltaSummary"]


def test_regeneration_guidance_priority_ordering() -> None:
    doc = Document(revision=1, elements={})
    stale_artifacts = [
        {"artifactKey": "sheet-s1", "stalenessReason": "package_digest_changed"},
        {"artifactKey": "viewpoint-v1", "stalenessReason": "entry_digest_missing"},
        {"artifactKey": "sheet-s2", "stalenessReason": "package_digest_changed"},
    ]
    diff_summary: dict = {"changed": [{"artifactKey": "sheet-s2"}]}
    result = agent_regeneration_guidance_v1(doc, stale_artifacts, diff_summary)
    assert result["format"] == "agentRegenerationGuidance_v1"
    assert result["actionCount"] == 3
    actions = result["actions"]
    priorities = [a["priority"] for a in actions]
    assert priorities[0] == "high"
    assert priorities[1] == "medium"
    assert priorities[2] == "low"
    for a in actions:
        assert "artifactKey" in a
        assert "reason" in a
        assert "suggestedCommand" in a
        assert a["priority"] in {"high", "medium", "low"}


def test_regeneration_guidance_command_varies_by_artifact_kind() -> None:
    doc = Document(revision=1, elements={})
    stale_artifacts = [
        {"artifactKey": "sheet-s1", "stalenessReason": "package_digest_changed"},
        {"artifactKey": "viewpoint-v1", "stalenessReason": "entry_digest_missing"},
        {"artifactKey": "plan_view-pv1", "stalenessReason": "package_digest_changed"},
        {"artifactKey": "section_cut-sc1", "stalenessReason": "package_digest_changed"},
    ]
    result = agent_regeneration_guidance_v1(doc, stale_artifacts, {})
    cmds = {a["artifactKey"]: a["suggestedCommand"] for a in result["actions"]}
    assert "pytest" in cmds["sheet-s1"]
    assert "playwright" in cmds["viewpoint-v1"]
    assert "evidence" in cmds["plan_view-pv1"]
    assert "section" in cmds["section_cut-sc1"]


def test_compute_diff_includes_evidence_diff_summary_v1() -> None:
    doc = Document(revision=1, elements={})
    prev = {"entries": [{"artifactKey": "k1", "digest": "old_value"}]}
    curr = {
        "entries": [
            {"artifactKey": "k1", "digest": "new_value"},
            {"artifactKey": "k2", "digest": "d2_value"},
        ]
    }
    result = compute_evidence_diff_metadata_v1(doc, prev, curr)
    assert "evidenceDiffSummary_v1" in result
    summary = result["evidenceDiffSummary_v1"]
    assert summary["format"] == "evidenceDiffSummary_v1"
    assert summary["addedCount"] == 1
    assert summary["changedCount"] == 1
    assert summary["removedCount"] == 0
    assert isinstance(summary["top5LargestDeltas"], list)
    assert len(summary["top5LargestDeltas"]) == 1
    assert summary["top5LargestDeltas"][0]["artifactKey"] == "k1"
