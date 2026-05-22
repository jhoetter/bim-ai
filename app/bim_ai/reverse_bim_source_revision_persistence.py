"""Persistence helpers for reverse-BIM source revision ledgers."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bim_ai._io.digest import digest as _digest


def persist_reverse_bim_source_revision_ledger(
    *,
    output_dir: str | Path,
    source_revision_ledger: dict[str, Any],
    run_id: str | None = None,
) -> dict[str, Any]:
    """Persist/merge the source revision ledger under a folder-output run."""

    root = Path(output_dir).expanduser().resolve()
    validation_dir = root / "validation"
    validation_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = validation_dir / "source-revision-ledger.json"
    history_path = validation_dir / "source-revision-ledger.history.jsonl"
    existing = _load_json(ledger_path)
    merged = _merge_ledgers(existing, source_revision_ledger)
    record = {
        "persistedAt": datetime.now(UTC).isoformat(),
        "runId": run_id,
        "ledgerDigestSha256": _digest(merged),
        "summary": merged.get("summary") if isinstance(merged.get("summary"), dict) else {},
    }
    ledger_path.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    with history_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return {
        "ok": True,
        "format": "reverseBimSourceRevisionLedgerPersistence_v1",
        "outputDir": str(root),
        "ledgerPath": str(ledger_path),
        "historyPath": str(history_path),
        "record": record,
        "summary": {
            "entryCount": len(merged.get("entries") or []),
            "historyAppended": True,
        },
    }


def _merge_ledgers(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    entries_by_id = {}
    for source in (existing, incoming):
        for entry in source.get("entries") or []:
            if not isinstance(entry, dict):
                continue
            entry_id = str(entry.get("ledgerEntryId") or "")
            if not entry_id:
                continue
            entries_by_id[entry_id] = entry
    entries = sorted(entries_by_id.values(), key=lambda row: str(row.get("ledgerEntryId") or ""))
    summary = dict(incoming.get("summary") or existing.get("summary") or {})
    summary["entryCount"] = len(entries)
    summary["openEntryCount"] = sum(
        1 for row in entries if row.get("status") in {"open", "blocked"}
    )
    summary["blockingEntryCount"] = sum(
        1 for row in entries if row.get("status") in {"open", "blocked"} and row.get("blocking")
    )
    return {
        **existing,
        **incoming,
        "format": "reverseBimSourceRevisionLedger_v1",
        "summary": summary,
        "entries": entries,
    }


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}
