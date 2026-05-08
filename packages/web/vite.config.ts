import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESIGN_SYSTEM_IDS = ['default', 'playful', 'conservative', 'v3'] as const;
type DesignSystemId = (typeof DESIGN_SYSTEM_IDS)[number];

function resolveDesignSystemId(env: Record<string, string>): DesignSystemId {
  const raw = (
    env.VITE_DESIGN_SYSTEM ??
    env.DESIGN_SYSTEM ??
    process.env.VITE_DESIGN_SYSTEM ??
    process.env.DESIGN_SYSTEM ??
    'default'
  )
    .trim()
    .toLowerCase();
  if ((DESIGN_SYSTEM_IDS as readonly string[]).includes(raw)) {
    return raw as DesignSystemId;
  }
  console.warn(`[bim-ai] Unknown VITE_DESIGN_SYSTEM="${raw}". Falling back to default.`);
  return 'default';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ds = resolveDesignSystemId(env);
  const cssPath =
    ds === 'conservative'
      ? path.resolve(__dirname, `src/design-systems/conservative.css`)
      : ds === 'v3'
        ? path.resolve(__dirname, `src/design-systems/v3.css`)
        : path.resolve(__dirname, `src/design-systems/default.css`);

  const apiPort = env.API_PORT ?? process.env.API_PORT ?? '8500';
  const apiTarget = `http://127.0.0.1:${apiPort}`;
  /** Playwright: use empty proxy map so `/api`/`/ws` are not forwarded (Vite may merge `server.proxy` into preview). */
  const skipPreviewApiProxy =
    process.env.PREVIEW_NO_PROXY === '1' || process.env.E2E_NO_API_PROXY === '1';

  const previewProxy: Record<string, string | { target: string; ws?: boolean }> =
    skipPreviewApiProxy
      ? {}
      : {
          '/api': apiTarget,
          '/ws': { target: `ws://127.0.0.1:${apiPort}`, ws: true },
        };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@bim-ai-design-system.css': cssPath,
      },
    },
    server: {
      host: '127.0.0.1',
      port: Number(env.WEB_PORT ?? process.env.WEB_PORT ?? 2000),
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/ws': { target: `ws://127.0.0.1:${apiPort}`, ws: true },
      },
    },
    preview: {
      port: 2000,
      strictPort: true,
      proxy: previewProxy,
    },
    test: {
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary'],
        reportsDirectory: '/tmp/bim-ai-coverage',
        thresholds: {
          lines: 53,
          functions: 71,
          branches: 71,
        },
      },
    },
  };
});
