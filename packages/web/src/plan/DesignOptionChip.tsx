import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { Command, CommandBundle, DesignOption, DesignOptionSet } from '@bim-ai/core';

export type DesignOptionChipProps = {
  option: DesignOption;
  optionSet: DesignOptionSet;
  modelId: string;
  /** IDs of elements belonging to this option; needed to unassign on promote. */
  elementIds: string[];
  revision: number;
  onPromoted?: () => void;
};

export function DesignOptionChip({
  option,
  optionSet,
  modelId,
  elementIds,
  revision,
  onPromoted,
}: DesignOptionChipProps): ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const canPromote = option.provenance?.submitter === 'agent';

  useEffect(() => {
    if (!confirmOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmOpen]);

  function handleContextMenu(e: React.MouseEvent) {
    if (!canPromote) return;
    e.preventDefault();
    setConfirmOpen(true);
  }

  async function handlePromote() {
    setPromoting(true);
    try {
      const commands: Command[] = [
        { type: 'setPrimaryOption', optionSetId: optionSet.id, optionId: option.id },
        ...elementIds.map((elementId) => ({
          type: 'assignElementToOption',
          elementId,
          optionSetId: null,
          optionId: null,
        })),
      ];
      const bundle: CommandBundle = {
        schemaVersion: 'cmd-v3.0',
        commands,
        assumptions: [{ key: 'promote_option', value: option.id, confidence: 1, source: 'user' }],
        parentRevision: revision,
        targetOptionId: 'main',
      };
      await fetch(`/api/models/${encodeURIComponent(modelId)}/bundles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bundle, mode: 'commit' }),
      });
      setConfirmOpen(false);
      onPromoted?.();
    } catch (err) {
      console.error('Promote to main failed', err);
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="design-option-chip" onContextMenu={handleContextMenu}>
      <span className="design-option-chip__label">{option.name}</span>
      {option.provenance?.submitter === 'agent' && (
        <span className="design-option-chip__badge">agent</span>
      )}

      {confirmOpen && (
        <div
          className="design-option-chip__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promote-dialog-title"
        >
          <div className="design-option-chip__dialog">
            <p id="promote-dialog-title">
              Promote &ldquo;{option.name}&rdquo; to main? This overwrites main.
            </p>
            <div className="design-option-chip__dialog-actions">
              <button
                type="button"
                className="design-option-chip__confirm-btn"
                disabled={promoting}
                onClick={handlePromote}
              >
                {promoting ? 'Promoting…' : 'Promote to main'}
              </button>
              <button
                type="button"
                className="design-option-chip__cancel-btn"
                disabled={promoting}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
