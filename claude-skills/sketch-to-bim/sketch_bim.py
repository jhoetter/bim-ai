#!/usr/bin/env python3
"""Skill-local sketch-to-BIM operational helper.

This is the sketch-to-BIM equivalent of the watch-yt helper script: keep the
skill instructions short, and give the agent one reliable command surface for
the live feedback loop.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
CLI = ["node", "packages/cli/cli.mjs"]
DEFAULT_CAPABILITIES = "spec/sketch-to-bim-capability-matrix.json"
DEFAULT_ARCHETYPES = "spec/sketch-to-bim-archetypes.json"
DEFAULT_RENDERER_SUPPORT_MATRIX = "spec/generated/renderer-support-matrix.md"
TOOL_MANIFEST = ROOT / "claude-skills" / "sketch-to-bim" / "tools.json"
BLOCKING_SEVERITIES = {"warning", "error"}
ADVISOR_RULE_FILES = [
    "app/bim_ai/constructability_advisories.py",
    "app/bim_ai/constructability_report.py",
    "app/bim_ai/constraints_metadata.py",
    "packages/web/src/advisor/advisorViolationContext.ts",
    "packages/web/src/advisor/perspectiveFilter.ts",
]
UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)


def rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def json_dump(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True)


def file_sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def digest_files(paths: list[str]) -> str:
    h = hashlib.sha256()
    for rel_path in sorted(paths):
        path = ROOT / rel_path
        h.update(rel_path.encode("utf8"))
        h.update(b"\0")
        if path.is_file():
            h.update((file_sha256(path) or "").encode("utf8"))
        else:
            h.update(b"missing")
        h.update(b"\0")
    return h.hexdigest()


def existing_rel_files(paths: list[str]) -> list[str]:
    return [rel_path for rel_path in paths if (ROOT / rel_path).is_file()]


def rel_files_under(root: Path) -> list[str]:
    if not root.exists():
        return []
    return sorted(rel(path) for path in root.rglob("*") if path.is_file())


def run(
    cmd: list[str],
    *,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(cmd), file=sys.stderr)
    proc = subprocess.run(
        cmd,
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.stdout:
        print(proc.stdout, end="")
    if proc.stderr:
        print(proc.stderr, end="", file=sys.stderr)
    if check and proc.returncode != 0:
        raise SystemExit(proc.returncode)
    return proc


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json_dump(data) + "\n", encoding="utf8")


def http_json(url: str, timeout: float = 2.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf8")
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        parsed = {"raw": body[:500]}
    return {"ok": True, "url": url, "status": resp.status, "body": parsed}


def http_probe(url: str, timeout: float = 2.0) -> dict[str, Any]:
    try:
        return http_json(url, timeout=timeout)
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        return {"ok": False, "url": url, "error": str(exc)}


def git_head() -> str | None:
    proc = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return proc.stdout.strip() if proc.returncode == 0 else None


def current_model_revision(model_id: str | None, base_url: str) -> int | None:
    if not model_id:
        return None
    try:
        snap = http_json(f"{base_url.rstrip('/')}/api/models/{model_id}/snapshot", timeout=2.0)
    except (OSError, urllib.error.URLError, TimeoutError):
        return None
    revision = (snap.get("body") or {}).get("revision")
    return revision if isinstance(revision, int) else None


def seed_paths(seed: str) -> dict[str, Path]:
    base = ROOT / "seed-artifacts" / seed
    return {
        "base": base,
        "recipe": base / "evidence" / f"{seed}.recipe.json",
        "bundle": base / "bundle.json",
        "ir": base / "evidence" / "sketch-ir.json",
        "live_current": base / "evidence" / "live-run-current",
    }


def seed_source_files(seed: str) -> list[str]:
    paths = seed_paths(seed)
    candidates = [
        rel(paths["base"] / "manifest.json"),
        rel(paths["bundle"]),
        rel(paths["recipe"]),
        rel(paths["ir"]),
        *rel_files_under(paths["base"] / "source"),
    ]
    return existing_rel_files(candidates)


def target_spec_files(seed: str) -> list[str]:
    candidates = [
        f"spec/generated/{seed}-required-features.json",
        f"spec/target-house/{seed}-acceptance-checklist.md",
        f"spec/target-house/{seed}-bim-information-requirements.md",
        f"spec/target-house/{seed}-capability-map.md",
        f"spec/target-house/{seed}-no-seed-readiness-packet.md",
        f"spec/target-house/{seed}-phase-plan.md",
        f"spec/target-house/{seed}-risk-register.md",
        f"spec/target-house/{seed}-sketch-ir.draft.json",
        "spec/target-house/target-house-seed.md",
    ]
    return existing_rel_files(candidates)


def extract_seed_model_id(output: str, seed: str) -> str | None:
    for line in output.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{seed}:"):
            match = UUID_RE.search(stripped)
            if match:
                return match.group(0)
    matches = UUID_RE.findall(output)
    return matches[-1] if matches else None


def cmd_doctor(args: argparse.Namespace) -> None:
    base_url = args.base_url.rstrip("/")
    web_url = args.web_url.rstrip("/")
    checks: dict[str, Any] = {
        "repo": str(ROOT),
        "gitHead": git_head(),
        "apiHealth": http_probe(f"{base_url}/api/health"),
        "web": http_probe(web_url),
        "files": {
            "methodology": (ROOT / "spec/methodology/sketch-to-bim-methodology.md").is_file(),
            "tracker": (ROOT / "spec/archive/sketch-to-bim-process-audit-tracker.md").is_file(),
            "capabilityMatrix": (ROOT / DEFAULT_CAPABILITIES).is_file(),
            "rendererSupportMatrix": (ROOT / DEFAULT_RENDERER_SUPPORT_MATRIX).is_file(),
            "skill": (ROOT / "claude-skills/sketch-to-bim/SKILL.md").is_file(),
        },
    }
    if args.model:
        env = os.environ.copy()
        env["BIM_AI_MODEL_ID"] = args.model
        env["BIM_AI_BASE_URL"] = base_url
        proc = run(
            [*CLI, "advisor", "--output", "json", "--severity", "warning"], env=env, check=False
        )
        checks["advisorWarnings"] = {
            "ok": proc.returncode == 0,
            "exitCode": proc.returncode,
            "json": parse_optional_json(proc.stdout),
        }
    checks["filesOk"] = all(checks["files"].values())
    checks["apiOk"] = bool(checks["apiHealth"].get("ok"))
    checks["webOk"] = bool(checks["web"].get("ok"))
    checks["liveOk"] = bool(checks["apiOk"] and checks["webOk"])
    checks["ok"] = bool(checks["filesOk"] and checks["liveOk"])
    if args.out:
        write_json((ROOT / args.out).resolve(), checks)
    print(json_dump(checks))
    if args.require_live and not checks["ok"]:
        raise SystemExit(2)


def cmd_tools(_args: argparse.Namespace) -> None:
    print(json_dump(read_json(TOOL_MANIFEST)))


def cmd_archetypes(args: argparse.Namespace) -> None:
    archetypes = read_json(ROOT / args.manifest)
    if args.query:
        q = args.query.lower()
        rows = []
        for row in archetypes.get("archetypes") or []:
            haystack = " ".join(
                [
                    str(row.get("id") or ""),
                    str(row.get("title") or ""),
                    " ".join(str(x) for x in (row.get("matchHints") or [])),
                ]
            ).lower()
            if q in haystack:
                rows.append(row)
        archetypes = {**archetypes, "archetypes": rows}
    print(json_dump(archetypes))


def parse_optional_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def advisory_code(v: dict[str, Any]) -> str:
    return str(v.get("advisoryClass") or v.get("ruleId") or v.get("code") or "unknown")


def advisor_groups_from_violations(violations: list[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[str, dict[str, Any]] = {}
    for violation in violations:
        severity = str(violation.get("severity") or "unknown")
        code = advisory_code(violation)
        key = f"{severity}:{code}"
        row = groups.setdefault(
            key,
            {
                "severity": severity,
                "code": code,
                "count": 0,
                "elementIds": set(),
                "messages": set(),
            },
        )
        row["count"] += 1
        for element_id in violation.get("elementIds") or []:
            row["elementIds"].add(str(element_id))
        message = violation.get("message")
        if message:
            row["messages"].add(str(message))

    severity_rank = {"error": 0, "warning": 1, "info": 2}
    grouped = [
        {
            "severity": row["severity"],
            "code": row["code"],
            "count": row["count"],
            "elementIds": sorted(row["elementIds"]),
            "messages": sorted(row["messages"])[:3],
        }
        for row in groups.values()
    ]
    grouped.sort(key=lambda row: (severity_rank.get(row["severity"], 9), row["code"]))
    return {"total": len(violations), "groups": grouped}


def load_advisor_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"total": 0, "groups": []}
    data = read_json(path)
    if isinstance(data, dict) and isinstance(data.get("payload"), dict):
        data = data["payload"]
    if isinstance(data, dict) and isinstance(data.get("groups"), list):
        return data
    if isinstance(data, dict) and isinstance(data.get("violations"), list):
        return advisor_groups_from_violations(data["violations"])
    return {"total": 0, "groups": []}


def normalized_advisor_groups(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for group in payload.get("groups") or []:
        rows.append(
            {
                "severity": str(group.get("severity") or "unknown"),
                "code": str(group.get("code") or "unknown"),
                "count": int(group.get("count") or 0),
                "elementIds": sorted(str(x) for x in (group.get("elementIds") or [])),
                "messages": sorted(str(x) for x in (group.get("messages") or [])),
            }
        )
    return sorted(rows, key=lambda row: (row["severity"], row["code"], row["elementIds"]))


def find_text_occurrences(path: Path | None, needles: list[str]) -> dict[str, list[int]]:
    if not path or not path.is_file():
        return {}
    lines = path.read_text(encoding="utf8").splitlines()
    out: dict[str, list[int]] = {}
    for needle in needles:
        if not needle:
            continue
        hits = [idx + 1 for idx, line in enumerate(lines) if needle in line]
        if hits:
            out[needle] = hits[:12]
    return out


def stable_id(prefix: str, payload: Any, length: int = 16) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return f"{prefix}-{hashlib.sha256(body.encode('utf8')).hexdigest()[:length]}"


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def as_str_list(value: Any) -> list[str]:
    return sorted({str(v) for v in as_list(value) if v is not None and str(v).strip()})


def commands_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict) and isinstance(payload.get("commands"), list):
        return [row for row in payload["commands"] if isinstance(row, dict)]
    return []


def load_commands(path: Path | None) -> list[dict[str, Any]]:
    if not path or not path.is_file():
        return []
    return commands_from_payload(read_json(path))


def command_mentioned_ids(command: dict[str, Any]) -> set[str]:
    ids: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, str) and value:
            ids.add(value)
        elif isinstance(value, list):
            for item in value:
                visit(item)
        elif isinstance(value, dict):
            for item in value.values():
                visit(item)

    for key, value in command.items():
        if key.lower().endswith("id") or key.lower().endswith("ids") or key == "id":
            visit(value)
    return ids


def command_matches_element(command: dict[str, Any], element_id: str) -> list[str]:
    matches: list[str] = []
    for key, value in command.items():
        if isinstance(value, str) and value == element_id:
            matches.append(key)
        elif isinstance(value, list) and element_id in [str(v) for v in value]:
            matches.append(key)
        elif isinstance(value, dict) and element_id in [str(v) for v in value.values()]:
            matches.append(key)
    return sorted(set(matches))


def command_refs_for_elements(
    commands: list[dict[str, Any]],
    element_ids: list[str],
    *,
    source: str,
    path: Path | None = None,
    transaction: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    for index, command in enumerate(commands):
        match_fields: dict[str, list[str]] = {}
        for element_id in element_ids:
            fields = command_matches_element(command, element_id)
            if fields:
                match_fields[element_id] = fields
        if not match_fields:
            continue
        command_id = str(command.get("id") or command.get("elementId") or f"{source}:{index}")
        row: dict[str, Any] = {
            "source": source,
            "commandIndex": index,
            "commandId": command_id,
            "commandType": command.get("type"),
            "matchedElementIds": sorted(match_fields),
            "matchFields": match_fields,
            "createsAffectedElement": any("id" in fields for fields in match_fields.values()),
        }
        if path is not None:
            row["path"] = rel(path)
            line_hits = find_text_occurrences(path, [command_id, *element_ids])
            if line_hits:
                row["lineHits"] = line_hits
        if transaction:
            row["transaction"] = transaction
        refs.append(row)
    refs.sort(
        key=lambda row: (
            0 if row.get("createsAffectedElement") else 1,
            str(row.get("source") or ""),
            int(row.get("commandIndex") or 0),
            str(row.get("commandId") or ""),
        )
    )
    return refs


def normalize_selector_token(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def selector_words(value: Any) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(value or "").lower())


def selector_word_matches(word: str, haystack: str) -> bool:
    synonyms = {
        "clad": ("clad", "cladded", "cladding"),
        "cladding": ("clad", "cladded", "cladding"),
        "envelope": ("envelope", "roof", "wall", "shell"),
        "orientation": ("orientation", "north", "base", "point"),
        "plinth": ("plinth", "base"),
        "site": ("site", "project", "base", "point"),
        "wrapper": ("wrapper", "shell"),
    }
    candidates = synonyms.get(word, (word,))
    return any(normalize_selector_token(candidate) in haystack for candidate in candidates)


def selector_token_matches(raw_value: str, element: dict[str, Any]) -> bool:
    selector_token = normalize_selector_token(raw_value)
    if not selector_token:
        return False
    haystack = normalize_selector_token(
        " ".join(
            str(element.get(key) or "")
            for key in ("id", "name", "kind", "typeId", "levelId", "hostId", "roomId")
        )
    )
    if selector_token in haystack:
        return True
    words = [
        word
        for word in selector_words(raw_value)
        if word not in {"and", "the", "a", "an", "feature", "kind"}
    ]
    if len(words) < 2:
        return False
    return all(selector_word_matches(word, haystack) for word in words)


def snapshot_elements_for_seed(seed: str | None) -> list[dict[str, Any]]:
    if not seed:
        return []
    snapshot = ROOT / "seed-artifacts" / seed / "evidence" / "live-run-current" / "snapshot.json"
    if not snapshot.is_file():
        return []
    payload = read_json(snapshot)
    elements = payload.get("elements") if isinstance(payload, dict) else []
    if isinstance(elements, dict):
        values = elements.values()
    elif isinstance(elements, list):
        values = elements
    else:
        values = []
    return [element for element in values if isinstance(element, dict) and element.get("id")]


def selector_kind_candidates(kind: str) -> set[str]:
    aliases = {
        "opening": {"wall_opening", "roof_opening", "slab_opening", "door", "window"},
        "view": {"view", "viewpoint", "plan_view", "elevation_view", "section_view", "section_cut"},
        "export": {"sheet", "schedule", "viewpoint", "plan_view", "elevation_view", "section_cut"},
        "evidence": {"viewpoint", "plan_view", "elevation_view", "section_cut", "sheet", "schedule"},
        "cladding": {"wall", "sweep", "material", "material_def"},
        "volume": {"wall", "floor", "roof", "mass", "sweep"},
        "feature": set(),
        "kind": set(),
    }
    return aliases.get(kind, {kind})


def selector_matches_element(selector: str, element: dict[str, Any]) -> bool:
    if ":" not in selector:
        token = normalize_selector_token(selector)
        haystack = normalize_selector_token(
            " ".join(str(element.get(key) or "") for key in ("id", "name", "kind", "typeId"))
        )
        return bool(token and token in haystack)
    prefix, raw_value = selector.split(":", 1)
    prefix = prefix.strip().lower()
    value = raw_value.strip().lower()
    kinds = selector_kind_candidates(prefix)
    if kinds and str(element.get("kind") or "").lower() not in kinds:
        return False
    if value in {"", "*"}:
        return bool(kinds)
    return selector_token_matches(value, element)


def resolve_feature_element_ids(feature: dict[str, Any], elements: list[dict[str, Any]]) -> list[str]:
    explicit = as_str_list(
        feature.get("requiredElementIds") or feature.get("elementIds") or feature.get("bimElementIds")
    )
    if explicit:
        return sorted(set(explicit))
    resolved: set[str] = set()
    for selector in as_str_list(feature.get("semanticSelectors")):
        for element in elements:
            if selector_matches_element(selector, element):
                resolved.add(str(element["id"]))
    return sorted(resolved)


def command_log_refs(path: Path | None, element_ids: list[str]) -> list[dict[str, Any]]:
    if not path or not path.is_file():
        return []
    payload = read_json(path)
    entries = payload.get("entries") if isinstance(payload, dict) else []
    refs: list[dict[str, Any]] = []
    for entry_index, entry in enumerate(entries or []):
        if not isinstance(entry, dict):
            continue
        commands = commands_from_payload(entry.get("appliedCommands") or [])
        tx = {
            "entryIndex": entry_index,
            "id": entry.get("id"),
            "revisionAfter": entry.get("revisionAfter"),
            "createdAt": entry.get("createdAt"),
            "userId": entry.get("userId"),
        }
        refs.extend(
            command_refs_for_elements(
                commands,
                element_ids,
                source="command-log",
                path=path,
                transaction=tx,
            )
        )
    return refs


def normalize_advisor_findings(payload: dict[str, Any], source: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for group in payload.get("groups") or []:
        if not isinstance(group, dict):
            continue
        severity = str(group.get("severity") or source.split("-")[-1] or "unknown")
        code = str(group.get("code") or "unknown")
        element_ids = as_str_list(group.get("elementIds"))
        messages = as_str_list(group.get("messages"))
        body = {
            "source": source,
            "severity": severity,
            "code": code,
            "elementIds": element_ids,
            "messages": messages,
        }
        findings.append(
            {
                "findingId": stable_id("finding", body),
                "source": source,
                "layer": "advisor",
                "severity": severity,
                "code": code,
                "count": int(group.get("count") or 0),
                "elementIds": element_ids,
                "messages": messages,
                "recommendation": group.get("recommendation") or group.get("recommendations"),
                "profile": group.get("profile") or payload.get("profile"),
                "raw": group,
            }
        )
    return findings


def constructability_body(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get("body"), dict):
        return payload["body"]
    return payload


def normalize_constructability_findings(payload: dict[str, Any]) -> list[dict[str, Any]]:
    body = constructability_body(payload)
    rows: list[dict[str, Any]] = []
    for key in ("findings", "issues"):
        for index, finding in enumerate(body.get(key) or []):
            if not isinstance(finding, dict):
                continue
            severity = str(finding.get("severity") or finding.get("level") or "unknown")
            code = str(
                finding.get("ruleId")
                or finding.get("code")
                or finding.get("advisoryClass")
                or finding.get("issueClass")
                or "constructability"
            )
            element_ids = as_str_list(
                finding.get("elementIds")
                or finding.get("affectedElementIds")
                or finding.get("targetElementIds")
            )
            message = (
                finding.get("message")
                or finding.get("summary")
                or finding.get("title")
                or "Constructability finding reported."
            )
            body_for_id = {
                "source": f"constructability-{key}",
                "index": index,
                "severity": severity,
                "code": code,
                "elementIds": element_ids,
                "message": message,
            }
            rows.append(
                {
                    "findingId": stable_id("finding", body_for_id),
                    "source": f"constructability-{key}",
                    "layer": "constructability",
                    "severity": severity,
                    "code": code,
                    "count": 1,
                    "elementIds": element_ids,
                    "messages": [str(message)],
                    "recommendation": finding.get("recommendation") or finding.get("remediation"),
                    "profile": body.get("profile"),
                    "raw": finding,
                }
            )
    return rows


def finding_next_actions(
    finding: dict[str, Any],
    *,
    has_source_commands: bool,
    phase: str | None,
    evidence_dir: Path,
) -> list[dict[str, Any]]:
    severity = str(finding.get("severity") or "unknown")
    code = str(finding.get("code") or "unknown")
    elements = as_str_list(finding.get("elementIds"))
    phase_text = f" phase {phase}" if phase else ""
    actions = [
        {
            "kind": "inspect-finding-context",
            "priority": "high" if severity in BLOCKING_SEVERITIES else "normal",
            "description": (
                f"Inspect {code} against affected elements {', '.join(elements) or '(none)'} "
                "using snapshot/query output and the matching evidence views."
            ),
        }
    ]
    if has_source_commands:
        actions.append(
            {
                "kind": "edit-source-authoring",
                "priority": "high" if severity in BLOCKING_SEVERITIES else "normal",
                "description": (
                    "Edit the referenced recipe or bundle command rather than patching only "
                    "the live model, then recompile/reseed the phase."
                ),
            }
        )
    else:
        actions.append(
            {
                "kind": "recover-source-lineage",
                "priority": "high" if severity in BLOCKING_SEVERITIES else "normal",
                "description": (
                    "No authoring command matched the affected element ids; fetch command-log "
                    "or add explicit source provenance before accepting this finding."
                ),
            }
        )
    code_actions = {
        "room_target_area_mismatch": "Adjust the room outline from the source sketch/programme, or correct targetAreaM2 only if the target was an agent assumption.",
        "room_unenclosed": "Repair physical wall/room-separation boundaries and rerun room derivation evidence.",
        "room_boundary_open": "Close the real boundary with architectural walls/openings; avoid universal room-separation rectangles.",
        "room_no_door": "Add or rehost a valid physical access door/opening on the room boundary.",
        "door_operation_clearance_conflict": "Move or resize the door/opening or nearby obstruction so the operation zone is clear.",
        "stair_comfort_eu_proxy": "Adjust stair riser/tread/landing geometry and confirm slab opening alignment.",
    }
    if code in code_actions:
        actions.append(
            {
                "kind": "domain-fix-hint",
                "priority": "high",
                "description": code_actions[code],
            }
        )
    actions.append(
        {
            "kind": "verify-loop",
            "priority": "high" if severity in BLOCKING_SEVERITIES else "normal",
            "description": (
                f"After correction, rerun Advisor/constructability evidence for{phase_text} and "
                f"regenerate {rel(evidence_dir / 'agent-loop-packet.json')}."
            ),
        }
    )
    return actions


def screenshot_rows_from_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    data = read_json(path)
    rows = data.get("screenshots") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        return []
    normalized = []
    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        screenshot = row.get("path") or row.get("file") or row.get("screenshotPath")
        normalized.append(
            {
                "id": str(
                    row.get("id") or row.get("viewId") or row.get("name") or f"view-{idx + 1}"
                ),
                "label": str(
                    row.get("label") or row.get("name") or row.get("viewId") or f"View {idx + 1}"
                ),
                "screenshot": screenshot,
            }
        )
    return normalized


def feature_rows_from_payload(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    rows = payload.get("requiredFeatures") or payload.get("features") or []
    return [row for row in rows if isinstance(row, dict)]


def phase_matches_feature(feature: dict[str, Any], phase: str | None) -> bool:
    if not phase:
        return True
    wanted = str(phase).lower().replace("phase-", "")
    if wanted in {"all", "p-all", "p1-p7-all", "p1-p8-all"}:
        return True
    values = [
        feature.get("phase"),
        feature.get("phaseId"),
        feature.get("phaseName"),
        feature.get("phaseGroup"),
    ]
    normalized_values = [str(value).lower().replace("phase-", "") for value in values if value]
    if wanted in normalized_values:
        return True
    range_match = re.fullmatch(r"p?(\d+)-p?(\d+)(?:-all)?", wanted)
    if range_match:
        start, end = (int(range_match.group(1)), int(range_match.group(2)))
        if start > end:
            start, end = end, start
        for value in normalized_values:
            value_match = re.fullmatch(r"p?(\d+)", value)
            if value_match and start <= int(value_match.group(1)) <= end:
                return True
    return False


def normalize_assumption(row: Any, *, source: str, index: int, phase: str | None) -> dict[str, Any]:
    if not isinstance(row, dict):
        row = {"assumption": str(row)}
    assumption_id = str(row.get("id") or row.get("key") or stable_id("assumption", row, 10))
    source_refs = as_str_list(
        row.get("sourceRefs")
        or row.get("sources")
        or row.get("source")
        or row.get("evidence")
        or row.get("sketchRef")
        or row.get("sketchRefs")
    )
    if not source_refs and source and source != "bundle":
        source_refs = [source]
    feature_refs = as_str_list(
        row.get("featureIds")
        or row.get("featureId")
        or row.get("features")
        or row.get("scope")
        or row.get("scopes")
    )
    status = str(row.get("status") or row.get("disposition") or "recorded")
    return {
        "id": assumption_id,
        "source": source,
        "sourceIndex": index,
        "phase": row.get("phase") or row.get("phaseId") or phase,
        "text": (
            row.get("assumption")
            or row.get("text")
            or row.get("description")
            or row.get("statement")
            or row.get("value")
            or ""
        ),
        "confidence": row.get("confidence"),
        "contestable": bool(row.get("contestable", True)),
        "sourceRefs": source_refs,
        "featureRefs": feature_refs,
        "status": status,
        "resolution": row.get("resolution") or row.get("rationale") or row.get("validation") or "",
        "raw": row,
    }


def assumptions_from_payload(payload: Any, *, source: str, phase: str | None) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    rows = payload.get("assumptions")
    if not isinstance(rows, list):
        return []
    return [
        normalize_assumption(row, source=source, index=index, phase=phase)
        for index, row in enumerate(rows)
    ]


def phase_dir_for(args: argparse.Namespace) -> Path:
    if args.dir:
        return Path(args.dir).resolve()
    if not args.seed:
        raise SystemExit("--dir or --seed is required.")
    phase = str(args.phase).strip()
    if not phase:
        raise SystemExit("--phase is required.")
    return (ROOT / "seed-artifacts" / args.seed / "evidence" / f"phase-{phase}").resolve()


def cmd_compile(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed)
    recipe = Path(args.recipe) if args.recipe else paths["recipe"]
    bundle = Path(args.bundle) if args.bundle else paths["bundle"]
    run([*CLI, "seed-dsl", "compile", "--recipe", rel(recipe), "--out", rel(bundle)])
    print(json_dump({"seed": args.seed, "recipe": rel(recipe), "bundle": rel(bundle)}))


def cmd_seed(args: argparse.Namespace) -> None:
    if args.clear:
        run(["make", "seed-clear"])
    proc = run(["make", "seed", f"name={args.seed}"])
    model_id = extract_seed_model_id(proc.stdout, args.seed)
    result = {"seed": args.seed, "modelId": model_id}
    print(json_dump(result))
    if args.out:
        write_json((ROOT / args.out).resolve(), result)
    if not model_id:
        raise SystemExit("Could not detect seeded model id from make seed output.")


def cmd_advisor(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("advisor requires --model or BIM_AI_MODEL_ID.")
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model
    env["BIM_AI_BASE_URL"] = args.base_url.rstrip("/")
    out_dir = Path(args.out).resolve() if args.out else None
    results: dict[str, Any] = {"modelId": model}
    for severity in ("warning", "info"):
        proc = run(
            [*CLI, "advisor", "--output", "json", "--severity", severity], env=env, check=False
        )
        parsed = parse_optional_json(proc.stdout)
        results[severity] = {"exitCode": proc.returncode, "payload": parsed}
        if out_dir:
            write_json(out_dir / f"advisor-{severity}.json", parsed or {"raw": proc.stdout})
    print(json_dump(results))
    warning_total = int(((results.get("warning") or {}).get("payload") or {}).get("total") or 0)
    if args.fail_on_warning and warning_total > 0:
        raise SystemExit(3)


def cmd_evidence_collect(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("evidence-collect requires --model or BIM_AI_MODEL_ID.")
    out_dir = Path(args.out).resolve() if args.out else phase_dir_for(args)
    command = [
        *CLI,
        "sketch",
        "evidence",
        "collect",
        "--model",
        model,
        "--out",
        rel(out_dir),
        "--profile",
        args.profile,
    ]
    if args.ir:
        command.extend(["--ir", args.ir])
    if args.phase:
        command.extend(["--phase", args.phase])
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model
    env["BIM_AI_BASE_URL"] = args.base_url.rstrip("/")
    proc = run(command, env=env, check=False)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def cmd_phase_run(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("phase-run requires --model or BIM_AI_MODEL_ID.")
    command = [
        *CLI,
        "sketch",
        "phase",
        "run",
        "--model",
        model,
        "--ir",
        args.ir,
        "--phase",
        args.phase,
    ]
    if args.phase_plan:
        command.extend(["--phase-plan", args.phase_plan])
    if args.recipe:
        command.extend(["--recipe", args.recipe])
    if args.bundle:
        command.extend(["--bundle", args.bundle])
    if args.bundle_out:
        command.extend(["--bundle-out", args.bundle_out])
    if args.base is not None:
        command.extend(["--base", str(args.base)])
    command.append("--commit" if args.commit else "--dry-run")
    if args.mode:
        command.extend(["--mode", args.mode])
    if args.out:
        command.extend(["--out", args.out])
    if args.evidence_out:
        command.extend(["--evidence-out", args.evidence_out])
    if args.acceptance_out:
        command.extend(["--acceptance-out", args.acceptance_out])
    if args.capabilities:
        command.extend(["--capabilities", args.capabilities])
    if args.profile:
        command.extend(["--profile", args.profile])
    if args.features:
        command.extend(["--features", args.features])
    if args.fail_on_acceptance:
        command.append("--fail-on-acceptance")
    if args.fail_on_blocking_dispositions:
        command.append("--fail-on-blocking-dispositions")
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model
    env["BIM_AI_BASE_URL"] = args.base_url.rstrip("/")
    proc = run(command, env=env, check=False)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def cmd_constructability_report(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("constructability-report requires --model or BIM_AI_MODEL_ID.")
    base_url = args.base_url.rstrip("/")
    profile = args.profile.strip() or "construction_readiness"
    result = http_json(
        f"{base_url}/api/models/{model}/constructability-report?profile={profile}",
        timeout=args.timeout,
    )
    body = result.get("body") if isinstance(result, dict) else {}
    if args.out:
        write_json((ROOT / args.out).resolve(), body if isinstance(body, dict) else result)
    print(json_dump(result))
    summary = body.get("summary") if isinstance(body, dict) else {}
    severity_counts = summary.get("severityCounts") if isinstance(summary, dict) else {}
    error_count = int((severity_counts or {}).get("error") or 0)
    warning_count = int((severity_counts or {}).get("warning") or 0)
    if args.fail_on_error and error_count > 0:
        raise SystemExit(4)
    if args.fail_on_warning and warning_count > 0:
        raise SystemExit(3)


def cmd_advisor_parity(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("advisor-parity requires --model or BIM_AI_MODEL_ID.")
    base_url = args.base_url.rstrip("/")
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model
    env["BIM_AI_BASE_URL"] = base_url
    cli_proc = run([*CLI, "advisor", "--output", "json"], env=env, check=False)
    cli_payload = parse_optional_json(cli_proc.stdout) or {"total": 0, "groups": []}
    snap = http_json(f"{base_url}/api/models/{model}/snapshot")
    body = snap.get("body") if isinstance(snap, dict) else {}
    violations = body.get("violations") if isinstance(body, dict) else []
    if not isinstance(violations, list):
        violations = []
    ui_payload = advisor_groups_from_violations([v for v in violations if isinstance(v, dict)])
    ui_payload["modelId"] = body.get("modelId") if isinstance(body, dict) else model
    ui_payload["revision"] = body.get("revision") if isinstance(body, dict) else None
    cli_groups = normalized_advisor_groups(cli_payload)
    ui_groups = normalized_advisor_groups(ui_payload)
    result = {
        "schemaVersion": "sketch-to-bim.advisor-parity.v1",
        "modelId": model,
        "source": "snapshot-violations-vs-cli-advisor",
        "note": "AdvisorPanel renders snapshot violations after client-side perspective filtering; this compares the unfiltered right-rail source payload with CLI grouping.",
        "ok": cli_groups == ui_groups,
        "cli": cli_payload,
        "rightRailSource": ui_payload,
    }
    if args.out:
        write_json(Path(args.out).resolve(), result)
    print(json_dump(result))
    if args.fail_on_mismatch and not result["ok"]:
        raise SystemExit(5)


def cmd_browser_evidence(args: argparse.Namespace) -> None:
    out_dir = Path(args.out).resolve() if args.out else phase_dir_for(args)
    command = [
        "node",
        "packages/web/scripts/capture-skb-browser-evidence.mjs",
        "--url",
        args.web_url.rstrip("/"),
        "--out",
        rel(out_dir),
    ]
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if model:
        command.extend(["--model", model])
    if args.timeout_ms:
        command.extend(["--timeout-ms", str(args.timeout_ms)])
    if args.view_pattern:
        command.extend(["--view-pattern", args.view_pattern])
    run(command)


def cmd_semantic_checklist(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    manifest = (
        Path(args.manifest).resolve() if args.manifest else out_dir / "screenshot-manifest.json"
    )
    rows = screenshot_rows_from_manifest(manifest)
    if not rows:
        rows = [
            {"id": "main", "label": "Main sketch-matched view", "screenshot": None},
            {"id": "front", "label": "Front/elevation view", "screenshot": None},
            {"id": "plan", "label": "Plan diagnostic view", "screenshot": None},
        ]
    checks = []
    default_criteria = [
        "Silhouette and volume hierarchy match the sketch.",
        "Roof, openings, terraces/loggias, stairs, and other visible special features render as real geometry.",
        "Materials and facade zones match the visual intent.",
        "Rooms, access, and interior programme are usable for project initiation.",
        "No visual issue contradicts Advisor acceptance.",
    ]
    for row in rows:
        checks.append(
            {
                "viewId": row["id"],
                "label": row["label"],
                "screenshot": row["screenshot"],
                "criteria": default_criteria,
                "verdict": "pending",
                "notes": "",
            }
        )
    payload = {
        "schemaVersion": "sketch-to-bim.semantic-checklist.v1",
        "phase": args.phase,
        "seed": args.seed,
        "manifest": rel(manifest),
        "checks": checks,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "semantic-checklist.json"
    write_json(output, payload)
    print(json_dump({"semanticChecklist": rel(output), "checkCount": len(checks)}))


def cmd_issue_ledger(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    paths = seed_paths(args.seed) if args.seed else {}
    recipe = Path(args.recipe).resolve() if args.recipe else paths.get("recipe")
    bundle = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    warning = load_advisor_file(
        Path(args.advisor_warning).resolve()
        if args.advisor_warning
        else out_dir / "advisor-warning.json"
    )
    info = load_advisor_file(
        Path(args.advisor_info).resolve() if args.advisor_info else out_dir / "advisor-info.json"
    )
    bundle_commands = load_commands(bundle)
    entries = []
    for severity, payload in (("warning", warning), ("info", info)):
        for group in payload.get("groups") or []:
            ids = [str(x) for x in group.get("elementIds") or []]
            command_refs = command_refs_for_elements(
                bundle_commands,
                ids,
                source="bundle",
                path=bundle,
            )
            entries.append(
                {
                    "severity": severity,
                    "code": group.get("code"),
                    "count": group.get("count"),
                    "elementIds": ids,
                    "messages": group.get("messages") or [],
                    "recipeMatches": find_text_occurrences(recipe, ids) if recipe else {},
                    "bundleMatches": find_text_occurrences(bundle, ids) if bundle else {},
                    "sourceCommands": command_refs,
                    "nextActions": finding_next_actions(
                        {
                            "severity": severity,
                            "code": group.get("code"),
                            "elementIds": ids,
                        },
                        has_source_commands=bool(command_refs),
                        phase=args.phase,
                        evidence_dir=out_dir,
                    ),
                    "status": "pending" if severity in BLOCKING_SEVERITIES else "reviewed",
                    "disposition": "unclassified" if severity in BLOCKING_SEVERITIES else "reviewed",
                    "sourceEdit": "",
                    "toleranceRationale": "",
                }
            )
    payload = {
        "schemaVersion": "sketch-to-bim.issue-ledger.v1",
        "phase": args.phase,
        "seed": args.seed,
        "recipe": rel(recipe) if recipe else None,
        "bundle": rel(bundle) if bundle else None,
        "entries": entries,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "issue-ledger.json"
    write_json(output, payload)
    print(json_dump({"issueLedger": rel(output), "entryCount": len(entries)}))
    pending_blockers = [
        e for e in entries if e["severity"] in BLOCKING_SEVERITIES and e["status"] == "pending"
    ]
    if args.fail_on_pending and pending_blockers:
        raise SystemExit(6)


def build_agent_loop_packet(args: argparse.Namespace) -> dict[str, Any]:
    out_dir = phase_dir_for(args)
    paths = seed_paths(args.seed) if args.seed else {}
    recipe = Path(args.recipe).resolve() if args.recipe else paths.get("recipe")
    bundle = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    phase_packet = (
        Path(args.phase_packet).resolve() if args.phase_packet else out_dir / "phase-packet.json"
    )
    constructability_path = (
        Path(args.constructability_report).resolve()
        if args.constructability_report
        else out_dir / "constructability-report.json"
    )
    command_log_path = Path(args.command_log).resolve() if args.command_log else None

    advisor_sources = [
        ("advisor-error", out_dir / "advisor-error.json"),
        ("advisor-warning", out_dir / "advisor-warning.json"),
        ("advisor-info", out_dir / "advisor-info.json"),
    ]
    if args.advisor:
        advisor_sources = [("advisor", Path(args.advisor).resolve())]

    findings_by_id: dict[str, dict[str, Any]] = {}
    for source, path in advisor_sources:
        if not path.is_file():
            continue
        for finding in normalize_advisor_findings(load_advisor_file(path), source):
            findings_by_id.setdefault(finding["findingId"], finding)

    if constructability_path.is_file():
        for finding in normalize_constructability_findings(read_json(constructability_path)):
            findings_by_id.setdefault(finding["findingId"], finding)

    bundle_commands = load_commands(bundle)
    findings: list[dict[str, Any]] = []
    for finding in sorted(
        findings_by_id.values(),
        key=lambda row: (
            {"error": 0, "warning": 1, "info": 2}.get(str(row.get("severity")), 9),
            str(row.get("code") or ""),
            str(row.get("findingId") or ""),
        ),
    ):
        element_ids = as_str_list(finding.get("elementIds"))
        bundle_refs = command_refs_for_elements(
            bundle_commands,
            element_ids,
            source="bundle",
            path=bundle,
        )
        live_refs = command_log_refs(command_log_path, element_ids)
        recipe_hits = find_text_occurrences(recipe, [*element_ids, str(finding.get("code") or "")])
        source_commands = [*bundle_refs, *live_refs]
        finding_row = {
            **finding,
            "sourceCommands": source_commands,
            "recipeLineHits": recipe_hits,
            "bundleLineHits": find_text_occurrences(
                bundle, [*element_ids, str(finding.get("code") or "")]
            ),
            "phaseOwnership": {
                "phase": args.phase,
                "phasePacket": rel(phase_packet) if phase_packet.is_file() else None,
                "status": "current-phase-review-required"
                if finding.get("severity") in BLOCKING_SEVERITIES
                else "review-required",
            },
            "nextActions": finding_next_actions(
                finding,
                has_source_commands=bool(source_commands),
                phase=args.phase,
                evidence_dir=out_dir,
            ),
        }
        findings.append(finding_row)

    severity_counts: dict[str, int] = {}
    untraced_count = 0
    for finding in findings:
        severity = str(finding.get("severity") or "unknown")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
        if not finding.get("sourceCommands"):
            untraced_count += 1

    packet = {
        "schemaVersion": "sketch-to-bim.agent-loop-packet.v1",
        "seed": args.seed,
        "phase": args.phase,
        "generatedAtEpochMs": int(time.time() * 1000),
        "gitHead": git_head(),
        "inputs": {
            "recipe": rel(recipe) if recipe else None,
            "bundle": rel(bundle) if bundle else None,
            "commandLog": rel(command_log_path) if command_log_path else None,
            "constructabilityReport": rel(constructability_path)
            if constructability_path.is_file()
            else None,
            "phasePacket": rel(phase_packet) if phase_packet.is_file() else None,
            "evidenceDir": rel(out_dir),
        },
        "summary": {
            "findingCount": len(findings),
            "severityCounts": severity_counts,
            "tracedFindingCount": len(findings) - untraced_count,
            "untracedFindingCount": untraced_count,
            "blockingFindingCount": sum(
                1 for finding in findings if finding.get("severity") in BLOCKING_SEVERITIES
            ),
        },
        "findings": findings,
        "methodologyLoop": [
            "Read each finding reason, recommendation, profile, and affected element ids.",
            "Open the source command references before changing model state.",
            "Edit recipe/bundle source, dry-run or phase-run the correction, then commit only after dry-run passes.",
            "Recapture Advisor/constructability evidence and regenerate this packet before phase acceptance.",
            "If a finding is tolerated or a rule defect, record owner, expiry, rationale, and evidence links in finding-dispositions/tolerance ledger.",
        ],
    }
    return packet


def cmd_agent_loop_packet(args: argparse.Namespace) -> None:
    packet = build_agent_loop_packet(args)
    out_dir = phase_dir_for(args)
    output = Path(args.out).resolve() if args.out else out_dir / "agent-loop-packet.json"
    write_json(output, packet)
    print(json_dump({"agentLoopPacket": rel(output), **packet["summary"]}))
    if args.fail_on_untraced and packet["summary"]["untracedFindingCount"] > 0:
        raise SystemExit(9)


def cmd_assumption_ledger(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    paths = seed_paths(args.seed) if args.seed else {}
    ir_path = Path(args.ir).resolve() if args.ir else paths.get("ir")
    bundle_path = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    recipe_path = Path(args.recipe).resolve() if args.recipe else paths.get("recipe")
    sources = []
    for label, candidate in (("ir", ir_path), ("recipe", recipe_path), ("bundle", bundle_path)):
        if candidate and candidate.is_file():
            sources.append((label, candidate, read_json(candidate)))

    entries: list[dict[str, Any]] = []
    for label, path, payload in sources:
        for entry in assumptions_from_payload(payload, source=rel(path) or label, phase=args.phase):
            entries.append(entry)

    seen: set[str] = set()
    deduped = []
    for entry in entries:
        key = f"{entry['id']}:{entry['source']}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)

    incomplete = [
        {
            "id": entry["id"],
            "source": entry["source"],
            "reason": "missing_source_refs" if not entry["sourceRefs"] else "missing_text",
        }
        for entry in deduped
        if not entry["text"] or not entry["sourceRefs"]
    ]
    unresolved_contestable = [
        {
            "id": entry["id"],
            "source": entry["source"],
            "status": entry["status"],
        }
        for entry in deduped
        if entry["contestable"]
        and entry["status"] in {"pending", "unresolved", "blocked", "unclassified"}
    ]
    payload = {
        "schemaVersion": "sketch-to-bim.assumption-ledger.v1",
        "seed": args.seed,
        "phase": args.phase,
        "generatedAtEpochMs": int(time.time() * 1000),
        "gitHead": git_head(),
        "sources": [{"kind": label, "path": rel(path)} for label, path, _ in sources],
        "summary": {
            "assumptionCount": len(deduped),
            "incompleteAssumptionCount": len(incomplete),
            "unresolvedContestableCount": len(unresolved_contestable),
        },
        "ok": bool(deduped) and not incomplete and not unresolved_contestable,
        "assumptions": deduped,
        "incomplete": incomplete,
        "unresolvedContestable": unresolved_contestable,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "assumption-ledger.json"
    write_json(output, payload)
    print(json_dump({"assumptionLedger": rel(output), **payload["summary"], "ok": payload["ok"]}))
    if args.fail_on_incomplete and not payload["ok"]:
        raise SystemExit(10)


def cmd_source_feature_map(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    paths = seed_paths(args.seed) if args.seed else {}
    features_path = (
        Path(args.features).resolve()
        if args.features
        else ROOT / "spec" / "generated" / f"{args.seed}-required-features.json"
        if args.seed
        else None
    )
    bundle_path = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    if not features_path or not features_path.is_file():
        raise SystemExit("--features or --seed with spec/generated/<seed>-required-features.json is required.")
    if not bundle_path or not bundle_path.is_file():
        raise SystemExit("--bundle or --seed with bundle.json is required.")

    features_payload = read_json(features_path)
    bundle_commands = load_commands(bundle_path)
    snapshot_elements = snapshot_elements_for_seed(args.seed)
    rows = []
    missing = []
    for feature in feature_rows_from_payload(features_payload):
        if not phase_matches_feature(feature, args.phase):
            continue
        feature_id = str(feature.get("id") or feature.get("featureId") or "unknown-feature")
        element_ids = as_str_list(
            feature.get("requiredElementIds")
            or feature.get("elementIds")
            or feature.get("bimElementIds")
        )
        resolved_element_ids = resolve_feature_element_ids(feature, snapshot_elements)
        command_element_ids = sorted(set([*element_ids, *resolved_element_ids]))
        source_refs = as_str_list(feature.get("sourceRefs") or feature.get("sourceReferences"))
        command_refs = command_refs_for_elements(
            bundle_commands,
            command_element_ids,
            source="bundle",
            path=bundle_path,
        )
        status = "mapped"
        reasons = []
        if not source_refs:
            status = "incomplete"
            reasons.append("missing_source_refs")
        if element_ids and not command_refs:
            status = "incomplete"
            reasons.append("missing_command_refs")
        if not element_ids and not as_str_list(feature.get("semanticSelectors")):
            status = "incomplete"
            reasons.append("missing_bim_target")
        row = {
            "featureId": feature_id,
            "phase": feature.get("phase") or feature.get("phaseId") or args.phase,
            "priority": feature.get("priority"),
            "sourceRefs": source_refs,
            "requiredElementIds": element_ids,
            "resolvedElementIds": resolved_element_ids,
            "semanticSelectors": as_str_list(feature.get("semanticSelectors")),
            "requiredViewIds": as_str_list(feature.get("requiredViewIds")),
            "commandRefs": command_refs,
            "status": status,
            "incompleteReasons": reasons,
        }
        rows.append(row)
        if reasons:
            missing.append(
                {
                    "featureId": feature_id,
                    "reasons": reasons,
                    "requiredElementIds": element_ids,
                    "semanticSelectors": row["semanticSelectors"],
                }
            )

    payload = {
        "schemaVersion": "sketch-to-bim.source-feature-map.v1",
        "seed": args.seed,
        "phase": args.phase,
        "generatedAtEpochMs": int(time.time() * 1000),
        "gitHead": git_head(),
        "inputs": {
            "features": rel(features_path),
            "bundle": rel(bundle_path),
        },
        "summary": {
            "featureCount": len(rows),
            "mappedFeatureCount": sum(1 for row in rows if row["status"] == "mapped"),
            "incompleteFeatureCount": len(missing),
            "resolvedElementCoverageCount": sum(1 for row in rows if row["resolvedElementIds"]),
        },
        "ok": bool(rows) and not missing,
        "features": rows,
        "incomplete": missing,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "source-feature-map.json"
    write_json(output, payload)
    print(json_dump({"sourceFeatureMap": rel(output), **payload["summary"], "ok": payload["ok"]}))
    if args.fail_on_incomplete and not payload["ok"]:
        raise SystemExit(11)


def cmd_material_check(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed) if args.seed else {}
    recipe_path = Path(args.recipe).resolve() if args.recipe else paths.get("recipe")
    bundle_path = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    if not recipe_path or not recipe_path.is_file():
        raise SystemExit(
            "material-check requires --recipe or --seed with evidence/<seed>.recipe.json."
        )
    if not bundle_path or not bundle_path.is_file():
        raise SystemExit("material-check requires --bundle or --seed with bundle.json.")
    recipe = read_json(recipe_path)
    bundle = read_json(bundle_path)
    commands = bundle if isinstance(bundle, list) else bundle.get("commands") or []
    bundle_text = json_dump(commands)
    intents = recipe.get("materialIntent") or []
    assignments = recipe.get("materialAssignments") or []
    missing = []
    for row in intents:
        material_key = row.get("materialKey")
        if material_key and material_key not in bundle_text:
            missing.append(
                {
                    "kind": "intent_not_represented",
                    "materialKey": material_key,
                    "surface": row.get("surface"),
                }
            )
    for row in assignments:
        element_id = row.get("elementId")
        material_key = row.get("materialKey")
        if (
            element_id
            and material_key
            and (element_id not in bundle_text or material_key not in bundle_text)
        ):
            missing.append(
                {
                    "kind": "assignment_not_represented",
                    "elementId": element_id,
                    "materialKey": material_key,
                }
            )
    payload = {
        "schemaVersion": "sketch-to-bim.material-check.v1",
        "seed": args.seed,
        "recipe": rel(recipe_path),
        "bundle": rel(bundle_path),
        "ok": not missing,
        "intentCount": len(intents),
        "assignmentCount": len(assignments),
        "missing": missing,
    }
    if args.out:
        write_json(Path(args.out).resolve(), payload)
    print(json_dump(payload))
    if args.fail_on_missing and missing:
        raise SystemExit(8)


def cmd_phase_accept(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    required = {
        "evidence-manifest": out_dir / "evidence-manifest.json",
        "advisor-warning": out_dir / "advisor-warning.json",
        "advisor-info": out_dir / "advisor-info.json",
        "advisor-error": out_dir / "advisor-error.json",
        "constructability-report": out_dir / "constructability-report.json",
        "integrity-diagnostics": out_dir / "integrity-diagnostics.json",
        "renderer-diagnostics": out_dir / "renderer-diagnostics.json",
        "export-validation": out_dir / "export-validation.json",
        "visual-evidence-contract": out_dir / "visual-evidence-contract.json",
        "finding-dispositions": out_dir / "finding-dispositions.json",
        "screenshot-manifest": out_dir / "screenshot-manifest.json",
        "semantic-checklist": out_dir / "semantic-checklist.json",
        "assumption-ledger": out_dir / "assumption-ledger.json",
        "source-feature-map": out_dir / "source-feature-map.json",
        "visual-readout": out_dir / "visual-readout.md",
        "corrections": out_dir / "corrections.md",
        "issue-ledger": out_dir / "issue-ledger.json",
        "agent-loop-packet": out_dir / "agent-loop-packet.json",
        "tolerance-ledger": out_dir / "tolerance-ledger.json",
    }
    missing = {name: rel(path) for name, path in required.items() if not path.is_file()}
    warning = load_advisor_file(required["advisor-warning"])
    info = load_advisor_file(required["advisor-info"])
    error = load_advisor_file(required["advisor-error"])
    warnings_total = int(warning.get("total") or 0)
    info_total = int(info.get("total") or 0)
    error_total = int(error.get("total") or 0)
    semantic_failures: list[dict[str, Any]] = []
    if required["semantic-checklist"].is_file():
        checklist = read_json(required["semantic-checklist"])
        for check in checklist.get("checks") or []:
            verdict = str(check.get("verdict") or "pending")
            if verdict not in {"pass", "accepted_tolerance"}:
                semantic_failures.append(
                    {
                        "viewId": check.get("viewId"),
                        "verdict": verdict,
                        "notes": check.get("notes") or "",
                    }
                )
    pending_issues: list[dict[str, Any]] = []
    if required["issue-ledger"].is_file():
        ledger = read_json(required["issue-ledger"])
        for entry in ledger.get("entries") or []:
            if str(entry.get("severity")) in BLOCKING_SEVERITIES and str(
                entry.get("status") or "pending"
            ) not in {"fixed", "tolerated", "software_rule_defect"}:
                pending_issues.append(
                    {
                        "severity": entry.get("severity"),
                        "code": entry.get("code"),
                        "elementIds": entry.get("elementIds") or [],
                        "status": entry.get("status") or "pending",
                    }
                )
    methodology_failures: list[dict[str, Any]] = []
    current_head = git_head()
    if required["evidence-manifest"].is_file():
        manifest = read_json(required["evidence-manifest"])
        head = manifest.get("currentHead") if isinstance(manifest, dict) else {}
        if not isinstance(head, dict):
            head = {}
        required_head_keys = [
            "gitHead",
            "modelRevision",
            "advisorRuleDigest",
            "irSha256",
            "capabilitiesSha256",
        ]
        for key in required_head_keys:
            if not head.get(key) and not manifest.get(key):
                methodology_failures.append(
                    {"gate": "current-phase-evidence", "code": f"{key}_missing"}
                )
        recorded_git = head.get("gitHead") or manifest.get("gitHead")
        if recorded_git and current_head and recorded_git != current_head:
            methodology_failures.append(
                {
                    "gate": "current-phase-evidence",
                    "code": "gitHead_stale",
                    "recorded": recorded_git,
                    "current": current_head,
                }
            )
    if required["screenshot-manifest"].is_file():
        screenshot_digest = file_sha256(required["screenshot-manifest"])
        if not screenshot_digest:
            methodology_failures.append(
                {"gate": "current-phase-evidence", "code": "screenshot_manifest_digest_missing"}
            )
    gate_files = {
        "integrity-diagnostics": required["integrity-diagnostics"],
        "renderer-diagnostics": required["renderer-diagnostics"],
        "export-validation": required["export-validation"],
        "assumption-ledger": required["assumption-ledger"],
        "source-feature-map": required["source-feature-map"],
        "tolerance-ledger": required["tolerance-ledger"],
    }
    for gate, path in gate_files.items():
        if not path.is_file():
            continue
        payload = read_json(path)
        if payload.get("ok") is False:
            methodology_failures.append({"gate": gate, "code": f"{gate}_failed"})
    if required["assumption-ledger"].is_file():
        ledger = read_json(required["assumption-ledger"])
        summary = ledger.get("summary") or {}
        if int(summary.get("assumptionCount") or 0) <= 0:
            methodology_failures.append({"gate": "assumption-ledger", "code": "assumptions_missing"})
        if int(summary.get("incompleteAssumptionCount") or 0) > 0:
            methodology_failures.append(
                {"gate": "assumption-ledger", "code": "assumptions_incomplete"}
            )
        if int(summary.get("unresolvedContestableCount") or 0) > 0:
            methodology_failures.append(
                {"gate": "assumption-ledger", "code": "contestable_assumptions_unresolved"}
            )
    if required["source-feature-map"].is_file():
        feature_map = read_json(required["source-feature-map"])
        summary = feature_map.get("summary") or {}
        if int(summary.get("featureCount") or 0) <= 0:
            methodology_failures.append({"gate": "source-feature-map", "code": "features_missing"})
        if int(summary.get("incompleteFeatureCount") or 0) > 0:
            methodology_failures.append(
                {"gate": "source-feature-map", "code": "source_feature_map_incomplete"}
            )
    if required["agent-loop-packet"].is_file():
        loop_packet = read_json(required["agent-loop-packet"])
        summary = loop_packet.get("summary") or {}
        if int(summary.get("blockingFindingCount") or 0) > 0 and int(
            summary.get("untracedFindingCount") or 0
        ) > 0:
            methodology_failures.append(
                {"gate": "finding-traceability", "code": "blocking_findings_untraced"}
            )
    finding_disposition_summary: dict[str, Any] = {
        "findingCount": 0,
        "countsBySeverity": {},
        "countsByDisposition": {},
        "unclassifiedBlocking": [],
        "blocked": [],
        "ok": False,
    }
    if required["finding-dispositions"].is_file():
        dispositions = read_json(required["finding-dispositions"])
        findings = dispositions.get("findings") if isinstance(dispositions, dict) else []
        if not isinstance(findings, list):
            findings = []
        counts_by_severity: dict[str, int] = {}
        counts_by_disposition: dict[str, int] = {}
        unclassified_blocking = []
        blocked = []
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            severity = str(finding.get("severity") or "unknown")
            disposition = str(finding.get("disposition") or finding.get("status") or "unclassified")
            counts_by_severity[severity] = counts_by_severity.get(severity, 0) + 1
            counts_by_disposition[disposition] = counts_by_disposition.get(disposition, 0) + 1
            row = {
                "source": finding.get("source"),
                "severity": severity,
                "code": finding.get("code"),
                "elementIds": finding.get("elementIds") or [],
                "disposition": disposition,
            }
            if severity in BLOCKING_SEVERITIES and disposition in {
                "unclassified",
                "fix-now",
                "fix-in-phase",
                "pending",
            }:
                unclassified_blocking.append(row)
            if severity in BLOCKING_SEVERITIES and disposition == "blocked":
                blocked.append(row)
        finding_disposition_summary = {
            "findingCount": len(findings),
            "countsBySeverity": counts_by_severity,
            "countsByDisposition": counts_by_disposition,
            "unclassifiedBlocking": unclassified_blocking,
            "blocked": blocked,
            "ok": not unclassified_blocking and not blocked,
        }
    parity_path = out_dir / "advisor-parity.json"
    parity_ok = True
    if args.require_parity:
        if not parity_path.is_file():
            missing["advisor-parity"] = rel(parity_path)
            parity_ok = False
        else:
            parity_ok = bool(read_json(parity_path).get("ok"))

    ok = (
        not missing
        and warnings_total == 0
        and error_total == 0
        and not semantic_failures
        and not pending_issues
        and not methodology_failures
        and finding_disposition_summary["ok"]
        and parity_ok
    )
    packet = {
        "schemaVersion": "sketch-to-bim.phase-packet.v1",
        "phase": args.phase,
        "seed": args.seed,
        "ok": ok,
        "generatedAtEpochMs": int(time.time() * 1000),
        "gitHead": git_head(),
        "files": {name: rel(path) for name, path in required.items()},
        "missing": missing,
        "advisorWarningTotal": warnings_total,
        "advisorInfoTotal": info_total,
        "advisorErrorTotal": error_total,
        "findingDispositions": finding_disposition_summary,
        "semanticFailures": semantic_failures,
        "pendingIssues": pending_issues,
        "methodologyFailures": methodology_failures,
        "advisorParityOk": parity_ok,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "phase-packet.json"
    write_json(output, packet)
    print(json_dump(packet))
    if not ok:
        raise SystemExit(7)


def cmd_accept(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed)
    if not args.no_compile:
        cmd_compile(argparse.Namespace(seed=args.seed, recipe=args.recipe, bundle=None))
    if args.clear:
        run(["make", "seed-clear"])
    seed_proc = run(["make", "seed", f"name={args.seed}"])
    model_id = args.model or extract_seed_model_id(seed_proc.stdout, args.seed)
    if not model_id:
        raise SystemExit("Could not detect model id; pass --model explicitly.")
    if args.require_live:
        doctor = http_probe(f"{args.base_url.rstrip('/')}/api/health")
        if not doctor.get("ok"):
            print(json_dump({"apiHealth": doctor}), file=sys.stderr)
            raise SystemExit("API is not reachable. Start make dev before acceptance.")

    out_dir = Path(args.out).resolve() if args.out else paths["live_current"]
    command = [
        *CLI,
        "initiation-run",
        "--ir",
        rel(Path(args.ir) if args.ir else paths["ir"]),
        "--capabilities",
        args.capabilities,
        "--model",
        model_id,
        "--mode",
        args.mode,
        "--fail-on-warning",
        "--fail-on-acceptance",
        "--out",
        rel(out_dir),
    ]
    if args.target_image:
        command.extend(["--target-image", args.target_image, "--fail-on-visual"])
    if args.target_map:
        command.extend(["--target-map", args.target_map, "--fail-on-visual"])
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model_id
    env["BIM_AI_BASE_URL"] = args.base_url.rstrip("/")
    run(command, env=env)
    evidence_manifest = out_dir / "live" / "evidence-manifest.json"
    model_revision = None
    if evidence_manifest.is_file():
        model_revision = read_json(evidence_manifest).get("revision")
    seed_files = seed_source_files(args.seed)
    spec_files = target_spec_files(args.seed)
    summary = {
        "schemaVersion": "sketch-to-bim.tool-run.v1",
        "seed": args.seed,
        "modelId": model_id,
        "modelRevision": model_revision,
        "gitHead": git_head(),
        "bundlePath": rel(paths["bundle"]),
        "bundleSha256": file_sha256(paths["bundle"]),
        "irPath": rel(paths["ir"]),
        "irSha256": file_sha256(paths["ir"]),
        "capabilitiesPath": args.capabilities,
        "capabilitiesSha256": file_sha256(ROOT / args.capabilities),
        "advisorRuleDigest": digest_files(ADVISOR_RULE_FILES),
        "advisorRuleFiles": ADVISOR_RULE_FILES,
        "rendererSupportMatrixPath": DEFAULT_RENDERER_SUPPORT_MATRIX,
        "rendererSupportMatrixSha256": file_sha256(ROOT / DEFAULT_RENDERER_SUPPORT_MATRIX),
        "seedSourceDigest": digest_files(seed_files),
        "seedSourceFiles": seed_files,
        "targetSpecDigest": digest_files(spec_files),
        "targetSpecFiles": spec_files,
        "mode": args.mode,
        "generatedAtEpochMs": int(time.time() * 1000),
    }
    write_json(out_dir / "tool-run-summary.json", summary)
    print(json_dump(summary))


def cmd_stale_check(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed)
    evidence = Path(args.evidence).resolve() if args.evidence else paths["live_current"]
    summary_path = evidence / "tool-run-summary.json"
    if not summary_path.is_file():
        raise SystemExit(f"Missing tool-run summary: {rel(summary_path)}")
    summary = read_json(summary_path)
    current = {
        "gitHead": git_head(),
        "modelRevision": current_model_revision(
            summary.get("modelId"), args.base_url.rstrip("/")
        ),
        "bundleSha256": file_sha256(paths["bundle"]),
        "irSha256": file_sha256(paths["ir"]),
        "capabilitiesSha256": file_sha256(
            ROOT / summary.get("capabilitiesPath", DEFAULT_CAPABILITIES)
        ),
        "advisorRuleDigest": digest_files(summary.get("advisorRuleFiles") or ADVISOR_RULE_FILES),
        "rendererSupportMatrixSha256": file_sha256(
            ROOT / summary.get("rendererSupportMatrixPath", DEFAULT_RENDERER_SUPPORT_MATRIX)
        ),
        "seedSourceDigest": digest_files(
            summary.get("seedSourceFiles") or seed_source_files(args.seed)
        ),
        "targetSpecDigest": digest_files(
            summary.get("targetSpecFiles") or target_spec_files(args.seed)
        ),
    }
    stale = {
        key: {"recorded": summary.get(key), "current": value}
        for key, value in current.items()
        if summary.get(key) != value or value is None
    }
    result = {"seed": args.seed, "evidence": rel(evidence), "stale": stale, "ok": not stale}
    print(json_dump(result))
    if stale:
        raise SystemExit(4)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sketch-to-BIM skill operational helper.")
    sub = parser.add_subparsers(dest="command", required=True)

    tools = sub.add_parser("tools", help="Print typed skill tool descriptors.")
    tools.set_defaults(func=cmd_tools)

    archetypes = sub.add_parser(
        "archetypes", help="Print reusable sketch-to-BIM archetype baselines."
    )
    archetypes.add_argument("--manifest", default=DEFAULT_ARCHETYPES)
    archetypes.add_argument("--query")
    archetypes.set_defaults(func=cmd_archetypes)

    doctor = sub.add_parser("doctor", help="Check live app/tool prerequisites.")
    doctor.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    doctor.add_argument(
        "--web-url", default=os.environ.get("BIM_AI_WEB_URL", "http://127.0.0.1:2000")
    )
    doctor.add_argument("--model")
    doctor.add_argument("--out")
    doctor.add_argument("--require-live", action="store_true")
    doctor.set_defaults(func=cmd_doctor)

    compile_cmd = sub.add_parser("compile", help="Compile seed DSL recipe to bundle.")
    compile_cmd.add_argument("--seed", required=True)
    compile_cmd.add_argument("--recipe")
    compile_cmd.add_argument("--bundle")
    compile_cmd.set_defaults(func=cmd_compile)

    seed_cmd = sub.add_parser("seed", help="Load a named seed artifact and print its model id.")
    seed_cmd.add_argument("--seed", required=True)
    seed_cmd.add_argument("--clear", action="store_true")
    seed_cmd.add_argument("--out")
    seed_cmd.set_defaults(func=cmd_seed)

    advisor = sub.add_parser("advisor", help="Capture warning and info Advisor payloads.")
    advisor.add_argument("--model")
    advisor.add_argument("--out")
    advisor.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    advisor.add_argument("--fail-on-warning", action="store_true")
    advisor.set_defaults(func=cmd_advisor)

    evidence = sub.add_parser(
        "evidence-collect",
        help="Collect product-owned non-browser evidence artifacts for a model/phase.",
    )
    evidence.add_argument("--model")
    evidence.add_argument("--phase")
    evidence.add_argument("--seed")
    evidence.add_argument("--dir")
    evidence.add_argument("--out")
    evidence.add_argument("--ir")
    evidence.add_argument("--profile", default="construction_readiness")
    evidence.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    evidence.set_defaults(func=cmd_evidence_collect)

    phase_run = sub.add_parser(
        "phase-run",
        help="Run one phase loop: apply bundle/recipe, collect evidence, and write acceptance.",
    )
    phase_run.add_argument("--model")
    phase_run.add_argument("--ir", required=True)
    phase_run.add_argument("--phase", required=True)
    phase_run.add_argument("--phase-plan")
    phase_run.add_argument("--recipe")
    phase_run.add_argument("--bundle")
    phase_run.add_argument("--bundle-out")
    phase_run.add_argument("--base", type=int)
    phase_run.add_argument("--mode", default="project_initiation_bim")
    phase_run.add_argument("--out")
    phase_run.add_argument("--evidence-out")
    phase_run.add_argument("--acceptance-out")
    phase_run.add_argument("--capabilities", default=DEFAULT_CAPABILITIES)
    phase_run.add_argument("--profile", default="construction_readiness")
    phase_run.add_argument("--features")
    phase_run.add_argument("--commit", action="store_true")
    phase_run.add_argument("--fail-on-acceptance", action="store_true")
    phase_run.add_argument("--fail-on-blocking-dispositions", action="store_true")
    phase_run.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    phase_run.set_defaults(func=cmd_phase_run)

    report = sub.add_parser(
        "constructability-report",
        help="Fetch the profile-specific server constructability report.",
    )
    report.add_argument("--model")
    report.add_argument("--profile", default="construction_readiness")
    report.add_argument("--out")
    report.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    report.add_argument("--timeout", type=float, default=5.0)
    report.add_argument("--fail-on-error", action="store_true")
    report.add_argument("--fail-on-warning", action="store_true")
    report.set_defaults(func=cmd_constructability_report)

    parity = sub.add_parser(
        "advisor-parity", help="Compare CLI Advisor groups with right-rail source payload."
    )
    parity.add_argument("--model")
    parity.add_argument("--out")
    parity.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    parity.add_argument("--fail-on-mismatch", action="store_true")
    parity.set_defaults(func=cmd_advisor_parity)

    browser = sub.add_parser(
        "browser-evidence", help="Capture browser/right-rail screenshots and review text."
    )
    browser.add_argument("--phase")
    browser.add_argument("--seed")
    browser.add_argument("--dir")
    browser.add_argument("--out")
    browser.add_argument("--model")
    browser.add_argument(
        "--web-url", default=os.environ.get("BIM_AI_WEB_URL", "http://127.0.0.1:2000")
    )
    browser.add_argument("--timeout-ms", type=int, default=30000)
    browser.add_argument("--view-pattern")
    browser.set_defaults(func=cmd_browser_evidence)

    semantic = sub.add_parser(
        "semantic-checklist", help="Create a required semantic screenshot review checklist."
    )
    semantic.add_argument("--phase", required=True)
    semantic.add_argument("--seed")
    semantic.add_argument("--dir")
    semantic.add_argument("--manifest")
    semantic.add_argument("--out")
    semantic.set_defaults(func=cmd_semantic_checklist)

    ledger = sub.add_parser(
        "issue-ledger", help="Map Advisor findings to recipe/bundle source references."
    )
    ledger.add_argument("--phase", required=True)
    ledger.add_argument("--seed")
    ledger.add_argument("--dir")
    ledger.add_argument("--recipe")
    ledger.add_argument("--bundle")
    ledger.add_argument("--advisor-warning")
    ledger.add_argument("--advisor-info")
    ledger.add_argument("--out")
    ledger.add_argument("--fail-on-pending", action="store_true")
    ledger.set_defaults(func=cmd_issue_ledger)

    loop_packet = sub.add_parser(
        "agent-loop-packet",
        help=(
            "Export an agent-readable Advisor/constructability loop packet with "
            "finding-to-command provenance and next actions."
        ),
    )
    loop_packet.add_argument("--phase", required=True)
    loop_packet.add_argument("--seed")
    loop_packet.add_argument("--dir")
    loop_packet.add_argument("--recipe")
    loop_packet.add_argument("--bundle")
    loop_packet.add_argument("--advisor")
    loop_packet.add_argument("--constructability-report")
    loop_packet.add_argument("--command-log")
    loop_packet.add_argument("--phase-packet")
    loop_packet.add_argument("--out")
    loop_packet.add_argument("--fail-on-untraced", action="store_true")
    loop_packet.set_defaults(func=cmd_agent_loop_packet)

    assumptions = sub.add_parser(
        "assumption-ledger",
        help="Write the phase assumption ledger from IR, recipe, and bundle inputs.",
    )
    assumptions.add_argument("--phase", required=True)
    assumptions.add_argument("--seed")
    assumptions.add_argument("--dir")
    assumptions.add_argument("--ir")
    assumptions.add_argument("--recipe")
    assumptions.add_argument("--bundle")
    assumptions.add_argument("--out")
    assumptions.add_argument("--fail-on-incomplete", action="store_true")
    assumptions.set_defaults(func=cmd_assumption_ledger)

    feature_map = sub.add_parser(
        "source-feature-map",
        help="Map required sketch features to source refs, BIM targets, and authoring commands.",
    )
    feature_map.add_argument("--phase", required=True)
    feature_map.add_argument("--seed")
    feature_map.add_argument("--dir")
    feature_map.add_argument("--features")
    feature_map.add_argument("--bundle")
    feature_map.add_argument("--out")
    feature_map.add_argument("--fail-on-incomplete", action="store_true")
    feature_map.set_defaults(func=cmd_source_feature_map)

    materials = sub.add_parser(
        "material-check", help="Verify recipe material intent is represented in the bundle."
    )
    materials.add_argument("--seed")
    materials.add_argument("--recipe")
    materials.add_argument("--bundle")
    materials.add_argument("--out")
    materials.add_argument("--fail-on-missing", action="store_true")
    materials.set_defaults(func=cmd_material_check)

    phase = sub.add_parser(
        "phase-accept", help="Fail unless the phase evidence packet is complete and clean."
    )
    phase.add_argument("--phase", required=True)
    phase.add_argument("--seed")
    phase.add_argument("--dir")
    phase.add_argument("--out")
    phase.add_argument("--require-parity", action="store_true")
    phase.set_defaults(func=cmd_phase_accept)

    accept = sub.add_parser("accept", help="Run strict current-HEAD live acceptance for a seed.")
    accept.add_argument("--seed", required=True)
    accept.add_argument("--model")
    accept.add_argument("--recipe")
    accept.add_argument("--ir")
    accept.add_argument("--out")
    accept.add_argument("--capabilities", default=DEFAULT_CAPABILITIES)
    accept.add_argument(
        "--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500")
    )
    accept.add_argument("--mode", default="project_initiation_bim")
    accept.add_argument("--target-image")
    accept.add_argument("--target-map")
    accept.add_argument("--clear", action="store_true")
    accept.add_argument("--no-compile", action="store_true")
    accept.add_argument("--no-require-live", dest="require_live", action="store_false")
    accept.set_defaults(func=cmd_accept, require_live=True)

    stale = sub.add_parser(
        "stale-check", help="Fail when accepted evidence does not match HEAD inputs."
    )
    stale.add_argument("--seed", required=True)
    stale.add_argument("--evidence")
    stale.add_argument("--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500"))
    stale.set_defaults(func=cmd_stale_check)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
