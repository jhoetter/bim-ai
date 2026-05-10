from __future__ import annotations

from collections import Counter
from typing import Any

REPLAY_DIAGNOSTICS_BUDGET_MS_LOCAL = 350
REPLAY_DIAGNOSTICS_BUDGET_MS_CI = 1000
REPLAY_LARGE_BUNDLE_WARN_COMMAND_COUNT = 5000

AGENT_LARGE_BUNDLE_ADVISORY_TEXT_V1 = (
    "Large command bundles raise validation latency; sanity-check merges of agent-authored payloads "
    "before pushing to shared revisions."
)


def replay_performance_budget_v1(
    *,
    command_count: int,
    hist_counter: Counter[str],
    first_blocking_command_index: int | None = None,
) -> dict[str, Any]:
    """Deterministic scan summary aligned with diagnostics perf ceilings (WP-P01 / WP-X01); no wall-clock fields."""

    histogram = [
        {"commandType": ctype, "count": cnt}
        for ctype, cnt in sorted(hist_counter.items(), key=lambda x: x[0])
    ]
    distinct = len(hist_counter)
    large_warn = command_count >= REPLAY_LARGE_BUNDLE_WARN_COMMAND_COUNT
    warnings = ["large_command_bundle"] if large_warn else []

    out: dict[str, Any] = {
        "format": "replayPerformanceBudget_v1",
        "commandCount": command_count,
        "commandTypeHistogram": histogram,
        "distinctCommandTypeCount": distinct,
        "declaredDiagnosticsBudgetMsLocal": REPLAY_DIAGNOSTICS_BUDGET_MS_LOCAL,
        "declaredDiagnosticsBudgetMsCi": REPLAY_DIAGNOSTICS_BUDGET_MS_CI,
        "largeBundleWarningThreshold": REPLAY_LARGE_BUNDLE_WARN_COMMAND_COUNT,
        "largeBundleWarn": large_warn,
        "warningCodes": warnings,
        "agentBundleAdvisory": AGENT_LARGE_BUNDLE_ADVISORY_TEXT_V1 if large_warn else "",
    }
    if first_blocking_command_index is not None:
        out["firstBlockingCommandIndex"] = first_blocking_command_index
    return out


def bundle_replay_diagnostics(cmds_raw: list[dict[str, Any]]) -> dict[str, Any]:
    """Stable ordering metadata for collaboration + replay surfaces (WP-X01 / WP-P02)."""

    types_in_order: list[str] = []
    hist_counter: Counter[str] = Counter()
    for c in cmds_raw:
        if not isinstance(c, dict):
            types_in_order.append("?")
            hist_counter["?"] += 1
            continue
        t = c.get("type")
        label = str(t) if t is not None else "?"
        types_in_order.append(label)
        hist_counter[label] += 1

    cc = len(cmds_raw)
    return {
        "commandCount": cc,
        "commandTypesInOrder": types_in_order,
        "replayPerformanceBudget_v1": replay_performance_budget_v1(
            command_count=cc,
            hist_counter=hist_counter,
            first_blocking_command_index=None,
        ),
    }
