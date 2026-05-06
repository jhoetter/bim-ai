# WP-V2-12 — Collaboration V2

## Branch

`feat/wp-v2-12-collaboration`

## Goal

Add Worksets (named workset assignment on elements), Copy/Monitor (linked model tracking for levels and grid lines), Purge Unused UI stub, and Starting View project setting.

## Done rule

(a) `pnpm exec tsc --noEmit` clean; (b) all new logic has vitest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

---

## File 1 — `packages/core/src/index.ts`

These edits modify EXISTING shapes in the MIDDLE of the Element union. Apply each independently.

### Change 1a — add `worksetId` + `startingViewId` to `project_settings` shape

```
old_string:
      kind: 'project_settings';
      id: string;
      lengthUnit?: string;
      angularUnitDeg?: string;
      displayLocale?: string;
      name?: string;
    }

new_string:
      kind: 'project_settings';
      id: string;
      lengthUnit?: string;
      angularUnitDeg?: string;
      displayLocale?: string;
      name?: string;
      worksetId?: string | null;
      startingViewId?: string | null;
    }
```

### Change 1b — add `worksetId` + `monitorSourceId` to `level` shape

```
old_string:
      kind: 'level';
      id: string;
      name: string;
      elevationMm: number;
      datumKind?: string | null;
      parentLevelId?: string | null;
      offsetFromParentMm?: number;
    }

new_string:
      kind: 'level';
      id: string;
      name: string;
      elevationMm: number;
      datumKind?: string | null;
      parentLevelId?: string | null;
      offsetFromParentMm?: number;
      worksetId?: string | null;
      monitorSourceId?: string | null;
    }
```

### Change 1c — add `worksetId` to `wall` shape

```
old_string:
      locationLine?: WallLocationLine;
    }
  | {
      kind: 'door';

new_string:
      locationLine?: WallLocationLine;
      worksetId?: string | null;
    }
  | {
      kind: 'door';
```

### Change 1d — add `worksetId` + `monitorSourceId` to `grid_line` shape

```
old_string:
      kind: 'grid_line';
      id: string;
      name: string;
      start: XY;
      end: XY;
      label: string;
      levelId?: string | null;
    }

new_string:
      kind: 'grid_line';
      id: string;
      name: string;
      start: XY;
      end: XY;
      label: string;
      levelId?: string | null;
      worksetId?: string | null;
      monitorSourceId?: string | null;
    }
```

### Change 1e — add `worksetId` to `floor` shape

```
old_string:
      kind: 'floor';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      thicknessMm: number;
      structureThicknessMm?: number;
      finishThicknessMm?: number;
      floorTypeId?: string | null;
      insulationExtensionMm?: number;
      roomBounded?: boolean;
    }

new_string:
      kind: 'floor';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      thicknessMm: number;
      structureThicknessMm?: number;
      finishThicknessMm?: number;
      floorTypeId?: string | null;
      insulationExtensionMm?: number;
      roomBounded?: boolean;
      worksetId?: string | null;
    }
```

---

## File 2 — `packages/web/src/state/store.ts`

### Change 2a — level parser: add worksetId + monitorSourceId

```
old_string:
      offsetFromParentMm: Number(raw.offsetFromParentMm ?? raw.offset_from_parent_mm ?? 0),
    };
  }

  if (kind === 'wall') {

new_string:
      offsetFromParentMm: Number(raw.offsetFromParentMm ?? raw.offset_from_parent_mm ?? 0),
      ...(raw.worksetId ?? raw.workset_id
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
      ...(raw.monitorSourceId ?? raw.monitor_source_id
        ? { monitorSourceId: String(raw.monitorSourceId ?? raw.monitor_source_id) }
        : {}),
    };
  }

  if (kind === 'wall') {
```

### Change 2b — wall parser: add worksetId

```
old_string:
      ...(raw.locationLine || raw.location_line
        ? {
            locationLine: String(
              raw.locationLine ?? raw.location_line,
            ) as import('@bim-ai/core').WallLocationLine,
          }
        : {}),
    };
  }

  if (kind === 'door') {

new_string:
      ...(raw.locationLine || raw.location_line
        ? {
            locationLine: String(
              raw.locationLine ?? raw.location_line,
            ) as import('@bim-ai/core').WallLocationLine,
          }
        : {}),
      ...(raw.worksetId ?? raw.workset_id
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
    };
  }

  if (kind === 'door') {
```

### Change 2c — grid_line parser: add worksetId + monitorSourceId

```
old_string:
      levelId: typeof lid === 'string' ? lid : null,
    };
  }

  if (kind === 'dimension') {

new_string:
      levelId: typeof lid === 'string' ? lid : null,
      ...(raw.worksetId ?? raw.workset_id
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
      ...(raw.monitorSourceId ?? raw.monitor_source_id
        ? { monitorSourceId: String(raw.monitorSourceId ?? raw.monitor_source_id) }
        : {}),
    };
  }

  if (kind === 'dimension') {
```

### Change 2d — project_settings parser: add worksetId + startingViewId

```
old_string:
      displayLocale: String(raw.displayLocale ?? raw.display_locale ?? 'en-US'),
    };
  }

  if (kind === 'room_color_scheme') {

new_string:
      displayLocale: String(raw.displayLocale ?? raw.display_locale ?? 'en-US'),
      ...(raw.worksetId ?? raw.workset_id
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
      ...(raw.startingViewId ?? raw.starting_view_id
        ? { startingViewId: String(raw.startingViewId ?? raw.starting_view_id) }
        : {}),
    };
  }

  if (kind === 'room_color_scheme') {
```

### Change 2e — floor parser: add worksetId

```
old_string:
      roomBounded: Boolean(raw.roomBounded ?? raw.room_bounded),
    };
  }

  if (kind === 'roof') {

new_string:
      roomBounded: Boolean(raw.roomBounded ?? raw.room_bounded),
      ...(raw.worksetId ?? raw.workset_id
        ? { worksetId: String(raw.worksetId ?? raw.workset_id) }
        : {}),
    };
  }

  if (kind === 'roof') {
```

---

## File 3 — `packages/web/src/workspace/InspectorContent.tsx`

### Change 3a — wall case: add workset row before closing `</div>`

The wall case ends with a `wallType` `<select>` block. Add the workset FieldRow after the closing `</div>` of that select wrapper, before the outer `</div>`.

```
old_string:
            </select>
          </div>
        </div>
      );
    }
    case 'door':

new_string:
            </select>
          </div>
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
        </div>
      );
    }
    case 'door':
```

### Change 3b — floor case: add workset row before closing `</div>`

The floor case ends with a `floorType` `<select>` block. Add the workset FieldRow after the closing `</div>` of that select wrapper, before the outer `</div>`.

```
old_string:
                ))}
            </select>
          </div>
        </div>
      );
    }
    case 'roof': {

new_string:
                ))}
            </select>
          </div>
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
        </div>
      );
    }
    case 'roof': {
```

### Change 3c — level case: add workset + monitorSource rows

```
old_string:
    case 'level':
      return (
        <div>
          <FieldRow label={f('elevation')} value={fmtMm(el.elevationMm)} />
          <FieldRow label={f('datumKind')} value={el.datumKind ?? '—'} mono />
        </div>
      );
    case 'section_cut':

new_string:
    case 'level':
      return (
        <div>
          <FieldRow label={f('elevation')} value={fmtMm(el.elevationMm)} />
          <FieldRow label={f('datumKind')} value={el.datumKind ?? '—'} mono />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {el.monitorSourceId ? (
            <FieldRow label={f('monitorSource')} value={el.monitorSourceId} mono />
          ) : null}
        </div>
      );
    case 'section_cut':
```

### Change 3d — add `grid_line` and `project_settings` cases before `default:`

```
old_string:
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow label={f('colorFillLegend')} value={el.planViewId} mono />
          <FieldRow label={f('schemeField')} value={el.schemeField} />
        </div>
      );
    default:

new_string:
    case 'color_fill_legend':
      return (
        <div>
          <FieldRow label={f('colorFillLegend')} value={el.planViewId} mono />
          <FieldRow label={f('schemeField')} value={el.schemeField} />
        </div>
      );
    case 'grid_line':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('workset')} value={el.worksetId ?? '—'} mono />
          {el.monitorSourceId ? (
            <FieldRow label={f('monitorSource')} value={el.monitorSourceId} mono />
          ) : null}
        </div>
      );
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
```

---

## File 4 — NEW `packages/web/src/collaboration/PurgeUnusedPanel.tsx`

Create this file. It is a self-contained React component for the Purge Unused workflow.

**Behaviour:**

- State: `phase: 'idle' | 'confirming' | 'done'` (default `'idle'`)
- `idle` phase: button "Purge Unused…" → sets phase to `'confirming'`
- `confirming` phase:
  - Show text: "This will remove unreferenced types, materials, and families (3 passes)."
  - Button "Confirm Purge" → calls `console.warn('purge-unused stub')` then sets phase to `'done'`
  - Button "Cancel" → sets phase to `'idle'`
- `done` phase: show text "Purge complete." and a "Close" button that resets phase to `'idle'`

**Imports to use:**

```typescript
import { useState, type JSX } from 'react';
```

---

## File 5 — `packages/web/src/i18n.ts`

### Change 5a — add workset/monitorSource/startingView to EN inspector.fields

```
old_string:
            roofType: 'Roof Type',
          },
          planView: {

new_string:
            roofType: 'Roof Type',
            workset: 'Workset',
            monitorSource: 'Monitor Source',
            startingView: 'Starting View',
          },
          planView: {
```

### Change 5b — add workset/monitorSource/startingView to DE inspector.fields

```
old_string:
            roofType: 'Dachtyp',
          },
          planView: {

new_string:
            roofType: 'Dachtyp',
            workset: 'Arbeitsbereich',
            monitorSource: 'Überwachungsquelle',
            startingView: 'Startansicht',
          },
          planView: {
```

---

## Tests

Create `packages/web/src/collaboration/PurgeUnusedPanel.test.tsx` (vitest + @testing-library/react):

1. **renders idle state** — render `<PurgeUnusedPanel />`; assert "Purge Unused…" button is in the document.
2. **transitions to confirming** — click "Purge Unused…"; assert "Confirm Purge" and "Cancel" buttons appear.
3. **cancel returns to idle** — click "Purge Unused…" then "Cancel"; assert "Purge Unused…" button is back.
4. **confirm purge** — spy on `console.warn`; click "Purge Unused…" then "Confirm Purge"; assert `console.warn` was called with `'purge-unused stub'` and "Purge complete." text appears.

Create `packages/web/src/workspace/InspectorContent.workset.test.tsx` (vitest + @testing-library/react):

1. **wall workset row** — call `InspectorPropertiesFor` with a wall element with `worksetId: 'WS-1'`; render the result; assert "Workset" label and "WS-1" value appear.
2. **level monitorSource row** — call `InspectorPropertiesFor` with a level element with `monitorSourceId: 'linked-L1'`; render the result; assert "Monitor Source" label and "linked-L1" value appear.
3. **grid_line case** — call `InspectorPropertiesFor` with a grid_line element; render; assert the element name appears.
4. **project_settings startingView** — call `InspectorPropertiesFor` with a project_settings element with `startingViewId: 'view-1'`; render; assert "Starting View" label appears.
