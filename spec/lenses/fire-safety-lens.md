# Fire Safety Lens for Cloud-Native BIM Platform

## Lens Identity

- Lens ID: `fire-safety`
- English name: Fire Safety
- German name: Brandschutz
- Primary users: fire-safety consultants, architects, approval planners, BIM coordinators
- Implementation status: implemented as property, overlay, schedule, and review layer

## Design Principle

Fire safety data attaches to the shared architectural and technical model. Fire compartments,
rated walls, escape routes, and door requirements are overlays and property sets on the same rooms,
walls, doors, stairs, shafts, and penetrations.

## Workpackages

1. Lens identity and overlay behavior
   - Add Fire Safety / Brandschutz lens identity.
   - Support `show_fire_safety` on saved views and foreground fire-relevant shared elements.
   - Keep architectural, structural, and MEP discipline tags unchanged.

2. Fire compartments and rated elements
   - Read compartment metadata from room `props`.
   - Aggregate compartment area, volume, smoke compartments, resistance requirements, and closure status.
   - Surface wall/floor/ceiling/door fire ratings, smoke-control ratings, and self-closing requirements.

3. Escape routes and penetration review
   - Surface route ID, travel distance, exit width, swing compliance, stair/corridor classifications,
     and assembly-point notes.
   - Surface rated-assembly penetrations, firestop status, approval status, responsible trade, and
     inspection evidence.

4. Schedules, views, sheets, and API review payload
   - Provide schedule defaults for compartments, rated elements, fire doors, escape routes,
     firestop penetrations, and smoke-control equipment.
   - Publish view defaults for compartment plans, escape route plans, rated wall overlays, and
     firestop review views.
   - Publish approval and review sheet defaults.
   - Expose a read-only `fireSafetyLensReviewStatus_v1` payload for external code-review and
     reporting tools.

## Non-Goals

- Do not claim jurisdictional fire-code approval.
- Do not compute final legally binding occupant-load or egress approval without a certified ruleset.
- Do not duplicate architectural rooms as fire-only spaces.
