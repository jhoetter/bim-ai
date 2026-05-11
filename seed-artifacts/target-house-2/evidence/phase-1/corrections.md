# Phase 1 Corrections

Corrections already made after live seed/advisor attempts:

- Normalized asset `symbolKind` and `category` values to the engine-supported `IndexAsset` enum.
- Removed invalid generated material assignments for floors/railings and kept only valid wall material assignments plus raw door/window material updates.
- Moved the front door and living glazing to avoid a blocking hosted-opening overlap.
- Reduced and repositioned several placed assets to reduce hard clashes.
- Added concept slab structural-system metadata for the long-span floor warnings.

Still pending:

- Resolve remaining door operation clearance warnings around the loggia, roof court, bedroom 2, living threshold, and adjacent assets.
- Move or simplify the remaining kitchen/living/bedroom/service assets that still clash.
- Add a connected door/opening condition for `hf-room-service`.
- Rerun browser screenshots/right-rail parity when the web app is available.
