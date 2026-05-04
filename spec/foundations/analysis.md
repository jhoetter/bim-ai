# Foundations: Clean-room analysis (Figma, Revit, Navisworks)

This document summarizes **conceptual behaviors and patterns**, not proprietary implementation. All BIM AI implementation is independently designed.

## Figma — browser collaboration and UX velocity

### What enables Figma-grade browser authoring

1. **Server-authoritative document state** with low-latency transport (typically WebSockets). Clients submit operations; ordering is deterministic on the server.
2. **Optimistic local updates**: UI responds immediately while awaiting ack; reconcile on rejection or reorder.
3. **Granular operations**: property-level or node-level deltas rather than full document snapshots each frame.
4. **Ordered structures**: fractional indexing (or equivalents) maintains stable sibling order under concurrent edits.
5. **Rendering**: WebGL (and progressively WebGPU) for scalable canvas redraw; pooling and batching minimize JS bridge costs.
6. **Heavy work off main thread**: workers/Wasm for parsing, tessellation; avoid blocking gesture pipeline.
7. **Design-system tokens**: presets + runtime light/dark; consistent shell components and keyboard-first flows.

### Transferable concepts for BIM AI

- Multiplayer edits as **ops** applied to semantic document state.
- **Presence** (who is where) separate from **model truth**.
- **Comments** attached to stable object IDs and optional viewpoint/camera state.
- **Constraint/violation** UI as ambient feedback (similar to multiplayer “errors” overlays).

---

## Revit — parametric authoring and semantic source of truth

### Core conceptual model

| Concept            | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| Semantic elements  | Walls, floors, roofs, ducts, hosted families—each typed with parameters |
| Relationships      | Hosts (wall-hosted door/window), level references, joins                |
| Regeneration graph | Derived geometry and dependent parameters update after edits            |
| Families / types   | Reusable patterns with parameter templates                              |
| Sheets & schedules | Documentation views derived from semantics                              |

### Why “Revit parity” is not v1

Full parametrics, regeneration depth, drafting, multidisciplinary systems, fabrication—orders of magnitude beyond a first browser kernel.

### Transferable concepts for BIM AI V1

- **Levels** as anchors for planar layout.
- **Walls** as segments with thickness, height, level Z.
- **Doors** as hosted instances on walls with hinge side and rough width.
- **Rooms** as bounded spaces (v1: explicit polygon + level).
- **Parameters** as typed key-value on elements with validation.

---

## Navisworks — coordination, federation, clash and issues

### Core conceptual model

| Concept         | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| Federated model | Multiple sources combined in one coordination space                |
| Clash tests     | Rules or pairs of categories → intersection/clearance results      |
| Viewpoints      | Saved camera + section + visibility for reproducible review        |
| Issues          | Lifecycle (open/assigned/closed), links to viewpoints and elements |

### Why batch clashes dominate today

Heavy geometry, pairwise tests, versioning across exports, offline models—traditionally rebuilt as aggregates.

### Transferable concepts for BIM AI V1

- **Issues + viewpoints**: pin problems to semantics and reusable camera state.
- **Live bounded constraints**: small rule set continuously evaluated—not full Navisworks matrix.
- **Isolate / hide**: coordination-style focus on offending elements.

---

## Conclusion for V1

Combine **Revit semantics (subset)** + **Navisworks issue/viewpoint rituals** + **Figma realtime/presence/comments + tokenized shell**. IFC/RVT interoperability is roadmap, not blocker.
