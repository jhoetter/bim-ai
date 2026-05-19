from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

RENDERER_DIAGNOSTIC_PACKET_FORMAT = "rendererDiagnosticPacket_v1"
RENDERER_DIAGNOSTIC_PACKET_EMBEDDING_FORMAT = "rendererDiagnosticPacketEmbedding_v1"


def _stable_digest(value: Any) -> str:
    body = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def _unique_sorted_strings(*values: Any) -> list[str]:
    strings: set[str] = set()
    for value in values:
        for item in _as_list(value):
            text = str(item).strip()
            if text:
                strings.add(text)
    return sorted(strings)


def _packet_generated_at(packet: Mapping[str, Any]) -> str:
    return str(packet.get("generatedAtIso") or packet.get("generatedAt") or "")


def normalize_renderer_diagnostic_packet(
    packet: Mapping[str, Any],
    *,
    model_id: str,
    model_revision: int,
    generated_at_iso: str | None = None,
) -> dict[str, Any]:
    """Return the persisted backend packet shape used by evidence-package.

    The browser owns the actual renderer diagnostics. The backend only validates
    the envelope, fills stable context fields, and records the packet against the
    current model revision so stale renderer evidence cannot silently satisfy an
    evidence-package request.
    """

    diagnostics = [d for d in _as_list(packet.get("diagnostics")) if isinstance(d, Mapping)]
    element_statuses = [
        dict(s)
        for s in _as_list(
            packet.get("elementRenderStatuses") or packet.get("elementRenderFeatureStatuses")
        )
        if isinstance(s, Mapping)
    ]
    normalized_diagnostics: list[dict[str, Any]] = []
    for index, diagnostic in enumerate(diagnostics):
        code = str(diagnostic.get("code") or diagnostic.get("ruleId") or f"renderer.diagnostic.{index}")
        evidence = diagnostic.get("evidence") if isinstance(diagnostic.get("evidence"), Mapping) else {}
        normalized_diagnostics.append(
            {
                **dict(diagnostic),
                "format": "rendererDiagnostic_v1",
                "diagnosticId": str(diagnostic.get("diagnosticId") or diagnostic.get("id") or f"{code}#{index}"),
                "code": code,
                "ruleId": str(diagnostic.get("ruleId") or code),
                "severity": str(diagnostic.get("severity") or "info"),
                "issueClass": str(diagnostic.get("issueClass") or diagnostic.get("classification") or "renderer-diagnostic"),
                "elementIds": _unique_sorted_strings(
                    diagnostic.get("elementIds"),
                    diagnostic.get("elementId"),
                    diagnostic.get("hostElementId"),
                ),
                "viewId": diagnostic.get("viewId") or evidence.get("viewId"),
                "trackerItems": _unique_sorted_strings(diagnostic.get("trackerItems"), "BIR-I06"),
            }
        )

    normalized = {
        **dict(packet),
        "format": RENDERER_DIAGNOSTIC_PACKET_FORMAT,
        "generatedAtIso": generated_at_iso
        or _packet_generated_at(packet)
        or datetime.now(UTC).isoformat(),
        "modelId": str(packet.get("modelId") or model_id),
        "modelRevision": model_revision,
        "viewId": packet.get("viewId"),
        "gitHead": packet.get("gitHead"),
        "rendererBuild": packet.get("rendererBuild"),
        "supportMatrixDigest": str(packet.get("supportMatrixDigest") or ""),
        "diagnostics": normalized_diagnostics,
        "elementRenderStatuses": element_statuses,
    }
    normalized["affectedElementIds"] = _unique_sorted_strings(
        *(diagnostic.get("elementIds") for diagnostic in normalized_diagnostics)
    )
    normalized["summary"] = {
        "diagnosticCount": len(normalized_diagnostics),
        "elementRenderStatusCount": len(element_statuses),
        "affectedElementCount": len(normalized["affectedElementIds"]),
        "errorCount": sum(1 for d in normalized_diagnostics if d.get("severity") == "error"),
        "rendererIssueCount": sum(
            1
            for d in normalized_diagnostics
            if str(d.get("issueClass") or "").startswith("renderer-")
        ),
    }
    normalized["packetDigestSha256"] = _stable_digest(
        {
            "format": normalized["format"],
            "modelId": normalized["modelId"],
            "modelRevision": normalized["modelRevision"],
            "viewId": normalized.get("viewId"),
            "gitHead": normalized.get("gitHead"),
            "rendererBuild": normalized.get("rendererBuild"),
            "supportMatrixDigest": normalized.get("supportMatrixDigest"),
            "diagnostics": normalized["diagnostics"],
            "elementRenderStatuses": normalized["elementRenderStatuses"],
        }
    )
    return normalized


def append_renderer_diagnostic_packet(
    document_wire: Mapping[str, Any],
    packet: Mapping[str, Any],
    *,
    max_packets: int = 5,
) -> dict[str, Any]:
    out = dict(document_wire)
    packets = [p for p in _as_list(out.get("rendererDiagnosticPackets")) if isinstance(p, Mapping)]
    packets.append(dict(packet))
    packets.sort(key=_packet_generated_at)
    out["rendererDiagnosticPackets"] = packets[-max(1, max_packets) :]
    return out


def renderer_diagnostic_packet_embedding(
    document_wire: Mapping[str, Any],
    *,
    model_revision: int,
) -> dict[str, Any]:
    packets = [dict(p) for p in _as_list(document_wire.get("rendererDiagnosticPackets")) if isinstance(p, Mapping)]
    packets.sort(key=_packet_generated_at, reverse=True)
    latest = packets[0] if packets else None
    same_revision = next(
        (
            p
            for p in packets
            if str(p.get("format")) == RENDERER_DIAGNOSTIC_PACKET_FORMAT
            and str(p.get("modelRevision")) == str(model_revision)
        ),
        None,
    )
    embedded = same_revision is not None
    return {
        "format": RENDERER_DIAGNOSTIC_PACKET_EMBEDDING_FORMAT,
        "embedded": embedded,
        "status": "embedded" if embedded else ("missing" if latest is None else "stale_revision"),
        "modelRevision": model_revision,
        "storedPacketCount": len(packets),
        "latestPacketRevision": latest.get("modelRevision") if latest else None,
        "latestGeneratedAtIso": _packet_generated_at(latest) if latest else None,
        "packetDigestSha256": same_revision.get("packetDigestSha256") if same_revision else None,
        "trackerItems": ["BIR-I06"],
    }


def latest_renderer_diagnostic_packet_for_evidence(
    document_wire: Mapping[str, Any],
    *,
    model_revision: int,
) -> dict[str, Any] | None:
    packets = [dict(p) for p in _as_list(document_wire.get("rendererDiagnosticPackets")) if isinstance(p, Mapping)]
    packets.sort(key=_packet_generated_at, reverse=True)
    for packet in packets:
        if (
            str(packet.get("format")) == RENDERER_DIAGNOSTIC_PACKET_FORMAT
            and str(packet.get("modelRevision")) == str(model_revision)
        ):
            return packet
    return None
