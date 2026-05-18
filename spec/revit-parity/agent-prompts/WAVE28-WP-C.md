# Wave 28 — WP-C: Custom DXF Layer Name Mapping (§12.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§12.4.2 "Export mit deutschsprachigen Layern" is Not Started P2. The DXF exporter uses hard-coded English layer names (A-WALL, A-DOOR, A-GLAZ, etc.). Revit lets users customize layer naming (e.g. WAND, TÜR, FENSTER for German projects).

This task adds:

1. `dxfLayerMapping?: Record<string, string>` field on `project_settings` element
2. `SetDxfLayerMappingCmd` command
3. Workspace handler
4. DXF exporter uses layer name overrides from `dxfLayerMapping`
5. DXF export dialog: collapsible "Layer Names" editor section
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find project_settings element type
packages/web/src/export/dxfExporter.ts                  — find LAYER constants and layer usage
packages/web/src/workspace/Workspace.tsx                — find handleExportDxf + project_settings handler
packages/web/src/workspace/sheets/PrintPlotDialog.tsx   — find DXF export dialog section
```

Run before editing:

- `grep -n "dxfLayerMapping\|A-WALL\|A-DOOR\|LAYER" packages/web/src/export/dxfExporter.ts | head -15`
- `grep -n "project_settings\|dxfLayer" packages/core/src/index.ts | head -10`
- `grep -n "handleExportDxf\|dxf\|DXF" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "dxf\|DXF\|layer" packages/web/src/workspace/sheets/PrintPlotDialog.tsx | head -10`

Read `dxfExporter.ts` carefully to understand current layer name constants before adding overrides.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add dxfLayerMapping to project_settings in core

Find the `project_settings` element type in `packages/core/src/index.ts`. Add:

```ts
/** §12.4.2: per-layer name overrides for DXF export. Keys are default layer names (e.g. 'A-WALL'), values are custom names. */
dxfLayerMapping?: Record<string, string>;
```

### B — Add SetDxfLayerMappingCmd

Find where other `Cmd` types are defined. Add:

```ts
export type SetDxfLayerMappingCmd = {
  type: 'setDxfLayerMapping';
  /** Merged partial update to dxfLayerMapping on project_settings. */
  mapping: Record<string, string>;
};
```

Add `| SetDxfLayerMappingCmd` to `SemanticCommand` and export it.

### C — Workspace handler

Find where `project_settings` is updated. Add:

```ts
if (cmd.type === 'setDxfLayerMapping') {
  const { elementsById: cur } = useBimStore.getState();
  const settings = Object.values(cur).find((el) => el.kind === 'project_settings');
  if (!settings) return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [settings.id]: {
        ...settings,
        dxfLayerMapping: {
          ...((settings as any).dxfLayerMapping ?? {}),
          ...(cmd.mapping as Record<string, string>),
        },
      },
    },
  });
  return;
}
```

### D — DXF exporter: use layer name overrides

In `dxfExporter.ts`, find where layer names are used (constants like `'A-WALL'`, `'A-DOOR'`, etc.). Create a helper function:

```ts
function resolveLayerName(defaultName: string, mapping?: Record<string, string>): string {
  return mapping?.[defaultName] ?? defaultName;
}
```

Then pass the `dxfLayerMapping` from `project_settings` to the export function and use `resolveLayerName(...)` everywhere a layer name is referenced.

**Important**: Read `dxfExporter.ts` carefully. The layer names may be constants or inline strings. Find the export function signature and add a `layerMapping?: Record<string, string>` parameter. Adapt to the actual code structure.

### E — DXF export dialog: layer name editor

In `PrintPlotDialog.tsx` (or wherever the DXF export options are shown), add a collapsible "Layer Names" section:

```tsx
{
  /* §12.4.2: Custom layer name mapping */
}
<details style={{ marginTop: 8 }}>
  <summary style={{ fontSize: 11, cursor: 'pointer', userSelect: 'none' }}>Layer Names</summary>
  <div
    style={{
      paddingTop: 6,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4px 8px',
      fontSize: 11,
    }}
  >
    {[
      'A-WALL',
      'A-DOOR',
      'A-GLAZ',
      'A-AREA',
      'S-GRID',
      'A-ANNO-DIMS',
      'A-REFP',
      'S-COLS',
      'S-BEAM',
    ].map((layer) => (
      <React.Fragment key={layer}>
        <span style={{ alignSelf: 'center', color: 'var(--text-muted, #888)' }}>{layer}</span>
        <input
          data-testid={`dxf-layer-name-${layer}`}
          type="text"
          defaultValue={(dxfLayerMapping ?? {})[layer] ?? layer}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val && val !== layer) {
              onSetDxfLayerMapping?.({ [layer]: val });
            }
          }}
          style={{
            fontSize: 11,
            padding: '1px 4px',
            border: '1px solid var(--border)',
            borderRadius: 2,
            background: 'transparent',
            color: 'inherit',
          }}
        />
      </React.Fragment>
    ))}
  </div>
</details>;
```

**Important**: Read `PrintPlotDialog.tsx` carefully before adding. Find the existing DXF export section. Pass `dxfLayerMapping` and `onSetDxfLayerMapping` as props or read from store. Adapt to the actual component structure.

### F — commandCapabilities.ts entry

```ts
{
  id: 'file.dxf-layer-mapping',
  label: 'Custom DXF Layer Names',
  owner: 'workspace/sheets/PrintPlotDialog',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['export-dialog', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§12.4.2: dxfLayerMapping on project_settings allows renaming default layer names (A-WALL→WAND, etc.) in DXF export.',
},
```

Add a matching `registerCommand` for `file.dxf-layer-mapping` in `defaultCommands.ts`.

### G — Tests

Create `packages/web/src/export/dxfLayerMapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

function resolveLayerName(defaultName: string, mapping?: Record<string, string>): string {
  return mapping?.[defaultName] ?? defaultName;
}

describe('DXF layer name mapping — §12.4.2', () => {
  it('returns default name when no mapping', () => {
    expect(resolveLayerName('A-WALL')).toBe('A-WALL');
  });

  it('returns override when mapping provided', () => {
    expect(resolveLayerName('A-WALL', { 'A-WALL': 'WAND' })).toBe('WAND');
  });

  it('returns default for unmapped layers', () => {
    expect(resolveLayerName('A-DOOR', { 'A-WALL': 'WAND' })).toBe('A-DOOR');
  });

  it('SetDxfLayerMappingCmd has correct shape', () => {
    const cmd = {
      type: 'setDxfLayerMapping' as const,
      mapping: { 'A-WALL': 'WAND', 'A-DOOR': 'TÜR' },
    };
    expect(cmd.type).toBe('setDxfLayerMapping');
    expect(cmd.mapping['A-WALL']).toBe('WAND');
  });

  it('merges mapping with existing', () => {
    const existing = { 'A-WALL': 'WAND' };
    const update = { 'A-DOOR': 'TÜR' };
    const merged = { ...existing, ...update };
    expect(merged['A-WALL']).toBe('WAND');
    expect(merged['A-DOOR']).toBe('TÜR');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave28/C): custom DXF layer name mapping — dxfLayerMapping on project_settings + SetDxfLayerMappingCmd + resolveLayerName() in dxfExporter + layer name editor in export dialog (§12.4.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
