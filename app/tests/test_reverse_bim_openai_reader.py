from __future__ import annotations

import base64
import json
from pathlib import Path

from bim_ai.reverse_bim.openai_reader import (
    build_openai_reader_request_payload,
    normalize_openai_reader_response,
)


PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00"
    b"\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01"
    b"\xf6\x178U"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _assignment_request(image_path: Path) -> dict:
    return {
        "assignmentId": "reader-pass-01:run:wp",
        "readerPassId": "reader-pass-01",
        "requestId": "run:wp",
        "workPackageId": "wp-dimensional-floorplans",
        "readerPrompt": "Return source facts.",
        "outputContract": {
            "format": "sourceAiVisualTraceReaderResponse_v1",
            "blockingRequiredFactKinds": ["level"],
        },
        "inputImages": [
            {
                "sourceDocumentId": "src-plan",
                "page": 1,
                "renderedPagePath": str(image_path),
            }
        ],
        "responsePathHint": "ai-reading/responses/reader-pass-01/run-wp.json",
    }


def test_openai_reader_payload_embeds_source_images(tmp_path: Path) -> None:
    image = tmp_path / "page.png"
    image.write_bytes(PNG_1X1)

    payload = build_openai_reader_request_payload(_assignment_request(image), model="test-model")

    assert payload["model"] == "test-model"
    user_content = payload["input"][1]["content"]
    image_rows = [row for row in user_content if row["type"] == "input_image"]
    assert len(image_rows) == 1
    prefix, encoded = image_rows[0]["image_url"].split(",", 1)
    assert prefix == "data:image/png;base64"
    assert base64.b64decode(encoded) == PNG_1X1


def test_openai_reader_normalizes_json_output(tmp_path: Path) -> None:
    image = tmp_path / "page.png"
    image.write_bytes(PNG_1X1)
    assignment = _assignment_request(image)
    api_payload = {
        "id": "resp-123",
        "model": "vision-model",
        "output": [
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps(
                            {
                                "format": "sourceAiVisualTraceReaderResponse_v1",
                                "readerId": "reader-a",
                                "facts": [],
                            }
                        ),
                    }
                ],
            }
        ],
    }

    response = normalize_openai_reader_response(api_payload, assignment)

    assert response["assignmentId"] == "reader-pass-01:run:wp"
    assert response["readerPassId"] == "reader-pass-01"
    assert response["requestId"] == "run:wp"
    assert response["workPackageId"] == "wp-dimensional-floorplans"
    assert response["provider"] == "openai"
    assert response["model"] == "vision-model"
    assert response["responseId"] == "resp-123"


def test_openai_reader_extracts_json_object_from_wrapped_text(tmp_path: Path) -> None:
    image = tmp_path / "page.png"
    image.write_bytes(PNG_1X1)
    assignment = _assignment_request(image)
    api_payload = {
        "id": "resp-456",
        "model": "vision-model",
        "output_text": (
            "Notes before JSON.\n"
            "{\"format\":\"sourceAiVisualTraceReaderResponse_v1\","
            "\"readerId\":\"reader-b\",\"facts\":[]}\n"
            "Trailing note."
        ),
    }

    response = normalize_openai_reader_response(api_payload, assignment)

    assert response["readerId"] == "reader-b"
    assert response["assignmentId"] == "reader-pass-01:run:wp"
