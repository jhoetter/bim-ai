# Architecture Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with an existing Discipline Lens architecture. The platform already has walls, wall types, floors, roofs, rooms, doors, windows, levels, plan views, 3D views, sections, sheets, schedules, collaboration, and cloud APIs.

The Architecture Lens is the primary planning lens for architects and design teams. It is where the building's spatial, envelope, opening, and documentation model is authored. In German product language, this lens is **Architektur**.

## Lens Identity

- Lens ID: `architecture`
- English name: Architecture
- German name: Architektur
- Primary users: architects, design leads, drafting teams, BIM authors
- Existing status: implemented in the UI lens cycle

## Design Principle

The Architecture Lens owns the architectural truth of the model but does not block other lenses. Structural, MEP, energy, fire, cost, and operations data can be attached to the same elements, but the Architecture Lens should show only the properties and commands that architects need during design and documentation.

## Functional Scope

### 1. Architectural Authoring

Surface the core modeling commands for:

- Walls, floors, roofs, ceilings
- Doors, windows, openings
- Stairs, railings, shafts
- Rooms, areas, tags, dimensions, annotation
- Levels, grids, reference planes, crop regions
- Sheets, schedules, plan views, sections, and saved 3D views

### 2. Spatial Model

Rooms and areas are first-class architectural concepts:

- Room name, number, department, area, volume
- Room-bounding behavior
- Finish references
- Occupancy notes
- Design option or phase membership

### 3. Architectural Types

Expose type editors for:

- Wall, floor, roof, ceiling type composition
- Door and window family/type parameters
- Finish/material appearance
- Fire, acoustic, energy, and cost properties only as compact read-only badges unless explicitly expanded

### 4. Documentation

Architecture Lens should prioritize documentation production:

- Plan view templates
- Sections and elevations
- Sheet placement
- Room schedules
- Door and window schedules
- Annotation and revision workflow

### 5. Graphics

Default overlays:

- Clean architectural linework
- Room fills and tags
- Door/window swing symbols
- Crop and annotation extents

Optional overlays:

- Structural ghosting
- MEP ghosting
- Coordination issue pins
- Energy-envelope badges when requested

## Data Model Extensions

No parallel architecture data model is required. This lens primarily surfaces existing fields and should avoid adding architecture-only duplicates.

If new fields are needed, prefer generic element properties:

- `designIntent`
- `roomFunction`
- `finishSetId`
- `documentationStatus`
- `viewTemplateId`

## Schedules

Required schedule defaults:

- Room schedule
- Door schedule
- Window schedule
- Finish schedule
- Sheet list
- View list

## API Requirements

The API must allow third-party tools to query architectural geometry, types, rooms, views, sheets, and schedules without requiring the client to know about internal UI state.

## Non-Goals

- Do not make Architecture Lens a catch-all for every consultant property.
- Do not duplicate thermal, fire, cost, or operations data in architectural shadow fields.
- Do not hide model health issues that affect architectural deliverables.

## Implementation Prompt

Implement the Architecture Lens as the default authoring and documentation lens. It should foreground architectural elements, provide the complete architectural modeling toolbar, show architecture-first inspectors, and expose standard architectural schedules and sheets. Consultant data stays attached to the same model but appears as compact badges or expandable read-only sections unless the user switches to the owning lens.
