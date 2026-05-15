# Lens Implementation Tracker

Last updated: 2026-05-15

This tracker records the product lens specs and their committed implementation state on `main`.

| Lens ID | Lens | German label | Status | Main evidence |
| --- | --- | --- | --- | --- |
| `architecture` | Architecture | Architektur | In Progress | `spec/lenses/architecture.md`; architecture defaults and query API are on `main`. |
| `construction` | Construction / Execution | Bauausfuehrung | In Progress | `spec/lenses/construction-lens.md`; construction schedules, API, and UI lens are on `main`. |
| `coordination` | Coordination | Koordination | In Progress | Coordination API/readout and UI integration are on `main`; spec file still needs a committed lens spec. |
| `cost-quantity` | Cost and Quantity | Kosten und Mengen | Done | `spec/lenses/cost-quantity-lens.md`; model takeoff, costing, schedules, API, and web lens are on `main`. |
| `energy` | Energy Advisory | Energieberatung | In Progress | Energy schedules/API/UI are on `main`; spec file still needs a committed lens spec. |
| `fire-safety` | Fire Safety | Brandschutz | In Progress | `spec/lenses/fire-safety-lens.md`; fire safety schedules, API, and UI lens are on `main`. |
| `mep` | MEP | TGA | In Progress | MEP model contract, schedules, API, and authoring UI are on `main`; spec file still needs a committed lens spec. |
| `structure` | Structure | Tragwerk | In Progress | Structure classification/defaults are on `main`; spec file still needs a committed lens spec. |
| `sustainability` | Sustainability / LCA | Nachhaltigkeit / Oekobilanz | Done | `spec/lenses/sustainability-lens.md`; LCA schedules, API/export payloads, circularity metadata, and web lens identity are on `main`. |

## Cost and Quantity Completion Evidence

Status: `Done`

Merged to `main` via:

- `510c7ff4a` - Merge latest main into cost quantity lens workpackages
- `48f1a5d42` and later main merges retain the Cost and Quantity implementation

Implemented surface:

- Backend model-derived takeoff and costing: `app/bim_ai/cost_quantity.py`
- Schedule categories and metadata: `quantity_takeoff`, `cost_estimate`, `element_cost_group`, `scenario_delta`
- API endpoint and tool descriptor: `/api/models/{model_id}/cost-quantity-lens`
- Web schedule presets/workflows and lens filtering: `packages/web/src/schedules`, `packages/web/src/workspace/ModeShells.tsx`, `packages/web/src/viewport/useLensFilter.ts`

Verification:

- `PYTHONPATH=app PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_cost_quantity_lens.py app/tests/test_schedule_field_registry.py`
- `pnpm --filter @bim-ai/web exec vitest run src/workspace/shell/LensDropdown.test.tsx src/schedules/scheduleDefinitionPresets.test.ts src/viewport/useLensFilter.test.ts src/workspace/ModeShells.test.tsx`
- `pnpm --filter @bim-ai/web typecheck`

## Sustainability Completion Evidence

Status: `Done`

Merged to `main` via:

- `48f1a5d42` - Merge current main after sustainability lens
- `5b9a4156d` - docs: track sustainability lens completion

Implemented surface:

- Backend LCA derivation and missing-data readouts: `app/bim_ai/sustainability_lca.py`
- Material impact and circularity model fields: `app/bim_ai/elements.py`
- Schedule categories and metadata: `material_impact`, `element_carbon`, `assembly_carbon`, `circularity`, `scenario_impact_comparison`, `missing_sustainability_data`
- API/export payloads: `/api/models/{model_id}/sustainability`, sustainability LCA JSON export
- Web lens identity and command reachability: `packages/web/src/workspace/shell/LensDropdown.tsx`, `packages/web/src/cmdPalette/defaultCommands.ts`, `packages/web/src/workspace/commandCapabilities.ts`, `packages/web/src/viewport/useLensFilter.ts`

Verification:

- `PYTHONPATH=/Users/jhoetter/repos/bim-ai-main-merge-sustainability-20260514/app pytest --no-cov app/tests/test_sustainability_lens.py app/tests/test_structure_lens.py app/tests/test_cost_quantity_lens.py app/tests/test_material_assembly_schedule.py app/tests/test_schedule_category_field_coverage.py app/tests/test_update_element_property_door_material.py`
- `python -m ruff check app/bim_ai/sustainability_lca.py app/tests/test_sustainability_lens.py app/bim_ai/elements.py app/bim_ai/structure_lens.py app/tests/test_structure_lens.py app/bim_ai/schedule_derivation.py app/bim_ai/schedule_field_registry.py app/bim_ai/routes_api.py app/bim_ai/engine_dispatch_properties.py`
- `pnpm --dir packages/web exec vitest run src/workspace/shell/LensDropdown.test.tsx src/cmdPalette/defaultCommands.test.ts src/workspace/commandCapabilities.test.ts src/viewport/useLensFilter.test.ts`
- `pnpm --dir packages/web exec eslint src/workspace/shell/LensDropdown.tsx src/workspace/shell/LensDropdown.test.tsx src/cmdPalette/defaultCommands.ts src/cmdPalette/defaultCommands.test.ts src/cmdPalette/registry.ts src/workspace/commandCapabilities.ts src/workspace/commandCapabilities.test.ts src/viewport/useLensFilter.ts src/viewport/useLensFilter.test.ts`
- `pnpm --dir packages/web typecheck`
