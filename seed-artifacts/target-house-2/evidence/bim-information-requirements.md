# Target House 2 BIM Information Requirements

Last updated: 2026-05-20

## Source Contract

`target-house-2` is generated from `/Users/jhoetter/Desktop/Testhaeuser/Testhaus Leo`.
The source set is a mixed scan/PDF package for a 1956 Dahlerbrueck double-house
design and a current sales/administrative packet for Weidenstrasse 6,
58579 Schalksmuehle.

Primary geometric sources:

- `EG.pdf`
- `DG.pdf`
- `Grundrisse, Schnitt.pdf`
- `Ansichten.pdf`
- `Wohnflaechenberechnung.pdf`
- `Umbauter Raum.pdf`
- `535_06 KH Expose.pdf`

## Quality Target

`project_initiation_bim`

The seed must be useful for opening the project, inspecting the main building
geometry, rooms, storeys, facade rhythm, roof shape, site context, and starter
schedules. It is not a construction-document model.

## Required Model Scope

- Model the full paired two-family double-house context shown on the original
  plans, with the Weidenstrasse 6 semi-detached half preserved as the subject
  evidence context.
- Use a centered site/toposolid so the building is not partially off terrain.
- Include basement, ground floor, dachgeschoss, and roof datum levels.
- Use typed walls, slabs, and roof elements with material/layer intent.
- Include exterior walls, major internal partitions, floors, cellar/ground/DG
  room outlines, stairs, slab openings, hosted doors/windows, dormer proxies,
  property/site context, and saved diagnostic views.
- Preserve source room areas from the DIN 283 living-area calculation for one
  half: EG 61.61 m2, DG 54.42 m2, total 116.03 m2. The full paired building is
  232.06 m2 by the same document.
- Preserve the DIN 277 volume calculation for one half: built area 86.625 m2,
  enclosed volume 660.88 m3. The full paired building is 173.25 m2 / 1321.76 m3.

## Key Source Dimensions

- Full paired building footprint: 19.80 m x 8.75 m.
- One half footprint: 9.90 m x 8.75 m.
- Basement and ground floor volume height basis: 2.25 m + 2.75 m.
- DG and roof calculation basis from `Umbauter Raum.pdf`: eaves/roof geometry
  uses 0.60 m, 5.90 m, 2.625 m, and attic volume assumptions.

## Tolerances

- The original drawings are scans/photographs with folds and perspective
  distortion; exact wall offsets are approximate.
- The seed uses rectangular room outlines and major partitions to preserve BIM
  intent and schedule semantics. Fine-grained wall jogs, masonry bond, stair
  tread-by-tread historic detailing, and foundation step geometry are deferred.
- Dormers are modeled as roof-hosted proxies where the product has deterministic
  dormer support. Exact historic dormer carpentry is deferred.
- Administrative PDFs are included as source provenance, but not all parcel,
  energy, drainage, and altlast metadata is modeled beyond starter site context.

## Acceptance Checks

- `seed-artifacts/target-house-2` is self-contained and portable.
- `bundle.json` is valid `cmd-v3.0`.
- `make seed name=target-house-2` loads the artifact.
- Source/evidence documents explain source-derived dimensions, programme, and
  known tolerances.
- Product validation/advisor evidence should be collected in a later live run
  before marking the artifact as fully accepted.
