# Structure Lens for Cloud-Native BIM Platform
## Requirements and Implementation Tracker

## Context

You are working on a cloud-native, AI-native BIM platform with an existing Discipline Lens architecture. The platform already supports model elements, levels, grids, wall/floor/roof types, 3D views, sections, schedules, sheets, collaboration, and cloud APIs.

The Structure Lens supports structural engineers and BIM authors who need load-bearing classification, structural framing, foundations, analytical readiness, coordination, and structural documentation. In German product language, this lens is **Tragwerk**.

## Lens Identity

- Lens ID: `structure`
- English name: Structure
- German name: Tragwerk
- Alternate German UI label: Statik, when referring to the user workspace rather than the model scope
- Primary users: structural engineers, structural BIM coordinators, architects checking load-bearing scope
- Existing status: implemented in the UI lens cycle

## Design Principle

The Structure Lens does not create a second structural model. It classifies and enriches the same walls, slabs, roofs, columns, beams, stairs, and foundations with structural intent. Architectural geometry remains live; structural users can flag mismatches instead of silently forking geometry.

## Functional Scope

### 1. Structural Visibility

Foreground:

- Columns
- Beams
- Load-bearing walls
- Structural slabs and roofs
- Foundations
- Stairs and railings when structurally relevant
- Grids, levels, reference planes

Ghost:

- Non-load-bearing partitions
- Doors, windows, finishes, loose furniture/assets
- MEP and annotation unless coordination mode is active

### 2. Structural Classification

Expose element-level properties:

- `loadBearing`: true / false / unknown
- `structuralRole`: bearing wall, shear wall, slab, beam, column, foundation, brace
- `structuralMaterial`: concrete, steel, timber, masonry, composite, other
- `fireResistanceRating` as a linked value, not owned by this lens
- `analysisStatus`: not modeled, ready for export, needs review

### 3. Structural Authoring

Prominent commands:

- Column
- Beam
- Structural wall toggle
- Slab/floor structural role
- Foundation / footing
- Opening review
- Grid and level tools
- Section through structure

### 4. Structural Review

Add review checks:

- Unsupported beams
- Columns not reaching level or foundation
- Load-bearing walls with unmanaged openings
- Slab edges without support
- Inconsistent structural material by type
- Missing grids for repeated structural bays

## Schedules

Required schedule defaults:

- Structural elements schedule
- Column schedule
- Beam schedule
- Structural wall schedule
- Foundation schedule
- Opening-in-load-bearing-wall review

## Sheets and Views

The lens should provide:

- Structural plan views
- Framing views
- Foundation plan
- Structural sections
- Axonometric structural review views
- Optional analytical export views

## API Requirements

Expose structural classification and structural element geometry for external analysis and coordination tools. The platform should not claim to be a certified structural calculation engine unless a future integration explicitly provides that responsibility.

## Non-Goals

- Do not perform final structural code design or liability-bearing calculations.
- Do not fork architectural walls into separate structural walls.
- Do not hide coordination conflicts with MEP or architecture.

## Implementation Prompt

Implement the Structure Lens as a structural classification, authoring, review, and documentation layer over the shared BIM model. Foreground structural elements, expose load-bearing and structural-role properties, add structural schedules, and provide review checks that identify modeling gaps before export to specialist structural tools.

## Implementation Tracker

Status as of 2026-05-15: complete and merged to `main`.

- [x] Workpackage 1: structural visibility and classification model fields.
  - Implemented in `c52b04628` and merged via `7954479e7`.
- [x] Workpackage 2: structural schedules and API export support.
  - Implemented in `fea61fc9d` and merged via `7954479e7`.
- [x] Workpackage 3: structural review advisories.
  - Implemented in `7bbc2b0a1` and merged via `7954479e7`.
- [x] Workpackage 4: structural authoring commands, presets, and defaults.
  - Implemented in `4921abb17` and merged via `7954479e7`.

Verification completed before merge:

- [x] Backend focused tests: `uv run pytest --no-cov tests/test_structure_lens.py tests/test_constructability_load_bearing_schema.py tests/test_mep_lens.py tests/test_cost_quantity_lens.py`
- [x] Frontend focused tests: `pnpm --dir packages/web exec vitest run src/cmdPalette/defaultCommands.test.ts src/workspace/commandCapabilities.test.ts src/schedules/scheduleDefinitionPresets.test.ts src/viewport/useLensFilter.test.ts`
- [x] JSON template validation for structure-related seed/template data.

Merge and remote status:

- [x] Feature branch pushed: `origin/codex/structure-lens-workpackages-20260514`
- [x] Structure workpackages merged into `main`.
- [x] `origin/main` contains `4921abb17`.
