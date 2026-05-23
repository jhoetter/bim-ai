# Agent Run Inspector Tracker

Last updated: 2026-05-23

Status: **Wave 1 shipped; Wave 2 first slice (iteration capture viewer +
per-house dashboard) shipped; Wave 2 remaining slices (lineage trace,
commit time-slider, schema-driven registries) in progress.** Defines the
`/agents` UI surface that lets the developer inspect how an AI agent
applied the hybrid reverse-BIM methodology to a source folder: which
files were processed, what the agent and its sub-agents thought, which
artifacts were written, how those artifacts were later interpreted for
MCP tool calling, and what landed in the live model. Read-only viewer
over data and artifacts that already exist on disk; not a production
telemetry pipeline and not a methodology change.

### What landed (2026-05-23)

- **Wave 1 — parser** (`app/bim_ai/agent_run_parser.py`): streaming
  Claude Code JSONL reader; `SessionSummary` with timestamps, message
  counts, tool-call histogram, sub-agent dispatches, inferred
  house/iteration/modelId; `TimelineEvent` canonical kinds.
  House regex restricted to `{alpha,beta,gamma}` after observing
  false positives.
- **Wave 1 — API** (`app/bim_ai/routes_agent_runs.py`):
  `GET /api/agent-runs/sessions` (list with house/iteration/modelId
  filters) and `/sessions/{id}` (timeline with `?includeRaw=` +
  `?limitEvents=`).
- **Wave 1 — web** (`packages/web/src/agents/`): `/agents` index table
  + `/agents/sessions/:id` timeline page with in-page filter and
  include-raw toggle.
- **Wave 2 — house API**: `GET /agent-runs/houses`,
  `/houses/{house}/iterations`,
  `/houses/{house}/iterations/{iter}/captures/{file}` (path-traversal-
  rejecting image serve), `/houses/{house}/iterations/{iter}/scoring`
  (markdown), `/houses/{house}/dashboard` (fact-ledger stats +
  validation reports + rendered-page-groups + reader-pass count +
  iteration enumeration).
- **Wave 2 — web**: `/agents/houses/:house` dashboard with three-card
  header, iteration strip (★ marks ones with a scoring report), view
  selector (3d / 4 elevations) × variant selector (full / crop), and
  scoring-report panel below the capture.
- **Tests**: 21 unit + route tests across parser inference,
  path-traversal rejection, iteration ordering, capture MIME, fact
  stats, scoring 404 vs 200.

### Still to ship from Wave 2

- **Commit time-slider on the per-house dashboard.** Consumes
  `/api/models/{id}/commits` + `?at=:commitId` from
  [`spec/model-time-travel-tracker.md`](./model-time-travel-tracker.md)
  to render the live BIM viewer at a past commit alongside the
  iteration capture for the same iter.
- **Lineage trace** (`/agents/houses/{house}/trace/{factId}`):
  backward from a fact id through reader response → page image →
  source PDF; forward to MCP call → element → captured screenshot.
- **Artifact browser** (`/agents/houses/{house}/artifacts/...`):
  type-aware viewers for `understanding/*.json`, `mcp-handoff/*.json`,
  `validation/*.json`, `ai-reading/{assignments,responses}/...`,
  per the artifact-kind registry in
  [Adapting to Methodology Changes](#adapting-to-methodology-changes).
- **Sub-agent transcript linkage**: deep-link the sub-agent
  dispatches in the session timeline to their own JSONLs when those
  exist under `<sessionId>/`.

## Purpose

Give the developer a UI surface to see, per BIM model and over time, the full
methodology trace — not just *what tool calls happened* but the whole chain of
**source page → page classification → reader assignment → reader (sub-)agent
response → consolidated fact → MCP handoff row → MCP tool call → live model
element → readback / QA / visual evidence**.

The goal is empirical methodology refinement: judge which phases are
overcomplicated, which are too simplified, where time is actually spent, how
faithfully sub-agent reader passes flow into MCP authoring, and whether
methodology gates ([`spec/trackers/reverse-bim-actual-methodology-tracker.md`](./reverse-bim-actual-methodology-tracker.md))
fire when they should.

Today this information is spread across:

- Claude Code session JSONLs (`~/.claude/projects/...`) — reasoning + tool
  calls + sub-agent dispatches;
- the per-house artifact tree under `tmp/reverse-bim/house-<X>/` — rendered
  pages, classifications, reader prompts/responses, understanding ledger,
  MCP handoff, validation reports, evidence captures;
- postgres — the live BIM model state.

The `/agents` page joins these three together.

## Why Now

- Methodology decisions are currently driven by gut feel and per-iteration
  hand-edited trackers
  ([`testhouse-hybrid-reverse-bim-tracker.md`](./testhouse-hybrid-reverse-bim-tracker.md),
  [`testhouse-visual-fidelity-tracker.md`](./testhouse-visual-fidelity-tracker.md)).
- The raw evidence already lives on disk in well-known locations. The work is
  a viewer + a lineage index, not new instrumentation.
- Iteration cadence is high (alpha/beta/gamma × iter-1 through iter-14+). A
  proper inspector accelerates the next reset decision (compare to the
  `target-house-3` Leo reset that produced
  [`reverse-bim-actual-methodology-tracker.md`](./reverse-bim-actual-methodology-tracker.md)).

## Non-Goals

- Not a per-element BIM editor. Element-level editing stays in the existing
  model UI.
- Not a replacement for the source-revision ledger or the per-house
  `validation/` artifacts. Those remain the authoritative authoring record.
- Not a production telemetry/observability pipeline. Developer-local only.
- Not a CI or test harness.
- Not a chat replay UI for end users.

## Core Decision

Treat the inspector as having three first-class data sources of equal
importance — session JSONLs, the per-house artifact tree, and the postgres
model state — and design the viewer around the **lineage chain that connects
them**, not around any one in isolation.

Stage the build so a flat session timeline ships first (cheap, immediate
value), then artifact viewers and lineage land as a clearly scoped second
wave once the timeline reveals which links the developer actually click.

Critically: Wave 2 is **schema-driven**, not pattern-matched. Phases,
artifact kinds, and lineage edges are registry entries, not hardcoded
constants. The methodology is still evolving (target-house-3 reset, the
inside-out-per-level pivot of 2026-05-22) and an inspector pinned to
today's exact methodology would rot at the first revision. See
[Adapting to Methodology Changes](#adapting-to-methodology-changes).

## Lineage Model

Concrete chain produced by the methodology:

```text
source PDF                       (testhouses/house-<X>/*.pdf)
  └─ rendered page               (tmp/.../rendered-pages/srcdoc-<hash>/page-N.png)
     └─ page classification      (ai-reading/page-classifications/responses/...)
        └─ reader assignment     (ai-reading/assignments/reader-pass-NN/...)
           └─ reader response    (ai-reading/responses/reader-pass-NN/...; may come from a sub-agent)
              └─ source fact     (understanding/existing-building-ir.json + siblings)
                 └─ conflict disposition  (understanding/conflict-ledger.json)
                    └─ MCP handoff row    (mcp-handoff/authoring-plan.json + phase-authoring-spec.json)
                       └─ MCP tool call   (session JSONL: author.*/opening.*/...)
                          └─ live model element  (postgres)
                             └─ readback + QA   (validation/*.json)
                                └─ captured evidence  (evidence/, iter-N-captures/)
                                   └─ visual diff / scoring  (iter-N-scoring/)
```

Every modelable fact in `understanding/existing-building-ir.json` already
carries provenance fields (source doc, page, region) per
[`reverse-bim-folder-output-methodology-tracker.md`](./reverse-bim-folder-output-methodology-tracker.md).
The inspector follows those fields **backward** (to the page image and reader
response) and **forward** (through the authoring plan into the tool call that
materialized the fact). That is the killer view.

## Data Sources

### A. Claude Code session transcripts

Path: `~/.claude/projects/-home-jhoetter-repos-bim-ai/<sessionId>.jsonl`

One JSONL per session, append-only. Each line is a JSON object: assistant
reasoning, tool call (name + structured input), tool result, sub-agent
dispatch (prompt + final result). Sub-agent transcripts live in sibling
directories `<sessionId>/...` and follow the same JSONL convention
recursively.

20+ sessions currently on disk for this repo.

### B. Per-house artifact tree

Path: `tmp/reverse-bim/house-<X>/` (alpha, beta, gamma today; extensible).

Confirmed layout per house (sampled 2026-05-22):

| Path                                                       | Contents                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source/`                                                  | Source-document index / copies / symlinks back to `testhouses/house-<X>/`.                                                                                                |
| `rendered-pages/srcdoc-<hash>/`                            | Per-document rendered page PNGs.                                                                                                                                          |
| `ai-reading/page-classifications/{assignments,responses}/` | Page-by-page classification work order and reader output.                                                                                                                 |
| `ai-reading/assignments/reader-pass-NN/`                   | Reader assignment prompts (one pass per iteration).                                                                                                                       |
| `ai-reading/responses/reader-pass-NN/`                     | Reader structured JSON responses (often produced by sub-agents).                                                                                                          |
| `understanding/`                                           | Consolidated source spec: `existing-building-ir.json`, `building-scope.json`, `coordinate-frames.json`, `conflict-ledger.json`, `material-assemblies.json`, and siblings. |
| `mcp-handoff/`                                             | `authoring-plan.json`, `phase-authoring-spec.json`, `mcp-readiness.json`, `resolver-worklist.json`, `evidence-requirements.json`, `tolerance-policy.json`.                |
| `validation/`                                              | `package-acceptance-report.json`, `coordinate-frame-report.json`, `site-topology-report.json`, `source-completeness-report.json`.                                         |
| `evidence/`                                                | `source-thumbnails/`, `page-crops/`, `source-analysis.md`.                                                                                                                |
| `iter-N-captures/`, `iter-N-live-gates/`                   | Per-iteration screenshots and gate reports for this house.                                                                                                                |
| (sibling) `tmp/reverse-bim/iter-N-{captures,scoring}/`     | Cross-house per-iteration captures and scoring.                                                                                                                           |

### C. Postgres model registry

Existing `Model` records. Used to enrich each house with model id, name,
current state, and last commit. Auto-memory already records live model IDs
(alpha `2378f078-…`).

### D. Optional sidecar (Wave 2)

`tmp/reverse-bim/house-<X>/<runId>/run-meta.json` with `runId`, `sessionId`,
`modelId`, `houseName`, `outputDir`, `startedAt`. Written by
`reverse_bim.folder_output` at run start. Wave 1 falls back to inference.

## Join Strategy

Three joins, in order of strength:

1. **Strong (Wave 2):** read `run-meta.json` from the run's outputDir; binds
   session ↔ model ↔ house unambiguously.
2. **Medium (Wave 1):** scan the session JSONL for the first tool call
   carrying `outputDir` (any `reverse_bim.*_execute`) and resolve the house
   from the path; alternately the first `modelId` in any `author.*` /
   `query.*` / `opening.*` / `qa.*` call.
3. **Weak (Wave 1):** infer house from the `testhouses/house-<X>/` substring
   appearing anywhere in tool inputs. Used only as a last resort.

Sessions that never touch any of the three signals are listed in an
"Unattributed" bucket and flagged for review — typically pure source-preflight
runs that ended at `source_understanding_blocked`.

## UI Surfaces

### `/agents` — index

- One row per BIM model (alpha / beta / gamma / others), plus an
  "Unattributed" row.
- Columns: house, model id (short), current model state, last session at,
  total sessions, total tool calls, last terminal state, activity sparkline
  (last 30 days).
- Sort: most-recent activity first.

### `/agents/:houseOrModelId` — per-model methodology dashboard

The most important page. Built around the methodology, not the timeline.

- **Header:** house, model id, current state, link to source folder
  (`testhouses/house-<X>/`) and to the artifact tree
  (`tmp/reverse-bim/house-<X>/`).
- **Phase status grid:** project_setup / KG / EG / DG / vertical_circulation
  / roof / site / materials / final_acceptance. Each cell shows state
  (planned / blocked / authored / accepted), last-touched time, link to the
  slice's tool-call sequence.
- **Fact ledger stats:** total facts in `understanding/existing-building-ir.json`,
  by kind (wall / opening / level / ...), by status (accepted / blocked /
  source_unavailable / tolerated), by confidence bucket.
- **Open dispositions:** counts from `understanding/conflict-ledger.json` and
  `qa.advisor` results — advisor warnings tolerated, source-limited facts,
  consensus disagreements outstanding.
- **Reader pass summary:** passes under
  `ai-reading/{assignments,responses}/reader-pass-NN/` — pass count,
  sub-agents dispatched, average response confidence, blocked-page rate.
- **Visual evidence strip:** latest captured plan/elevation/section/3D from
  `iter-N-captures/` with source overlays.
- **Sessions list:** chronological with link to the timeline viewer.

### `/agents/:houseOrModelId/session/:sessionId` — session timeline

- Linear render of the JSONL.
- Assistant reasoning shown as quoted prose.
- Tool calls as collapsible cards: tool name, pretty-printed input, output
  (collapsed by default).
- Sub-agent dispatches: agent type, dispatch prompt, final result, link to
  the sub-agent's own JSONL.
- Slice annotations: consecutive tool calls grouped under labels derived
  from `reverse_bim.hybrid_slice_execute` boundaries.
- In-page filter by tool name or free-text search.

### `/agents/:houseOrModelId/artifacts/...` — artifact browser

A file browser scoped to the house's artifact tree, with type-aware viewers:

- **Source PDFs:** render in browser, deep-link to specific page.
- **Rendered pages:** thumbnail grid per `srcdoc-<hash>/`; click for full
  page with classification verdict and reader-response excerpt overlay.
- **Reader assignments + responses:** side-by-side panel — prompt + attached
  page image(s) on the left, returned JSON on the right; link to the
  sub-agent's transcript if recoverable.
- **Understanding ledger:** searchable, filterable table of facts from
  `existing-building-ir.json` and siblings; each row links forward (to the
  MCP handoff row + tool call) and backward (to the reader response + page
  image).
- **MCP handoff:** per-phase plan view of `authoring-plan.json` +
  `phase-authoring-spec.json` rows, each linking to the tool call that
  realized it and the fact it covers.
- **Validation reports:** rendered as gated checklists; per-gate
  pass/fail/reason.
- **Evidence + captures:** image gallery with optional source overlay.

### `/agents/:houseOrModelId/trace/:factId-or-elementId` — lineage view

The link target whenever the user clicks "where did this come from" or
"what did this produce".

- **Backward trace** from a fact or model element: MCP call → handoff row
  → fact → conflict disposition → reader response → reader assignment →
  page image → source PDF page. Each hop is collapsible and contains the
  relevant inputs/outputs.
- **Forward trace** from a source page or reader response: every fact it
  produced, every MCP call that consumed those facts, every model element
  authored, every captured screenshot the element appears in.
- **Blocked-fact trace:** show the reader response and any disposition
  reason; let the developer judge whether the methodology gate fired
  correctly or was overcautious.

## Implementation Waves

### Wave 1 — flat session viewer (cheapest; 1–3 days)

Outcome: every Claude Code session on disk is browsable; the developer can
read reasoning + tool calls + sub-agent dispatches per session, and roughly
attribute sessions to a house via path inference.

Tasks:

- `app/bim_ai/routes_agent_runs.py`: `GET /api/agent-runs/sessions`,
  `GET /api/agent-runs/sessions/:sessionId`.
- `app/bim_ai/agent_run_parser.py`: streaming JSONL parser; extracts tool
  calls, sub-agent dispatches, reasoning, and inferred house/model.
- LRU parse cache keyed by `(sessionId, file_mtime)`.
- Web routes under `packages/web/src/app/agents/...` for `/agents` index +
  session detail.
- Activity sparkline (bucketed counts per day, last 30 days).

### Wave 2 — methodology dashboard + artifact viewers + lineage (the heart; 4–7 days)

**Prerequisite:** time-travel Wave 3 (read API) must be available — see
[`spec/model-time-travel-tracker.md`](./model-time-travel-tracker.md).
The per-model dashboard's commit timeline, the per-iteration model
rendering, and per-element backward trace all depend on
`GET /api/models/:id/commits` and `GET /api/models/:id/state?at=:commit`.

Outcome: the developer can answer, for any model, "how was the methodology
applied to this house?" and for any fact or element, "where did this come
from / what did this produce?". Wave 2 reads the three registries defined in
[Adapting to Methodology Changes](#adapting-to-methodology-changes) instead
of hardcoding methodology specifics.

Tasks:

- **Phase registry**: load from `mcp-handoff/phase-authoring-spec.json` at
  read time so dashboard phases reflect whatever the current methodology
  emits (not a fixed list).
- **Artifact-kind registry**: a single declaration file mapping each
  artifact kind to its glob pattern, JSON discriminator, viewer
  component, and outgoing provenance fields. New kinds = one entry, not
  a viewer change.
- **Lineage graph definition**: nodes = artifact kinds; edges =
  provenance fields. The trace view walks this graph generically.
- API endpoints driven by the registries:
  `GET /api/agent-runs/houses/:house/dashboard`,
  `GET /api/agent-runs/houses/:house/artifacts/...`,
  `GET /api/agent-runs/houses/:house/facts/:factId/trace`.
- Per-house methodology dashboard page (phase grid, fact stats,
  dispositions, reader-pass summary, evidence strip).
- Artifact browser page with type-aware viewers (PDF, image grid, reader
  assignment/response pair, ledger table, handoff plan, validation
  report, evidence gallery) — each viewer is registered against an
  artifact kind, not hardcoded against a path.
- Lineage trace page (backward + forward) that walks the lineage graph
  generically.
- `reverse_bim.folder_output` writes `run-meta.json` to outputDir at run
  start (now including `methodologyVersion`). Parser prefers the
  sidecar; falls back to Wave-1 inference.
- Provenance index: a built-once-per-house map keyed by node id (factId,
  pageId, responseId, ...) that resolves all incoming/outgoing edges
  declared in the graph.

### Wave 3 — cross-run analytics (optional; only if Wave 1+2 surface real friction)

Tasks:

- Per-MCP-tool histograms across all runs (dominance + non-use).
- Per-slice bottleneck panel (avg wall time + tool count per slice).
- Sub-agent breakdown (reader-pass vs. authoring vs. visual-diff).
- Diff view: same model across two sessions or two iterations.
- Methodology friction report: blocked-fact rate per phase, consensus
  disagreement rate, advisor-warning tolerance rate, visual-diff score
  trend per iteration.

## Adapting to Methodology Changes

The methodology is mid-reset and still evolving (most recent example: the
2026-05-22 "inside-out per level" pivot — rooms and interior partitions
modeled first per source floor plan, exterior follows). The inspector must
absorb such shifts without a rewrite. Two design rules separate
methodology-agnostic infrastructure from methodology-shaped views.

### Methodology-agnostic (rewrite-proof)

Wave 1's session viewer never models the methodology. It reads tool calls,
reasoning, and sub-agent dispatches from whatever session JSONLs exist. Any
methodology change that still runs through Claude Code + MCP shows up
unchanged. This is the load-bearing observability tier; never let
methodology specifics leak into it.

### Schema-driven (one-edit absorbable)

Wave 2's dashboard, artifact browser, and lineage view do model the
methodology — but through three registries, not hardcoded code:

1. **Phase registry.** Phases are derived at read time from the current
   `mcp-handoff/phase-authoring-spec.json` (or the equivalent successor
   artifact), not from a fixed list in code. A future methodology that
   splits `roof` into `roof_structure` + `roof_cover`, adds an
   `interior_partitions` phase, or replaces outside-in ordering with
   inside-out-per-level ordering is reflected in the dashboard
   automatically.

2. **Artifact-kind registry.** Each kind declares:
   - a glob pattern under `tmp/reverse-bim/house-<X>/`;
   - a JSON discriminator (a top-level field that identifies the kind when
     the path is ambiguous);
   - a viewer component (table / image gallery / PDF / form / etc.);
   - the set of provenance fields it carries (which other-kind ids it
     references).

   Adding a new artifact kind (e.g. `room-layouts/`) is one registry
   entry, not a viewer change.

3. **Lineage graph.** Nodes = artifact kinds; edges = provenance fields.
   The trace view walks this graph generically. Inserting an intermediate
   hop (e.g. a consolidation pass between reader response and the
   understanding ledger) is one new edge.

### Versioning

Every run records the methodology version it executed against — either the
controlling tracker's `Last updated` date or an explicit
`methodologyVersion` field in `run-meta.json`. The dashboard surfaces the
version so cross-iteration comparisons stay honest after the methodology
shifts.

### When the rules break

Some methodology changes do require inspector code:

- a fundamentally new data source (e.g. a live agent-conversation store
  outside session JSONLs);
- a new viewer interaction (e.g. interactive 3D overlays where today we
  show flat screenshots);
- removal of a data source the inspector depends on.

For these, the tracker explicitly takes the cost of an inspector update.
Per the registry design above they should be rare; per methodology-reset
history (target-house-3 → actual-methodology tracker), not impossible.

## Required Tests

- `agent_run_parser` unit tests with small fixture JSONLs covering the
  reasoning / tool-call / sub-agent / tool-result mix and the
  house/model inference rules.
- Provenance-index tests against a fixture house tree: backward from a
  fact id should resolve to exactly one page image; forward from a page
  image should enumerate every fact derived.
- API tests for each route with a fixture session directory + fixture
  house tree.
- Snapshot test for the timeline render and the methodology dashboard.
- Memory test: parser must stream — never hold a whole JSONL or whole
  understanding ledger in memory.

## Open Questions

- **Filesystem access:** dev API runs as the user; both
  `~/.claude/projects/...` and `tmp/reverse-bim/...` are readable. Production
  hosting is out of scope. Re-evaluate before any deployment.
- **Sub-agent JSONL discovery:** confirm the on-disk layout under
  `<sessionId>/` and whether the sub-agent's full reasoning is preserved
  (a short spike). If only the dispatch and final result are present in the
  parent, deep sub-agent reasoning may require additional capture.
- **Provenance completeness:** confirm that every fact kind in
  `existing-building-ir.json` carries source-document + page + region
  fields. Missing provenance is a methodology bug surfaced by the
  inspector, not an inspector bug.
- **Iteration vs. session:** an iteration spans multiple Claude Code
  sessions (e.g. iter-12 alpha + iter-12 beta + iter-12 gamma + iter-12
  titleblock-parse). The dashboard groups by **house**; an
  iteration-centric cross-cut view is Wave 3.
- **Reasoning prose exposure:** full assistant text exposed verbatim,
  collapsed by default. Reconsider if any future session contains
  sensitive content beyond the bim-ai working set.
- **Permission gate:** leave unguarded in dev or hide behind a
  developer-mode flag? Default unguarded until there is a shared
  environment that matters.

## Definition of Done

The tracker is complete when all of these are true:

- `/agents` lists every model with last-activity timestamps and an
  activity sparkline.
- Each per-model dashboard shows phase status, fact ledger stats, open
  dispositions, reader-pass summary, and visual evidence.
- Every fact in `understanding/existing-building-ir.json` and every model
  element supports a lineage trace both backward (to the originating
  source page) and forward (to the authoring call and captured evidence).
- Every reader response — including those produced by sub-agents — is
  inspectable with its prompt, attached page image(s), and structured
  JSON output, side by side.
- The session timeline shows assistant reasoning, tool calls, and
  sub-agent dispatches with their inputs and outputs.
- The developer can answer, without leaving the page, "how was the
  methodology applied to model X?" and "where did this specific fact /
  element come from?".
- (Wave 2) Every new reverse-BIM run is unambiguously attributed via
  `run-meta.json`.

## Related Trackers

- [`spec/model-time-travel-tracker.md`](./model-time-travel-tracker.md) — git-like model versioning that powers per-iteration replay and per-element backward trace. Wave 2 of this tracker depends on it.
- [`spec/hybrid-reverse-bim-methodology-tracker.md`](./hybrid-reverse-bim-methodology-tracker.md) — the methodology this viewer observes.
- [`spec/reverse-bim-actual-methodology-tracker.md`](./reverse-bim-actual-methodology-tracker.md) — gates the methodology must enforce; the inspector helps judge whether they fire.
- [`spec/reverse-bim-folder-output-methodology-tracker.md`](./reverse-bim-folder-output-methodology-tracker.md) — folder-output contract that defines the artifact tree the inspector reads.
- [`spec/testhouse-hybrid-reverse-bim-tracker.md`](./testhouse-hybrid-reverse-bim-tracker.md) — per-house execution log the inspector complements.
- [`spec/testhouse-visual-fidelity-tracker.md`](./testhouse-visual-fidelity-tracker.md) — multi-iteration loop that benefits most from per-iteration inspection.
- [`claude-skills/hybrid-reverse-bim/SKILL.md`](../claude-skills/hybrid-reverse-bim/SKILL.md) — operational procedure agents follow; the viewer surfaces how faithfully it is applied per run.
