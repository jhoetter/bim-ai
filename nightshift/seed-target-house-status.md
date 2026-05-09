# seed-target-house — rebuild status (2026-05-09)

Full rebuild from scratch per `spec/target-house-seed.md` (v3 boolean-subtraction
massing spec) and visual ground truth `spec/target-house-vis-colored.png`.

## What changed vs previous version

| Item | Before | After | Reason |
| ---- | ------ | ----- | ------ |
| GF_W | 7000 mm | 7500 mm | East ext = 2500 = exactly 1/3 GF_W (spec §1) |
| East extension width | 2000 mm | 2500 mm | 1/3 of 7500 ✓ |
| UF west/north wall material | cladding_warm_wood | white_render | Spec §4 Material A on "side walls of second floor" |
| Parapet wall material | cladding_beige_grey | white_render | Parapet is part of the upper white shell |
| Front door position | alongT=0.55 (centre) | alongT=0.88 (far right) | Spec §3 "door on far right" |
| GF south window 1 | alongT=0.10 | alongT=0.15 | Better proportioning vs 7500 mm facade |
| GF south window 2 | alongT=0.22 | alongT=0.37 | Aligns with stair for tread visibility |
| Third GF window | removed | — | Spec §3 says exactly two portrait windows |
| Stair position | x=4000, y=3000..6500 | x=2700, y=500..4020 | Behind window 2 (spec §3 "8 visible treads") |
| Loggia recessZones | 0.0–1.0 single zone | 0.0–1.0 single zone | Same; chimney mass now occupies centre loggia void |
| Chimney protrusion | missing | createMass (x=1500..3000, y=0..1500, H=3000) | Spec §3 "protruding chimney-like volume clad in siding" |
| Plinth (Material D) | missing | GF slab boundary extended 500 mm on all sides | Spec §4 "extends 0.5 units beyond footprint" |
| Dormer | createDormer call | removed | Spec was updated (boolean-subtraction via roof footprint) |
| Terrace connection | hf-door-dormer on UF east wall | hf-door-terrace (same UF east wall) | Renamed; same architectural function |

## Element counts (rebuild snapshot)

52 total: 13 walls, 3 windows, 3 doors, 3 floors, 1 roof, 1 sweep,
1 mass (chimney), 1 balcony, 1 stair, 1 slab_opening, 1 railing, 5 rooms,
2 levels, 1 project_base_point, 1 internal_origin (auto), 4 plan_views
(2 explicit + 2 VIE-05 auto), 4 viewpoints, 1 section_cut, 1 sheet, 3 schedules.

## Quality gates

| Gate | Result |
|------|--------|
| `node scripts/build-seed-snapshot.mjs` | ok — revision=1, 52 elements, blocking=0 |
| `pytest app/tests/test_one_family_bundle_roundtrip.py --no-cov` | 1/1 pass |
| `pytest app/tests/test_prd_traceability_matrix.py --no-cov` | 6/6 pass |
| Typecheck errors | 0 introduced (pre-existing errors on main unchanged) |

## Visual fidelity assessment

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Asymmetric near-symmetric gable | good | ridgeOffset=500, eaveL=1500, eaveR=2300, slope=30° — matches visual |
| Two-stack massing | good | GF 7500×8000, UF 5000×8000 west-aligned, terrace 2500×8000 |
| East extension = 1/3 GF width | good | 2500 = GF_W/3 = 7500/3 ✓ |
| White wrapper shell (side walls) | good | UF E/N/W walls = white_render (corrected from previous) |
| Parapet walls white | good | Corrected from cladding_beige_grey |
| Chimney protrusion (spec §3) | added | createMass x=1500..3000 inside loggia void |
| Plinth base (spec §4) | added | GF slab extended 500 mm on all sides |
| Door far right | good | alongT=0.88 → x≈6600 of 7500 |
| Two portrait windows (stair visible) | good | win1@0.15, win2@0.37; stair at x=2700 behind win2 |
| Trapezoidal slope-following window | good | outlineKind=gable_trapezoid + attachedRoofId |
| Sliding glass curtain wall (right loggia) | good | 1800 mm sliding_double |
| Loggia recess full-width | good | setbackMm=1500, floorContinues=true |
| Picture-frame sweep | good | Pentagon path with computed RIDGE_H_ABS |
| Standing-seam metal roof | good | metal_standing_seam_dark_grey |
| Balcony (3 cable rails) | good | createBalcony, balustradeHeight=1100 |
| Terrace sliding doors | good | hf-door-terrace on UF east wall |

## How to re-run

```sh
# Rebuild snapshot fixture
node scripts/build-seed-snapshot.mjs

# Run visual checkpoint (if Playwright configured)
cd packages/web && pnpm exec playwright test e2e/seed-target-house.spec.ts

# Inspect viewpoints
open packages/web/test-results/seed-target-house-{main-iso,front-elev,side-elev-west,rear-axo}-actual.png
```
