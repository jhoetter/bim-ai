import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Markup, MarkupShape } from '@bim-ai/core';

interface MarkupCanvasProps {
  markups: Markup[];
  viewId?: string;
  /** When true the canvas captures pointer input for drawing. */
  drawingActive: boolean;
  activeShape: 'freehand' | 'arrow' | 'cloud' | 'text';
  onStrokeComplete?: (pathPx: Array<{ xPx: number; yPx: number }>) => void;
  onArrowComplete?: (from: { xPx: number; yPx: number }, to: { xPx: number; yPx: number }) => void;
  onTextPlace?: (pos: { xPx: number; yPx: number }, text: string) => void;
  width: number;
  height: number;
}

const ARROW_ID = 'markup-arrowhead';

function _freehandPoints(pathPx: Array<{ xPx: number; yPx: number }>): string {
  return pathPx.map((p) => `${p.xPx},${p.yPx}`).join(' ');
}

function _cloudPath(pointsMm: Array<{ xMm: number; yMm: number }>): string {
  if (pointsMm.length < 2) return '';
  return pointsMm.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.xMm},${p.yMm}`).join(' ') + ' Z';
}

function MarkupShapeEl({ shape, resolved }: { shape: MarkupShape; resolved: boolean }) {
  const opacity = resolved ? 0.2 : 1;

  if (shape.kind === 'freehand') {
    return (
      <polyline
        points={_freehandPoints(shape.pathPx)}
        stroke={shape.color}
        strokeWidth={shape.strokeWidthPx}
        fill="none"
        opacity={opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (shape.kind === 'arrow') {
    const id = `arrow-${shape.fromMm.xMm}-${shape.fromMm.yMm}-${shape.toMm.xMm}-${shape.toMm.yMm}`;
    return (
      <>
        <defs>
          <marker id={id} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={shape.color} />
          </marker>
        </defs>
        <line
          x1={shape.fromMm.xMm}
          y1={shape.fromMm.yMm}
          x2={shape.toMm.xMm}
          y2={shape.toMm.yMm}
          stroke={shape.color}
          strokeWidth={2}
          markerEnd={`url(#${id})`}
          opacity={opacity}
        />
      </>
    );
  }

  if (shape.kind === 'cloud') {
    return (
      <path
        d={_cloudPath(shape.pointsMm)}
        stroke="var(--cat-review)"
        strokeWidth={2}
        fill="none"
        strokeDasharray="8 4"
        opacity={opacity}
      />
    );
  }

  if (shape.kind === 'text') {
    return (
      <text
        x={shape.positionMm.xMm}
        y={shape.positionMm.yMm}
        fill="var(--cat-edit)"
        fontSize={14}
        opacity={opacity}
        fontFamily="sans-serif"
      >
        {shape.bodyMd}
      </text>
    );
  }

  return null;
}

export function MarkupCanvas({
  markups,
  viewId,
  drawingActive,
  activeShape,
  onStrokeComplete,
  onArrowComplete,
  onTextPlace,
  width,
  height,
}: MarkupCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [liveStroke, setLiveStroke] = useState<Array<{ xPx: number; yPx: number }>>([]);
  const [arrowStart, setArrowStart] = useState<{ xPx: number; yPx: number } | null>(null);
  const [liveArrowEnd, setLiveArrowEnd] = useState<{ xPx: number; yPx: number } | null>(null);
  const [textAnchor, setTextAnchor] = useState<{ xPx: number; yPx: number } | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  const visible = markups.filter((m) => !viewId || !m.viewId || m.viewId === viewId);

  const getSvgPoint = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { xPx: e.clientX - rect.left, yPx: e.clientY - rect.top };
  }, []);

  const commitText = useCallback(() => {
    if (textAnchor && textDraft.trim()) {
      onTextPlace?.(textAnchor, textDraft.trim());
    }
    setTextAnchor(null);
    setTextDraft('');
  }, [textAnchor, textDraft, onTextPlace]);

  // Focus text input when it appears
  useEffect(() => {
    if (textAnchor) {
      setTimeout(() => textInputRef.current?.focus(), 0);
    }
  }, [textAnchor]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingActive) return;

      if (activeShape === 'text') {
        const pt = getSvgPoint(e);
        setTextAnchor(pt);
        setTextDraft('');
        return;
      }

      if (activeShape === 'arrow') {
        const pt = getSvgPoint(e);
        setArrowStart(pt);
        setLiveArrowEnd(pt);
        drawing.current = true;
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        return;
      }

      // freehand and cloud both use stroke path
      drawing.current = true;
      setLiveStroke([getSvgPoint(e)]);
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    },
    [drawingActive, activeShape, getSvgPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawing.current) return;

      if (activeShape === 'arrow') {
        setLiveArrowEnd(getSvgPoint(e));
        return;
      }

      setLiveStroke((prev) => [...prev, getSvgPoint(e)]);
    },
    [activeShape, getSvgPoint],
  );

  const handlePointerUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;

    if (activeShape === 'arrow') {
      if (arrowStart && liveArrowEnd) {
        onArrowComplete?.(arrowStart, liveArrowEnd);
      }
      setArrowStart(null);
      setLiveArrowEnd(null);
      return;
    }

    if (liveStroke.length > 1) {
      onStrokeComplete?.(liveStroke);
    }
    setLiveStroke([]);
  }, [activeShape, arrowStart, liveArrowEnd, liveStroke, onArrowComplete, onStrokeComplete]);

  const cursor = drawingActive ? (activeShape === 'text' ? 'text' : 'crosshair') : 'default';

  return (
    <>
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: drawingActive ? 'all' : 'none',
          cursor,
        }}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <marker id={ARROW_ID} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="var(--cat-edit)" />
          </marker>
        </defs>
        {visible.map((m) => (
          <MarkupShapeEl key={m.id} shape={m.shape} resolved={m.resolvedAt != null} />
        ))}
        {/* Live freehand / cloud preview */}
        {liveStroke.length > 1 && (
          <polyline
            points={liveStroke.map((p) => `${p.xPx},${p.yPx}`).join(' ')}
            stroke="var(--cat-edit)"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        )}
        {/* Live arrow preview */}
        {arrowStart && liveArrowEnd && (
          <line
            x1={arrowStart.xPx}
            y1={arrowStart.yPx}
            x2={liveArrowEnd.xPx}
            y2={liveArrowEnd.yPx}
            stroke="var(--cat-edit)"
            strokeWidth={2}
            markerEnd={`url(#${ARROW_ID})`}
            opacity={0.7}
          />
        )}
      </svg>

      {/* Floating text input for 'text' shape mode */}
      {textAnchor && (
        <div
          style={{
            position: 'absolute',
            left: textAnchor.xPx + 4,
            top: textAnchor.yPx - 12,
            zIndex: 20,
            pointerEvents: 'all',
          }}
        >
          <input
            ref={textInputRef}
            type="text"
            value={textDraft}
            placeholder="Type note…"
            aria-label="Markup text note"
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText();
              if (e.key === 'Escape') {
                setTextAnchor(null);
                setTextDraft('');
              }
            }}
            onBlur={commitText}
            style={{
              fontSize: 12,
              padding: '2px 6px',
              border: '1px solid var(--color-accent)',
              borderRadius: 3,
              background: 'var(--color-surface)',
              color: 'var(--color-foreground)',
              minWidth: 120,
              outline: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          />
        </div>
      )}
    </>
  );
}
