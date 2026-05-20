# Target House 2 Acceptance Checklist

## Source And Evidence

- [ ] Source PDFs are copied into `seed-artifacts/target-house-2/source`.
- [ ] Rendered source readout exists for EG, DG, elevations, section, area, and
  volume documents.
- [ ] Sketch IR and BIM information requirements are included in the artifact
  evidence folder.
- [ ] Assumption/tolerance ledger names all non-exact dimensions and deferred
  construction details.

## Bundle

- [ ] Bundle compiles from the seed DSL recipe to `cmd-v3.0`.
- [ ] The seed loads with `make seed name=target-house-2`.
- [ ] Building is centered on a site/toposolid.
- [ ] Doors/windows are hosted on authored walls.
- [ ] Room outlines preserve DIN 283 source target areas.
- [ ] Stairs have slab openings and are not overlapped by placed assets.
- [ ] Dormer proxies are roof-hosted.

## Live Acceptance To Run After Initial Seed

- [ ] Run product validation/advisor/constructability evidence.
- [ ] Capture 3D, plan, elevation, section, and room schedule screenshots.
- [ ] Resolve or explicitly tolerate all findings.
- [ ] Mark manifest acceptance as accepted only after current-head live evidence
  is generated.
