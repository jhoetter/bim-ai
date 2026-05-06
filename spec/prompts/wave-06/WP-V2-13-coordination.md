# WP-V2-13 — Coordination + Clash Detection

## Branch

`feat/wp-v2-13-coordination`

## Goal

Add Selection Sets (named saved selections by filter rule), Find Items by Rule (context-menu shortcuts), Clash Detection (Set A vs Set B with results list), and extend Viewpoints with `hiddenElementIds` + `isolatedElementIds` for saved visibility state.

## Done rule

(a) `pnpm exec tsc --noEmit` clean; (b) all new logic has vitest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

---

## File 1 — `packages/core/src/index.ts`

### Change 1a — add helper types after SharedParamGroup

```
old_string:
export type SharedParamGroup = {
  groupName: string;
  parameters: SharedParamEntry[];
};

export type Element =

new_string:
export type SharedParamGroup = {
  groupName: string;
  parameters: SharedParamEntry[];
};

export type SelectionSetRule = {
  field: 'category' | 'level' | 'typeName';
  operator: 'equals' | 'contains';
  value: string;
};

export type ClashResult = {
  elementIdA: string;
  elementIdB: string;
  distanceMm: number;
};

export type Element =
```

### Change 1b — append `'selection_set'` and `'clash_test'` to ElemKind

```
old_string:
  | 'project_param'
  | 'reference_plane';

new_string:
  | 'project_param'
  | 'reference_plane'
  | 'selection_set'
  | 'clash_test';
```

### Change 1c — extend `viewpoint` shape with visibility fields

```
old_string:
      sectionBoxEnabled?: boolean | null;
      sectionBoxMinMm?: { xMm: number; yMm: number; zMm: number } | null;
      sectionBoxMaxMm?: { xMm: number; yMm: number; zMm: number } | null;
    }
  | {
      kind: 'issue';

new_string:
      sectionBoxEnabled?: boolean | null;
      sectionBoxMinMm?: { xMm: number; yMm: number; zMm: number } | null;
      sectionBoxMaxMm?: { xMm: number; yMm: number; zMm: number } | null;
      hiddenElementIds?: string[];
      isolatedElementIds?: string[];
    }
  | {
      kind: 'issue';
```

### Change 1d — append `selection_set` and `clash_test` shapes to Element union

```
old_string:
  | {
      kind: 'reference_plane';
      id: string;
      name: string;
      familyEditorId: string;
      isVertical: boolean;
      offsetMm: number;
      isSymmetryRef?: boolean;
    };

new_string:
  | {
      kind: 'reference_plane';
      id: string;
      name: string;
      familyEditorId: string;
      isVertical: boolean;
      offsetMm: number;
      isSymmetryRef?: boolean;
    }
  | {
      kind: 'selection_set';
      id: string;
      name: string;
      filterRules: SelectionSetRule[];
    }
  | {
      kind: 'clash_test';
      id: string;
      name: string;
      setAIds: string[];
      setBIds: string[];
      toleranceMm: number;
      results?: ClashResult[];
    };
```

---

## File 2 — `packages/web/src/state/store.ts`

### Change 2a — extend viewpoint parser with hiddenElementIds + isolatedElementIds

```
old_string:
      ...(() => {
        const csRaw = raw.cutawayStyle ?? raw.cutaway_style;
        if (csRaw !== 'none' && csRaw !== 'cap' && csRaw !== 'floor' && csRaw !== 'box') return {};
        return { cutawayStyle: csRaw };
      })(),
    };
  }

  if (kind === 'issue') {

new_string:
      ...(() => {
        const csRaw = raw.cutawayStyle ?? raw.cutaway_style;
        if (csRaw !== 'none' && csRaw !== 'cap' && csRaw !== 'floor' && csRaw !== 'box') return {};
        return { cutawayStyle: csRaw };
      })(),
      ...(Array.isArray(raw.hiddenElementIds) || Array.isArray(raw.hidden_element_ids)
        ? {
            hiddenElementIds: (
              (raw.hiddenElementIds ?? raw.hidden_element_ids) as unknown[]
            ).filter((x): x is string => typeof x === 'string'),
          }
        : {}),
      ...(Array.isArray(raw.isolatedElementIds) || Array.isArray(raw.isolated_element_ids)
        ? {
            isolatedElementIds: (
              (raw.isolatedElementIds ?? raw.isolated_element_ids) as unknown[]
            ).filter((x): x is string => typeof x === 'string'),
          }
        : {}),
    };
  }

  if (kind === 'issue') {
```

### Change 2b — add selection_set and clash_test parsers before `return null`

```
old_string:
      ...(raw.isSymmetryRef != null || raw.is_symmetry_ref != null
        ? { isSymmetryRef: Boolean(raw.isSymmetryRef ?? raw.is_symmetry_ref) }
        : {}),
    };
  }

  return null;
}

new_string:
      ...(raw.isSymmetryRef != null || raw.is_symmetry_ref != null
        ? { isSymmetryRef: Boolean(raw.isSymmetryRef ?? raw.is_symmetry_ref) }
        : {}),
    };
  }

  if (kind === 'selection_set') {
    const rulesRaw = raw.filterRules ?? raw.filter_rules ?? [];
    const filterRules = Array.isArray(rulesRaw)
      ? rulesRaw
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map((r) => ({
            field: (['category', 'level', 'typeName'].includes(r.field as string)
              ? r.field
              : 'category') as 'category' | 'level' | 'typeName',
            operator: (r.operator === 'contains' ? 'contains' : 'equals') as
              | 'equals'
              | 'contains',
            value: String(r.value ?? ''),
          }))
      : [];
    return { kind: 'selection_set', id, name, filterRules };
  }

  if (kind === 'clash_test') {
    const coerceIds = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const resultsRaw = raw.results ?? [];
    const results = Array.isArray(resultsRaw)
      ? resultsRaw
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map((r) => ({
            elementIdA: String(r.elementIdA ?? r.element_id_a ?? ''),
            elementIdB: String(r.elementIdB ?? r.element_id_b ?? ''),
            distanceMm: Number(r.distanceMm ?? r.distance_mm ?? 0),
          }))
      : [];
    return {
      kind: 'clash_test',
      id,
      name,
      setAIds: coerceIds(raw.setAIds ?? raw.set_a_ids),
      setBIds: coerceIds(raw.setBIds ?? raw.set_b_ids),
      toleranceMm: Number(raw.toleranceMm ?? raw.tolerance_mm ?? 50),
      ...(results.length ? { results } : {}),
    };
  }

  return null;
}
```

---

## File 3 — `packages/web/src/workspace/InspectorContent.tsx`

### Change 3a — add selection_set and clash_test cases before `default:`

```
old_string:
    case 'project_settings':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {el.startingViewId ? (
            <FieldRow label={f('startingView')} value={el.startingViewId} mono />
          ) : null}
        </div>
      );
    default:

new_string:
    case 'project_settings':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name ?? '—'} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {el.startingViewId ? (
            <FieldRow label={f('startingView')} value={el.startingViewId} mono />
          ) : null}
        </div>
      );
    case 'selection_set':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('ruleCount')} value={String(el.filterRules.length)} />
        </div>
      );
    case 'clash_test':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('toleranceMm')} value={`${el.toleranceMm} mm`} />
          <FieldRow label={f('clashResults')} value={String(el.results?.length ?? 0)} />
        </div>
      );
    default:
```

Also add the two missing i18n keys (`ruleCount`, `toleranceMm`, `clashResults`) to inspector.fields — see File 5 below.

---

## File 4 — NEW `packages/web/src/coordination/SelectionSetPanel.tsx`

Create this file. Self-contained React component.

**Props:** `el: Extract<Element, { kind: 'selection_set' }>; elements: Record<string, Element>;`

**Imports:**
```typescript
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, SelectionSetRule } from '@bim-ai/core';
```

**Behaviour:**

- State: `rules: SelectionSetRule[]` — initialised from `el.filterRules`
- For each rule, render a row with:
  - `<select>` for `field`: options `category`, `level`, `typeName` (labelled by `t('coordination.ruleField')`)
  - `<select>` for `operator`: options `equals`, `contains`
  - `<input type="text">` for `value`
  - Remove button (`×`) that splices the rule from state
- "Add Rule" button (`t('coordination.addRule')`) appends `{ field: 'category', operator: 'equals', value: '' }`
- Matched elements count: compute `matchCount = Object.values(elements).filter(e => rules.every(rule => matchesRule(e, rule))).length` where `matchesRule` checks:
  - `field === 'category'` → `e.kind === rule.value` (operator `equals`) or `e.kind.includes(rule.value)` (operator `contains`)
  - `field === 'level'` → `('levelId' in e) && (rule.operator === 'equals' ? e.levelId === rule.value : String(e.levelId).includes(rule.value))`
  - `field === 'typeName'` → `('name' in e) && (rule.operator === 'equals' ? e.name === rule.value : String(e.name).includes(rule.value))`
- Display: `{t('coordination.matchedElements')}: {matchCount}`

---

## File 5 — NEW `packages/web/src/coordination/ClashTestPanel.tsx`

Create this file. Self-contained React component.

**Props:** `el: Extract<Element, { kind: 'clash_test' }>;`

**Imports:**
```typescript
import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, ClashResult } from '@bim-ai/core';
```

**Behaviour:**

- Displays Set A IDs count and Set B IDs count as FieldRow-like rows
- Displays tolerance: `{el.toleranceMm} mm`
- "Run Clash Test" button (`t('coordination.runClashTest')`) → `console.warn('run-clash-test stub', { setAIds: el.setAIds, setBIds: el.setBIds, toleranceMm: el.toleranceMm })`
- Results table (shown when `el.results?.length`):
  - Columns: Element A | Element B | Distance | (fly-to button)
  - Each row: `el.results.map((r) => <tr>...<td>{r.elementIdA}</td><td>{r.elementIdB}</td><td>{r.distanceMm.toFixed(1)} mm</td><td><button onClick={() => console.warn('fly-to-clash', r)}>{t('coordination.flyTo')}</button></td></tr>)`

---

## File 6 — `packages/web/src/i18n.ts`

### Change 6a — add coordination section in EN (after familyEditor closes, before translation closes)

```
old_string:
          loadIntoProject: 'Load into Project',
        },
      },
    },
    de: {

new_string:
          loadIntoProject: 'Load into Project',
        },
        coordination: {
          selectionSets: 'Selection Sets',
          addRule: 'Add rule',
          ruleField: 'Field',
          ruleOperator: 'Operator',
          ruleValue: 'Value',
          matchedElements: 'Matched elements',
          clashDetection: 'Clash Detection',
          setA: 'Set A',
          setB: 'Set B',
          toleranceMm: 'Tolerance (mm)',
          runClashTest: 'Run Clash Test',
          clashResults: 'Results',
          elementA: 'Element A',
          elementB: 'Element B',
          distance: 'Distance',
          flyTo: 'Fly to',
        },
      },
    },
    de: {
```

### Change 6b — add ruleCount, toleranceMm, clashResults to EN inspector.fields

```
old_string:
            startingView: 'Starting View',
          },
          planView: {

new_string:
            startingView: 'Starting View',
            ruleCount: 'Rules',
            toleranceMm: 'Tolerance (mm)',
            clashResults: 'Clash results',
          },
          planView: {
```

### Change 6c — add coordination section in DE (after DE familyEditor closes, before i18n closing)

```
old_string:
          loadIntoProject: 'In Projekt laden',
        },
      },
    },
  },
});

new_string:
          loadIntoProject: 'In Projekt laden',
        },
        coordination: {
          selectionSets: 'Auswahl-Sets',
          addRule: 'Regel hinzufügen',
          ruleField: 'Feld',
          ruleOperator: 'Operator',
          ruleValue: 'Wert',
          matchedElements: 'Übereinstimmende Elemente',
          clashDetection: 'Kollisionsprüfung',
          setA: 'Gruppe A',
          setB: 'Gruppe B',
          toleranceMm: 'Toleranz (mm)',
          runClashTest: 'Kollisionstest starten',
          clashResults: 'Ergebnisse',
          elementA: 'Element A',
          elementB: 'Element B',
          distance: 'Abstand',
          flyTo: 'Anzeigen',
        },
      },
    },
  },
});
```

### Change 6d — add ruleCount, toleranceMm, clashResults to DE inspector.fields

```
old_string:
            startingView: 'Startansicht',
          },
          planView: {

new_string:
            startingView: 'Startansicht',
            ruleCount: 'Regeln',
            toleranceMm: 'Toleranz (mm)',
            clashResults: 'Kollisionsergebnisse',
          },
          planView: {
```

---

## Tests

### `packages/web/src/coordination/SelectionSetPanel.test.tsx`

1. **renders with no rules** — render `<SelectionSetPanel el={…} elements={{}} />`; assert "Add rule" button present and matched count is 0.
2. **add rule** — click "Add rule"; assert one rule row appears.
3. **remove rule** — add a rule then click `×`; assert rule row disappears.
4. **category filter match** — render with a `wall` element in `elements`; add rule `{ field: 'category', operator: 'equals', value: 'wall' }`; assert matched count is 1.

### `packages/web/src/coordination/ClashTestPanel.test.tsx`

1. **renders set counts** — render with `setAIds: ['a', 'b']`; assert "2" appears in the document.
2. **run clash test stub** — spy on `console.warn`; click "Run Clash Test"; assert `console.warn` called with `'run-clash-test stub'`.
3. **fly to result** — render with `results: [{ elementIdA: 'e1', elementIdB: 'e2', distanceMm: 10 }]`; click "Fly to"; assert `console.warn` called with `'fly-to-clash'`.

### `packages/web/src/state/store.viewpoint-visibility.test.ts`

1. **parses hiddenElementIds** — call `coerceElement({ kind: 'viewpoint', hiddenElementIds: ['e1'] })`; assert result has `hiddenElementIds: ['e1']`.
2. **parses isolatedElementIds** — same for `isolatedElementIds`.
3. **parses selection_set** — call with `{ kind: 'selection_set', filterRules: [{ field: 'category', operator: 'equals', value: 'wall' }] }`; assert `filterRules[0].field === 'category'`.
4. **parses clash_test** — call with `{ kind: 'clash_test', setAIds: ['a'], setBIds: ['b'], toleranceMm: 25 }`; assert `toleranceMm === 25`.
