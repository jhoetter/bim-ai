# BIM AI UX Revamp Methodology Prompt

Use this prompt when starting any AI agent on the BIM AI UX revamp.

You are working on the BIM AI workspace UX revamp. Your job is not to make cosmetic changes or move isolated buttons. Your job is to implement the revamp according to the documented ownership model, prove that the old bad patterns are gone, and only mark work as complete when it is genuinely complete.

## Required Context

Before editing code, read these documents in this order:

1. [`spec/ux-bim-ai-rework-master.md`](./ux-bim-ai-rework-master.md)
2. [`spec/ux-bim-ai-rework-spec.md`](./ux-bim-ai-rework-spec.md)
3. [`spec/ux-bim-ai-rework-tracker.md`](./ux-bim-ai-rework-tracker.md)
4. [`spec/ux-bim-ai-rework-dynamic-audit.md`](./ux-bim-ai-rework-dynamic-audit.md)
5. Original source artifact: `spec/UX bim-ai rework.pdf`

Treat the master index as the map, the spec as the source of design rules, the tracker as the implementation backlog, and the dynamic audit as the live-state reality check.

## Core Principle

Every visible control must have exactly one conceptual owner:

| Region                 | Owns                                                                                            | Must not own                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Primary left sidebar   | Project selector, project search, view navigation, user menu                                    | Type editors, family libraries, level editors, graphics controls, tool commands          |
| Header                 | Open view tabs, tab lifecycle, sidebar reveal, share, presence, Cmd+K                           | Draw tools, measure, dimensions, project resource management, duplicated mode navigation |
| Secondary left sidebar | Active view-wide state                                                                          | Selected-element properties, project navigation, global advisor status                   |
| Ribbon                 | Active view-type editing commands                                                               | Project navigation, tab management, global status                                        |
| Canvas                 | Drawing/viewing surface, spatial handles, transient direct-manipulation feedback                | Persistent toolbars, persistent settings docks, global status                            |
| Element sidebar        | Selected-element properties and selected-element actions                                        | View-wide graphics, sun, layers, advisor, project resources                              |
| Footer                 | Global status, advisor count, sync/save, jobs, conflicts, activity, coordinates/current command | View-specific editing tools, navigation hierarchy, selected-element property editors     |

If a feature does not fit one of these owners cleanly, stop and classify its scope before moving it.

## Working Method

For every task:

1. Identify the relevant tracker rows.
2. Identify the relevant region contract in the spec.
3. Identify the affected source files from the source register.
4. Inspect the current UI state in the running app if the change affects visible behavior.
5. Make the smallest coherent implementation slice that fully satisfies the task.
6. Update command capability metadata when a command moves surfaces.
7. Add or update tests that would fail if the old bad pattern came back.
8. Capture screenshots for any layout, responsive, canvas, sidebar, ribbon, header, or footer change.
9. Run the relevant checks.
10. Report exactly what is done, what is verified, and what remains.

Do not skip steps because the task looks obvious. The current UI became inconsistent because useful features accumulated in the wrong places.

## Definition Of Done

A task is done only when all of these are true:

- The documented target behavior is implemented, not merely approximated.
- The old incorrect placement is removed or disabled.
- No duplicate old/new surface remains unless explicitly documented as transitional.
- The relevant command registry/capability metadata points to the new canonical surface.
- The UI works in the running seeded app.
- Tests or screenshot checks cover the behavior.
- The implementation does not break adjacent view types.
- The final response names verification performed and any residual risk.

If any of these are missing, the task is not done. Say it is partial and state exactly what remains.

## Non-Negotiable Rules

- Do not mark a task successful because the code compiles.
- Do not mark a task successful because one screenshot looks good.
- Do not leave a control in both old and new locations unless the tracker explicitly calls for a transition.
- Do not hide a feature without preserving reachability through the correct region or Cmd+K.
- Do not put view-wide settings into the element sidebar.
- Do not put selected-element properties into the secondary sidebar.
- Do not put draw/measure/annotate commands in the header.
- Do not put type/family/level editors in the primary sidebar.
- Do not put persistent tool palettes on the canvas.
- Do not treat the right rail as a general-purpose drawer.
- Do not start with visual polish while ownership is still wrong.

## Required Local Setup For UI Work

Use the seeded app for normal-state validation:

```bash
make seed name=target-house-3
make dev name=target-house-3
```

Expected local URLs:

```text
Web: http://127.0.0.1:2000/
API: http://127.0.0.1:8500/
```

If the app shows `500 Internal Server Error` empty states, do not treat that as the primary UX baseline. That is degraded-state coverage. Fix the setup or seed first, then validate the normal seeded state.

Known dynamic audit screenshots live in:

```text
tmp/ux-rework-dynamic-audit-seeded/
```

These screenshots are evidence, not a replacement for fresh validation after implementation.

## Implementation Sequence

Use this sequence unless the user explicitly assigns a narrower task:

1. Shell architecture and ownership tests.
2. Primary sidebar navigation-only rebuild.
3. Header tab-first cleanup.
4. Secondary sidebar destination components.
5. Element sidebar conditional selected-element behavior.
6. Ribbon schema by active view type.
7. Canvas overlay cleanup.
8. Footer advisor/status consolidation.
9. Command registry/capability metadata rewrite.
10. Dialog/resource trigger cleanup.
11. Responsive and screenshot regression pass.

Do not implement lower-priority slices before their destination region exists.

## First Agent Kickoff

A good first implementation agent task is:

> Implement `UX-WP-01`: create the canonical seven-region workspace shell foundation. Build the resizable primary sidebar region, persistent secondary sidebar region, tab-first header region, ribbon/options region, canvas region, conditional element-sidebar region, and footer region. Do not migrate all features yet. Add ownership tests proving that the shell can represent the target layout, that the primary sidebar can collapse to hidden and be restored from the header, and that the element sidebar can be absent with no selection. Update docs only if implementation reveals a mismatch.

The first agent should not start by moving individual commands. The first agent should create the structure that makes correct placement possible.

## Verification Expectations

At minimum, for UI/layout work:

```bash
pnpm exec prettier --check <changed files>
pnpm --filter @bim-ai/web test -- <relevant tests>
```

For visible revamp work, also run the app and capture screenshots for the relevant states:

- no selection
- selected element
- active command
- collapsed primary sidebar
- active view type affected by the task
- narrow/responsive state if layout changes

If a full test suite is too expensive for the current slice, run focused tests and clearly state what was not run.

## Reporting Format

Final response for an implementation task must include:

- What changed.
- Which tracker rows were addressed.
- Which files changed.
- What validation was run.
- Which screenshots or dynamic states were checked.
- Any remaining gaps.

Do not end with vague claims like "should work" or "mostly done." Use precise status:

- `Done`: all definition-of-done criteria met.
- `Partial`: implementation started but one or more criteria remain.
- `Blocked`: cannot proceed without missing input, failing setup, or a product decision.

## Product Judgment

When unsure where something belongs, decide by scope:

- Project navigation goes to the primary sidebar.
- Open working set and collaboration go to the header.
- View-wide state goes to the secondary sidebar.
- Editing commands go to the ribbon.
- Spatial/transient manipulation stays on the canvas.
- Selected-element details go to the element sidebar.
- Global health/status goes to the footer.
- Cmd+K is the fallback bridge, not an excuse to hide broken placement.

If a UI element affects the whole canvas, it is not an element property. If it affects only a selected element, it is not a view setting. If it opens a named view, it is navigation. If it edits the model, it is not header chrome.
