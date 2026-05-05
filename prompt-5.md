# Prompt 5 - IFC Authoritative Import Preview And Unsupported Merge Map V1

## Mission

You are implementing remaining v1 closeout wave 2 of 4 for scoped Revit Production Parity v1.

Close the gap around IFC exchange by adding a deterministic IFC import preview and unsupported merge map that makes the current boundary explicit: authoritative replay may apply additive bundles with preflight, while arbitrary unconstrained IFC merge remains deferred. The goal is to give operators and tests a reliable readout of what would be applied safely, what cannot be applied, and why, without introducing destructive apply behavior or a broad IFC dependency expansion.

## Target Workpackages

- WP-X03 IFC export/import
- WP-X05 IDS validation
- WP-X01 JSON snapshot and command replay
- WP-V01 Validation/advisor expansion
- WP-A02 Evidence package API

## Scope

Add a deterministic IFC import preview and unsupported merge map for the existing IFC exchange path.

The preview/map should include:

- Candidate command counts by kind.
- Unresolved references.
- ID collision classes.
- Authoritative products versus unsupported products.
- IDS pointer coverage.
- Safe apply / not-apply classification.

Keep the implementation aligned with existing exchange, manifest, validation, replay, advisor, and evidence-package patterns in the repository. Prefer extending current schemas, manifest readouts, test fixtures, and API responses over creating a parallel import system.

Expected behavior:

- Authoritative IFC replay remains limited to additive bundles that pass preflight.
- Unsupported or ambiguous IFC products are surfaced deterministically with stable reason codes.
- Preview output is stable across repeated runs against the same input.
- Evidence package/export readouts include enough detail for offline inspection of preview status, unsupported merge classes, IDS pointer coverage, and apply safety.
- Validation/advisor surfaces actionable messages for unresolved references, ID collisions, unsupported products, missing IDS pointer coverage, and not-apply classifications.
- Command replay and JSON snapshot behavior remain compatible with existing additive replay semantics.

## Non-goals

- Do not implement arbitrary IFC merge.
- Do not add destructive apply behavior.
- Do not expand into a full IfcOpenShell dependency requirement.
- Do not weaken existing replay preflight checks.
- Do not replace the current IFC exchange manifest model with a new unrelated format.
- Do not open a pull request.

## Validation

Run focused backend validation unless readouts change enough to require additional targeted tests:

```bash
ruff check backend
pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py tests/test_constraints.py tests/test_undo_replay_constraint.py
```

No web validation is required unless readouts change in a way that affects frontend-visible behavior.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-5-ifc-import-preview-unsupported-map`.
- Commit your changes and push the branch.
- Do not open a pull request.
