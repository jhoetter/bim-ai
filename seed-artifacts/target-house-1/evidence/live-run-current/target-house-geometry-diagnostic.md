# Target House 1 Current Geometry Diagnostic

Schema: `target-house-current-geometry-diagnostic.v1`
Target: `target-house-1`
Snapshot: `target-house-1-offline-regenerated` revision `2`

## Summary

- Total findings: 0
- Errors: 0
- Warnings: 0

| Category | Count |
| --- | ---: |

## Bounds

- Target envelope: {"minX":0,"minY":0,"maxX":14000,"maxY":10000}
- Current physical/sketch bounds: {"minX":0,"minY":0,"maxX":14000,"maxY":10000}

## Findings

| Category | Severity | Code | Elements | Evidence |
| --- | --- | --- | --- | --- |

## Rule Catalog

- `geometry.element_outside_source_envelope` (out_of_envelope): Element 2D bounds must remain inside the source target envelope unless a tolerance records another origin/scale.
- `geometry.element_outside_level_floor_support` (out_of_envelope): Level-resolved elements must be supported by the floor/slab footprint for that level.
- `site.*_partially_outside_*` (out_of_envelope): Target-house building and toposolid/site placement must use full footprint containment, not centroid-only checks.
- `geometry.wall_detached_endpoint` (detached_or_flying): Wall endpoints should connect to wall topology or be explicitly documented as free edges.
- `geometry.hosted_opening_on_access_stub` (detached_or_flying): Door/window hosts must be real enclosing walls, not synthetic access-helper stubs.
- `geometry.railing_unhosted_no_level` (detached_or_flying): Railings need an explicit host edge/stair or level relation.
- `helper.room_separation.visible_in_snapshot` (helper_leakage): Room separation lines are analysis/helper geometry and must not be confused with physical BIM.
- `helper.*.access_stub_visible_in_snapshot` (helper_leakage): Access-helper wall/door stubs are not target-house physical architecture.
- `renderer.*` (unsupported_renderer_feature): Partial renderer support must produce structured diagnostics for target-house-critical evidence.
- `sketch.*` (sketch_critical_mismatch): Machine-readable target-house scale, room, opening, and roof-court requirements must bind to the snapshot.
