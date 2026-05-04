# CLI one-family home fixture (authoritative path)

**Do not** rely on a static `deleteElements` JSON list: the commit engine rejects unknown IDs and the seed model evolves, so hard-coded UUIDs break replay.

## Apply the reference house

With API + DB running and a model UUID (seed demo main model is deterministic):

```bash
export BIM_AI_BASE_URL=http://127.0.0.1:8500
export BIM_AI_MODEL_ID=75cd3d5c-f28c-5dd2-b8bf-8cbba71fd10f   # demo main (see app/scripts/seed.py)
node scripts/apply-one-family-home.mjs --dry-run
node scripts/apply-one-family-home.mjs
```

The script:

1. `GET /api/models/:id/snapshot`
2. Builds `deleteElements` with **every** key in `elements`
3. Applies a single bundle of `createLevel` / walls / room outlines / openings / dimension / `saveViewpoint`

## Geometry notes (v2 fix)

An earlier static bundle left **gaps** (~350 mm) between sleeper walls and the spine because segment end X did not meet the spine western face. Current coordinates in `scripts/apply-one-family-home.mjs` end west segments at **10900** and begin east segments at **11100** for a **11000** centerline spine with **200** mm thickness.

## Browser check

- Dismiss the onboarding welcome (or use stored “don’t show”).
- Set layout **Plan + 3D** and confirm plan + Explorer list match `bim-ai validate`.
