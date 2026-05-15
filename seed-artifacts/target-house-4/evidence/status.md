# Target House 4 Status

Status: draft

The artifact has been authored from the Testhaus PDFs and loaded successfully
as model `b4329ca6-bef7-5be7-8341-cf73e17ac468`.

Current gate state:

- `sketch_bim.py compile --seed target-house-4`: pass, 177 commands.
- `make seed name=target-house-4`: pass; model
  `b4329ca6-bef7-5be7-8341-cf73e17ac468` reseeded.
- `constructability-report --profile construction_readiness`: pass; 0 findings.
- `sketch_bim.py advisor --model b4329ca6-bef7-5be7-8341-cf73e17ac468`:
  pass; 0 warning groups, 29 info findings.
- `node scripts/verify-sketch-seed-artifacts.mjs --seed target-house-4
  --require-material-check`:
  pass.
- The source recipe now includes front glass panels, basement openings,
  roof-tile material, kitchen clearance correction, attic-wall
  construction-readiness metadata, and one continuous sloped Toposolid host
  cut by an explicit basement excavation relation. This replaces the
  superseded strip-terrain workaround.
- Renderer code now places dormer bodies on the sampled roof plane and adds
  dormer glazing.
- Constructability geometry now has physical collision proxies for `dormer`
  and `toposolid`.
- The methodology now requires direct server checks against
  `/api/models/<id>/constructability-report?profile=construction_readiness`.
- Browser evidence was recaptured in `phase-final/browser-evidence.json` with
  the saved long-elevation 3D view active, the tour dismissed, and a continuous
  non-flat Toposolid visible around the house instead of the superseded strip
  terrain.

See `visual-delta.md` for the specific drawing/model mismatches that drove
this refinement pass.
