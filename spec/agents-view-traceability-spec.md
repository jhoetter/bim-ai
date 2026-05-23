# `/agents` View Traceability Spec — coordination ask

Audience: the time-travel + inspector agent
(owner of `app/bim_ai/routes/agent_runs.py`,
`app/bim_ai/agent_run_parser.py`, and `packages/web/src/agents/`).

Author: the testhouse-rebuild agent
(owner of `scripts/testhouse_drive.py` and the v2 tracker).

Why: after a user review the `/agents` dashboard is missing three
pieces that the testhouse v2 rebuild needs in order to be auditable
end-to-end. Each ask is small, additive, and unblocks the testhouse
methodology from "data exists but is invisible" to "every fact has a
visible source page next to it".

## Ask 1 — serve the source pages

The testhouse driver writes source-document PNGs to:

```
tmp/reverse-bim/house-<X>/preflight/rendered-pages/<docId>/<filename>.png
```

The `/agents` dashboard already knows the path
(`_dashboard_summary.renderedPageGroups` counts the docId subdirs).
What's missing is a way for the UI to *show* one of those pages.

Proposed endpoint (mirrors the existing capture-server pattern at
`agent_runs.py:326`):

```
GET /api/agent-runs/houses/{house}/source-pages/{doc_id}/{filename}
```

Same security model: validate `{house}`, `{doc_id}`
(`^srcdoc-[a-f0-9]{12}$`), and `{filename}` (`[\w\-.]+\.png$`).
Return `FileResponse(path, media_type="image/png")`. Return 404 if
the file is absent.

The v2 commit context carries the rendered path inside each
`sourceEvidence[].renderedPath`; the front-end can resolve it
client-side to `<docId, filename>` and call this endpoint.

## Ask 2 — render the doc → fact → element trail

Every v2 `bim_model_commits` row carries
`context.testhouse_iter.{consumedFactIds, sourceEvidence,
producedElementIds}`. The testhouse tracker writes the shape (see
`spec/trackers/testhouse-clean-rebuild-tracker.md` "Commit-attribution
contract — v2").

The `/agents` per-house dashboard currently renders the iter cards
without showing this. Proposed inline rendering on each iter card:

- **Consumed facts**: a chip list of `factId`s; click → opens a side
  panel that loads the IR via the dashboard's `extractedFacts` and
  shows the kind/status/value for each chip.
- **Source evidence**: a thumbnail strip — one thumbnail per
  `sourceEvidence[]` row, fed by Ask 1's endpoint. Click → fullsize
  modal.
- **Produced element ids**: a chip list of `elementId`s; click →
  opens the live Workspace viewer at this commit's `?at=<commitId>`
  with the element selected.

All three are additive; the dashboard renders them only when the
arrays are present and non-empty.

## Ask 3 — inline the grader's `subagent-report.md`

The grader writes a markdown report per per-floor `<floor>-visual-gate`
phase to:

```
tmp/reverse-bim/iter-<N>-scoring/<house>-subagent-report.md
```

The endpoint already exists
(`GET /agent-runs/houses/{house}/iterations/{iter}/scoring`,
`agent_runs.py:349`). What's missing is the UI surfacing it on the
per-iter card.

Proposed: when `scoringReportPresent` is true for an iter card, fetch
the markdown and render it inline (collapsed by default; expand on
click). The grade number — currently embedded in the markdown —
should also be available as a structured field. The testhouse driver
already writes a JSON sidecar at
`tmp/reverse-bim/iter-<N>-scoring/<house>-subagent-grade.json` with
`{score10: int, doneCriteriaMet: bool, ...}`; if `agent_runs.py`
reads that sidecar and surfaces `gradeScore10` + `gradeMet` next to
`scoringReportPresent`, the dashboard card can render the bar
("8/10 — gate not met") prominently without parsing the markdown.

## Non-asks (the testhouse agent owns these)

- The `extractedFacts[]` schema in IR v2 — already specified in the
  tracker; the testhouse driver lands it.
- The three new commit-context arrays — already specified; the
  testhouse driver lands them in `hybrid_reverse_bim_execute.py`
  (file is testhouse-owned per the original constraints).
- Writing captures + scoring reports to both
  `tmp/reverse-bim/iter-<N>-captures/` (legacy, dashboard-readable)
  and `tmp/reverse-bim/house-<X>/iter-<N>/captures/` (new,
  iter-picker-readable). The driver handles the dual-write.

## Acceptance

The coordination is done when:

- A fresh testhouse v2 run produces a per-house dashboard card on
  `/agents/<house>` that shows, for each iter:
  - thumbnail strip of the source pages the slice consumed,
  - chip list of the consumed fact ids (click → side panel),
  - chip list of the produced element ids (click → live viewer
    at that commit),
  - inline grade bar from the JSON sidecar,
  - inline collapsed grade-report markdown (click to expand).
- Each source-page thumbnail opens its full PNG via the new endpoint
  from Ask 1.

## Out of scope

- Schema migrations on `bim_model_commits.context` — the three new
  arrays are additive within the existing JSONB; no migration needed.
- Changing how the iter-picker resolves "iter N of house X" → commit
  id — it still keys off `{house, iter, phase}`.
- Backfilling the v1 commits' `consumedFactIds` etc. — the single v1
  commit (`01KSA86DE7T4FMP0A61EZ40P0N`) stays in the log as a
  historical row; the dashboard simply renders empty trail arrays
  for it.
