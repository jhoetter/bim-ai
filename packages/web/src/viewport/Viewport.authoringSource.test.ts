import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = readFileSync(path.join(__dirname, '../Viewport.tsx'), 'utf8');

describe('WP-NEXT-42 Viewport wall authoring source guards', () => {
  it('uses shared wall-connectivity snaps during 3D wall placement', () => {
    expect(SRC).toContain('snapWallPointToConnectivity(');
    expect(SRC).toMatch(
      /snapDraftProjectionToActiveWorkPlane\([\s\S]{0,180}preferWallConnectivity:\s*tool\s*===\s*['"]wall['"]/,
    );
    expect(SRC).toMatch(
      /snapDraftProjectionToActiveWorkPlane\([\s\S]{0,180}preferWallConnectivity:\s*directTool\s*===\s*['"]wall['"]/,
    );
  });

  it('uses the shared side-flip helper instead of reversing 3D wall endpoints', () => {
    expect(SRC).toContain('flipWallLocationLineSide(runtime.wallLocationLine)');
    expect(SRC).toMatch(/const\s+actualStart\s*=\s*start/);
    expect(SRC).toMatch(/const\s+actualEnd\s*=\s*end/);
  });
});

describe('PERF-I02 Viewport render loop guards', () => {
  it('uses demand-driven RAF scheduling instead of unconditional continuous rendering', () => {
    expect(SRC).toContain('requestViewportRenderRef');
    expect(SRC).toContain('function scheduleViewportRender(): void');
    expect(SRC).toContain('function shouldAnimateViewport(): boolean');
    expect(SRC).toContain('if (shouldAnimateViewport()) scheduleViewportRender();');
    expect(SRC).not.toMatch(
      /composer\.render\(\);\s*rafRef\.current = requestAnimationFrame\(tick\);/,
    );
  });

  it('requests a frame after scene effects and asynchronous mesh updates', () => {
    expect(SRC).toMatch(
      /useEffect\(\(\) => \{\s*requestViewportRenderRef\.current\?\.\(\);\s*\}\);/,
    );
    expect(SRC).toMatch(/rootNow\.add\(mesh\);\s*scheduleViewportRender\(\);/);
  });
});
