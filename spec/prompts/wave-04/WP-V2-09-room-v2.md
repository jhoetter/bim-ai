# WP-V2-09 — Room + Area V2

**Branch:** `feat/wp-v2-09-room-v2`
**Wave:** 4, Batch A (start after Wave 3 fully merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-09 → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-09-room-v2
git branch --show-current   # must print: feat/wp-v2-09-room-v2
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/Workspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## Context

**Already implemented — do NOT re-implement:**
- `room_separation` element: exists in `core/index.ts`, store, and `RoomSeparationAuthoringWorkbench.tsx`
- `upperLimitLevelId` field: exists in room element shape (core line 238) and store parser (store line 275)
- Room color scheme / color fill rendering: in `planProjectionWire.ts` and `roomColorSchemeCanon.ts`

**This WP adds:**
1. `volumeM3` optional field on the room element type (server-computed, client displays it)
2. `color_fill_legend` element type (placed on a plan view, shows the room color scheme legend)
3. Inspector: display `upperLimitLevelId` and `volumeM3` in the room Properties panel
4. Inspector: new case for `color_fill_legend` elements
5. Store: parse `volumeM3` when ingesting room elements; parse `color_fill_legend` elements
6. i18n keys (EN + DE)

---

## Files to touch

| File                                              | Change                                                       |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `packages/core/src/index.ts`                      | Add `volumeM3` to room shape; add `color_fill_legend` ElemKind + shape |
| `packages/web/src/state/store.ts`                 | Parse `volumeM3` for room; parse `color_fill_legend`         |
| `packages/web/src/workspace/InspectorContent.tsx` | Room inspector shows `upperLimitLevelId` + `volumeM3`; add `color_fill_legend` case |
| `packages/web/src/i18n.ts`                        | Add 4 keys in EN + DE                                        |

Read all 4 files in a single parallel batch before making any edits.

---

## Changes

### 1. `packages/core/src/index.ts`

**Edit 1 — add `volumeM3` to room element shape** (line 244, after `targetAreaM2`):

Old:
```ts
      targetAreaM2?: number | null;
    }
  | {
      kind: 'grid_line';
```

New:
```ts
      targetAreaM2?: number | null;
      volumeM3?: number | null;
    }
  | {
      kind: 'grid_line';
```

**Edit 2 — add `'color_fill_legend'` to ElemKind** (line 40, after `'ceiling'`):

Old:
```ts
  | 'column'
  | 'beam'
  | 'ceiling';
```

New:
```ts
  | 'column'
  | 'beam'
  | 'ceiling'
  | 'color_fill_legend';
```

**Edit 3 — append `color_fill_legend` element shape to Element union** (after the closing `};` of the ceiling shape, currently at the end of the union):

Old:
```ts
  | {
      kind: 'ceiling';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      heightOffsetMm: number;
      thicknessMm: number;
      ceilingTypeId?: string | null;
    };
```

New:
```ts
  | {
      kind: 'ceiling';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      heightOffsetMm: number;
      thicknessMm: number;
      ceilingTypeId?: string | null;
    }
  | {
      kind: 'color_fill_legend';
      id: string;
      name: string;
      planViewId: string;
      positionMm: XY;
      schemeField: string;
    };
```

---

### 2. `packages/web/src/state/store.ts`

**Edit 1 — parse `volumeM3` in the room block** (inside the `if (kind === 'room')` block, after the `targetAreaM2` spread, currently near line 295–304):

Old:
```ts
      ...(raw.targetAreaM2 !== undefined || raw.target_area_m2 !== undefined
        ? {
            targetAreaM2:
              raw.targetAreaM2 === null || raw.target_area_m2 === null
                ? null
                : Number(raw.targetAreaM2 ?? raw.target_area_m2),
          }
        : {}),
    };
  }
  if (kind === 'grid_line') {
```

New:
```ts
      ...(raw.targetAreaM2 !== undefined || raw.target_area_m2 !== undefined
        ? {
            targetAreaM2:
              raw.targetAreaM2 === null || raw.target_area_m2 === null
                ? null
                : Number(raw.targetAreaM2 ?? raw.target_area_m2),
          }
        : {}),
      ...(raw.volumeM3 !== undefined || raw.volume_m3 !== undefined
        ? {
            volumeM3:
              raw.volumeM3 === null || raw.volume_m3 === null
                ? null
                : Number(raw.volumeM3 ?? raw.volume_m3),
          }
        : {}),
    };
  }
  if (kind === 'grid_line') {
```

**Edit 2 — parse `color_fill_legend` elements** (insert a new `if` block just before the `return null;` at the end of the element parser function, currently after the `validation_rule` block):

Old:
```ts
  if (kind === 'validation_rule') {
    return {
      kind: 'validation_rule',
      id,
      name,
      ruleJson: (typeof raw.ruleJson === 'object' && raw.ruleJson
        ? raw.ruleJson
        : typeof raw.rule_json === 'object' && raw.rule_json
          ? raw.rule_json
          : {}) as Record<string, unknown>,
    };
  }

  return null;
}
```

New:
```ts
  if (kind === 'validation_rule') {
    return {
      kind: 'validation_rule',
      id,
      name,
      ruleJson: (typeof raw.ruleJson === 'object' && raw.ruleJson
        ? raw.ruleJson
        : typeof raw.rule_json === 'object' && raw.rule_json
          ? raw.rule_json
          : {}) as Record<string, unknown>,
    };
  }

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

---

### 3. `packages/web/src/workspace/InspectorContent.tsx`

**Edit 1 — extend room inspector to show `upperLimitLevelId` and `volumeM3`** (in `InspectorPropertiesFor`, `case 'room'`):

Old:
```tsx
    case 'room':
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
        </div>
      );
```

New:
```tsx
    case 'room':
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
          {el.upperLimitLevelId ? (
            <FieldRow label={f('upperLimit')} value={el.upperLimitLevelId} mono />
          ) : null}
          {el.volumeM3 != null ? (
            <FieldRow label={f('volume')} value={`${el.volumeM3.toFixed(3)} m³`} />
          ) : null}
        </div>
      );
```

**Edit 2 — add `color_fill_legend` inspector case** (in `InspectorPropertiesFor`, just before the `default:` at the end of the switch):

Old:
```tsx
    default:
      return <p className="text-sm text-muted">{t('inspector.noParams', { kind: el.kind })}</p>;
  }
}

export function InspectorConstraintsFor
```

New:
```tsx
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow label={f('colorFillLegend')} value={el.planViewId} mono />
          <FieldRow label={f('schemeField')} value={el.schemeField} />
        </div>
      );
    default:
      return <p className="text-sm text-muted">{t('inspector.noParams', { kind: el.kind })}</p>;
  }
}

export function InspectorConstraintsFor
```

---

### 4. `packages/web/src/i18n.ts`

**English — add 4 keys to `inspector.fields`** (after `cwHCount`):

Old:
```ts
            cwVCount: 'V bays',
            cwHCount: 'H rows',
            wallType: 'Wall Type',
```

New:
```ts
            cwVCount: 'V bays',
            cwHCount: 'H rows',
            upperLimit: 'Upper limit level',
            volume: 'Volume',
            colorFillLegend: 'Color Fill Legend',
            schemeField: 'Scheme field',
            wallType: 'Wall Type',
```

**German — add 4 keys to `inspector.fields`** (after `cwHCount` in the German block):

Old:
```ts
            cwVCount: 'V-Felder',
            cwHCount: 'H-Reihen',
            wallType: 'Wandtyp',
```

New:
```ts
            cwVCount: 'V-Felder',
            cwHCount: 'H-Reihen',
            upperLimit: 'Oberes Begrenzungslevel',
            volume: 'Volumen',
            colorFillLegend: 'Farblegende',
            schemeField: 'Schemafeld',
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

Append to `packages/web/src/schedules/scheduleTotalsReadout.test.ts`:

```ts
describe('scheduleTotalsReadoutParts — volumeM3 (room)', () => {
  it('includes volumeM3 in room totals when present', () => {
    const parts = scheduleTotalsReadoutParts({
      kind: 'room',
      rowCount: 2,
      areaM2: 50,
      perimeterM: 28,
      volumeM3: 125.5,
    });
    expect(parts.some((p) => p.includes('125.500'))).toBe(true);
  });
});
```

Also update `schedulePayloadTotals.ts` to surface `volumeM3` if present in room totals:

Old:
```ts
  if (kind === 'room') {
    parts.push(`sum area ${Number(totals.areaM2 ?? 0).toFixed(3)} m2`);
    parts.push(`sum perimeter ${Number(totals.perimeterM ?? 0).toFixed(3)} m`);
```

New:
```ts
  if (kind === 'room') {
    parts.push(`sum area ${Number(totals.areaM2 ?? 0).toFixed(3)} m2`);
    parts.push(`sum perimeter ${Number(totals.perimeterM ?? 0).toFixed(3)} m`);
    const vol = totals.volumeM3 ?? totals.volume_m3;
    if (vol != null && vol !== '' && Number.isFinite(Number(vol))) {
      parts.push(`sum volume ${Number(vol).toFixed(3)} m³`);
    }
```

---

## Commit format

```bash
git add packages/core/src/index.ts \
        packages/web/src/state/store.ts \
        packages/web/src/workspace/InspectorContent.tsx \
        packages/web/src/schedules/schedulePayloadTotals.ts \
        packages/web/src/schedules/scheduleTotalsReadout.test.ts \
        packages/web/src/i18n.ts
git commit -m "$(cat <<'EOF'
feat(rooms): WP-V2-09 — volumeM3 field, color_fill_legend element, upper limit inspector display

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-09-room-v2
```
