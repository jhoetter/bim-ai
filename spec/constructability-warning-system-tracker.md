# BIM AI - Constructability Warning System Tracker

Last updated: 2026-05-11.

This tracker defines the gap between the current bim-ai warning/advisor system and a system that can credibly warn when a designed house is not physically or architecturally buildable. It is not an implementation plan for a single pull request. It is a product, architecture, validation, and roadmap specification for a multi-stage constructability and coordination system.

The immediate trigger for this tracker was an observed failure mode: a shelf/furniture element passing through a wall without any warning. That failure is representative, not isolated.

## Executive Verdict

The current warning system is useful but not feature complete for constructability.

It currently catches some basic model validity and architectural consistency problems:

- Degenerate or missing-reference elements, such as walls/floors/stairs referencing missing levels.
- Material wall-wall body overlap on the same level.
- Hosted door/window placement errors on walls.
- Door/window opening overlap along a shared wall.
- Room enclosure and access heuristics.
- Floor overlap warnings.
- Stair level and riser/tread sanity checks.
- Schedule/sheet/exchange/documentation advisories.
- A separate, manually run clash-test subsystem for limited element types.

It does not yet provide a comprehensive "can this be built" verdict:

- No automatic physical collision pass across all physical elements.
- No furniture/family/placed-asset collision participation in the primary evaluator.
- No shelf/cabinet/fixture-through-wall detection.
- No wall load-bearing semantics in the core wall model.
- No structural load path or analytical model.
- No full stair headroom/landing/egress/shaft validation.
- No MEP penetration/opening logic.
- No code-profile system for jurisdiction-specific buildability checks.
- No constructability severity policy that distinguishes "authoring noise" from "must fix before build".
- No persistent issue lifecycle equivalent to professional BIM coordination tools.

The target should not be "copy Navisworks." bim-ai should incorporate the durable ideas behind Navisworks, Solibri, Revit Interference Check, Autodesk Model Coordination, BCF, IFC, and IDS into an integrated design-time advisor that is stricter for single-building authoring than a generic coordination viewer, while still supporting professional coordination workflows.

## External System Benchmark

### Navisworks Clash Detective

Navisworks Clash Detective is a coordination tool for searching a combined project model and identifying cross-discipline interferences earlier in the design process. Autodesk describes it as usable for one-off sanity checks or ongoing audit checks, and notes that it can check traditional 3D geometry and laser-scanned point clouds. It can also combine clash checking with TimeLiner schedules and object animation for time-based and moving-object checks.

Sources:

- Autodesk Navisworks Clash Detective overview: https://help.autodesk.com/cloudhelp/2024/ENU/Navisworks-Clash-Detective/files/GUID-36D9904E-12F3-4F82-8DD3-C2103DB0BC29.htm
- Time-based and soft clash testing: https://help.autodesk.com/cloudhelp/2022/ENU/Navisworks/files/GUID-CB255F54-6B5E-4AF4-869D-ED06A0CDF75D.htm

Important concepts to adopt:

| Navisworks concept | Meaning | bim-ai implication |
| --- | --- | --- |
| Clash test | A reusable pairwise check between selection A and selection B. | Keep and expand `selection_set` + `clash_test`, but make it geometry-complete and optionally automatic. |
| Search/selection sets | Property-based object groups used to configure repeatable tests. | Promote selection sets from coordination-only UI to validation profiles: category, discipline, level, room, phase, system, type, material, load-bearing. |
| Hard clash | Actual geometry intersection. | Required first-class rule: solid-vs-solid intersections across all physical elements. |
| Hard conservative | Safer method that may produce false positives. | Add exact and conservative modes; use conservative in authoring preview, exact for final advisor evidence. |
| Clearance clash | Geometry within a required distance. | Needed for access, tolerances, installation space, insulation, maintenance clearances, doors, stairs, cabinets, MEP. |
| Duplicate clash | Detect duplicate/coincident geometry. | Needed for duplicate walls, repeated floors, copied furniture, imported overlaps. |
| Tolerance | Filters negligible interferences and changes severity. | Every rule needs explicit tolerance, source, default, and profile override. |
| Ignore rules | Suppress expected or irrelevant geometry. | Need persistent suppression rules with reason, expiration, affected elements, and audit trail. |
| Result lifecycle | New, Active, Reviewed, Approved, Resolved style statuses. | Need issue status independent from transient validator output. |
| Viewpoint per clash | Result stores camera/isolation/markup context. | Existing viewpoints/BCF surfaces should become mandatory for serious findings. |
| Assignment | Results can be assigned to a person/trade and integrated with coordination issues. | Need owner, discipline, due state, and resolution comments. |

Navisworks has four default clash test types: Hard, Hard Conservative, Clearance, and Duplicates. Autodesk distinguishes static clearance checks from soft clashes, where soft clashes involve moving components linked to animation. It also documents tolerance as a central filter/severity concept for hard, clearance, and duplicate clash tests.

Sources:

- Clash test types: https://help.autodesk.com/cloudhelp/2022/ENU/Navisworks/files/GUID-B13377D4-8AFA-4E95-8435-C6DC4DF26AF4.htm
- Clash terminology and tolerance: https://help.autodesk.com/cloudhelp/2019/ENU/Navisworks/files/GUID-27EA59E6-1A15-4372-9D7D-90508936B512.htm

The key lesson is that professional clash checking is not just "intersections exist." It is:

1. Build a federated model.
2. Define reusable test scopes.
3. Run typed clash algorithms with tolerances.
4. Filter expected conflicts.
5. Group and triage results.
6. Persist result identity across model revisions.
7. Review in context with camera, isolation, markups, assignee, and status.
8. Re-run after model updates and detect new/active/resolved status.

### Autodesk Model Coordination

Autodesk Model Coordination is closer to a cloud coordination service than a desktop clash authoring tool. It creates coordination spaces, can turn automatic clash detection on/off, and automatically detects clashes when supported 3D RVT, DWG, NWC, and IFC models are added. It also supports reviewing clashes, creating reusable clash checks, marking non-issues, creating issues, opting models/objects in and out, grouping data into views, filtering, coloring, and transforming models for alignment before review.

Sources:

- Model Coordination overview: https://help.autodesk.com/view/COORD/ENU/?contextId=MODEL_COORD_ABOUT
- Autodesk Construction Cloud model coordination workflow: https://construction.autodesk.com/workflows/bim-coordination-collaboration

Important concepts to adopt:

- Automatic background clash detection when the model changes, not only user-triggered runs.
- Coordination-space configuration: which files/models/elements participate.
- Model/object opt-in and opt-out from automatic clash detection.
- Saved clash checks.
- Alignment transforms for linked/federated models.
- Issue creation from a clash finding.
- Aggregated model review, not only validator output.

For bim-ai, this implies two modes:

- Authoring mode: immediate local feedback while drawing or placing elements.
- Coordination mode: background or explicit runs across the full current model, linked models, imports, and generated evidence.

### Revit Interference Check

Revit's Interference Check is smaller in scope but important because it is integrated into the authoring model. Autodesk describes it as a way to locate invalid intersections among selected elements or all elements, including linked Revit models. The official workflow includes selecting categories, generating an interference report, showing conflicting elements, modifying the model, refreshing the report, and exporting HTML if conflicts require team follow-up. Autodesk also notes that detailed steel modeling elements and MEP fabrication parts are not included, with Navisworks recommended for that workflow.

Source:

- Revit Interference Checking: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Collaborate/files/GUID-890A9FE0-EFF4-4CFB-9E81-B0DE1A132BEC.htm

Important concepts to adopt:

- Category-pair checking should be available directly in the authoring environment.
- A lightweight report is useful even without a full coordination suite.
- The system should guide users to the affected elements and support refresh after fixes.
- Not every coordination problem belongs in the core authoring validator; some need a coordination module.

For bim-ai, this argues for a "Constructability Report" view that is faster and more integrated than a full clash-test panel:

- "Run constructability check" against active level/model.
- Group by rule and affected element pair.
- Click to isolate and zoom.
- Fix and refresh.
- Export to BCF/JSON/Markdown.

### Solibri Rule-Based Model Checking

Solibri emphasizes rule-based model checking, not just raw clash detection. Its Clash Detection Matrix rule can check clashes between groups of components using a default, custom, or Excel-imported matrix. The matrix can define group combinations, tolerances, ignored combinations, and categorization by discipline. The linked Excel workflow lets organizations reuse standards across projects.

Sources:

- Solibri Clash Detection Matrix rule: https://help.solibri.com/hc/en-us/articles/23765423193111-245-Clash-Detection-Matrix
- Solibri Intelligent Model Checking: https://www.solibri.com/intelligent-model-checking

Important concepts to adopt:

- A matrix is more scalable than hand-authored pairwise tests.
- Empty matrix cells mean "do not check this pair."
- Tolerance can vary per element group pair.
- Spaces and openings often need special handling.
- Rules should be reusable across projects.
- Results should be categorized by discipline and requirement area.

For bim-ai, this is the most important product pattern: introduce a Constructability Matrix. The current warning system is a bag of individual rules. A matrix makes intent explicit:

- Architecture vs Architecture.
- Architecture vs Structure.
- Architecture vs MEP.
- Furniture/Fixtures vs Architecture.
- Stairs vs Envelope.
- Openings vs Hosts.
- Floors/Roofs vs Walls.
- Rooms/Areas vs Enclosure.
- Site/Topo vs Building.

### BCF

BCF is an openBIM standard for exchanging model-based issues. buildingSMART describes BCF as contextualized issue/problem data that references a view, PNG, IFC coordinates, and BIM elements via IFC GUIDs. It supports file-based exchange and RESTful web-service workflows, and is used for QA/QC, design coordination, clash detection issues, annotations, options, substitutions, and construction coordination.

Source:

- buildingSMART BCF technical page: https://technical.buildingsmart.org/standards/bcf/?lang=en

Important concepts to adopt:

- A finding should be portable as an issue, not trapped in the UI.
- Findings need stable element references.
- Findings need viewpoint/camera/visibility context.
- Findings need comment history.
- Findings need roundtrip support.

For bim-ai, the current `bcf`/issue/export surfaces should be treated as an eventual constructability issue layer. Every serious constructability warning should be convertible to BCF-like issue data.

### IDS and IFC

IDS is a buildingSMART standard for computer-interpretable information requirements. It is valuable for checking properties, quantities, classifications, materials, and relationships in IFC data. buildingSMART explicitly says IDS does not cover geometrical aspects. That boundary matters: IDS helps us validate metadata requirements such as `LoadBearing`, `FireRating`, or `IsExternal`; it does not replace clash detection.

Sources:

- buildingSMART IDS: https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/
- IFC `Pset_WallCommon`: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcsharedbldgelements/pset/pset_wallcommon.htm

The IFC `Pset_WallCommon` standard includes `LoadBearing`, described as whether the object is intended to carry loads. This gives bim-ai a clear interoperability target: our wall model should represent load-bearing intent and export/import it consistently.

Important concepts to adopt:

- Metadata validation and geometry validation are separate layers.
- Load-bearing wall semantics should align with IFC property sets.
- IDS can eventually express required data such as `Pset_WallCommon.LoadBearing`, `FireRating`, `IsExternal`, type reference, material, and classification.
- Constructability is a composition of geometry, metadata, system relationships, and code profile checks.

## Current bim-ai State

### Primary validation surface

The primary backend evaluator is `app/bim_ai/constraints_evaluation.py:evaluate(elements)`, re-exported through `app/bim_ai/constraints.py`.

Observed coverage:

| Area | Current rule examples | Severity posture | Current limitation |
| --- | --- | --- | --- |
| Levels/datum | Missing parent, duplicate elevation, offset mismatch | Mixed error/warning | Coordinate discipline only; not constructability. |
| Walls | Missing level, zero length, material wall overlap | Error for serious invalidity | No wall-vs-nonwall collision. No load-bearing semantics. |
| Openings | Door/window off wall, outside wall extents, overlapping hosted openings | Error/warning/info | Does not validate structural header/lintel, egress, sill/head, code. |
| Rooms | Degenerate outline, overlap, unenclosed, no access heuristic | Warning/error mixed | Enclosure is topological/plan-based; not code or usability complete. |
| Floors | Missing level, degenerate floor, overlap | Error/warning | Floor overlap is warning, no slab-wall/shaft/stair completeness. |
| Slab openings | Missing host floor, degenerate opening | Error/warning | Does not require stair shaft where stairs cross floors. |
| Stairs | Missing levels, riser/tread sanity, schedule derivation sanity | Error/warning/info | No full landing, headroom, wall/furniture collision, guardrail, egress. |
| Materials/exchange | Catalog and export advisories | Info/warning | Metadata fidelity, not buildability. |
| Schedules/sheets | Placement/staleness/readout advisories | Info/warning/error | Documentation consistency, not physical constructability. |

Key file references:

- `app/bim_ai/constraints_evaluation.py`
- `app/bim_ai/constraints_core.py`
- `app/bim_ai/constraints_metadata.py`
- `app/bim_ai/elements.py`

### Clash engine surface

The standalone clash engine is `app/bim_ai/clash_engine.py`. It supports selection sets, clash tests, linked model transforms, and AABB distance checks.

Current actual AABB dispatcher coverage:

- `wall`
- `floor`
- `grid_line`

Current gap:

- Despite the file header mentioning family-instance-shaped kinds, `aabb_for_element()` does not currently handle `family_instance`, `placed_asset`, `door`, `window`, `stair`, `beam`, `column`, `roof`, `ceiling`, `duct`, `pipe`, `fixture`, `family_kit_instance`, or room/space proxies.
- The engine is manually run through `run_clash_test`; it is not part of the default commit/advisor loop.
- The algorithm is AABB-only. This is acceptable as a broad phase, but not enough for final false-positive-controlled clash results.

Key file references:

- `app/bim_ai/clash_engine.py`
- `app/bim_ai/engine_dispatch_coordination.py`
- `packages/web/src/coordination/ClashTestPanel.tsx`

### Constraint system surface

The EDT constraint evaluator supports dimensional/geometric design constraints:

- `equal_distance`
- `parallel`
- `perpendicular`
- `collinear`
- `equal_length`

It is not a constructability engine. It explicitly treats unknown rules and unresolved references as pass-through. It is useful for parametric authoring constraints, not physical feasibility.

Key file references:

- `app/bim_ai/edt/constraints.py`
- `app/bim_ai/engine_commit.py`

### SKB soundness helpers

The SKB helper modules provide architectural soundness checks:

- Wall corner gaps/overlaps.
- Floor boundary vs wall enclosure.
- Monotonic levels.
- Roof contains upper wall centerlines.
- Wall graph orphan/non-orthogonal/T-intersection advisories.
- Roof-wall alignment.

Current limitation:

- These are helper/advisory packs, not wired into the main commit gate as comprehensive constructability rules.
- Many are intentionally warning-level and phase-focused.
- They do not cover furniture/fixtures, MEP, structural load path, code, exact solids, or persistent issue lifecycle.

Key file references:

- `app/bim_ai/skb/soundness.py`
- `app/bim_ai/skb/wall_graph.py`
- `app/bim_ai/skb/roof_wall_alignment.py`

## Root-Cause Analysis of the Shelf-Through-Wall Failure

The shelf-through-wall failure is caused by a missing physical collision layer.

Current model facts:

- `FamilyInstanceElem` has `family_type_id`, `position_mm`, `rotation_deg`, `param_values`, optional host fields, and discipline. It has no direct collision shape or resolved world-space solid in the backend model.
- `PlacedAssetElem` has `asset_id`, `level_id`, `position_mm`, `rotation_deg`, `param_values`, optional host, and discipline. It has no backend collision shape contract.
- The primary evaluator only gathers walls, doors, windows, rooms, grids, dimensions, room separations, and levels at the top of `evaluate()`.
- The clash engine does not compute AABBs for family instances or placed assets.

Therefore:

- A shelf can visually render through a wall.
- The core evaluator will not see it.
- The clash engine will not include it.
- No `Violation` is emitted.
- The Advisor panel has no issue to show.

Required design correction:

Every physical element category must expose a normalized collision proxy. Rendering geometry is not enough. The backend needs deterministic physical envelopes for validation.

## Target Product Definition

The constructability warning system should become a layered system:

1. Schema semantics
2. Geometry extraction
3. Broad-phase spatial indexing
4. Narrow-phase collision and clearance checks
5. Rule/matrix configuration
6. Severity policy
7. Issue lifecycle
8. Evidence and exports
9. Authoring-time prevention and guided fixes

### Non-goals

The system should not claim to replace:

- A licensed structural engineer.
- Local building official review.
- Full finite-element analysis.
- Fire/life-safety certification.
- Manufacturer-specific installation engineering.
- Construction-document legal review.

The product language should be "constructability warnings", "coordination readiness", and "model sanity", not "guaranteed buildable."

## Proposed Architecture

### Layer 1 - Physical Element Contract

Introduce a backend contract for physical participation:

```ts
PhysicalParticipant {
  elementId: string;
  kind: string;
  category: string;
  discipline: "arch" | "struct" | "mep" | "site" | "furniture" | "annotation";
  levelId?: string;
  phaseId?: string;
  optionSetId?: string;
  optionId?: string;
  worldTransform: Transform3d;
  bbox: Aabb3d;
  proxies: CollisionProxy[];
  openings?: OpeningVoidProxy[];
  metadata: {
    loadBearing?: boolean;
    hostElementId?: string;
    roomId?: string;
    systemId?: string;
    materialKey?: string;
    typeId?: string;
  };
}
```

Collision proxies should support progressive fidelity:

| Proxy | Use |
| --- | --- |
| AABB | Fast broad phase. |
| OBB | Rotated furniture, walls, beams, cabinets. |
| Extruded 2D polygon | Floors, roofs, rooms, wall solids, slabs. |
| Capsule/cylinder | Pipes, ducts, rails, round columns. |
| Mesh/triangle soup | Imported IFC/NWC-like geometry and generated family solids. |
| Void proxy | Doors, windows, slab openings, wall openings, sleeves. |

Acceptance criteria:

- Every physical element either returns one or more proxies or returns an explicit "not clashable" diagnostic.
- A constructability run reports unsupported physical elements as coverage gaps, not silent passes.
- Proxies are deterministic and testable from server-side model state.

### Layer 2 - Geometry Extraction Registry

Add a server-side registry:

```py
collision_proxy_for_element(element, document) -> CollisionProxyBundle
```

Initial extractors:

- Wall: oriented rectangular prism, respecting thickness, height, level elevation, constraints where available, lean/taper later.
- Floor: extruded polygon slab with thickness.
- Roof: extruded/slope-aware footprint proxy; start with conservative prism, later exact roof geometry.
- Ceiling: extruded plane/slab.
- Door/window/wall_opening: void or occupied object depending category; hosted openings should subtract from wall clash checks.
- Stair: run/landing envelope and headroom clearance volume.
- Column/beam/brace/foundation: structural OBB/cylinder/extrusion.
- Placed asset: rectangular/capsule/asset-specific proxy from asset schema and param values.
- Family instance: resolved family bounding geometry from family type parameters and nested definitions.
- Family kit instance: component chain proxies.
- Pipe/duct/fixture: cylinder/box/system proxies.
- Toposolid/site: terrain surface proxy and building embed/cut checks.
- Link model: transform source proxies into host coordinates.

Initial implementation should be conservative: if an exact proxy is not available, use a safe bounding proxy and mark finding confidence as `conservative`.

### Layer 3 - Broad Phase

Add spatial indexing:

- Per-level or per-z-slab broad-phase buckets.
- Dynamic AABB tree, BVH, or uniform grid.
- Pair filter before expensive narrow phase.
- Exclude annotation-only, hidden-only, demolished, and inactive design-option elements by active validation profile.

The broad phase should output candidate pairs:

```py
CandidatePair {
  a: PhysicalParticipant;
  b: PhysicalParticipant;
  broadPhaseReason: "bbox_overlap" | "clearance_zone_overlap";
}
```

### Layer 4 - Narrow Phase

Required narrow-phase checks:

| Check | Required for |
| --- | --- |
| Solid intersection depth/volume | Hard clash. |
| Minimum distance | Clearance clash. |
| Duplicate/coincident geometry | Duplicate clash. |
| Host void subtraction | Doors/windows/openings should not clash with their host wall where a void exists. |
| Penetration-without-opening | Pipe/duct/beam/shelf through wall/floor/roof unless opening/sleeve/host relation exists. |
| Containment | Wall centerline inside roof, furniture inside room, stair inside shaft. |
| Headroom clearance volume | Stairs, doors, circulation paths. |
| Swing/operation envelope | Doors, appliances, cabinets, windows where applicable. |
| Maintenance/access zone | Equipment, cabinets, windows, fixtures. |

Severity should depend on:

- Element classes.
- Intersection volume/depth.
- Clearance deficit.
- Whether a known host/void relationship explains the intersection.
- Whether either element is load-bearing or life-safety-critical.
- Whether the finding is exact or conservative.
- Active profile: authoring, coordination, permit-readiness, construction-readiness.

### Layer 5 - Constructability Matrix

Introduce a checked-in/default Constructability Matrix. This should be equivalent in spirit to Solibri/Navisworks clash matrices but adapted to bim-ai categories.

Example matrix rows:

| A | B | Check | Default severity | Tolerance | Notes |
| --- | --- | --- | --- | --- | --- |
| furniture | wall | hard | error | 0 mm | Catches shelf through wall. |
| furniture | door_swing | clearance | warning/error | 0 mm | Prevent blocked doors. |
| fixture | wall | hard | error unless hosted | 0 mm | Wall-hosted exceptions allowed. |
| pipe/duct | wall | penetration | warning/error | 0 mm | Must have opening/sleeve or approved suppression. |
| stair | wall | hard | error | 0 mm | Stair cannot run through wall. |
| stair | headroom_volume | clearance | error | profile-defined | Requires story/headroom model. |
| floor | floor | duplicate/overlap | warning/error | area threshold | Same-level duplicates are suspect. |
| wall | wall | hard | error | 0 mm | Existing rule, extend to exact/3D. |
| wall | roof | containment/alignment | warning/error | profile-defined | Roof/wall mismatch. |
| load_bearing_wall | opening | structural_opening_metadata | warning/error | n/a | Requires lintel/header/approval metadata. |
| room | boundary | enclosure | warning/error | gap threshold | Existing check, improve. |
| room | door | access | warning/error | profile-defined | Real door access, not centroid heuristic. |
| site | building | embed/slope/drainage | warning | profile-defined | Later-stage site constructability. |

Matrix cells need:

- `enabled`
- `checkType`
- `severity`
- `toleranceMm`
- `minVolumeMm3`
- `minAreaMm2`
- `allowedHostRelations`
- `allowedVoidKinds`
- `defaultSuppressionRules`
- `profileOverrides`

### Layer 6 - Load-Bearing and Structural Semantics

Add first-class wall structural fields:

```py
WallElem:
  load_bearing: bool | None
  structural_role: Literal[
    "unknown",
    "non_structural",
    "load_bearing",
    "shear",
    "foundation",
    "retaining",
    "core"
  ]
  analytical_participation: bool
  structural_material_key: str | None
  design_intent_confidence: float | None
```

Use IFC-compatible export/import mapping:

- `Pset_WallCommon.LoadBearing`
- `Pset_WallCommon.IsExternal`
- `Pset_WallCommon.Compartmentation`
- Fire/acoustic ratings later.

Do not infer load-bearing as truth from thickness alone. Thickness, exterior status, stacked alignment, beams/columns, roof/floor supports, and material can suggest intent, but the final state must distinguish:

- `unknown`
- `inferred_load_bearing_candidate`
- `declared_load_bearing`
- `declared_non_structural`

Initial structural advisory rules:

| Rule ID | Purpose |
| --- | --- |
| `wall_load_bearing_unknown_primary_envelope` | Primary exterior/envelope walls lack structural role. |
| `load_bearing_wall_removed_without_transfer` | A load-bearing wall is demolished or interrupted without beam/column/transfer metadata. |
| `stacked_load_path_discontinuity` | Load-bearing wall above has no support below within tolerance. |
| `large_opening_in_load_bearing_wall_unresolved` | Opening exceeds threshold and lacks lintel/header/engineer approval metadata. |
| `beam_without_support` | Beam endpoints are not supported by wall/column/bearing element. |
| `column_without_foundation_or_support` | Column load path terminates without lower support/foundation. |
| `floor_span_without_support_metadata` | Floor/roof span exceeds profile threshold without structural system metadata. |

These should initially be warnings unless a strict profile is enabled. They are not structural calculations; they are missing-intent and load-path sanity advisories.

### Layer 7 - Issue Lifecycle

Add persistent constructability findings:

```ts
ConstructabilityIssue {
  id: string;
  fingerprint: string;
  ruleId: string;
  severity: "info" | "warning" | "error" | "blocker";
  status: "new" | "active" | "reviewed" | "approved" | "not_an_issue" | "resolved" | "suppressed";
  elementIds: string[];
  pairKey?: string;
  levelId?: string;
  discipline?: string;
  blockingClass: "geometry" | "structure" | "access" | "code" | "metadata" | "documentation" | "exchange";
  message: string;
  recommendation: string;
  evidence: {
    pointMm?: [number, number, number];
    bboxMm?: Aabb3d;
    penetrationMm?: number;
    clearanceDeficitMm?: number;
    overlapVolumeMm3?: number;
    viewpointId?: string;
    bcfTopicId?: string;
  };
  owner?: string;
  createdRevision: number;
  lastSeenRevision: number;
  resolvedRevision?: number;
  suppression?: SuppressionRecord;
}
```

Fingerprint strategy:

- Stable rule id.
- Stable element ids when possible.
- Element type/kind fallback when copied/imported.
- Approximate clash location bucket.
- Pair order normalized.
- Geometry revision hash.

This enables "new/active/resolved" behavior after re-runs, similar to coordination tools.

### Layer 8 - Advisor and UX

Required UI behaviors:

- Advisor section: Constructability.
- Filter by severity, discipline, level, status, rule group, profile.
- "Show in 3D" and "Show in plan."
- Auto-isolate affected elements.
- Ghost the rest of the model.
- Draw clash marker and clearance/penetration vector.
- Show exact evidence values.
- Explain why the finding exists and how to fix it.
- Convert to BCF issue.
- Mark reviewed/not issue/approved with required reason.
- Suppress rule/pair with expiration and audit note.
- Re-run constructability check.
- Background stale indicator when model revision changed since last run.

Authoring-time prevention:

- While placing furniture, show red preview if collision with wall/door swing/fixture clearance.
- While placing openings, show warning if load-bearing metadata requires header/lintel info.
- While editing stairs, show headroom/landing/shaft warnings before commit.
- While moving walls, show affected room/floor/roof/structural load-path warnings.

## Gap Register

Status vocabulary:

- `open` - no meaningful implementation.
- `partial` - some logic exists but is incomplete or not wired to constructability.
- `blocked` - cannot be implemented cleanly until prerequisite schema/engine work exists.
- `done` - accepted with tests and evidence.

| ID | Status | Severity | Gap | Current evidence | Target |
| --- | --- | --- | --- | --- | --- |
| CW-001 | partial | Critical | Universal physical element collision contract missing. | `constructability_geometry.py` now collects proxies for walls, floors, roofs, ceilings, stairs, railings, columns, beams, pipe, duct, placed assets, family instances, and family kit instances, with unsupported physical diagnostics for remaining physical-like kinds. Exact solids and every object category are not complete. | Every physical element exposes deterministic collision proxies or explicit unsupported diagnostics. |
| CW-002 | done | Critical | Furniture/fixture/family-vs-wall hard clash missing. | Shelf/family-through-wall emits `furniture_wall_hard_clash`, appears in constructability reports, fixture corpus, and BCF-style export viewpoints. | `furniture_wall_hard_clash` warning/error with viewpoint and affected ids. |
| CW-003 | partial | High | Clash engine is AABB-only and category-limited. | Clash engine now delegates AABB coverage to constructability physical participants and broad-phase candidate pruning exists; narrow-phase exact solids are still incomplete. | AABB broad phase plus narrow phase across all physical categories. |
| CW-004 | partial | High | Constructability matrix missing. | Default versioned matrix and matrix-backed hard/duplicate checks exist in app code and `spec/schemas/constructability-matrix-default.json`; profile-specific matrix overrides remain incomplete. | Versioned matrix with pair rules, tolerance, severity, and profile overrides. |
| CW-005 | partial | High | Persistent issue lifecycle missing. | `constructability_issues.py` fingerprints findings and reconciles new/active/reviewed/approved/not-issue/resolved/suppressed snapshots in reports; no first-class persisted `constructability_issue` element/store exists yet. | Stable issues with new/active/reviewed/approved/not-issue/resolved/suppressed states. |
| CW-006 | done | High | Load-bearing wall semantics missing. | `WallElem` carries `loadBearing`, structural role/material/analytical fields, constructability rules consume them, and IFC metadata roundtrip tests cover `Pset_WallCommon.LoadBearing`. | IFC-aligned load-bearing intent and structural role metadata. |
| CW-007 | partial | High | Structural load-path sanity missing. | Rules now cover unknown load-bearing intent, large openings in load-bearing walls, removed load-bearing walls without transfer, stacked wall discontinuity, unsupported beams, unsupported columns, and long floor spans without structural metadata; this is still heuristic rather than a complete support graph. | Warnings for unsupported beams/columns, load-bearing wall discontinuity, large openings. |
| CW-008 | partial | High | Stairs are not constructability-complete. | Riser/tread diagnostics, stair-wall clashes, stair slab-opening checks, and `stair_headroom_clearance_conflict` for low ceiling/roof proxies now exist; landing/guardrail/egress checks remain incomplete. | Headroom, landing, shaft/opening, guardrail, wall/furniture clash checks. |
| CW-009 | partial | High | Room access/enclosure is heuristic. | Centroid-distance door/window heuristic and edge coverage exist. | Door-connected access graph, egress hints, realistic room boundary model. |
| CW-010 | partial | High | Door/window operation envelopes missing. | `door_operation_clearance_conflict` checks door operation clearance against placed assets, family instances, and walls; window operation and richer clearance profiles remain incomplete. | Door swing/window operation clearances collide with furniture/walls/fixtures. |
| CW-011 | partial | High | MEP penetration logic missing. | Pipe/duct proxies and wall/floor/ceiling penetration checks exist, with wall/slab openings suppressing valid penetrations; explicit sleeve/approval objects remain incomplete. | Pipes/ducts through walls/floors/ceilings require sleeve/opening/approval. |
| CW-012 | partial | Medium | Roof-specific constructability rules deferred. | PRD matrix marks roof rules deferred. SKB helper exists. | Roof slope/footprint/wall attachment/void checks in primary advisor. |
| CW-013 | partial | Medium | Floor/slab checks are warning-level and narrow. | Same-level floor overlap warning exists. | Floor duplicate, shaft, stair opening, support, and boundary-vs-wall checks. |
| CW-014 | partial | Medium | Clearance checks missing. | Door operation clearance and stair headroom clearance checks exist; generic distance/maintenance/cabinet clearance profiles remain incomplete. | Clearance volumes and min-distance checks by matrix/profile. |
| CW-015 | partial | Medium | Duplicate geometry detection missing outside floor overlap. | Matrix-backed `physical_duplicate_geometry` detects duplicate physical proxies, including placed assets; exact duplicate solids/import-specific grouping remain incomplete. | Duplicate wall/floor/asset/import detection. |
| CW-016 | done | Medium | Suppression/ignore rules missing. | `constructability_suppression` elements carry rule, scoped element ids, reason, active flag, and expiry revision; reports audit suppressed findings/issues. | Audited suppressions with reason, scope, expiry. |
| CW-017 | partial | Medium | BCF linkage incomplete for constructability. | BCF/export surfaces exist. | Every serious finding can become BCF-like issue with viewpoint. |
| CW-018 | partial | Medium | IDS/data-requirement validation not first-class. | `app/bim_ai/constructability_metadata.py` adds profile-specific IDS-like metadata checks for primary envelope/load-bearing wall readiness requirements and emits `constructability_metadata_requirement_missing` through constructability reports. | IDS-like model metadata requirements for constructability profiles. |
| CW-019 | partial | Medium | Active design options/phasing not integrated into constructability. | `constructability_report` and `constructabilitySummary_v1` now scope findings by `phaseFilter`, explicit option locks, and primary design options via `app/bim_ai/constructability_scope.py`; generic evaluator output remains unscoped. | Validation profiles respect phase and design option contexts. |
| CW-020 | partial | Medium | Performance plan missing. | `candidate_pairs_by_aabb` adds deterministic sweep-and-prune broad-phase pruning for constructability matrix checks; benchmarks and incremental invalidation remain incomplete. | Benchmarked broad phase and incremental invalidation. |
| CW-021 | partial | Medium | User-facing constructability report missing. | `/api/models/{model_id}/constructability-report` and web report client helpers exist; a full unified interactive report view with grouping/isolation/export controls remains incomplete. | Unified report with refresh, grouping, isolation, export. |
| CW-022 | done | Medium | Test corpus missing. | `app/tests/fixtures/constructability_cases.json` plus `app/tests/test_constructability_fixture_corpus.py` cover positive/negative golden cases for wall/furniture, MEP sleeve, stair slab opening, duplicates, load-bearing openings, roof coverage, and beam support. | Golden constructability fixtures with positive/negative cases. |

## Roadmap

### Phase 0 - Tracker and evidence baseline

Status: this document.

Deliverables:

- This tracker committed under `spec/`.
- A small fixture or script documenting the shelf-through-wall false negative.
- A coverage matrix from current evaluator and clash engine.

Acceptance:

- The team agrees that "no warning" does not equal "buildable."
- We stop calling warning/advisor coverage feature complete until CW gaps close.

### Phase 1 - Collision proxy foundation

Goal: make physical elements clashable.

Deliverables:

- `collision_proxy.py` or equivalent server module.
- Collision proxy dataclasses and JSON evidence shape.
- Extractors for wall, floor, roof conservative proxy, door/window occupied/void, stair conservative envelope, column, beam, placed_asset, family_instance basic bounding box.
- Unit tests for each extractor.
- Unsupported physical element diagnostics.

Acceptance:

- A shelf/furniture placed through a wall produces a candidate pair in broad phase.
- No physical element silently disappears from constructability coverage.

### Phase 2 - Generic hard clash engine

Goal: detect actual intersections.

Deliverables:

- Broad-phase spatial index.
- Narrow-phase OBB/extruded-polygon intersection for initial categories.
- Rule ids:
  - `physical_hard_clash`
  - `furniture_wall_hard_clash`
  - `stair_wall_hard_clash`
  - `asset_floor_duplicate_or_overlap`
- Host/void exception handling for doors/windows/openings.
- Advisor integration.

Acceptance:

- Shelf through wall warns.
- Stair through wall warns.
- Door opening does not falsely clash with its own host wall when void is valid.
- Wall-wall existing behavior remains covered.

### Phase 3 - Constructability matrix

Goal: make rules configurable and reviewable.

Deliverables:

- Versioned default matrix in `spec/schemas` or app config.
- Matrix loader and evaluator.
- Per-profile severity/tolerance overrides.
- Tests for ignored cells and tolerance-specific cells.
- UI readout of active matrix/profile.

Acceptance:

- Furniture-vs-wall can be configured independently from wall-vs-wall.
- A project can opt into stricter "construction-readiness" checks.

### Phase 4 - Persistent issue lifecycle

Goal: findings survive model revisions.

Deliverables:

- `constructability_issue` element or server-side issue store.
- Fingerprinting.
- New/active/resolved status after re-run.
- Reviewed/approved/not-issue/suppressed workflows.
- Required suppression reason.
- Viewpoint evidence.

Acceptance:

- Fixing a shelf-through-wall marks the prior issue resolved after rerun.
- Reintroducing the same issue produces stable/new status behavior.

### Phase 5 - Load-bearing and structural sanity

Goal: represent structural intent and catch missing load-path metadata.

Deliverables:

- Wall schema fields for load-bearing/structural role.
- IFC import/export mapping for `Pset_WallCommon.LoadBearing`.
- Inspector UI for structural role.
- Initial structural advisory rules:
  - `wall_load_bearing_unknown_primary_envelope`
  - `large_opening_in_load_bearing_wall_unresolved`
  - `stacked_load_path_discontinuity`
  - `beam_without_support`
  - `column_without_foundation_or_support`
- Tests for declared/inferred/unknown behavior.

Acceptance:

- The user can ask "which walls are load-bearing?" and receive a model-backed answer distinguishing declared vs unknown.
- Large openings in declared load-bearing walls require structural metadata or produce warnings.

### Phase 6 - Clearance and operation envelopes

Goal: move beyond intersection to usability.

Deliverables:

- Generic clearance zones.
- Door swing envelopes.
- Stair headroom envelope.
- Cabinet/appliance operation envelopes.
- Maintenance clearance profiles.
- Rule ids for door blocked, stair headroom, fixture clearance, cabinet clearance.

Acceptance:

- Furniture blocking a door swing warns.
- Stair under low ceiling/roof warns.
- Required clearance can vary by profile.

### Phase 7 - MEP and penetration coordination

Goal: support the common pipe/duct-through-wall workflow.

Deliverables:

- Pipe/duct collision proxies.
- Wall/floor/ceiling penetration checks.
- Sleeve/opening/approved penetration representation.
- MEP-vs-structure/architecture matrix defaults.

Acceptance:

- Pipe through wall without sleeve/opening warns.
- Pipe through wall with matching sleeve/opening does not warn.

### Phase 8 - BCF/IDS/export integration

Goal: make constructability findings portable.

Deliverables:

- BCF export/import for constructability issues.
- IDS-like metadata profiles for required constructability fields.
- Evidence package includes constructability summary and open blockers.
- CLI gate supports `--fail-on-constructability-error`.

Acceptance:

- Serious constructability findings can be exchanged as BCF-like issues.
- Metadata requirements such as load-bearing/fire rating can be checked independently from geometry.

## Severity Policy

Default severity should be conservative but not paralyzing.

| Severity | Meaning | Commit behavior |
| --- | --- | --- |
| info | Missing metadata, advisory hint, or non-blocking quality signal. | Never blocks. |
| warning | Likely problem requiring review. | Does not block by default, but blocks `--fail-on-warning` workflows. |
| error | Invalid model or physically impossible condition in active profile. | Blocks commit or strict constructability gate depending mode. |
| blocker | Cannot claim project/phase readiness. | Blocks readiness/evidence gates. |

Important policy:

- Authoring commit should not always block on constructability errors until false positives are under control.
- Readiness gates should block on unresolved constructability errors.
- Suppression requires a reason and should be visible in evidence.
- "Not an issue" is not deletion. It is a reviewed state.

## Validation Profiles

| Profile | Intended use | Behavior |
| --- | --- | --- |
| `authoring_fast` | Live editing feedback. | Conservative broad checks, low latency, preview warnings. |
| `design_review` | User-initiated model review. | Full current-model hard/clearance checks, warnings allowed. |
| `coordination` | Multi-discipline / linked model review. | Matrix-based checks, issue lifecycle, BCF export. |
| `permit_readiness` | Documentation-quality gate. | Adds metadata, rooms, access, stairs, openings, load-bearing intent. |
| `construction_readiness` | Strongest internal gate. | Blocks unresolved geometry/structure/access errors unless approved. |

## Testing Strategy

Create a constructability fixture corpus:

| Fixture | Expected finding |
| --- | --- |
| Shelf through wall | `furniture_wall_hard_clash` |
| Shelf near wall but not intersecting | No hard clash |
| Shelf within required clearance zone | Clearance warning if profile enabled |
| Door hosted in wall | No host wall hard clash |
| Window outside wall extents | Existing window host error |
| Stair run through wall | `stair_wall_hard_clash` |
| Stair missing slab opening | Shaft/slab opening warning |
| Stair under low roof | Headroom error |
| Pipe through wall without sleeve | Penetration warning/error |
| Pipe through wall with sleeve | No warning |
| Duplicate floor copied in place | Duplicate/overlap warning/error |
| Load-bearing wall with large opening | Structural metadata warning |
| Beam endpoint unsupported | Structural support warning |
| Column floating above floor | Structural support warning |
| Roof too small for attached walls | Roof-wall alignment warning/error |
| Furniture outside room/envelope | Placement warning |

Every fixture should have:

- Backend unit test.
- JSON violation snapshot.
- Optional 3D/plan evidence screenshot once UI support exists.
- A "no false positive" sibling case.

Current implementation evidence:

- `app/tests/fixtures/constructability_cases.json` stores the golden fixture corpus.
- `app/tests/test_constructability_fixture_corpus.py` validates each case through the primary evaluator and constructability report snapshot.

## Performance Requirements

Initial target for a one-family house:

- Authoring preview check under 50 ms for moved/placed element against local neighborhood.
- Full constructability run under 1 second for typical single-family model.
- Full linked/coordination run can be asynchronous.

Implementation tactics:

- Incremental invalidation by changed element id.
- Spatial index keyed by AABB and level/z range.
- Broad phase before exact checks.
- Cache resolved family/asset collision proxies by type id + param hash.
- Skip inactive design options and phases by profile.
- Emit coverage diagnostics for unsupported elements rather than attempting expensive fallback.

## Data Model Additions

Proposed new element/config kinds:

| Kind | Purpose |
| --- | --- |
| `constructability_profile` | Active profile, severity/tolerance overrides. |
| `constructability_matrix` | Versioned pairwise rule matrix. |
| `constructability_issue` | Persistent finding lifecycle. |
| `constructability_suppression` | Audited ignore/suppression rule. |
| `collision_proxy_cache` | Optional derived/cache evidence, not source of truth. |

Proposed new fields:

- `WallElem.loadBearing`
- `WallElem.structuralRole`
- `WallElem.analyticalParticipation`
- `WallElem.structuralMaterialKey`
- `DoorElem.operationEnvelopeOverride`
- `FamilyTypeElem.collisionProxySchema`
- `PlacedAssetElem.clearanceProfileId`
- `FamilyInstanceElem.clearanceProfileId`
- `PipeElem.systemId`
- `DuctElem.systemId`
- `SlabOpeningElem.openingPurpose`
- `WallOpeningElem.openingPurpose`

## Reporting and Evidence

The evidence package should include:

```json
{
  "constructabilitySummary_v1": {
    "profileId": "construction_readiness",
    "modelRevision": 123,
    "counts": {
      "info": 10,
      "warning": 4,
      "error": 1,
      "blocker": 0,
      "suppressed": 2,
      "resolved": 12
    },
    "coverage": {
      "physicalElements": 82,
      "proxySupported": 77,
      "proxyUnsupported": 5
    },
    "openIssueIds": ["ci-001"]
  }
}
```

Readiness gates:

- `constructability_proxy_coverage`
- `constructability_no_open_errors`
- `constructability_no_unreviewed_high_warnings`
- `constructability_no_unsupported_critical_categories`
- `constructability_bcf_exportable`
- `constructability_profile_recorded`

## Open Questions

1. Should strict constructability errors block normal authoring commits, or only readiness gates?
2. Should furniture be classified as `arch`, `furniture`, or `interiors` for matrix purposes?
3. Should collision proxies be stored as derived evidence or regenerated every run?
4. How much exact geometry fidelity is required before we show an `error` instead of a `warning`?
5. How should local code profiles be represented for US/EU/DE defaults?
6. Should load-bearing state be required on all primary walls, or only on permit/construction profiles?
7. Should `approved` findings survive geometry changes, or become stale automatically?
8. What is the minimum BCF subset we need for roundtrip issue exchange?
9. Should linked/imported model elements be issue-addressable if the source model is not editable?
10. Should AI-generated model authoring be blocked from producing construction-readiness evidence until constructability has no open errors?

## Immediate Next Work Packages

| WP | Title | Depends on | Done when |
| --- | --- | --- | --- |
| CW-WP-001 | Collision proxy foundation | none | Wall, floor, roof conservative, stair, placed_asset, family_instance proxies with tests. |
| CW-WP-002 | Shelf-through-wall hard clash | CW-WP-001 | Minimal fixture emits `furniture_wall_hard_clash`; no false positive for adjacent shelf. |
| CW-WP-003 | Constructability matrix v0 | CW-WP-001 | Matrix drives furniture/wall, wall/wall, stair/wall checks with tolerances. |
| CW-WP-004 | Advisor integration | CW-WP-002 | Constructability findings appear in Advisor with isolate/show evidence. |
| CW-WP-005 | Persistent issue lifecycle | CW-WP-004 | New/active/resolved/reviewed/suppressed behavior across reruns. |
| CW-WP-006 | Load-bearing wall semantics | none | Wall schema and IFC mapping support declared/unknown load-bearing state. |
| CW-WP-007 | Structural sanity v0 | CW-WP-006 | Large opening in load-bearing wall and unsupported beam/column warnings. |
| CW-WP-008 | Stair constructability v0 | CW-WP-001 | Stair-wall clash, shaft/slab opening, and headroom checks. |
| CW-WP-009 | Door operation clearance | CW-WP-001 | Door swing envelope collides with furniture/walls. |
| CW-WP-010 | BCF constructability export | CW-WP-005 | Serious findings export/import with viewpoint and comments. |

## References

- Autodesk Navisworks Clash Detective overview: https://help.autodesk.com/cloudhelp/2024/ENU/Navisworks-Clash-Detective/files/GUID-36D9904E-12F3-4F82-8DD3-C2103DB0BC29.htm
- Autodesk Navisworks clash test options: https://help.autodesk.com/cloudhelp/2022/ENU/Navisworks/files/GUID-B13377D4-8AFA-4E95-8435-C6DC4DF26AF4.htm
- Autodesk Navisworks Rules tab: https://help.autodesk.com/cloudhelp/2023/ENU/Navisworks-Clash-Detective/files/GUID-1BD33846-D747-485B-A54F-B231319DC5D4.htm
- Autodesk Navisworks clash results workflow: https://help.autodesk.com/cloudhelp/2026/ENU/Navisworks-Clash-Detective/files/GUID-B354BA25-836F-4244-AD5F-1B779B32A4D9.htm
- Autodesk Navisworks clash terminology: https://help.autodesk.com/cloudhelp/2019/ENU/Navisworks/files/GUID-27EA59E6-1A15-4372-9D7D-90508936B512.htm
- Autodesk Navisworks locating clashes: https://help.autodesk.com/cloudhelp/2021/ENU/Navisworks/files/GUID-807A6516-CD83-453E-B2A0-5572D84D89FE.htm
- Autodesk Model Coordination overview: https://help.autodesk.com/view/COORD/ENU/?contextId=MODEL_COORD_ABOUT
- Autodesk Revit Interference Checking: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Collaborate/files/GUID-890A9FE0-EFF4-4CFB-9E81-B0DE1A132BEC.htm
- Solibri Clash Detection Matrix: https://help.solibri.com/hc/en-us/articles/23765423193111-245-Clash-Detection-Matrix
- buildingSMART BCF: https://technical.buildingsmart.org/standards/bcf/?lang=en
- buildingSMART IDS: https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/
- buildingSMART IFC `Pset_WallCommon`: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcsharedbldgelements/pset/pset_wallcommon.htm
