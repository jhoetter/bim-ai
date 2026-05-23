# Testhouse Methodology Audit — 2026-05-23

Trigger: after the iter-3 alpha run produced a 7/10 "vanilla box" exterior
with no interior detail and no per-floor structural validation, the user
asked for a methodology review. The seven-floor iter ladder hides too much
behind a single grade, and the supporting log channel is too thin for
`/agents` to render a useful provenance trail.

This audit lists the flaws, names the fix, and points at the documents
that change. It is the rationale companion to the v2 tracker
(`spec/trackers/testhouse-clean-rebuild-tracker.md`).

## Flaws found

### 1. Outside-in iter ladder contradicts inside-out methodology

The v1 tracker (iter rows 3–7) authors exterior walls + floors + main
roof first, then comes back later for openings (iter-6) and rooms
(iter-7). The inside-out principle — already in user-memory and in
`scripts/archive/testhouse_iter16c_partitions_from_rooms.py` — says the
opposite: rooms first per source floor plan, then partitions, then
exterior walls follow from the room outlines.

The v1 ladder shipped a "vanilla box" at iter-3 with no door, no
window, no room, no party-wall flatness. The grader scored it 7/10
because the rubric weighted "rectangular shell present" highly; the
score was correct *for that rubric*, but the rubric was authoring the
wrong thing.

**Fix.** Replace the v1 iter table with a **per-floor inside-out
loop**. Each floor goes rooms → partitions → openings → exterior
walls → structural gate → visual gate before any work on the next
floor.

### 2. Score bars hide a vanilla model as acceptable

The v1 done-criteria were `≥4/10` (iter-3..5) and `≥7/10` as final
stop criterion. Both bars are too low: a stripped-down extruded
rectangle clears `≥4/10` and the prior `≥7/10` stop produced exactly
the "vanilla house" the user rejected.

**Fix.** Raise per-floor done-criteria to **`≥9/10` exterior AND
`≥9/10` interior**, with `10/10` as the target. Sub-criterion: every
source-required artefact (room, door, window, dimension call-out,
elevation line) must have a backing element or an explicit
source-backed `existing_condition` disposition. Anything below `9/10`
triggers a corrector subagent + repair pass; the floor does not
advance until it passes.

### 3. No per-floor gate

v1 iter-3 authors all three storeys' worth of walls before any visual
check. A typo in the first level (e.g. swapped axis or wrong height)
propagates upward silently.

**Fix.** **One floor per iter**. The driver enforces the order
`KG → EG → DG → roof`. Each floor commits, runs structural gates
(advisor + constructability + integrity + level-completeness +
physical-topology), then captures ortho + plan + per-elevation views,
then asks the grader for `≥9/10`. Only then does the next floor open.

### 4. IR is invisible to the `/agents` dashboard

`app/bim_ai/routes/agent_runs.py::_dashboard_summary` reads
`existing-building-ir.json` and counts `extractedFacts[].kind/status`.
The v1 reader IR has neither field, so the dashboard reports
`factTotal: 0` for every house even after a full reader pass.

**Fix.** Reader IR v2 (`existingBuildingIR_v2`) carries an
`extractedFacts: [{factId, kind, status, levelId, sourceDocId,
sourcePage, sourceRegion, valueMm?, confidence, note}]` array. Each
fact references the source document + page + (optionally) the pixel
region that produced it. Backwards-compatible: the v1 top-level keys
stay so the existing IR isn't broken, but everything load-bearing for
authoring now also lives under `extractedFacts`.

### 5. No source → spec → model provenance trail in the commit context

The v1 logging contract emits four `bim_ai.testhouse_iter.*` records
per phase. None of them carries a list of `factIds` that the slice
consumed, the source pages those facts came from, or the live element
ids the slice produced. The user cannot, from `/agents`, trace "EG
plan page X → fact F002 → wall element W003".

**Fix.** Extend the structured-log schema and the
`agent_context.testhouse_iter` block with three required arrays:

```jsonc
{
  "testhouse_iter": {
    "house": "alpha",
    "iter": 3,
    "phase": "eg-rooms",
    "consumedFactIds":   ["F001-EG-east-width", "F012-EG-room-livingroom"],
    "sourceEvidence":    [
      { "docId": "srcdoc-22993cc5012b", "page": 1, "role": "floor_plan",
        "renderedPath": "tmp/reverse-bim/house-alpha/preflight/rendered-pages/srcdoc-22993cc5012b/EG-1.png" }
    ],
    "producedElementIds": ["th-alpha-i3-eg-room-livingroom", "th-alpha-i3-eg-wall-N"]
  }
}
```

This is the single fact `/agents` needs to render the "doc → fact →
element" trail. The fields are additive; the inspector iter-picker
keeps reading `{house, iter, phase}` exactly as today.

## What `/agents` is missing (coordination ask)

The dashboard already surfaces fact counts, validation reports,
rendered-page-groups, and per-iter captures (legacy path). It does
**not** yet:

1. Render the source PDFs/PNGs the reader was looking at when it
   produced a fact. The data is on disk under
   `tmp/reverse-bim/house-<X>/preflight/rendered-pages/<docId>/<page>.png`;
   `agent_runs.py` would need a new
   `GET /agent-runs/houses/{house}/source-pages/{docId}/{file}` endpoint
   serving those files, then `AgentHouseDashboard.tsx` would need a
   thumbnail strip + click-to-zoom modal.
2. Show the `consumedFactIds → sourceEvidence → producedElementIds`
   trail described in flaw 5. The commit log already carries
   `context.testhouse_iter`; the inspector just needs to render those
   three arrays inline (with link-out to the source page thumbnail
   from #1 and to the live element via `?at=<commit>`).
3. Inline the subagent's grade report markdown next to the iter's
   captures (the file is already served by
   `GET /agent-runs/houses/{house}/iterations/{iter}/scoring`).

These three additions are owned by the time-travel + inspector agent
(`spec/trackers/agent-run-inspector-tracker.md`); a dedicated
coordination note lives at
`spec/agents-view-traceability-spec.md`.

## What does NOT change

- The `commit_context(...)` wrapping contract — the three new arrays
  are additive inside the existing `testhouse_iter` block; the
  inspector iter-picker still resolves "iter N of house X" the same
  way.
- The reader-pass output location
  (`tmp/reverse-bim/house-<X>/understanding/existing-building-ir.json`).
- The `bim_ai.testhouse_iter` log channel name.
- The per-iter capture path (we now write to **both** the per-house
  layout the iter-picker reads and the legacy layout the dashboard
  reads — additive, not a replacement).
