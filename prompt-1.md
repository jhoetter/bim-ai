# Prompt 1 - Plan Template Tag Matrix And View Override Closure V1

## Mission

You are implementing wave 2 of the remaining 4 closeout waves for scoped Revit Production Parity v1.

Close the deterministic plan template/tag matrix gaps for plan views without expanding the product into a full Revit annotation engine. The current tracker reports plan views at roughly 60-62%, with category graphics, annotation hints, and view template inheritance partially present. Your job is to make the remaining template, override, tag, annotation, project browser, and advisor behavior explicit, inspectable, and covered by focused backend and web tests.

The end state should let users and tests answer, for each relevant plan category/readout:

- Which effective source won: plan override, template default, or system fallback.
- Which tag or annotation style is active per category.
- Which tag styles are missing, inconsistent, or falling back.
- How plan views appear in the project browser hierarchy.
- Which advisor/validation messages explain incomplete or inconsistent plan template/tag setup.

## Target Workpackages

- WP-C01 First-class plan views
- WP-C02 Plan projection engine
- WP-C03 Plan symbology and graphics
- WP-C05 Project browser hierarchy
- WP-V01 Validation/advisor expansion

## Scope

Implement deterministic plan template/tag matrix closure evidence across backend data flow, validation, and web readouts.

Required backend behavior:

- Extend the plan view/template resolution path so plan category graphics, tag styles, and annotation hints consistently report their effective source as one of: plan override, template default, or system fallback.
- Preserve and test template inheritance semantics already present in the codebase. Do not replace the existing plan/template model with a new abstraction unless the current model truly cannot represent the matrix.
- Ensure plan projection/update behavior keeps per-category tag and annotation metadata stable when element properties, constraints, or plan view settings change.
- Add validation/advisor coverage for missing tag styles, inconsistent tag styles, fallback tag styles, and mismatches between plan overrides and template defaults.
- Make advisor output deterministic and actionable. Messages should identify the affected plan view/template/category and the effective source that produced the rendered/readout behavior.
- Add or update backend tests focused around plan projection, `updateElementProperty`, constraints, and validation/advisor output.

Required web behavior:

- Add plan/workspace readouts that expose the effective source for category graphics, tag styles, and annotation hints.
- Add a per-category tag/annotation readout for plan views. It should be clear when a category is using a plan override, inheriting a template default, or falling back to the system default.
- Surface missing or inconsistent tag style advisories in the existing validation/advisor UI patterns.
- Add or refine a project browser summary for plan views so the hierarchy reflects plan/template state clearly enough for v1 review.
- Add focused web tests around plan/workspace readouts, project browser summary behavior, and advisor display.

Keep the work bounded:

- Close the matrix and evidence/readout gaps for v1.
- Prefer existing backend schemas, projection helpers, validation/advisor infrastructure, workspace state, and UI components.
- Add small helper functions only where they reduce duplicated effective-source logic.
- Keep fixtures small and explicit so tests document the template/tag matrix.

## Non-goals

- Do not build a full Revit annotation engine.
- Do not support arbitrary Revit tag families.
- Do not redesign the plan canvas or replace the current rendering surface.
- Do not add broad new view types beyond first-class plan view closure for the listed workpackages.
- Do not introduce large schema migrations or compatibility layers unless existing persisted v1 data requires them.
- Do not perform unrelated refactors, formatting sweeps, dependency upgrades, or UI restyling.

## Validation

Run focused validation before committing.

Backend:

```bash
ruff check agent
pytest agent/tests -k "plan_projection or updateElementProperty or constraints or advisor or validation"
```

Web:

```bash
pnpm typecheck
pnpm vitest --run --filter plan --filter workspace
```

If repository scripts differ from these exact commands, use the nearest existing package scripts while keeping the same validation intent: backend ruff, focused backend pytest around plan projection/updateElementProperty/constraints/advisors, web typecheck, and focused vitest for plan/workspace readouts.

Record any commands that could not be run, failed for pre-existing reasons, or required a narrower local equivalent.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-1-plan-template-tag-matrix-closure`.
- Commit your changes and push the branch.
- Do not open a pull request.
