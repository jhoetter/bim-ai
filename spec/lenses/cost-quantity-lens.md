# Cost and Quantity Lens

## Status

- Lens ID: `cost-quantity`
- English name: Cost and Quantity
- German name: Kosten und Mengen
- Alternate German labels: Mengenermittlung, Kostenplanung
- Implementation status: `Done`
- Main implementation evidence: `app/bim_ai/cost_quantity.py`
- API endpoint: `/api/models/{model_id}/cost-quantity-lens`

## Implemented Scope

The Cost and Quantity Lens is implemented as a model-derived takeoff and costing layer. Quantities remain traceable to model elements and type IDs, while cost fields enrich existing elements through `props` metadata.

Implemented quantity takeoff:

- Length
- Area
- Volume
- Count
- Net/gross openings
- Layer counts where assembly layers are available
- Room-based quantities

Implemented cost classification fields:

- Cost group
- Work package
- Trade
- Unit
- Unit rate
- Source/reference
- Estimate confidence
- Scenario ID

Implemented scenario comparison:

- Baseline scenario default: `as-is`
- Package-level totals by scenario, cost group, work package, and trade
- Change deltas
- Exportable cost snapshot schedule metadata

## Schedule Defaults

The API review payload exposes the required schedule defaults:

- Quantity takeoff: `quantity_takeoff`
- Cost estimate: `cost_estimate`
- Element cost group schedule: `element_cost_group`
- Material quantities: `material_assembly`
- Door counts: `door`
- Window counts: `window`
- Room finish quantities: `room`
- Scenario delta report: `scenario_delta`

## Views and Sheets

The review payload exposes defaults for:

- Color by cost group
- Color by trade
- Highlight unclassified cost items
- Scenario comparison sheet
- Quantity review sheet

The web lens cycle includes `cost-quantity`, and viewport filtering foregrounds model-derived takeoff elements plus cost-classified custom items.

## API Requirements

Implemented API consumers can retrieve:

- Quantities
- Classifications
- Cost rates
- Scenario totals
- Traceability
- Schedule defaults
- View and sheet defaults

Cost totals are reproducible from source schedule rows. Unit rates without source references are surfaced for review but excluded from totals.

## Non-Goals Preserved

- Does not replace professional cost-estimation judgment.
- Does not silently total unit rates without source references.
- Does not detach cost items from model elements unless a consumer explicitly models non-model allowances.

## Verification

Last verified: 2026-05-15

- `PYTHONPATH=app PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_cost_quantity_lens.py app/tests/test_schedule_field_registry.py`
- `pnpm --filter @bim-ai/web exec vitest run src/workspace/shell/LensDropdown.test.tsx src/schedules/scheduleDefinitionPresets.test.ts src/viewport/useLensFilter.test.ts src/workspace/ModeShells.test.tsx`
- `pnpm --filter @bim-ai/web typecheck`
