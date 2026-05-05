"""Plan view / view-template category line weight + pattern tokens (WP-C01/C02/C03)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Literal, cast

from bim_ai.document import Document
from bim_ai.elements import (
    PlanCategoryGraphicRow,
    PlanLinePatternTokenPlan,
    PlanViewElem,
    ViewTemplateElem,
)

PLAN_CATEGORY_GRAPHIC_KEYS: tuple[str, ...] = (
    "wall",
    "floor",
    "roof",
    "room",
    "door",
    "window",
    "stair",
    "grid_line",
    "room_separation",
    "dimension",
)

_LINE_PATTERN_TOKENS: frozenset[str] = frozenset({"solid", "dash_short", "dash_long", "dot"})


@dataclass(frozen=True)
class ResolvedPlanCategoryGraphic:
    line_weight_factor: float
    line_pattern_token: PlanLinePatternTokenPlan
    line_weight_source: Literal["default", "template", "plan_view"]
    line_pattern_source: Literal["default", "template", "plan_view"]
    line_weight_is_defaulted: bool
    line_pattern_is_defaulted: bool


def normalize_plan_category_graphics_rows(
    rows: list[PlanCategoryGraphicRow] | list[dict[str, Any]] | None,
) -> list[PlanCategoryGraphicRow]:
    """Validate category keys and numeric bounds; dedupe by categoryKey (last wins); stable order."""
    if not rows:
        return []
    parsed: list[PlanCategoryGraphicRow] = []
    for raw in rows:
        row = raw if isinstance(raw, PlanCategoryGraphicRow) else PlanCategoryGraphicRow.model_validate(raw)
        ck = row.category_key
        if ck not in PLAN_CATEGORY_GRAPHIC_KEYS:
            raise ValueError(f"planCategoryGraphics unknown categoryKey '{ck}'")
        wf = row.line_weight_factor
        if wf is not None and not (0 < float(wf) <= 3):
            raise ValueError("planCategoryGraphics lineWeightFactor must be in (0, 3] when set")
        pt = row.line_pattern_token
        if pt is not None and str(pt) not in _LINE_PATTERN_TOKENS:
            raise ValueError(f"planCategoryGraphics unknown linePatternToken '{pt}'")
        parsed.append(row)
    by_cat: dict[str, PlanCategoryGraphicRow] = {}
    for r in parsed:
        by_cat[r.category_key] = r
    return [by_cat[k] for k in sorted(by_cat.keys())]


def parse_plan_category_graphics_property_json(raw: str) -> list[PlanCategoryGraphicRow]:
    if not raw.strip():
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("planCategoryGraphics must be JSON array or empty") from exc
    if not isinstance(parsed, list):
        raise ValueError("planCategoryGraphics must be a JSON array")
    objs: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            raise ValueError("planCategoryGraphics row must be an object")
        objs.append(item)
    return normalize_plan_category_graphics_rows([PlanCategoryGraphicRow.model_validate(o) for o in objs])


def _row_maps_for_merge(
    tmpl: ViewTemplateElem | None, pv: PlanViewElem | None
) -> tuple[dict[str, PlanCategoryGraphicRow], dict[str, PlanCategoryGraphicRow]]:
    tmpl_map = {r.category_key: r for r in tmpl.plan_category_graphics} if tmpl else {}
    pv_map = {r.category_key: r for r in pv.plan_category_graphics} if pv else {}
    return tmpl_map, pv_map


def resolve_plan_category_graphics_for_pinned_view(
    doc: Document, pinned_pv: PlanViewElem | None
) -> dict[str, ResolvedPlanCategoryGraphic]:
    tmpl: ViewTemplateElem | None = None
    if pinned_pv and pinned_pv.view_template_id:
        te = doc.elements.get(pinned_pv.view_template_id)
        if isinstance(te, ViewTemplateElem):
            tmpl = te
    tmpl_map, pv_map = _row_maps_for_merge(tmpl, pinned_pv)
    out: dict[str, ResolvedPlanCategoryGraphic] = {}
    for key in PLAN_CATEGORY_GRAPHIC_KEYS:
        f = 1.0
        pat: PlanLinePatternTokenPlan = "dash_short" if key == "room_separation" else "solid"
        w_src: Literal["default", "template", "plan_view"] = "default"
        p_src: Literal["default", "template", "plan_view"] = "default"
        w_def = True
        p_def = True
        tr = tmpl_map.get(key)
        if tr is not None:
            if tr.line_weight_factor is not None:
                f = float(tr.line_weight_factor)
                w_src = "template"
                w_def = False
            if tr.line_pattern_token is not None:
                pat = cast(PlanLinePatternTokenPlan, tr.line_pattern_token)
                p_src = "template"
                p_def = False
        pr = pv_map.get(key)
        if pr is not None:
            if pr.line_weight_factor is not None:
                f = float(pr.line_weight_factor)
                w_src = "plan_view"
                w_def = False
            if pr.line_pattern_token is not None:
                pat = cast(PlanLinePatternTokenPlan, pr.line_pattern_token)
                p_src = "plan_view"
                p_def = False
        out[key] = ResolvedPlanCategoryGraphic(
            line_weight_factor=round(f, 4),
            line_pattern_token=pat,
            line_weight_source=w_src,
            line_pattern_source=p_src,
            line_weight_is_defaulted=w_def,
            line_pattern_is_defaulted=p_def,
        )
    return out


def plan_category_graphic_hints_v0_payload(
    doc: Document,
    *,
    pinned_pv: PlanViewElem | None,
    resolved: dict[str, ResolvedPlanCategoryGraphic],
) -> dict[str, Any]:
    tmpl_id = None
    pv_id = None
    if pinned_pv is not None:
        pv_id = pinned_pv.id
        if pinned_pv.view_template_id:
            te = doc.elements.get(pinned_pv.view_template_id)
            if isinstance(te, ViewTemplateElem):
                tmpl_id = te.id
    rows: list[dict[str, Any]] = []
    for key in PLAN_CATEGORY_GRAPHIC_KEYS:
        r = resolved[key]
        rows.append(
            {
                "categoryKey": key,
                "lineWeightFactor": r.line_weight_factor,
                "linePatternToken": r.line_pattern_token,
                "lineWeightSource": r.line_weight_source,
                "linePatternSource": r.line_pattern_source,
                "lineWeightIsDefaulted": r.line_weight_is_defaulted,
                "linePatternIsDefaulted": r.line_pattern_is_defaulted,
            }
        )
    body = json.dumps(rows, separators=(",", ":"), sort_keys=True)
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    return {
        "format": "planCategoryGraphicHints_v0",
        "planViewElementId": pv_id,
        "viewTemplateElementId": tmpl_id,
        "rows": rows,
        "rowsDigestSha256": digest,
    }
