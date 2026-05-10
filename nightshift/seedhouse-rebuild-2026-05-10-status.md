# Seedhouse Rebuild Status — 2026-05-10

## Summary

Rebuilt the canonical seedhouse bundle from scratch against `spec/target-house-seed.md` and `spec/target-house.jpeg`.

Verdict: usable as a project-initiation model with caveats. Advisor warnings are clean, rooms use real walls/partitions, and the roof terrace renders as a real cutout with visible occupied terrace geometry. The main front-left view reads as the intended white wrapper/loggia house, but the roof-terrace cutout is strongest from the right/rear/high views rather than the default main view.

Post-review correction: removed 37 proud vertical cladding sweep objects after screenshot review showed they read as detached black fence-like geometry rather than façade boards. The cladding intent remains encoded through the warm cladding wall type/material.

Second reviewer correction: after a live screenshot showed the upper envelope still reading as a rectangular ghost box, the renderer was patched so roof-attached walls sample the roof profile along the full wall length instead of only at both endpoints. The seed also removed conceptual `createMass` placeholders from the final envelope because masses are translucent study geometry, not finished walls/returns.

## Verification

| Check | Result |
| --- | --- |
| `node scripts/build-seed-snapshot.mjs` | Pass. Fixture written, revision 1, 121 elements, blocking 0. |
| `make seed` | Pass. Seeded model `75cd3d5c-f28c-5dd2-b8bf-8cbba71fd10f`. |
| CLI advisor warnings | Pass. `total: 0`. See `nightshift/seedhouse-rebuild-2026-05-10-advisor-warning.json`. |
| CLI advisor info | 7 info items: 3 glTF export manifest hints and 4 material layer-stack hints. Tolerated; not architectural blockers. |
| `pnpm --filter @bim-ai/web exec playwright test e2e/seed-target-house.spec.ts` | Pass. 5/5 checkpoint screenshots rendered. |
| `pnpm --filter @bim-ai/web exec vitest run src/viewport/meshBuilders.asymmetricRoof.test.ts` | Pass. Regression covers roof-attached walls crossing an asymmetric gable ridge. |
| Plan diagnostic capture | Pass. Ground/upper plan canvases captured from the Playwright E2E fixture. |

## Screenshot Evidence

| View | Path | Visual verdict |
| --- | --- | --- |
| Main front-left axonometric | `packages/web/test-results/seed-target-house-main-iso-actual.png` | Pass with caveat: white upper wrapper, gable-cut roof/wall silhouette, recessed loggia, rails, smaller cladded base, and cantilever read; roof cutout is only lightly legible from this angle. Detached cladding-bar and ghost-mass artifacts removed in reviewer passes. |
| Front elevation | `packages/web/test-results/seed-target-house-front-elev-actual.png` | Pass: gable-cut upper envelope, three-bay upper loggia composition, and black horizontal rails read; glazing is paler than ideal. |
| East side / roof terrace | `packages/web/test-results/seed-target-house-side-elev-east-actual.png` | Pass: terrace is a visible roof void with return/glass geometry, not metadata only. |
| Rear/right axonometric | `packages/web/test-results/seed-target-house-rear-axo-actual.png` | Pass: cutout, return faces, and white folded roof are visible. |
| High terrace view | `packages/web/test-results/seed-target-house-terrace-cutout-actual.png` | Pass: occupied roof terrace with table/chairs and glass guard is clearly visible. |
| Ground plan diagnostic | `nightshift/seedhouse-rebuild-2026-05-10-ground-plan-diagnostic.png` | Partial pass: real wall/partition geometry is visible with no room-separation clutter; capture is zoomed into the plan rather than showing the whole floor. |
| Upper plan diagnostic | `nightshift/seedhouse-rebuild-2026-05-10-upper-plan-diagnostic.png` | Partial pass: upper wrapper/terrace plan geometry is visible; capture is zoomed and not a full-plan sheet. |

## Advisor Classification

| Finding | Classification | Rationale |
| --- | --- | --- |
| `room_derived_interior_separation_ambiguous` | Fixed | Initial live advisor showed legacy `hf-rs-*` room-separation remnants; reseeding from the new bundle cleared them. The final bundle has no room-separation commands. |
| `room_boundary_open`, `room_unenclosed`, `room_no_door`, `room_target_area_mismatch` | Fixed / absent | Final warning pass reports zero findings. Rooms align to real walls/partitions and have doors/windows near access points. |
| `floor_overlap`, host/opening, stair, roof, schedule/sheet viewport warnings | Fixed / absent | Final warning pass reports zero findings. Roof-attached wall rendering now has a regression test for ridge-crossing gable cuts. |
| `gltf_export_manifest_expected_extension_missing` | Tolerated info | Export witness hint only; does not affect initiation geometry or advisor warning gate. |
| `material_catalog_missing_layer_stack` | Tolerated info | Floor/roof material keys resolve visually; typed layered assemblies are not required for this seed initiation. |

## Remaining Risk

- The white roof terrace cutout is visible and occupied, but its front-left silhouette is weaker than the reference because the renderer's asymmetric roof opening reads best from right/rear/high cameras.
- The rendered cladding is now less detailed than the reference because the explicit batten sweeps were removed after they produced misleading detached geometry.
- The final envelope no longer uses mass placeholders, but the folded wrapper thickness is still an approximation using roof/wall/sweep geometry rather than a true continuous shell solid.
- The plan diagnostic screenshots prove real wall geometry/no separation clutter, but the captured canvas is zoomed; a better plan camera fit workflow would improve evidence quality.
