import type { JSX } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  referencePlanes: Array<{ id: string; name: string }>;
  currentWorkPlaneId: string | null;
  onApply: (refPlaneId: string | null) => void;
}

export function SetWorkPlaneDialog({
  open,
  onClose,
  referencePlanes,
  currentWorkPlaneId,
  onApply,
}: Props): JSX.Element | null {
  if (!open) return null;
  return (
    <dialog open data-testid="set-work-plane-dialog" className="modal-base">
      <h2 className="text-sm font-medium mb-3">Set Work Plane</h2>
      <div className="mb-3">
        <label className="text-xs text-muted block mb-1">Reference Plane</label>
        <select
          data-testid="set-work-plane-select"
          defaultValue={currentWorkPlaneId ?? ''}
          className="w-full text-xs border border-border rounded px-2 py-1"
          onChange={(e) => onApply(e.currentTarget.value || null)}
        >
          <option value="">None</option>
          {referencePlanes.map((rp) => (
            <option key={rp.id} value={rp.id}>
              {rp.name || `Ref Plane ${rp.id.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          className="btn-secondary text-xs"
          onClick={onClose}
          data-testid="set-work-plane-cancel"
        >
          Cancel
        </button>
        <button className="btn-primary text-xs" onClick={onClose} data-testid="set-work-plane-ok">
          OK
        </button>
      </div>
    </dialog>
  );
}
