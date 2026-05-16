import type { JSX } from 'react';

import { useBimStore } from '../state/store';

export function GroupEditModeBar(): JSX.Element | null {
  const groupEditModeDefinitionId = useBimStore((s) => s.groupEditModeDefinitionId);
  const setGroupEditModeDefinitionId = useBimStore((s) => s.setGroupEditModeDefinitionId);
  const groupRegistry = useBimStore((s) => s.groupRegistry);

  if (groupEditModeDefinitionId === null) return null;

  const groupName =
    groupRegistry.definitions[groupEditModeDefinitionId]?.name ?? groupEditModeDefinitionId;

  const finishEditing = () => {
    setGroupEditModeDefinitionId(null);
  };

  return (
    <div
      data-testid="group-edit-mode-bar"
      style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}
      className="flex items-center gap-3 rounded border border-border bg-surface px-4 py-2 text-sm shadow-lg"
    >
      <span>Editing group: {groupName}</span>
      <button
        type="button"
        data-testid="finish-edit-group-btn"
        onClick={finishEditing}
        className="rounded border border-border bg-surface-strong px-2 py-1 text-xs hover:bg-accent-soft"
      >
        Finish Editing Group
      </button>
    </div>
  );
}
