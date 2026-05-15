# Fire Safety Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with shared building elements, rooms, doors, windows, openings, stairs, corridors, shafts, sections, sheets, schedules, collaboration, and cloud APIs.

The Fire Safety Lens supports code-review and fire-protection planning workflows. In German product language, this lens is **Brandschutz**.

## Lens Identity

- Lens ID: `fire-safety`
- English name: Fire Safety
- German name: Brandschutz
- Primary users: fire-safety consultants, architects, approval planners, BIM coordinators
- Existing status: recommended new lens

## Design Principle

Fire safety data must attach to the shared architectural and technical model. Fire compartments, rated walls, escape routes, and door requirements are overlays and property sets on the same rooms, walls, doors, stairs, and shafts.

## Functional Scope

### 1. Fire Compartments

Support:

- Compartment boundaries
- Compartment IDs and names
- Fire-resistance requirements
- Smoke compartments
- Area and volume checks
- Boundary closure checks

### 2. Rated Elements

Expose:

- Wall/floor/ceiling fire rating
- Door fire rating
- Door smoke-control rating
- Self-closing requirement
- Shaft enclosure rating
- Penetration firestop status

### 3. Escape Routes

Support:

- Escape route paths
- Travel distance estimates
- Exit width and door swing checks
- Stair and corridor classification
- Assembly point notes

### 4. Penetration Review

Fire Safety Lens must integrate with MEP and Coordination:

- Firestop markers
- Rated-wall penetration list
- Approval status
- Responsible trade
- Inspection evidence

## Schedules

Required schedule defaults:

- Fire compartment schedule
- Rated wall/floor schedule
- Fire door schedule
- Escape route schedule
- Firestop penetration schedule
- Smoke control equipment schedule

## Views and Sheets

Provide:

- Fire compartment plans
- Escape route plans
- Rated wall overlays
- Firestop review views
- Approval sheets

## API Requirements

Expose compartments, ratings, escape routes, penetrations, and review statuses. Support external code-review and reporting tools without embedding jurisdiction-specific legal conclusions in the base model.

## Non-Goals

- Do not claim jurisdictional fire-code approval.
- Do not compute final legally binding occupant-load or egress approval without a certified ruleset.
- Do not duplicate architectural rooms as fire-only spaces.

## Implementation Prompt

Implement the Fire Safety Lens as the Brandschutz property, overlay, schedule, and review layer. It should classify compartments and rated elements, surface escape route and penetration workflows, and provide auditable schedules and sheets for consultant review.
