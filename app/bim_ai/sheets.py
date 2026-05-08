from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import WindowLegendViewElem


def resolve_window_legend(doc: Document, legend: WindowLegendViewElem) -> list[dict]:
    """Return one entry per unique window type: {typeId, label, widthMm, heightMm, sillMm, count}.

    Walks doc.elements, groups windows by windowTypeId, returns sorted per legend.sort_by.
    """
    windows = [e for e in doc.elements.values() if getattr(e, "kind", None) == "window"]
    by_type: dict[str, list] = {}
    for w in windows:
        tid = getattr(w, "window_type_id", None) or getattr(w, "family_type_id", None) or "unknown"
        by_type.setdefault(tid, []).append(w)

    entries = []
    for tid, instances in by_type.items():
        sample = instances[0]
        entries.append(
            {
                "typeId": tid,
                "label": getattr(sample, "type_mark", None) or getattr(sample, "name", tid),
                "widthMm": getattr(sample, "width_mm", 0),
                "heightMm": getattr(sample, "height_mm", 0),
                "sillMm": getattr(sample, "sill_height_mm", 0),
                "count": len(instances),
            }
        )

    sort_key = {"type": "label", "width": "widthMm", "count": "count"}.get(
        legend.sort_by, "label"
    )
    entries.sort(key=lambda e: e[sort_key])
    return entries
