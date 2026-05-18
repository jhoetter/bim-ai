# Wave 21 — WP-A: Project Templates — Save As Template + New From Template (§1.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

`§1.6.2 Dateimenü` is Partial — missing "Save As Template" and "New From Template". The WorkspaceRightRail.tsx and InspectorContent.tsx reference `__saveAsTemplate__` as a special key, but there is no actual template save/load mechanism. This task implements project templates persisted to `localStorage`.

---

## Repo orientation

```
packages/web/src/state/storeTypes.ts          — add ProjectTemplate type + store slice
packages/web/src/cmdPalette/defaultCommands.ts — add palette commands
packages/web/src/workspace/ProjectMenu.tsx     — add menu items
packages/web/src/workspace/Workspace.tsx       — add handlers
```

Run `find packages/web/src -name "ProjectMenu*"` to locate the project menu.
Run `find packages/web/src -name "storeTypes.ts"` to confirm the store types file.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — ProjectTemplate type in storeTypes.ts

In `packages/web/src/state/storeTypes.ts`, add:

```ts
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string; // ISO date
  /** Serialised subset of StoreState: elementsById snapshot */
  elementsSnapshot: string; // JSON
}
```

Add to `StoreState`:

```ts
projectTemplates: ProjectTemplate[];
saveProjectAsTemplate: (name: string, description: string) => void;
loadProjectTemplate: (templateId: string) => void;
deleteProjectTemplate: (templateId: string) => void;
```

In the appropriate store slice (look at how other slices are done — grep for `storeViewportRuntimeSlice` for the pattern):

```ts
projectTemplates: JSON.parse(localStorage.getItem('bim-ai-templates') ?? '[]'),

saveProjectAsTemplate: (name, description) => set(state => {
  const tpl: ProjectTemplate = {
    id: crypto.randomUUID(),
    name,
    description,
    createdAt: new Date().toISOString(),
    elementsSnapshot: JSON.stringify(state.elementsById),
  };
  const updated = [...state.projectTemplates, tpl];
  localStorage.setItem('bim-ai-templates', JSON.stringify(updated));
  return { projectTemplates: updated };
}),

loadProjectTemplate: (templateId) => set(state => {
  const tpl = state.projectTemplates.find(t => t.id === templateId);
  if (!tpl) return {};
  try {
    return { elementsById: JSON.parse(tpl.elementsSnapshot) };
  } catch {
    return {};
  }
}),

deleteProjectTemplate: (templateId) => set(state => {
  const updated = state.projectTemplates.filter(t => t.id !== templateId);
  localStorage.setItem('bim-ai-templates', JSON.stringify(updated));
  return { projectTemplates: updated };
}),
```

### B — ProjectTemplatesDialog.tsx

Create `packages/web/src/workspace/ProjectTemplatesDialog.tsx`:

```tsx
import { useState } from 'react';
import { useBimStore } from '../state/store';

export function ProjectTemplatesDialog({ onClose }: { onClose: () => void }) {
  const templates = useBimStore((s) => s.projectTemplates);
  const saveProjectAsTemplate = useBimStore((s) => s.saveProjectAsTemplate);
  const loadProjectTemplate = useBimStore((s) => s.loadProjectTemplate);
  const deleteProjectTemplate = useBimStore((s) => s.deleteProjectTemplate);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div
      data-testid="project-templates-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: '#1a1a2e',
          color: '#eee',
          padding: 24,
          borderRadius: 8,
          width: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Project Templates</h3>

        {/* Save current project as template */}
        <fieldset
          style={{ marginBottom: 16, border: '1px solid #444', borderRadius: 4, padding: 12 }}
        >
          <legend>Save Current Project as Template</legend>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Name
            <input
              data-testid="template-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Description
            <input
              data-testid="template-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
            />
          </label>
          <button
            data-testid="template-save-btn"
            disabled={!name.trim()}
            onClick={() => {
              saveProjectAsTemplate(name.trim(), description.trim());
              setName('');
              setDescription('');
            }}
          >
            Save Template
          </button>
        </fieldset>

        {/* List of saved templates */}
        <h4 style={{ marginBottom: 8 }}>Saved Templates ({templates.length})</h4>
        {templates.length === 0 && (
          <p data-testid="template-empty-state" style={{ color: '#888', fontSize: 13 }}>
            No templates saved yet.
          </p>
        )}
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            data-testid={`template-row-${tpl.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #333',
            }}
          >
            <div>
              <strong data-testid={`template-name-${tpl.id}`}>{tpl.name}</strong>
              {tpl.description && (
                <div style={{ fontSize: 12, color: '#aaa' }}>{tpl.description}</div>
              )}
              <div style={{ fontSize: 11, color: '#666' }}>
                {new Date(tpl.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                data-testid={`template-load-${tpl.id}`}
                onClick={() => {
                  loadProjectTemplate(tpl.id);
                  onClose();
                }}
              >
                Load
              </button>
              <button
                data-testid={`template-delete-${tpl.id}`}
                onClick={() => deleteProjectTemplate(tpl.id)}
                style={{ color: '#f87171' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <button
          data-testid="project-templates-close"
          onClick={onClose}
          style={{ marginTop: 16, display: 'block', marginLeft: 'auto' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

### C — Wire into Workspace.tsx and ProjectMenu.tsx

In `Workspace.tsx`:

1. Import `ProjectTemplatesDialog`
2. Add `const [templatesOpen, setTemplatesOpen] = useState(false);`
3. In the JSX: `{templatesOpen && <ProjectTemplatesDialog onClose={() => setTemplatesOpen(false)} />}`
4. Pass `openProjectTemplates: () => setTemplatesOpen(true)` into the palette context if applicable

In `ProjectMenu.tsx` (or wherever the file menu items are), add menu items:

```tsx
<button
  data-testid="project-menu-templates"
  onClick={() => {
    onClose?.();
    openProjectTemplates?.();
  }}
>
  Project Templates…
</button>
```

### D — Palette commands

In `packages/web/src/cmdPalette/defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'file.project-templates',
  label: 'Project Templates',
  keywords: ['template', 'save', 'new from template', 'project template'],
  category: 'command',
  invoke: (ctx) => {
    ctx.openProjectTemplates?.();
  },
});
```

Add `openProjectTemplates?: () => void` to the `PaletteContext` interface if it exists (grep for the context type definition).

### E — commandCapabilities.ts

In `packages/web/src/workspace/commandCapabilities.ts`, add:

```ts
{
  id: 'file.project-templates',
  label: 'Project Templates',
  owner: 'cmdPalette/defaultCommands',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d', 'sheet'],
  surfaces: ['cmd-k'],
  executionSurface: 'dialog',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.2: project template save/load via localStorage.',
},
```

### F — Tests

Create `packages/web/src/workspace/projectTemplates.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useBimStore } from '../state/store';
import { ProjectTemplatesDialog } from './ProjectTemplatesDialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.removeItem('bim-ai-templates');
  useBimStore.setState({ projectTemplates: [], elementsById: {} });
});

describe('ProjectTemplates — §1.6.2', () => {
  it('renders dialog with empty state', () => {
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    expect(screen.getByTestId('project-templates-dialog')).toBeTruthy();
    expect(screen.getByTestId('template-empty-state')).toBeTruthy();
  });

  it('save button is disabled when name is empty', () => {
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    const btn = screen.getByTestId('template-save-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('saves a template when name is provided', () => {
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('template-name-input'), {
      target: { value: 'My Template' },
    });
    fireEvent.click(screen.getByTestId('template-save-btn'));
    expect(useBimStore.getState().projectTemplates).toHaveLength(1);
    expect(useBimStore.getState().projectTemplates[0].name).toBe('My Template');
  });

  it('deletes a template', () => {
    useBimStore.getState().saveProjectAsTemplate('T1', '');
    const tplId = useBimStore.getState().projectTemplates[0].id;
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    fireEvent.click(screen.getByTestId(`template-delete-${tplId}`));
    expect(useBimStore.getState().projectTemplates).toHaveLength(0);
  });

  it('loads a template and closes', () => {
    useBimStore.getState().saveProjectAsTemplate('T1', '');
    const tplId = useBimStore.getState().projectTemplates[0].id;
    const onClose = vi.fn();
    render(<ProjectTemplatesDialog onClose={onClose} />);
    fireEvent.click(screen.getByTestId(`template-load-${tplId}`));
    expect(onClose).toHaveBeenCalled();
  });

  it('persists templates to localStorage', () => {
    useBimStore.getState().saveProjectAsTemplate('Saved', 'desc');
    const stored = JSON.parse(localStorage.getItem('bim-ai-templates') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Saved');
  });
});
```

(Add `import { vi } from 'vitest';` if needed.)

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave21/A): project templates — save-as-template + new-from-template via localStorage (§1.6.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
