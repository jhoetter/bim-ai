"""Parser for Claude Code session JSONLs.

Sits under the developer-only ``/agents`` observability surface.
See ``spec/agent-run-inspector-tracker.md`` for context.

Source data lives at
``~/.claude/projects/-home-jhoetter-repos-bim-ai/<sessionId>.jsonl``.
Each line is a JSON object whose top-level ``type`` is one of:

* ``user`` / ``assistant`` / ``system`` — message records with a
  ``message.content`` list of content blocks (text / thinking /
  tool_use / tool_result).
* ``tool_result`` — sometimes appears at the top level too.
* ``file-history-snapshot``, ``permission-mode``, ``tools_changed``,
  ``skill_listing``, ``agent_listing_delta`` etc. — Claude Code
  metadata; the parser ignores these for the inspector's purposes but
  keeps them in the raw stream when asked.

The parser is *streaming* by line and never holds an entire JSONL in
memory; sessions can run to several megabytes.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

# Heuristic regexes for house/iteration inference from tool inputs and
# free text. Mirrors _infer_iteration_label / _infer_house_name in
# routes_api so attribution stays consistent across surfaces.
_ITERATION_RE = re.compile(r"(?:^|[/_-])iter[-_]?(\d+[a-z]?)(?:[/_-]|$)", re.IGNORECASE)
# Known testhouse names only. Loosely matching `house-<word>` produced
# false positives like 'live', 'final', 'model' on real session text.
# Extend this when adding new houses.
_KNOWN_HOUSES = ("alpha", "beta", "gamma")
_HOUSE_RE = re.compile(
    r"(?:^|[/_-])house[-_/](" + "|".join(_KNOWN_HOUSES) + r")(?:[/_-]|$)",
    re.IGNORECASE,
)
_UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE
)

# Tool name prefixes that indicate a model-state mutation; useful for
# attributing a session to a specific model via its first such call.
_MODEL_TOOL_PREFIXES = (
    "author",
    "opening",
    "qa",
    "query",
    "resolve",
    "reverse_bim",
)


def default_sessions_dir() -> Path:
    """Return the Claude Code session directory for this repo."""

    env = os.getenv("BIM_AI_AGENT_RUNS_DIR")
    if env:
        return Path(env)
    return Path.home() / ".claude" / "projects" / "-home-jhoetter-repos-bim-ai"


@dataclass
class SessionSummary:
    """High-level metadata for the index page."""

    session_id: str
    path: str
    size_bytes: int
    first_ts: str | None = None
    last_ts: str | None = None
    user_messages: int = 0
    assistant_messages: int = 0
    tool_calls: int = 0
    sub_agent_dispatches: int = 0
    tool_call_counts_by_name: dict[str, int] = field(default_factory=dict)
    inferred_model_id: str | None = None
    inferred_house: str | None = None
    inferred_iteration: str | None = None
    git_branch: str | None = None
    parse_errors: int = 0


@dataclass
class TimelineEvent:
    """A single normalized event in the session timeline."""

    kind: str  # one of: user, assistant_text, assistant_thinking, tool_use, tool_result, system, raw
    timestamp: str | None
    uuid: str | None
    parent_uuid: str | None
    sequence: int  # 0-based index within the session (for stable ordering)
    payload: dict[str, Any]


def _iter_jsonl_lines(path: Path) -> Iterator[dict[str, Any]]:
    """Yield decoded objects from a JSONL file, line by line."""

    with path.open("r", encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw:
                continue
            try:
                yield json.loads(raw)
            except json.JSONDecodeError:
                # Skip but record; SessionSummary.parse_errors counts these.
                yield {"__parse_error": True, "raw": raw[:200]}


def _record_timestamp(obj: dict[str, Any]) -> str | None:
    """Pick the best timestamp for a record."""

    ts = obj.get("timestamp")
    if isinstance(ts, str):
        return ts
    snap = obj.get("snapshot")
    if isinstance(snap, dict):
        v = snap.get("timestamp")
        if isinstance(v, str):
            return v
    return None


def _content_blocks(obj: dict[str, Any]) -> list[dict[str, Any]]:
    msg = obj.get("message")
    if not isinstance(msg, dict):
        return []
    content = msg.get("content")
    if isinstance(content, list):
        return [c for c in content if isinstance(c, dict)]
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return []


def _looks_like_model_tool(name: str | None) -> bool:
    if not isinstance(name, str):
        return False
    return any(name.startswith(prefix) for prefix in _MODEL_TOOL_PREFIXES) or "." in name


def _scan_for_model_id(value: Any) -> str | None:
    """Find the first UUID-shaped value referenced anywhere in ``value``."""

    if isinstance(value, str):
        m = _UUID_RE.search(value)
        return m.group(0) if m else None
    if isinstance(value, dict):
        # Prefer common keys before recursion.
        for key in ("modelId", "model_id", "model"):
            v = value.get(key)
            if isinstance(v, str):
                m = _UUID_RE.search(v)
                if m:
                    return m.group(0)
        for v in value.values():
            found = _scan_for_model_id(v)
            if found:
                return found
    elif isinstance(value, list):
        for v in value:
            found = _scan_for_model_id(v)
            if found:
                return found
    return None


def _scan_for_house_or_iter(value: Any) -> tuple[str | None, str | None]:
    house: str | None = None
    iteration: str | None = None
    if isinstance(value, str):
        if not iteration:
            m = _ITERATION_RE.search(value)
            if m:
                iteration = f"iter-{m.group(1).lower()}"
        if not house:
            m = _HOUSE_RE.search(value)
            if m:
                house = m.group(1).lower()
        return house, iteration
    if isinstance(value, dict):
        for v in value.values():
            h, i = _scan_for_house_or_iter(v)
            house = house or h
            iteration = iteration or i
            if house and iteration:
                break
        return house, iteration
    if isinstance(value, list):
        for v in value:
            h, i = _scan_for_house_or_iter(v)
            house = house or h
            iteration = iteration or i
            if house and iteration:
                break
        return house, iteration
    return None, None


def summarize_session(path: Path) -> SessionSummary:
    """Walk the JSONL once and emit a high-level summary."""

    session_id = path.stem
    try:
        size_bytes = path.stat().st_size
    except OSError:
        size_bytes = 0
    summary = SessionSummary(
        session_id=session_id, path=str(path), size_bytes=size_bytes
    )

    for obj in _iter_jsonl_lines(path):
        if obj.get("__parse_error"):
            summary.parse_errors += 1
            continue

        ts = _record_timestamp(obj)
        if ts:
            if summary.first_ts is None or ts < summary.first_ts:
                summary.first_ts = ts
            if summary.last_ts is None or ts > summary.last_ts:
                summary.last_ts = ts

        kind = obj.get("type")
        gb = obj.get("gitBranch")
        if isinstance(gb, str) and not summary.git_branch:
            summary.git_branch = gb

        if kind == "user":
            summary.user_messages += 1
            continue
        if kind == "assistant":
            summary.assistant_messages += 1
            for block in _content_blocks(obj):
                btype = block.get("type")
                if btype == "tool_use":
                    summary.tool_calls += 1
                    name = block.get("name") or "<unknown>"
                    summary.tool_call_counts_by_name[name] = (
                        summary.tool_call_counts_by_name.get(name, 0) + 1
                    )
                    if name in ("Agent", "Task"):
                        summary.sub_agent_dispatches += 1
                    if (
                        summary.inferred_model_id is None
                        and _looks_like_model_tool(name)
                    ):
                        summary.inferred_model_id = _scan_for_model_id(
                            block.get("input")
                        )
                    if not (summary.inferred_house and summary.inferred_iteration):
                        h, i = _scan_for_house_or_iter(block.get("input"))
                        summary.inferred_house = summary.inferred_house or h
                        summary.inferred_iteration = summary.inferred_iteration or i
            continue
        # Other top-level kinds (system / tool_result / metadata) — counted
        # only via the parse-error path or ignored.

    return summary


def list_sessions(sessions_dir: Path | None = None) -> list[SessionSummary]:
    """Return a SessionSummary per .jsonl file in the sessions directory."""

    directory = sessions_dir or default_sessions_dir()
    if not directory.exists():
        return []
    summaries: list[SessionSummary] = []
    for entry in sorted(directory.iterdir()):
        if entry.suffix != ".jsonl" or not entry.is_file():
            continue
        try:
            summary = summarize_session(entry)
        except Exception as exc:  # pragma: no cover — defensive
            summary = SessionSummary(
                session_id=entry.stem,
                path=str(entry),
                size_bytes=0,
                parse_errors=1,
            )
            summary.tool_call_counts_by_name = {"<parse failure>": 1}
            _ = exc
        summaries.append(summary)
    summaries.sort(key=lambda s: s.last_ts or "", reverse=True)
    return summaries


def parse_timeline(path: Path) -> Iterable[TimelineEvent]:
    """Yield TimelineEvents from a single session JSONL.

    The events are emitted in file order; consumers preserve that
    ordering. UUIDs are passed through so future versions can build a
    parent-child tree for grouping.
    """

    seq = 0
    for obj in _iter_jsonl_lines(path):
        if obj.get("__parse_error"):
            yield TimelineEvent(
                kind="raw",
                timestamp=None,
                uuid=None,
                parent_uuid=None,
                sequence=seq,
                payload={"_parseError": True, "raw": obj.get("raw")},
            )
            seq += 1
            continue

        ts = _record_timestamp(obj)
        rec_type = obj.get("type")
        uuid = obj.get("uuid") if isinstance(obj.get("uuid"), str) else None
        parent_uuid = (
            obj.get("parentUuid") if isinstance(obj.get("parentUuid"), str) else None
        )

        if rec_type == "user":
            msg = obj.get("message") or {}
            content = msg.get("content") if isinstance(msg, dict) else None
            if isinstance(content, list):
                texts = [b.get("text") for b in content if isinstance(b, dict)]
                text = "\n".join(t for t in texts if isinstance(t, str))
            elif isinstance(content, str):
                text = content
            else:
                text = ""
            yield TimelineEvent(
                kind="user",
                timestamp=ts,
                uuid=uuid,
                parent_uuid=parent_uuid,
                sequence=seq,
                payload={"text": text},
            )
            seq += 1
            continue

        if rec_type == "assistant":
            for block in _content_blocks(obj):
                btype = block.get("type")
                if btype == "text":
                    yield TimelineEvent(
                        kind="assistant_text",
                        timestamp=ts,
                        uuid=uuid,
                        parent_uuid=parent_uuid,
                        sequence=seq,
                        payload={"text": block.get("text") or ""},
                    )
                elif btype == "thinking":
                    yield TimelineEvent(
                        kind="assistant_thinking",
                        timestamp=ts,
                        uuid=uuid,
                        parent_uuid=parent_uuid,
                        sequence=seq,
                        payload={"text": block.get("thinking") or block.get("text") or ""},
                    )
                elif btype == "tool_use":
                    name = block.get("name") or "<unknown>"
                    yield TimelineEvent(
                        kind="tool_use" if name not in ("Agent", "Task") else "sub_agent",
                        timestamp=ts,
                        uuid=uuid,
                        parent_uuid=parent_uuid,
                        sequence=seq,
                        payload={
                            "toolUseId": block.get("id"),
                            "name": name,
                            "input": block.get("input"),
                            "caller": block.get("caller"),
                        },
                    )
                elif btype == "tool_result":
                    yield TimelineEvent(
                        kind="tool_result",
                        timestamp=ts,
                        uuid=uuid,
                        parent_uuid=parent_uuid,
                        sequence=seq,
                        payload={
                            "toolUseId": block.get("tool_use_id"),
                            "isError": bool(block.get("is_error")),
                            "content": block.get("content"),
                        },
                    )
                seq += 1
            continue

        if rec_type in ("tool_result",):
            yield TimelineEvent(
                kind="tool_result",
                timestamp=ts,
                uuid=uuid,
                parent_uuid=parent_uuid,
                sequence=seq,
                payload={
                    "toolUseId": obj.get("tool_use_id"),
                    "content": obj.get("content"),
                    "isError": bool(obj.get("is_error")),
                },
            )
            seq += 1
            continue

        # Everything else (system, file-history-snapshot, tools_changed, …)
        # is preserved as a 'raw' event with the original record for
        # debugging; the UI suppresses these by default.
        yield TimelineEvent(
            kind="raw",
            timestamp=ts,
            uuid=uuid,
            parent_uuid=parent_uuid,
            sequence=seq,
            payload={"_recordType": rec_type, "raw": obj},
        )
        seq += 1


def session_path(session_id: str, sessions_dir: Path | None = None) -> Path | None:
    """Resolve a session id to its on-disk JSONL path, or None if missing.

    Rejects any session_id that escapes the sessions directory.
    """

    if not isinstance(session_id, str) or not session_id:
        return None
    # Reject anything that could escape the dir.
    if "/" in session_id or "\\" in session_id or session_id in ("", ".", ".."):
        return None
    directory = sessions_dir or default_sessions_dir()
    candidate = directory / f"{session_id}.jsonl"
    try:
        # Canonicalize, then verify it stays under the directory.
        resolved = candidate.resolve()
        resolved.relative_to(directory.resolve())
    except (OSError, ValueError):
        return None
    if not resolved.is_file():
        return None
    return resolved
