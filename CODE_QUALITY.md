# Code Quality Tracker

Generated 2026-05-06. Updated after each workpackage.

## Status Overview

### Wave 1 — C grade baseline (all done)

| #   | Workpackage                                          | Status  | Commit   |
| --- | ---------------------------------------------------- | ------- | -------- |
| WP1 | Fix silent `.catch(() => {})` error swallowing       | ✅ done | c80cac94 |
| WP2 | Break down `Viewport.tsx` (3 079 → 1 431 lines)      | ✅ done | 3b190199 |
| WP3 | Break down `AgentReviewPane.tsx` (2 730 → 849 lines) | ✅ done | 7d0da943 |
| WP4 | Break down `SchedulePanel.tsx` (2 216 → 1 883 lines) | ✅ done | 19574b34 |
| WP5 | Add unit tests to untested web logic (65 new tests)  | ✅ done | 0af6467e |
| WP6 | Enable Vitest coverage thresholds                    | ✅ done | d25a2e1d |
| WP7 | Extract `symbology.ts` element builders (1 648 → 977)| ✅ done | 2cb9ba1f |
| WP8 | Extract `store.ts` types into `storeTypes.ts`        | ✅ done | 2cb9ba1f |
| WP9 | Fix `LegacyPlanTool` exhaustiveness gap              | ✅ done | 2cb9ba1f |

### Wave 2 — C → B (current)

| #    | Workpackage                                                    | Status     | Commit |
| ---- | -------------------------------------------------------------- | ---------- | ------ |
| WP-A | Tests for `evidenceArtifactParser.ts` (857 lines, 0% cov)     | ✅ done    | —      |
| WP-B | Tests for plan geometry helpers (`planElementMeshBuilders.ts`) | ✅ done    | —      |
| WP-C | Tests for `store.ts` actions (`hydrateFromSnapshot`, `applyDelta`) | ✅ done | —   |
| WP-D | Add `ErrorBoundary` wrapper around main app sections           | ✅ done    | —      |
| WP-E | Decompose `SchedulePanel.tsx` — extract `ScheduleDefinitionToolbar` | ⬜ todo | —  |
| WP-F | Decompose `RedesignedWorkspace.tsx` (1 862 lines)              | ⬜ todo    | —      |
| WP-G | Structured error-logging utility (replace raw console.error)   | ⬜ todo    | —      |
| WP-H | Raise coverage thresholds 50/70/70 → 65/75/75                  | ⬜ todo    | —      |

---

## Findings

### TypeScript & Linting (GOOD)

- `strict: true` across all packages, no `@ts-ignore` suppressions
- ESLint enforced with `max-warnings: 0` — TypeScript + React hooks rules active
- Zero `TODO`/`FIXME` comments in source

### Test Coverage (BAD)

- Only `@bim-ai/web` runs real Vitest tests
- `@bim-ai/core`, `@bim-ai/cli`, `@bim-ai/ui` have dummy test scripts (`node -e "process.exit(0)"`)
- Core geometry / family-catalog logic: **zero unit tests**
- No coverage thresholds configured

### Mega-Components (BAD)

| File                                                 | Lines |
| ---------------------------------------------------- | ----- |
| `packages/web/src/Viewport.tsx`                      | 3 079 |
| `packages/web/src/workspace/AgentReviewPane.tsx`     | 2 730 |
| `packages/web/src/schedules/SchedulePanel.tsx`       | 2 216 |
| `packages/web/src/workspace/RedesignedWorkspace.tsx` | 1 861 |
| `packages/web/src/plan/symbology.ts`                 | 1 648 |
| `packages/web/src/state/store.ts`                    | 1 563 |

### Silent Error Swallowing (BAD)

All four in `packages/web/src/workspace/RedesignedWorkspace.tsx`:

```
:489  fetchActivity().catch(() => {})           — inside loadSnapshot, activity side-load
:568  fetchActivity().catch(() => {})           — inside insertSeedHouse, activity side-load
:573  fetchComments().catch(() => {})           — inside insertSeedHouse, comments side-load
:618  fetchBuildingPresets().catch(() => {})    — useEffect bootstrap
```

Errors vanish with no log, making failures invisible in production and dev.

### Dependency Hygiene (MEDIUM)

- All versions use caret ranges (`^`) — no pins for critical libs
- Three.js `^0.179.1`, Zustand `^5.0.12` allow wide semver drift
- Acceptable for active development; worth revisiting before a release freeze

---

## Workpackage Details

### WP1 — Fix silent `.catch(() => {})` (EASY, HIGH IMPACT)

**Files:** `packages/web/src/workspace/RedesignedWorkspace.tsx`  
**Change:** Replace empty catch bodies with `console.error` calls, keeping the
fire-and-forget semantics (callers must not be blocked). Four instances.  
**Done when:** `grep '\.catch(() => {})' packages/**/*.tsx` returns nothing.

---

### WP2 — Break down `Viewport.tsx` (HARD)

**File:** `packages/web/src/Viewport.tsx` (3 079 lines)  
**Strategy:** Extract by logical concern — each extraction is its own commit:

- `viewport/materials.ts` — material/mesh helpers (already partly extracted)
- `viewport/sceneBuilder.ts` — mesh construction / family-model loading
- `viewport/cameraRig.ts` — camera + orbit controls (already partly extracted)
- `viewport/gizmos.ts` — axes, section-box overlays
- `viewport/useViewportEvents.ts` — pointer/keyboard event hooks
- `Viewport.tsx` itself becomes an orchestration shell < 300 lines  
  **Done when:** `Viewport.tsx` < 400 lines.

---

### WP3 — Break down `AgentReviewPane.tsx` (HARD)

**File:** `packages/web/src/workspace/AgentReviewPane.tsx` (2 730 lines)  
**Strategy:**

- `workspace/review/ReviewThread.tsx` — per-thread message rendering
- `workspace/review/ReviewToolbar.tsx` — action buttons / filter bar
- `workspace/review/useReviewStream.ts` — SSE / streaming hook
- `AgentReviewPane.tsx` becomes a layout shell  
  **Done when:** `AgentReviewPane.tsx` < 400 lines.

---

### WP4 — Break down `SchedulePanel.tsx` (MEDIUM)

**File:** `packages/web/src/schedules/SchedulePanel.tsx` (2 216 lines)  
**Strategy:** Extract table rendering, filter bar, and export logic into siblings.  
**Done when:** `SchedulePanel.tsx` < 400 lines.

---

### WP5 — Add unit tests to `@bim-ai/core` (MEDIUM)

**Package:** `packages/core`  
**Target modules:** geometry utilities, family catalog lookup, delta apply  
**Approach:** Vitest, no mocks — test pure functions directly.  
**Done when:** ≥ 80 % line coverage on `packages/core/src/*.ts`.

---

### WP6 — Enable Vitest coverage thresholds (EASY)

**Files:** `packages/web/vitest.config.ts` (and core once WP5 done)  
**Change:** Add `coverage: { thresholds: { lines: 70 } }` to prevent regressions.  
**Done when:** CI fails on coverage drop below threshold.

---

## Wave 2 Workpackage Details (C → B)

### WP-A — Tests for `evidenceArtifactParser.ts` (EASY, HIGH IMPACT)

**File:** `packages/web/src/workspace/review/evidenceArtifactParser.ts` (857 lines)  
**Why:** Pure parsing functions (`parseEvidenceArtifact`, `parseRoomCandidates`) with 0% coverage — highest ROI test target in the codebase.  
**Approach:** Vitest, fixture strings, no mocks.  
**Done when:** `evidenceArtifactParser.ts` ≥ 80% line coverage.

---

### WP-B — Tests for `planElementMeshBuilders.ts` (MEDIUM)

**File:** `packages/web/src/plan/planElementMeshBuilders.ts` (700 lines)  
**Why:** Geometry helper functions (`centroidMm`, `polygonAreaMm2`, stair riser count) are pure and untested.  
**Approach:** Test pure math helpers directly; skip Three.js mesh constructors (need DOM).  
**Done when:** Pure-function helpers ≥ 80% line coverage.

---

### WP-C — Tests for `store.ts` actions (MEDIUM)

**File:** `packages/web/src/state/store.ts`  
**Why:** `hydrateFromSnapshot` and `applyDelta` are the most critical data-path functions but have no tests.  
**Approach:** Create store instances with `create()`, call actions, assert state shape — no mocks needed.  
**Done when:** `hydrateFromSnapshot` and `applyDelta` covered with ≥ 5 tests each.

---

### WP-D — Add `ErrorBoundary` wrappers (EASY)

**File:** `packages/web/src/ErrorBoundary.tsx` (new)  
**Why:** Any uncaught render error currently crashes the entire app. An `ErrorBoundary` around major sections shows a fallback UI and logs to console instead.  
**Approach:** Minimal class component wrapping `Viewport`, `AgentReviewPane`, and `SchedulePanel`.  
**Done when:** Three boundaries placed; app renders fallback on child throw.

---

### WP-E — Decompose `SchedulePanel.tsx` (MEDIUM)

**File:** `packages/web/src/schedules/SchedulePanel.tsx` (1 883 lines)  
**Strategy:** Extract `renderScheduleDefinitionToolbar` (~350 lines) as `ScheduleDefinitionToolbar.tsx` sub-component; thread props explicitly.  
**Done when:** `SchedulePanel.tsx` < 1 200 lines.

---

### WP-F — Decompose `RedesignedWorkspace.tsx` (HARD)

**File:** `packages/web/src/workspace/RedesignedWorkspace.tsx` (1 862 lines)  
**Strategy:** Extract snapshot-load logic into `useWorkspaceSnapshot.ts` hook; extract sidebar layout into `WorkspaceSidebar.tsx`.  
**Done when:** `RedesignedWorkspace.tsx` < 1 000 lines.

---

### WP-G — Structured error-logging utility (EASY)

**Files:** New `packages/web/src/logger.ts`; update all `console.error` call sites.  
**Why:** Current `console.error` stubs added in WP1 have no context tagging — hard to filter in production logs.  
**Approach:** Thin wrapper `log.error(tag, message, ...args)` — one-line change per call site, easy to swap for a real logger later.  
**Done when:** All `console.error` in `RedesignedWorkspace.tsx` go through the logger.

---

### WP-H — Raise coverage thresholds (EASY, FINAL)

**File:** `packages/web/vitest.config.ts`  
**Change:** Bump `lines: 50 → 65`, `functions: 70 → 75`, `branches: 70 → 75` after WP-A through WP-C add coverage.  
**Done when:** Thresholds updated and `pnpm test --coverage` still passes.
