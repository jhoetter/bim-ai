"""VIE-06: project template loader.

Templates live as JSON snapshot files under ``app/bim_ai/templates/``. Each
file has shape::

    {
        "name": "Residential EU",
        "description": "...",
        "templateScaffold": true,
        "snapshot": {
            "revision": 1,
            "elements": { "<elem-id>": { "kind": "...", ... } }
        }
    }

This module exposes a small read-only API used by the create-empty-model
endpoint and the CLI: ``list_templates`` and ``load_template_snapshot``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from bim_ai.document import Document

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"


@dataclass(frozen=True)
class TemplateSummary:
    """Lightweight catalog row returned by ``GET /api/templates``."""

    id: str
    name: str
    description: str
    thumbnail_url: str | None = None


def list_templates() -> list[TemplateSummary]:
    """Enumerate template JSON files under ``TEMPLATES_DIR``.

    Files that don't conform to the v1 wrapper shape (no ``snapshot`` key)
    are skipped silently — that lets the legacy ``studio.json`` (a commands
    list, pre-VIE-06) coexist without surfacing in the new chooser.
    """
    out: list[TemplateSummary] = []
    if not TEMPLATES_DIR.is_dir():
        return out
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict) or "snapshot" not in data:
            continue
        tid = path.stem
        name = str(data.get("name") or tid.replace("-", " ").title())
        desc = str(data.get("description") or "")
        thumb = data.get("thumbnailUrl")
        out.append(
            TemplateSummary(
                id=tid,
                name=name,
                description=desc,
                thumbnail_url=str(thumb) if isinstance(thumb, str) else None,
            )
        )
    return out


def template_exists(template_id: str) -> bool:
    return (TEMPLATES_DIR / f"{template_id}.json").is_file()


def load_template_snapshot(template_id: str) -> Document:
    """Load a v1 template snapshot as a Document.

    Raises FileNotFoundError if the file is missing or LookupError if the
    file isn't a v1 template wrapper.
    """
    path = TEMPLATES_DIR / f"{template_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"template '{template_id}' not found at {path}")
    blob = json.loads(path.read_text())
    if not isinstance(blob, dict) or "snapshot" not in blob:
        raise LookupError(f"template '{template_id}' is not a v1 template (missing 'snapshot')")
    snap = blob["snapshot"]
    return Document.model_validate(snap)
