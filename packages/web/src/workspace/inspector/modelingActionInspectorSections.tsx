import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { FieldRow } from './inspectorRows';

type ModelingActionElement = Extract<
  Element,
  { kind: 'mass_box' | 'mass_extrusion' | 'mass_revolution' | 'detail_group' }
>;

type CommandDispatcher = (cmd: Record<string, unknown>) => void;

function MassInspectorSection({
  el,
  onDispatchCommand,
}: {
  el: Extract<Element, { kind: 'mass_box' | 'mass_extrusion' | 'mass_revolution' }>;
  onDispatchCommand?: CommandDispatcher;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {el.kind === 'mass_box' && (
        <>
          <FieldRow label="Width (mm)" value={String(el.widthMm)} />
          <FieldRow label="Depth (mm)" value={String(el.depthMm)} />
          <FieldRow label="Height (mm)" value={String(el.heightMm)} />
        </>
      )}
      {el.kind === 'mass_extrusion' && <FieldRow label="Height (mm)" value={String(el.heightMm)} />}
      <div className="border-t border-border pt-1">
        <div className="px-0 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Generate from Mass
        </div>
        <div className="flex flex-col gap-1 pt-0.5">
          <button
            type="button"
            data-testid="mass-gen-floors-btn"
            className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground text-left"
            onClick={() =>
              onDispatchCommand?.({ type: 'generate_floors_from_mass', massId: el.id })
            }
          >
            Generate Floors by Level
          </button>
          <button
            type="button"
            data-testid="mass-apply-curtain-btn"
            className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground text-left"
            onClick={() => onDispatchCommand?.({ type: 'apply_curtain_to_mass', massId: el.id })}
          >
            Apply Curtain System
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailGroupInspectorSection({
  el,
  onDispatchCommand,
}: {
  el: Extract<Element, { kind: 'detail_group' }>;
  onDispatchCommand?: CommandDispatcher;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <FieldRow label="Members" value={String(el.memberIds?.length ?? 0)} />
      <button
        type="button"
        data-testid="inspector-group-edit"
        className="rounded border border-border bg-surface-strong px-2 py-1 text-xs hover:bg-accent-soft self-start"
        onClick={() => onDispatchCommand?.({ type: 'editGroup', groupDefinitionId: el.id })}
      >
        Edit Group
      </button>
    </div>
  );
}

export function ModelingActionInspectorSection({
  el,
  onDispatchCommand,
}: {
  el: ModelingActionElement;
  onDispatchCommand?: CommandDispatcher;
}): JSX.Element {
  if (el.kind === 'detail_group') {
    return <DetailGroupInspectorSection el={el} onDispatchCommand={onDispatchCommand} />;
  }
  return <MassInspectorSection el={el} onDispatchCommand={onDispatchCommand} />;
}
