# Wave 30 — WP-C: In-Product Help Search Panel (§1.6.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.4 "Die Info-Leiste" is Partial P2. In Revit the info bar has an integrated help search that queries Revit's help documentation. bim-ai has no in-product help search beyond the command palette. This task adds a floating help search panel accessible via `F1` or `?` keyboard shortcut, with 25 indexed help topics covering the most common tools and workflows.

This task adds:

1. `helpTopics.ts` — 25 indexed help topics with keywords and content
2. `HelpSearchPanel.tsx` — floating panel with search input + topic results
3. `?` keyboard shortcut (or `F1`) wired in `PlanCanvas.tsx` / `Workspace.tsx`
4. `view.help-search` commandCapabilities entry + `registerCommand`
5. Tests

---

## Repo orientation

```
packages/web/src/workspace/Workspace.tsx    — find keydown handlers + showHelp state pattern
packages/web/src/plan/PlanCanvas.tsx        — find existing keyboard shortcut wiring
packages/web/src/cmdPalette/defaultCommands.ts — find registerCommand pattern
```

Run before editing:

- `grep -n "helpSearch\|showHelp\|HelpSearch\|F1\|onKeyDown.*Help" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "keydown\|onKeyDown\|shortcut.*\?" packages/web/src/plan/PlanCanvas.tsx | head -10`
- `ls packages/web/src/workspace/` | head -20
- `grep -n "CanvasContextMenu\|FloatingPanel\|modal.*panel" packages/web/src/workspace/Workspace.tsx | head -10`

Read `Workspace.tsx` carefully to understand how floating panels/dialogs (e.g., `CanvasContextMenu`, `SetWorkPlaneDialog`) are shown/hidden via state. Follow the same pattern for `HelpSearchPanel`.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Create helpTopics.ts

Create `packages/web/src/workspace/helpTopics.ts`:

```ts
/** §1.6.4: indexed help topics for the in-product help search panel. */
export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  shortcut?: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'wall',
    title: 'Draw Walls',
    summary:
      'Press W to activate the Wall tool. Click-click to draw each segment. Press Esc to finish.',
    keywords: ['wall', 'draw', 'segment', 'WA'],
    shortcut: 'W',
  },
  {
    id: 'door',
    title: 'Place Doors',
    summary: 'Press D to activate the Door tool. Click on a wall to insert a door.',
    keywords: ['door', 'insert', 'opening'],
    shortcut: 'D',
  },
  {
    id: 'window',
    title: 'Place Windows',
    summary: 'Press N to activate the Window tool. Click on a wall to insert a window.',
    keywords: ['window', 'insert', 'opening', 'glazing'],
    shortcut: 'N',
  },
  {
    id: 'floor',
    title: 'Draw Floors',
    summary:
      'Press F to activate the Floor tool. Click to define boundary points, then press Enter to create.',
    keywords: ['floor', 'slab', 'boundary'],
    shortcut: 'F',
  },
  {
    id: 'room',
    title: 'Place Rooms',
    summary:
      'Press R to activate the Room tool. Click inside a closed wall boundary to create a room.',
    keywords: ['room', 'space', 'area'],
    shortcut: 'R',
  },
  {
    id: 'column',
    title: 'Place Columns',
    summary: 'Press CO to activate the Column tool. Click to place a structural column.',
    keywords: ['column', 'structural', 'pillar', 'CO'],
    shortcut: 'CO',
  },
  {
    id: 'beam',
    title: 'Place Beams',
    summary: 'Press BM to activate the Beam tool. Click-click to define a beam span.',
    keywords: ['beam', 'structural', 'span', 'framing', 'BM'],
    shortcut: 'BM',
  },
  {
    id: 'stair',
    title: 'Draw Stairs',
    summary:
      'Press ST to activate the Stair tool. Click-click to define the run direction and length.',
    keywords: ['stair', 'steps', 'riser', 'run', 'ST'],
    shortcut: 'ST',
  },
  {
    id: 'roof',
    title: 'Draw Roofs',
    summary: 'Press RP to activate the Roof tool. Sketch the roof boundary, set the slope angle.',
    keywords: ['roof', 'slope', 'eave', 'ridge', 'RP'],
    shortcut: 'RP',
  },
  {
    id: 'dimension',
    title: 'Add Dimensions',
    summary:
      'Press DI to activate the Dimension tool. Click two reference points, then place the dimension line.',
    keywords: ['dimension', 'annotation', 'measure', 'DI'],
    shortcut: 'DI',
  },
  {
    id: 'tag',
    title: 'Tag Elements',
    summary: 'Press TG to add a tag to a selected element (room, door, window).',
    keywords: ['tag', 'label', 'annotation', 'TG'],
    shortcut: 'TG',
  },
  {
    id: 'undo',
    title: 'Undo / Redo',
    summary: 'Ctrl+Z to undo the last action. Ctrl+Y or Ctrl+Shift+Z to redo.',
    keywords: ['undo', 'redo', 'ctrl z', 'ctrl y'],
    shortcut: 'Ctrl+Z',
  },
  {
    id: 'select',
    title: 'Select Elements',
    summary:
      'Click to select a single element. Box select (left→right: crossing) selects all enclosed elements.',
    keywords: ['select', 'pick', 'box select', 'crossing'],
  },
  {
    id: 'move',
    title: 'Move Elements',
    summary: 'Select an element, then press M or drag a grip handle to move it.',
    keywords: ['move', 'drag', 'grip', 'reposition'],
    shortcut: 'M',
  },
  {
    id: 'copy',
    title: 'Copy Elements',
    summary: 'Select elements, press Ctrl+C to copy, Ctrl+V to paste at a new location.',
    keywords: ['copy', 'paste', 'duplicate', 'ctrl c'],
  },
  {
    id: 'mirror',
    title: 'Mirror Elements',
    summary: 'Select an element, then use Modify > Mirror or the context menu Mirror option.',
    keywords: ['mirror', 'flip', 'symmetric', 'MR'],
  },
  {
    id: 'rotate',
    title: 'Rotate Elements',
    summary: 'Select an element, use the rotate grip (orange dot) or press RO and pick the center.',
    keywords: ['rotate', 'spin', 'angle', 'RO'],
    shortcut: 'RO',
  },
  {
    id: 'level',
    title: 'Manage Levels',
    summary:
      'Levels define floor heights. Add levels in the Project Browser or via the Level tool.',
    keywords: ['level', 'storey', 'floor height', 'elevation'],
  },
  {
    id: '3d',
    title: '3D View',
    summary:
      'Click the 3D icon or press VV to switch to 3D orbit view. Scroll to zoom, right-drag to orbit.',
    keywords: ['3d', 'orbit', 'view', 'VV'],
    shortcut: 'VV',
  },
  {
    id: 'section',
    title: 'Create Sections',
    summary: 'Press SE to place a section marker. The section view appears in the Project Browser.',
    keywords: ['section', 'cut', 'section view', 'SE'],
    shortcut: 'SE',
  },
  {
    id: 'grid',
    title: 'Draw Grids',
    summary: 'Press GR to activate the Grid tool. Draw horizontal and vertical grid lines.',
    keywords: ['grid', 'column grid', 'GR'],
    shortcut: 'GR',
  },
  {
    id: 'material',
    title: 'Assign Materials',
    summary:
      'Select an element, click the Material field in the inspector to open the Material Browser.',
    keywords: ['material', 'texture', 'finish', 'paint'],
  },
  {
    id: 'export',
    title: 'Export DXF / IFC',
    summary:
      'Use Project Menu > Export DXF for CAD export, or Export IFC for BIM interoperability.',
    keywords: ['export', 'dxf', 'ifc', 'dwg', 'cad'],
  },
  {
    id: 'pdf',
    title: 'Export to PDF',
    summary: 'Use Project Menu > Export PDF to generate a multi-sheet PDF from your sheets.',
    keywords: ['pdf', 'print', 'plot', 'export'],
  },
  {
    id: 'family',
    title: 'Family Editor',
    summary:
      'Double-click a family_definition element or open from the Family Library to enter the family editor.',
    keywords: ['family', 'parametric', 'family editor', 'FE'],
  },
];

export function searchHelpTopics(query: string): HelpTopic[] {
  if (!query.trim()) return HELP_TOPICS;
  const q = query.toLowerCase();
  return HELP_TOPICS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
```

### B — Create HelpSearchPanel.tsx

Create `packages/web/src/workspace/HelpSearchPanel.tsx`:

```tsx
import React, { useState } from 'react';
import { HELP_TOPICS, searchHelpTopics, HelpTopic } from './helpTopics';

interface HelpSearchPanelProps {
  onClose: () => void;
}

export function HelpSearchPanel({ onClose }: HelpSearchPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const results = searchHelpTopics(query);

  return (
    <div
      data-testid="help-search-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480,
        maxHeight: 500,
        background: 'var(--panel-bg, #1e1e2e)',
        border: '1px solid var(--border, #444)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border, #444)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Help Search</span>
        <button
          data-testid="help-search-close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: 'inherit',
          }}
        >
          ✕
        </button>
      </div>
      {/* Search input */}
      <div style={{ padding: '8px 12px' }}>
        <input
          data-testid="help-search-input"
          autoFocus
          type="text"
          placeholder="Search help topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          style={{
            width: '100%',
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid var(--border, #555)',
            background: 'var(--input-bg, #2a2a3e)',
            color: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {results.length === 0 ? (
          <p style={{ fontSize: 12, color: '#888', margin: 8 }}>No results for "{query}"</p>
        ) : (
          results.map((topic) => (
            <div
              key={topic.id}
              data-testid={`help-topic-${topic.id}`}
              style={{ padding: '8px 0', borderBottom: '1px solid var(--border, #333)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{topic.title}</span>
                {topic.shortcut && (
                  <kbd
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: '#333',
                      border: '1px solid #555',
                    }}
                  >
                    {topic.shortcut}
                  </kbd>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0', lineHeight: 1.4 }}>
                {topic.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

### C — Wire keyboard shortcut and show/hide in Workspace.tsx

In `Workspace.tsx`, add `showHelpSearch` state and wire the `?` key:

```ts
const [showHelpSearch, setShowHelpSearch] = useState(false);

// In a global keydown handler (find existing or add one):
// Press '?' to open help search
if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
  e.preventDefault();
  setShowHelpSearch(true);
}
```

And in the JSX render, add the panel:

```tsx
{
  showHelpSearch && <HelpSearchPanel onClose={() => setShowHelpSearch(false)} />;
}
```

**Important**: Read `Workspace.tsx` to find where keydown handlers and floating panels are wired. Follow the existing pattern (e.g., how `CanvasContextMenu` or `SetWorkPlaneDialog` is shown/hidden).

Also wire `view.help-search` to open the panel:

```ts
if (cmd.type === 'openHelpSearch') {
  setShowHelpSearch(true);
  return;
}
```

Or, if there's an existing pattern for opening panels, follow that.

### D — commandCapabilities.ts entry

```ts
{
  id: 'view.help-search',
  label: 'In-Product Help Search',
  owner: 'workspace/HelpSearchPanel',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['toolbar', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.4: ? keyboard shortcut opens HelpSearchPanel with 25 indexed help topics; searchHelpTopics() filters by title/summary/keywords.',
},
```

Add a matching `registerCommand` for `view.help-search` in `defaultCommands.ts`.

### E — Tests

Create `packages/web/src/workspace/helpTopics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HELP_TOPICS, searchHelpTopics } from './helpTopics';

describe('In-product help search — §1.6.4', () => {
  it('has at least 20 help topics', () => {
    expect(HELP_TOPICS.length).toBeGreaterThanOrEqual(20);
  });

  it('each topic has required fields', () => {
    for (const t of HELP_TOPICS) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.summary).toBeTruthy();
      expect(Array.isArray(t.keywords)).toBe(true);
    }
  });

  it('searchHelpTopics returns all for empty query', () => {
    expect(searchHelpTopics('').length).toBe(HELP_TOPICS.length);
  });

  it('searchHelpTopics finds wall topic', () => {
    const results = searchHelpTopics('wall');
    expect(results.some((t) => t.id === 'wall')).toBe(true);
  });

  it('searchHelpTopics returns empty for unknown query', () => {
    const results = searchHelpTopics('xyznonexistent999');
    expect(results.length).toBe(0);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave30/C): in-product help search — helpTopics.ts (25 topics) + HelpSearchPanel.tsx + ? keyboard shortcut + view.help-search capability (§1.6.4)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
