# BIM AI — Product Requirements Document (V1)

## Summary

Browser-first BIM coordination and conceptual layout authoring: semantic building objects (levels, walls, doors, rooms), real-time collaboration (presence + document ops), live constraint checks, coordination issues/viewpoints, and an AI assistant that proposes commands for explicit user approval—not silent model edits.

## Problem

Architects and construction teams fragment work across authoring (Revit), federation (linked models / exports), coordination (Navisworks-style clash/issue cycles), and review (PDF/email). Collaboration is latent; clashes are batch-like; BIM semantics are divorced from coordination sessions.

## V1 Goal

Deliver **multi-user editable semantic layouts in the browser** with **immediate constraint feedback**, **coordination issues**, and **AI-assisted command proposals**, aligned with sibling product conventions (Vite + Python, design tokens, Makefile dev loop).

## Personas

- **Architect / designer** — early layout, wall/door edits, visualization.
- **Coordinator / BIM lead** — issues, viewpoints, commenting, violation triage.
- **Engineer (structural/MEP-lite in v1)** — optional future; v1 architectural core only.

## In Scope (V1 MUST)

| Area          | Requirement                                                                              |
| ------------- | ---------------------------------------------------------------------------------------- |
| Data          | Project → Model → Elements (levels, walls, doors, rooms) + issues + viewpoints + ops log |
| API           | REST: projects/models/elements/commands/issues/comments; WS: ops + presence              |
| UX            | Shell: tree, inspector, plan/3D viewport, violations panel, comments, command palette    |
| Collaboration | Presence (cursor/tab), broadcast applied ops                                             |
| Constraints   | Bounded rules: overlaps, door-on-wall, room-without-door samples, duplicates             |
| AI            | Endpoint + UI: natural language → proposed `Command[]`, user confirms apply              |
| Dev           | `make install`, `make dev`, `make verify`; Postgres + Redis + MinIO via compose          |

## Out of Scope (V1 MUST NOT)

- Full IFC authoring roundtrip / RVT native parity
- All disciplines / production clash matrix
- WebGPU-only or massive model streaming
- Decentralized CRDT perfection (server-serialized ops are sufficient)

## Success Metrics (demo)

1. Seed project loads with levels, walls, doors, rooms.
2. Second browser tab receives wall move within \<1 s on LAN.
3. Violation appears immediately after rule-breaking command attempt.
4. User creates issue from violation with viewpoint refs.
5. AI panel returns deterministic demo proposals for scripted prompts.

## Risks / Mitigations

| Risk        | Mitigation                                        |
| ----------- | ------------------------------------------------- |
| Scope creep | PRD gates; IFC deferred                           |
| Performance | Bounded element counts v1; simple Three.js meshes |
| Trust in AI | Propose-only UX; structured Command preview       |
