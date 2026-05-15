# Lens Mechanism Hardening Tracker

## Purpose

The lens UX tracker is complete for the current MVP. This tracker covers the next layer of product and engineering work required to make lenses reliable as persistent, shareable BIM view state rather than only current UI state.

## Product Rules

- Lenses remain tab/view scoped inside compositions.
- The primary project browser remains lens-neutral.
- Sheets are containers; placed viewports own lens/display state.
- Lens overlays must be explainable with legends and user-controllable overlay toggles.
- Lens-specific data must move from ad hoc property lookup toward typed property sets.
- Facility Operations remains excluded until operations assets, systems, maintenance metadata, and handover APIs exist.

## Implementation Tracker

- [ ] Expand `ViewLensMode` persistence to all implemented lenses: Energy, Sustainability, Construction, and Coordination in addition to Architecture, Structure, MEP, Fire Safety, Cost / Quantity, and All.
- [ ] Add migration/defaulting logic so older saved views with legacy `defaultLens` values continue to load.
- [ ] Persist lens state per tab/view consistently across composition save/restore, split panes, reload, and collaboration snapshots.
- [ ] Add per-viewport lens/display persistence for sheet viewports instead of inheriting a transient sheet-mode lens.
- [ ] Add viewport-level UI for changing a placed viewport's lens without changing the sheet or other panes.
- [ ] Add a compact lens legend in plan, 3D, section/elevation, and viewport-on-sheet renderings.
- [ ] Add overlay controls per lens, starting with `ghost context`, `show badges`, `show missing data`, and one primary color mode.
- [ ] Define typed property-set contracts for each implemented lens.
- [ ] Replace inspector/readout ad hoc property lookup with typed lens property accessors.
- [ ] Add lens completeness checks:
  - Energy: missing thermal classification, U-value, heated/unheated zone, material lambda/source.
  - Fire Safety: missing fire rating, compartment, penetration firestopping, escape-route status.
  - Sustainability: missing EPD, GWP, material quantity basis, reuse/recycled content.
  - Cost / Quantity: missing DIN 276/cost group, quantity basis, unit/rate/source.
  - Construction: missing phase/package/progress/QA responsibility.
  - Coordination: unresolved clashes, stale linked models, missing assignment/review status.
  - Structure: missing structural role/load-bearing status/analytical alignment.
  - MEP: missing system/service type/penetration coordination.
- [ ] Add schedule presets for lens completeness reports without mutating existing user schedules.
- [ ] Add saved-view tests proving lens persistence for each implemented lens.
- [ ] Add split-pane regression tests proving lens changes remain pane/tab scoped.
- [ ] Add sheet viewport regression tests proving viewport lens state is independent from sheet mode.
- [ ] Add visual regression coverage for lens overlays in plan, 3D, section/elevation, and sheet viewport contexts.

## Recommended Order

1. Complete persistence first: full `ViewLensMode`, tab/view save-restore, and sheet viewport lens state.
2. Add legends and overlay toggles so users can understand what changed.
3. Formalize typed property sets and move inspector/overlay reads onto them.
4. Add completeness schedules/checks for each lens.
5. Expand visual and split-pane regression coverage.
