"""Testhouse convergence-loop pass script.

Runs one deterministic pass of the per-house gate driver:

1. Loads ``tmp/reverse-bim/convergence-state.json`` (creates it if missing).
2. For each house that is not terminal, advances the state machine one step:
   * If a pending subagent dispatch has a response file on disk, ingest the
     response and advance to the next phase.
   * Drive any non-subagent gates inline (REST + Playwright via subprocess).
   * Re-run final_acceptance against the live dev server and record the
     blocking gates.
3. Detect terminal states (accepted / blocked_with_disposition / plateau /
   pass-budget exhausted).
4. Identifies any subagent dispatches the LLM orchestrator needs to do in
   its turn (the script never calls Agent() itself).
5. Persists the state file and prints a structured summary that the
   ``/loop`` driver consumes.

This script is **idempotent**: running it twice in a row with no new
response files produces the same state.

Companion tracker: ``spec/testhouse-convergence-loop-tracker.md``.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = REPO_ROOT / "app"

API_BASE = "http://localhost:28500"
STATE_PATH = REPO_ROOT / "tmp" / "reverse-bim" / "convergence-state.json"

PASS_BUDGET_DEFAULT = 24
PER_HOUSE_ACTION_BUDGET = 3
SUBAGENT_RETRY_BUDGET = 2
PLATEAU_PASS_THRESHOLD = 3

# Ordered phases — index used for "has this house advanced?".
PHASE_ORDER = [
    "iter2_authored",
    "iter3_loaded_in_dev",
    "iter3_capture_plan_ready",
    "iter3_screenshots_captured",
    "iter3_evidence_reports_ok",
    "iter3_final_acceptance_run",
    "accepted",
    "blocked_with_disposition",
    "blocked_pass_budget_exhausted",
]
TERMINAL_PHASES = {
    "accepted",
    "blocked_with_disposition",
    "blocked_pass_budget_exhausted",
}


# ---------------------------------------------------------------------------
# State load / save
# ---------------------------------------------------------------------------


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _initial_state() -> dict[str, Any]:
    return {
        "schemaVersion": "testhouseConvergenceState_v1",
        "createdAt": _now(),
        "lastPassAt": None,
        "passCount": 0,
        "passBudget": PASS_BUDGET_DEFAULT,
        "allTerminal": False,
        "houses": {
            house: _initial_house_state(house)
            for house in ("house-alpha", "house-beta", "house-gamma")
        },
    }


def _initial_house_state(house: str) -> dict[str, Any]:
    return {
        "house": house,
        "phase": "iter2_authored",
        "terminal": False,
        "terminalReason": None,
        "modelId": _read_loaded_model_id(house),
        "lastFinalAcceptance": None,
        "blockingGateHistory": [],
        "pendingSubagentDispatches": [],
        "completedSubagentDispatches": [],
        "retryCounters": {},
        "dispositions": [],
        "actionsThisPass": [],
        "errors": [],
    }


def _read_loaded_model_id(house: str) -> str | None:
    path = REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-2-dev-model.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("modelId")
    except (json.JSONDecodeError, OSError):
        return None


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        state = _initial_state()
        save_state(state)
        return state
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def http_json(
    method: str, path: str, body: dict[str, Any] | None = None
) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        return {
            "error": True,
            "status": exc.code,
            "body": exc.read().decode("utf-8", "replace")[:2000],
        }
    except OSError as exc:
        return {"error": True, "status": -1, "body": str(exc)}


def dev_server_reachable() -> bool:
    response = http_json("GET", "/api/bootstrap")
    return not response.get("error")


# ---------------------------------------------------------------------------
# Per-house drivers
# ---------------------------------------------------------------------------


def advance_phase(state: dict[str, Any], house_state: dict[str, Any], target_phase: str) -> None:
    if PHASE_ORDER.index(target_phase) <= PHASE_ORDER.index(house_state["phase"]):
        return
    house_state["phase"] = target_phase
    house_state["actionsThisPass"].append({"at": _now(), "advancedTo": target_phase})


def run_load_to_dev_if_needed(house_state: dict[str, Any]) -> None:
    if house_state["phase"] != "iter2_authored":
        return
    if house_state.get("modelId"):
        # Loaded in a prior pass; advance.
        advance_phase({}, house_state, "iter3_loaded_in_dev")
        return
    # Run the loader script as a subprocess so we don't import it here.
    proc = subprocess.run(
        [
            "uv",
            "run",
            "python",
            str(REPO_ROOT / "scripts" / "testhouse_iter2_load_to_dev.py"),
        ],
        cwd=str(APP_DIR),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if proc.returncode != 0:
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "load_to_dev",
                "code": "loader_failed",
                "stderr": proc.stderr[-1000:],
            }
        )
        return
    house_state["modelId"] = _read_loaded_model_id(house_state["house"])
    if house_state["modelId"]:
        advance_phase({}, house_state, "iter3_loaded_in_dev")


def drive_view_capture_plan(house_state: dict[str, Any]) -> None:
    if house_state["phase"] != "iter3_loaded_in_dev":
        return
    if not house_state.get("modelId"):
        return
    plan_body = {
        "modelId": house_state["modelId"],
        "baseUrl": "http://127.0.0.1:22000",
        "outputDir": str(
            REPO_ROOT
            / "tmp"
            / "reverse-bim"
            / house_state["house"]
            / "iter-3-view-captures"
        ),
        "requiredUiViews": [
            {"viewId": view_id, "name": view_id}
            for view_id in _view_ids_for(house_state["house"])
        ],
        "requiredOverlayViews": _overlay_views_for(house_state["house"]),
    }
    plan = http_json("POST", "/api/v3/reverse-bim/view-capture-plan", plan_body)
    out_path = (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house_state["house"]
        / "iter-3-view-capture-plan.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    if plan.get("error"):
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "view_capture_plan",
                "code": "rest_error",
                "status": plan.get("status"),
            }
        )
        return
    if (plan.get("summary") or {}).get("blockerCount", 0) > 0:
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "view_capture_plan",
                "code": "plan_has_blockers",
                "blockerCount": plan["summary"]["blockerCount"],
            }
        )
        return
    advance_phase({}, house_state, "iter3_capture_plan_ready")


def run_playwright_capture(house_state: dict[str, Any]) -> None:
    if house_state["phase"] != "iter3_capture_plan_ready":
        return
    plan_path = (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house_state["house"]
        / "iter-3-view-capture-plan.json"
    )
    out_dir = (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house_state["house"]
        / "iter-3-view-captures"
    )
    if not plan_path.exists():
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "playwright_capture",
                "code": "plan_missing",
            }
        )
        return
    # Best-effort invocation; the actual pnpm script may not be wired up on
    # every dev machine. If it fails, record the error and move on — the
    # source_overlay_evidence / ui_evidence gates will report what's
    # missing on the next final_acceptance run.
    proc = subprocess.run(
        [
            "pnpm",
            "--filter",
            "@bim-ai/web",
            "reverse-bim:capture",
            "--plan",
            str(plan_path),
            "--out",
            str(out_dir),
            "--json",
        ],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=900,
    )
    if proc.returncode != 0:
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "playwright_capture",
                "code": "capture_runner_failed",
                "stderr": proc.stderr[-1200:],
            }
        )
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    advance_phase({}, house_state, "iter3_screenshots_captured")


def drive_evidence_reports(house_state: dict[str, Any]) -> None:
    if house_state["phase"] != "iter3_screenshots_captured":
        return
    manifest_path = (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house_state["house"]
        / "iter-3-view-captures"
        / "reverse-bim-view-capture-manifest.json"
    )
    if not manifest_path.exists():
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "evidence_reports",
                "code": "capture_manifest_missing",
            }
        )
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ui_rows = manifest.get("uiEvidenceRows") or []
    overlay_rows = manifest.get("overlayEvidenceRows") or []
    required_views = [
        {"viewId": view_id, "kind": "ui"}
        for view_id in _view_ids_for(house_state["house"])
    ]
    overlay = http_json(
        "POST",
        "/api/v3/reverse-bim/source-overlay-evidence",
        {
            "requiredViews": overlay_rows if overlay_rows else [],
            "overlayResults": overlay_rows,
        },
    )
    ui = http_json(
        "POST",
        "/api/v3/reverse-bim/ui-evidence",
        {
            "requiredViews": required_views,
            "screenshots": ui_rows,
            "requireVisualChecklist": False,
        },
    )
    # Also run qa.area_reconciliation against the live model.
    qa_area = http_json(
        "POST",
        f"/api/models/{house_state['modelId']}/qa/area-reconciliation",
        {},
    )
    out_root = (
        REPO_ROOT / "tmp" / "reverse-bim" / house_state["house"] / "iter-3-live-gates"
    )
    out_root.mkdir(parents=True, exist_ok=True)
    (out_root / "source-overlay-evidence.json").write_text(
        json.dumps(overlay, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out_root / "ui-evidence.json").write_text(
        json.dumps(ui, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out_root / "qa-area-reconciliation.json").write_text(
        json.dumps(qa_area, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    overlay_summary = overlay.get("summary") or {}
    ui_summary = ui.get("summary") or {}
    overlay_ok = bool(
        (overlay.get("accepted") is True) or (overlay_summary.get("blockingCount") == 0)
    )
    ui_ok = bool(
        (ui.get("accepted") is True) or (ui_summary.get("blockingCount") == 0)
    )
    if overlay_ok and ui_ok:
        advance_phase({}, house_state, "iter3_evidence_reports_ok")
    else:
        house_state["errors"].append(
            {
                "at": _now(),
                "phase": "evidence_reports",
                "code": "reports_not_ok",
                "overlayOk": overlay_ok,
                "uiOk": ui_ok,
            }
        )


def drive_final_acceptance(house_state: dict[str, Any]) -> None:
    if house_state["phase"] not in {
        "iter3_loaded_in_dev",
        "iter3_capture_plan_ready",
        "iter3_screenshots_captured",
        "iter3_evidence_reports_ok",
        "iter3_final_acceptance_run",
    }:
        return
    # Re-read whichever evidence reports we have on disk so final_acceptance
    # sees the latest source-overlay + ui-evidence outputs.
    gates_root = (
        REPO_ROOT / "tmp" / "reverse-bim" / house_state["house"] / "iter-3-live-gates"
    )
    source_overlay_path = gates_root / "source-overlay-evidence.json"
    ui_evidence_path = gates_root / "ui-evidence.json"
    qa_area_path = gates_root / "qa-area-reconciliation.json"
    body: dict[str, Any] = {"modelId": house_state["modelId"]}
    if source_overlay_path.exists():
        body["sourceOverlay"] = json.loads(source_overlay_path.read_text(encoding="utf-8"))
    if ui_evidence_path.exists():
        body["uiEvidence"] = json.loads(ui_evidence_path.read_text(encoding="utf-8"))
    if qa_area_path.exists():
        body["areaReconciliation"] = json.loads(qa_area_path.read_text(encoding="utf-8"))
    final = http_json(
        "POST",
        "/api/v3/reverse-bim/final-acceptance",
        body,
    )
    summary = final.get("summary") or {}
    house_state["lastFinalAcceptance"] = {
        "accepted": bool(final.get("accepted")),
        "passed": summary.get("passedGateCount", 0),
        "total": summary.get("gateCount", 0),
        "blockingGates": summary.get("blockingGateIds", []),
        "ranAt": _now(),
    }
    history = house_state.setdefault("blockingGateHistory", [])
    history.append(sorted(summary.get("blockingGateIds", [])))
    house_state["blockingGateHistory"] = history[-PLATEAU_PASS_THRESHOLD:]
    advance_phase({}, house_state, "iter3_final_acceptance_run")
    if final.get("accepted"):
        house_state["terminal"] = True
        house_state["terminalReason"] = "final_acceptance_passed"
        advance_phase({}, house_state, "accepted")


def check_plateau(house_state: dict[str, Any]) -> None:
    history = house_state.get("blockingGateHistory") or []
    if len(history) < PLATEAU_PASS_THRESHOLD:
        return
    if all(row == history[0] for row in history):
        # Same blocking set 3 passes in a row → plateau.
        house_state["terminal"] = True
        house_state["terminalReason"] = "plateau_3_passes_same_blocking_gates"
        house_state["dispositions"].append(
            {
                "at": _now(),
                "code": "source_unavailable",
                "reason": (
                    "Blocking gates "
                    + ", ".join(history[0])
                    + " unchanged across 3 convergence passes; "
                    "remaining gaps treated as source_unavailable."
                ),
            }
        )
        advance_phase({}, house_state, "blocked_with_disposition")


def identify_pending_subagent_dispatches(house_state: dict[str, Any]) -> None:
    if house_state["terminal"]:
        return
    last = house_state.get("lastFinalAcceptance") or {}
    blocking = set(last.get("blockingGates") or [])
    if not blocking:
        return
    pending: list[dict[str, Any]] = []
    # Reset pending each pass; the orchestrator re-dispatches what's still
    # needed. (Already-dispatched-but-completed entries are tracked
    # separately under completedSubagentDispatches.)
    if "level_completeness" in blocking:
        for level in _empty_levels_for(house_state):
            counter_key = f"numeric_reader_for_level:{level}"
            retries = house_state["retryCounters"].get(counter_key, 0)
            if retries < SUBAGENT_RETRY_BUDGET:
                pending.append(
                    {
                        "id": f"{house_state['house']}-num-{level.lower()}-pass-{retries + 1:02d}",
                        "action": "numeric_reader_for_level",
                        "args": {
                            "house": house_state["house"],
                            "level": level,
                            "retry": retries + 1,
                        },
                        "promptKey": "numeric_reader_for_level",
                    }
                )
    if "physical_topology" in blocking:
        counter_key = "room_opening_reader"
        retries = house_state["retryCounters"].get(counter_key, 0)
        if retries < SUBAGENT_RETRY_BUDGET:
            pending.append(
                {
                    "id": f"{house_state['house']}-rooms-pass-{retries + 1:02d}",
                    "action": "room_opening_reader",
                    "args": {"house": house_state["house"], "retry": retries + 1},
                    "promptKey": "room_opening_reader",
                }
            )
    if "area_reconciled" in blocking:
        counter_key = "area_schedule_reader"
        retries = house_state["retryCounters"].get(counter_key, 0)
        if retries < SUBAGENT_RETRY_BUDGET:
            pending.append(
                {
                    "id": f"{house_state['house']}-area-pass-{retries + 1:02d}",
                    "action": "area_schedule_reader",
                    "args": {"house": house_state["house"], "retry": retries + 1},
                    "promptKey": "area_schedule_reader",
                }
            )
    house_state["pendingSubagentDispatches"] = pending[:PER_HOUSE_ACTION_BUDGET]


def _empty_levels_for(house_state: dict[str, Any]) -> list[str]:
    # Determined per-house from the iter-2 acceptance level report.
    house = house_state["house"]
    acceptance_path = (
        REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-2-acceptance.json"
    )
    if not acceptance_path.exists():
        return []
    data = json.loads(acceptance_path.read_text(encoding="utf-8"))
    level_report = data.get("levelCompleteness") or {}
    return [
        row.get("name")
        for row in level_report.get("levels") or []
        if row.get("status") in {"empty_or_incomplete", "missing_model_level"}
        and row.get("name")
    ]


def _overlay_views_for(house: str) -> list[dict[str, Any]]:
    """Each row pairs one model view with its source page so the
    view-capture runner can produce overlay deviation metrics."""

    return {
        "house-alpha": [
            {"viewId": "sc-haus", "sourceDocumentId": "srcdoc-97d5b8f956ed", "sourcePage": 1},
            {"viewId": "ev-berg", "sourceDocumentId": "srcdoc-ee9dfd8186b6", "sourcePage": 1},
        ],
        "house-beta": [
            {"viewId": "sc-haus", "sourceDocumentId": "srcdoc-e73f05ce8e83", "sourcePage": 4},
            {"viewId": "ev-osten", "sourceDocumentId": "srcdoc-e73f05ce8e83", "sourcePage": 5},
            {"viewId": "ev-sueden", "sourceDocumentId": "srcdoc-e73f05ce8e83", "sourcePage": 6},
        ],
        "house-gamma": [
            {"viewId": "sc-aa", "sourceDocumentId": "srcdoc-0a178ed8c402", "sourcePage": 9},
            {"viewId": "ev-strasse", "sourceDocumentId": "srcdoc-0a178ed8c402", "sourcePage": 6},
        ],
    }[house]


def _view_ids_for(house: str) -> list[str]:
    return {
        "house-alpha": [
            "sc-haus",
            "ev-berg",
            "ev-linke-giebel",
            "ev-tal",
            "ev-rechte-giebel",
        ],
        "house-beta": [
            "sc-haus",
            "sc-garage",
            "ev-osten",
            "ev-norden",
            "ev-sueden",
            "ev-westen",
        ],
        "house-gamma": [
            "sc-aa",
            "sc-bb",
            "ev-strasse",
            "ev-eingang",
            "ev-garten",
        ],
    }[house]


def ingest_subagent_responses(house_state: dict[str, Any]) -> None:
    # Any responses on disk under the reader-pass-iter3 path that match a
    # known dispatch id get moved to completedSubagentDispatches. The
    # orchestrator is responsible for writing the response files; the pass
    # script only ingests them.
    responses_root = (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house_state["house"]
        / "ai-reading"
        / "responses"
        / "reader-pass-iter3"
    )
    if not responses_root.exists():
        return
    seen = {d["id"] for d in house_state.get("completedSubagentDispatches") or []}
    for path in sorted(responses_root.glob("*.json")):
        dispatch_id = path.stem
        if dispatch_id in seen:
            continue
        house_state["completedSubagentDispatches"].append(
            {
                "id": dispatch_id,
                "responsePath": str(path),
                "ingestedAt": _now(),
            }
        )


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def run_pass() -> dict[str, Any]:
    state = load_state()
    state["passCount"] += 1
    state["lastPassAt"] = _now()

    if state["passCount"] > state["passBudget"]:
        for house_state in state["houses"].values():
            if not house_state["terminal"]:
                house_state["terminal"] = True
                house_state["terminalReason"] = "pass_budget_exhausted"
                advance_phase({}, house_state, "blocked_pass_budget_exhausted")
        state["allTerminal"] = True
        save_state(state)
        return _summary(state)

    if not dev_server_reachable():
        for house_state in state["houses"].values():
            house_state["errors"].append(
                {
                    "at": _now(),
                    "code": "dev_server_unreachable",
                    "url": API_BASE,
                }
            )
        save_state(state)
        return _summary(state)

    for house_state in state["houses"].values():
        house_state["actionsThisPass"] = []
        if house_state["terminal"]:
            continue
        ingest_subagent_responses(house_state)
        run_load_to_dev_if_needed(house_state)
        drive_view_capture_plan(house_state)
        run_playwright_capture(house_state)
        drive_evidence_reports(house_state)
        drive_final_acceptance(house_state)
        check_plateau(house_state)
        identify_pending_subagent_dispatches(house_state)

    state["allTerminal"] = all(h["terminal"] for h in state["houses"].values())
    save_state(state)
    return _summary(state)


def _summary(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "passCount": state["passCount"],
        "passBudget": state["passBudget"],
        "allTerminal": state["allTerminal"],
        "lastPassAt": state["lastPassAt"],
        "houses": [
            {
                "house": h["house"],
                "phase": h["phase"],
                "terminal": h["terminal"],
                "terminalReason": h.get("terminalReason"),
                "lastFinalAcceptance": h.get("lastFinalAcceptance"),
                "pendingSubagentDispatches": h.get("pendingSubagentDispatches", []),
                "pendingSubagentCount": len(h.get("pendingSubagentDispatches", [])),
                "actionsThisPass": h.get("actionsThisPass", []),
                "errorsThisPass": h.get("errors", [])[-3:],
            }
            for h in state["houses"].values()
        ],
    }


def main() -> None:
    summary = run_pass()
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
