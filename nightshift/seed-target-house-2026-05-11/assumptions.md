# Target House Assumptions

- Plan dimensions use the floorplan labels: overall footprint 14000 mm by 10000 mm.
- The model front is south at `yMm = 0`; depth runs north to `yMm = 10000`.
- Floor-to-floor height is 3000 mm. Upper wall spring/eave height is about 2500 mm above the upper floor, with a white roof shell ridge above.
- The white upper shell is represented with supported walls, an asymmetric gable roof, roof opening, explicit return walls, floors, and sweeps. It is not represented with final mass placeholders.
- The ground-floor right bay is modelled as a recessed carport/covered void, matching the exterior images, while the interior programme keeps bath/laundry and utility at the north-east behind it.
- The roof court is modelled as an open-to-sky terrace room with access from the landing through a glass door. This reconciles the floorplan label "open-to-sky roof court / void" with the seed spec requirement for an occupied roof terrace.
- Vertical cladding rhythm is represented by material/layer intent plus sparse explicit facade battens at key visible zones. Dense battens around every opening are intentionally avoided to reduce visual clutter and crossing artifacts.
- Room boundaries use real exterior/interior walls where possible. A room outline is still supplied for schedule/label data, but not as a universal closure hack.
