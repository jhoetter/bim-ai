# Commands (semantic operations)

Commands are validated, applied sequentially, then constraints are recomputed.

## CreateLevel

```json
{ "type": "CreateLevel", "id": "<optional>", "name": "...", "elevationMm": 0 }
```

## CreateWall

```json
{
  "type": "CreateWall",
  "id": "<optional>",
  "name": "W-001",
  "levelId": "...",
  "start": { "xMm": 0, "yMm": 0 },
  "end": { "xMm": 5000, "yMm": 0 },
  "thicknessMm": 200,
  "heightMm": 2800
}
```

## MoveWallDelta

```json
{ "type": "MoveWallDelta", "wallId": "...", "dxMm": 100, "dyMm": 0 }
```

## MoveWallEndpoints

```json
{
  "type": "MoveWallEndpoints",
  "wallId": "...",
  "start": { "xMm": 0, "yMm": 0 },
  "end": { "xMm": 4000, "yMm": 0 }
}
```

## InsertDoorOnWall

```json
{
  "type": "InsertDoorOnWall",
  "id": "<optional>",
  "name": "D-101",
  "wallId": "...",
  "alongT": 0.45,
  "widthMm": 900
}
```

## CreateRoomOutline

```json
{
  "type": "CreateRoomOutline",
  "id": "<optional>",
  "name": "Room 101",
  "levelId": "...",
  "outlineMm": [
    { "xMm": 0, "yMm": 0 },
    { "xMm": 6000, "yMm": 0 },
    { "xMm": 6000, "yMm": 4000 },
    { "xMm": 0, "yMm": 4000 }
  ]
}
```

## CreateIssueFromViolation

```json
{
  "type": "CreateIssueFromViolation",
  "title": "Wall overlap",
  "violationRuleId": "wall_overlap",
  "elementIds": ["w1", "w2"],
  "viewpointId": null
}
```

## UpdateElementProperty

```json
{ "type": "UpdateElementProperty", "elementId": "...", "key": "name", "value": "New name" }
```

## SaveViewpoint

```json
{
  "type": "SaveViewpoint",
  "id": "<optional>",
  "name": "Coord view A",
  "camera": {
    "position": { "xMm": 0, "yMm": 0, "zMm": 5000 },
    "target": { "xMm": 0, "yMm": 0, "zMm": 0 },
    "up": { "xMm": 0, "yMm": 1, "zMm": 0 }
  },
  "mode": "orbit_3d"
}
```

All commands return `violations` after apply; reject if any **error** severity fails policy (v1: reject on error).
