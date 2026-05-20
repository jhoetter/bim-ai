from __future__ import annotations

from bim_ai.folder_output import _build_reader_response_index, _reader_response_payload


def test_reader_response_payload_adds_stable_digest() -> None:
    raw = _reader_response_payload(
        [
            {
                "format": "sourceAiVisualTraceReaderResponse_v1",
                "workPackageId": "wp-dimensional-floorplans",
                "facts": [{"factId": "fact-a", "kind": "room"}],
            }
        ]
    )

    assert raw["responseCount"] == 1
    assert len(raw["responsesDigestSha256"]) == 64


def test_reader_response_index_records_digest_status_and_fact_counts() -> None:
    raw = _reader_response_payload(
        [
            {
                "format": "sourceAiVisualTraceReaderResponse_v1",
                "workPackageId": "wp-dimensional-floorplans",
                "readerId": "agent-a",
                "model": "vision-model",
                "facts": [
                    {"factId": "fact-room", "kind": "room"},
                    {"factId": "fact-wall", "kind": "wall_chain"},
                ],
            }
        ]
    )
    loop = {
        "packageResults": [
            {
                "workPackageId": "wp-dimensional-floorplans",
                "status": "accepted",
                "normalization": {"summary": {"errorCount": 0, "warningCount": 1}},
                "findings": [{"code": "warning-a"}],
            }
        ]
    }

    index = _build_reader_response_index(raw, loop)

    assert index["format"] == "sourceAiVisualTraceReaderResponseIndex_v1"
    assert index["rawResponsesDigestSha256"] == raw["responsesDigestSha256"]
    assert index["statusCounts"] == {"accepted": 1}
    row = index["rows"][0]
    assert row["responseDigestSha256"]
    assert row["workPackageId"] == "wp-dimensional-floorplans"
    assert row["readerId"] == "agent-a"
    assert row["model"] == "vision-model"
    assert row["factCountsByKind"] == {"room": 1, "wall_chain": 1}
    assert row["normalizationWarningCount"] == 1
    assert row["findingCount"] == 1
