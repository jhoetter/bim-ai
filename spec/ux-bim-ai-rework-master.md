# BIM AI UX Rework Master Index

Last updated: 2026-05-12

Source artifact: `spec/UX bim-ai rework.pdf`

This is the navigation and coverage document for the BIM AI workspace UX revamp. It does not replace the specification or tracker. Its job is to make the revamp handoff easier to follow, easier to audit, and harder for an implementation agent to partially execute.

## Document Set

| Document                                                                   | Purpose                                                                                                        | When to use it                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`ux-bim-ai-rework-spec.md`](./ux-bim-ai-rework-spec.md)                   | Target design principles, layout ownership rules, good/bad patterns, placement matrix, implementation sequence | Read first to understand why controls move             |
| [`ux-bim-ai-rework-tracker.md`](./ux-bim-ai-rework-tracker.md)             | Detailed current-state inventory, migration backlog, source register, view/mode/command/test coverage          | Use as the implementation queue and audit checklist    |
| [`ux-bim-ai-rework-dynamic-audit.md`](./ux-bim-ai-rework-dynamic-audit.md) | Live seeded UI audit, screenshots, command registry findings, remaining dynamic gaps                           | Use to verify that the tracker matches real app states |
| [`methodology-prompt.md`](./methodology-prompt.md)                         | Reusable AI-agent kickoff prompt, working method, definition of done, verification expectations                | Give this to implementation agents before code edits   |
| `UX bim-ai rework.pdf`                                                     | Original user-authored design direction and critique screenshots                                               | Use as the visual source of intent                     |

## Recommended Reading Order

1. Read the PDF once for intent and visual examples.
2. Read the spec executive summary and design principles.
3. Read the layout region specifications in the spec.
4. Read the tracker acceptance checklist.
5. Read the dynamic audit findings and screenshot inventory.
6. Work through the tracker by region and view type.
7. Before implementation is considered complete, satisfy the Definition Of Full Coverage in the tracker.

## Current Table Of Contents

### Specification

| Section                            | Link                                                                    | Why it matters                                  |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| Executive Summary                  | [`spec`](./ux-bim-ai-rework-spec.md#executive-summary)                  | Defines the seven-region target model           |
| Current Findings                   | [`spec`](./ux-bim-ai-rework-spec.md#current-findings)                   | Captures the existing UI placement failures     |
| Design Principles                  | [`spec`](./ux-bim-ai-rework-spec.md#design-principles)                  | Explains the rules behind the revamp            |
| Primary Left Sidebar               | [`spec`](./ux-bim-ai-rework-spec.md#primary-left-sidebar)               | Navigation-only contract                        |
| Header                             | [`spec`](./ux-bim-ai-rework-spec.md#header)                             | Tab-first contract                              |
| Secondary Left Sidebar             | [`spec`](./ux-bim-ai-rework-spec.md#secondary-left-sidebar)             | View-wide state contract                        |
| Ribbon                             | [`spec`](./ux-bim-ai-rework-spec.md#ribbon)                             | View-specific editing command contract          |
| Canvas                             | [`spec`](./ux-bim-ai-rework-spec.md#canvas)                             | Spatial/transient-only chrome contract          |
| Element Sidebar                    | [`spec`](./ux-bim-ai-rework-spec.md#element-sidebar)                    | Selected-element-only contract                  |
| Footer                             | [`spec`](./ux-bim-ai-rework-spec.md#footer)                             | Global status/advisor contract                  |
| Canonical Feature Placement Matrix | [`spec`](./ux-bim-ai-rework-spec.md#canonical-feature-placement-matrix) | Quick answer for "where should this go?"        |
| Usability Measurement Method       | [`spec`](./ux-bim-ai-rework-spec.md#usability-measurement-method)       | Defines how to score reachability and ownership |
| Implementation Sequence            | [`spec`](./ux-bim-ai-rework-spec.md#implementation-sequence)            | Safe ordering for the revamp                    |
| Regression Requirements            | [`spec`](./ux-bim-ai-rework-spec.md#regression-requirements)            | Guardrails for tests and screenshots            |

### Tracker

| Section                                         | Link                                                                                       | Why it matters                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Route And Page Inventory                        | [`tracker`](./ux-bim-ai-rework-tracker.md#route-and-page-inventory)                        | Establishes which routes are in scope           |
| Layout Backlog                                  | [`tracker`](./ux-bim-ai-rework-tracker.md#layout-backlog)                                  | Top-level region migration rows                 |
| Header And Tabs                                 | [`tracker`](./ux-bim-ai-rework-tracker.md#header-and-tabs)                                 | Header cleanup rows                             |
| Secondary Left Sidebar Target Inventory         | [`tracker`](./ux-bim-ai-rework-tracker.md#secondary-left-sidebar-target-inventory)         | First-pass view-wide control inventory          |
| Ribbon Backlog                                  | [`tracker`](./ux-bim-ai-rework-tracker.md#ribbon-backlog)                                  | First-pass editing command inventory            |
| Canvas Overlay Backlog                          | [`tracker`](./ux-bim-ai-rework-tracker.md#canvas-overlay-backlog)                          | First-pass canvas chrome inventory              |
| Element Sidebar Backlog                         | [`tracker`](./ux-bim-ai-rework-tracker.md#element-sidebar-backlog)                         | First-pass selection/property inventory         |
| Footer Backlog                                  | [`tracker`](./ux-bim-ai-rework-tracker.md#footer-backlog)                                  | First-pass global status inventory              |
| View-Type Ribbon Matrix                         | [`tracker`](./ux-bim-ai-rework-tracker.md#view-type-ribbon-matrix)                         | View-specific command grouping                  |
| Implementation Workpackages                     | [`tracker`](./ux-bim-ai-rework-tracker.md#implementation-workpackages)                     | Major implementation chunks                     |
| Acceptance Checklist                            | [`tracker`](./ux-bim-ai-rework-tracker.md#acceptance-checklist)                            | Release-blocking behavioral checks              |
| Expanded Audit Coverage Map                     | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-audit-coverage-map)                     | What was inspected and residual risk            |
| Expanded Primary Sidebar Tracker                | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-primary-sidebar-tracker)                | Detailed primary sidebar rows                   |
| Expanded Header And Tab Tracker                 | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-header-and-tab-tracker)                 | Detailed header rows                            |
| Expanded Secondary Sidebar Tracker              | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-secondary-sidebar-tracker)              | Detailed secondary sidebar rows by view type    |
| Expanded Ribbon Command Tracker                 | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-ribbon-command-tracker)                 | Detailed command/ribbon rows                    |
| Expanded Canvas Overlay Tracker                 | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-canvas-overlay-tracker)                 | Detailed canvas overlay rows                    |
| Expanded Element Sidebar Tracker                | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-element-sidebar-tracker)                | Detailed selected-element rows                  |
| Expanded Footer And Global Status Tracker       | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-footer-and-global-status-tracker)       | Detailed footer rows                            |
| Expanded Dialog And Modal Tracker               | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-dialog-and-modal-tracker)               | Dialog trigger ownership                        |
| Expanded View-Mode Surface Tracker              | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-view-mode-surface-tracker)              | Plan/3D/sheet/schedule/concept/agent split      |
| Expanded Command Reachability Tracker           | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-command-reachability-tracker)           | Cmd+K and direct access requirements            |
| Expanded Testing And Acceptance Backlog         | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-testing-and-acceptance-backlog)         | Required automated and screenshot checks        |
| Expanded Implementation Sequencing Detail       | [`tracker`](./ux-bim-ai-rework-tracker.md#expanded-implementation-sequencing-detail)       | Detailed order of operations                    |
| Usability Score Inputs For Future Agent         | [`tracker`](./ux-bim-ai-rework-tracker.md#usability-score-inputs-for-future-agent)         | Metrics for judging the result                  |
| Second-Pass Deep Audit Addendum                 | [`tracker`](./ux-bim-ai-rework-tracker.md#second-pass-deep-audit-addendum)                 | Additional source-level coverage                |
| Source File Surface Register                    | [`tracker`](./ux-bim-ai-rework-tracker.md#source-file-surface-register)                    | File-by-file UI surface map                     |
| Current Footer Detailed Tracker                 | [`tracker`](./ux-bim-ai-rework-tracker.md#current-footer-detailed-tracker)                 | Footer-specific controls                        |
| Tool And Active Command Tracker                 | [`tracker`](./ux-bim-ai-rework-tracker.md#tool-and-active-command-tracker)                 | Tool palette, options, modifiers, sketch states |
| Project Resource And Browser Deep Tracker       | [`tracker`](./ux-bim-ai-rework-tracker.md#project-resource-and-browser-deep-tracker)       | Project browser and resources split             |
| Plan And Sketch Deep Tracker                    | [`tracker`](./ux-bim-ai-rework-tracker.md#plan-and-sketch-deep-tracker)                    | Plan/sketch transient and persistent UI         |
| Three-D View Deep Tracker                       | [`tracker`](./ux-bim-ai-rework-tracker.md#three-d-view-deep-tracker)                       | 3D viewport controls and exceptions             |
| Sheet And Review Deep Tracker                   | [`tracker`](./ux-bim-ai-rework-tracker.md#sheet-and-review-deep-tracker)                   | Sheet/review mode split                         |
| Schedule Deep Tracker                           | [`tracker`](./ux-bim-ai-rework-tracker.md#schedule-deep-tracker)                           | Schedule table and definition split             |
| Collaboration Jobs Advisor Coordination Tracker | [`tracker`](./ux-bim-ai-rework-tracker.md#collaboration-jobs-advisor-coordination-tracker) | Global collaboration and advisor workflows      |
| Family Material And Standalone Editor Tracker   | [`tracker`](./ux-bim-ai-rework-tracker.md#family-material-and-standalone-editor-tracker)   | Family library/editor/material flows            |
| Inspector And Property Taxonomy Tracker         | [`tracker`](./ux-bim-ai-rework-tracker.md#inspector-and-property-taxonomy-tracker)         | Property ownership split                        |
| Full-Coverage Risk Register                     | [`tracker`](./ux-bim-ai-rework-tracker.md#full-coverage-risk-register)                     | Risks that can make the revamp incomplete       |
| Definition Of Full Coverage                     | [`tracker`](./ux-bim-ai-rework-tracker.md#definition-of-full-coverage)                     | Completion gate                                 |

### Dynamic Audit

| Section                           | Link                                                                                      | Why it matters                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Audit Setup                       | [`dynamic audit`](./ux-bim-ai-rework-dynamic-audit.md#audit-setup)                        | Documents the required seeded environment                             |
| Captured States                   | [`dynamic audit`](./ux-bim-ai-rework-dynamic-audit.md#captured-states)                    | Lists the generated screenshots and covered modes                     |
| High-Confidence Live Findings     | [`dynamic audit`](./ux-bim-ai-rework-dynamic-audit.md#high-confidence-live-findings)      | Confirms the biggest current UI ownership failures in the running app |
| Dynamic Coverage Follow-Ups       | [`dynamic audit`](./ux-bim-ai-rework-dynamic-audit.md#dynamic-coverage-follow-ups-closed) | Records formerly open dynamic gaps and their closure evidence         |
| Command Registry Findings         | [`dynamic audit`](./ux-bim-ai-rework-dynamic-audit.md#command-registry-findings)          | Shows how old surface ownership is encoded in command metadata        |
| Implementation Readiness Judgment | [`dynamic audit`](./ux-bim-ai-rework-dynamic-audit.md#implementation-readiness-judgment)  | Defines what kind of implementation can safely start                  |

## Recommended Future Split

The current two-document structure is acceptable for analysis, but the implementation handoff would benefit from a folder-based split once the team starts executing. Recommended structure:

```text
spec/ux-bim-ai-rework/
  00-master-index.md
  01-target-architecture.md
  02-region-contracts.md
  03-current-ui-inventory.md
  04-dynamic-audit.md
  05-view-type-specs.md
  06-command-reachability.md
  07-dialog-resource-flows.md
  08-implementation-backlog.md
  09-testing-acceptance.md
  10-risk-register.md
```

Suggested split rules:

| Future document                | Move content from                                                                   | Reason                                   |
| ------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| `00-master-index.md`           | This file                                                                           | Single entry point and table of contents |
| `01-target-architecture.md`    | Spec executive summary, design principles, ownership graph                          | Stable "why" document                    |
| `02-region-contracts.md`       | Spec layout region specifications and feature placement matrix                      | Stable "where does it belong?" document  |
| `03-current-ui-inventory.md`   | Tracker source register and current-state sections                                  | Current implementation map               |
| `04-dynamic-audit.md`          | Dynamic audit findings and screenshot/state coverage                                | Live UI reality check                    |
| `05-view-type-specs.md`        | View-type ribbon matrix, secondary sidebar tracker, plan/3D/sheet/schedule sections | Per-view behavior                        |
| `06-command-reachability.md`   | Command reachability, tool/active command tracker, Cmd+K guidance                   | Power-user and command registry contract |
| `07-dialog-resource-flows.md`  | Dialog/modal tracker, project resources, family/material flows                      | Modal and resource trigger ownership     |
| `08-implementation-backlog.md` | Layout backlog, expanded region trackers, implementation sequencing                 | Work queue                               |
| `09-testing-acceptance.md`     | Acceptance checklist, testing backlog, usability score inputs                       | Completion criteria                      |
| `10-risk-register.md`          | Full-coverage risk register and remaining risks                                     | Known traps and mitigations              |

## Why Split Later, Not Immediately

Splitting now would improve navigation, but it also increases maintenance overhead while the spec is still changing. The pragmatic sequence is:

1. Keep the current spec and tracker as the canonical source during analysis.
2. Use this master index for navigation and coverage.
3. Split into the folder structure when implementation begins or when tracker edits become too noisy.
4. After splitting, keep each subdocument narrow and make the master index the only document with the full table of contents.

## Coverage Gates

The revamp should not be considered ready for implementation handoff unless the master index, spec, and tracker together answer these questions:

| Gate                | Question                                                                                                  | Required evidence                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Route coverage      | Which routes are affected and which are intentionally separate?                                           | Route inventory and standalone route decisions                 |
| Region coverage     | Does every persistent UI element have exactly one owner?                                                  | Region contracts and tracker status rows                       |
| View coverage       | Does every view type define primary nav, header tabs, secondary, ribbon, canvas, element sidebar, footer? | View-mode and view-type tables                                 |
| Source coverage     | Are all relevant components and panels named?                                                             | Source file surface register                                   |
| Command coverage    | Can every command be found directly or through Cmd+K?                                                     | Command reachability tracker and future command registry audit |
| Dialog coverage     | Does every dialog have a canonical trigger?                                                               | Dialog and resource flow tracker                               |
| State coverage      | Are no-selection, selected-element, active-command, context-menu, dialog, and collapsed states tested?    | Testing backlog and Playwright screenshots                     |
| Regression coverage | Can old bad patterns be detected automatically?                                                           | Ownership tests and screenshot tests                           |

## Handoff Rule For Future Agents

A future implementation agent should not start by editing components. It should first choose one workpackage from the tracker, identify the affected region contract from the spec, list the source files from the source register, and define the tests or screenshots that prove the old placement pattern is gone.
