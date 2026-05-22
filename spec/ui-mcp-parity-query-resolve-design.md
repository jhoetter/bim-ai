# UI-MCP Query/Resolve Parity Design

Last updated: 2026-05-18

Source of intent: `spec/trackers/ui-mcp-parity-tracker.md`, Milestone 1-E / WP-007.

## Purpose

Milestone 2 needs an external agent to build and review a credible basic house
without source-code knowledge, browser gestures, UI selection, or implicit active
view state. This document defines the first query/resolve interface pack that
replaces those UI-only assumptions with explicit model resources and typed
resolver tools.

This is an interface design, not an implementation plan for backend/web areas.
The current implementation already has useful foundations:

- `GET /api/models/{model_id}/architecture/query` returns architecture lens
  buckets for geometry, types, rooms, areas, views, sheets, and schedules.
- `GET /api/models/{model_id}/command-log` returns recent undo records and
  applied commands.
- API v3 has a `model-show` descriptor for snapshots and `create-schedule-view`
  for one schedule mutation path.

M2 should promote these into a stable, broader MCP/CLI query contract.

## Design Principles

- Query tools are read-only, deterministic, pageable, and safe to call before
  every mutation.
- Resolver tools are read-only unless explicitly documented otherwise. They
  convert human context like selection, hover, active level, active view, and
  current type picker into explicit ids and coordinates.
- Responses return compact summaries by default and opt into heavy geometry,
  rows, or raw element payloads.
- All ids returned by query/resolve tools must be valid inputs to authoring,
  opening, document, edit, and QA tools.
- Ambiguous resolution is not hidden. Resolvers either return one confident
  result, return ranked candidates with `ambiguous`, or fail with a typed error.
- Query/resolve contracts should use the same schema envelope for REST, CLI, and
  MCP. CLI is a transport mirror, not a separate semantic layer.

## Shared Shapes

### Request Envelope

Read-only tools do not need `parentRevision`, but they should allow clients to
pin a revision when reproducibility matters.

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "revision": 42,
  "limit": 100,
  "cursor": null,
  "include": ["geometrySummary", "hostRefs"],
  "units": "mm"
}
```

Fields:

| Field      | Required | Meaning                                                                                         |
| ---------- | -------- | ----------------------------------------------------------------------------------------------- |
| `modelId`  | yes      | Model UUID or MCP resource model id.                                                            |
| `revision` | no       | Optional revision pin. If omitted, use latest committed revision.                               |
| `limit`    | no       | Page size. Default 100, max 500 unless a resource states otherwise.                             |
| `cursor`   | no       | Opaque pagination cursor.                                                                       |
| `include`  | no       | Named optional expansions. Unknown include values are errors.                                   |
| `units`    | no       | `mm` for M2. Future values may be added only after unit handling exists across authoring tools. |

### Success Envelope

```json
{
  "ok": true,
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "revision": 42,
  "data": {},
  "warnings": [],
  "nextCursor": null
}
```

### Error Envelope

```json
{
  "ok": false,
  "error": {
    "code": "ambiguous_match",
    "message": "Three walls match the requested line within tolerance.",
    "retryable": false,
    "details": {
      "candidateIds": ["wall-1", "wall-7", "wall-9"],
      "hint": "Pass levelId, bbox, or preferNearestTo."
    }
  }
}
```

Required error codes:

| Code                   | HTTP | CLI exit | Meaning                                                          |
| ---------------------- | ---: | -------: | ---------------------------------------------------------------- |
| `model_not_found`      |  404 |        1 | Model id does not exist or caller lacks access.                  |
| `revision_not_found`   |  404 |        1 | Requested revision is unavailable.                               |
| `stale_revision`       |  409 |        2 | Pinned revision does not match required latest semantics.        |
| `invalid_request`      |  400 |        2 | Schema, enum, bbox, or include value is invalid.                 |
| `unsupported_filter`   |  400 |        2 | Filter is well-formed but not supported by this tool.            |
| `not_found`            |  404 |        1 | Specific element/type/view/host could not be found.              |
| `ambiguous_match`      |  409 |        3 | Resolver found multiple viable results and no tie-breaker.       |
| `unresolved_reference` |  422 |        3 | Referenced level, view, host, or type id does not resolve.       |
| `degenerate_geometry`  |  422 |        3 | Boundary, line, or loop cannot support the requested resolution. |
| `too_many_results`     |  413 |        2 | Query requires pagination or narrower filters.                   |
| `internal_error`       |  500 |        1 | Unexpected server error.                                         |

## Resources

### `model://{modelId}/summary`

Compact model starting point before planning edits.

Response shape:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "revision": 42,
  "name": "Simple House",
  "counts": {
    "elements": 184,
    "walls": 28,
    "floors": 2,
    "roofs": 1,
    "doors": 9,
    "windows": 18,
    "levels": 3,
    "views": 7,
    "sheets": 2,
    "schedules": 4,
    "advisorFindings": 3
  },
  "defaults": {
    "levelId": "level-0",
    "planViewId": "plan-level-0",
    "wallTypeId": "wall-type-exterior-200",
    "floorTypeId": "floor-type-wood-280",
    "roofTypeId": "roof-type-timber-320"
  },
  "extents": {
    "bboxMm": [0, 0, -300, 12000, 9000, 7200]
  },
  "recentRevision": {
    "revision": 42,
    "createdAt": "2026-05-18T10:15:00Z",
    "author": "agent:mcp"
  }
}
```

M2 use: replaces the UI project browser, status bar counts, current level guess,
and "what is in this model?" first look.

### `model://{modelId}/elements/{elementId}`

Single element readback for inspector parity.

Default fields:

```json
{
  "id": "wall-12",
  "kind": "wall",
  "name": "Exterior wall north",
  "levelId": "level-0",
  "typeId": "wall-type-exterior-200",
  "bboxMm": [0, 8800, 0, 12000, 9000, 3000],
  "hostRefs": [],
  "geometrySummary": {
    "representation": "line_extrusion",
    "startMm": [0, 9000],
    "endMm": [12000, 9000],
    "heightMm": 3000,
    "thicknessMm": 200
  },
  "properties": {
    "structural": false,
    "phaseCreated": "phase-existing"
  }
}
```

Optional `include: ["raw"]` may include the existing engine wire payload, but
M2 authoring tools should not require raw element internals.

### `model://{modelId}/levels`

Level and default plan view inventory.

```json
{
  "levels": [
    {
      "id": "level-0",
      "name": "Ground Floor",
      "elevationMm": 0,
      "isDefault": true,
      "planViewIds": ["plan-level-0"],
      "constraints": {
        "defaultWallHeightMm": 3000
      }
    }
  ]
}
```

### `model://{modelId}/views`

Plan, 3D, section, elevation, sheet, schedule, template metadata.

```json
{
  "views": [
    {
      "id": "plan-level-0",
      "kind": "plan_view",
      "name": "Ground Floor Plan",
      "levelId": "level-0",
      "scale": 100,
      "cropBBoxMm": [-1000, -1000, 13000, 10000],
      "templateId": "tpl-architecture-plan",
      "isDefaultForLevel": true
    }
  ]
}
```

### `model://{modelId}/types`

Type catalog visible to the model.

```json
{
  "types": [
    {
      "id": "wall-type-exterior-200",
      "kind": "wall_type",
      "name": "Exterior 200 mm",
      "category": "wall",
      "isDefault": true,
      "parameters": {
        "thicknessMm": 200,
        "fireRatingMin": 30,
        "layers": [
          { "function": "finish", "thicknessMm": 15, "materialId": "mat-plaster" },
          { "function": "structure", "thicknessMm": 170, "materialId": "mat-block" }
        ]
      }
    }
  ]
}
```

M2 must include wall, floor, roof, door, window, stair, railing, family, material,
view template, and schedule type rows at minimum.

### `model://{modelId}/schedules/{scheduleId}`

Schedule definition plus rows. Rows are pageable because schedules can be large.

```json
{
  "schedule": {
    "id": "schedule-doors",
    "name": "Door Schedule",
    "category": "door",
    "columns": [
      { "id": "mark", "label": "Mark", "type": "string" },
      { "id": "typeName", "label": "Type", "type": "string" },
      { "id": "widthMm", "label": "Width", "type": "number" }
    ],
    "filters": [],
    "sort": [{ "field": "mark", "dir": "asc" }]
  },
  "rows": [
    {
      "elementId": "door-1",
      "cells": {
        "mark": "D01",
        "typeName": "Single Flush 900",
        "widthMm": 900
      }
    }
  ],
  "nextCursor": null
}
```

### `model://{modelId}/advisor`

Current advisor and constructability findings without the UI panel.

```json
{
  "findings": [
    {
      "id": "adv-1",
      "ruleId": "opening_missing_host",
      "severity": "error",
      "message": "Door door-4 does not resolve to a host wall.",
      "elementIds": ["door-4"],
      "discipline": "architecture",
      "quickFixes": [
        {
          "id": "resolve-host-wall",
          "label": "Resolve nearest host wall",
          "tool": "resolve.host_face",
          "input": { "elementId": "door-4" }
        }
      ]
    }
  ],
  "counts": { "error": 1, "warning": 2, "info": 0 }
}
```

### `model://{modelId}/command-log`

Audit/history readback for recovery and agent planning.

```json
{
  "entries": [
    {
      "id": 128,
      "revisionBefore": 41,
      "revisionAfter": 42,
      "createdAt": "2026-05-18T10:15:00Z",
      "actor": { "kind": "agent", "id": "mcp-client-1" },
      "toolId": "author.wall_chain",
      "assumptions": ["Used ground floor default level."],
      "createdElementIds": ["wall-1", "wall-2"],
      "updatedElementIds": [],
      "deletedElementIds": [],
      "appliedCommands": [{ "type": "createWallChain", "idPrefix": "wall" }],
      "undoToken": "undo:42"
    }
  ]
}
```

The current command-log endpoint already exposes recent undo records and
`appliedCommands`. M2 should add revision-before, actor/tool metadata,
assumptions, changed ids, and undo token when transaction hardening lands.

## Query Tools

### `query.elements`

Search model elements without UI selection.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "revision": 42,
  "filter": {
    "kinds": ["wall"],
    "levelIds": ["level-0"],
    "typeIds": ["wall-type-exterior-200"],
    "bboxIntersectsMm": [-500, 8500, -100, 12500, 9500, 3500],
    "properties": { "structural": false },
    "createdBy": "agent:mcp",
    "text": "north"
  },
  "sort": [{ "field": "distanceTo", "pointMm": [6000, 9000, 0] }],
  "include": ["geometrySummary", "hostRefs"],
  "limit": 20
}
```

Response:

```json
{
  "ok": true,
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "revision": 42,
  "data": {
    "elements": [
      {
        "id": "wall-12",
        "kind": "wall",
        "name": "Exterior wall north",
        "levelId": "level-0",
        "typeId": "wall-type-exterior-200",
        "bboxMm": [0, 8800, 0, 12000, 9000, 3000],
        "geometrySummary": {
          "representation": "line_extrusion",
          "startMm": [0, 9000],
          "endMm": [12000, 9000],
          "heightMm": 3000,
          "thicknessMm": 200
        }
      }
    ]
  },
  "warnings": [],
  "nextCursor": null
}
```

Required filters for M2:

- `ids`
- `kinds`
- `levelIds`
- `typeIds`
- `bboxIntersectsMm`
- `bboxContainsMm`
- `properties`
- `createdBy`
- `text`

Required include values for M2:

- `geometrySummary`
- `hostRefs`
- `scheduleSummary`
- `raw`

### `query.levels`

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "include": ["planViews", "constraints"]
}
```

Response: same `levels` resource shape inside the success envelope.

### `query.types`

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "filter": {
    "categories": ["wall", "door"],
    "kinds": ["wall_type", "family_type"],
    "text": "exterior",
    "parameters": { "thicknessMm": { "gte": 180, "lte": 240 } }
  },
  "include": ["parameters", "materials"]
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "types": [
      {
        "id": "wall-type-exterior-200",
        "kind": "wall_type",
        "category": "wall",
        "name": "Exterior 200 mm",
        "parameters": { "thicknessMm": 200 },
        "materialIds": ["mat-plaster", "mat-block"]
      }
    ]
  }
}
```

### `query.views`

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "filter": {
    "kinds": ["plan_view", "viewpoint", "sheet", "schedule"],
    "levelIds": ["level-0"],
    "text": "ground"
  },
  "include": ["crop", "placements", "templates"]
}
```

M2 must return plan views, 3D saved views/viewpoints, section/elevation views,
sheets, sheet placements, schedules, and view templates.

### `query.hosts`

Find candidate hosts for hosted elements.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "hostKind": "wall",
  "forKind": "door",
  "levelId": "level-0",
  "nearPointMm": [3500, 9000, 0],
  "maxDistanceMm": 500,
  "include": ["hostFaces", "normalizedPosition"]
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "hosts": [
      {
        "elementId": "wall-12",
        "kind": "wall",
        "score": 0.96,
        "distanceMm": 0,
        "normalMm": [0, -1, 0],
        "position": {
          "t": 0.2917,
          "distanceAlongMm": 3500,
          "pointMm": [3500, 9000, 0]
        },
        "validFor": ["door", "window", "wall_opening"]
      }
    ]
  }
}
```

### `query.enclosed_loops`

Detect loops from walls, room boundaries, floors, roof footprints, or sketch
traces. This replaces canvas picking for floors, rooms, roofs, and boundaries.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "levelId": "level-0",
  "source": {
    "kind": "walls",
    "elementIds": ["wall-1", "wall-2", "wall-3", "wall-4"]
  },
  "toleranceMm": 25,
  "include": ["area", "segments", "sourceElementIds"]
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "loops": [
      {
        "id": "loop:sha256:6c5b",
        "levelId": "level-0",
        "closed": true,
        "areaMm2": 108000000,
        "orientation": "ccw",
        "boundaryMm": [
          [0, 0],
          [12000, 0],
          [12000, 9000],
          [0, 9000],
          [0, 0]
        ],
        "sourceElementIds": ["wall-1", "wall-2", "wall-3", "wall-4"],
        "gaps": []
      }
    ]
  }
}
```

Error modes:

- `degenerate_geometry` when fewer than three usable segments exist.
- `ambiguous_match` when multiple closed loops are equally plausible and no
  point or area hint is supplied.
- Non-blocking `warnings` for small closed gaps within tolerance.

### `query.schedule_rows`

Rows can also be read through the schedule resource; this tool form is useful
for CLI and API descriptor symmetry.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "scheduleId": "schedule-doors",
  "columns": ["mark", "typeName", "widthMm"],
  "filter": { "levelId": "level-0" },
  "limit": 50
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "scheduleId": "schedule-doors",
    "rows": [
      {
        "elementId": "door-1",
        "cells": { "mark": "D01", "typeName": "Single Flush 900", "widthMm": 900 }
      }
    ]
  },
  "nextCursor": null
}
```

## Resolver Tools

### `resolve.active_or_default_level`

Replaces UI active level.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "hint": {
    "levelId": null,
    "viewId": "plan-level-0",
    "elevationMm": null,
    "name": null
  },
  "createIfMissing": false
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "level": {
      "id": "level-0",
      "name": "Ground Floor",
      "elevationMm": 0
    },
    "resolution": {
      "strategy": "from_view",
      "confidence": 1.0
    }
  }
}
```

M2 decision: `createIfMissing` should remain `false` in this read-only resolver.
Level creation belongs in an authoring/document setup tool.

### `resolve.default_plan_view`

Replaces UI active plan view.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "levelId": "level-0",
  "purpose": "authoring"
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "viewId": "plan-level-0",
    "levelId": "level-0",
    "scale": 100,
    "resolution": { "strategy": "default_for_level", "confidence": 1.0 }
  }
}
```

### `resolve.wall_by_line`

Replaces selected wall or clicked wall segment.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "levelId": "level-0",
  "lineMm": [
    [0, 9000],
    [12000, 9000]
  ],
  "toleranceMm": 100,
  "preferNearestToMm": [3500, 9000, 0]
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "wallId": "wall-12",
    "match": {
      "score": 0.99,
      "overlapRatio": 1.0,
      "distanceMm": 0,
      "reversed": false
    },
    "candidates": [{ "elementId": "wall-12", "score": 0.99 }]
  }
}
```

If score ties are within 0.05, return `ambiguous_match` with candidate ids unless
the request includes `preferNearestToMm`.

### `resolve.host_face`

Replaces hover/click host selection for doors, windows, openings, face paint,
decals, and hosted family instances.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "forKind": "door",
  "pointMm": [3500, 9000, 1000],
  "normalHint": [0, -1, 0],
  "hostKinds": ["wall"],
  "levelId": "level-0",
  "maxDistanceMm": 500
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "host": {
      "elementId": "wall-12",
      "kind": "wall",
      "faceId": "wall-12:interior",
      "normal": [0, -1, 0]
    },
    "placement": {
      "pointMm": [3500, 9000, 1000],
      "u": 0.2917,
      "v": 0.3333,
      "distanceAlongMm": 3500,
      "sillHeightMm": null
    },
    "resolution": { "strategy": "nearest_host_face", "confidence": 0.96 }
  }
}
```

### `resolve.family_type`

Replaces current type picker and family browser selection.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "category": "door",
  "nameOrText": "single flush 900",
  "constraints": {
    "widthMm": { "gte": 850, "lte": 950 },
    "heightMm": 2100,
    "fireRatingMin": 30
  },
  "preferDefault": true
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "typeId": "door-type-single-flush-900",
    "category": "door",
    "name": "Single Flush 900 x 2100",
    "parameters": { "widthMm": 900, "heightMm": 2100, "fireRatingMin": 30 },
    "resolution": { "strategy": "constraint_match", "confidence": 0.93 }
  }
}
```

### `resolve.room_boundary`

Replaces selecting a room or clicking inside a room to create floors, finishes,
tags, or schedules.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "levelId": "level-0",
  "roomId": "room-living",
  "pointInsideMm": null,
  "include": ["boundary", "adjacentWalls"]
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "roomId": "room-living",
    "levelId": "level-0",
    "boundaryMm": [
      [0, 0],
      [6000, 0],
      [6000, 4500],
      [0, 4500],
      [0, 0]
    ],
    "areaMm2": 27000000,
    "adjacentWallIds": ["wall-1", "wall-2", "wall-9", "wall-10"],
    "resolution": { "strategy": "room_element_boundary", "confidence": 1.0 }
  }
}
```

### `resolve.loop_for_boundary`

Canonical resolver for floors, roofs, rooms, ceilings, and terrace cutouts.

Input:

```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440000",
  "levelId": "level-0",
  "source": {
    "kind": "enclosing_walls",
    "elementIds": ["wall-1", "wall-2", "wall-3", "wall-4"]
  },
  "pointInsideMm": [6000, 4500],
  "toleranceMm": 25
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "loopId": "loop:sha256:6c5b",
    "boundaryMm": [
      [0, 0],
      [12000, 0],
      [12000, 9000],
      [0, 9000],
      [0, 0]
    ],
    "sourceElementIds": ["wall-1", "wall-2", "wall-3", "wall-4"],
    "usableFor": ["floor", "roof", "room", "ceiling"],
    "resolution": { "strategy": "closed_wall_chain", "confidence": 0.98 },
    "warnings": []
  }
}
```

## Replacing UI Context

| UI implicit context  | Query/resolve substitute                                               | M2 consumer                                                |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Active level         | `resolve.active_or_default_level` or explicit `levelId`                | Walls, floors, rooms, stairs, views.                       |
| Active plan view     | `resolve.default_plan_view` or explicit `viewId`                       | View-scoped annotations, sheet placement, visual evidence. |
| Selected wall        | `query.elements`, `resolve.wall_by_line`, `resolve.host_face`          | Doors, windows, wall openings, wall edits.                 |
| Hovered face         | `resolve.host_face`                                                    | Hosted openings, material paint, decals.                   |
| Current type picker  | `resolve.family_type`, `query.types`                                   | Door/window/stair/family/material tools.                   |
| Sketch loop          | `query.enclosed_loops`, `resolve.loop_for_boundary`, explicit polyline | Floors, roofs, rooms, ceilings, terrace cutouts.           |
| Selected room        | `resolve.room_boundary` or `query.elements(kinds=["room"])`            | Finish schedules, room tags, floor from room.              |
| Schedule panel state | `query.views`, `query.schedule_rows`, schedule resource                | Documentation and quantity verification.                   |
| Advisor panel        | Advisor resource or `qa.advisor`                                       | Agent refinement loop.                                     |
| Undo/history menu    | Command-log resource                                                   | Recovery, audit, benchmark evidence.                       |

No M2 authoring tool should accept "current selection" as its only path. A
future MCP session selection resource may exist for interactive agents, but all
M2 tools must also accept explicit ids or resolver output.

## CLI Mirror

CLI command names should mirror MCP tool names and return the same JSON when
`--json` is passed.

Examples:

```bash
bim-ai model summary --model "$BIM_AI_MODEL_ID" --json
bim-ai query elements --model "$BIM_AI_MODEL_ID" --kind wall --level level-0 --include geometrySummary --json
bim-ai query types --model "$BIM_AI_MODEL_ID" --category door --text "single flush" --json
bim-ai query loops --model "$BIM_AI_MODEL_ID" --level level-0 --source walls:wall-1,wall-2,wall-3,wall-4 --json
bim-ai resolve wall --model "$BIM_AI_MODEL_ID" --level level-0 --line "0,9000:12000,9000" --json
bim-ai resolve host-face --model "$BIM_AI_MODEL_ID" --for door --point "3500,9000,1000" --json
bim-ai query schedule-rows --model "$BIM_AI_MODEL_ID" --schedule schedule-doors --json
bim-ai model command-log --model "$BIM_AI_MODEL_ID" --limit 20 --json
```

Human-readable CLI output can summarize rows, but machine users must be able to
use `--json` without losing fields.

## Dependencies

M2 query/resolve depends on these upstream M1/M2 items:

| Dependency                         | Why it matters                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Command schema export from M1-A    | Resolver outputs must be valid inputs for typed authoring schemas.                                       |
| API descriptor inventory from M1-C | Query/resolve descriptors need route mapping, mutability, examples, and schemas.                         |
| Automated parity audit from M1-D   | Generated report should verify that required query substitutes exist for context-dependent capabilities. |
| Cmd+K metadata from M1-B           | `requiredContext` and `agentEquivalent` fields should point to these query/resolve tools.                |
| Transaction/audit hardening WP-009 | Command-log resource needs actor, assumptions, changed ids, undo token, and conflict metadata.           |
| Schedule derivation/readback       | `query.schedule_rows` needs one canonical schedule row engine used by UI and API.                        |
| Geometry summary helpers           | Element search, host resolution, and loop detection need stable wall/floor/roof/room summaries.          |
| Advisor unification                | Advisor resource should merge constraint, constructability, and lens-specific findings consistently.     |

## Recommended M2 Implementation Order

1. Define shared query/resolve schemas and descriptors.
   Add API v3/MCP descriptors for `model.summary`, `query.elements`,
   `query.levels`, `query.types`, `query.views`, `query.schedule_rows`,
   `qa.advisor`, and `model.command_log`. Mark all as read-only.

2. Build compact projection helpers.
   Reuse the architecture lens query route as a starting point, but split it
   into reusable projections for element summary, geometry summary, type summary,
   view summary, schedule summary, and model counts.

3. Ship `model.summary`, `query.levels`, `query.types`, and `query.views`.
   These are low ambiguity and unblock authoring defaults and documentation
   tools.

4. Ship `query.elements` with paging and geometry summaries.
   This unlocks host lookup, edit tools, and the first same-house benchmark
   inventory checks.

5. Ship schedule rows, advisor, and command log resources.
   These provide non-browser review loops and benchmark evidence.

6. Ship resolver pack v1.
   Implement `resolve.active_or_default_level`, `resolve.default_plan_view`,
   `resolve.family_type`, `resolve.wall_by_line`, `resolve.host_face`,
   `query.hosts`, `query.enclosed_loops`, `resolve.room_boundary`, and
   `resolve.loop_for_boundary`.

7. Wire authoring pack to explicit resolver outputs.
   First authoring tools should reject missing level/type/host/loop context with
   actionable errors that name the relevant query/resolve tool.

8. Add CLI mirrors and parity audit checks.
   CLI help/schema tests should prove each query/resolve command returns the
   same shape as MCP/API. The parity audit should flag UI capabilities whose
   required context lacks an agent substitute.

9. Run simple-house benchmark in dry-run and commit modes.
   Benchmark should log all query/resolve calls, created ids, schedule rows,
   advisor findings, and command-log entries.

## M2 Blockers and Decisions Needed

- Decide canonical ids and naming conventions for API descriptors:
  dotted MCP names such as `query.elements` versus current hyphenated API v3
  names such as `model-show`. Recommendation: expose dotted MCP names in new
  descriptors and keep legacy hyphenated aliases where already shipped.
- Decide whether REST paths are grouped under `/api/v3/models/{modelId}/query/*`
  or reuse existing `/api/models/{model_id}` paths. Recommendation: new typed
  query/resolve tools should live in API v3 while old routes remain compatible.
- Decide whether `revision` is informational for read-only queries or can pin a
  historical document. Recommendation: M2 may accept only latest plus returned
  revision if historical snapshots are not available, but the field should stay
  in the schema.
- Decide the canonical geometry summary vocabulary for walls, floors, roofs,
  rooms, openings, stairs, views, and sheets. This should be shared between
  backend projections, CLI output, and web evidence.
- Decide whether loop ids are persisted or deterministic virtual ids.
  Recommendation: M2 loops can be deterministic virtual ids derived from source
  ids, boundary points, tolerance, and revision.
- Decide maximum schedule row and element query page sizes. Recommendation:
  default 100, max 500 for M2.
- Decide advisor finding normalization across constraints, constructability,
  lens findings, and evidence advisories before making `model://advisor`
  product-stable.
- Decide command-log metadata expansion timing with WP-009. M2 can start with
  existing undo records, but same-house evidence needs tool id, assumptions, and
  changed ids.

## Acceptance Criteria For M2 Query/Resolve Pack

- An agent can discover all levels, default plan views, wall/floor/roof/opening
  types, existing walls, rooms, sheets, schedules, advisor findings, and recent
  commands with no browser state.
- Door/window/opening tools can obtain a host wall and normalized placement from
  resolver output.
- Floor/roof/room/ceiling tools can obtain a closed loop from wall ids or a room
  boundary without canvas picking.
- Documentation tools can list views, sheets, schedules, and schedule rows.
- Every read-only tool has JSON Schema, at least one golden example payload, and
  at least one integration test.
- Every context-dependent M2 authoring tool documents the query/resolve tool
  that supplies its required ids.
