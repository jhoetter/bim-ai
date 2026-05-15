# Cost and Quantity Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with building elements, types, materials, schedules, sheets, collaboration, versioning, and cloud APIs.

The Cost and Quantity Lens supports quantity takeoff, cost grouping, scenario pricing, and procurement handoff. In German product language, this lens is **Kosten und Mengen**.

## Lens Identity

- Lens ID: `cost-quantity`
- English name: Cost and Quantity
- German name: Kosten und Mengen
- Alternate German labels: Mengenermittlung, Kostenplanung
- Primary users: cost planners, quantity surveyors, architects, project managers
- Existing status: recommended new lens

## Design Principle

Quantities must derive from the model and stay traceable to element IDs, type IDs, and scenario versions. Cost data should enrich existing elements, not require separate takeoff geometry.

## Functional Scope

### 1. Quantity Takeoff

Compute and expose:

- Length
- Area
- Volume
- Count
- Net/gross openings
- Layer quantities where available
- Room-based quantities

### 2. Cost Classification

Support:

- Cost group
- Work package
- Trade
- Unit
- Unit rate
- Source/reference
- Estimate confidence
- Scenario ID

German deployments should allow DIN 276-style grouping without hardcoding it as the only global classification.

### 3. Scenario Comparison

Support:

- As-is vs renovation scenarios
- Design option comparison
- Package-level totals
- Change delta
- Exportable cost snapshot

## Schedules

Required schedule defaults:

- Quantity takeoff
- Cost estimate
- Element cost group schedule
- Material quantities
- Door/window counts
- Room finish quantities
- Scenario delta report

## Views and Sheets

Provide:

- Color by cost group
- Color by trade
- Highlight unclassified cost items
- Scenario comparison sheets
- Quantity review sheets

## API Requirements

Expose quantities, classifications, cost rates, scenario totals, and traceability. API consumers must be able to reproduce schedule totals from source elements.

## Non-Goals

- Do not replace professional cost-estimation judgment.
- Do not silently infer unit rates without source references.
- Do not detach cost items from model elements unless explicitly marked as non-model allowances.

## Implementation Prompt

Implement the Cost and Quantity Lens as a model-derived takeoff and costing layer. Surface quantity metrics, classification fields, scenario totals, schedules, and exports while preserving traceability from every cost row back to the model.
