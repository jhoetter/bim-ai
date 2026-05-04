# Full-house generation protocol (agents)

Agents treat authoring as **command bundles against the canonical model**. The browser, CLI, and API share the same commit path (`/api/models/{id}/commands`).

## Inputs (brief schema)

Brief files can be linted locally via:

```bash
pnpm exec bim-ai plan-house --brief spec/examples/small-house-brief.json --out /tmp/house-bundle.json
```

| Field          | Required | Notes                                      |
|----------------|----------|--------------------------------------------|
| `version`      | ✓       | `"1"` acceptable                          |
| `stylePreset`  |         | e.g. `residential`; maps to code presets later |
| `siteWidthM`   | ✓       | Lot width                                   |
| `siteDepthM`   | ✓       | Lot depth                                   |
| `floors`       | ✓       | Integer ≥ 1                                 |
| `rooms`        | ✓       | `{ name, areaTargetM2 }[]`               |

Extend later with sheets, elevations, IDS targets, tolerances.

## Agent loop

1. `bim-ai schema` + `bim-ai presets`
2. `bim-ai snapshot` + `bim-ai summary`
3. Author bundle (levels → shells → openings → QA commands)
4. `bim-ai apply-bundle --dry-run bundle.json`
5. `bim-ai validate` — fail on blocking errors; optionally cap warnings
6. `bim-ai apply-bundle bundle.json`
7. `bim-ai command-log` for an auditable change list + summary export

## Validation targets

- No `severity=error` rows from `/api/models/{id}/validate`
- Respects `blocking` flags on violations
- Summary rollups match intent (counts by kind, walls by level)

## Command coverage roadmap

Primitives evolve; agents must introspect `/api/schema` (`commandsUnionSchema`). Target richer coverage: slabs, roofs, stairs, phased tasks, federation metadata, sheet/view templates.
