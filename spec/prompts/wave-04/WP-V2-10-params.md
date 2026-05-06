# WP-V2-10 — Parameters + Shared Parameters

**Branch:** `feat/wp-v2-10-params`
**Wave:** 4, Batch B (start ONLY after WP-V2-09 is merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-10 → `done` when merged.

---

## Branch setup (run AFTER WP-V2-09 merged to main)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-10-params
git branch --show-current   # must print: feat/wp-v2-10-params
```

Verify that `packages/core/src/index.ts` already contains `'color_fill_legend'` in `ElemKind`
before making any edits — this is the anchor for the new ElemKind entries in this WP.

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/Workspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## Context

**Already implemented — do NOT re-implement:**
- Sort field + descending checkbox in `ScheduleDefinitionToolbar.tsx` (`sortBy`, `sortDescending`)
- Group-by checkboxes in `ScheduleDefinitionToolbar.tsx` (`groupKeys` / `groupingHint`)
- Totals readout in `schedulePayloadTotals.ts` (per-category hard-coded totals already exist)

**This WP adds:**
1. `shared_param_file` element type: a project-level document storing named parameter groups
2. `project_param` element type: one entry that assigns a shared param to element categories
3. `aggregation` field on schedule preset field definitions (per-column Calculate Totals)
4. `ScheduleDefinitionToolbar` Calculate Totals section: per-column aggregation selector
5. Inspector cases for `shared_param_file` and `project_param`
6. i18n keys (EN + DE)

---

## Files to touch

| File                                                         | Change                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `packages/core/src/index.ts`                                 | Add 2 new ElemKinds + element shapes                     |
| `packages/web/src/state/store.ts`                            | Parse `shared_param_file` and `project_param`            |
| `packages/web/src/schedules/scheduleDefinitionPresets.ts`    | Add `aggregation` to preset field type + preset entries  |
| `packages/web/src/schedules/ScheduleDefinitionToolbar.tsx`   | Add Calculate Totals section with per-column selectors   |
| `packages/web/src/workspace/InspectorContent.tsx`            | Add 2 inspector cases                                    |
| `packages/web/src/i18n.ts`                                   | Add keys (EN + DE)                                       |

Read all 6 files in a single parallel batch before making any edits.

---

## Changes

### 1. `packages/core/src/index.ts`

**Edit 1 — add 2 new ElemKinds** (after `'color_fill_legend'`):

Old:
```ts
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'color_fill_legend';
```

New:
```ts
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'color_fill_legend'
  | 'shared_param_file'
  | 'project_param';
```

**Edit 2 — append 2 element shapes to Element union** (after the closing `};` of the `color_fill_legend` shape):

Old:
```ts
  | {
      kind: 'color_fill_legend';
      id: string;
      name: string;
      planViewId: string;
      positionMm: XY;
      schemeField: string;
    };
```

New:
```ts
  | {
      kind: 'color_fill_legend';
      id: string;
      name: string;
      planViewId: string;
      positionMm: XY;
      schemeField: string;
    }
  | {
      kind: 'shared_param_file';
      id: string;
      name: string;
      groups: SharedParamGroup[];
    }
  | {
      kind: 'project_param';
      id: string;
      name: string;
      sharedParamGuid: string;
      categories: string[];
      instanceOrType: 'instance' | 'type';
    };
```

**Edit 3 — add `SharedParamGroup` and `SharedParamEntry` types** (insert before the `export type Element` line):

Old:
```ts
export type Element =
  | {
      kind: 'project_settings';
```

New:
```ts
export type SharedParamEntry = {
  guid: string;
  name: string;
  dataType: 'text' | 'number' | 'integer' | 'yesno' | 'length' | 'area' | 'volume';
};

export type SharedParamGroup = {
  groupName: string;
  parameters: SharedParamEntry[];
};

export type Element =
  | {
      kind: 'project_settings';
```

---

### 2. `packages/web/src/state/store.ts`

**Edit — parse `shared_param_file` and `project_param`** (insert two `if` blocks just before the `return null;` at the end of the element parser, after the existing `color_fill_legend` block added by WP-V2-09):

Old:
```ts
  if (kind === 'color_fill_legend') {
    return {
      kind: 'color_fill_legend',
      id,
      name,
      planViewId: String(raw.planViewId ?? raw.plan_view_id ?? ''),
      positionMm: coerceXY((raw.positionMm ?? raw.position_mm ?? {}) as Record<string, unknown>),
      schemeField: String(raw.schemeField ?? raw.scheme_field ?? 'programmeCode'),
    };
  }

  return null;
}
```

New:
```ts
  if (kind === 'color_fill_legend') {
    return {
      kind: 'color_fill_legend',
      id,
      name,
      planViewId: String(raw.planViewId ?? raw.plan_view_id ?? ''),
      positionMm: coerceXY((raw.positionMm ?? raw.position_mm ?? {}) as Record<string, unknown>),
      schemeField: String(raw.schemeField ?? raw.scheme_field ?? 'programmeCode'),
    };
  }

  if (kind === 'shared_param_file') {
    const rawGroups = raw.groups ?? raw.param_groups;
    const groups = Array.isArray(rawGroups)
      ? rawGroups.map((g: Record<string, unknown>) => ({
          groupName: String(g.groupName ?? g.group_name ?? ''),
          parameters: Array.isArray(g.parameters)
            ? g.parameters.map((p: Record<string, unknown>) => ({
                guid: String(p.guid ?? ''),
                name: String(p.name ?? ''),
                dataType: String(p.dataType ?? p.data_type ?? 'text') as
                  | 'text'
                  | 'number'
                  | 'integer'
                  | 'yesno'
                  | 'length'
                  | 'area'
                  | 'volume',
              }))
            : [],
        }))
      : [];
    return { kind: 'shared_param_file', id, name, groups };
  }

  if (kind === 'project_param') {
    const rawCats = raw.categories ?? raw.param_categories;
    const iot = raw.instanceOrType ?? raw.instance_or_type;
    return {
      kind: 'project_param',
      id,
      name,
      sharedParamGuid: String(raw.sharedParamGuid ?? raw.shared_param_guid ?? ''),
      categories: Array.isArray(rawCats)
        ? rawCats.filter((x): x is string => typeof x === 'string')
        : [],
      instanceOrType: iot === 'type' ? 'type' : 'instance',
    };
  }

  return null;
}
```

---

### 3. `packages/web/src/schedules/scheduleDefinitionPresets.ts`

**Edit 1 — add `aggregation` to `ScheduleDefinitionPresetField` type:**

Old:
```ts
export type ScheduleDefinitionPresetField = {
  fieldKey: string;
  token: SchedulePresetFieldToken;
  /** Human unit cue when label does not spell it out (e.g. "m²"). */
  unitHint?: string;
  /** Short note for CSV / API export consumers. */
  csvExportHint?: string;
};
```

New:
```ts
export type ScheduleAggregation = 'sum' | 'average' | 'min' | 'max' | 'count';

export type ScheduleDefinitionPresetField = {
  fieldKey: string;
  token: SchedulePresetFieldToken;
  /** Human unit cue when label does not spell it out (e.g. "m²"). */
  unitHint?: string;
  /** Short note for CSV / API export consumers. */
  csvExportHint?: string;
  /** Footer aggregation for Calculate Totals (null = no footer). */
  aggregation?: ScheduleAggregation | null;
};
```

**Edit 2 — add `aggregation` to the room-core-area preset for numeric fields:**

Old:
```ts
      { fieldKey: 'areaM2', token: 'required', unitHint: 'm²', csvExportHint: 'Derived area' },
      { fieldKey: 'perimeterM', token: 'optional', unitHint: 'm' },
      { fieldKey: 'targetAreaM2', token: 'optional', unitHint: 'm²' },
      { fieldKey: 'areaDeltaM2', token: 'optional', unitHint: 'm²' },
```

New:
```ts
      { fieldKey: 'areaM2', token: 'required', unitHint: 'm²', csvExportHint: 'Derived area', aggregation: 'sum' },
      { fieldKey: 'perimeterM', token: 'optional', unitHint: 'm', aggregation: 'sum' },
      { fieldKey: 'targetAreaM2', token: 'optional', unitHint: 'm²', aggregation: 'sum' },
      { fieldKey: 'areaDeltaM2', token: 'optional', unitHint: 'm²', aggregation: 'sum' },
```

---

### 4. `packages/web/src/schedules/ScheduleDefinitionToolbar.tsx`

Add a **Calculate Totals** section. It lists visible preset fields that have `aggregation` defined
and lets the user toggle/change the aggregation per field. The selection is written into the
schedule element's `grouping.calculateTotals` record and committed via `onScheduleFiltersCommit`.

**Edit — add imports at the top of the file** (after existing imports):

Old:
```ts
import {
  levelFilterFieldForTab,
  scheduleGroupingKeyChoices,
  scheduleSortKeyChoices,
  type TabKey,
} from './scheduleUtils';
```

New:
```ts
import {
  levelFilterFieldForTab,
  scheduleGroupingKeyChoices,
  scheduleSortKeyChoices,
  type TabKey,
} from './scheduleUtils';
import {
  type ScheduleAggregation,
  getSchedulePresets,
} from './scheduleDefinitionPresets';
```

**Edit — add Calculate Totals section at the end of the toolbar JSX** (before the closing `</div>` of the toolbar root `div`):

Old:
```tsx
      ) : null}
    </div>
  );
}
```

New:
```tsx
      ) : null}

      {(() => {
        const presets = getSchedulePresets(tabToPresetCategory(tab) ?? 'room');
        const fieldsWithAgg = presets.flatMap((p) =>
          p.fields.filter((f2) => f2.aggregation != null),
        );
        const uniqueFields = Array.from(
          new Map(fieldsWithAgg.map((f2) => [f2.fieldKey, f2])).values(),
        );
        if (uniqueFields.length === 0) return null;

        const totalsRecord = (
          (el.grouping as { calculateTotals?: Record<string, ScheduleAggregation | null> }) ?? {}
        ).calculateTotals ?? {};

        return (
          <div className="mt-2">
            <div className="font-semibold text-foreground">Calculate Totals</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {uniqueFields.map((fd) => {
                const cur: ScheduleAggregation | null = totalsRecord[fd.fieldKey] ?? fd.aggregation ?? null;
                return (
                  <label key={fd.fieldKey} className="flex items-center gap-1">
                    <span className="font-mono">{fd.fieldKey}</span>
                    <select
                      className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-mono"
                      value={cur ?? ''}
                      onChange={(e2) => {
                        const v = e2.target.value as ScheduleAggregation | '';
                        const nextTotals = { ...totalsRecord, [fd.fieldKey]: v === '' ? null : v };
                        commit(f, {
                          ...(el.grouping as Record<string, unknown>),
                          sortBy: sortVal,
                          groupKeys: orderedHints(),
                          sortDescending: sortDesc,
                          calculateTotals: nextTotals,
                        });
                      }}
                    >
                      <option value="">— none —</option>
                      <option value="sum">sum</option>
                      <option value="average">average</option>
                      <option value="min">min</option>
                      <option value="max">max</option>
                      <option value="count">count</option>
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
```

**Also add the missing `tabToPresetCategory` import** (it's in `scheduleUtils.ts` already exported):

Old:
```ts
import {
  levelFilterFieldForTab,
  scheduleGroupingKeyChoices,
  scheduleSortKeyChoices,
  type TabKey,
} from './scheduleUtils';
```

New:
```ts
import {
  levelFilterFieldForTab,
  scheduleGroupingKeyChoices,
  scheduleSortKeyChoices,
  tabToPresetCategory,
  type TabKey,
} from './scheduleUtils';
```

**Also add the missing `getSchedulePresets` export to `scheduleDefinitionPresets.ts`** (append after the existing `getPresetsForCategory` if one exists, otherwise add a new function):

Check the file: if `getSchedulePresets` or `getPresetsForCategory` already exists, reuse it.
If neither exists, append to `scheduleDefinitionPresets.ts`:

```ts
export function getSchedulePresets(category: SchedulePresetCategory): ScheduleDefinitionPreset[] {
  return PRESETS.filter((p) => p.category === category);
}
```

---

### 5. `packages/web/src/workspace/InspectorContent.tsx`

**Edit — add 2 inspector cases** (just before `case 'color_fill_legend'`):

Old:
```tsx
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow label={f('colorFillLegend')} value={el.planViewId} mono />
          <FieldRow label={f('schemeField')} value={el.schemeField} />
        </div>
      );
```

New:
```tsx
    case 'shared_param_file':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('paramGroups')} value={String(el.groups.length)} />
        </div>
      );
    case 'project_param':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('paramGuid')} value={el.sharedParamGuid} mono />
          <FieldRow label={f('paramCategories')} value={el.categories.join(', ') || '—'} />
          <FieldRow label={f('instanceOrType')} value={el.instanceOrType} />
        </div>
      );
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow label={f('colorFillLegend')} value={el.planViewId} mono />
          <FieldRow label={f('schemeField')} value={el.schemeField} />
        </div>
      );
```

---

### 6. `packages/web/src/i18n.ts`

**English — add 4 keys to `inspector.fields`** (after `schemeField`, which was added by WP-V2-09):

Old:
```ts
            schemeField: 'Scheme field',
            wallType: 'Wall Type',
```

New:
```ts
            schemeField: 'Scheme field',
            paramGroups: 'Param groups',
            paramGuid: 'GUID',
            paramCategories: 'Categories',
            instanceOrType: 'Instance / Type',
            wallType: 'Wall Type',
```

**German — add 4 keys to `inspector.fields`** (after `schemeField` in the German block):

Old:
```ts
            schemeField: 'Schemafeld',
            wallType: 'Wandtyp',
```

New:
```ts
            schemeField: 'Schemafeld',
            paramGroups: 'Parametergruppen',
            paramGuid: 'GUID',
            paramCategories: 'Kategorien',
            instanceOrType: 'Instanz / Typ',
            wallType: 'Wandtyp',
```

---

## Tests to run

```bash
pnpm --filter web typecheck
pnpm --filter web exec vitest run
```

TypeScript must have 0 errors. All existing vitest tests must pass.

---

## New test coverage to add

Append to `packages/web/src/schedules/scheduleDefinitionPresets.test.ts`
(check if the file exists; if not, create it):

```ts
import { describe, expect, it } from 'vitest';

import { getSchedulePresets } from './scheduleDefinitionPresets';

describe('getSchedulePresets', () => {
  it('returns room presets with aggregation on areaM2', () => {
    const presets = getSchedulePresets('room');
    expect(presets.length).toBeGreaterThan(0);
    const coreArea = presets.find((p) => p.id === 'room-core-area');
    expect(coreArea).toBeDefined();
    const areaField = coreArea?.fields.find((f) => f.fieldKey === 'areaM2');
    expect(areaField?.aggregation).toBe('sum');
  });

  it('returns empty array for unknown category', () => {
    const presets = getSchedulePresets('door');
    expect(Array.isArray(presets)).toBe(true);
  });
});
```

---

## Commit format

```bash
git add packages/core/src/index.ts \
        packages/web/src/state/store.ts \
        packages/web/src/schedules/scheduleDefinitionPresets.ts \
        packages/web/src/schedules/scheduleDefinitionPresets.test.ts \
        packages/web/src/schedules/ScheduleDefinitionToolbar.tsx \
        packages/web/src/workspace/InspectorContent.tsx \
        packages/web/src/i18n.ts
git commit -m "$(cat <<'EOF'
feat(params): WP-V2-10 — shared_param_file, project_param elements, schedule Calculate Totals per field

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-10-params
```
