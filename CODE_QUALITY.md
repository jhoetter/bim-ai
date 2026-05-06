# Code Quality Tracker

Generated 2026-05-06. Updated after each workpackage.

## Status Overview

| # | Workpackage | Status | Commit |
|---|-------------|--------|--------|
| WP1 | Fix silent `.catch(() => {})` error swallowing | ⏳ pending | — |
| WP2 | Break down `Viewport.tsx` (3 079 lines) | ⏳ pending | — |
| WP3 | Break down `AgentReviewPane.tsx` (2 730 lines) | ⏳ pending | — |
| WP4 | Break down `SchedulePanel.tsx` (2 216 lines) | ⏳ pending | — |
| WP5 | Add unit tests to `@bim-ai/core` | ⏳ pending | — |
| WP6 | Enable Vitest coverage thresholds | ⏳ pending | — |

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
| File | Lines |
|------|-------|
| `packages/web/src/Viewport.tsx` | 3 079 |
| `packages/web/src/workspace/AgentReviewPane.tsx` | 2 730 |
| `packages/web/src/schedules/SchedulePanel.tsx` | 2 216 |
| `packages/web/src/workspace/RedesignedWorkspace.tsx` | 1 861 |
| `packages/web/src/plan/symbology.ts` | 1 648 |
| `packages/web/src/state/store.ts` | 1 563 |

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
