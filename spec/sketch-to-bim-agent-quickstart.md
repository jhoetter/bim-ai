# Sketch-to-BIM External-Agent Quickstart

This is the short path for an external coding agent. Use the CLI as the
canonical transport until MCP/API routes are executable for the same operation.

## 1. Read The Active Inputs

Read:

- `spec/sketch-to-bim-methodology.md`
- `spec/sketch-to-bim-readiness-tracker.md`
- `spec/sketch-to-bim-product-surfaces.md`
- the project-specific source images, brief, IR, capability map, phase plan, and
  checklist.

For target-house-1, start at
`spec/target-house/target-house-1-no-seed-readiness-packet.md`.

## 2. Doctor And Capability Preflight

```bash
python3 claude-skills/sketch-to-bim/sketch_bim.py doctor
python3 claude-skills/sketch-to-bim/sketch_bim.py tools
node packages/cli/cli.mjs sketch ir validate \
  --ir spec/target-house/target-house-1-sketch-ir.draft.json \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --out tmp/sketch-ir-validation
```

Use `--require-live` only when the web/API loop is expected to be running. A
stopped dev server is a live-readiness issue, not a stale-doc issue.

## 3. Produce Or Update IR

The Sketch Understanding IR must name:

- source images and briefs;
- quality target and exchange goal;
- non-negotiable visual features and forbidden outcomes;
- dimensions, assumptions, and feature ids;
- rooms/spaces, required views, and BIM information requirements.

Validate it against `spec/sketch-to-bim-capability-matrix.json`. A critical
missing capability blocks authoring. A partial capability is allowed only with a
planned evidence gate and later screenshot/Advisor proof.

## 4. Compile And Apply Phases

Prefer semantic recipes or typed CLI commands. Use raw bundles only when no
semantic surface exists, and document the gap.

For a project-initiation seed, the recipe should carry real BIM starter data,
not only visible massing:

- `types.wallTypes`, `types.floorTypes`, and `types.roofTypes` with layers,
  total thickness, exterior/interior role, U-value/fire placeholders,
  classification intent, and `assignToElementIds` where the assignment is known.
- `features.facadeRhythms[]` for hosted door/window bays and mullion proxies
  instead of non-cutting facade marks.
- `assets[]` and `placedAssets[]` with `typeId`, `roomId`, `scheduleCategory`,
  and `evidenceRole` for furniture/equipment schedule markers.
- `documentation.views`, `documentation.sheets`, `documentation.schedules`, and
  `documentation.scheduleViews` for the starter sheet, room schedule, and
  door/window schedule.

Use `spec/examples/seed-dsl-modern-house.example.json` as the smoke-tested
reference for these fields.

```bash
node packages/cli/cli.mjs sketch seed compile \
  --recipe <recipe.json> \
  --out <bundle.json>

node packages/cli/cli.mjs sketch phase run \
  --model "$BIM_AI_MODEL_ID" \
  --ir <ir.json> \
  --phase <phase-id> \
  --bundle <bundle.json> \
  --base <revision> \
  --out <phase-loop-dir> \
  --dry-run

node packages/cli/cli.mjs sketch phase apply \
  --model "$BIM_AI_MODEL_ID" \
  --bundle <bundle.json> \
  --base <revision> \
  --dry-run \
  --out <phase-dry-run.json>

node packages/cli/cli.mjs sketch phase apply \
  --model "$BIM_AI_MODEL_ID" \
  --bundle <bundle.json> \
  --base <revision> \
  --commit \
  --out <phase-commit.json>
```

`sketch phase run` is the preferred one-command loop for external agents. It
applies the phase bundle through the transaction route, collects non-browser
evidence, and writes the phase acceptance packet. It defaults to dry-run;
committing requires explicit `--commit`. Never commit a phase with unresolved
dry-run blockers.

## 5. Collect Evidence

After every meaningful phase, collect warning and info evidence, not only
errors.

```bash
node packages/cli/cli.mjs initiation-run \
  --ir <ir.json> \
  --out <evidence-dir> \
  --model "$BIM_AI_MODEL_ID" \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --fail-on-warning \
  --fail-on-acceptance
```

If browser screenshots are unavailable, record that as a blocker or scoped
tolerance. Nonblank screenshots alone do not prove visual fidelity.

## 6. Accept Or Reject

```bash
node packages/cli/cli.mjs sketch phase accept \
  --ir <ir.json> \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --out <phase-acceptance-dir> \
  --fail-on-acceptance
```

Accept only when current-phase warnings are fixed, deferred with phase rationale,
tolerated with evidence and expiry, or explicitly blocked. Final acceptance also
requires current git head, current model revision, current Advisor rule digest,
required screenshots, schedules, export manifests, and a tolerance ledger.
