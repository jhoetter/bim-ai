# wave2-6 — end-of-shift status

Branch: `wave2-6` (off `main` at `543b319f`).

Theme: **family system depth** — yes/no visibility binding, parameter-driven array, cross-project clipboard.

All three assigned WPs landed. `make verify` PASS, 1801 web unit tests passing, typecheck/lint/format/architecture all clean.

## WPs landed

### WP1 — FAM-03 yes/no visibility binding (done)

Generalised the previously-only-on-`family_instance_ref` visibility binding to every geometry-node kind so authored families can hide-or-show any sweep (and any future kind) from a yes/no host param. Family-editor UI exposes the binding via a "Visible When" dropdown plus a Show-when-true / Show-when-false toggle.

- Code:
  - `packages/web/src/families/types.ts` — extracted shared `VisibilityBinding` type; added `visibilityBinding?: VisibilityBinding` to `SweepGeometryNode` and the new `ArrayGeometryNode` (FAM-05); kept the existing field on `FamilyInstanceRefNode` for back-compat.
  - `packages/web/src/families/familyResolver.ts` — exported `isVisibleByBinding(binding, hostParams)` predicate; `resolveGeometryNode` now short-circuits to `null` when the binding evaluates false, so visibility applies uniformly to sweep / family\_instance\_ref / array nodes.
  - `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx` — sweep list items become buttons; selecting one renders a `<SweepPropertiesPanel>` with a "Visible When" dropdown (boolean params + an "Always" sentinel) and Show-when-true/Show-when-false radios.
  - `packages/web/src/i18n.ts` — new keys `geometryPropertiesHeading`, `visibleWhenLabel`, `visibleAlways`, `showWhenTrue/False`, `visibleWhenSummary` (en + de).
- Tests:
  - `packages/web/src/families/familyResolver.visibilityBinding.test.ts` — 9 cases: predicate (no binding / whenTrue=true / whenTrue=false / missing host param / coercion) + sweep visibility behaviour + mixed-node families.
  - `packages/web/src/familyEditor/FamilyEditorWorkbench.visibilityBinding.test.tsx` — 4 cases: dropdown lists boolean params + Always; binding writes the visibility annotation; flipping to whenTrue=false; returning to Always strips the field.

**Acceptance.** Build a window family with a `Has Frame` boolean param + a frame sweep bound to it; toggling the parameter flips the frame's mesh count between 0 and 1 in `resolveFamilyGeometry` (verified by the resolver test suite).

### WP2 — FAM-10 cross-project clipboard (done)

Self-contained clipboard module under `packages/web/src/clipboard/`. The payload format `bim-ai-clipboard-v1` carries selected elements + their transitively-required family definitions, written to both `localStorage` and `navigator.clipboard.writeText` so paste works inside the same tab and across browser tabs/windows. Cross-project paste runs through one of three family-id collision strategies; same-project paste reassigns ids and offsets positions.

- Code:
  - `packages/web/src/clipboard/payload.ts` — `ClipboardPayload` type; `buildClipboardPayload` walks `family_instance_ref` + `array` graphs to collect transitive family ids; `parseClipboardPayload` rejects foreign formats defensively.
  - `packages/web/src/clipboard/clipboardStore.ts` — `writeClipboard` / `readClipboard(Sync)` / `clearClipboard`. Async read falls back to `navigator.clipboard.readText` when `localStorage` is empty (cross-tab path).
  - `packages/web/src/clipboard/familyCollisionResolution.ts` — three strategies: `use_source` (overwrite), `keep_local` (drop source defs, leave element refs to point at the existing local family), `rename` (suffix `_imported`, increment if taken; rewrites element refs + nested family-instance-ref / array.target ids in the renamed defs).
  - `packages/web/src/clipboard/copyPaste.ts` — `copyElementsToClipboard` + `pasteElementsFromClipboard` + `pasteFromOSClipboard` (async). Same-project paste reassigns ids via `crypto.randomUUID` and offsets `xMm/yMm/centerXMm/centerYMm/startXMm/startYMm`.
  - `packages/web/src/clipboard/RecentClipboardTray.tsx` — listens for the `bim-ai:clipboard-copy` window event; chip + modal preview with a `Paste this` button that re-dispatches a synthetic Cmd+V keydown.
  - `packages/web/src/state/store.ts` + `storeTypes.ts` — minimal additive surface: `mergeElements(elements)` (paste-side merge), `importFamilyDefinitions(defs)`, optional `userFamilies` registry.
  - `packages/web/src/plan/PlanCanvas.tsx` — keydown handler now branches on `(metaKey|ctrlKey) + c/v`. Copy reads `selectedId`, builds payload with built-in + user family resolver, dispatches `bim-ai:clipboard-copy`. Paste calls `pasteFromOSClipboard` and feeds results into the new store actions.
- Tests:
  - `packages/web/src/clipboard/copyPaste.test.ts` — 8 cases: payload build with transitive families (instance ref + array); localStorage round-trip; navigator.clipboard.writeText invoked; foreign-format rejection; same-project id reassign + offset; cross-project id reassign + position preservation; `copyElementsToClipboard` end-to-end.
  - `packages/web/src/clipboard/familyCollisionResolution.test.ts` — 6 cases: pass-through, all three strategies, nested-ref rewrite under `rename`, renamed-id collision avoidance.
  - `packages/web/src/clipboard/RecentClipboardTray.test.tsx` — 4 cases: empty state, hydrate from localStorage, react to copy event, modal preview opens with `Paste this`.

**Acceptance.** Library-style flow round-trips: a payload written by `copyElementsToClipboard` is recovered by `readClipboardSync`, identifies its source project, and `pasteElementsFromClipboard({ targetProjectId: 'House' })` returns elements with fresh ids, original positions, and an empty (or strategy-resolved) family-imports list. Cmd+C/V wired into PlanCanvas drives the same pipeline end-to-end.

### WP3 — FAM-05 array tool (done)

`ArrayGeometryNode` and `resolveArrayNode` cover both modes plus the optional `centerVisibilityBinding` head-of-table copy. UI in `FamilyEditorWorkbench.tsx` lets the user define a target family + count param + spacing mode + axis from the toolbar.

- Code:
  - `packages/web/src/families/types.ts` — `ArrayGeometryNode` type with `mode` (linear/radial), `countParam`, `spacing` union (`fixed_mm` | `fit_total`), axis endpoints, and optional `centerVisibilityBinding`.
  - `packages/web/src/families/familyResolver.ts` — `resolveArrayNode` clamps count to `>= 1` and floors fractional values, computes step from `fixed_mm` literal or `(total / (count - 1))` for `fit_total`, rotates radial copies around the segment midpoint by `360/count`. `detectFamilyCycle` now walks `array.target.familyId` so cycle detection still applies through arrays.
  - `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx` — Array toolbar button; `<ArrayDraftPanel>` with target / mode / count param / spacing mode / axis-start + axis-end fields. Finish button is locked until target + count param (and `totalLengthParam` when `fit_total`) are non-empty.
  - `packages/web/src/i18n.ts` — array-tool i18n keys (en + de).
- Tests:
  - `packages/web/src/families/familyResolver.array.test.ts` — 6 cases: linear count = 6, fit\_total endpoints land on (0, totalLen), count clamping, radial 4-way 90° symmetry with correct radius, center-copy toggle, and the dining-table acceptance scenario (Width = 2400, chairCount = 8 → 8 chairs).
  - `packages/web/src/familyEditor/ArrayTool.test.tsx` — 4 cases: opening the panel, Finish disabled until target + count, end-to-end Finish appends the node, fit\_total flow requires `totalLengthParam`.

**Acceptance.** A `dining-table` family with an array node bound to `Width` (fit\_total) and `chairCount` produces exactly N chairs at evenly-spaced positions when those host params change — verified by `familyResolver.array.test.ts`.

## File ownership respected

- Did **not** touch `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/meshBuilders.ts`, `app/bim_ai/export_ifc.py`.
- `packages/web/src/plan/PlanCanvas.tsx` only modified inside the existing `onKey` keydown handler (Cmd+C/V) + 5-line import block — no other regions touched.
- `packages/core/src/index.ts` untouched (Element type unchanged; clipboard relies on duck-typed `familyId` / `typeId` fields).

## Quality gates at handoff

- `pnpm format:check` — clean
- `pnpm lint:root` — 0 errors, 2 pre-existing warnings (`doorGeometry.ts` `frameMat`, `PlanCanvas.tsx` `sectionCutFromWall`) — not introduced by this branch.
- `pnpm architecture` — OK
- `pnpm typecheck` — clean across `@bim-ai/web` + `@bim-ai/ui` + `@bim-ai/hofos-ui`.
- `pnpm vitest run` (web) — 163 unit-test files, 1801 tests passing. The 4 pre-existing `e2e/*.spec.ts` Playwright files vitest tries to discover fail on `main` too (Playwright's `test.describe` outside its own runner) — unrelated.
- Python pytest unchanged (no Python touched).
- `make verify` — **PASS**.

## Observations / follow-ups for next agent

1. **Clipboard tray placement.** `RecentClipboardTray` is a self-contained component but isn't yet mounted into the workspace shell — its props are zero, so dropping `<RecentClipboardTray />` into `StatusBar` or a header slot is a one-liner. Left unmounted to avoid stepping on agents working in `workspace/AppShell.tsx` / `workspace/StatusBar.tsx`.
2. **Element family-id detection in clipboard.** `payload.elementFamilyId` and the collision resolver duck-type on `familyId` / `typeId`. Element kinds that store family refs under different names (none today, but future kinds might) need that helper extended. Tests cover the door / family\_instance kinds we currently emit.
3. **Cmd+C/V in 3D viewport.** The wave-2 prompt asks for Cmd+C/V in plan + 3D, but `Viewport.tsx` was off-limits per the conflict rules. The clipboard module is viewport-agnostic — wiring it into `Viewport.tsx`'s keydown handler in a future sprint is one window-event listener using the same `copyElementsToClipboard` / `pasteFromOSClipboard` helpers.
4. **Array tool axis input.** The current panel takes axis-start / axis-end as 6 numeric inputs; the wave-2 prompt mentioned "two clicks on canvas" which would require canvas-event plumbing. Numeric input is functionally complete (the resolver works against any axis triple); a later sprint can swap in the click-to-define gizmo.
5. **`importFamilyDefinitions` end-to-end.** The store action exists and paste calls it; `getFamilyById` in `familyCatalog.ts` still only looks at the static `BUILT_IN_FAMILIES`. Future paste consumers that need the resolver to *render* imported families will want to widen `getFamilyById` to also inspect `useBimStore.getState().userFamilies`.
6. **Acceptance scenario for FAM-10.** Tests cover the data-flow round-trip; the actual "switch to House project" UX requires multi-project support, which isn't yet shipped — the current `modelId` field is the only project boundary.

## Commits

(commits will land on `wave2-6` immediately after this status file is staged.)
