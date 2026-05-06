# Nightshift Agent 4 — Coordinate System, Project Templates, Worksharing Docs, 3D Text

You are **Agent 4** of seven parallel AI engineers. Your theme is **coordinate system anchoring, project templates, collaboration docs, and 3D text**. You own branch `nightshift-4`. The user is asleep. Do not stop until your assigned WPs are done — then keep going on Wave-0 work.

---

## 0. Pre-flight (identical across all agents)

### Repo

`/Users/jhoetter/repos/bim-ai`. Read `spec/workpackage-master-tracker.md` (~1370 lines) end-to-end before starting.

### Six other agents are working in parallel

Branches `nightshift-1`, `nightshift-2`, `nightshift-3`, `nightshift-5`, `nightshift-6`, `nightshift-7` are concurrent. Expect merge conflicts on `spec/workpackage-master-tracker.md` and `packages/core/src/index.ts`. Resolve and continue.

### Quality gates

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (in package(s) you touched)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main

Never `--no-verify`. Never delete failing tests. Fix root causes.

### Branch + merge protocol per WP

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin nightshift-4

git fetch origin
git rebase origin/main
git push origin nightshift-4 --force-with-lease

git checkout main
git pull origin main
git merge nightshift-4 --ff-only
git push origin main
# if push fails, pull + retry from "git checkout main"

git checkout nightshift-4
```

Never force-push to main. `--force-with-lease` only on your own branch. If `--ff-only` fails 5 times, document `merge-blocked` and continue.

### Tracker update protocol

After each WP lands on main: change row's `State` to `done`, add `done in <commit-hash>`. Commit separately as `chore(tracker): mark <WP-ID> done`. Push, rebase, ff-merge.

### Anti-laziness directive

**Done means:** code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`. Anything less is **not done**.

- After each WP, immediately start the next. No celebration, no summary, no pause.
- If a WP turns out larger, finish it. Don't punt.
- Bar for "I cannot finish" is high.
- After all assigned WPs ship, **do not stop**. Pick a Wave-0 WP, claim it (mark row `partial — in flight nightshift-4`), keep going.

### End-of-shift summary

Append `nightshift/nightshift-4-status.md` with shipped WPs (commits), blocked WPs, observations, total commits. Then stop.

---

## 1. Your assigned workpackages

Four WPs in this order (smallest first to build momentum).

### 1.1 — FED-05: Worksharing-via-DB positioning + docs

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 1 — Federation" → FED-05.

**Why it matters.** bim-ai is server-authoritative on every command commit, broadcast via websocket. That's strictly stronger than Revit's central-file model with periodic Synchronize. Worth being explicit so users and contributors understand the architecture.

**Concrete scope:**

1. Create `docs/collaboration-model.md` (or add to existing README — check first). Cover:
   - **Continuous server-authoritative commit** — every command is ordered by the server, broadcast via websocket; no client-side branch / merge concept
   - **Why "Synchronize with Central" is unnecessary** — there's no central file to sync; the server's commit log *is* the canonical state, and clients receive every commit immediately
   - **Conflict resolution** — happens at op apply time (constraints reject), not at sync time
   - **Per-user undo stacks** — already shipped; explain how they coexist with the shared model
   - **What's lost vs Revit central-file** — nothing material; a few rituals (Reload Latest, Synchronize Now) become no-ops since they're continuous

2. Add a marketing one-liner: *"BIM AI is the first BIM authoring environment with continuous server-authoritative collaboration; there is no central file to synchronize."* Place this in the README's intro paragraph.

3. Update CLI `--help` text for any collaboration-related commands (`bim-ai watch`, `bim-ai apply-bundle`, etc.) to reference the doc.

4. No code changes required, no tests.

**Acceptance.** A reader of `docs/collaboration-model.md` understands why bim-ai doesn't have central-file/Synchronize and can explain the difference to a Revit user.

**Files:** `docs/collaboration-model.md` (new), `README.md` (intro line), `packages/cli/cli.mjs` (help text).

**Estimated time:** 1 hour.

---

### 1.2 — FAM-06: 3D text element kind

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 4 — Family System Depth" → FAM-06.

**Why it matters.** Revit's 6-hour course (Hour 5) shows a "warehouse" project labelled with 3D model text. Real geometric 3D text (extruded letterforms) — distinct from text annotations — is used for warehouse labels, signage families, sculptural elements.

**Concrete scope:**

1. New element kind in `packages/core/src/index.ts`:

```ts
{
  kind: 'text_3d';
  id: string;
  text: string;
  fontFamily: 'helvetiker' | 'optimer' | 'gentilis';
  fontSizeMm: number;
  depthMm: number;
  positionMm: { xMm: number; yMm: number; zMm: number };
  rotationDeg: number;
  materialKey?: string | null;
}
```

Mirror in `app/bim_ai/elements.py`.

2. Add to `ElemKind` union and the `Element` discriminated union in `core/index.ts`.

3. Renderer: in `packages/web/src/viewport/meshBuilders.ts` (or a new `text3dGeometry.ts`), implement `makeText3dMesh(text3d, paint)` using Three.js `TextGeometry`:

```ts
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
```

Bundle three-stdlib font JSON files (`helvetiker_regular.typeface.json` etc.) under `packages/web/public/fonts/` and load them via `FontLoader`. Cache fonts after first load.

4. Wire into the incremental scene manager in `Viewport.tsx` so text_3d elements are added/removed/updated like other element kinds.

5. New command: `CreateText3d` in `app/bim_ai/commands.py` and engine.

6. Plan canvas: text_3d shows as a text-bounding-box outline in plan view, with the actual text label inside (using SVG text element or canvas fillText).

7. Tests:
   - vitest for `makeText3dMesh` verifying output is a valid Three.js Mesh
   - pytest for engine command

**Acceptance.**
- Authoring `kind: 'text_3d'` with `text: 'BIM AI', fontSizeMm: 200, depthMm: 50` produces visible 3D extruded letterforms in the viewport.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `packages/web/src/viewport/meshBuilders.ts` (or new file), `packages/web/src/Viewport.tsx` (scene manager wiring), `packages/web/public/fonts/` (font assets), plus tests.

**Estimated time:** 3 hours.

---

### 1.3 — KRN-06: Project base point + survey point + internal origin

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Kernel + element kinds" → KRN-06 + the **KRN-06 detail** block.

**Why it matters.** Today bim-ai has no explicit origin elements. Required for shared coordinates with linked CAD/IFC and for round-trip exchange. The 7-hour Revit course (Hour 1) demonstrates anchoring an imported DWG corner to the project base point — fundamental to file linking. After KRN-06 ships, the eventual FED-04 (IFC import) work can align linked content correctly.

**Concrete scope:**

1. Three element kinds in `packages/core/src/index.ts`:

```ts
{ kind: 'project_base_point'; id: string; positionMm: { xMm: number; yMm: number; zMm: number }; angleToTrueNorthDeg: number }
{ kind: 'survey_point'; id: string; positionMm: { xMm: number; yMm: number; zMm: number }; sharedElevationMm: number }
{ kind: 'internal_origin'; id: string }
```

A model has at most one of each; `internal_origin` is a singleton at modelling-space origin and never moves. `project_base_point` and `survey_point` can be moved without moving model geometry — they translate rendering / shared-coordinates output.

Mirror in `app/bim_ai/elements.py`.

2. New commands:
   - `CreateProjectBasePoint` (rejects if one already exists)
   - `MoveProjectBasePoint`
   - `CreateSurveyPoint` (rejects if one already exists)
   - `MoveSurveyPoint`
   - `RotateProjectBasePoint(angleDeg)`

`internal_origin` has no commands — it's auto-created on model init.

3. Engine: on model creation (or first snapshot read of a model that lacks it), auto-create the singleton `internal_origin` at `(0, 0, 0)`.

4. Renderer: in `Viewport.tsx`, render the three points as small distinct markers:
   - `internal_origin`: yellow XYZ axis triad
   - `project_base_point`: blue circled cross with "PBP" label
   - `survey_point`: green triangle with "SP" label

Markers are visible only when a new VV toggle "Site / Origin" is on (default off). Update `VVDialog.tsx` to add this toggle.

5. Plan canvas: same markers in plan; respects the same VV toggle.

6. Tests:
   - vitest for marker rendering presence/absence based on VV toggle
   - pytest for engine command validation (singleton enforcement, position update)

**Acceptance.**
- New models auto-have an `internal_origin` element.
- User can create a `project_base_point` at any position; only one allowed.
- VV toggle "Site / Origin" reveals markers in 3D and plan.

**Files:** `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`, `packages/web/src/Viewport.tsx`, `packages/web/src/workspace/VVDialog.tsx`, `packages/web/src/plan/planProjection.ts` (marker emission), plus tests.

**Estimated time:** 4-5 hours.

---

### 1.4 — VIE-06: Project templates (residential-eu first)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 5 — View Discipline" → VIE-06.

**Why it matters.** Today's `bim-ai init-model` creates a completely empty model. The 7-hour Revit course Hour 1 starts from a "Multi-discipline" template that has standard levels, grids, wall types, and view organisation pre-baked. A starter template removes minutes of setup per project and gives users a sensible default.

**Concrete scope:**

1. New directory `app/bim_ai/templates/`. Each template is a JSON snapshot file (same shape as `GET /api/models/:id/snapshot` output).

2. Author one template for v1: `residential-eu.json`:
   - Levels: `Ground Floor` at 0mm, `First Floor` at 3000mm, `Roof` at 6000mm
   - Default grid: 3 vertical lines (1, 2, 3) at 4000mm spacing × 3 horizontal lines (A, B, C) at 4000mm spacing
   - Wall types: at least `wall.ext-timber` and `wall.int-partition` from `BUILT_IN_WALL_TYPES` (already shipped via FL-08)
   - Default plan views: one per level
   - Default elevation views: depends on VIE-03 (Agent 5's queue). If VIE-03 hasn't shipped yet, omit elevations and add a TODO. If it has shipped, include four elevation_view markers.
   - Project base point at (0, 0, 0) (depends on KRN-06 — your own WP 1.3 above)
   - Internal origin auto-present (KRN-06 again)
   - Sample text_3d "Kerala House" at (0, -2000, 0) (FAM-06 — your WP 1.2)
   - All elements flagged `templateScaffold: true`

3. New CLI flag: `bim-ai init-model --template residential-eu`. In `packages/cli/cli.mjs`, add a `--template` arg to the `init-model` subcommand. The flag triggers a template-resolution path that reads `app/bim_ai/templates/<name>.json`, copies content into the new model (clearing template-only metadata), and applies the resulting commands.

4. New API endpoint: `GET /api/templates` returns `[{ id, name, description, thumbnailUrl? }]`. `POST /api/projects/:projectId/models` gains an optional `templateId` field.

5. UI: Home Screen "New Model" gains a template chooser dropdown listing `residential-eu` (and a "(empty)" default). Currently uncovered — find where `new model` UI is or add a stub.

6. Tests:
   - pytest for template resolution: load `residential-eu.json`, instantiate, verify expected element kinds present
   - vitest for CLI flag handling
   - vitest for the chooser UI (if you can locate it)

**Acceptance.**
- `bim-ai init-model --template residential-eu` produces a model with two levels, basic grid, wall types, and the listed scaffold elements.
- Created model is renderable (no broken references).

**Files:** `app/bim_ai/templates/residential-eu.json` (new), `app/bim_ai/template_loader.py` (new), `app/bim_ai/routes_*.py` (new endpoint), `packages/cli/cli.mjs`, possibly UI files (search for "init-model" or "new model" in `packages/web/src/`), plus tests.

**Estimated time:** 4 hours.

**Note on dependencies on your own WPs:** This template uses elements from KRN-06 (project base point) and FAM-06 (text_3d). Sequence: do FAM-06 (1.2) and KRN-06 (1.3) before VIE-06 (1.4) so the template can reference the new element kinds.

---

## 2. File ownership and conflict avoidance

You own:
- `docs/collaboration-model.md`
- `app/bim_ai/templates/` (new directory)
- `app/bim_ai/template_loader.py` (new)
- Origin marker rendering in `Viewport.tsx` and `planProjection.ts`
- 3D text geometry path
- Font assets in `packages/web/public/fonts/`

Shared territory (expect conflicts):
- `packages/core/src/index.ts` — append your element kinds (`text_3d`, `project_base_point`, `survey_point`, `internal_origin`); other agents are also extending this file
- `app/bim_ai/elements.py` — same
- `app/bim_ai/commands.py` — append your commands
- `app/bim_ai/engine.py` — engine wiring for new commands
- `packages/web/src/Viewport.tsx` — Agent 5 (views) and others may touch this; you only add origin markers + 3D text scene-manager wiring
- `packages/web/src/workspace/VVDialog.tsx` — append your "Site / Origin" toggle; don't reorder existing toggles
- `packages/cli/cli.mjs` — extend `init-model`; don't break existing commands
- `README.md` — Agent 6 may touch this for CLI help
- `spec/workpackage-master-tracker.md` — only your four rows

Avoid:
- `packages/web/src/viewport/meshBuilders.ts` for anything other than 3D text mesh (Agents 1-3 own that file)
- `packages/web/src/plan/PlanCanvas.tsx` (Agent 5)
- `packages/web/src/familyEditor/*` (Agent 7)

---

## 3. Go

Read `spec/workpackage-master-tracker.md` end-to-end. Then start WP 1.1 (FED-05 docs) for a quick warmup, move to FAM-06 (3D text), then KRN-06 (origins), then VIE-06 (templates) — sequenced so VIE-06 can reference the previous outputs. Do not pause until you reach "End-of-shift summary".
