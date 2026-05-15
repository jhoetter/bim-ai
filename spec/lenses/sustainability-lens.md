# Sustainability Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with typed elements, materials, layered assemblies, schedules, sheets, scenarios, collaboration, and cloud APIs.

The Sustainability Lens supports embodied-carbon and lifecycle assessment workflows. In German product language, this lens is **Nachhaltigkeit** or **Oekobilanz**.

## Lens Identity

- Lens ID: `sustainability`
- English name: Sustainability / LCA
- German name: Nachhaltigkeit / Oekobilanz
- Primary users: sustainability consultants, architects, owners, ESG teams
- Existing status: recommended new lens

## Design Principle

Sustainability data should extend the same material and quantity model used by architecture, energy, and cost. The platform should make embodied impact transparent and traceable, not create opaque sustainability scores.

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

### 2. Assembly and Element Impact

Compute readouts:

- Embodied carbon by element
- Embodied carbon by type
- Embodied carbon by material
- Impact by cost group/trade
- Scenario delta

### 3. Circularity

Support:

- Reused component flag
- Demountability
- Recyclability
- Material passport notes
- Hazardous material warning

## Schedules

Required schedule defaults:

- Material impact schedule
- Element carbon schedule
- Assembly carbon schedule
- Reuse/circularity schedule
- Scenario impact comparison
- Missing EPD/data-quality report

## Views and Sheets

Provide:

- Color by embodied carbon intensity
- Highlight missing EPD data
- Scenario comparison view
- Material passport sheet
- Sustainability summary sheet

## API Requirements

Expose material quantities, impact factors, EPD references, calculated readouts, and scenario deltas for external LCA tools.

## Non-Goals

- Do not invent official EPD values without source references.
- Do not claim certification compliance without a certified ruleset.
- Do not duplicate material records separately from architecture/energy materials.

## Implementation Prompt

Implement the Sustainability Lens as an auditable LCA and material-impact layer. Extend materials with source-backed impact data, compute traceable element/type readouts, expose missing-data warnings, and export schedules for external LCA and certification workflows.
