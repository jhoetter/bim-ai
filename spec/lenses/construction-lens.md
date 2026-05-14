# Construction Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with shared model elements, phases, saved views, schedules, sheets, collaboration, versioning, comments, and cloud APIs.

The Construction Lens supports execution planning, site coordination, progress, temporary works, and field QA. In German product language, this lens is **Bauausfuehrung**.

## Lens Identity

- Lens ID: `construction`
- English name: Construction / Execution
- German name: Bauausfuehrung
- Alternate German labels: Ausfuehrung, Baustelle
- Primary users: contractors, site managers, construction coordinators, project managers
- Existing status: recommended new lens

## Design Principle

Construction data should attach to the design model as phase, package, progress, and QA metadata. The lens should make the model useful on site without corrupting design intent or consultant property sets.

## Functional Scope

### 1. Phasing and Sequencing

Expose:

- Phase created
- Phase demolished
- Construction package
- Planned start/end
- Actual start/end
- Installation sequence
- Dependencies

### 2. Temporary Works and Logistics

Support:

- Temporary partitions
- Scaffolding zones
- Crane and lift zones
- Laydown areas
- Access routes
- Site safety zones

### 3. Progress and QA

Support:

- Not started / in progress / installed / inspected / accepted
- Photo evidence
- Issue pins
- Punch items
- Responsible company
- Inspection checklist

## Schedules

Required schedule defaults:

- Construction package schedule
- Phase schedule
- Progress schedule
- Punch list
- Site logistics elements
- QA checklist report

## Views and Sheets

Provide:

- 4D-style phase views
- Color by construction package
- Color by progress status
- Site logistics plan
- Punch item sheets
- Field review saved views

## API Requirements

Expose progress status, package membership, issues, evidence, and phase data for field apps and contractor integrations.

## Non-Goals

- Do not turn design elements into temporary site elements without explicit classification.
- Do not replace detailed scheduling tools; integrate with them.
- Do not hide design changes that affect execution status.

## Implementation Prompt

Implement the Construction Lens as the Bauausfuehrung workflow layer for phasing, packages, progress, logistics, and QA. It should be usable by site teams while preserving the design model and producing traceable status data for project management tools.
