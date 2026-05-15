# Lens Catalog for Cloud-Native BIM Platform

## What We Have Today

The current UI lens dropdown cycles these lenses:

| Lens ID | English name | German name | Current role |
|---|---|---|---|
| `all` | All | Alle Gewerke | Shows all model elements in foreground. No discipline-specific property scope. |
| `architecture` | Architecture | Architektur | Foregrounds architectural elements and architectural authoring workflows. |
| `structure` | Structure | Tragwerk | Foregrounds structural elements and structural authoring workflows. |
| `mep` | MEP | TGA / Technische Gebaeudeausruestung | Foregrounds mechanical, electrical, plumbing, and building-services elements. |

The core type system already anticipates additional lens IDs:

| Lens ID | English name | German name | Status |
|---|---|---|---|
| `coordination` | Coordination | Koordination | Present in core type vocabulary; not yet in the UI cycle. |
| `energy` | Energy Consulting | Energieberatung | Present in core type vocabulary; not yet in the UI cycle. |

## What Lenses Should Exist

The recommended lens set separates discipline work, regulatory/analysis work, and lifecycle work while keeping one shared BIM model:

| Priority | Lens ID | English name | German name | Why it exists |
|---|---|---|---|---|
| 1 | `architecture` | Architecture | Architektur | Default planning and authoring lens for rooms, envelope geometry, openings, sheets, and architectural documentation. |
| 1 | `structure` | Structure | Tragwerk | Structural modeling, load-bearing classification, levels, grids, columns, beams, slabs, foundations, and structural documentation. |
| 1 | `mep` | MEP | TGA / Technische Gebaeudeausruestung | Building-services model authoring and coordination: HVAC, plumbing, electrical, shafts, equipment, and systems. |
| 1 | `coordination` | Coordination | Koordination | Cross-discipline model QA: clashes, issue ownership, links, model health, changes, and review views. |
| 1 | `energy` | Energy Consulting | Energieberatung | German energy-consultant workflow for thermal envelope classification, U-values, GEG/iSFP/BEG handoff data, and export to calculation tools. |
| 2 | `fire-safety` | Fire Safety | Brandschutz | Fire compartments, escape routes, fire ratings, openings, doors, smoke control, and code-review handoff. |
| 2 | `cost-quantity` | Cost and Quantity | Kosten und Mengen | Quantity takeoff, cost groups, DIN 276-style breakdowns, procurement exports, and scenario comparison. |
| 2 | `construction` | Construction / Execution | Bauausfuehrung | Phasing, temporary works, installation sequence, site logistics, progress, QA checklists, and as-built capture. |
| 2 | `sustainability` | Sustainability / LCA | Nachhaltigkeit / Oekobilanz | Embodied carbon, material declarations, circularity, reuse, EPD references, and LCA exports. |
| 2 | `facility-operations` | Facility Operations | Betrieb / Facility Management | Asset registers, maintainable equipment, service intervals, handover, operations metadata, and API access for owners. |

## Lens Design Rule

A lens is not a separate model. A lens is a view, property, schedule, tool, and export scope over the same shared elements.

Every lens must define:

- Which existing elements it foregrounds or ghosts.
- Which properties it adds or surfaces.
- Which schedules and sheets it introduces.
- Which tools become prominent.
- Which exports and API surfaces it owns.
- Which workflows are explicitly out of scope.

## Files

- [Architecture Lens](architecture-lens.md)
- [Structure Lens](structure-lens.md)
- [MEP Lens](mep-lens.md)
- [Coordination Lens](coordination-lens.md)
- [Energy Lens](energy-lens.md)
- [Fire Safety Lens](fire-safety-lens.md)
- [Cost and Quantity Lens](cost-quantity-lens.md)
- [Construction Lens](construction-lens.md)
- [Sustainability Lens](sustainability-lens.md)
- [Facility Operations Lens](facility-operations-lens.md)
