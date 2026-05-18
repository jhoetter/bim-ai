import * as React from 'react';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onProperties?: () => void;
}

export function CanvasContextMenu({
  x,
  y,
  onClose,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onProperties,
}: CanvasContextMenuProps) {
  React.useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler, { once: true });
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') onClose();
      },
      { once: true },
    );
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  return (
    <div
      data-testid="canvas-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: 'var(--background, #1e1e1e)',
        border: '1px solid var(--border, #444)',
        borderRadius: 4,
        padding: '2px 0',
        minWidth: 160,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        data-testid="canvas-ctx-zoom-in"
        onClick={() => {
          onZoomIn();
          onClose();
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '4px 12px',
          fontSize: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        Zoom In
      </button>
      <button
        data-testid="canvas-ctx-zoom-out"
        onClick={() => {
          onZoomOut();
          onClose();
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '4px 12px',
          fontSize: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        Zoom Out
      </button>
      <button
        data-testid="canvas-ctx-zoom-fit"
        onClick={() => {
          onZoomFit();
          onClose();
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '4px 12px',
          fontSize: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        Zoom to Fit
      </button>
      {onProperties && (
        <>
          <div style={{ borderTop: '1px solid var(--border, #444)', margin: '2px 0' }} />
          <button
            data-testid="canvas-ctx-properties"
            onClick={() => {
              onProperties();
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '4px 12px',
              fontSize: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            View Properties
          </button>
        </>
      )}
    </div>
  );
}
