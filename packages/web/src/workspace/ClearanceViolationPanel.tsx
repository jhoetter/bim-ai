import type { ClearanceViolation } from '../plan/openingClearance';

interface Props {
  violations: ClearanceViolation[];
  onClose: () => void;
}

export function ClearanceViolationPanel({ violations, onClose }: Props) {
  if (violations.length === 0) return null;
  return (
    <div
      data-testid="clearance-violation-panel"
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        background: '#fff',
        border: '2px solid #ef4444',
        borderRadius: 6,
        padding: 12,
        maxWidth: 300,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong data-testid="clearance-violation-count">
          {violations.length} clearance issue{violations.length !== 1 ? 's' : ''}
        </strong>
        <button data-testid="clearance-violation-close" onClick={onClose}>
          ×
        </button>
      </div>
      {violations.map((v) => (
        <div
          key={v.elementId}
          data-testid={`clearance-violation-${v.elementId}`}
          style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}
        >
          {v.message}
        </div>
      ))}
    </div>
  );
}
