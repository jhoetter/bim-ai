import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureViewport3D,
  downloadDataUrl,
  registerViewportRenderer,
  getViewportRenderer,
} from './viewportCapture';
import type * as THREE from 'three';

function makeMockRenderer(dataUrl: string): THREE.WebGLRenderer {
  return {
    domElement: {
      toDataURL: vi.fn().mockReturnValue(dataUrl),
    } as unknown as HTMLCanvasElement,
  } as unknown as THREE.WebGLRenderer;
}

afterEach(() => {
  registerViewportRenderer(null);
});

describe('captureViewport3D', () => {
  it('returns the data URL from the renderer domElement for PNG', () => {
    const expected = 'data:image/png;base64,abc';
    const renderer = makeMockRenderer(expected);
    expect(captureViewport3D(renderer, 'png')).toBe(expected);
  });

  it('returns the data URL from the renderer domElement for JPEG', () => {
    const expected = 'data:image/jpeg;base64,xyz';
    const renderer = makeMockRenderer(expected);
    expect(captureViewport3D(renderer, 'jpeg')).toBe(expected);
  });

  it('passes image/png mime to toDataURL for PNG format', () => {
    const renderer = makeMockRenderer('data:image/png;base64,a');
    captureViewport3D(renderer, 'png');
    expect(renderer.domElement.toDataURL).toHaveBeenCalledWith('image/png', 0.92);
  });

  it('passes image/jpeg mime to toDataURL for JPEG format', () => {
    const renderer = makeMockRenderer('data:image/jpeg;base64,b');
    captureViewport3D(renderer, 'jpeg');
    expect(renderer.domElement.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
  });

  it('forwards custom JPEG quality to toDataURL', () => {
    const renderer = makeMockRenderer('data:image/jpeg;base64,c');
    captureViewport3D(renderer, 'jpeg', 0.75);
    expect(renderer.domElement.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.75);
  });
});

describe('downloadDataUrl', () => {
  it('creates an anchor with correct href and download attributes', () => {
    const anchors: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') anchors.push(el as HTMLAnchorElement);
      return el;
    });
    vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => undefined);

    downloadDataUrl('data:image/png;base64,abc', 'screenshot.png');

    expect(anchors.length).toBeGreaterThan(0);
    const a = anchors[anchors.length - 1];
    expect(a.href).toContain('data:image/png');
    expect(a.download).toBe('screenshot.png');

    vi.restoreAllMocks();
  });
});

describe('registerViewportRenderer / getViewportRenderer', () => {
  it('returns null before any renderer is registered', () => {
    expect(getViewportRenderer()).toBeNull();
  });

  it('returns the registered renderer', () => {
    const renderer = makeMockRenderer('data:image/png;base64,a');
    registerViewportRenderer(renderer);
    expect(getViewportRenderer()).toBe(renderer);
  });

  it('returns null after unregistering', () => {
    const renderer = makeMockRenderer('data:image/png;base64,a');
    registerViewportRenderer(renderer);
    registerViewportRenderer(null);
    expect(getViewportRenderer()).toBeNull();
  });
});
