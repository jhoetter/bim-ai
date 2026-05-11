# Designer's Bill of Rights

Last updated: 2026-05-11

This document is the customer-facing commitment behind bim-ai v3. It is written for architects and project teams, not for procurement theatre. It references the v3 locked decisions and OpenBIM stance in `spec/workpackage-tracker-v3.md`: bim-ai v3 is deterministic, agent-callable, exportable, and explicit about assumptions.

## 1. Your work is not training data

Your designs, prompts, sketches, uploads, markups, comments, and authored model content are never used to train any AI model, ours or any third party's. If an external model integration is added later, it must pass through the no-training boundary that records `trainOnInputFlag=false` for every call.

## 2. Your model is portable

You can export your model data through open exchange paths, including IFC and BCF where the product surface supports them. We do not make portability a cancellation workflow or an enterprise-only privilege.

## 3. Your activity stream is an audit trail

The activity stream belongs to the project record. It is not silently rewritten to hide failed operations, deleted public links, rejected assumptions, or authoring history.

## 4. Agent actions must state assumptions first

Any AI agent using bim-ai's deterministic tool surface must log assumptions before applying changes. The kernel rejects command bundles that skip this discipline.

## 5. Public links are revocable

You can revoke any public link instantly. Review access should not depend on stale PDF chains, uncontrolled email forwarding, or hidden copies.

## 6. Brand settings never corrupt drafting semantics

Client branding can change presentation tone, but it must not rewrite drafting palette, line weights, hatch semantics, discipline color, or motion language.

## 7. Your data is protected in transit and at rest

Project data must be handled with ordinary professional care: encrypted in transit, protected at rest, and scoped to the people and systems that need it to deliver the service.

## 8. No proprietary lock-in

bim-ai does not use proprietary format lock-in as a retention strategy. The product should compete on speed, clarity, and collaboration quality, not hostage data.

## 9. You can leave with your data

If you leave, you can take your project data with you. The right to exit is part of the product promise, not an exception path.
