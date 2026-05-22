import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ProxyOptions } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESIGN_SYSTEM_IDS = ['default', 'playful', 'conservative', 'v3'] as const;
type DesignSystemId = (typeof DESIGN_SYSTEM_IDS)[number];

function resolveDesignSystemId(env: Record<string, string>): DesignSystemId {
  const raw = (
    env.VITE_DESIGN_SYSTEM ??
    env.DESIGN_SYSTEM ??
    process.env.VITE_DESIGN_SYSTEM ??
    process.env.DESIGN_SYSTEM ??
    'v3'
  )
    .trim()
    .toLowerCase();
  if ((DESIGN_SYSTEM_IDS as readonly string[]).includes(raw)) {
    return raw as DesignSystemId;
  }
  console.warn(`[bim-ai] Unknown VITE_DESIGN_SYSTEM="${raw}". Falling back to v3.`);
  return 'v3';
}

function quietBenignProxySocketErrors(
  proxy: Parameters<NonNullable<ProxyOptions['configure']>>[0],
): void {
  proxy.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
    console.error(`[bim-ai/vite-proxy] ${err.message}`);
  });
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

  const apiProxy: ProxyOptions = {
    target: apiTarget,
    configure: quietBenignProxySocketErrors,
  };
  const wsProxy: ProxyOptions = {
    target: `ws://127.0.0.1:${apiPort}`,
    ws: true,
    configure: quietBenignProxySocketErrors,
  };
  const previewProxy: Record<string, ProxyOptions> = skipPreviewApiProxy
    ? {}
    : {
        '/api': apiProxy,
        '/ws': wsProxy,
      };
  const ciWorkerLimits = process.env.CI ? { maxWorkers: 2, minWorkers: 1 } : {};

  // PERF-J06: enable bundle-composition report on demand. Set ANALYZE=1 on
  // `pnpm build` to emit dist/bundle-analysis.html (treemap of module
  // contributions per chunk) so the workspace lazy chunk's top offenders
  // are visible without guessing.
  const analyzePlugin: Plugin[] = process.env.ANALYZE
    ? [
        visualizer({
          filename: 'dist/bundle-analysis.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
        }) as Plugin,
      ]
    : [];

  return {
    plugins: [react(), ...analyzePlugin],
    resolve: {
      alias: {
        '@bim-ai-design-system.css': cssPath,
      },
    },
    build: {
      // PERF-J05: split stable heavy vendor modules into their own chunks so
      // they cache independently of app code. The workspace lazy chunk is
      // still the dominant cost (PERF-J04); these splits at least prevent
      // each app build from re-downloading three.js / leaflet / jspdf when
      // only product code changed.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/three/')) return 'vendor-three';
            if (id.includes('/leaflet')) return 'vendor-leaflet';
            if (id.includes('/jspdf') || id.includes('/html2canvas')) return 'vendor-pdf';
            if (id.includes('/i18next') || id.includes('/react-i18next')) return 'vendor-i18n';
            if (id.includes('/cmdk') || id.includes('/fuzzysort')) return 'vendor-command-palette';
            return undefined;
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: Number(env.WEB_PORT ?? process.env.WEB_PORT ?? 2000),
      strictPort: true,
      proxy: {
        '/api': apiProxy,
        '/ws': wsProxy,
      },
    },
    preview: {
      port: 2000,
      strictPort: true,
      proxy: previewProxy,
    },
    test: {
      ...ciWorkerLimits,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
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
