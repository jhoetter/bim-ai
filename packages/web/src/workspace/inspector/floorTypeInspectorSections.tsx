import { useState, type JSX } from 'react';

export function FloorNewTypeRow({
  onPropertyChange,
  onDispatchCommand,
}: {
  floorId: string;
  onPropertyChange?: (property: string, value: unknown) => void;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('New Floor Type');
  if (!open) {
    return (
      <button
        type="button"
        data-testid="inspector-floor-new-type"
        className="self-start text-xs text-muted hover:text-foreground border border-border rounded px-2 py-0.5"
        onClick={() => setOpen(true)}
      >
        New Floor Type…
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        data-testid="inspector-floor-new-type-name"
        className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        data-testid="inspector-floor-new-type-confirm"
        className="shrink-0 text-xs border border-border rounded px-2 py-0.5 hover:bg-surface-strong"
        onClick={() => {
          const newId = crypto.randomUUID();
          onDispatchCommand?.({
            type: 'create_floor_type',
            id: newId,
            name: name.trim() || 'New Floor Type',
            layers: [{ thicknessMm: 200, function: 'structure', materialKey: null }],
          });
          onPropertyChange?.('floorTypeId', newId);
          setOpen(false);
          setName('New Floor Type');
        }}
      >
        Create
      </button>
      <button
        type="button"
        className="shrink-0 text-xs text-muted hover:text-foreground"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </div>
  );
}
