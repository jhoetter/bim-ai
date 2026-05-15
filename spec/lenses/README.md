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
| `sustainability` | Sustainability / LCA | Nachhaltigkeit | In Progress | Sustainability LCA schedules/API are on `main`; spec file still needs a committed lens spec. |

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
