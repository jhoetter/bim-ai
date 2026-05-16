import type * as THREE from 'three';

let _viewportRenderer: THREE.WebGLRenderer | null = null;
let _planRenderer: THREE.WebGLRenderer | null = null;

export function registerViewportRenderer(r: THREE.WebGLRenderer | null): void {
  _viewportRenderer = r;
}

export function registerPlanRenderer(r: THREE.WebGLRenderer | null): void {
  _planRenderer = r;
}

export function getViewportRenderer(): THREE.WebGLRenderer | null {
  return _viewportRenderer;
}

export function getPlanRenderer(): THREE.WebGLRenderer | null {
  return _planRenderer;
}

export function captureViewport3D(
  renderer: THREE.WebGLRenderer,
  format: 'png' | 'jpeg',
  qualityJpeg = 0.92,
): string {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return renderer.domElement.toDataURL(mime, qualityJpeg);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
