from __future__ import annotations

from pathlib import Path

from bim_ai.services.folder_output import (
    _build_reader_response_index,
    _load_reader_response_files,
    _reader_response_payload,
)


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


def test_reader_response_loader_accepts_markdown_with_fenced_json(tmp_path: Path) -> None:
    out_dir = tmp_path / "folder-output"
    manifest_path = out_dir / "ai-reading" / "reader-pass-manifest.json"
    manifest_path.parent.mkdir(parents=True)
    response_hint = "ai-reading/responses/reader-pass-01/run-wp-dimensional-floorplans.md"
    manifest_path.write_text(
        """{
  "assignments": [
    {
      "assignmentId": "reader-pass-01:run:wp-dimensional-floorplans",
      "readerPassId": "reader-pass-01",
      "requestId": "run:wp-dimensional-floorplans",
      "workPackageId": "wp-dimensional-floorplans",
      "requestPartIndex": 1,
      "requestPartCount": 1,
      "responsePathHint": "ai-reading/responses/reader-pass-01/run-wp-dimensional-floorplans.json"
    }
  ]
}
""",
        encoding="utf-8",
    )
    response_path = out_dir / response_hint
    response_path.parent.mkdir(parents=True)
    response_path.write_text(
        """
# Reader notes

The ground-floor plan shows one room label.

```json
{
  "format": "sourceAiVisualTraceReaderResponse_v1",
  "readerId": "subagent-a",
  "facts": [
    {
      "factId": "fact-room-1",
      "kind": "room",
      "value": {"levelId": "EG", "name": "Wohnen", "areaM2": 18.5},
      "confidence": 0.8,
      "provenance": {"sourceDocumentId": "src-eg", "page": 1, "region": "room label"}
    }
  ]
}
```
""",
        encoding="utf-8",
    )

    loaded = _load_reader_response_files(out_dir)

    assert loaded["responseFileCount"] == 1
    assert loaded["responseFileErrorCount"] == 0
    assert loaded["responses"][0]["readerPassId"] == "reader-pass-01"
    assert loaded["responses"][0]["requestId"] == "run:wp-dimensional-floorplans"
    assert loaded["responses"][0]["workPackageId"] == "wp-dimensional-floorplans"
    assert loaded["responses"][0]["facts"][0]["factId"] == "fact-room-1"


def test_reader_response_loader_preserves_markdown_notes_without_facts(tmp_path: Path) -> None:
    out_dir = tmp_path / "folder-output"
    response_path = out_dir / "ai-reading" / "responses" / "reader-pass-01" / "notes.md"
    response_path.parent.mkdir(parents=True)
    response_path.write_text("Observed: the source is too blurry to read dimensions.", encoding="utf-8")

    loaded = _load_reader_response_files(out_dir)

    assert loaded["responseFileCount"] == 1
    assert loaded["responseFileErrorCount"] == 0
    assert loaded["diagnostics"][0]["code"] == "reader_response_markdown_notes_only"
    assert loaded["responses"][0]["facts"] == []
    assert "too blurry" in loaded["responses"][0]["readerNotes"]
