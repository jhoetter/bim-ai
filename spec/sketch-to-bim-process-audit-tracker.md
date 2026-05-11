# Sketch-to-BIM Process Audit Tracker

Last updated: 2026-05-11.

## Why This Tracker Exists

The target-house seed can be packaged and loaded, but a running UI still showed
Advisor warnings such as `door_operation_clearance_conflict`. That means the
methodology is directionally right but the acceptance loop is not yet strict
enough to prevent stale or partial seed evidence from being treated as final.

This tracker audits both:

- the written agent methodology in `claude-skills/sketch-to-bim/SKILL.md`;
- the actual seed-generation mechanism used to create portable artifacts under
  `seed-artifacts/<name>/`.

## Executive Verdict

The methodology describes the right loop: phased modelling, live app inspection,
Advisor warnings as hard evidence, screenshot checkpoints, and packaging a
self-contained artifact. The gap is enforcement. A seed author can still produce
a plausible artifact without proving, at the current app HEAD, that each phase
passed live Advisor and visual gates.

This tracker is also the durable home for the "skill plus tools" plan. The
`watch-yt` skill is the right reference shape: prose explains when and why to
use the workflow, while a small skill-local executable performs the hard part
that the language model cannot reliably do unaided. For sketch-to-BIM, that
means the agent needs a tool surface for compile, seed, live app health,
Advisor capture, screenshot/evidence capture, and stale-evidence detection.

Current scores:

| Area | Score | Rationale |
| --- | ---: | --- |
| Written methodology / skill | 8.0 / 10 | It says the right things: phase gates, live app, Advisor, screenshots, no fake room closure, no metadata-only roof openings. It still needs stronger language around current-HEAD evidence invalidation and required interior assets for project-initiation seeds. |
| Executable tooling | 7.0 / 10 | `initiation-check`, `initiation-run`, visual gates, capability matrix, and seed DSL exist. Packaging does not yet force a fresh live run, `--fail-on-warning`, target-image comparison, or phase-by-phase packets. |
| Current artifact mechanism | 7.0 / 10 | Named artifacts are portable and reproducible. The current recipe is reviewable, but it lost some older interior asset richness and can drift when new Advisor rules are added after evidence capture. |
| Target-house artifact fidelity | 6.5 / 10 | Major shell/loggia/roof-court ideas are present, but interior assets are thin, materials are mostly key-level intent, and current UI warnings show acceptance is not stable enough. |
| Overall process maturity | 7.2 / 10 | Good architecture, insufficient hard gates. The next step is to turn "the agent should" into required CLI/CI and artifact checks. |

## Historical Findings

Relevant commits from 2026-05-10 and 2026-05-11:

| Commit | Finding |
| --- | --- |
| `508c3de1c feat(seed): add target house interior programme` | The previous hard-coded seed path indexed and placed sofas, tables, kitchen runs, beds, wardrobes, bathroom fixtures, and terrace furniture. This is richer than the current clean recipe. |
| `876edcf5a fix(seed): make interior assets visible in plans` | The old mechanism also fixed plan visibility for placed assets, showing that interior assets were intended to be part of the seed, not optional decoration. |
| `d41b7fbe5 fix(web): hydrate placed assets from snapshots` | The app learned to hydrate placed assets from snapshots, so the software supports richer seeds when the bundle authors them. |
| `00cf6583b Improve sketch-to-BIM seed refinement loop` | The older workflow emphasized checkpoint rendering and Advisor feedback against a canonical bundle, but was still tied to `packages/cli/lib/one-family-home-commands.mjs`. |
| `2d12c7985 Improve sketch-to-BIM seedhouse workflow` | Added phase evidence and diagnostics in `nightshift`, demonstrating the intended iterative loop. |
| `6b1e2a558 Rebuild target house seed from image spec` | Rebuilt the target house from image-specific cues, but still used the old hard-coded command source. |
| `d7695ee79 Rebuild target house seed from methodology` | Added methodology evidence packets and live screenshots, but still before the final clean artifact packaging. |
| `9ca4dec3a Version target house seed artifact` | Introduced the named artifact package under `seed-artifacts/target-house-1`. |
| `f0c44d51c seeding process` | Moved the current seed into a reviewable artifact recipe with evidence. Good for portability, but not yet enough to prove no later Advisor rule drift. |

Conclusion: the old mechanism had more interior programme and assets, but a poor
source boundary. The new mechanism has a better artifact boundary, but must
recover the old richness and make live validation mandatory.

## Tool-Enabled Skill Architecture

The target architecture is:

```text
claude-skills/sketch-to-bim/SKILL.md
  -> written architect workflow and acceptance policy
claude-skills/sketch-to-bim/sketch_bim.py
  -> skill-local operational wrapper, like watch-yt/watch_yt.py
packages/cli/cli.mjs
  -> authoritative BIM operations and evidence generation
make dev / API / web UI
  -> the same runtime and Advisor panel the user sees
seed-artifacts/<name>/evidence/
  -> phase packets, final live evidence, and stale-evidence metadata
```

Implemented in this pass:

```bash
python3 claude-skills/sketch-to-bim/sketch_bim.py doctor --require-live
python3 claude-skills/sketch-to-bim/sketch_bim.py compile --seed <seed-name>
python3 claude-skills/sketch-to-bim/sketch_bim.py seed --seed <seed-name> --clear
python3 claude-skills/sketch-to-bim/sketch_bim.py advisor --model <model-id> --out <dir> --fail-on-warning
python3 claude-skills/sketch-to-bim/sketch_bim.py accept --seed <seed-name> --clear
python3 claude-skills/sketch-to-bim/sketch_bim.py stale-check --seed <seed-name>
```

The helper writes machine-readable summaries and delegates to existing
authoritative commands. It gives the AI a repeatable route to the running app
instead of relying on ad hoc shell snippets.

For a 10/10 setup, this wrapper should eventually become an MCP/tool-server
surface as well, so the agent can call typed operations directly:

| Tool | Purpose | Minimum output |
| --- | --- | --- |
| `skb_doctor` | Verify API, web, capability matrix, current model, and CLI build ref. | JSON status with blocking missing prerequisites. |
| `skb_compile_recipe` | Compile `seed-dsl.v0` or successor recipe to command bundle. | Bundle path, command count, hash, validation errors. |
| `skb_seed_model` | Clear/load a seed artifact and return its deterministic model id. | `modelId`, revision, artifact hash. |
| `skb_capture_advisor` | Capture warning and info Advisor groups for the live model. | Rule ids, severity totals, affected element ids, right-rail parity flag. |
| `skb_capture_views` | Capture required saved/generated checkpoint views. | Screenshot manifest, nonblank checks, viewport metadata. |
| `skb_compare_visuals` | Compare screenshots to target maps and semantic checklist. | Pixel/edge score plus AI/human semantic verdict slots. |
| `skb_accept_phase` | Produce a phase packet and fail on blockers. | Phase status, corrections, unresolved tolerances. |
| `skb_accept_final` | Run strict current-HEAD acceptance before packaging. | Final evidence packet, git/app/build/rule digests. |
| `skb_stale_check` | Refuse old evidence after command, renderer, or Advisor drift. | Drift report and exact rerun command. |

The current Python helper covers the first, second, third, fourth, eighth, and
ninth rows at CLI-wrapper level. The missing 10/10 pieces are typed tool
registration, browser/right-rail parity capture, semantic visual comparison,
and phase packet enforcement.

## Required Seed Authoring Loop

For project-initiation BIM, an AI architect must run the software while creating
the seed data:

```text
read source folder
  -> visual read + IR + assumptions
  -> phase N recipe/bundle edit
  -> compile
  -> make seed name=<seed-name>
  -> make dev or reuse running API/Web
  -> CLI Advisor warning pass
  -> UI Advisor/right-rail inspection
  -> checkpoint screenshots
  -> visual readout by the agent
  -> fix bundle source
  -> repeat
  -> package only after final current-HEAD pass
```

Required final command shape:

```bash
make seed-clear
make seed name=<seed-name>
BIM_AI_MODEL_ID=<id> node packages/cli/cli.mjs initiation-run \
  --ir seed-artifacts/<seed-name>/evidence/sketch-ir.json \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --model <id> \
  --mode project_initiation_bim \
  --fail-on-warning \
  --fail-on-acceptance \
  --out seed-artifacts/<seed-name>/evidence/live-run-current
```

If a target comparison map exists, add:

```bash
  --target-map seed-artifacts/<seed-name>/evidence/target-map.json \
  --fail-on-visual
```

The artifact is not accepted if the UI or CLI Advisor shows warnings at current
HEAD, even when older checked-in evidence says `advisorWarningCount: 0`.

## Process Gaps

| ID | Status | Priority | Gap | Acceptance |
| --- | --- | --- | --- | --- |
| SKB-AUD-001 | open | P0 | Current-HEAD live Advisor is not a hard packaging gate. | `scripts/create-seed-artifact.mjs` or a companion verifier refuses final packaging unless a fresh `initiation-run --fail-on-warning --fail-on-acceptance` passed at the current git commit. |
| SKB-AUD-002 | open | P0 | Stale evidence is not invalidated when Advisor rules change. | Artifact evidence records git commit, app build ref, Advisor rule digest, command bundle hash, and generatedAt. Loader/UI flags evidence as stale when any of these drift. |
| SKB-AUD-003 | open | P0 | Door operation clearance is not explicitly listed as a sketch-initiation blocker. | `door_operation_clearance_conflict` is in the sketch-to-BIM blocking class list and final seed acceptance fails on it. |
| SKB-AUD-004 | open | P0 | Phase gates are written but not required as files. | Artifact must include per-phase packets: massing, skeleton, envelope/openings, interior, materials/detail, documentation. Each packet has screenshots, Advisor result, corrections, and residual risk. |
| SKB-AUD-005 | open | P0 | Interior assets regressed from the May 10 seed path. | Project-initiation seeds include indexed and placed assets for living, dining, kitchen, bathrooms, bedrooms, stair/landing, and terrace when those spaces exist in the brief. |
| SKB-AUD-006 | open | P1 | Seed DSL lacks first-class interior/material/detail primitives. | DSL supports `assets`, `placedAssets`, `materialIntent`, `openingTypes`, `loggia`, `foldedWrapper`, and `documentation` without large raw-command blocks. |
| SKB-AUD-007 | open | P1 | Visual gate can pass with only nonblank screenshots and no semantic comparison. | Target-house artifact includes a target-image map or checklist that requires human/AI semantic verdicts for roof cutout, loggia depth, material zones, and interior usability. |
| SKB-AUD-008 | open | P1 | Materials are not scored as first-class acceptance criteria. | Material intent is explicit in IR and recipe; final evidence proves white wrapper, vertical cladding, glass, black rails, and terrace floor materials are assigned and visible. |
| SKB-AUD-009 | open | P1 | Advisor findings are not forced back into the source recipe. | Evidence includes an issue ledger mapping each warning/info finding to a source edit, accepted tolerance, or software-rule defect. |
| SKB-AUD-010 | open | P1 | UI Advisor and CLI Advisor can diverge unnoticed. | Final evidence includes both CLI JSON and a browser screenshot/right-rail capture or an API endpoint proving the same groups shown in UI. |
| SKB-AUD-011 | open | P2 | No reusable archetype baseline for common house types. | Seed authoring can start from a versioned archetype when it matches >=70%, then documents deltas from the user sketch. |
| SKB-AUD-012 | open | P2 | No live CI baseline for shipped seed artifacts. | CI can load each checked-in seed artifact, run current Advisor, capture screenshots headlessly, and fail on warnings/errors. |
| SKB-AUD-013 | done | P0 | The skill lacked a `watch-yt`-style executable helper. | `claude-skills/sketch-to-bim/sketch_bim.py` provides `doctor`, `compile`, `seed`, `advisor`, `accept`, and `stale-check`. |
| SKB-AUD-014 | open | P0 | Phase packet creation is still mostly documented, not tool-enforced. | Add `sketch_bim.py phase-accept --phase <id>` or equivalent MCP tool that requires screenshot/advisor/readout/tolerance files before advancement. |
| SKB-AUD-015 | open | P1 | Browser right-rail Advisor parity is not automatically captured. | Tool captures the UI Advisor panel or calls an API that exactly mirrors it, then diffs against CLI Advisor groups. |
| SKB-AUD-016 | open | P1 | Skill tools are CLI wrappers, not typed agent tools. | Expose the sketch-to-BIM operations as MCP/tool descriptors with typed arguments and JSON-only outputs. |
| SKB-AUD-017 | open | P1 | Semantic visual review is still dependent on the agent manually reading screenshots. | Tool emits a semantic checklist per required view and stores the agent verdict next to the screenshot manifest. |
| SKB-AUD-018 | open | P2 | No automatic source-patch trace from Advisor element ids back to recipe sections. | Tool maps blocking `elementIds` to recipe source paths/sections and requires a correction note before rerun. |

## Acceptance Policy

For any seed intended as project-initiation BIM:

- `warning` or `error` Advisor findings block acceptance unless the user
  explicitly accepts a tolerance in the artifact.
- `door_operation_clearance_conflict` is blocking.
- Rooms must be enclosed, accessible, and supported by doors or clear open
  thresholds.
- Interior programme assets are required when the brief includes rooms that
  need semantic use: kitchen, living, dining, bedrooms, bathrooms, terrace.
- Materials must be chosen from the catalog and must support the visual read.
- Screenshots must be captured from the running app, not only generated from an
  offline snapshot.
- Evidence must be current for the app build that users will run.

## Current Target-House Assessment

The current clean artifact is better than the old hard-coded source boundary,
but it is not yet the desired final quality bar:

- It is portable and reviewable.
- It has a valid IR, recipe, bundle, source copy, and evidence folder.
- It has less interior richness than `508c3de1c`.
- It does not yet prove final cleanliness against every Advisor rule in the
  user's running UI, as shown by `door_operation_clearance_conflict`.
- Its visual gate still needs semantic target comparison, not just nonblank
  screenshot checks.

Recommended next work package: restore interior assets into the artifact recipe,
resolve current door-clearance warnings, then add SKB-AUD-001/002 so this class
of stale clean-evidence failure cannot recur.
