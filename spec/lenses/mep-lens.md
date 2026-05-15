# MEP Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with an existing Discipline Lens architecture. The model already supports building elements, rooms, shafts, openings, 3D views, sections, sheets, schedules, real-time collaboration, and cloud APIs.

The MEP Lens supports technical building services. In German product language, this lens is **TGA** or **Technische Gebaeudeausruestung**.

## Lens Identity

- Lens ID: `mep`
- English name: MEP
- German name: TGA / Technische Gebaeudeausruestung
- Primary users: HVAC, plumbing, electrical, fire-suppression, and building-services coordinators
- Existing status: implemented in the UI lens cycle

## Design Principle

The MEP Lens should treat spaces, shafts, openings, and host elements as shared constraints. MEP users author systems and equipment in the same building model and coordinate penetration requests against architecture and structure instead of creating disconnected service drawings.

## Functional Scope

### 1. System Authoring

Prominent commands:

- Ducts
- Pipes
- Cable trays/conduits
- Equipment
- Fixtures
- Diffusers and terminals
- Shafts
- Penetration/opening request
- System tagging

### 2. System Classification

Expose properties:

- `systemType`: HVAC supply, HVAC return, heating, cooling, domestic water, wastewater, electrical, data, fire protection
- `systemName`
- `flowDirection`
- `diameter` / `width` / `height`
- `insulation`
- `serviceLevel`
- `clearanceZone`
- `maintainAccessZone`

### 3. Room and Zone Integration

Rooms gain MEP-relevant data:

- Ventilation zone
- Heating/cooling zone
- Design air change rate
- Fixture/equipment loads
- Electrical load summary
- Service requirements

### 4. Coordination

MEP Lens must integrate tightly with Coordination Lens:

- Clash highlighting
- Opening requests through walls/slabs/roofs
- Shaft reservation
- Clearance envelopes
- Change notification when architecture or structure moves host geometry

## Schedules

Required schedule defaults:

- Equipment schedule
- Duct schedule
- Pipe schedule
- Fixture schedule
- Opening request schedule
- Shaft schedule
- Electrical load schedule

## Views and Sheets

Provide:

- MEP floor plans grouped by system
- Reflected ceiling plan overlays
- Shaft and riser diagrams
- 3D system isolation views
- Coordination sections

## API Requirements

Expose systems, equipment, connectors, room-zone relationships, and opening requests. The API should allow specialist MEP tools to import/export system data without flattening the building model.

## Non-Goals

- Do not build a full hydraulic, electrical, or HVAC sizing engine inside this lens.
- Do not let MEP openings mutate structural or architectural elements without traceable requests or approvals.
- Do not require architecture users to see full MEP property sets.

## Implementation Prompt

Implement the MEP Lens as the TGA authoring and coordination layer. Foreground services and equipment, expose system-aware inspectors, add schedules for systems and opening requests, and make shaft/opening coordination a first-class workflow connected to architecture and structure.
