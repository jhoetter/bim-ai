# WP-V2-11 — Family Editor V2

## Branch

`feat/wp-v2-11-family-editor`

## Goal

Add a dedicated family-editor mode at `/family-editor`. Users choose a template (Generic Model, Door, Window, Profile), manage named reference planes, define type parameters with optional formula, and load the family into the project.

## Done rule

(a) `pnpm exec tsc --noEmit` clean; (b) all new logic has vitest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

---

## File 1 — `packages/core/src/index.ts`

### Change 1a — append `'reference_plane'` to ElemKind

```
old_string:
  | 'project_param';

new_string:
  | 'project_param'
  | 'reference_plane';
```

### Change 1b — append `reference_plane` shape to Element union

```
old_string:
  | {
      kind: 'project_param';
      id: string;
      name: string;
      sharedParamGuid: string;
      categories: string[];
      instanceOrType: 'instance' | 'type';
    };

new_string:
  | {
      kind: 'project_param';
      id: string;
      name: string;
      sharedParamGuid: string;
      categories: string[];
      instanceOrType: 'instance' | 'type';
    }
  | {
      kind: 'reference_plane';
      id: string;
      name: string;
      familyEditorId: string;
      isVertical: boolean;
      offsetMm: number;
      isSymmetryRef?: boolean;
    };
```

---

## File 2 — `packages/web/src/families/types.ts`

### Change 2a — add `formula` field to FamilyParamDef

```
old_string:
  instanceOverridable: boolean;
}

new_string:
  instanceOverridable: boolean;
  formula?: string | null;
}
```

---

## File 3 — `packages/web/src/state/store.ts`

### Change 3a — add `reference_plane` parser before `return null`

```
old_string:
      instanceOrType: iot === 'type' ? 'type' : 'instance',
    };
  }

  return null;
}

new_string:
      instanceOrType: iot === 'type' ? 'type' : 'instance',
    };
  }

  if (kind === 'reference_plane') {
    return {
      kind: 'reference_plane',
      id,
      name,
      familyEditorId: String(raw.familyEditorId ?? raw.family_editor_id ?? ''),
      isVertical: Boolean(raw.isVertical ?? raw.is_vertical),
      offsetMm: Number(raw.offsetMm ?? raw.offset_mm ?? 0),
      ...(raw.isSymmetryRef != null || raw.is_symmetry_ref != null
        ? { isSymmetryRef: Boolean(raw.isSymmetryRef ?? raw.is_symmetry_ref) }
        : {}),
    };
  }

  return null;
}
```

---

## File 4 — `packages/web/src/App.tsx`

### Change 4a — import FamilyEditorWorkbench

Read App.tsx first to find the existing import block, then add the import after the last local import line. The exact old_string depends on what's already there, but the pattern is:

```
old_string:
import { WorkspaceRoot } from './workspace/WorkspaceRoot';

new_string:
import { WorkspaceRoot } from './workspace/WorkspaceRoot';
import { FamilyEditorWorkbench } from './familyEditor/FamilyEditorWorkbench';
```

### Change 4b — add `/family-editor` route

```
old_string:
          <Route path="/icons" element={<IconGallery />} />

new_string:
          <Route path="/icons" element={<IconGallery />} />
          <Route path="/family-editor" element={<FamilyEditorWorkbench />} />
```

---

## File 5 — NEW `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`

Create this file from scratch. It is a self-contained React component.

**Behaviour:**

- State: `template: 'generic_model' | 'door' | 'window' | 'profile'` (default `'generic_model'`)
- State: `refPlanes: { id: string; name: string; isVertical: boolean; offsetMm: number; isSymmetryRef: boolean }[]` (default `[]`)
- State: `params: { key: string; label: string; type: FamilyParamDef['type']; default: unknown; formula: string }[]` (default `[]`)
- Template chooser: four `<button>` elements labelled by `t('familyEditor.templateGenericModel')` etc.; clicking sets `template`; active button gets `bg-primary text-white` class
- Reference Planes section heading: `t('familyEditor.referencePlanesHeading')`
  - List each plane as a row: `name` | `isVertical ? 'V' : 'H'` | `offsetMm mm`
  - Two add buttons: `t('familyEditor.addHorizontal')` → appends `{ id: crypto.randomUUID(), name: 'Ref Plane', isVertical: false, offsetMm: 0, isSymmetryRef: false }` and `t('familyEditor.addVertical')` → same but `isVertical: true`
- Parameters section heading: `t('familyEditor.parametersHeading')`
  - Table columns: Key | Label | Type | Default | Formula
  - Add button: `t('familyEditor.addParameter')` → appends `{ key: `param_${params.length + 1}`, label: '', type: 'length_mm', default: 0, formula: '' }`
  - Each row is editable: `<input>` for key, label, formula; `<select>` for type (`length_mm`, `angle_deg`, `material_key`, `boolean`, `option`); `<input type="number">` for default when type is `length_mm` or `angle_deg`
- Load into Project button: `t('familyEditor.loadIntoProject')` — `onClick` calls `console.warn('load-into-project stub', { template, refPlanes, params })`

**Imports to use:**

```typescript
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { FamilyParamDef } from '../families/types';
```

---

## File 6 — `packages/web/src/i18n.ts`

### Change 6a — add `familyEditor:` section in EN (after advisor closes, before translation closes)

```
old_string:
            _default:
              'Inspect related elements and Advisor message; use perspective filter to narrow discipline.',
          },
        },
      },
    },
    de: {

new_string:
            _default:
              'Inspect related elements and Advisor message; use perspective filter to narrow discipline.',
          },
        },
        familyEditor: {
          templateLabel: 'Template',
          templateGenericModel: 'Generic Model',
          templateDoor: 'Door',
          templateWindow: 'Window',
          templateProfile: 'Profile',
          referencePlanesHeading: 'Reference Planes',
          addHorizontal: 'Add horizontal',
          addVertical: 'Add vertical',
          parametersHeading: 'Parameters',
          addParameter: 'Add parameter',
          formulaLabel: 'Formula',
          loadIntoProject: 'Load into Project',
        },
      },
    },
    de: {
```

### Change 6b — add `familyEditor:` section in DE

Find the DE advisor section end — it mirrors the EN structure. Search for the DE `_default:` advisor key then add the DE familyEditor block before the `},` that closes the DE translation. Use the following new_string:

```
old_string:
            _default:
              'Zugehörige Elemente und Advisor-Meldung prüfen; Perspektivfilter zur Eingrenzung nutzen.',
          },
        },
      },
    },
  },
});

new_string:
            _default:
              'Zugehörige Elemente und Advisor-Meldung prüfen; Perspektivfilter zur Eingrenzung nutzen.',
          },
        },
        familyEditor: {
          templateLabel: 'Vorlage',
          templateGenericModel: 'Allgemeines Modell',
          templateDoor: 'Tür',
          templateWindow: 'Fenster',
          templateProfile: 'Profil',
          referencePlanesHeading: 'Referenzebenen',
          addHorizontal: 'Horizontal hinzufügen',
          addVertical: 'Vertikal hinzufügen',
          parametersHeading: 'Parameter',
          addParameter: 'Parameter hinzufügen',
          formulaLabel: 'Formel',
          loadIntoProject: 'In Projekt laden',
        },
      },
    },
  },
});
```

---

## Tests

Create `packages/web/src/familyEditor/FamilyEditorWorkbench.test.tsx` (vitest + @testing-library/react):

1. **renders template chooser** — render `<FamilyEditorWorkbench />`; confirm all four template buttons are in the document.
2. **add horizontal reference plane** — click the add-horizontal button; assert the planes list has one row containing 'H'.
3. **add parameter** — click the add-parameter button; assert the params table has one row.
4. **load into project stub** — spy on `console.warn`; click Load into Project; assert `console.warn` was called with first arg `'load-into-project stub'`.
