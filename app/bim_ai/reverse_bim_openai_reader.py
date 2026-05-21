"""OpenAI Responses API adapter for reverse-BIM source reader assignments."""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def build_openai_reader_request_payload(
    assignment_request: dict[str, Any],
    *,
    model: str,
    max_images: int | None = None,
) -> dict[str, Any]:
    """Build a multimodal Responses API payload for one reader assignment."""

    images = _assignment_images(assignment_request, max_images=max_images)
    prompt_text = _reader_prompt_text(assignment_request)
    content: list[dict[str, Any]] = [{"type": "input_text", "text": prompt_text}]
    content.extend(images)
    return {
        "model": model,
        "input": [
            {
                "type": "message",
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are a careful existing-building BIM source-document reader. "
                            "Return JSON only. Do not produce BIM commands. Do not guess hidden geometry."
                        ),
                    }
                ],
            },
            {"type": "message", "role": "user", "content": content},
        ],
    }


def run_openai_reader_assignment(
    assignment_request: dict[str, Any],
    *,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str = OPENAI_RESPONSES_URL,
    timeout_seconds: int = 300,
    max_images: int | None = None,
) -> dict[str, Any]:
    """Call the Responses API and return one source reader response object."""

    resolved_api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not resolved_api_key:
        raise RuntimeError("OPENAI_API_KEY is required")
    resolved_model = model or os.environ.get("OPENAI_READER_MODEL")
    if not resolved_model:
        raise RuntimeError("OPENAI_READER_MODEL is required")
    request_payload = build_openai_reader_request_payload(
        assignment_request,
        model=resolved_model,
        max_images=max_images,
    )
    body = json.dumps(request_payload).encode("utf-8")
    request = urllib.request.Request(
        base_url,
        data=body,
        headers={
            "Authorization": f"Bearer {resolved_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            api_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:2000]
        raise RuntimeError(f"OpenAI reader request failed with HTTP {exc.code}: {detail}") from exc
    return normalize_openai_reader_response(api_payload, assignment_request)


def normalize_openai_reader_response(
    api_payload: dict[str, Any],
    assignment_request: dict[str, Any],
) -> dict[str, Any]:
    """Extract and normalize the model's JSON response."""

    text = _extract_output_text(api_payload)
    if not text:
        raise RuntimeError("OpenAI response did not contain output text")
    parsed = _parse_json_text(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("OpenAI reader output must be a JSON object")
    return {
        **parsed,
        "format": parsed.get("format") or "sourceAiVisualTraceReaderResponse_v1",
        "assignmentId": parsed.get("assignmentId") or assignment_request.get("assignmentId"),
        "readerPassId": parsed.get("readerPassId") or assignment_request.get("readerPassId"),
        "requestId": parsed.get("requestId") or assignment_request.get("requestId"),
        "workPackageId": parsed.get("workPackageId") or assignment_request.get("workPackageId"),
        "provider": parsed.get("provider") or "openai",
        "model": parsed.get("model") or api_payload.get("model"),
        "responseId": parsed.get("responseId") or api_payload.get("id"),
        "facts": parsed.get("facts") if isinstance(parsed.get("facts"), list) else [],
    }


def _reader_prompt_text(assignment_request: dict[str, Any]) -> str:
    output_contract = assignment_request.get("outputContract")
    input_images = assignment_request.get("inputImages")
    return "\n\n".join(
        [
            "Read the attached source-document page images visually.",
            str(assignment_request.get("readerPrompt") or ""),
            "Assignment metadata:",
            json.dumps(
                {
                    "assignmentId": assignment_request.get("assignmentId"),
                    "readerPassId": assignment_request.get("readerPassId"),
                    "requestId": assignment_request.get("requestId"),
                    "workPackageId": assignment_request.get("workPackageId"),
                    "requestPartIndex": assignment_request.get("requestPartIndex"),
                    "requestPartCount": assignment_request.get("requestPartCount"),
                    "responsePathHint": assignment_request.get("responsePathHint"),
                },
                indent=2,
                ensure_ascii=False,
            ),
            "Output contract:",
            json.dumps(output_contract if isinstance(output_contract, dict) else {}, indent=2, ensure_ascii=False),
            "Input image metadata:",
            json.dumps(input_images if isinstance(input_images, list) else [], indent=2, ensure_ascii=False),
            "Return one JSON object with format=sourceAiVisualTraceReaderResponse_v1, the same assignment/request/workPackage/pass ids, independent reader identity metadata, and a facts array. If a required fact is not visible, return a conflict or source-unavailable disposition with provenance instead of guessing.",
        ]
    )


def _assignment_images(
    assignment_request: dict[str, Any],
    *,
    max_images: int | None,
) -> list[dict[str, Any]]:
    rows = [
        row
        for row in assignment_request.get("inputImages") or []
        if isinstance(row, dict) and row.get("renderedPagePath")
    ]
    if max_images is not None and max_images > 0:
        rows = rows[:max_images]
    images: list[dict[str, Any]] = []
    for row in rows:
        path = Path(str(row.get("renderedPagePath") or "")).expanduser()
        if not path.exists():
            continue
        images.append(
            {
                "type": "input_image",
                "image_url": _data_url(path),
                "detail": "high",
            }
        )
    return images


def _data_url(path: Path) -> str:
    content_type = mimetypes.guess_type(str(path))[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _extract_output_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return str(payload["output_text"])
    chunks: list[str] = []
    for item in payload.get("output") or []:
        if not isinstance(item, dict):
            continue
        for content in item.get("content") or []:
            if not isinstance(content, dict):
                continue
            if isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "\n".join(chunks)


def _parse_json_text(text: str) -> Any:
    stripped = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL)
    if fence:
        stripped = fence.group(1).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        candidate = _first_json_object_text(stripped)
        if candidate:
            return json.loads(candidate)
        raise


def _first_json_object_text(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escaped = False
    for idx, ch in enumerate(text[start:], start=start):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : idx + 1]
    return None
