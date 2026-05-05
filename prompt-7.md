# Prompt 7: Schedule Registry Derived Columns And Export Parity Slice

## Mission

You are the implementation agent for a narrow Revit production-parity schedule slice. Create a dedicated branch from the current `main`, for example:

```sh
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b prompt-7-schedule-registry-derived-columns
```

Implement a bounded schedule registry, derived-column, and export parity improvement that moves BIM AI closer to PRD R4 schedule requirements: generic schedule fields, computed fields, deterministic grouping/sorting/filtering, and CSV/JSON/export evidence that agree with the server-derived schedule payload.

Do not create a pull request. When complete, commit the work and push the branch.

## Target Workpackages

Primary target workpackages:

- `WP-D01` - Server-derived schedules. Current tracker status is partial with schedule-derived quantities, filters, totals, and programme closure evidence already present. Extend the server schedule derivation in the same style.
- `WP-D02` - Schedule CSV/API/CLI export. Current tracker status is partial with JSON/CSV export, column subsets, optional totals CSV, and schedule engine metadata. Tighten export parity with the registry and derived columns.
- `WP-D03` - Schedule UI. Current tracker status is partial. Touch the web schedule panel only if the server payload changes require visible parity, sorting/filter labels, or column display updates.
- `WP-D04` - Family/type registry and propagation. Current tracker status is partial with material assembly, roof type, opening, and room schedule fields. Keep any registry work focused on schedule field metadata and type/instance propagation that schedules already consume.
- `WP-E05` - Sheet canvas and titleblock. Current tracker status is partial with schedule viewport/documentation evidence in sheet exports. Only touch this if schedule export parity needs sheet-placed schedule evidence to stay deterministic.
- `WP-X01` - Cross-cutting parity/evidence tracking. Use this only for traceability, deterministic evidence, validation notes, or tracker bookkeeping that supports this slice.

## Ownership Boundaries

Likely files:

- `app/bim_ai/schedule_field_registry.py`
- `app/bim_ai/schedule_derivation.py`
- `app/tests/test_schedule_field_registry.py`
- `app/tests/test_kernel_schedule_exports.py`
- `packages/web/src/schedules/SchedulePanel.tsx` only if needed for parity with changed payloads or user-visible schedule controls
- `spec/revit-production-parity-workpackage-tracker.md`

Work within existing schedule registry and derivation patterns. Preserve the invariant from the PRD: schedules derive from the canonical semantic model and type/instance parameters; exports serialize the same derived payload rather than inventing a second table source.

## Non-goals

- Do not perform broad schedule UI refactors.
- Do not redesign `SchedulePanel.tsx` or the surrounding schedule UX unless a minimal display/sort/filter adjustment is required by the new server payload.
- Do not introduce a general schedule builder.
- Do not implement unrelated Revit parity work such as plan symbology, room boundary computation, sheet layout editing, IFC replay, PDF rendering, or broad validation taxonomy changes.
- Do not change unrelated web, API, CLI, or schema behavior.
- Do not create a pull request.

## Implementation Checklist

- Inspect the current schedule registry and derivation code before editing. Identify existing registry columns, derived column helpers, type/instance parameter flow, totals, grouping, sorting, and CSV/JSON export behavior.
- Add or tighten derived schedule columns that are directly useful for registry/export parity. Favor columns already implied by PRD R4 and tracker state, such as level/type/family labels, host/type metadata, rough-opening or quantity fields, schedule placement fields, and deterministic total/export metadata.
- Keep registry metadata authoritative. Any derived column exposed in schedules should have a stable registry entry with the correct key, label, kind, unit/format hint, category applicability, and sort/filter/export behavior.
- Ensure schedule derivation, registry metadata, CSV export, JSON/API payloads, and tests agree on column order, labels, scalar formatting, totals, and optional column subsets.
- Preserve deterministic ordering. Sort fields, rows, totals, diagnostics, and exported metadata consistently using existing repository conventions.
- Add focused tests around any new or changed registry fields, derived values, CSV/JSON export parity, totals, column subsets, and schedule engine metadata.
- If `SchedulePanel.tsx` is touched, keep the change minimal and add or update focused schedule Vitest coverage for the affected visible behavior.

## Validation

Run focused schedule validation before committing:

```sh
cd app
.venv/bin/ruff check bim_ai tests
.venv/bin/pytest tests/test_schedule_field_registry.py tests/test_kernel_schedule_exports.py
```

If additional schedule pytest files are directly affected, include them as well.

If any web schedule files are touched, also run focused web schedule tests:

```sh
cd packages/web
pnpm exec vitest run src/schedules
```

Do not substitute broad unrelated tests for the focused schedule checks. If a required command cannot run in the local environment, document the exact command and failure in the final implementation summary and in the tracker ledger entry.

## Tracker Update Requirements

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation.

Required tracker edits:

- Update the Current Workpackages rows for `WP-D01`, `WP-D02`, `WP-D03`, `WP-D04`, `WP-E05`, and `WP-X01` when this slice materially changes their state. If a workpackage is only reviewed and not changed, leave its percentage/status unchanged but avoid stale notes that contradict the new work.
- Add a concise Recent Sprint Ledger entry for this branch. Include the branch/prompt name, the main files changed, the new registry/derived/export parity behavior, the tests run, and any remaining blockers.
- Keep the tracker honest: do not claim broad Revit schedule parity, a full schedule builder, or completed sheet/export parity if this slice only adds a bounded derived-column/export improvement.

## Commit/Push Requirements

- Work on a dedicated branch based on current `main`, for example `prompt-7-schedule-registry-derived-columns`.
- Commit the implementation and tracker update together with a concise message describing the schedule registry/export parity slice.
- Push the branch to the remote:

```sh
git push -u origin HEAD
```

- Never create a pull request.
- In the final response, report the branch name, commit SHA, pushed remote branch, validation commands and results, and any remaining limitations.
