"""Deterministic replay-stability harness for evidence manifest emitters (WP-A02/A03/X01)."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from typing import Any, NamedTuple
from uuid import UUID

from bim_ai.document import Document
from bim_ai.evidence_manifest import (
    agent_evidence_closure_hints,
    collaboration_replay_conflict_hints_v1,
    deterministic_3d_view_evidence_manifest,
    deterministic_plan_view_evidence_manifest,
    deterministic_section_cut_evidence_manifest,
    deterministic_sheet_evidence_manifest,
    digest_exclusion_rules_v1,
    pixel_diff_expectation_placeholder_v1,
    plan_view_wire_index,
    sheetProductionEvidenceBaseline_v1,
)

_FIXED_MODEL_ID = UUID("00000000-0000-4000-8000-000000000001")
_FIXED_DIGEST = "a" * 64
_FIXED_PREFIX = "a" * 16
_FIXED_BASENAME = "test-evidence-replay-harness-v1"


class EmitterRef(NamedTuple):
    manifest_key: str
    fn: Callable[[Document], Any]


def enumerate_evidence_emitters_v1() -> list[EmitterRef]:
    """Deterministic alphabetized list of (manifestKey, callable) pairs for evidence manifest emitters.

    Discovers emitters from the aggregation surface of evidence_manifest.py only.
    Returns a new list each call; safe to modify copies without polluting the registry.
    """

    def _det_sheet(doc: Document) -> Any:
        return deterministic_sheet_evidence_manifest(
            model_id=_FIXED_MODEL_ID,
            doc=doc,
            evidence_artifact_basename=_FIXED_BASENAME,
            semantic_digest_sha256=_FIXED_DIGEST,
            semantic_digest_prefix16=_FIXED_PREFIX,
        )

    def _det_3d(doc: Document) -> Any:
        return deterministic_3d_view_evidence_manifest(
            model_id=_FIXED_MODEL_ID,
            doc=doc,
            evidence_artifact_basename=_FIXED_BASENAME,
            semantic_digest_sha256=_FIXED_DIGEST,
            semantic_digest_prefix16=_FIXED_PREFIX,
        )

    def _det_plan(doc: Document) -> Any:
        return deterministic_plan_view_evidence_manifest(
            model_id=_FIXED_MODEL_ID,
            doc=doc,
            evidence_artifact_basename=_FIXED_BASENAME,
            semantic_digest_sha256=_FIXED_DIGEST,
            semantic_digest_prefix16=_FIXED_PREFIX,
        )

    def _det_section(doc: Document) -> Any:
        return deterministic_section_cut_evidence_manifest(
            model_id=_FIXED_MODEL_ID,
            doc=doc,
            evidence_artifact_basename=_FIXED_BASENAME,
            semantic_digest_sha256=_FIXED_DIGEST,
            semantic_digest_prefix16=_FIXED_PREFIX,
        )

    emitters: list[EmitterRef] = [
        EmitterRef("agentEvidenceClosureHints", lambda doc: agent_evidence_closure_hints()),
        EmitterRef(
            "collaborationReplayConflictHints_v1",
            lambda doc: collaboration_replay_conflict_hints_v1(),
        ),
        EmitterRef("deterministicSheetEvidence", _det_sheet),
        EmitterRef("deterministic3dViewEvidence", _det_3d),
        EmitterRef("deterministicPlanViewEvidence", _det_plan),
        EmitterRef("deterministicSectionCutEvidence", _det_section),
        EmitterRef("digestExclusionRules_v1", lambda doc: digest_exclusion_rules_v1()),
        EmitterRef(
            "pixelDiffExpectationPlaceholder_v1",
            lambda doc: pixel_diff_expectation_placeholder_v1(),
        ),
        EmitterRef("planViewWireIndex", plan_view_wire_index),
        EmitterRef("sheetProductionBaseline_v1", sheetProductionEvidenceBaseline_v1),
    ]
    return sorted(emitters, key=lambda e: e.manifest_key)


def run_replay_stability_pass_v1(
    doc: Document,
    emitters: list[EmitterRef] | None = None,
) -> dict[str, Any]:
    """Run each emitter twice on doc and compare byte-identical JSON digests.

    Returns per-emitter {stable, digest} rows plus an aggregate replayStabilityHarness_v1 token.
    Pass a custom emitters list to inject stubs without mutating the real registry.
    """
    registry = emitters if emitters is not None else enumerate_evidence_emitters_v1()

    per_emitter: dict[str, Any] = {}
    unstable: list[str] = []

    for ref in registry:
        out1 = ref.fn(doc)
        out2 = ref.fn(doc)
        json1 = json.dumps(out1, sort_keys=True, separators=(",", ":"), default=str)
        json2 = json.dumps(out2, sort_keys=True, separators=(",", ":"), default=str)
        digest1 = hashlib.sha256(json1.encode("utf-8")).hexdigest()
        digest2 = hashlib.sha256(json2.encode("utf-8")).hexdigest()
        stable = digest1 == digest2
        if not stable:
            unstable.append(ref.manifest_key)
        per_emitter[ref.manifest_key] = {"stable": stable, "digest": digest1}

    aggregate_payload = json.dumps(
        sorted(per_emitter.items()),
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    aggregate_digest = hashlib.sha256(aggregate_payload.encode("utf-8")).hexdigest()

    return {
        "emitters": per_emitter,
        "replayStabilityHarness_v1": {
            "schemaVersion": "1",
            "emitterCount": len(registry),
            "unstableEmitters": sorted(unstable),
            "digest": aggregate_digest,
        },
    }
