"""BCF/issue package deterministic export (nested under ``evidenceAgentFollowThrough_v1``)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

_ISSUE_PKG_ANCHOR_SUMMARY_LIMIT = 32


def _sort_evidence_ref_dicts(refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        refs,
        key=lambda r: (
            str(r.get("kind") or ""),
            str(r.get("sheetId") or ""),
            str(r.get("viewpointId") or ""),
            str(r.get("planViewId") or ""),
            str(r.get("sectionCutId") or ""),
            str(r.get("pngBasename") or ""),
        ),
    )


def _evidence_ref_fingerprint_for_match(
    topic_kind: str, topic_id: str, er: dict[str, Any]
) -> tuple[str, ...]:
    return (
        topic_kind,
        topic_id,
        str(er.get("kind") or ""),
        str(er.get("sheetId") or ""),
        str(er.get("viewpointId") or ""),
        str(er.get("planViewId") or ""),
        str(er.get("sectionCutId") or ""),
        str(er.get("pngBasename") or ""),
    )


def _correlation_key_for_anchor_er(
    er: dict[str, Any],
    *,
    sheet_by_id: dict[str, dict[str, Any]],
    vp_by_id: dict[str, dict[str, Any]],
    plan_by_id: dict[str, dict[str, Any]],
    sec_by_id: dict[str, dict[str, Any]],
) -> tuple[str, str] | None:
    kind = er.get("kind")
    if kind == "sheet":
        sid = er.get("sheetId")
        if isinstance(sid, str) and sid in sheet_by_id:
            return ("sheet", sid)
        return None
    if kind == "viewpoint":
        vid = er.get("viewpointId")
        if isinstance(vid, str) and vid in vp_by_id:
            return ("viewpoint", vid)
        return None
    if kind == "plan_view":
        pid = er.get("planViewId")
        if isinstance(pid, str) and pid in plan_by_id:
            return ("plan_view", pid)
        return None
    if kind == "section_cut":
        cid = er.get("sectionCutId")
        if isinstance(cid, str) and cid in sec_by_id:
            return ("section_cut", cid)
        return None
    if kind == "deterministic_png":
        return None
    if kind == "bcf_viewpoint_ref":
        vid = er.get("viewpointId")
        if isinstance(vid, str) and vid in vp_by_id:
            return ("viewpoint", vid)
        return None
    if kind == "bcf_plan_view":
        pid = er.get("planViewId")
        if isinstance(pid, str) and pid in plan_by_id:
            return ("plan_view", pid)
        return None
    if kind == "bcf_section_cut":
        cid = er.get("sectionCutId")
        if isinstance(cid, str) and cid in sec_by_id:
            return ("section_cut", cid)
        return None
    if kind == "issue_viewpoint":
        vid = er.get("viewpointId")
        if isinstance(vid, str) and vid in vp_by_id:
            return ("viewpoint", vid)
        return None
    return None


def _classify_bcf_anchor(
    er: dict[str, Any],
    *,
    topic_kind: str,
    topic_id: str,
    stable_topic_id: str,
    anchor_kind: str,
    unresolved_fps: set[tuple[str, ...]],
    stale_pairs: set[tuple[str, str]],
    missing_pairs: set[tuple[str, str]],
    sheet_by_id: dict[str, dict[str, Any]],
    vp_by_id: dict[str, dict[str, Any]],
    plan_by_id: dict[str, dict[str, Any]],
    sec_by_id: dict[str, dict[str, Any]],
) -> tuple[str, dict[str, Any], str]:
    fp_t = _evidence_ref_fingerprint_for_match(topic_kind, topic_id, er)
    ckey = _correlation_key_for_anchor_er(
        er,
        sheet_by_id=sheet_by_id,
        vp_by_id=vp_by_id,
        plan_by_id=plan_by_id,
        sec_by_id=sec_by_id,
    )
    png = er.get("pngBasename")
    png_ok = isinstance(png, str) and bool(png.strip())

    if fp_t in unresolved_fps:
        state = "unresolved_absent_evidence"
        row = {
            "anchorKind": anchor_kind,
            "resolutionState": state,
            "correlationRowKind": None,
            "correlationRowId": None,
        }
        mprint = "|".join((stable_topic_id, anchor_kind, state, "", "", ":".join(fp_t)))
        return state, row, mprint

    if er.get("kind") == "deterministic_png" and png_ok:
        state = "resolved_correlation_ok"
        row = {
            "anchorKind": anchor_kind,
            "resolutionState": state,
            "correlationRowKind": None,
            "correlationRowId": None,
        }
        mprint = "|".join((stable_topic_id, anchor_kind, state, "", "", ":".join(fp_t)))
        return state, row, mprint

    if ckey is None:
        state = "unresolved_absent_evidence"
        row = {
            "anchorKind": anchor_kind,
            "resolutionState": state,
            "correlationRowKind": None,
            "correlationRowId": None,
        }
        mprint = "|".join((stable_topic_id, anchor_kind, state, "", "", ":".join(fp_t)))
        return state, row, mprint

    corr_k, corr_i = ckey
    if ckey in stale_pairs:
        state = "stale_correlation_digest"
    elif ckey in missing_pairs:
        state = "missing_correlation_digest"
    else:
        state = "resolved_correlation_ok"

    row = {
        "anchorKind": anchor_kind,
        "resolutionState": state,
        "correlationRowKind": corr_k,
        "correlationRowId": corr_i,
    }
    mprint = "|".join(
        (stable_topic_id, anchor_kind, state, str(corr_k or ""), str(corr_i or ""), ":".join(fp_t)),
    )
    return state, row, mprint


def bcf_issue_package_export_v1(
    *,
    bcf_topics_index: dict[str, Any],
    violations: list[dict[str, Any]] | None,
    evidence_ref_resolution: dict[str, Any],
    staged_artifact_links_v1_payload: dict[str, Any],
    evidence_closure_review: dict[str, Any] | None,
    evidence_diff_ingest_fix_loop: dict[str, Any] | None,
    deterministic_sheet_evidence: list[dict[str, Any]],
    deterministic_3d_view_evidence: list[dict[str, Any]],
    deterministic_plan_view_evidence: list[dict[str, Any]],
    deterministic_section_cut_evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    """Deterministic BCF/issue package readout: topics, anchors, closure correlation, remediation hints."""

    sheet_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_sheet_evidence:
        if isinstance(row, dict):
            sid = str(row.get("sheetId") or "")
            if sid:
                sheet_by_id[sid] = row

    vp_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_3d_view_evidence:
        if isinstance(row, dict):
            vid = str(row.get("viewpointId") or "")
            if vid:
                vp_by_id[vid] = row

    plan_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_plan_view_evidence:
        if isinstance(row, dict):
            pid = str(row.get("planViewId") or "")
            if pid:
                plan_by_id[pid] = row

    sec_by_id: dict[str, dict[str, Any]] = {}
    for row in deterministic_section_cut_evidence:
        if isinstance(row, dict):
            cid = str(row.get("sectionCutId") or "")
            if cid:
                sec_by_id[cid] = row

    stale_pairs: set[tuple[str, str]] = set()
    missing_pairs: set[tuple[str, str]] = set()
    if isinstance(evidence_closure_review, dict):
        cons = evidence_closure_review.get("correlationDigestConsistency")
        if isinstance(cons, dict):
            for r in cons.get("staleRowsRelativeToPackageDigest") or []:
                if isinstance(r, dict):
                    k = str(r.get("kind") or "")
                    i = str(r.get("id") or "")
                    if k and i:
                        stale_pairs.add((k, i))
            for r in cons.get("rowsMissingCorrelationDigest") or []:
                if isinstance(r, dict):
                    k = str(r.get("kind") or "")
                    i = str(r.get("id") or "")
                    if k and i:
                        missing_pairs.add((k, i))

    unresolved_fps: set[tuple[str, ...]] = set()
    raw_unresolved = evidence_ref_resolution.get("unresolvedEvidenceRefs")
    if isinstance(raw_unresolved, list):
        for urow in raw_unresolved:
            if not isinstance(urow, dict):
                continue
            tk_u = str(urow.get("topicKind") or "")
            tid_u = str(urow.get("topicId") or "")
            er_raw = urow.get("evidenceRef")
            er_u = er_raw if isinstance(er_raw, dict) else {}
            unresolved_fps.add(_evidence_ref_fingerprint_for_match(tk_u, tid_u, er_u))

    viol_rows: list[tuple[str, frozenset[str]]] = []
    for v in violations or []:
        if not isinstance(v, dict):
            continue
        rid = str(v.get("ruleId") or "").strip()
        if not rid:
            continue
        raw_eids = v.get("elementIds")
        src = raw_eids if isinstance(raw_eids, list) else []
        eid_set = frozenset(str(x) for x in src if x is not None)
        viol_rows.append((rid, eid_set))

    topics_raw = bcf_topics_index.get("topics") if isinstance(bcf_topics_index, dict) else None
    topic_list_raw = topics_raw if isinstance(topics_raw, list) else []
    topic_dicts = [x for x in topic_list_raw if isinstance(x, dict)]
    topic_dicts.sort(key=lambda x: (str(x.get("topicKind") or ""), str(x.get("topicId") or "")))

    topic_rows_out: list[dict[str, Any]] = []
    unresolved_summary: list[dict[str, Any]] = []
    stale_summary: list[dict[str, Any]] = []
    missing_summary: list[dict[str, Any]] = []

    counters = {
        "resolved_anchor": 0,
        "unresolved_anchor": 0,
        "stale_anchor": 0,
        "missing_correlation_anchor": 0,
    }
    manifest_anchor_prints: list[str] = []

    def bump_anchor(state: str) -> None:
        if state == "resolved_correlation_ok":
            counters["resolved_anchor"] += 1
        elif state == "unresolved_absent_evidence":
            counters["unresolved_anchor"] += 1
        elif state == "stale_correlation_digest":
            counters["stale_anchor"] += 1
        elif state == "missing_correlation_digest":
            counters["missing_correlation_anchor"] += 1

    def push_summaries(
        state: str, stable_topic_id: str, tk: str, tid: str, ak: str, ar: dict[str, Any]
    ) -> None:
        summ = {
            "stableTopicId": stable_topic_id,
            "topicKind": tk,
            "topicId": tid,
            "anchorKind": ak,
            "resolutionState": state,
            "correlationRowKind": ar.get("correlationRowKind"),
            "correlationRowId": ar.get("correlationRowId"),
        }
        if state == "unresolved_absent_evidence":
            unresolved_summary.append(summ)
        elif state == "stale_correlation_digest":
            stale_summary.append(summ)
        elif state == "missing_correlation_digest":
            missing_summary.append(summ)

    for t in topic_dicts:
        tk = str(t.get("topicKind") or "")
        tid = str(t.get("topicId") or "")
        stable_topic_id = f"{tk}:{tid}"
        raw_eids_t = t.get("elementIds")
        el_list = [
            str(x) for x in (raw_eids_t if isinstance(raw_eids_t, list) else []) if x is not None
        ]
        topic_eids = frozenset(el_list)

        linked_rules: set[str] = set()
        for rid, veids in viol_rows:
            if topic_eids & veids:
                linked_rules.add(rid)
        violation_rule_ids = sorted(linked_rules)

        anchors_out: list[dict[str, Any]] = []

        refs_raw_t = t.get("evidenceRefs")
        refs_list = refs_raw_t if isinstance(refs_raw_t, list) else []
        ref_dicts = [x for x in refs_list if isinstance(x, dict)]
        for ref in _sort_evidence_ref_dicts(ref_dicts):
            er_row = {
                "kind": ref.get("kind"),
                "sheetId": ref.get("sheetId"),
                "viewpointId": ref.get("viewpointId"),
                "planViewId": ref.get("planViewId"),
                "sectionCutId": ref.get("sectionCutId"),
                "pngBasename": ref.get("pngBasename"),
            }
            anchor_kind = str(er_row.get("kind") or "")
            state_a, anchor_row, mprint_a = _classify_bcf_anchor(
                er_row,
                topic_kind=tk,
                topic_id=tid,
                stable_topic_id=stable_topic_id,
                anchor_kind=anchor_kind,
                unresolved_fps=unresolved_fps,
                stale_pairs=stale_pairs,
                missing_pairs=missing_pairs,
                sheet_by_id=sheet_by_id,
                vp_by_id=vp_by_id,
                plan_by_id=plan_by_id,
                sec_by_id=sec_by_id,
            )
            bump_anchor(state_a)
            anchors_out.append(anchor_row)
            manifest_anchor_prints.append(mprint_a)
            push_summaries(state_a, stable_topic_id, tk, tid, anchor_kind, anchor_row)

        if tk == "bcf":
            vpref_b = t.get("viewpointRef")
            if isinstance(vpref_b, str) and vpref_b.strip():
                syn_vp = {
                    "kind": "bcf_viewpoint_ref",
                    "sheetId": None,
                    "viewpointId": vpref_b,
                    "planViewId": None,
                    "sectionCutId": None,
                    "pngBasename": None,
                }
                state_a, anchor_row, mprint_a = _classify_bcf_anchor(
                    syn_vp,
                    topic_kind=tk,
                    topic_id=tid,
                    stable_topic_id=stable_topic_id,
                    anchor_kind="bcf_viewpoint_ref",
                    unresolved_fps=unresolved_fps,
                    stale_pairs=stale_pairs,
                    missing_pairs=missing_pairs,
                    sheet_by_id=sheet_by_id,
                    vp_by_id=vp_by_id,
                    plan_by_id=plan_by_id,
                    sec_by_id=sec_by_id,
                )
                bump_anchor(state_a)
                anchors_out.append(anchor_row)
                manifest_anchor_prints.append(mprint_a)
                push_summaries(state_a, stable_topic_id, tk, tid, "bcf_viewpoint_ref", anchor_row)
            pvid_b = t.get("planViewId")
            if isinstance(pvid_b, str) and pvid_b.strip():
                syn_pl = {
                    "kind": "bcf_plan_view",
                    "sheetId": None,
                    "viewpointId": None,
                    "planViewId": pvid_b,
                    "sectionCutId": None,
                    "pngBasename": None,
                }
                state_a, anchor_row, mprint_a = _classify_bcf_anchor(
                    syn_pl,
                    topic_kind=tk,
                    topic_id=tid,
                    stable_topic_id=stable_topic_id,
                    anchor_kind="bcf_plan_view",
                    unresolved_fps=unresolved_fps,
                    stale_pairs=stale_pairs,
                    missing_pairs=missing_pairs,
                    sheet_by_id=sheet_by_id,
                    vp_by_id=vp_by_id,
                    plan_by_id=plan_by_id,
                    sec_by_id=sec_by_id,
                )
                bump_anchor(state_a)
                anchors_out.append(anchor_row)
                manifest_anchor_prints.append(mprint_a)
                push_summaries(state_a, stable_topic_id, tk, tid, "bcf_plan_view", anchor_row)
            scid_b = t.get("sectionCutId")
            if isinstance(scid_b, str) and scid_b.strip():
                syn_sc = {
                    "kind": "bcf_section_cut",
                    "sheetId": None,
                    "viewpointId": None,
                    "planViewId": None,
                    "sectionCutId": scid_b,
                    "pngBasename": None,
                }
                state_a, anchor_row, mprint_a = _classify_bcf_anchor(
                    syn_sc,
                    topic_kind=tk,
                    topic_id=tid,
                    stable_topic_id=stable_topic_id,
                    anchor_kind="bcf_section_cut",
                    unresolved_fps=unresolved_fps,
                    stale_pairs=stale_pairs,
                    missing_pairs=missing_pairs,
                    sheet_by_id=sheet_by_id,
                    vp_by_id=vp_by_id,
                    plan_by_id=plan_by_id,
                    sec_by_id=sec_by_id,
                )
                bump_anchor(state_a)
                anchors_out.append(anchor_row)
                manifest_anchor_prints.append(mprint_a)
                push_summaries(state_a, stable_topic_id, tk, tid, "bcf_section_cut", anchor_row)
        elif tk == "issue":
            ivp_b = t.get("viewpointId")
            if isinstance(ivp_b, str) and ivp_b.strip():
                syn_is = {
                    "kind": "issue_viewpoint",
                    "sheetId": None,
                    "viewpointId": ivp_b,
                    "planViewId": None,
                    "sectionCutId": None,
                    "pngBasename": None,
                }
                state_a, anchor_row, mprint_a = _classify_bcf_anchor(
                    syn_is,
                    topic_kind=tk,
                    topic_id=tid,
                    stable_topic_id=stable_topic_id,
                    anchor_kind="issue_viewpoint",
                    unresolved_fps=unresolved_fps,
                    stale_pairs=stale_pairs,
                    missing_pairs=missing_pairs,
                    sheet_by_id=sheet_by_id,
                    vp_by_id=vp_by_id,
                    plan_by_id=plan_by_id,
                    sec_by_id=sec_by_id,
                )
                bump_anchor(state_a)
                anchors_out.append(anchor_row)
                manifest_anchor_prints.append(mprint_a)
                push_summaries(state_a, stable_topic_id, tk, tid, "issue_viewpoint", anchor_row)

        topic_rows_out.append(
            {
                "stableTopicId": stable_topic_id,
                "topicKind": tk,
                "topicId": tid,
                "violationRuleIds": violation_rule_ids,
                "anchors": anchors_out,
            },
        )

    def sort_summary(rows: list[dict[str, Any]]) -> None:
        rows.sort(
            key=lambda x: (
                str(x.get("stableTopicId") or ""),
                str(x.get("anchorKind") or ""),
                str(x.get("correlationRowKind") or ""),
                str(x.get("correlationRowId") or ""),
            ),
        )

    sort_summary(unresolved_summary)
    sort_summary(stale_summary)
    sort_summary(missing_summary)

    evidence_artifact_refs: list[str] = []
    sal_pl = staged_artifact_links_v1_payload
    if isinstance(sal_pl, dict):
        erp = sal_pl.get("exportRelativePaths")
        if isinstance(erp, dict):
            for ek in sorted(erp.keys()):
                evidence_artifact_refs.append(
                    f"evidenceAgentFollowThrough_v1.stagedArtifactLinks_v1.exportRelativePaths.{ek}",
                )
        bfh = sal_pl.get("bundleFilenameHints")
        if isinstance(bfh, dict):
            for bk in sorted(bfh.keys()):
                evidence_artifact_refs.append(
                    f"evidenceAgentFollowThrough_v1.stagedArtifactLinks_v1.bundleFilenameHints.{bk}",
                )
    evidence_artifact_refs.append("evidenceClosureReview_v1.expectedDeterministicPngBasenames")

    remediation_tokens: list[str] = []
    remediation_hint_refs: list[dict[str, Any]] = []
    fix_loop_ok = isinstance(evidence_diff_ingest_fix_loop, dict)
    needs_fix = fix_loop_ok and evidence_diff_ingest_fix_loop.get("needsFixLoop") is True
    blocker_codes: list[str] = []
    if fix_loop_ok:
        bc_raw = evidence_diff_ingest_fix_loop.get("blockerCodes")
        if isinstance(bc_raw, list):
            blocker_codes = sorted({str(x) for x in bc_raw if isinstance(x, str)})
    actionable_other = (
        counters["resolved_anchor"]
        + counters["stale_anchor"]
        + counters["missing_correlation_anchor"]
    )
    if needs_fix and actionable_other > 0:
        remediation_tokens.extend(blocker_codes)
        remediation_hint_refs = [
            {"path": "evidenceClosureReview_v1"},
            {"path": "evidenceClosureReview_v1.correlationDigestConsistency"},
            {"path": "evidenceClosureReview_v1.pixelDiffExpectation.ingestChecklist_v1"},
            {"path": "agentEvidenceClosureHints_v1.evidenceClosureReviewField"},
            {"path": "agentEvidenceClosureHints_v1.evidenceDiffIngestFixLoopField"},
            {"path": "agentEvidenceClosureHints_v1.artifactIngestCorrelationFullPath"},
            {"path": "agentReviewActions_v1", "hint": "kind=remediateEvidenceDiffIngest"},
        ]

    remediation_hint_refs.sort(key=lambda x: (str(x.get("path") or ""), str(x.get("hint") or "")))

    artifact_ref_count = len(evidence_artifact_refs)
    remediation_link_count = len(remediation_hint_refs)

    counts = {
        "topicRowCount": len(topic_rows_out),
        "resolvedAnchorCount": counters["resolved_anchor"],
        "unresolvedAnchorCount": counters["unresolved_anchor"],
        "staleAnchorCount": counters["stale_anchor"],
        "missingCorrelationAnchorCount": counters["missing_correlation_anchor"],
        "evidenceArtifactRefCount": artifact_ref_count,
        "remediationHintLinkCount": remediation_link_count,
    }

    stable_topic_ids_sorted = sorted({row["stableTopicId"] for row in topic_rows_out})
    manifest_obj = {
        "format": "bcfIssuePackageManifest_v1",
        "counts": counts,
        "stableTopicIds": stable_topic_ids_sorted,
        "anchorFingerprintsSorted": sorted(manifest_anchor_prints),
        "remediationTokensSorted": sorted(remediation_tokens),
    }
    manifest_body = json.dumps(manifest_obj, sort_keys=True, separators=(",", ":"), default=str)
    pkg_digest = hashlib.sha256(manifest_body.encode("utf-8")).hexdigest()

    def bound(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
        lim = _ISSUE_PKG_ANCHOR_SUMMARY_LIMIT
        if len(rows) <= lim:
            return rows, False
        return rows[:lim], True

    u_b, u_tr = bound(unresolved_summary)
    s_b, s_tr = bound(stale_summary)
    m_b, m_tr = bound(missing_summary)

    return {
        "format": "bcfIssuePackageExport_v1",
        "packageManifestDigestSha256": pkg_digest,
        "counts": counts,
        "topics": topic_rows_out,
        "unresolvedAnchorRows": u_b,
        "unresolvedAnchorRowsTruncated": u_tr,
        "staleAnchorRows": s_b,
        "staleAnchorRowsTruncated": s_tr,
        "missingCorrelationAnchorRows": m_b,
        "missingCorrelationAnchorRowsTruncated": m_tr,
        "evidenceArtifactRefs": evidence_artifact_refs,
        "remediationHintRefs": remediation_hint_refs,
        "fixLoopBlockerCodesEcho": blocker_codes,
    }
