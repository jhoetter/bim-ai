import { useState, type JSX } from 'react';

type Phase = 'idle' | 'confirming' | 'done';

export function PurgeUnusedPanel(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('idle');

  if (phase === 'confirming') {
    return (
      <div>
        <p>This will remove unreferenced types, materials, and families (3 passes).</p>
        <button
          type="button"
          onClick={() => {
            console.warn('purge-unused stub');
            setPhase('done');
          }}
        >
          Confirm Purge
        </button>
        <button type="button" onClick={() => setPhase('idle')}>
          Cancel
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div>
        <p>Purge complete.</p>
        <button type="button" onClick={() => setPhase('idle')}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setPhase('confirming')}>
        Purge Unused…
      </button>
    </div>
  );
}
