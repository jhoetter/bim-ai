# Target-House-1 Acceptance Checklist

Status: blank no-seed checklist for the later generation run. Fill this before
generation as a readiness gate, then attach a completed copy to final seed
evidence after approval.

## No-Seed Readiness

- [ ] User has approved starting actual `target-house-1` generation.
- [ ] `seed-artifacts/target-house-1` is absent before approval.
- [ ] Source images and `target-house-seed.md` have been read in the current
      run.
- [ ] Scale basis is chosen: floorplan 14.0 m by 10.0 m, or documented alternate.
- [ ] Project north/site assumption is documented.
- [ ] Draft IR validates against the active capability matrix.
- [ ] Capability map partial features have explicit evidence requirements.
- [ ] Phase plan and risk register are attached to the run handoff.

## Visual Acceptance

- [ ] Main front-left axonometric matches the reference silhouette.
- [ ] Upper white wrapper is visibly thicker than a standard roof plane.
- [ ] Ground-floor clad base reads smaller than the upper wrapper.
- [ ] Upper overhang/cantilever and covered shadow void are visible.
- [ ] Roof terrace cutout is a real occupied void with flat floor and return
      faces.
- [ ] Roof terrace has access glazing/door and guard/edge protection.
- [ ] Front loggia is recessed inside the shell and has side/roof returns.
- [ ] Front loggia shows three-bay rhythm and thin black guard rail.
- [ ] Vertical cladding is visible on ground base and central upper pier.
- [ ] Roof material reads as matte white shell, not dark/brown roof.
- [ ] Required screenshots exist for main, front, rear/right, roof-court,
      loggia, ground plan, first-floor plan, and wire diagnostic views.

## BIM Data Acceptance

- [ ] All rooms/spaces from the floorplan are present with level, name, id,
      target area, function, bounded status, and schedule flag.
- [ ] No blocking room boundary, room access, room ambiguity, stair, or slab
      opening Advisor findings remain.
- [ ] Exterior walls, interior walls, floors/slabs, roof, stairs, doors,
      windows, guards, rooms, and assets use BIM categories rather than final
      mass placeholders.
- [ ] Wall, floor, roof, glazing, rail, cladding, and terrace types have material
      and thickness/layer intent.
- [ ] Room and element classification placeholders are populated.
- [ ] Structure-lite support and load-path assumptions are recorded.
- [ ] MEP-lite wet-room/service-zone placeholders and coordination notes are
      recorded.
- [ ] Room schedule and door/window schedule are generated.

## Advisor, Evidence, And Export Acceptance

- [ ] Dry-run and commit evidence exists for every phase.
- [ ] Advisor warning/info payloads are collected after every meaningful phase.
- [ ] Constructability `construction_readiness` profile is captured before final
      acceptance.
- [ ] Every current-phase finding is fixed, deferred with phase rationale,
      tolerated with evidence, or blocked.
- [ ] Final evidence uses current git head, model revision, and Advisor rule
      digest.
- [ ] IFC, GLB, PDF/sheet, schedules, evidence package, and source bundle export
      manifests exist or have explicit blocker entries.
- [ ] Final packet includes a tolerance ledger with owner and expiry condition
      for every unresolved issue.
