# Evidence

Accepted live packet generated on 2026-05-11 from model
`target-house-1:6c3940ae-c0a1-5bc3-a0fa-38c9195b28d2`.

Key files:

- `target-house-1.recipe.json` — reviewable `seed-dsl.v0` source used to compile `../bundle.json`.
- `sketch-ir.json` — schema-valid sketch understanding IR for the target-house source folder.
- `acceptance-gates.json` — latest live acceptance packet; `ok: true`.
- `live/advisor-warning.json` — latest warning pass; `total: 0`.
- `screenshots/*.png` — checkpoint screenshots for required 3D, plan, and diagnostic views.

Current tolerance: visual gate marks all seven screenshots as `needs_review`
because no target comparison map was supplied. The screenshots are nonblank and
advisor warnings are clean.
