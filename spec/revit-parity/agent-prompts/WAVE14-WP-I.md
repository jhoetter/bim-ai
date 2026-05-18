# Wave 14 — WP-I: Complete Keyboard Shortcut Cheatsheet (§Appendix A)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/cmd/cheatsheetData.ts          — cheatsheet section/entry definitions
packages/web/src/cmd/CheatsheetModal.test.tsx   — existing cheatsheet tests
packages/web/src/tools/toolRegistry.ts          — all tool IDs and their hotkeys
packages/web/src/i18n.ts                        — i18n key mappings (optional — read first)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**No shared-file rule** for this WP — `cheatsheetData.ts` is not in the shared-file list.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `cheatsheetData.ts` — read the entire file. Note current tool section only lists: W (wall), D (door), Shift+W (window), F (floor), R (roof), S (stair), Shift+R (railing), M (room), Shift+D (dimension), Shift+S (section), T (tag). Many tools are missing.
- `toolRegistry.ts` — read ALL registered tools and their hotkeys. Extract every `hotkey` field. This is the authoritative source of all tool hotkeys.
- `i18n.ts` — check if `cheatsheet.actions.*` keys are defined there. If so, you MUST add matching i18n keys for each new entry. If the file uses a flat object pattern without a translation framework, just add string entries directly.
- `CheatsheetModal.test.tsx` — read the tests. Do not break them.

---

## Tasks

### A — Extract all tool hotkeys from toolRegistry.ts

Read `toolRegistry.ts` and collect every `{ id, hotkey, label }` triple. The ones currently missing from the cheatsheet include (but may not be limited to):

Tools that are missing from the current cheatsheet tools section:

- Column: CL or similar
- Beam: BM or similar
- Grid: GR
- Reference Plane: RP
- Dimension (aligned): DI or Shift+D
- Text Note: TX
- Leader Text: LT
- Measure: ME
- Measure Angle: MA
- Spot Elevation: SE
- Model Line: ML
- Array: AR
- Mirror: MI
- Rotate: RO
- Move: MV
- Copy: CO
- Align: AL
- Offset: OFS
- Trim: TR
- Scale: SC
- Paint: PT
- Column at Grids: CAG
- Ramp: RA
- Brace: BR
- Mass Box: MB
- Terrain: TP
- Elevation: EL
- Section: SS or Shift+S
- Room Separation: RS
- Tag: T

Read the registry to get the exact hotkeys. Do not guess — use only what `toolRegistry.ts` defines.

### B — Expand the cheatsheet

In `cheatsheetData.ts`, expand the `'tools'` section to include ALL tools from the registry (sorted alphabetically by action name). Replace the current sparse list with the complete list.

Add a new section `'modify'`:

```ts
{
  id: 'modify',
  label: t('cheatsheet.sections.modify'),
  entries: [
    { action: t('cheatsheet.actions.toolMove'), keys: 'MV' },
    { action: t('cheatsheet.actions.toolCopy'), keys: 'CO' },
    { action: t('cheatsheet.actions.toolRotate'), keys: 'RO' },
    { action: t('cheatsheet.actions.toolMirror'), keys: 'MI' },
    { action: t('cheatsheet.actions.toolArray'), keys: 'AR' },
    { action: t('cheatsheet.actions.toolScale'), keys: 'SC' },
    { action: t('cheatsheet.actions.toolAlign'), keys: 'AL' },
    { action: t('cheatsheet.actions.toolTrim'), keys: 'TR' },
    { action: t('cheatsheet.actions.toolOffset'), keys: 'OFS' },
    { action: t('cheatsheet.actions.toolSplit'), keys: 'SL or SP' },
    { action: t('cheatsheet.actions.toolDelete'), keys: 'Del / Backspace' },
  ],
}
```

Add a new section `'annotate'`:

```ts
{
  id: 'annotate',
  label: t('cheatsheet.sections.annotate'),
  entries: [
    { action: t('cheatsheet.actions.toolDimension'), keys: 'DI' },
    { action: t('cheatsheet.actions.toolAngularDim'), keys: 'AD' },
    { action: t('cheatsheet.actions.toolRadialDim'), keys: 'RD' },
    { action: t('cheatsheet.actions.toolSpotElevation'), keys: 'SE' },
    { action: t('cheatsheet.actions.toolTextNote'), keys: 'TX' },
    { action: t('cheatsheet.actions.toolLeaderText'), keys: 'LT' },
    { action: t('cheatsheet.actions.toolTag'), keys: 'T' },
    { action: t('cheatsheet.actions.toolMeasure'), keys: 'ME' },
    { action: t('cheatsheet.actions.toolMeasureAngle'), keys: 'MA' },
  ],
}
```

### C — i18n keys

In `i18n.ts` (or whichever file defines the `cheatsheet.actions.*` and `cheatsheet.sections.*` keys), add ALL new keys used in step B. Follow the exact pattern of the existing keys.

If the translation file uses a nested object structure, add the keys at the correct nesting level. If it uses flat dot-notation strings, add them at the root.

**Important**: The function signature is `getCheatsheetData(t: TFunction)`. Every string passed to `t()` must have a corresponding key in the i18n file or the tests will fail.

### D — Tests

`packages/web/src/cmd/cheatsheetData.test.ts` (add to existing tests or create if absent):

```ts
describe('cheatsheet data — §Appendix A', () => {
  it('tools section has more than 15 entries', () => { ... }); // was ~9
  it('modify section exists and has move/copy/rotate entries', () => { ... });
  it('annotate section exists and has dimension/text/tag entries', () => { ... });
  it('no duplicate action labels in any section', () => { ... });
  it('all t() keys resolve without error (mock TFunction that returns key)', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave14/I): complete keyboard shortcut cheatsheet — modify + annotate sections (§Appendix A)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
