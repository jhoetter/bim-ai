import { useState, type ReactElement } from 'react';
import type { Element } from '@bim-ai/core';
import { Icons, ICON_SIZE } from '@bim-ai/ui';

type ViewTemplateEditPanelProps = {
  template: Extract<Element, { kind: 'view_template' }>;
  elementsById: Record<string, Element>;
  modelId: string;
  onSave: (patch: {
    name?: string;
    scale?: number;
    detailLevel?: 'coarse' | 'medium' | 'fine';
    phase?: string;
    phaseFilter?: string;
  }) => Promise<void>;
  onClose: () => void;
};

export function ViewTemplateEditPanel({
  template,
  elementsById,
  onSave,
  onClose,
}: ViewTemplateEditPanelProps): ReactElement {
  const [name, setName] = useState(template.name);
  const [scale, setScale] = useState(template.scale != null ? String(template.scale) : '');
  const [detailLevel, setDetailLevel] = useState<'coarse' | 'medium' | 'fine' | ''>(
    template.detailLevel ?? '',
  );
  const [phase, setPhase] = useState(template.phase ?? '');
  const [phaseFilter, setPhaseFilter] = useState(template.phaseFilter ?? '');
  const [saving, setSaving] = useState(false);

  const phases = Object.values(elementsById).filter(
    (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Parameters<typeof onSave>[0] = {};
      if (name !== template.name) patch.name = name;
      const scaleNum = scale ? Number(scale) : undefined;
      if (scaleNum != null && Number.isFinite(scaleNum)) patch.scale = scaleNum;
      if (detailLevel) patch.detailLevel = detailLevel;
      if (phase) patch.phase = phase;
      if (phaseFilter) patch.phaseFilter = phaseFilter;
      await onSave(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-y-0 right-0 z-40 flex w-80 flex-col border-l bg-[var(--color-surface-strong)] shadow-xl"
      data-testid="view-template-edit-panel"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Edit View Template</span>
        <button
          type="button"
          aria-label="Close"
          title="Close"
          className="text-muted hover:text-foreground"
          onClick={onClose}
        >
          <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Name</span>
          <input
            type="text"
            className="rounded border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Scale</span>
          <input
            type="number"
            className="rounded border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            placeholder="e.g. 100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Detail level</span>
          <select
            className="rounded border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1"
            value={detailLevel}
            onChange={(e) => setDetailLevel(e.target.value as 'coarse' | 'medium' | 'fine' | '')}
          >
            <option value="">— inherit —</option>
            <option value="coarse">Coarse</option>
            <option value="medium">Medium</option>
            <option value="fine">Fine</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Phase</span>
          <select
            className="rounded border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          >
            <option value="">— none —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted">Phase filter</span>
          <select
            className="rounded border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
          >
            <option value="">— none —</option>
            <option value="all">All</option>
            <option value="existing">Existing</option>
            <option value="demolition">Demolition</option>
            <option value="new">New</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2 border-t px-4 py-3">
        <button
          type="button"
          disabled={saving}
          className="flex-1 rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50 hover:opacity-90"
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
