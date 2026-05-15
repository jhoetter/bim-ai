# Facility Operations Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with model elements, spaces, systems, equipment, schedules, sheets, collaboration, versioning, and cloud APIs.

The Facility Operations Lens supports handover, asset registers, maintenance metadata, and owner-facing operations workflows. In German product language, this lens is **Betrieb** or **Facility Management**.

## Lens Identity

- Lens ID: `facility-operations`
- English name: Facility Operations
- German name: Betrieb / Facility Management
- Alternate German labels: Betreiber, Gebaeudebetrieb
- Primary users: building owners, facility managers, operators, maintenance teams
- Existing status: recommended new lens

## Design Principle

Operations data should be attached to maintainable assets, spaces, and systems in the same model used for design and construction. The lens should convert BIM into a living owner data set instead of a static handover file.

## Functional Scope

### 1. Asset Register

Maintainable elements gain:

- Asset ID
- Manufacturer
- Model
- Serial number
- Warranty dates
- Installation date
- Expected service life
- Maintenance interval
- Replacement cost placeholder
- Documentation links

### 2. Space and System Context

Expose:

- Room served
- System membership
- Access requirements
- Shutoff/isolation notes
- Spare parts
- Responsible service provider

### 3. Maintenance Workflow

Support:

- Inspection status
- Work order link
- Maintenance history
- Photo evidence
- Defect pins
- Lifecycle replacement notes

## Schedules

Required schedule defaults:

- Asset register
- Equipment maintenance schedule
- Warranty schedule
- Spare parts schedule
- Defect list
- Room asset list

## Views and Sheets

Provide:

- Color by maintenance status
- Highlight overdue inspections
- Asset location views
- Equipment access zones
- Handover sheets

## API Requirements

Expose assets, spaces, systems, warranties, maintenance metadata, documents, and issue references. APIs should support CAFM/IWMS integrations.

## Non-Goals

- Do not require every architectural element to become an FM asset.
- Do not replace full CAFM systems; integrate with them.
- Do not lose traceability back to design and construction versions.

## Implementation Prompt

Implement the Facility Operations Lens as the owner handover and operating-data layer. It should turn selected model elements into maintainable assets, connect them to rooms and systems, expose schedules and APIs for operations tools, and keep design/construction provenance intact.
