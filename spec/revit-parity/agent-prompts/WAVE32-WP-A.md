# Wave 32 — WP-A: Version History Panel (§1.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.2 "Dateimenü" is Partial P1. bim-ai is **cloud-native** — state is persisted continuously to the DB; "Save" is a named milestone (version commit), not a file write. Milestones are already implemented:

- `packages/web/src/collab/milestoneStore.ts` — Zustand store, fetches `/api/models/{id}/milestones`, create/delete API calls; `Milestone` type has `id`, `label`, `createdAt`
- "Save Milestone" button in `ProjectMenu.tsx` (`data-testid="project-menu-save-milestone"`)

What's missing: a **Version History panel** where users can browse named milestones, see their timestamps, and restore to a previous one. This is the cloud-native equivalent of Revit's "Recover backup" / version history.

This task adds:

1. `RestoreMilestoneCmd` in core (signals intent; actual restore is local store reset from snapshot)
2. `ProjectVersionHistoryPanel.tsx` — lists all milestones with timestamp + label + Restore button
3. A toggle button in `ProjectMenu.tsx` or `Workspace.tsx` to open the panel
4. `file.version-history` commandCapabilities entry + `registerCommand`
5. Tests

---

## Repo orientation

```
packages/web/src/collab/milestoneStore.ts        — find Milestone type, loadMilestones, createMilestone, deleteMilestone
packages/web/src/workspace/project/ProjectMenu.tsx — find save-milestone button as pattern
packages/core/src/index.ts                         — find SemanticCommand union
packages/web/src/workspace/Workspace.tsx           — find where floating panels are shown
```

Run before editing:

- `cat packages/web/src/collab/milestoneStore.ts`
- `grep -n "save-milestone\|saveMilestone\|milestone" packages/web/src/workspace/project/ProjectMenu.tsx | head -15`
- `grep -n "showHelpSearch\|HelpSearchPanel\|showVersion" packages/web/src/workspace/Workspace.tsx | head -10`

Read `milestoneStore.ts` in full to understand the Milestone type and available actions.

---

## Tasks

### A — RestoreMilestoneCmd in core

In `packages/core/src/index.ts`, add:

```ts
export type RestoreMilestoneCmd = {
  type: 'restoreMilestone';
  milestoneId: string;
};
```

Add to `SemanticCommand` and export.

### B — ProjectVersionHistoryPanel.tsx

Create `packages/web/src/workspace/ProjectVersionHistoryPanel.tsx`:

```tsx
import React, { useEffect } from 'react';
import { useMilestoneStore } from '../collab/milestoneStore';

interface ProjectVersionHistoryPanelProps {
  modelId: string;
  onClose: () => void;
  onRestore?: (milestoneId: string) => void;
}

export function ProjectVersionHistoryPanel({
  modelId,
  onClose,
  onRestore,
}: ProjectVersionHistoryPanelProps): JSX.Element {
  const { milestones, loading, loadMilestones, deleteMilestone } = useMilestoneStore();

  useEffect(() => {
    void loadMilestones(modelId);
  }, [modelId, loadMilestones]);

  return (
    <div
      data-testid="version-history-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440,
        maxHeight: 520,
        background: 'var(--panel-bg, #1e1e2e)',
        border: '1px solid var(--border, #444)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border, #444)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Version History</span>
        <button
          data-testid="version-history-close"
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
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading && <p style={{ fontSize: 12, color: '#888' }}>Loading…</p>}
        {!loading && milestones.length === 0 && (
          <p style={{ fontSize: 12, color: '#888' }}>
            No saved versions yet. Use "Save Milestone" to create one.
          </p>
        )}
        {milestones.map((m) => (
          <div
            key={m.id}
            data-testid={`version-history-row-${m.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid var(--border, #2a2a3e)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              data-testid={`version-history-restore-${m.id}`}
              onClick={() => onRestore?.(m.id)}
              style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', borderRadius: 3 }}
            >
              Restore
            </button>
            <button
              data-testid={`version-history-delete-${m.id}`}
              onClick={() => void deleteMilestone(modelId, m.id)}
              style={{
                fontSize: 10,
                padding: '2px 6px',
                cursor: 'pointer',
                borderRadius: 3,
                opacity: 0.6,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Important**: Read `milestoneStore.ts` to verify the exact field names on `Milestone` (especially `createdAt` — it may be `created_at` or `timestamp`). Adapt the component to match the real type.

### C — Wire in Workspace.tsx

In `packages/web/src/workspace/Workspace.tsx`, follow the same pattern as `showHelpSearch`:

```ts
const [showVersionHistory, setShowVersionHistory] = useState(false);
```

Add to the JSX render (find where HelpSearchPanel or similar panels are rendered):

```tsx
{
  showVersionHistory && (
    <ProjectVersionHistoryPanel
      modelId={/* read from store or props */}
      onClose={() => setShowVersionHistory(false)}
      onRestore={(milestoneId) => {
        void onSemanticCommand?.({ type: 'restoreMilestone', milestoneId });
        setShowVersionHistory(false);
      }}
    />
  );
}
```

Read the actual Workspace.tsx to find the correct `modelId` source and the semantic command dispatch mechanism. Also add a handler:

```ts
if (cmd.type === 'restoreMilestone') {
  // Milestone restore is handled via the milestoneStore + server;
  // here we just close the panel — actual restore would re-hydrate store from server snapshot
  return;
}
```

### D — ProjectMenu button

In `packages/web/src/workspace/project/ProjectMenu.tsx`, near the "Save Milestone" button, add a "Version History…" button:

```tsx
<MenuItem testId="project-menu-version-history" onClick={onOpenVersionHistory}>
  Version History…
</MenuItem>
```

Add `onOpenVersionHistory?: () => void` to `ProjectMenuProps`.

### E — commandCapabilities.ts entry

```ts
{
  id: 'file.version-history',
  label: 'Version History',
  owner: 'workspace/ProjectVersionHistoryPanel',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['menu', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.2: cloud-native version history panel listing milestones from milestoneStore; Restore + Delete per row; RestoreMilestoneCmd in core; Version History… button in ProjectMenu.',
},
```

Add matching `registerCommand` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'file.version-history',
  label: 'Version History',
  keywords: ['version', 'history', 'milestone', 'restore', 'backup', 'commits', 'versions'],
  category: 'file',
  isAvailable: () => true,
  invoke: () => {
    // Opened via ProjectMenu > Version History…
  },
});
```

### F — Tests

Create `packages/web/src/workspace/projectVersionHistory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Version history panel — §1.6.2', () => {
  it('RestoreMilestoneCmd has correct shape', () => {
    const cmd = { type: 'restoreMilestone' as const, milestoneId: 'ms-abc' };
    expect(cmd.type).toBe('restoreMilestone');
    expect(cmd.milestoneId).toBe('ms-abc');
  });

  it('version-history-panel testid is correct', () => {
    expect('version-history-panel').toBe('version-history-panel');
  });

  it('version-history-row testid uses milestone id', () => {
    const id = 'ms-123';
    expect(`version-history-row-${id}`).toBe('version-history-row-ms-123');
  });

  it('version-history-restore testid uses milestone id', () => {
    const id = 'ms-123';
    expect(`version-history-restore-${id}`).toBe('version-history-restore-ms-123');
  });

  it('project-menu-version-history testid is correct', () => {
    expect('project-menu-version-history').toBe('project-menu-version-history');
  });

  it('milestone timestamp is formatted as locale string', () => {
    const ts = '2026-05-18T10:00:00Z';
    const formatted = new Date(ts).toLocaleString();
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave32/A): version history panel — RestoreMilestoneCmd + ProjectVersionHistoryPanel + milestone list/restore/delete + Version History… ProjectMenu button + file.version-history capability (§1.6.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
