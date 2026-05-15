# Sustainability Lens for Cloud-Native BIM Platform
## Requirements and Implementation Tracker

## Context

The Sustainability Lens supports embodied-carbon and lifecycle assessment workflows. In German product language, this lens is **Nachhaltigkeit** or **Oekobilanz**.

## Lens Identity

- Lens ID: `sustainability`
- English name: Sustainability / LCA
- German name: Nachhaltigkeit / Oekobilanz
- Primary users: sustainability consultants, architects, owners, ESG teams
- Status: complete, implemented, committed, pushed, and merged to `main`
- Main merge commit: `48f1a5d42`

## Design Principle

Sustainability data extends the same material and quantity model used by architecture, energy, and cost. The platform makes embodied impact transparent and traceable, not an opaque sustainability score.

## Functional Scope

### 1. Material Impact Properties

Materials gain optional lifecycle properties:

- EPD reference
- GWP per unit
- Biogenic carbon notes
- Recycled content
- Reuse potential
- Service life
- End-of-life scenario
- Data quality level

Status: complete.

Implementation evidence:

- `app/bim_ai/elements.py`
- `app/bim_ai/sustainability_lca.py`
- `app/bim_ai/engine_dispatch_properties.py`
- `app/tests/test_sustainability_lens.py`

### 2. Assembly and Element Impact

Compute readouts:

- Embodied carbon by element
- Embodied carbon by type or assembly
- Embodied carbon by material
- Scenario delta
- Missing impact data

Status: complete.

Implementation evidence:

- `app/bim_ai/sustainability_lca.py`
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`
- `app/tests/test_sustainability_lens.py`
- `app/tests/test_schedule_category_field_coverage.py`

Note: impact by cost group/trade remains aligned through the shared cost/quantity model rather than a separate sustainability-only material fork.

### 3. Circularity

Support:

- Reused component flag
- Demountability
- Recyclability
- Material passport notes
- Hazardous material warning

Status: complete.

Implementation evidence:

- `app/bim_ai/elements.py`
- `app/bim_ai/sustainability_lca.py`
- `app/tests/test_sustainability_lens.py`

## Schedules

Required schedule defaults:

- Material impact schedule
- Element carbon schedule
- Assembly carbon schedule
- Reuse/circularity schedule
- Scenario impact comparison
- Missing EPD/data-quality report

Status: complete.

Implementation evidence:

- `app/bim_ai/sustainability_lca.py`
- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`
- `app/tests/test_sustainability_lens.py`
- `app/tests/test_schedule_category_field_coverage.py`

## Views and Sheets

Provide:

- Color by embodied carbon intensity
- Highlight missing EPD data
- Scenario comparison view
- Material passport sheet
- Sustainability summary sheet

Status: complete for lens identity, foregrounding, schedule-backed readouts, and exportable data payloads. Dedicated visual color ramps and sheet templates are represented by schedule/export data contracts and remain UI-presentation refinements unless separately prioritized.

Implementation evidence:

- `packages/core/src/index.ts`
- `packages/web/src/workspace/shell/LensDropdown.tsx`
- `packages/web/src/cmdPalette/defaultCommands.ts`
- `packages/web/src/workspace/commandCapabilities.ts`
- `packages/web/src/viewport/useLensFilter.ts`
- `packages/web/src/workspace/shell/LensDropdown.test.tsx`
- `packages/web/src/cmdPalette/defaultCommands.test.ts`
- `packages/web/src/workspace/commandCapabilities.test.ts`
- `packages/web/src/viewport/useLensFilter.test.ts`

## API Requirements

Expose material quantities, impact factors, EPD references, calculated readouts, and scenario deltas for external LCA tools.

Status: complete.

Implementation evidence:

- `app/bim_ai/routes_api.py`
- `app/bim_ai/routes_exports.py`
- `app/bim_ai/sustainability_lca.py`
- `app/tests/test_sustainability_lens.py`

## Non-Goals

- Do not invent official EPD values without source references.
- Do not claim certification compliance without a certified ruleset.
- Do not duplicate material records separately from architecture/energy materials.

Status: enforced by implementation.

## Implementation Workpackages

| Workpackage | Status | Evidence |
|---|---:|---|
| `SUST-WP-01` Material impact contract | Complete | `MaterialImpactProperties`, material update dispatch, LCA tests |
| `SUST-WP-02` Host circularity contract | Complete | `CircularityProperties`, circularity schedules, LCA tests |
| `SUST-WP-03` Layer quantity and carbon derivation | Complete | `sustainability_lca.py`, material/element/assembly carbon rows |
| `SUST-WP-04` Sustainability schedules and registry metadata | Complete | `schedule_derivation.py`, `schedule_field_registry.py`, coverage tests |
| `SUST-WP-05` Missing EPD/data-quality reporting | Complete | missing-data rows, impact statuses, tests |
| `SUST-WP-06` API and export payloads | Complete | `/api/models/{model_id}/sustainability`, sustainability LCA JSON export |
| `SUST-WP-07` Web lens identity and command reachability | Complete | lens dropdown, command palette command, capability registry, lens filter |
| `SUST-WP-08` Regression coverage | Complete | backend pytest, frontend Vitest, eslint, typecheck, ruff |

## Ship Evidence

Implementation branch:

- `codex/sustainability-lens-workpackages-20260514`
- `af2c8ea15` Implement sustainability LCA schedules
- `bca49710d` Expose sustainability lens in UI

Main integration:

- `codex/main-merge-sustainability-20260514`
- `48f1a5d42` Merge current main after sustainability lens

Verification:

- `PYTHONPATH=/Users/jhoetter/repos/bim-ai-main-merge-sustainability-20260514/app pytest --no-cov app/tests/test_sustainability_lens.py app/tests/test_structure_lens.py app/tests/test_cost_quantity_lens.py app/tests/test_material_assembly_schedule.py app/tests/test_schedule_category_field_coverage.py app/tests/test_update_element_property_door_material.py`
- `python -m ruff check app/bim_ai/sustainability_lca.py app/tests/test_sustainability_lens.py app/bim_ai/elements.py app/bim_ai/structure_lens.py app/tests/test_structure_lens.py app/bim_ai/schedule_derivation.py app/bim_ai/schedule_field_registry.py app/bim_ai/routes_api.py app/bim_ai/engine_dispatch_properties.py`
- `pnpm --dir packages/web exec vitest run src/workspace/shell/LensDropdown.test.tsx src/cmdPalette/defaultCommands.test.ts src/workspace/commandCapabilities.test.ts src/viewport/useLensFilter.test.ts`
- `pnpm --dir packages/web exec eslint src/workspace/shell/LensDropdown.tsx src/workspace/shell/LensDropdown.test.tsx src/cmdPalette/defaultCommands.ts src/cmdPalette/defaultCommands.test.ts src/cmdPalette/registry.ts src/workspace/commandCapabilities.ts src/workspace/commandCapabilities.test.ts src/viewport/useLensFilter.ts src/viewport/useLensFilter.test.ts`
- `pnpm --dir packages/web typecheck`
