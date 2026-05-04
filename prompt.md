# Build an AI-Native, Browser-First BIM Platform (Modeling + Coordination)

## Mission

You are a senior software architect and engineer. You will autonomously design and specify a **browser-first, AI-native BIM platform** — `bim-next` — that unifies:

- Autodesk Revit (parametric building modeling)
- Navisworks (multi-model coordination & clash detection)
- Figma (real-time collaboration & usability)

This is not a viewer, not a plugin, and not a simplified CAD tool.

It is a **new category**:

> A real-time, collaborative, constraint-based building system that runs in the browser and scales from early design to complex coordination.

---

## Core Product Principles (Non-Negotiable)

### 1. Semantic Model > Geometry

- Walls, slabs, ducts are **objects**, not meshes
- Geometry is a projection of data
- No “dumb geometry” as source of truth

---

### 2. Constraints are First-Class

- Clash detection is NOT a post-process
- It is a **live constraint system**

Example:

- “Duct must not intersect beam”
- “Door must belong to wall”

---

### 3. Real-Time Multiplayer by Default

- Multiple users edit the same model simultaneously
- No file locking
- No export/import workflows

---

### 4. Unified Modeling + Coordination

- No separation between:
  - modeling (Revit)
  - coordination (Navisworks)

They are one system.

---

### 5. Browser-First, Not Desktop-Ported

- Built for WebGL / WebGPU from scratch
- No legacy assumptions

---

### 6. AI-Native System

- AI can:
  - generate geometry
  - propose changes
  - resolve clashes
- AI operates on the same semantic model as users

---

## Clean-Room Constraint

You will:

- Analyze behavior and architecture of:
  - Revit
  - Navisworks
  - Figma

- Extract:
  - concepts
  - workflows
  - architectural patterns

You will NOT:

- copy code
- replicate internal APIs
- reuse proprietary structures

All implementation must be:

> independently designed from first principles

---

# System Vision

## What This Product Replaces

| Today      | Problem                  |
| ---------- | ------------------------ |
| Revit      | heavy, non-collaborative |
| Navisworks | batch coordination       |
| Excel      | broken data workflows    |
| PDFs       | manual feedback loops    |

---

## Target State

> A single system where:

- modeling = coordination
- collaboration = real-time
- constraints = always enforced

---

# Phase Structure (Strict)

You MUST follow:

1. **Analysis**
2. **Specification**
3. **Implementation (design-level only for now)**
4. **Validation**

Do not skip steps.

---

# Phase 0 — Foundational Analysis

## Step A: Analyze Existing Systems

### 1. Revit (Authoring Model)

Analyze:

- parametric object system
- dependency graph
- family system
- regeneration model

Questions:

- how are constraints propagated?
- where does performance break?
- what is mutable vs derived?

---

### 2. Navisworks (Coordination Model)

Analyze:

- clash detection pipeline
- model federation
- issue tracking

Questions:

- why is it batch-based?
- what prevents real-time?

---

### 3. Figma (Collaboration Model)

Analyze:

- CRDT / OT system
- multiplayer editing
- UI simplicity

Questions:

- how is state merged?
- how is latency hidden?

---

## Output

`/spec/foundations/analysis.md`

Must include:

- architectural breakdown
- strengths / weaknesses
- transferable concepts

---

# Phase 1 — Core Data Model

## Goal

Define the **semantic BIM kernel**

---

## Required Properties

### Objects (Examples)

Wall
Slab
Door
Window
Beam
Column
Duct
Pipe
Room
Level

Each must:

- have parameters
- support constraints
- generate geometry

---

## Key Decision

### Data Model is Source of Truth

NOT:

- meshes
- files

BUT:

- structured objects + relations

---

## Deliverables

### `/spec/core/data-model.md`

- object schemas
- relationships
- hierarchy

---

### `/spec/core/constraints.md`

- constraint types
- evaluation logic
- conflict resolution

---

### `/spec/core/geometry.md`

- how geometry is derived
- level of precision
- simplification rules

---

### `/spec/core/commands.md`

- create wall
- move wall
- insert door
- connect systems

---

# Phase 2 — Real-Time Engine

## Goal

Enable **multi-user editing of BIM data**

---

## Requirements

### State Synchronization

- CRDT or OT-based
- deterministic

### Conflict Handling

- concurrent edits resolve predictably

### Partial Loading

- large models streamed

---

## Deliverables

### `/spec/realtime/sync.md`

- sync protocol
- versioning
- state merging

---

### `/spec/realtime/performance.md`

- chunking strategy
- streaming model

---

# Phase 3 — Constraint Engine (Navisworks Replacement)

## Goal

Replace clash detection with **live constraints**

---

## Key Idea

> There is no “check clashes” button

Instead:

- constraints evaluate continuously

---

## Examples

- geometry intersection
- clearance rules
- system connectivity

---

## Deliverables

### `/spec/constraints/engine.md`

- evaluation cycle
- performance strategy

---

### `/spec/constraints/types.md`

- spatial
- logical
- regulatory

---

# Phase 4 — Modeling UX (Figma-Level Simplicity)

## Goal

Make BIM usable

---

## Principles

- direct manipulation
- minimal UI
- fast feedback

---

## Deliverables

### `/spec/ui/interactions.md`

- drawing walls
- snapping
- editing

---

### `/spec/ui/collaboration.md`

- cursors
- presence
- comments

---

# Phase 5 — AI Layer

## Goal

AI operates on BIM data

---

## Capabilities

- generate layouts
- optimize models
- fix clashes

---

## Deliverables

### `/spec/ai/agent.md`

- API for AI
- permission model

---

# Work Packages (Critical)

Each phase must define:

## WP1 — Data Structures

- schemas
- validation

## WP2 — Algorithms

- constraint solving
- geometry generation

## WP3 — Performance

- scaling strategy

## WP4 — UX Mapping

- how user interacts

## WP5 — Edge Cases

- conflicting constraints
- invalid geometry

---

# MVP Definition

## MUST HAVE

- walls, doors, rooms
- real-time editing
- basic constraints
- simple clash detection
- browser UI

---

## MUST NOT (yet)

- full IFC compliance
- all disciplines
- ultra-high precision

---

## MVP Positioning

> “Figma for building layouts with basic coordination”

---

# Validation Criteria

System is valid if:

### Usability

- new user creates building in <10 min

### Performance

- model updates <100ms

### Collaboration

- 3 users edit simultaneously

### Constraints

- violations detected instantly

---

# Key Risks

## 1. Constraint Complexity

- exponential interactions

## 2. Performance

- browser limits

## 3. Scope Explosion

- BIM is huge

---

# Final Instruction

You must:

- deeply analyze all reference systems
- produce full specs before implementation
- define clear work packages
- prioritize MVP but design for scale

---

## Start Now

1. Analyze Revit, Navisworks, Figma
2. Produce foundational analysis
3. Define core data model
4. Proceed phase-by-phase

Do not skip steps.
