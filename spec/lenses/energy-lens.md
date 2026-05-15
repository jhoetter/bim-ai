# Energy Lens for Cloud-Native BIM Platform
## Requirements, Scope, and Implementation Tracker

## Lens Identity

- Lens ID: `energy`
- English name: Energy Consulting
- German name: Energieberatung
- Alternate German labels: Energielinse, Energieberater-Modus
- Primary users: Energieberater, architects preparing energy handoff, building owners reviewing renovation scenarios
- Implementation status: implemented and merged to `main`
- Merge evidence: `origin/main` contains `3a4e262a2` via later main merges

## Scope Boundary

The Energy Lens is a modeling, enrichment, QA, and handoff layer for German energy-consultant workflows. It supports GEG, iSFP, BEG, and DIN V 18599 handoff context, but it does not claim final compliance liability.

Non-goals:

- No final DIN V 18599 calculation engine.
- No official BAFA iSFP PDF generator.
- No GEG compliance certification.
- No BEG funding approval logic.
- No hidden automatic assumptions that cannot be audited.

## Design Principle

The Energy Lens extends the shared BIM model. It does not create a parallel energy model. Thermal data, classifications, scenarios, schedules, and handoff payloads attach to the same walls, floors, roofs, doors, windows, rooms, materials, views, sheets, and schedules used by the other lenses.

## Functional Scope

### 1. Thermal Material Properties

Extend materials with optional thermal properties:

- `lambdaWPerMK`
- `rhoKgPerM3`
- `specificHeatJPerKgK`
- `mu`
- `sourceReference`

Seed common construction materials such as mineral wool, EPS, sand-lime brick, reinforced concrete, gypsum board, OSB, timber, aerated concrete, clay brick, screed, membranes, and roof insulation.

### 2. Automatic U-Value on Types

Compute modeling readouts for layered wall, roof, and floor/slab types:

```text
R_total = R_si + sum(layer_thickness_m / lambda_W_per_mK) + R_se
U = 1 / R_total
```

Readouts include missing-data warnings and source traceability. These are handoff values, not certified compliance calculations.

### 3. Thermal Envelope Classification

Support envelope classification for walls, roofs, floors, slabs, windows, and doors:

- Exterior wall against outside air
- Wall against ground
- Wall against unheated space
- Roof / top floor ceiling against outside air
- Floor slab against ground
- Floor against unheated basement
- Window / door in thermal envelope
- Internal element outside thermal envelope

### 4. Rooms, Zones, and Heating Status

Rooms gain:

- `heatingStatus`
- `usageProfile`
- `setpointC`
- `airChangeRate`
- `zoneId`
- `conditionedVolumeIncluded`

### 5. Windows, Solar Gains, and Shading Handoff

Openings gain:

- `uValue`
- `gValue`
- `frameFraction`
- `airTightnessClass`
- `installationThermalBridgeNote`
- `shadingDevice`
- `annualShadingFactorEstimate`

### 6. Thermal Bridges

Support thermal bridge marker elements for balcony slabs, window reveals, roof-wall junctions, floor-wall junctions, basement transitions, cantilevers, and user-defined markers. Markers carry host references, descriptions, mitigation notes, handoff notes, and optional psi-value references.

### 7. Renovation Scenarios

Support as-is, renovation, and target-state scenario data with measure packages, system notes, and placeholders for consultant handoff. Scenario data must not override the architectural model without an explicit element/type reference.

### 8. Building Services Handoff

Capture non-final services data:

- Heating generator type
- Energy carrier
- Distribution type
- Domestic hot water system
- Ventilation system
- Renewable-energy notes
- Known system age
- iSFP/BEG measure candidate notes

## Schedules

Implemented schedule categories:

- `energy_envelope`
- `energy_thermal_materials`
- `energy_u_value_summary`
- `energy_windows_solar_gains`
- `energy_thermal_bridges`
- `energy_thermal_zones`
- `energy_building_services`
- `energy_renovation_measures`
- `energy_export_qa`

## Views and Sheets

Implemented workflow metadata covers:

- Thermal envelope overview
- U-value review
- Renovation scenario comparison
- Window and solar-gain review
- Thermal bridge review
- Export QA handoff

## Export and API

Implemented handoff surfaces:

- Schedule-derived `energyHandoff` payloads
- `GET /models/{model_id}/energy/handoff`
- IFC `Pset_BimAiEnergyHandoff` properties for envelope and opening elements
- CSV-ready schedule rows through the existing schedule API

## Implementation Tracker

| Workpackage | Status | Commit |
|---|---|---|
| Expose Energieberatung lens in UI and Cmd+K | Done | `0fc900360` |
| Add shared Energy Lens thermal model | Done | `f0b2e2128` |
| Add Energy Lens schedules and handoff API | Done | `d55c1db24` |
| Add workflow presets and IFC handoff metadata | Done | `3a4e262a2` |

## Verification

Last verified before merge:

- `uv run ruff check bim_ai/energy_lens.py bim_ai/elements.py bim_ai/schedule_derivation.py bim_ai/schedule_field_registry.py bim_ai/routes_api.py bim_ai/export_ifc_properties.py bim_ai/export_ifc_kernel.py tests/test_energy_lens.py`
- `uv run pytest tests/test_energy_lens.py tests/test_schedule_field_registry.py --no-cov`
- `pnpm --dir packages/web exec vitest run src/workspace/uxAudit.test.ts src/workspace/commandCapabilities.test.ts src/energy/energyLens.test.ts src/energy/energyLensWorkflows.test.ts src/schedules/scheduleDefinitionPresets.test.ts src/workspace/shell/LensDropdown.test.tsx src/cmdPalette/defaultCommands.test.ts`
- `pnpm --filter @bim-ai/web typecheck`
