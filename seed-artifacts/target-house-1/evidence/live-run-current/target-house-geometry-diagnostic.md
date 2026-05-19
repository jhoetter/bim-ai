# Target House 1 Current Geometry Diagnostic

Schema: `target-house-current-geometry-diagnostic.v1`
Target: `target-house-1`
Snapshot: `target-house-1-offline-regenerated` revision `2`

## Summary

- Total findings: 97
- Errors: 97
- Warnings: 0

| Category | Count |
| --- | ---: |
| `detached_or_flying` | 11 |
| `helper_leakage` | 52 |
| `out_of_envelope` | 16 |
| `sketch_critical_mismatch` | 16 |
| `unsupported_renderer_feature` | 2 |

## Bounds

- Target envelope: {"minX":0,"minY":0,"maxX":14000,"maxY":10000}
- Current physical/sketch bounds: {"minX":0,"minY":-450,"maxX":8300,"maxY":8200}

## Findings

| Category | Severity | Code | Elements | Evidence |
| --- | --- | --- | --- | --- |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `front-loggia-left-return` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":1350,"boundsMm":{"minX":1200,"minY":-450,"maxX":1200,"maxY":900}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `front-loggia-recessed-glass` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":6100,"boundsMm":{"minX":1350,"minY":820,"maxX":7450,"maxY":820}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `front-loggia-right-return` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":1350,"boundsMm":{"minX":7600,"minY":-450,"maxX":7600,"maxY":900}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `hf-roof-court-front-return` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":2600,"boundsMm":{"minX":5300,"minY":3000,"maxX":7900,"maxY":3000}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `hf-roof-court-glass-back` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":2600,"boundsMm":{"minX":5300,"minY":6600,"maxX":7900,"maxY":6600}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `target-house-gf-living-access-partition` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":4500,"boundsMm":{"minX":3400,"minY":700,"maxX":3400,"maxY":5200}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `target-house-l1-bath-landing-access-partition` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":1400,"boundsMm":{"minX":5200,"minY":1600,"maxX":5200,"maxY":3000}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `target-house-l1-bedroom-bath-access-partition` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":4900,"boundsMm":{"minX":3450,"minY":1600,"maxX":3450,"maxY":6500}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `target-house-l1-closet-access-partition` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":2000,"boundsMm":{"minX":2600,"minY":4500,"maxX":2600,"maxY":6500}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `target-house-l1-ensuite-bath-access-partition` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":700,"boundsMm":{"minX":3600,"minY":4300,"maxX":4300,"maxY":4300}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `target-house-l1-landing-access-partition` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":2400,"boundsMm":{"minX":5200,"minY":1000,"maxX":7600,"maxY":1000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-1` | {"boundsMm":{"minX":3600,"minY":1600,"maxX":5200,"maxY":1600}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-2` | {"boundsMm":{"minX":5200,"minY":1600,"maxX":5200,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-3` | {"boundsMm":{"minX":3600,"minY":4300,"maxX":5200,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-4` | {"boundsMm":{"minX":3600,"minY":1600,"maxX":3600,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-1` | {"boundsMm":{"minX":600,"minY":700,"maxX":1100,"maxY":700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-2` | {"boundsMm":{"minX":1100,"minY":700,"maxX":1100,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-3` | {"boundsMm":{"minX":600,"minY":6500,"maxX":1100,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-4` | {"boundsMm":{"minX":600,"minY":700,"maxX":600,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-1` | {"boundsMm":{"minX":2700,"minY":4300,"maxX":4300,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-2` | {"boundsMm":{"minX":4300,"minY":4300,"maxX":4300,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-3` | {"boundsMm":{"minX":2700,"minY":6500,"maxX":4300,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-4` | {"boundsMm":{"minX":2700,"minY":4300,"maxX":2700,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-1` | {"boundsMm":{"minX":6800,"minY":700,"maxX":8300,"maxY":700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-2` | {"boundsMm":{"minX":8300,"minY":700,"maxX":8300,"maxY":3100}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-3` | {"boundsMm":{"minX":6800,"minY":3100,"maxX":8300,"maxY":3100}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-4` | {"boundsMm":{"minX":6800,"minY":700,"maxX":6800,"maxY":3100}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-1` | {"boundsMm":{"minX":1200,"minY":3700,"maxX":3400,"maxY":3700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-2` | {"boundsMm":{"minX":3400,"minY":3700,"maxX":3400,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-3` | {"boundsMm":{"minX":1200,"minY":6500,"maxX":3400,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-4` | {"boundsMm":{"minX":1200,"minY":3700,"maxX":1200,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-1` | {"boundsMm":{"minX":5200,"minY":1000,"maxX":7600,"maxY":1000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-2` | {"boundsMm":{"minX":7600,"minY":1000,"maxX":7600,"maxY":3000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-3` | {"boundsMm":{"minX":5200,"minY":3000,"maxX":7600,"maxY":3000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-4` | {"boundsMm":{"minX":5200,"minY":1000,"maxX":5200,"maxY":3000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-loggia-1` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":7600,"maxY":-450}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-loggia-2` | {"boundsMm":{"minX":7600,"minY":-450,"maxX":7600,"maxY":900}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-loggia-3` | {"boundsMm":{"minX":1200,"minY":900,"maxX":7600,"maxY":900}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-loggia-4` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":1200,"maxY":900}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-utility-1` | {"boundsMm":{"minX":6800,"minY":3300,"maxX":8300,"maxY":3300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-utility-2` | {"boundsMm":{"minX":8300,"minY":3300,"maxX":8300,"maxY":5000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-utility-3` | {"boundsMm":{"minX":6800,"minY":5000,"maxX":8300,"maxY":5000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-utility-4` | {"boundsMm":{"minX":6800,"minY":3300,"maxX":6800,"maxY":5000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-walk-in-closet-1` | {"boundsMm":{"minX":600,"minY":4500,"maxX":2500,"maxY":4500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-walk-in-closet-2` | {"boundsMm":{"minX":2500,"minY":4500,"maxX":2500,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-walk-in-closet-3` | {"boundsMm":{"minX":600,"minY":6500,"maxX":2500,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-walk-in-closet-4` | {"boundsMm":{"minX":600,"minY":4500,"maxX":600,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-bedroom-1` | {"boundsMm":{"minX":600,"minY":1600,"maxX":3300,"maxY":1600}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-bedroom-2` | {"boundsMm":{"minX":3300,"minY":1600,"maxX":3300,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-bedroom-3` | {"boundsMm":{"minX":600,"minY":4300,"maxX":3300,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-bedroom-4` | {"boundsMm":{"minX":600,"minY":1600,"maxX":600,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-hall-1` | {"boundsMm":{"minX":1200,"minY":700,"maxX":3400,"maxY":700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-hall-2` | {"boundsMm":{"minX":3400,"minY":700,"maxX":3400,"maxY":3600}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-hall-3` | {"boundsMm":{"minX":1200,"minY":3600,"maxX":3400,"maxY":3600}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-hall-4` | {"boundsMm":{"minX":1200,"minY":700,"maxX":1200,"maxY":3600}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-living-1` | {"boundsMm":{"minX":3600,"minY":700,"maxX":6500,"maxY":700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-living-2` | {"boundsMm":{"minX":6500,"minY":700,"maxX":6500,"maxY":5200}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-living-3` | {"boundsMm":{"minX":3600,"minY":5200,"maxX":6500,"maxY":5200}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-living-4` | {"boundsMm":{"minX":3600,"minY":700,"maxX":3600,"maxY":5200}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-terrace-1` | {"boundsMm":{"minX":5400,"minY":3300,"maxX":8000,"maxY":3300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-terrace-2` | {"boundsMm":{"minX":8000,"minY":3300,"maxX":8000,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-terrace-3` | {"boundsMm":{"minX":5400,"minY":6500,"maxX":8000,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-room-terrace-4` | {"boundsMm":{"minX":5400,"minY":3300,"maxX":5400,"maxY":6500}} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `hf-room-carport` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":600,"minY":700,"maxX":1100,"maxY":6500},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":8300,"maxY":8200},"directions":["west"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `front-loggia-left-return` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":1200,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `front-loggia-right-return` | {"boundsMm":{"minX":7600,"minY":-450,"maxX":7600,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-front-loggia-floor` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":7600,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-front-loggia-railing` | {"boundsMm":{"minX":1300,"minY":-350,"maxX":7500,"maxY":-350},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-roof-main` | {"boundsMm":{"minX":0,"minY":-450,"maxX":8000,"maxY":8200},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-room-loggia` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":7600,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-upper-wrapper-shell-wall-01-right` | {"boundsMm":{"minX":7600,"minY":-450,"maxX":8000,"maxY":-450},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-upper-wrapper-shell-wall-01` | {"boundsMm":{"minX":0,"minY":-450,"maxX":1200,"maxY":-450},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-upper-wrapper-shell-wall-02` | {"boundsMm":{"minX":8000,"minY":-450,"maxX":8000,"maxY":8200},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-upper-wrapper-shell-wall-04` | {"boundsMm":{"minX":0,"minY":-450,"maxX":0,"maxY":8200},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `sep-hf-room-loggia-1` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":7600,"maxY":-450},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `sep-hf-room-loggia-2` | {"boundsMm":{"minX":7600,"minY":-450,"maxX":7600,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `sep-hf-room-loggia-4` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":1200,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `upper-wrapper-floor` | {"boundsMm":{"minX":0,"minY":-450,"maxX":8000,"maxY":8200},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `upper-wrapper-front-fascia` | {"boundsMm":{"minX":0,"minY":-450,"maxX":8000,"maxY":-450},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `sketch_critical_mismatch` | error | `sketch.opening_rhythm_window_count_low` | `front-loggia-left-window`<br>`front-loggia-right-window` | {"currentWindowCount":2,"requiredFeatureId":"opening_and_glazing_rhythm"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_gf_bath_laundry","requiredName":"Bath / laundry","semanticSelector":"room:room_gf_bath_laundry"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_gf_carport","requiredName":"Recessed garage / carport","semanticSelector":"room:room_gf_carport"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_gf_entry","requiredName":"Entry / stair hall","semanticSelector":"room:room_gf_entry"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_gf_kitchen_dining","requiredName":"Kitchen / dining","semanticSelector":"room:room_gf_kitchen_dining"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_gf_living","requiredName":"Living area","semanticSelector":"room:room_gf_living"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_gf_utility","requiredName":"Utility","semanticSelector":"room:room_gf_utility"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_bedroom_2","requiredName":"Bedroom 2","semanticSelector":"room:room_l1_bedroom_2"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_deep_loggia","requiredName":"Deep balcony / loggia","semanticSelector":"room:room_l1_deep_loggia"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_ensuite","requiredName":"Ensuite","semanticSelector":"room:room_l1_ensuite"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_hall_landing","requiredName":"Hall / landing","semanticSelector":"room:room_l1_hall_landing"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_primary_bedroom","requiredName":"Primary bedroom","semanticSelector":"room:room_l1_primary_bedroom"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_roof_court","requiredName":"Open-to-sky roof court / void","semanticSelector":"room:room_l1_roof_court"} |
| `sketch_critical_mismatch` | error | `sketch.required_room_id_missing` | - | {"requiredRoomId":"room_l1_walk_in_closet","requiredName":"Walk-in closet","semanticSelector":"room:room_l1_walk_in_closet"} |
| `sketch_critical_mismatch` | error | `sketch.roof_court_dimensions_not_met` | `hf-roof-court-opening` | {"actualWidthMm":2600,"actualDepthMm":3600,"expectedWidthMm":5300,"expectedDepthMm":4200} |
| `sketch_critical_mismatch` | error | `sketch.scale_basis_not_met` | - | {"modelBoundsMm":{"minX":0,"minY":-450,"maxX":8300,"maxY":8200},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"modelWidthMm":8300,"modelDepthMm":8650,"targetWidthMm":14000,"targetDepthMm":10000,"widthRatio":0.593,"depthRatio":0.865} |
| `unsupported_renderer_feature` | error | `renderer.roof_opening.asymmetric_gable_unproven` | `hf-roof-court-opening`<br>`hf-roof-main` | {"hostRoofId":"hf-roof-main","hostRoofGeometryMode":"asymmetric_gable","diagnosticCodesRequired":["renderer.roof_opening.unsupported","renderer.roof_opening.failed_cut"]} |
| `unsupported_renderer_feature` | error | `renderer.slab_opening.stair_penetration_unproven` | `main-stair-upper-opening`<br>`upper-wrapper-floor` | {"hostFloorId":"upper-wrapper-floor","diagnosticCodesRequired":["renderer.slab_opening.unsupported","renderer.slab_opening.failed_cut"]} |

## Rule Catalog

- `geometry.element_outside_source_envelope` (out_of_envelope): Element 2D bounds must remain inside the source target envelope unless a tolerance records another origin/scale.
- `geometry.element_outside_level_floor_support` (out_of_envelope): Level-resolved elements must be supported by the floor/slab footprint for that level.
- `geometry.wall_detached_endpoint` (detached_or_flying): Wall endpoints should connect to wall topology or be explicitly documented as free edges.
- `geometry.hosted_opening_on_access_stub` (detached_or_flying): Door/window hosts must be real enclosing walls, not synthetic access-helper stubs.
- `geometry.railing_unhosted_no_level` (detached_or_flying): Railings need an explicit host edge/stair or level relation.
- `helper.room_separation.visible_in_snapshot` (helper_leakage): Room separation lines are analysis/helper geometry and must not be confused with physical BIM.
- `helper.*.access_stub_visible_in_snapshot` (helper_leakage): Access-helper wall/door stubs are not target-house physical architecture.
- `renderer.*` (unsupported_renderer_feature): Partial renderer support must produce structured diagnostics for target-house-critical evidence.
- `sketch.*` (sketch_critical_mismatch): Machine-readable target-house scale, room, opening, and roof-court requirements must bind to the snapshot.
