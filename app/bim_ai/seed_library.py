"""Seed-library identity and hygiene helpers.

The seed library is a deterministic local project populated only by
``app/scripts/seed.py`` from approved ``seed-artifacts/<name>`` packages.
Disposable evidence projects are separate local DB rows and must not be treated
as seed-library entries.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

SEED_PROJECT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:project:seed-library")
SEED_PROJECT_SLUG = "seeds"
SEED_PROJECT_TITLE = "Seed Library"

_LOCAL_WAVE_SLUG_RE = re.compile(r"^m\d+-wave\d+-[0-9a-f]{8}$", re.IGNORECASE)
_DISPOSABLE_SLUG_RE = re.compile(
    r"(^|[._-])(disposable|scratch|tmp|temp|local|wave\d*)([._-]|$)",
    re.IGNORECASE,
)


def is_seed_library_project_id(project_id: Any) -> bool:
    try:
        return uuid.UUID(str(project_id)) == SEED_PROJECT_ID
    except (TypeError, ValueError, AttributeError):
        return False


def is_disposable_local_project(slug: str | None, title: str | None) -> bool:
    """Return true for known local evidence/rehearsal project rows.

    This is intentionally conservative because project rows can be user-owned.
    The patterns cover the repository's disposable evidence runner defaults and
    explicit scratch/local evidence labels without matching arbitrary customer
    projects that happen to contain "wave" or "local" in their names.
    """

    slug_text = (slug or "").strip().lower()
    title_text = (title or "").strip().lower()
    if not slug_text and not title_text:
        return False
    if slug_text == SEED_PROJECT_SLUG:
        return False
    if _LOCAL_WAVE_SLUG_RE.match(slug_text):
        return True
    if title_text and "disposable" in title_text and (
        "evidence" in title_text or "local" in title_text
    ):
        return True
    if _DISPOSABLE_SLUG_RE.search(slug_text) and (
        "disposable" in title_text or "evidence" in title_text or "local" in title_text
    ):
        return True
    return False
