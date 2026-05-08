# WP-SKB-09 — Archetype Expansion (closeout)

## Branch

`feat/wave-04-skb-09-archetypes`

## Goal

Extend the archetype library beyond the single starter (`single_family_two_story_modest`). Add interior partitions to the existing one and ship three more archetypes covering the most common residential shapes the agent will encounter.

## Done rule

(a) Four archetype builders ship in `app/bim_ai/skb/archetypes.py`:

- `single_family_two_story_modest` — extended with interior partitions (≥4 partitions per floor, ≥4 rooms per floor).
- `l_shape_bungalow` — single storey, L-footprint, ≥6 rooms, hip or gable roof.
- `cabin_a_frame` — single storey, steep gable roof, mezzanine via `LevelElem` at ~2/3 height, large front glazing.
- `townhouse_three_story` — three storeys, narrow rectangular footprint, party walls flagged via `pinned=True`.

(b) Each builder accepts `ArchetypeParams` overrides for footprint dimensions and floor height; defaults reflect the archetype's typical proportions (use `bim_ai.skb.proportions.PROPORTION_RANGES`).

(c) Each archetype's emitted command bundle, when materialised, produces element kind counts that fall inside the corresponding `ARCHETYPE_PRIORS` range from `bim_ai.skb.element_count_priors`. Update the priors module if a count is genuinely an outlier for that archetype.

(d) Each archetype emits one `viewpoint` per side it deserves (front / rear / iso at minimum) using SKB-16 camera presets (`vp-main-iso`, `vp-front-elev`, etc.).

(e) Tracker row for SKB-09 flips from `partial` → `done`.

---

## File 1 — `app/bim_ai/skb/archetypes.py`

Extend `ARCHETYPES` with three new entries. Each has:

```python
Archetype(
  archetype_id="...",
  name="...",
  description="...",
  default_style_id="traditional" | "modernist" | "scandinavian" | "farmhouse",
  builder=_build_<id>,
)
```

Each `_build_<id>(params: ArchetypeParams) -> list[dict]` returns the same row shape (`{"phase": "<skb-phase>", "command": {...}}`) the existing builder uses. Reuse the same `_wall_row` / `_floor_row` / `_roof_row` helpers; if not currently extracted, factor them out so all four builders share.

Required emitted kinds per archetype (must match `ARCHETYPE_PRIORS`):

| Archetype | level | wall | floor | roof | door | window | room | partition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| single_family_two_story_modest (extended) | 2 | 8 perimeter + 6 partitions = 14 | 2 | 1 | 1 | 8 | 6 | 6 |
| l_shape_bungalow | 1 | 6 perimeter + 5 partitions = 11 | 1 | 1 hip | 1 | 8 | 6 | 5 |
| cabin_a_frame | 2 (mezz) | 4 + 2 partitions = 6 | 2 | 1 steep gable | 1 | 4 | 4 | 2 |
| townhouse_three_story | 3 | 12 perimeter + 9 partitions = 21 | 3 | 1 flat | 1 | 9 | 9 | 9 |

(Adjust priors in `element_count_priors.py` if these counts disagree.)

## File 2 — `app/bim_ai/skb/element_count_priors.py`

Update `ARCHETYPE_PRIORS` so each new archetype's expected kind counts fit the `(lo, hi)` ranges. For `partition` (room separation) add an entry per archetype if missing.

## Tests

`app/tests/test_skb_archetypes.py` (extend):

- For each new archetype, assert `bundle_for(<id>)` parses via `from_dict_list` and uses only known phases.
- For each new archetype, assert kind counts land inside `out_of_range_kinds(<id>, ...)` returns `[]`.
- For `single_family_two_story_modest`, the existing `test_two_story_bundle_essential_kinds_in_range` should now extend to wall + room because the extended bundle covers them. Update the assertion.
- Param-override tests: each archetype respects width / depth / floor_height overrides.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_skb_archetypes.py tests/test_skb_element_count_priors.py
```

## Tracker

Flip SKB-09 row from `partial` → `done`. Replace deferred-scope text with the as-shipped four-archetype set + interior-partition coverage on the modest archetype.

## Non-goals

- No archetype-picker UI — the agent picks via brief (SKB-21). UI is a separate WP.
- No styling overlay (the style bias from SKB-20 is consulted by the agent at apply time, not embedded in the bundle).
- No commercial / industrial archetypes (those land in a future wave; the brief format already supports them).
