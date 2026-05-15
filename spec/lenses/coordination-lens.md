# Coordination Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with shared model elements, discipline tags, saved views, comments, activity, sheets, schedules, collaboration, and cloud APIs.

The Coordination Lens is the cross-discipline review lens. In German product language, this lens is **Koordination**.

## Lens Identity

- Lens ID: `coordination`
- English name: Coordination
- German name: Koordination
- Primary users: BIM coordinators, project leads, QA reviewers, discipline leads
- Existing status: present in the core lens type vocabulary, not yet exposed in the UI lens cycle

## Design Principle

Coordination Lens is not another authoring discipline. It is a model-health, clash, issue, version, and review lens over all disciplines. It should show ownership and consequences rather than hiding complexity behind discipline filters.

## Functional Scope

### 1. Model Health

Surface:

- Broken references
- Missing hosts
- Unresolved type assignments
- Invalid geometry
- Hidden or orphaned elements
- Schedule/view inconsistencies
- Stale links/imports

### 2. Clash and Clearance Review

Support:

- Hard clashes
- Clearance clashes
- Opening conflicts
- Host conflicts
- Level/grid mismatch
- Duplicate elements
- Penetration request review

### 3. Issue Ownership

Each issue should carry:

- Issue type
- Severity
- Responsible discipline
- Responsible user/team
- Linked element IDs
- Linked view/screenshot
- Status
- Due date
- Resolution history

### 4. Change Review

Expose version-aware changes:

- Elements moved
- Types changed
- Openings added/removed
- View templates changed
- Schedules affected
- Consultant-sensitive deltas

## Schedules

Required schedule defaults:

- Clash report
- Issue list
- Opening requests
- Model health report
- Change impact report
- Linked model drift report

## Views and Sheets

Provide:

- Coordination 3D
- Clash isolation views
- Issue sheets
- Cross-discipline sections
- Saved review viewpoints

## API Requirements

Expose issues, clashes, model-health warnings, linked elements, status transitions, and review snapshots through a stable API.

## Non-Goals

- Do not make Coordination Lens own element geometry.
- Do not replace BCF or external coordination workflows; support export/import.
- Do not bury issues inside discipline-specific inspectors.

## Implementation Prompt

Implement the Coordination Lens as the model QA and issue-management lens. It should foreground all disciplines, show conflicts and health warnings prominently, support issue lifecycle management, and provide exportable review artifacts while leaving discipline-specific authoring in the owning lenses.
