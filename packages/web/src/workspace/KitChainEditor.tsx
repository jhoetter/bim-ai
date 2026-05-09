/**
 * AST-V3-04 — KitChainEditor
 *
 * Inspector panel for family_kit_instance elements.
 * Renders a horizontal chain of component chips with:
 *   - Drag right-edge to resize -> dispatches UpdateKitComponentCmd on mouse-up
 *   - Live 60-fps rebalance via solveChain() while dragging
 *   - Click chip to expand inline parameter editor (door style + material)
 *   - "+ Add component" button appended at end
 *
 * No hex literals -- uses design-token CSS custom properties only.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { FamilyKitInstanceElem, KitComponent, UpdateKitComponentCmd } from '@bim-ai/core';
import { solveChain, type ResolvedComponent } from './kitSolver';

const DOOR_STYLES = ['shaker', 'flat', 'beaded', 'glazed'] as const;
const COMPONENT_KINDS: KitComponent['componentKind'][] = [
  'base',
  'upper',
  'oven_housing',
  'sink',
  'pantry',
  'countertop',
  'end_panel',
  'dishwasher',
  'fridge',
];

const CHIP_HEIGHT_PX = 48;
const MIN_WIDTH_MM = 100;

function kindLabel(kind: KitComponent['componentKind']): string {
  return kind.replace(/_/g, ' ');
}

interface ChipProps {
  resolved: ResolvedComponent;
  index: number;
  selected: boolean;
  totalRunMm: number;
  containerWidthPx: number;
  onSelect: (index: number) => void;
  onResizeDragStart: (index: number, startX: number, startWidthMm: number) => void;
}

function KitChip({
  resolved,
  index,
  selected,
  totalRunMm,
  containerWidthPx,
  onSelect,
  onResizeDragStart,
}: ChipProps): JSX.Element {
  const scale = totalRunMm > 0 ? containerWidthPx / totalRunMm : 0.06;
  const widthPx = Math.max(resolved.widthMm * scale, 32);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      style={{
        width: `${widthPx}px`,
        height: `${CHIP_HEIGHT_PX}px`,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: selected ? 'var(--color-accent-soft)' : 'var(--color-surface)',
        border: selected
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        borderRadius: '4px',
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'background 0.1s',
      }}
      onClick={() => onSelect(index)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(index)}
    >
      <span
        style={{
          fontSize: '10px',
          color: 'var(--color-foreground)',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          paddingLeft: '4px',
          paddingRight: '10px',
        }}
      >
        {kindLabel(resolved.componentKind)}
      </span>
      <div
        role="separator"
        aria-label="Resize"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'ew-resize',
          background: 'var(--color-border-strong)',
          opacity: 0.4,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeDragStart(index, e.clientX, resolved.widthMm);
        }}
      />
    </div>
  );
}

interface ExpandedEditorProps {
  comp: KitComponent;
  index: number;
  onClose: () => void;
  onUpdate: (cmd: Omit<UpdateKitComponentCmd, 'type' | 'id'>) => void;
}

function ExpandedEditor({ comp, index, onClose, onUpdate }: ExpandedEditorProps): JSX.Element {
  const [doorStyle, setDoorStyle] = useState(comp.doorStyle ?? '');
  const [materialId, setMaterialId] = useState(comp.materialId ?? '');
  const [widthMm, setWidthMm] = useState(comp.widthMm != null ? String(comp.widthMm) : '');

  const handleApply = () => {
    const patch: Omit<UpdateKitComponentCmd, 'type' | 'id'> = { componentIndex: index };
    if (widthMm !== '') {
      const v = parseFloat(widthMm);
      if (Number.isFinite(v) && v >= MIN_WIDTH_MM) patch.widthMm = v;
    }
    if (doorStyle !== '') patch.doorStyle = doorStyle;
    if (materialId !== '') patch.materialId = materialId;
    onUpdate(patch);
    onClose();
  };

  return (
    <div
      style={{
        padding: '8px',
        background: 'var(--color-surface-muted)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', width: 72 }}>
          Width mm
        </span>
        <input
          type="number"
          value={widthMm}
          min={MIN_WIDTH_MM}
          step={50}
          placeholder="auto"
          onChange={(e) => setWidthMm(e.target.value)}
          style={{
            flex: 1,
            fontSize: '12px',
            padding: '2px 4px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            color: 'var(--color-foreground)',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', width: 72 }}>
          Door style
        </span>
        <select
          value={doorStyle}
          onChange={(e) => setDoorStyle(e.target.value)}
          style={{
            flex: 1,
            fontSize: '12px',
            padding: '2px 4px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            color: 'var(--color-foreground)',
          }}
        >
          <option value="">-- inherit --</option>
          {DOOR_STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)', width: 72 }}>
          Material ID
        </span>
        <input
          type="text"
          value={materialId}
          placeholder="inherit"
          onChange={(e) => setMaterialId(e.target.value)}
          style={{
            flex: 1,
            fontSize: '12px',
            padding: '2px 4px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            color: 'var(--color-foreground)',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            cursor: 'pointer',
            color: 'var(--color-foreground)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            background: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            borderRadius: '3px',
            cursor: 'pointer',
            color: 'var(--color-accent-foreground)',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export interface KitChainEditorProps {
  kit: FamilyKitInstanceElem;
  onUpdateComponent: (cmd: UpdateKitComponentCmd) => void;
  onAddComponent?: (kind: KitComponent['componentKind']) => void;
}

/**
 * Horizontal chain editor for a placed kitchen kit.
 * Shown in the Inspector when a family_kit_instance is selected.
 */
export function KitChainEditor({
  kit,
  onUpdateComponent,
  onAddComponent,
}: KitChainEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(280);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const dragRef = useRef<{
    index: number;
    startX: number;
    startWidthMm: number;
  } | null>(null);

  const [liveComponents, setLiveComponents] = useState<KitComponent[]>(() => kit.components);

  useEffect(() => {
    setLiveComponents(kit.components);
  }, [kit.components]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 280);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const totalRunMm = kit.endMm - kit.startMm;

  const liveKit: FamilyKitInstanceElem = { ...kit, components: liveComponents };
  const resolved: ResolvedComponent[] = solveChain(liveKit);

  const handleResizeDragStart = useCallback(
    (index: number, startX: number, startWidthMm: number) => {
      dragRef.current = { index, startX, startWidthMm };
    },
    [],
  );

  useEffect(() => {
    let rafId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { index, startX, startWidthMm } = dragRef.current;
      const deltaMm = (e.clientX - startX) / (containerWidth / Math.max(totalRunMm, 1));
      const newWidthMm = Math.max(MIN_WIDTH_MM, startWidthMm + deltaMm);

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setLiveComponents((prev) => {
          const next = [...prev];
          const comp = next[index];
          if (comp) {
            next[index] = { ...comp, widthMm: newWidthMm };
          }
          return next;
        });
        rafId = null;
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { index, startX, startWidthMm } = dragRef.current;
      dragRef.current = null;
      const deltaMm = (e.clientX - startX) / (containerWidth / Math.max(totalRunMm, 1));
      const newWidthMm = Math.max(MIN_WIDTH_MM, startWidthMm + deltaMm);
      onUpdateComponent({
        type: 'update_kit_component',
        id: kit.id,
        componentIndex: index,
        widthMm: newWidthMm,
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [containerWidth, totalRunMm, kit.id, onUpdateComponent]);

  const handleUpdate = useCallback(
    (patch: Omit<UpdateKitComponentCmd, 'type' | 'id'>) => {
      onUpdateComponent({ type: 'update_kit_component', id: kit.id, ...patch });
    },
    [kit.id, onUpdateComponent],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-foreground)' }}>
          Kitchen kit -- {(totalRunMm / 1000).toFixed(2)} m run
        </span>
        <span style={{ fontSize: '10px', color: 'var(--color-muted-foreground)' }}>
          {resolved.length} component{resolved.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: '2px',
          overflowX: 'auto',
          padding: '2px',
          background: 'var(--color-surface-muted)',
          borderRadius: '4px',
          minHeight: `${CHIP_HEIGHT_PX + 4}px`,
        }}
      >
        {resolved.map((r, i) => (
          <KitChip
            key={i}
            resolved={r}
            index={i}
            selected={selectedIndex === i}
            totalRunMm={totalRunMm}
            containerWidthPx={containerWidth - 8}
            onSelect={(idx) => setSelectedIndex((prev) => (prev === idx ? null : idx))}
            onResizeDragStart={handleResizeDragStart}
          />
        ))}
        <button
          type="button"
          title="Add component"
          onClick={() => setShowAddMenu((v) => !v)}
          style={{
            flexShrink: 0,
            width: '28px',
            height: `${CHIP_HEIGHT_PX}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-surface)',
            border: '1px dashed var(--color-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--color-muted-foreground)',
            fontSize: '18px',
          }}
        >
          +
        </button>
      </div>

      {showAddMenu && onAddComponent && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '6px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
          }}
        >
          {COMPONENT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onAddComponent(k);
                setShowAddMenu(false);
              }}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border)',
                borderRadius: '3px',
                cursor: 'pointer',
                color: 'var(--color-foreground)',
              }}
            >
              {kindLabel(k)}
            </button>
          ))}
        </div>
      )}

      {selectedIndex !== null && liveComponents[selectedIndex] && (
        <ExpandedEditor
          comp={liveComponents[selectedIndex]}
          index={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
