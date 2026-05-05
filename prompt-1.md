# Prompt 1 - Saved View Templates And Crop Range Editing Closure V1

## Mission

Close the gap between stored plan view definitions and editable view templates with crop/range editing, so that plan views behave as configurable production documents rather than static projection snapshots.

## Target Workpackages

- WP-C01 (First-class plan views) — currently partial ~62%
- WP-C05 (Project browser hierarchy) — currently partial ~57%

## Scope

### Backend (`app/bim_ai/`)

1. **View template registry** — extend `plan_projection_wire.py` or add `plan_view_template_registry.py`:
   - `PlanViewTemplate` dataclass: `templateId`, `name`, `viewRangeBottomMm`, `viewRangeTopMm`, `categoryVisibility` dict, `graphicOverrides` list, `tagStyleRef`.
   - `upsertPlanViewTemplate` command that persists a template on the document.
   - `applyPlanViewTemplate` command that stamps a template onto a plan view, setting its stored properties.
   - Evidence: `planViewTemplateApplicationEvidence_v1` returning before/after property diff.

2. **Crop range editing** — extend `plan_projection_wire.py`:
   - `updatePlanViewCrop` command: accepts `cropMinMm`/`cropMaxMm` bounding box, persists on the plan view element.
   - `updatePlanViewRange` command: accepts `viewRangeBottomMm`/`viewRangeTopMm`, persists on the plan view element.
   - Both commands must re-derive `plan_projection_wire` with updated parameters and return updated primitive counts.

3. **Project browser template grouping** — extend browser hierarchy to group views by template when a template is assigned.

### Web (`packages/web/`)

4. **Plan view Inspector** — extend the plan view Inspector panel to show:
   - Current template name (or "No template").
   - Crop region bounds (editable).
   - View range bottom/top (editable).
   - "Apply template" dropdown if templates exist.

### Tests

5. `test_plan_view_template_application.py`:
   - Create template → apply to view → verify stored properties match template.
   - Update crop → verify projection wire primitive count changes.
   - Update view range → verify vertical clip changes primitive inclusion.
   - Round-trip: apply template, edit crop, re-apply template → crop reset.

## Non-goals

- Full Revit-equivalent template inheritance/override chains.
- Template propagation to multiple views in batch.
- View-specific filter overrides beyond category visibility.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_plan_view_template_application.py tests/test_plan_projection_and_evidence_slices.py tests/test_update_element_property_plan_view.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-C01, WP-C05 rows.
- Create branch `prompt-1-plan-view-template-crop-range` from `main`.
- Commit and push. Do not open a pull request.
