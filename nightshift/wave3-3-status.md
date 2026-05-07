# Wave-3 Agent 3 — Status

**Branch:** `wave3-3` (rebased onto `origin/main` at `546a692d` and merged forward).

**Both assigned WPs landed on `main`.**

---

## EDT-04 — De-stub the 9 plan-canvas tools (`done`)

Replaced every `console.warn('stub: …')` in `packages/web/src/plan/PlanCanvas.tsx`
with a real `onSemanticCommand({ type, … })` call. The 9 tools now commit through
the bundle endpoint:

| Tool                  | Stub line (pre)  | Command emitted now             |
| --------------------- | ---------------- | ------------------------------- |
| Split Element (SD)    | 1849             | `splitWallAt`                   |
| Align (AL)            | 1831             | `alignElementToReference`       |
| Trim/Extend (TR)      | 1904             | `trimElementToReference`        |
| Wall Joins (Enter)    | 2214             | `setWallJoinVariant`            |
| Wall Opening          | 1592             | `createWallOpening`             |
| Place Column          | 2002             | `createColumn`                  |
| Place Beam            | 2011             | `createBeam`                    |
| Ceiling               | 2032             | `createCeiling`                 |
| Shaft                 | 1989             | `createSlabOpening` w/ `isShaft: true` |

The tracker line for EDT-04 had claimed `CreateColumn` / `CreateBeam` / `CreateCeiling`
already existed in the kernel. They didn't — so this WP also shipped:

- New element classes: `ColumnElem`, `BeamElem`, `CeilingElem` (mirror of the
  core/index.ts discriminated union, which already named them).
- Seven new commands: `splitWallAt`, `alignElementToReference`,
  `trimElementToReference`, `setWallJoinVariant`, `createColumn`, `createBeam`,
  `createCeiling`. Validation + dispatch wired in `engine.py`.
- `splitWallAt` migrates hosted doors / windows / wall_openings to whichever
  half they fall on, re-normalising their alongT against the new host span.
- `setWallJoinVariant` records the choice via a `JoinGeometryElem` whose
  `notes` field carries `variant=miter|butt|square`.
- `trimElementToReference` rejects parallel-walls cases (they have no
  intersection point, and a silent no-op would be confusing).

**Coverage:** `app/tests/test_edt04_engine_commands.py` (17 cases) +
`packages/web/src/plan/PlanCanvas.toolDestubs.test.ts` (13 cases).

---

## EDT-06 — Tool grammar polish (`done`)

Extends `packages/web/src/tools/toolGrammar.ts` with a per-tool capability
matrix and a numeric-input reducer:

- `ToolGrammarModifiers` + `defaultToolGrammarModifiers()` — the four flags
  exposed by the Options Bar (chain / multiple / tag-on-place /
  numeric-input-active).
- `TOOL_CAPABILITIES` — declares which toggles each tool advertises (door &
  window opt in to Multiple + Tag-on-Place; wall opts in to Chain + Tag +
  numeric input; beam opts in to numeric input only; etc.).
- `NumericInputState` reducer — `start` / `append` / `backspace` / `tab-axis`
  / `commit` / `cancel`. Supports the §16.4 "type a digit while drawing"
  flow plus Tab to switch axis.

New component: `packages/web/src/tools/OptionsBar.tsx` — Revit-style Options
Bar that mounts when a tool is active, exposes Chain / Multiple / Tag-on-Place
toggles, the wall location-line dropdown, and a numeric-input hint. The
component is purely presentational so the canvas / workspace owns the
modifier state.

The pre-existing `packages/web/src/workspace/OptionsBar.tsx` (a simpler
store-driven predecessor) is left in place for now; the new component lives
at the path the spec explicitly named (`packages/web/src/tools/OptionsBar.tsx`)
and is the one that absorbs the EDT-06 capabilities.

**Coverage (vitest):**
- `toolGrammar.modifiers.test.ts` — chain mode confirms a four-wall room
  takes four clicks (not eight); cancel breaks the chain; numeric reducer
  rules.
- `OptionsBar.test.tsx` — toggles dispatch the right `ToolGrammarModifiers`
  delta; the right toggles appear for wall vs door; wall location-line
  dropdown round-trips.
- `numericInput.test.tsx` — typing 5000 + Enter resolves a 5000 mm endpoint
  along the cursor direction; Tab swaps to perpendicular.

---

## Quality gates

| Gate                                                      | Result |
| --------------------------------------------------------- | ------ |
| `app/.venv pytest tests/ --no-cov`                        | 1387 passed, 7 skipped |
| `pnpm exec tsc --noEmit -p packages/web`                  | clean  |
| `pnpm exec vitest run` (packages/web)                     | 2030 passed, 4 pre-existing Playwright e2e collection failures (unrelated) |

The four vitest failures are all `e2e/*.spec.ts` files that import
`@playwright/test` and crash inside vitest because of the existing config
mismatch — present on `origin/main` before this WP and confirmed unaffected
by my changes.

---

## Commits (in order, on `main` after fast-forward)

1. `feat(EDT-04): kernel commands for plan-canvas Modify + create tools`
2. `feat(EDT-04): de-stub 9 plan-canvas tools`
3. `feat(EDT-06): tool grammar polish — modifiers + OptionsBar`
4. `docs(tracker): EDT-04 + EDT-06 → done`

Branch pushed as `wave3-3`; `main` fast-forwarded. Tracker entries for
EDT-04 and EDT-06 flipped from `open` to `done` with detailed state notes.

---

## Notes for downstream waves

- The Wall-Opening canvas tool currently commits with default sill 200 mm
  / head 2400 mm because plan rectangles don't carry vertical extent. A
  follow-up could expose those values in the Options Bar.
- The Ceiling tool falls through to a click-loop authoring slice (per the
  wave3-3.md spec note: ceiling propagation through the SKT-01 sketch
  session is owned by Agent 4).
- `JoinGeometryElem` carries the wall-join variant in its `notes`. If the
  mesh layer needs to read it, parsing `variant=…` from `notes` is the
  current convention; promoting it to a first-class field on the element
  is a small follow-up.
- The pre-existing `workspace/OptionsBar.tsx` and the new
  `tools/OptionsBar.tsx` co-exist. A consolidation pass could retire the
  former in favour of the prop-driven new one.
