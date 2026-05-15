# Energy Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with an existing Discipline Lens architecture. The platform already has:

- Wall types with layered composition: thickness, function, material key, visualization, readout, and material/assembly resolution
- Building elements: walls, slabs, roofs, floors, windows, doors, openings, rooms, and zones
- Rooms/zones as logical units used in room schedules
- 3D model with saved views, sun studies, section boxes, and multi-disciplinary lens behavior
- Floor plans, 3D views, sections, sheets, and schedules as primary user-facing concepts
- Discipline Lens as a filter/visibility layer: today primarily visual scope; elements carry discipline tags; lens controls foreground/background rendering; not yet fully bound to lens-specific property sets
- Real-time collaboration with versioning in a cloud-native browser app
- Cloud API for third-party integration

The goal is to add an **Energy Lens** that turns this BIM model into a workable tool for German energy consultants. In German product language, this lens is **Energieberatung**.

The lens targets workflows around:

- GEG context and handoff data
- BAFA-funded EBW/iSFP workflows
- BEG funding-preparation data
- Existing calculation tools such as Hottgenroth Energieberater, BKI Energieplaner, ETU-Planer, ZUB Helena, and comparable specialist tools

Critical scope constraint: We do **not** build our own GEG calculation engine. We do **not** compute final energy balances per DIN V 18599. We do **not** generate BAFA-conformant iSFP PDFs ourselves. We are a modeling, enrichment, QA, and handover front end that lets consultants build a thermally classified building model quickly, then hands off to established calculation tools that carry compliance liability.

## Lens Identity

- Lens ID: `energy`
- English name: Energy Consulting
- German name: Energieberatung
- Alternate German labels: Energielinse, Energieberater-Modus
- Primary users: Energieberater, architects preparing energy handoff, building owners reviewing renovation scenarios
- Existing status: present in the core lens type vocabulary, not yet exposed in the UI lens cycle

## Official Workflow Anchors

The lens should stay aligned with current German public-program terminology:

- BAFA EBW: Bundesfoerderung der Energieberatung fuer Wohngebaeude
- iSFP: individueller Sanierungsfahrplan
- BEG: Bundesfoerderung fuer effiziente Gebaeude
- GEG: Gebaeudeenergiegesetz
- DIN V 18599 handoff context for energy balance work in approved specialist software

References checked on 2026-05-14:

- BAFA EBW and iSFP program page: https://www.bafa.de/DE/Energie/Energieberatung/Energieberatung_Wohngebaeude/energieberatung_wohngebaeude.html
- BAFA iSFP Merkblatt page: https://www.bafa.de/SharedDocs/Downloads/DE/Energie/ebw_merkblatt_isfp_2023.html
- BMWSB GEG page: https://www.bmwsb.bund.de/DE/bauen/innovation-klimaschutz/gebaeudeenergiegesetz/gebaeudeenergiegesetz_node.html

## Design Principle: Native Integration With Existing Concepts

The Energy Lens is not a bolt-on. It extends existing platform concepts so Architecture-Lens users and Energy-Lens users work on the same model, same elements, same wall types, and same rooms while seeing different overlays, properties, schedules, and tools.

| Existing concept | Energy Lens extension |
|---|---|
| Wall types with layers | Layers gain thermal properties: lambda, rho, c, mu, source reference. U-values become computed type readouts. |
| Building elements | Elements gain optional thermal classification: exterior wall against outside air, floor against ground, roof against outside air, partition to unheated space, etc. |
| Rooms/zones | Rooms gain heating status, usage profile, setpoint, ventilation assumptions, and zone membership. |
| Schedules | New schedule types: Envelope Surfaces, Thermal Materials, U-Value Summary, Windows and Solar Gains, Building Services Handoff. |
| Sheets | Energy-relevant viewports can be placed on sheets: envelope overview, U-value heatmap, renovation scenario, shading analysis. |
| Sections | Sections overlay layer thicknesses, lambda values, U-values, thermal bridges, and renovation layer proposals. |
| 3D Views | Existing saved views remain valid; add color by U-value, color by thermal classification, highlight thermal envelope, and shading-factor overlays. |
| Sun Studies | Extend existing sun workflows with annual shading-factor data per opening/window for handoff, not final DIN calculation. |
| Cloud collaboration | Architect and energy consultant work simultaneously. Architectural changes update envelope areas and trigger energy review warnings. |
| API | Energy data is queryable and exportable for third-party calculation and reporting tools. |

## What This Rules Out

- No parallel energy model that must be manually synchronized.
- No duplicate material database for energy and architecture.
- No proprietary-only energy handoff format.
- No special energy mode that disables architectural editing.
- No final GEG, DIN V 18599, BEG, or BAFA compliance claim inside the BIM platform.

## Functional Scope

### 1. Thermal Material Properties

Extend the existing material concept with optional thermal properties:

- `lambdaWPerMK`: thermal conductivity, W/(m*K)
- `rhoKgPerM3`: bulk density, kg/m3
- `specificHeatJPerKgK`: specific heat capacity, J/(kg*K)
- `mu`: water vapor diffusion resistance factor
- `sourceReference`: DIN 4108-4, DIN EN ISO 10456, manufacturer datasheet, or user-entered reference

Seed a standard material library with common construction materials such as mineral wool WLG 035, EPS WLG 032, sand-lime brick, reinforced concrete, gypsum board, OSB, timber, aerated concrete, clay brick, screed, membranes, and roof insulation.

Architecture Lens should not expose these fields unless explicitly expanded.

### 2. Automatic U-Value on Types

Compute U-value readouts on layered types:

```text
R_total = R_si + sum(layer_thickness_m / lambda_W_per_mK) + R_se
U = 1 / R_total
```

Type readouts required:

- Wall U-value
- Roof U-value
- Floor/slab U-value
- Door/window U-value from family/type properties
- Missing-data warnings when a layer lacks lambda
- Source traceability for every thermal value

The computed U-value is a modeling readout and handoff value. It is not a certified final compliance calculation.

### 3. Thermal Envelope Classification

Every envelope element can be classified:

- Exterior wall against outside air
- Wall against ground
- Wall against unheated space
- Roof / top floor ceiling against outside air
- Floor slab against ground
- Floor against unheated basement
- Window / door in thermal envelope
- Internal element outside thermal envelope

Energy Lens should provide tools for:

- Auto-suggest classification from geometry, room adjacency, and level position
- Manual override
- Batch classification by facade/level/type
- Missing envelope classification warnings

### 4. Rooms, Zones, and Heating Status

Rooms gain:

- `heatingStatus`: heated, low-heated, unheated
- `usageProfile`: residential, office, school, retail, other
- `setpointC`
- `airChangeRate`
- `zoneId`
- `conditionedVolumeIncluded`

The Energy Lens should allow room grouping into thermal zones without changing architectural room identity.

### 5. Windows, Solar Gains, and Shading Handoff

Window/door family types gain:

- `uValue`
- `gValue`
- `frameFraction`
- `airTightnessClass`
- `installationThermalBridgeNote`
- `shadingDevice`
- `annualShadingFactorEstimate`

Sun studies should support handoff-oriented shading summaries:

- Orientation
- Gross and net glazed area
- Estimated shading factor
- Adjacent obstruction notes
- Scenario comparison

### 6. Thermal Bridges

Support thermal bridge markers:

- Balcony slab
- Window reveal
- Roof-wall junction
- Floor-wall junction
- Basement transition
- Cantilever
- User-defined marker

Each marker carries:

- Location
- Type
- Description
- Suggested mitigation
- Handoff note
- Optional psi-value reference, if user supplied

### 7. Renovation Scenarios

Support branches or scenario layers:

- As-is / Bestand
- Renovation scenario A
- Renovation scenario B
- Target / Zielzustand

Each scenario can override:

- Type layer composition
- Window/door type
- Heating status
- Systems notes
- Measure packages
- Cost placeholders for handoff, not final cost estimation

### 8. Building Services Handoff

Capture non-final system data:

- Heating generator type
- Fuel / energy carrier
- Distribution type
- Domestic hot water system
- Ventilation system
- Renewable-energy notes
- Known system age
- iSFP/BEG measure candidate notes

Full system simulation remains out of scope.

## Schedules

Required schedule types:

- Envelope Surfaces
- Thermal Materials
- U-Value Summary
- Windows and Solar Gains
- Thermal Bridges
- Thermal Zones
- Building Services Handoff
- Renovation Measures
- Export QA Checklist

## Views and Sheets

Required view modes:

- Color by U-value
- Color by thermal classification
- Highlight thermal envelope
- Show unclassified envelope elements
- Show missing material thermal values
- Shading review
- Scenario comparison

Required sheet templates:

- Bestandsaufnahme / as-is energy survey
- Thermal envelope overview
- U-value summary
- Renovation scenario comparison
- Export QA handoff sheet

## Export and API

Export targets:

- IFC with property sets for thermal classification and material thermal properties
- XML/JSON handoff for energy-calculation tools
- CSV schedules for manual import
- API endpoints for third-party energy tools

The export must include traceability:

- Element IDs
- Type IDs
- Material IDs
- Source references
- Scenario ID
- Last modified user/time

## Validation Rules

Warn when:

- Envelope element lacks classification
- Layered type lacks thermal material data
- Window/door lacks U-value or g-value
- Heated room has no thermal zone
- Thermal envelope is not closed
- Exterior boundary area looks implausible
- Scenario has inconsistent type overrides
- Export target lacks required values

## Non-Goals

- No final DIN V 18599 engine.
- No official BAFA iSFP PDF generator.
- No GEG compliance certification.
- No BEG funding approval logic.
- No hidden automatic assumptions that cannot be audited.

## Implementation Prompt

Implement the Energy Lens as the Energieberatung workflow layer over the shared BIM model. Add thermal material properties, computed type-level U-value readouts, thermal envelope classification, room/zone heating status, window solar-gain metadata, thermal bridge markers, renovation scenarios, energy schedules, and export-ready QA. Keep final compliance calculations and official iSFP/BAFA/BEG liability in external specialist tools. The product value is fast, collaborative, auditable model enrichment and high-quality handoff.
