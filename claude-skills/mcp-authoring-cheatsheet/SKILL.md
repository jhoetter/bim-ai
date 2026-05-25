---
name: mcp-authoring-cheatsheet
description: Use this skill whenever an agent is composing bim-ai CMD-V3 commands (createWall / createFloor / createRoof / createRoomPoly / createDormer / CreateToposolid / etc.) over the MCP surface and needs to look up the exact field name to pass for a polygon, a level reference, an element identifier, or a dormer position. The cheatsheet enumerates the cross-command naming inconsistencies that today force authoring agents to trial-and-error their first bundle. Load this file BEFORE emitting your first command bundle for a new house; cross-reference it whenever a schema-validation error mentions an unknown field.
---

# MCP-authoring cheatsheet — cross-command field-name reference

The bim-ai CMD-V3 command surface has 265 commands and was grown organically.
Conceptually-identical fields are named differently across commands (e.g. the
polygon you hand to `createFloor` is `boundaryMm`, but the polygon you hand
to `createRoof` is `footprintMm`, and the polygon you hand to `createRoomPoly`
is `verticesMm`). This skill is the agent's lookup table so the first bundle
no longer needs four retries to discover the right field names.

Source of truth: the Pydantic command models in `app/bim_ai/commands/` and
`app/bim_ai/commands_*.py`. Fields here use the JSON alias (camelCase), which
is what the MCP wire format expects. When this cheatsheet and a live schema
disagree, **the schema wins** — see the "Discover field names for a new
command" section at the bottom.

## Polygon field name

| Command                       | Polygon field                  | Element kind        |
| ----------------------------- | ------------------------------ | ------------------- |
| `createFloor`                 | `boundaryMm`                   | Floor slab outline  |
| `createRoof`                  | `footprintMm`                  | Roof plan outline   |
| `createRoomOutline`           | `outlineMm`                    | Room space outline  |
| `createRoomPoly`              | `verticesMm`                   | Room + perim. walls |
| `createPlanRegion`            | `outlineMm`                    | Plan view region    |
| `createSoffit`                | `boundaryMm`                   | Soffit panel        |
| `CreateToposolid`             | `boundaryMm`                   | Terrain solid       |
| `create_toposolid_subdivision`| `boundaryMm`                   | Toposolid finish    |
| `createStair` (`by_sketch`)   | `boundaryMm`                   | Stair sketch        |

Mnemonic: roofs use `footprintMm`, rooms use `outlineMm`/`verticesMm` depending
on flavour, everything else uses `boundaryMm`. There is no schema-wide alias —
passing `boundaryMm` to `createRoof` will be silently dropped (`extra="ignore"`)
and you'll get a missing-required-field error on `footprintMm`.

## Level reference field

| Command                       | Field                | Notes                                  |
| ----------------------------- | -------------------- | -------------------------------------- |
| `createWall`                  | `levelId`            |                                        |
| `createWallChain`             | `levelId`            |                                        |
| `createFloor`                 | `levelId`            |                                        |
| `createRoof`                  | `referenceLevelId`   | Odd one out                            |
| `createRoomOutline`           | `levelId`            |                                        |
| `createRoomRectangle`         | `levelId`            |                                        |
| `createRoomPoly`              | `levelId`            |                                        |
| `placeRoomAtPoint`            | `levelId`            |                                        |
| `createRoomSeparation`        | `levelId`            |                                        |
| `createGridLine`              | `levelId` (optional) |                                        |
| `createPlanRegion`            | `levelId`            |                                        |
| `createStair`                 | `baseLevelId` + `topLevelId` | Two-ended; no single `levelId` |
| `moveLevelElevation`          | `levelId`            |                                        |
| `assignWallDatumConstraints`  | `baseConstraintLevelId`, `topConstraintLevelId` | Wall datum constraints |

Mnemonic: `levelId` everywhere except `createRoof` (`referenceLevelId`) and
constraint-binding commands which use `baseConstraintLevelId` /
`topConstraintLevelId`. Stairs span levels, so they get two distinct fields.

## Identifier field (new-element ID input)

The "ID of the new element you are creating" varies by command. Most accept
`id` at the top level. A few use a domain-specific alias.

| Command                       | ID input field   | Notes                          |
| ----------------------------- | ---------------- | ------------------------------ |
| `createLevel`                 | `id`             | optional, auto-generated       |
| `createWall`                  | `id`             | optional                       |
| `createFloor`                 | `id`             | optional                       |
| `createRoof`                  | `id`             | optional                       |
| `createDormer`                | `id`             | optional                       |
| `createRoomOutline`           | `id`             | optional                       |
| `createRoomRectangle`         | `roomId`         | aliased via `roomId`           |
| `createRoomPoly`              | `roomId`         | aliased via `roomId`           |
| `placeRoomAtPoint`            | `id`             | REQUIRED                       |
| `CreateToposolid`             | `toposolidId`    | REQUIRED                       |
| `UpdateToposolid`             | `toposolidId`    | REQUIRED                       |
| `DeleteToposolid`             | `toposolidId`    | REQUIRED                       |
| `create_toposolid_subdivision`| `id`             | REQUIRED                       |

Mnemonic: toposolid commands always use `toposolidId`. The room-poly /
room-rectangle helpers use `roomId`. Everywhere else, `id` works.

For commands that target an existing element (e.g. `moveWallDelta`,
`updateElementProperty`), the target is a domain-specific reference field —
`wallId`, `elementId`, `floorId`, `roofId`, etc. — not `id`. When in doubt,
inspect the schema (see bottom of file).

## Dormer (special case)

`createDormer` (KRN-14) intentionally diverges from the generic host /
position / height naming used elsewhere — it speaks in roof-local
ridge-relative coordinates. Read this table carefully; nothing else in the
CMD-V3 surface looks like it.

| Conceptual slot       | `createDormer` field                                  | Notes                          |
| --------------------- | ----------------------------------------------------- | ------------------------------ |
| Host element          | `hostRoofId` (not `hostElementId` / `hostId`)         | REQUIRED                       |
| Position on host      | `positionOnRoof: {alongRidgeMm, acrossRidgeMm}`       | NOT `vertexMm: {xMm, yMm}`. Ridge-local coordinates: `alongRidgeMm` measured along the ridge, `acrossRidgeMm` measured across (perpendicular to ridge). |
| Wall height (eave)    | `wallHeightMm` (not `heightMm`)                       | REQUIRED, >0                   |
| Width / depth         | `widthMm`, `depthMm`                                  | both REQUIRED, >0              |
| Dormer roof type      | `dormerRoofKind` (not `dormerKind`, not `roofKind`)   | default `"flat"`               |
| Dormer roof pitch     | `dormerRoofPitchDeg`                                  | optional                       |
| Materials             | `wallMaterialKey`, `roofMaterialKey`                  | optional                       |
| Cut floor below       | `hasFloorOpening`                                     | default `false`                |

Common dormer mistakes (from real authoring traces):

1. Sending `vertexMm: {xMm: 4000, yMm: 1500}` instead of
   `positionOnRoof: {alongRidgeMm: 4000, acrossRidgeMm: 1500}` —
   the engine cannot rescue this; the dormer will fail validation.
2. Sending `heightMm` instead of `wallHeightMm` — the field is silently
   ignored (extra="ignore") and you get a missing-required-field error on
   `wallHeightMm`.
3. Sending `dormerKind` instead of `dormerRoofKind` — same silent-ignore
   trap, defaults to `"flat"`.
4. Sending `hostElementId` instead of `hostRoofId` — same silent-ignore;
   you'll get a missing-required-field error on `hostRoofId`.

## Command name casing

The convention across the 265 commands is *inconsistent*:

- Most commands use **camelCase** (`createWall`, `createFloor`, `createRoof`).
- Toposolid + Sheet + ViewTemplate commands use **PascalCase**
  (`CreateToposolid`, `CreateSheet`, `CreateViewTemplate`).
- A subset of presentation / annotation / concept-seed commands uses
  **snake_case** (`create_saved_view`, `create_decal`, `commit_concept_seed`,
  `create_toposolid_subdivision`).
- One command pair (`createCallout` vs `CreateCallout`) exists in BOTH
  camelCase and PascalCase as distinct commands — the camelCase one creates
  a documentation callout, the PascalCase one creates a schedule callout
  view. They are not aliases.

The dispatcher matches on the exact `type` string. Sending `createtoposolid`
or `CreateWall` will 404 in the MCP layer.

### Top-20 quick reference (exact casing)

Use these spellings verbatim. These are the commands that come up most often
when authoring a house from scratch.

| Command (exact)                | What it does                                    |
| ------------------------------ | ----------------------------------------------- |
| `createLevel`                  | New storey datum + plan view                    |
| `createWall`                   | One wall segment                                |
| `createWallChain`              | Contiguous wall segments, atomic                |
| `createWallType`               | New wall layer stack                            |
| `createFloor`                  | Slab from boundary polygon                      |
| `createRoof`                   | Roof from footprint polygon                     |
| `createDormer`                 | Dormer cut into host roof                       |
| `createRoomOutline`            | Pure space outline (no walls)                   |
| `createRoomRectangle`          | Room + 4 perim walls (axis-aligned)             |
| `createRoomPoly`               | Room + perim walls from polygon                 |
| `createRoomSeparation`         | Invisible separator line                        |
| `createStair`                  | Stair (`straight`, `l_shape`, `spiral`, etc.)   |
| `createGridLine`               | Reference grid line                             |
| `createBalcony`                | Balcony slab + railing                          |
| `createBeam`                   | Structural beam                                 |
| `createColumn`                 | Structural column                               |
| `createSlabOpening`            | Slab cutout                                     |
| `createRoofOpening`            | Roof cutout                                     |
| `createWallOpening`            | Wall cutout                                     |
| `CreateToposolid`              | Terrain solid (PascalCase!)                     |

## How to discover field names for a new command

When the cheatsheet does not cover a command (the surface is 265 strong and
growing), or when you suspect this file is stale, hit the live schema
endpoint:

```bash
GET /api/v3/commands/{name}
```

Returns the Pydantic-derived JSON Schema for the command, including the
camelCase aliases (the wire-format names) and the required/optional split.
The endpoint is implemented in
`app/bim_ai/routes/v3_meta.py:117` and routed under
`/v3/commands/{name}`.

Bulk discovery:

```bash
GET /api/v3/commands
```

Returns the full registry — useful for grepping the catalog when you don't
remember whether the command is called `createDormer` (yes) or
`createRoofDormer` (no).

When in doubt, treat the live schema as canonical, not this file. If you
find a divergence, leave a note for the bim-ai maintainers (issue #133 is
the umbrella for naming-consistency cleanup).
