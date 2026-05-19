# Target House 1 Current Geometry Diagnostic

Schema: `target-house-current-geometry-diagnostic.v1`
Target: `target-house-1`
Snapshot: `6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2` revision `1`

## Summary

- Total findings: 155
- Errors: 152
- Warnings: 3

| Category | Count |
| --- | ---: |
| `detached_or_flying` | 33 |
| `helper_leakage` | 78 |
| `out_of_envelope` | 20 |
| `sketch_critical_mismatch` | 16 |
| `unsupported_renderer_feature` | 8 |

## Bounds

- Target envelope: {"minX":0,"minY":0,"maxX":14000,"maxY":10000}
- Current physical/sketch bounds: {"minX":0,"minY":-450,"maxX":8300,"maxY":8200}

## Findings

| Category | Severity | Code | Elements | Evidence |
| --- | --- | --- | --- | --- |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-bath`<br>`access-wall-hf-room-bath` | {"hostWallId":"access-wall-hf-room-bath","hostLengthMm":945,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-carport`<br>`access-wall-hf-room-carport` | {"hostWallId":"access-wall-hf-room-carport","hostLengthMm":950,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-ensuite`<br>`access-wall-hf-room-ensuite` | {"hostWallId":"access-wall-hf-room-ensuite","hostLengthMm":700,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-gf-bath-laundry`<br>`access-wall-hf-room-gf-bath-laundry` | {"hostWallId":"access-wall-hf-room-gf-bath-laundry","hostLengthMm":600,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-kitchen`<br>`access-wall-hf-room-kitchen` | {"hostWallId":"access-wall-hf-room-kitchen","hostLengthMm":950,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-landing`<br>`access-wall-hf-room-landing` | {"hostWallId":"access-wall-hf-room-landing","hostLengthMm":770,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-loggia`<br>`access-wall-hf-room-loggia` | {"hostWallId":"access-wall-hf-room-loggia","hostLengthMm":950,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-utility`<br>`access-wall-hf-room-utility` | {"hostWallId":"access-wall-hf-room-utility","hostLengthMm":700,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-hf-room-walk-in-closet`<br>`access-wall-hf-room-walk-in-closet` | {"hostWallId":"access-wall-hf-room-walk-in-closet","hostLengthMm":700,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-room-bedroom`<br>`access-wall-room-bedroom` | {"hostWallId":"access-wall-room-bedroom","hostLengthMm":600,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-room-hall`<br>`access-wall-room-hall` | {"hostWallId":"access-wall-room-hall","hostLengthMm":600,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-room-living`<br>`access-wall-room-living` | {"hostWallId":"access-wall-room-living","hostLengthMm":700,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.hosted_opening_on_access_stub` | `access-door-room-terrace`<br>`access-wall-room-terrace` | {"hostWallId":"access-wall-room-terrace","hostLengthMm":950,"alongT":0.5} |
| `detached_or_flying` | error | `geometry.railing_unhosted_no_level` | `hf-front-loggia-railing` | {"pathMm":[{"xMm":1300,"yMm":-350},{"xMm":7500,"yMm":-350}],"guardHeightMm":1040} |
| `detached_or_flying` | error | `geometry.railing_unhosted_no_level` | `hf-roof-court-railing` | {"pathMm":[{"xMm":7850,"yMm":3100},{"xMm":7850,"yMm":6500}],"guardHeightMm":1040} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-bath` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":945,"boundsMm":{"minX":3850,"minY":2477.5,"maxX":3850,"maxY":3422.5}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-carport` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":950,"boundsMm":{"minX":850,"minY":3125,"maxX":850,"maxY":4075}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-ensuite` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":700,"boundsMm":{"minX":2950,"minY":5150,"maxX":2950,"maxY":5850}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-gf-bath-laundry` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":600,"boundsMm":{"minX":7600,"minY":1300,"maxX":7600,"maxY":1900}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-kitchen` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":950,"boundsMm":{"minX":1450,"minY":4625,"maxX":1450,"maxY":5575}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-landing` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":770,"boundsMm":{"minX":6115,"minY":1350,"maxX":6885,"maxY":1350}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-loggia` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":950,"boundsMm":{"minX":3925,"minY":-100,"maxX":4875,"maxY":-100}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-utility` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":700,"boundsMm":{"minX":7600,"minY":3650,"maxX":7600,"maxY":4350}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-hf-room-walk-in-closet` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":700,"boundsMm":{"minX":850,"minY":5150,"maxX":850,"maxY":5850}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-room-bedroom` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":600,"boundsMm":{"minX":2600,"minY":4150,"maxX":3200,"maxY":4150}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-room-hall` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":600,"boundsMm":{"minX":3100,"minY":2850,"maxX":3100,"maxY":3450}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-room-living` | {"levelId":"hf-lvl-ground","isolatedEndpoints":["start","end"],"lengthMm":700,"boundsMm":{"minX":5700,"minY":5000,"maxX":6400,"maxY":5000}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `access-wall-room-terrace` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":950,"boundsMm":{"minX":5650,"minY":4425,"maxX":5650,"maxY":5375}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `front-loggia-left-return` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":1350,"boundsMm":{"minX":1200,"minY":-450,"maxX":1200,"maxY":900}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `front-loggia-recessed-glass` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["start","end"],"lengthMm":6100,"boundsMm":{"minX":1350,"minY":820,"maxX":7450,"maxY":820}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `front-loggia-right-return` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":1350,"boundsMm":{"minX":7600,"minY":-450,"maxX":7600,"maxY":900}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `hf-roof-court-front-return` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":2600,"boundsMm":{"minX":5300,"minY":3000,"maxX":7900,"maxY":3000}} |
| `detached_or_flying` | error | `geometry.wall_detached_endpoint` | `hf-roof-court-glass-back` | {"levelId":"hf-lvl-upper","isolatedEndpoints":["end"],"lengthMm":2600,"boundsMm":{"minX":5300,"minY":6600,"maxX":7900,"maxY":6600}} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-bath` | {"boundsMm":null,"name":"First Floor Bathroom access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-carport` | {"boundsMm":null,"name":"Recessed Garage / Carport access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-ensuite` | {"boundsMm":null,"name":"Ensuite access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-gf-bath-laundry` | {"boundsMm":null,"name":"Bath / Laundry access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-kitchen` | {"boundsMm":null,"name":"Kitchen access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-landing` | {"boundsMm":null,"name":"Hall / Landing access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-loggia` | {"boundsMm":null,"name":"Deep Balcony / Loggia access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-utility` | {"boundsMm":null,"name":"Utility access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-hf-room-walk-in-closet` | {"boundsMm":null,"name":"Walk-in Closet access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-room-bedroom` | {"boundsMm":null,"name":"Bedroom access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-room-hall` | {"boundsMm":null,"name":"Entrance / Stair Hall access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-room-living` | {"boundsMm":null,"name":"Living / Dining access door"} |
| `helper_leakage` | error | `helper.door.access_stub_visible_in_snapshot` | `access-door-room-terrace` | {"boundsMm":null,"name":"Roof Terrace access door"} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-1` | {"boundsMm":{"minX":3600,"minY":1600,"maxX":5200,"maxY":1600}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-2` | {"boundsMm":{"minX":5200,"minY":1600,"maxX":5200,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-3` | {"boundsMm":{"minX":3600,"minY":4300,"maxX":5200,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-bath-4` | {"boundsMm":{"minX":3600,"minY":1600,"maxX":3600,"maxY":4300}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-1` | {"boundsMm":{"minX":600,"minY":700,"maxX":1100,"maxY":700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-2` | {"boundsMm":{"minX":1100,"minY":700,"maxX":1100,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-3` | {"boundsMm":{"minX":600,"minY":6500,"maxX":1100,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-carport-4` | {"boundsMm":{"minX":600,"minY":700,"maxX":600,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-1` | {"boundsMm":{"minX":2700,"minY":4500,"maxX":4300,"maxY":4500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-2` | {"boundsMm":{"minX":4300,"minY":4500,"maxX":4300,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-3` | {"boundsMm":{"minX":2700,"minY":6500,"maxX":4300,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-ensuite-4` | {"boundsMm":{"minX":2700,"minY":4500,"maxX":2700,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-1` | {"boundsMm":{"minX":6800,"minY":700,"maxX":8300,"maxY":700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-2` | {"boundsMm":{"minX":8300,"minY":700,"maxX":8300,"maxY":3100}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-3` | {"boundsMm":{"minX":6800,"minY":3100,"maxX":8300,"maxY":3100}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-gf-bath-laundry-4` | {"boundsMm":{"minX":6800,"minY":700,"maxX":6800,"maxY":3100}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-1` | {"boundsMm":{"minX":1200,"minY":3700,"maxX":3400,"maxY":3700}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-2` | {"boundsMm":{"minX":3400,"minY":3700,"maxX":3400,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-3` | {"boundsMm":{"minX":1200,"minY":6500,"maxX":3400,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-kitchen-4` | {"boundsMm":{"minX":1200,"minY":3700,"maxX":1200,"maxY":6500}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-1` | {"boundsMm":{"minX":5400,"minY":1000,"maxX":7600,"maxY":1000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-2` | {"boundsMm":{"minX":7600,"minY":1000,"maxX":7600,"maxY":3000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-3` | {"boundsMm":{"minX":5400,"minY":3000,"maxX":7600,"maxY":3000}} |
| `helper_leakage` | error | `helper.room_separation.visible_in_snapshot` | `sep-hf-room-landing-4` | {"boundsMm":{"minX":5400,"minY":1000,"maxX":5400,"maxY":3000}} |
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
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-bath` | {"boundsMm":{"minX":3850,"minY":2477.5,"maxX":3850,"maxY":3422.5},"name":"First Floor Bathroom access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-carport` | {"boundsMm":{"minX":850,"minY":3125,"maxX":850,"maxY":4075},"name":"Recessed Garage / Carport access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-ensuite` | {"boundsMm":{"minX":2950,"minY":5150,"maxX":2950,"maxY":5850},"name":"Ensuite access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-gf-bath-laundry` | {"boundsMm":{"minX":7600,"minY":1300,"maxX":7600,"maxY":1900},"name":"Bath / Laundry access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-kitchen` | {"boundsMm":{"minX":1450,"minY":4625,"maxX":1450,"maxY":5575},"name":"Kitchen access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-landing` | {"boundsMm":{"minX":6115,"minY":1350,"maxX":6885,"maxY":1350},"name":"Hall / Landing access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-loggia` | {"boundsMm":{"minX":3925,"minY":-100,"maxX":4875,"maxY":-100},"name":"Deep Balcony / Loggia access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-utility` | {"boundsMm":{"minX":7600,"minY":3650,"maxX":7600,"maxY":4350},"name":"Utility access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-hf-room-walk-in-closet` | {"boundsMm":{"minX":850,"minY":5150,"maxX":850,"maxY":5850},"name":"Walk-in Closet access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-room-bedroom` | {"boundsMm":{"minX":2600,"minY":4150,"maxX":3200,"maxY":4150},"name":"Bedroom access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-room-hall` | {"boundsMm":{"minX":3100,"minY":2850,"maxX":3100,"maxY":3450},"name":"Entrance / Stair Hall access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-room-living` | {"boundsMm":{"minX":5700,"minY":5000,"maxX":6400,"maxY":5000},"name":"Living / Dining access control wall"} |
| `helper_leakage` | error | `helper.wall.access_stub_visible_in_snapshot` | `access-wall-room-terrace` | {"boundsMm":{"minX":5650,"minY":4425,"maxX":5650,"maxY":5375},"name":"Roof Terrace access control wall"} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `access-wall-hf-room-carport` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":850,"minY":3125,"maxX":850,"maxY":4075},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":7000,"maxY":8200},"directions":["west"]} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `access-wall-hf-room-gf-bath-laundry` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":7600,"minY":1300,"maxX":7600,"maxY":1900},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":7000,"maxY":8200},"directions":["east"]} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `access-wall-hf-room-utility` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":7600,"minY":3650,"maxX":7600,"maxY":4350},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":7000,"maxY":8200},"directions":["east"]} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `hf-room-carport` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":600,"minY":700,"maxX":1100,"maxY":6500},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":7000,"maxY":8200},"directions":["west"]} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `hf-room-gf-bath-laundry` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":6800,"minY":700,"maxX":8300,"maxY":3100},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":7000,"maxY":8200},"directions":["east"]} |
| `out_of_envelope` | error | `geometry.element_outside_level_floor_support` | `hf-room-utility` | {"levelId":"hf-lvl-ground","boundsMm":{"minX":6800,"minY":3300,"maxX":8300,"maxY":5000},"supportBoundsMm":{"minX":1000,"minY":0,"maxX":7000,"maxY":8200},"directions":["east"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `access-wall-hf-room-loggia` | {"boundsMm":{"minX":3925,"minY":-100,"maxX":4875,"maxY":-100},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `front-loggia-left-return` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":1200,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `front-loggia-right-return` | {"boundsMm":{"minX":7600,"minY":-450,"maxX":7600,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-front-loggia-railing` | {"boundsMm":{"minX":1300,"minY":-350,"maxX":7500,"maxY":-350},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-roof-main` | {"boundsMm":{"minX":0,"minY":-450,"maxX":8000,"maxY":8200},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-room-loggia` | {"boundsMm":{"minX":1200,"minY":-450,"maxX":7600,"maxY":900},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
| `out_of_envelope` | error | `geometry.element_outside_source_envelope` | `hf-upper-wrapper-shell-wall-01` | {"boundsMm":{"minX":0,"minY":-450,"maxX":8000,"maxY":-450},"targetEnvelopeMm":{"minX":0,"minY":0,"maxX":14000,"maxY":10000},"directions":["south"]} |
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
| `unsupported_renderer_feature` | warning | `renderer.railing_geometry.unhosted_edge_unproven` | `hf-front-loggia-railing` | {"diagnosticCodesRequired":["renderer.railing_geometry.degraded","renderer.railing_geometry.unsupported"]} |
| `unsupported_renderer_feature` | warning | `renderer.railing_geometry.unhosted_edge_unproven` | `hf-roof-court-railing` | {"diagnosticCodesRequired":["renderer.railing_geometry.degraded","renderer.railing_geometry.unsupported"]} |
| `unsupported_renderer_feature` | warning | `renderer.railing_geometry.unhosted_edge_unproven` | `main-stair-guardrail` | {"diagnosticCodesRequired":["renderer.railing_geometry.degraded","renderer.railing_geometry.unsupported"]} |
| `unsupported_renderer_feature` | error | `renderer.roof_opening.asymmetric_gable_unproven` | `hf-roof-court-opening`<br>`hf-roof-main` | {"hostRoofId":"hf-roof-main","hostRoofGeometryMode":"asymmetric_gable","diagnosticCodesRequired":["renderer.roof_opening.unsupported","renderer.roof_opening.failed_cut"]} |
| `unsupported_renderer_feature` | error | `renderer.slab_opening.stair_penetration_unproven` | `main-stair-upper-opening`<br>`upper-wrapper-floor` | {"hostFloorId":"upper-wrapper-floor","diagnosticCodesRequired":["renderer.slab_opening.unsupported","renderer.slab_opening.failed_cut"]} |
| `unsupported_renderer_feature` | error | `renderer.wall_cut.overlapping_hosted_cuts` | `front-loggia-center-door`<br>`front-loggia-recessed-glass`<br>`front-loggia-wide-opening` | {"hostWallId":"front-loggia-recessed-glass","leftInterval":{"startT":0.430327868852459,"endT":0.569672131147541},"rightInterval":{"startT":0.08,"endT":0.92},"diagnosticCodesRequired":["renderer.hosted_opening.detached_proxy","renderer.hosted_opening.no_cut","renderer.wall_cut.failed"]} |
| `unsupported_renderer_feature` | error | `renderer.wall_cut.overlapping_hosted_cuts` | `front-loggia-left-window`<br>`front-loggia-recessed-glass`<br>`front-loggia-wide-opening` | {"hostWallId":"front-loggia-recessed-glass","leftInterval":{"startT":0.12262295081967212,"endT":0.23737704918032787},"rightInterval":{"startT":0.08,"endT":0.92},"diagnosticCodesRequired":["renderer.hosted_opening.detached_proxy","renderer.hosted_opening.no_cut","renderer.wall_cut.failed"]} |
| `unsupported_renderer_feature` | error | `renderer.wall_cut.overlapping_hosted_cuts` | `front-loggia-recessed-glass`<br>`front-loggia-right-window`<br>`front-loggia-wide-opening` | {"hostWallId":"front-loggia-recessed-glass","leftInterval":{"startT":0.7626229508196721,"endT":0.8773770491803278},"rightInterval":{"startT":0.08,"endT":0.92},"diagnosticCodesRequired":["renderer.hosted_opening.detached_proxy","renderer.hosted_opening.no_cut","renderer.wall_cut.failed"]} |

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
