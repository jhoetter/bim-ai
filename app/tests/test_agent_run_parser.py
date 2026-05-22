"""Tests for ``bim_ai.agent_run_parser`` against synthetic JSONL fixtures."""

from __future__ import annotations

import json
from pathlib import Path

from bim_ai.agent_run_parser import (
    list_sessions,
    parse_timeline,
    session_path,
    summarize_session,
)


def _write_jsonl(path: Path, lines: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for line in lines:
            fh.write(json.dumps(line) + "\n")


def test_summarize_counts_messages_tool_calls_and_subagents(tmp_path: Path) -> None:
    fixture = tmp_path / "sess-1.jsonl"
    _write_jsonl(
        fixture,
        [
            {"type": "permission-mode", "permissionMode": "bypassPermissions"},
            {
                "type": "user",
                "timestamp": "2026-05-23T10:00:00Z",
                "message": {"content": "do the thing"},
                "gitBranch": "main",
            },
            {
                "type": "assistant",
                "timestamp": "2026-05-23T10:00:05Z",
                "message": {
                    "content": [
                        {"type": "thinking", "thinking": "let me think"},
                        {
                            "type": "tool_use",
                            "id": "tu-1",
                            "name": "reverse_bim.hybrid_slice_execute",
                            "input": {
                                "modelId": "2378f078-6ee2-4c45-956c-d60a9973b3bb",
                                "outputDir": "tmp/reverse-bim/house-alpha/iter-9-foo",
                            },
                        },
                    ]
                },
            },
            {
                "type": "assistant",
                "timestamp": "2026-05-23T10:00:10Z",
                "message": {
                    "content": [
                        {
                            "type": "tool_use",
                            "id": "tu-2",
                            "name": "Agent",
                            "input": {"description": "explore"},
                        }
                    ]
                },
            },
        ],
    )

    summary = summarize_session(fixture)
    assert summary.user_messages == 1
    assert summary.assistant_messages == 2
    assert summary.tool_calls == 2
    assert summary.sub_agent_dispatches == 1
    assert summary.tool_call_counts_by_name == {
        "reverse_bim.hybrid_slice_execute": 1,
        "Agent": 1,
    }
    assert summary.inferred_model_id == "2378f078-6ee2-4c45-956c-d60a9973b3bb"
    assert summary.inferred_house == "alpha"
    assert summary.inferred_iteration == "iter-9"
    assert summary.git_branch == "main"
    assert summary.first_ts == "2026-05-23T10:00:00Z"
    assert summary.last_ts == "2026-05-23T10:00:10Z"
    assert summary.parse_errors == 0


def test_summarize_tolerates_invalid_lines(tmp_path: Path) -> None:
    fixture = tmp_path / "sess-2.jsonl"
    fixture.write_text('{"type":"user"\n{"not json at all\n', encoding="utf-8")
    summary = summarize_session(fixture)
    assert summary.parse_errors == 2


def test_parse_timeline_yields_expected_kinds(tmp_path: Path) -> None:
    fixture = tmp_path / "sess-3.jsonl"
    _write_jsonl(
        fixture,
        [
            {
                "type": "user",
                "timestamp": "2026-05-23T10:00:00Z",
                "uuid": "u1",
                "message": {"content": "do the thing"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-05-23T10:00:01Z",
                "uuid": "a1",
                "parentUuid": "u1",
                "message": {
                    "content": [
                        {"type": "thinking", "thinking": "think"},
                        {"type": "text", "text": "answer"},
                        {
                            "type": "tool_use",
                            "id": "tu-1",
                            "name": "Read",
                            "input": {"file_path": "/x"},
                        },
                    ]
                },
            },
            {
                "type": "tool_result",
                "timestamp": "2026-05-23T10:00:02Z",
                "tool_use_id": "tu-1",
                "content": "result text",
            },
            {"type": "file-history-snapshot", "snapshot": {"timestamp": "x"}},
        ],
    )

    events = list(parse_timeline(fixture))
    kinds = [e.kind for e in events]
    assert kinds == [
        "user",
        "assistant_thinking",
        "assistant_text",
        "tool_use",
        "tool_result",
        "raw",
    ]

    # Sequence numbers must be unique and monotonically increasing.
    seqs = [e.sequence for e in events]
    assert seqs == sorted(seqs)
    assert len(set(seqs)) == len(seqs)


def test_list_sessions_handles_empty_directory(tmp_path: Path) -> None:
    assert list_sessions(tmp_path) == []


def test_list_sessions_sorts_newest_first(tmp_path: Path) -> None:
    older = tmp_path / "aaa.jsonl"
    newer = tmp_path / "bbb.jsonl"
    _write_jsonl(
        older,
        [{"type": "user", "timestamp": "2026-05-01T00:00:00Z", "message": {"content": "x"}}],
    )
    _write_jsonl(
        newer,
        [{"type": "user", "timestamp": "2026-05-23T00:00:00Z", "message": {"content": "x"}}],
    )
    summaries = list_sessions(tmp_path)
    assert [s.session_id for s in summaries] == ["bbb", "aaa"]


def test_session_path_rejects_traversal(tmp_path: Path) -> None:
    # No path-traversal characters allowed in the id.
    assert session_path("../escape", sessions_dir=tmp_path) is None
    assert session_path("a/b", sessions_dir=tmp_path) is None
    assert session_path("", sessions_dir=tmp_path) is None
    # Missing file → None even with a clean id.
    assert session_path("missing", sessions_dir=tmp_path) is None


def test_session_path_resolves_existing(tmp_path: Path) -> None:
    (tmp_path / "ok-id.jsonl").write_text("{}\n", encoding="utf-8")
    resolved = session_path("ok-id", sessions_dir=tmp_path)
    assert resolved is not None
    assert resolved.name == "ok-id.jsonl"
