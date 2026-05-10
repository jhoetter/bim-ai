import { useEffect, useState, type ReactElement } from 'react';
import type { AssetLibraryEntry, Element } from '@bim-ai/core';
import * as THREE from 'three';

import { makePlacedAssetMesh } from '../../viewport/placedAssetRendering';

type AssetCardProps = {
  entry: AssetLibraryEntry;
  selected?: boolean;
  onSelect: (entry: AssetLibraryEntry) => void;
  onPlace: (entry: AssetLibraryEntry) => void;
};

const RENDERED_THUMBNAIL_SIZE = 128;
const RENDERED_THUMBNAIL_UNAVAILABLE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>" +
      "<rect width='128' height='128' rx='6' fill='#f3f4f6'/>" +
      '</svg>',
  );

const renderedThumbnailCache = new Map<string, string>();
const renderedThumbnailInFlight = new Map<string, Promise<string>>();
let renderedThumbnailRenderer: THREE.WebGLRenderer | null = null;
let renderedThumbnailRendererInitialized = false;

/** Schematic-plan thumbnail SVG drawn at 1:50 paper scale with --draft-* line weights. */
function inferSymbolKind(
  entry: AssetLibraryEntry,
): AssetLibraryEntry['planSymbolKind'] | undefined {
  const text = [entry.id, entry.name, entry.category, ...entry.tags, entry.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\b(bed|mattress|queen|king|single\s+bed|double\s+bed)\b/.test(text)) return 'bed';
  if (/\b(wardrobe|closet|robe|storage|cupboard)\b/.test(text)) return 'wardrobe';
  if (/\b(lamp|light|floor\s+lamp|table\s+lamp)\b/.test(text)) return 'lamp';
  if (/\b(rug|carpet|mat)\b/.test(text)) return 'rug';
  if (/\b(fridge|refrigerator|freezer)\b/.test(text)) return 'fridge';
  if (/\b(oven|cooker|range|hob|cooktop)\b/.test(text)) return 'oven';
  if (/\b(sink|basin|washbasin)\b/.test(text)) return 'sink';
  if (/\b(counter|cabinet|casework|island|worktop)\b/.test(text)) return 'counter';
  if (/\b(sofa|couch|settee)\b/.test(text)) return 'sofa';
  if (/\b(table|desk)\b/.test(text)) return 'table';
  if (/\b(chair|armchair)\b/.test(text)) return 'chair';
  if (/\b(toilet|wc)\b/.test(text)) return 'toilet';
  if (/\b(bath|bathtub|tub)\b/.test(text)) return 'bath';
  if (/\b(shower)\b/.test(text)) return 'shower';
  return undefined;
}

function ensureRenderedThumbnailRenderer(): THREE.WebGLRenderer | null {
  if (renderedThumbnailRendererInitialized) return renderedThumbnailRenderer;
  renderedThumbnailRendererInitialized = true;
  if (typeof document === 'undefined') return null;
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  ) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = RENDERED_THUMBNAIL_SIZE;
    canvas.height = RENDERED_THUMBNAIL_SIZE;
    renderedThumbnailRenderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderedThumbnailRenderer.setPixelRatio(1);
    renderedThumbnailRenderer.setSize(RENDERED_THUMBNAIL_SIZE, RENDERED_THUMBNAIL_SIZE, false);
    renderedThumbnailRenderer.setClearColor(0xf3f4f6, 0);
    return renderedThumbnailRenderer;
  } catch {
    renderedThumbnailRenderer = null;
    return null;
  }
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m?.dispose?.());
    else material?.dispose?.();
  });
}

function renderedThumbnailCacheKey(entry: AssetLibraryEntry): string {
  return JSON.stringify({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    thumbnailMm: entry.thumbnailMm,
    planSymbolKind: entry.planSymbolKind,
    renderProxyKind: entry.renderProxyKind,
    paramSchema: entry.paramSchema,
    description: entry.description,
  });
}

async function renderAssetThumbnail(entry: AssetLibraryEntry): Promise<string> {
  const renderer = ensureRenderedThumbnailRenderer();
  if (!renderer) return RENDERED_THUMBNAIL_UNAVAILABLE;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('white', 1.25));
  const keyLight = new THREE.DirectionalLight('white', 1.85);
  keyLight.position.set(2.5, 4, 3);
  scene.add(keyLight);
  const fillLight = new THREE.HemisphereLight(0xdde6ff, 0xc8c2b0, 0.5);
  scene.add(fillLight);

  const symbolKind = entry.renderProxyKind ?? entry.planSymbolKind ?? inferSymbolKind(entry);
  const group = makePlacedAssetMesh(
    {
      kind: 'placed_asset',
      id: `thumbnail-${entry.id}`,
      name: entry.name,
      assetId: entry.id,
      levelId: 'thumbnail-level',
      positionMm: { xMm: 0, yMm: 0 },
      rotationDeg: -25,
      paramValues: {},
    },
    {
      'thumbnail-level': {
        kind: 'level',
        id: 'thumbnail-level',
        name: 'Preview',
        elevationMm: 0,
      },
      [entry.id]: {
        kind: 'asset_library_entry',
        id: entry.id,
        assetKind: entry.assetKind ?? 'family_instance',
        name: entry.name,
        tags: entry.tags,
        category: entry.category,
        disciplineTags: entry.disciplineTags,
        thumbnailKind: 'rendered_3d',
        thumbnailWidthMm: entry.thumbnailMm?.widthMm,
        thumbnailHeightMm: entry.thumbnailMm?.heightMm,
        planSymbolKind: entry.planSymbolKind,
        renderProxyKind: symbolKind,
        paramSchema: entry.paramSchema,
        publishedFromOrgId: entry.publishedFromOrgId,
        description: entry.description,
      },
    } satisfies Record<string, Element>,
    null,
  );

  try {
    scene.add(group);
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    group.position.sub(center);

    const radius = Math.max(size.length() / 2, 0.35);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, radius * 12);
    camera.position.set(radius * 2.4, radius * 1.8, radius * 2.7);
    camera.lookAt(0, 0, 0);

    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } catch {
    return RENDERED_THUMBNAIL_UNAVAILABLE;
  } finally {
    disposeObject3D(scene);
  }
}

function getRenderedAssetThumbnail(entry: AssetLibraryEntry): Promise<string> {
  const cacheKey = renderedThumbnailCacheKey(entry);
  const cached = renderedThumbnailCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  const pending = renderedThumbnailInFlight.get(cacheKey);
  if (pending) return pending;

  const promise = renderAssetThumbnail(entry)
    .catch(() => RENDERED_THUMBNAIL_UNAVAILABLE)
    .then((url) => {
      renderedThumbnailCache.set(cacheKey, url);
      renderedThumbnailInFlight.delete(cacheKey);
      return url;
    });
  renderedThumbnailInFlight.set(cacheKey, promise);
  return promise;
}

export function RenderedAssetThumbnail({ entry }: { entry: AssetLibraryEntry }): ReactElement {
  const [src, setSrc] = useState<string>(RENDERED_THUMBNAIL_UNAVAILABLE);

  useEffect(() => {
    let cancelled = false;
    setSrc(RENDERED_THUMBNAIL_UNAVAILABLE);
    void getRenderedAssetThumbnail(entry).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      data-testid="asset-rendered-thumbnail"
      width={64}
      height={64}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
}

export function SchematicThumbnail({ entry }: { entry: AssetLibraryEntry }): ReactElement {
  const w = entry.thumbnailMm?.widthMm ?? 60;
  const h = entry.thumbnailMm?.heightMm ?? 60;
  const cat = entry.category;
  const symbolKind = entry.planSymbolKind ?? entry.renderProxyKind ?? inferSymbolKind(entry);

  let body: ReactElement;
  if (symbolKind === 'bed') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.16}
          y={h * 0.14}
          width={w * 0.28}
          height={h * 0.18}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <rect
          x={w * 0.56}
          y={h * 0.14}
          width={w * 0.28}
          height={h * 0.18}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.12}
          y1={h * 0.38}
          x2={w * 0.88}
          y2={h * 0.86}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'wardrobe') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w / 2}
          y1={4}
          x2={w / 2}
          y2={h - 4}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <circle
          cx={w * 0.42}
          cy={h * 0.62}
          r={Math.min(w, h) * 0.03}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <circle
          cx={w * 0.58}
          cy={h * 0.62}
          r={Math.min(w, h) * 0.03}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'lamp') {
    body = (
      <>
        <circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) * 0.34}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) * 0.12}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'rug') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          rx={Math.min(w, h) * 0.05}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.12}
          y={h * 0.16}
          width={w * 0.76}
          height={h * 0.68}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'fridge') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w / 2}
          y1={4}
          x2={w / 2}
          y2={h - 4}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.72}
          y1={h * 0.22}
          x2={w * 0.72}
          y2={h * 0.78}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.18}
          y1={h * 0.64}
          x2={w * 0.82}
          y2={h * 0.64}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'oven') {
    const r = Math.min(w, h) * 0.07;
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        {[0.3, 0.5, 0.7].map((x) => (
          <circle
            key={x}
            cx={w * x}
            cy={h * 0.28}
            r={r}
            fill="none"
            stroke="var(--draft-cut)"
            strokeWidth={0.25}
          />
        ))}
        <rect
          x={w * 0.24}
          y={h * 0.52}
          width={w * 0.52}
          height={h * 0.26}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'sink') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.18}
          y={h * 0.24}
          width={w * 0.64}
          height={h * 0.52}
          rx={Math.min(w, h) * 0.08}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'counter') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        {[0.25, 0.5, 0.75].map((x) => (
          <line
            key={x}
            x1={w * x}
            y1={4}
            x2={w * x}
            y2={h - 4}
            stroke="var(--draft-cut)"
            strokeWidth={0.25}
          />
        ))}
      </>
    );
  } else if (symbolKind === 'toilet') {
    body = (
      <>
        <rect
          x={w * 0.28}
          y={4}
          width={w * 0.44}
          height={h * 0.26}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <ellipse
          cx={w / 2}
          cy={h * 0.62}
          rx={Math.min(w, h) * 0.22}
          ry={Math.min(w, h) * 0.28}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
      </>
    );
  } else if (symbolKind === 'sofa') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          rx={Math.min(w, h) * 0.08}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w * 0.12}
          y1={h * 0.36}
          x2={w * 0.88}
          y2={h * 0.36}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.22}
          y1={4}
          x2={w * 0.22}
          y2={h - 4}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.78}
          y1={4}
          x2={w * 0.78}
          y2={h - 4}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'table') {
    const r = Math.min(w, h) * 0.035;
    body = (
      <>
        <rect
          x={w * 0.12}
          y={h * 0.16}
          width={w * 0.76}
          height={h * 0.68}
          rx={Math.min(w, h) * 0.04}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        {[0.25, 0.75].map((x) =>
          [0.28, 0.72].map((y) => (
            <circle
              key={`${x}-${y}`}
              cx={w * x}
              cy={h * y}
              r={r}
              fill="none"
              stroke="var(--draft-cut)"
              strokeWidth={0.25}
            />
          )),
        )}
      </>
    );
  } else if (symbolKind === 'chair') {
    body = (
      <>
        <rect
          x={w * 0.18}
          y={h * 0.26}
          width={w * 0.64}
          height={h * 0.58}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w * 0.18}
          y1={h * 0.42}
          x2={w * 0.82}
          y2={h * 0.42}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.3}
          y1={h * 0.1}
          x2={w * 0.7}
          y2={h * 0.1}
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={w * 0.34}
          y1={h * 0.1}
          x2={w * 0.34}
          y2={h * 0.26}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
        <line
          x1={w * 0.66}
          y1={h * 0.1}
          x2={w * 0.66}
          y2={h * 0.26}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'bath') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          rx={Math.min(w, h) * 0.12}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <rect
          x={w * 0.18}
          y={h * 0.22}
          width={w * 0.64}
          height={h * 0.56}
          rx={Math.min(w, h) * 0.08}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (symbolKind === 'shower') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <line x1={4} y1={4} x2={w - 4} y2={h - 4} stroke="var(--cat-fixture)" strokeWidth={0.25} />
        <circle
          cx={w * 0.72}
          cy={h * 0.28}
          r={Math.min(w, h) * 0.09}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.25}
        />
      </>
    );
  } else if (cat === 'kitchen' || cat === 'bathroom') {
    const r = Math.min(w, h) * 0.15;
    const cx = w / 2;
    const cy = h / 2;
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          rx={r}
          ry={r}
          fill="none"
          stroke="var(--cat-fixture)"
          strokeWidth={0.5}
        />
        <line x1={cx} y1={8} x2={cx} y2={h - 8} stroke="var(--cat-fixture)" strokeWidth={0.25} />
        <line x1={8} y1={cy} x2={w - 8} y2={cy} stroke="var(--cat-fixture)" strokeWidth={0.25} />
      </>
    );
  } else if (cat === 'door') {
    const r = Math.min(w, h) - 8;
    body = (
      <>
        <line x1={4} y1={4} x2={4} y2={4 + r} stroke="var(--draft-cut)" strokeWidth={0.5} />
        <line x1={4} y1={4} x2={4 + r} y2={4} stroke="var(--draft-cut)" strokeWidth={0.5} />
        <path
          d={`M ${4 + r} 4 A ${r} ${r} 0 0 0 4 ${4 + r}`}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
          strokeDasharray="1 1"
        />
      </>
    );
  } else if (cat === 'window') {
    const mid = h / 2;
    body = (
      <>
        <rect
          x={4}
          y={mid - 2}
          width={w - 8}
          height={4}
          fill="var(--color-canvas-paper)"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line x1={4} y1={mid} x2={w - 4} y2={mid} stroke="var(--draft-cut)" strokeWidth={0.25} />
      </>
    );
  } else if (cat === 'furniture' || cat === 'casework') {
    body = (
      <>
        <rect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          fill="none"
          stroke="var(--draft-cut)"
          strokeWidth={0.5}
        />
        <line
          x1={4}
          y1={h / 2}
          x2={w - 4}
          y2={h / 2}
          stroke="var(--draft-cut)"
          strokeWidth={0.25}
        />
      </>
    );
  } else {
    body = (
      <rect
        x={4}
        y={4}
        width={w - 8}
        height={h - 8}
        fill="none"
        stroke="var(--draft-cut)"
        strokeWidth={0.5}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <style>{`
        .asset-schematic-linework * {
          vector-effect: non-scaling-stroke;
          stroke-width: 1.35px !important;
        }
      `}</style>
      <g className="asset-schematic-linework">{body}</g>
    </svg>
  );
}

export function AssetCard({ entry, selected, onSelect, onPlace }: AssetCardProps): ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="asset-card"
      aria-label={entry.name}
      aria-selected={selected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        borderRadius: 4,
        cursor: 'grab',
        background: selected ? 'var(--color-accent-soft)' : 'var(--color-surface-strong)',
        border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-foreground)',
        userSelect: 'none',
      }}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onPlace(entry)}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/bim-asset-id', entry.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => {
        // Placement is initiated via onPlace when drag ends on canvas
        onPlace(entry);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPlace(entry);
        if (e.key === ' ') {
          e.preventDefault();
          onSelect(entry);
        }
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-canvas-paper)',
          borderRadius: 2,
        }}
      >
        <RenderedAssetThumbnail entry={entry} />
      </div>
      <span
        style={{
          width: '100%',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 80,
        }}
        title={entry.name}
      >
        {entry.name}
      </span>
    </div>
  );
}
