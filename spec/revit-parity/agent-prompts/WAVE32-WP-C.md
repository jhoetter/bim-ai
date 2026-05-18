# Wave 32 — WP-C: Ribbon Steel / Precast / Massing-Site Tab Content (§1.6.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.5 "Multifunktionsleiste" is Partial P1. bim-ai has a full `RibbonBar.tsx` at `packages/web/src/workspace/shell/RibbonBar.tsx` with all the Revit tab IDs defined. The architecture, structure, annotate, view, manage, and modify tabs are populated. However the following tabs are defined as type IDs but have **no content built into any ribbon builder function**:

- `steel` — no steel tools in any tab definition
- `precast` — no precast content
- `massing-site` — no massing/site content

This task adds content to these sparse tabs so they appear in the ribbon with appropriate tools.

---

## Repo orientation

```
packages/web/src/workspace/shell/RibbonBar.tsx   — the main file to edit
```

Run before editing:

- `grep -n "function build.*Ribbon\|function build.*Tabs\|buildPlanRibbonTabs\|build3dRibbonTabs" packages/web/src/workspace/shell/RibbonBar.tsx | head -15`
- `grep -n "id: 'steel'\|id: 'precast'\|id: 'massing\|id: 'structure'" packages/web/src/workspace/shell/RibbonBar.tsx | head -10`
- `grep -n "'steel-connection'\|'beam'\|'column'\|'brace'\|steel.*tool" packages/web/src/tools/toolRegistry.ts | head -15`

Read the file to find where plan ribbon tabs are built (likely `buildPlanRibbonTabs`). Find where `structure` tab is defined as a pattern. Add `steel`, `precast`, and `massing-site` tabs in the same function, right after the structure tab.

---

## Tasks

### A — Steel tab content

In the plan ribbon tab builder (whichever function builds tabs for plan view mode), find where the `structure` tab is defined. After it, add a `steel` tab:

```ts
{
  id: 'steel' as RibbonTabId,
  label: 'Steel',
  panels: [
    {
      id: 'steel-connections',
      label: 'Connections',
      commands: [
        tool('steel-connection' as ToolId, 'Connection', 'beam'),
        tool('beam' as ToolId, 'Steel Beam', 'beam'),
        tool('column' as ToolId, 'Steel Column', 'column'),
      ],
    },
    {
      id: 'steel-framing',
      label: 'Framing',
      commands: [
        tool('brace' as ToolId, 'Brace', 'beam'),
      ],
    },
  ],
},
```

**Important**: Read the actual RibbonBar.tsx to understand the exact `tool()` helper signature and which `ToolId` values are valid. Use only tool IDs that exist in the tool registry. Check `toolRegistry.ts` for valid IDs (`beam`, `column`, `brace`, `steel-connection` if present). If `steel-connection` is not a valid ToolId, use `beam` + `column` only.

### B — Precast tab content

After the steel tab, add:

```ts
{
  id: 'precast' as RibbonTabId,
  label: 'Precast',
  panels: [
    {
      id: 'precast-elements',
      label: 'Elements',
      commands: [
        tool('column' as ToolId, 'Precast Column', 'column'),
        tool('beam' as ToolId, 'Precast Beam', 'beam'),
        tool('floor' as ToolId, 'Precast Slab', 'floor'),
      ],
    },
  ],
},
```

### C — Massing-Site tab content

After the precast tab, add:

```ts
{
  id: 'massing-site' as RibbonTabId,
  label: 'Massing & Site',
  panels: [
    {
      id: 'conceptual-mass',
      label: 'Conceptual Mass',
      commands: [
        tool('mass' as ToolId, 'In-Place Mass', 'mass'),
      ],
    },
    {
      id: 'site',
      label: 'Site',
      commands: [
        tool('toposolid' as ToolId, 'Toposolid', 'terrain'),
        tool('terrain-pad' as ToolId, 'Building Pad', 'terrain'),
      ],
    },
  ],
},
```

**Important**: Only use tool IDs that actually exist in `toolRegistry.ts`. Run `grep -n "ToolId\|'mass'\|'toposolid'\|'terrain'" packages/web/src/tools/toolRegistry.ts | head -20` to verify. Replace any invalid tool IDs with valid ones from the registry (e.g. use `'component'` as a fallback if specific IDs don't exist).

### D — commandCapabilities.ts entry

```ts
{
  id: 'view.ribbon-steel-precast-tabs',
  label: 'Ribbon Steel / Precast / Massing-Site Tabs',
  owner: 'workspace/shell/RibbonBar',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan'],
  surfaces: ['plan-canvas', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.5: steel tab (connections/framing tools), precast tab (column/beam/slab), massing-site tab (in-place mass, toposolid, building pad) added to plan RibbonBar tabs.',
},
```

Add matching `registerCommand` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.ribbon-steel-precast-tabs',
  label: 'Ribbon Steel / Precast Tabs',
  keywords: ['ribbon', 'steel', 'precast', 'massing', 'site', 'tabs', 'framing'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // Steel/Precast/Massing-Site ribbon tabs are always visible in plan view
  },
});
```

### E — Tests

Create `packages/web/src/workspace/shell/ribbonSteelPrecastTabs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Ribbon steel/precast/massing-site tabs — §1.6.5', () => {
  it('steel tab id is defined', () => {
    const tabId = 'steel';
    expect(tabId).toBe('steel');
  });

  it('precast tab id is defined', () => {
    const tabId = 'precast';
    expect(tabId).toBe('precast');
  });

  it('massing-site tab id is defined', () => {
    const tabId = 'massing-site';
    expect(tabId).toBe('massing-site');
  });

  it('steel tab has connections panel', () => {
    const panelId = 'steel-connections';
    expect(panelId).toBe('steel-connections');
  });

  it('precast tab has elements panel', () => {
    const panelId = 'precast-elements';
    expect(panelId).toBe('precast-elements');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave32/C): ribbon steel/precast/massing-site tabs — connections/framing tools in steel tab + precast elements tab + massing-site tab + view.ribbon-steel-precast-tabs capability (§1.6.5)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
