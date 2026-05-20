import { beforeEach, vi } from 'vitest';

import '../i18n';

const originalConsoleLog = console.log.bind(console);
const originalConsoleDebug = console.debug.bind(console);
const originalConsoleError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first === '[bim] rendering budget:' || first.startsWith('[bim] rendering budget:')) return;
  originalConsoleLog(...args);
};

console.debug = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first === '[bim] selected element:' || first.startsWith('[bim] selected element:')) return;
  originalConsoleDebug(...args);
};

console.error = (...args: unknown[]) => {
  const message = args.map((arg) => String(arg ?? '')).join(' ');
  if (message.includes('HTMLCanvasElement.prototype.getContext')) {
    throw new Error(
      'jsdom canvas getContext noise reached the default Vitest run. Keep real rendering in Playwright or extend src/test/setup.ts with an explicit mock.',
    );
  }
  originalConsoleError(...args);
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function defaultApiBody(url: string): unknown {
  if (url === '/api/bootstrap') return { projects: [] };
  if (url === '/api/building-presets') return { presets: {} };
  if (/^\/api\/models\/[^/]+\/activity$/.test(url)) return { events: [] };
  if (/^\/api\/models\/[^/]+\/comments$/.test(url)) return { comments: [] };
  return {};
}

const defaultFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  if (url.startsWith('/api/')) return jsonResponse(defaultApiBody(url));
  return jsonResponse({});
};

function installCanvasContextMock(): void {
  const proto = globalThis.HTMLCanvasElement?.prototype;
  if (!proto) return;

  Object.defineProperty(proto, 'getContext', {
    configurable: true,
    value(type: string) {
      if (type !== '2d') return null;
      const canvas = this as HTMLCanvasElement;
      const context = {
        canvas,
        fillStyle: '#000',
        strokeStyle: '#000',
        font: '10px sans-serif',
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        lineWidth: 1,
        textAlign: 'start',
        textBaseline: 'alphabetic',
        arc: () => undefined,
        beginPath: () => undefined,
        bezierCurveTo: () => undefined,
        clearRect: () => undefined,
        clip: () => undefined,
        closePath: () => undefined,
        createImageData: (width: number, height: number) =>
          ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
            colorSpace: 'srgb',
          }) as ImageData,
        drawImage: () => undefined,
        ellipse: () => undefined,
        fill: () => undefined,
        fillRect: () => undefined,
        fillText: () => undefined,
        getImageData: (_x: number, _y: number, width: number, height: number) =>
          ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
            colorSpace: 'srgb',
          }) as ImageData,
        lineTo: () => undefined,
        measureText: (text: string) =>
          ({
            width: text.length * 6,
            actualBoundingBoxAscent: 8,
            actualBoundingBoxDescent: 2,
          }) as TextMetrics,
        moveTo: () => undefined,
        putImageData: () => undefined,
        quadraticCurveTo: () => undefined,
        rect: () => undefined,
        restore: () => undefined,
        rotate: () => undefined,
        save: () => undefined,
        scale: () => undefined,
        setLineDash: () => undefined,
        setTransform: () => undefined,
        stroke: () => undefined,
        strokeRect: () => undefined,
        strokeText: () => undefined,
        translate: () => undefined,
      };
      return context as unknown as CanvasRenderingContext2D;
    },
  });
}

installCanvasContextMock();

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(defaultFetch));
});
