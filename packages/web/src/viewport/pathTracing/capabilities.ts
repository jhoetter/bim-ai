import * as THREE from 'three';

export type PathTraceCapabilityStatus = 'supported' | 'degraded' | 'unsupported' | 'unknown';

export type PathTraceSceneStats = {
  triangleCount: number;
  meshCount: number;
  materialCount: number;
  textureCount: number;
  activeClipping: boolean;
};

export type PathTraceCapability = {
  status: PathTraceCapabilityStatus;
  reason: string;
  renderScale: number;
  previewSamples: number;
  targetSamples: number;
  bounces: number;
  details: {
    webgl2: boolean;
    requiredExtensions: string[];
    missingExtensions: string[];
    maxTextureSize: number;
    renderer: string | null;
    vendor: string | null;
    deviceMemoryGb: number | null;
    hardwareConcurrency: number | null;
    mobileLike: boolean;
  };
};

const REQUIRED_EXTENSIONS = ['EXT_color_buffer_float'];

function maybeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readDebugRenderer(gl: WebGL2RenderingContext): {
  renderer: string | null;
  vendor: string | null;
} {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return { renderer: null, vendor: null };
  return {
    renderer: String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '') || null,
    vendor: String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? '') || null,
  };
}

export function collectPathTraceSceneStats(root: THREE.Object3D | null): PathTraceSceneStats {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const addTexture = (value: unknown): void => {
    if (value instanceof THREE.Texture) textures.add(value);
  };
  let triangleCount = 0;
  let meshCount = 0;
  let activeClipping = false;

  root?.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.visible) return;
    meshCount += 1;
    const geometry = obj.geometry;
    const position = geometry.getAttribute('position');
    if (geometry.index) {
      triangleCount += Math.floor(geometry.index.count / 3);
    } else if (position) {
      triangleCount += Math.floor(position.count / 3);
    }
    const meshMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of meshMaterials) {
      materials.add(material);
      const materialWithMaps = material as THREE.Material & Record<string, unknown>;
      addTexture(materialWithMaps.map);
      addTexture(materialWithMaps.normalMap);
      addTexture(materialWithMaps.bumpMap);
      addTexture(materialWithMaps.roughnessMap);
      addTexture(materialWithMaps.metalnessMap);
      addTexture(materialWithMaps.alphaMap);
      addTexture(materialWithMaps.emissiveMap);
    }
    if (obj.material) {
      const meshMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
      activeClipping ||= meshMaterials.some(
        (material) => (material.clippingPlanes?.length ?? 0) > 0,
      );
    }
  });

  return {
    triangleCount,
    meshCount,
    materialCount: materials.size,
    textureCount: textures.size,
    activeClipping,
  };
}

export function detectPathTraceCapability(
  renderer: THREE.WebGLRenderer | null,
  sceneStats: PathTraceSceneStats,
): PathTraceCapability {
  const gl = renderer?.domElement.getContext('webgl2') ?? null;
  const webgl2 = !!gl;
  const missingExtensions = gl
    ? REQUIRED_EXTENSIONS.filter((extension) => !gl.getExtension(extension))
    : REQUIRED_EXTENSIONS;
  const maxTextureSize = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0 : 0;
  const debug = gl ? readDebugRenderer(gl) : { renderer: null, vendor: null };
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const navWithMemory = nav as (Navigator & { deviceMemory?: number }) | null;
  const deviceMemoryGb = maybeNumber(navWithMemory?.deviceMemory);
  const hardwareConcurrency = maybeNumber(nav?.hardwareConcurrency);
  const mobileLike =
    typeof navigator !== 'undefined' &&
    (/Mobi|Android|iPad|iPhone/i.test(navigator.userAgent) || (navigator.maxTouchPoints ?? 0) > 1);

  const details = {
    webgl2,
    requiredExtensions: REQUIRED_EXTENSIONS,
    missingExtensions,
    maxTextureSize,
    renderer: debug.renderer,
    vendor: debug.vendor,
    deviceMemoryGb,
    hardwareConcurrency,
    mobileLike,
  };

  if (!webgl2) {
    return {
      status: 'unsupported',
      reason: 'Path trace preview needs WebGL2 support.',
      renderScale: 0.5,
      previewSamples: 0,
      targetSamples: 0,
      bounces: 0,
      details,
    };
  }

  if (missingExtensions.length > 0) {
    return {
      status: 'unsupported',
      reason: 'Path trace preview needs floating-point render target support.',
      renderScale: 0.5,
      previewSamples: 0,
      targetSamples: 0,
      bounces: 0,
      details,
    };
  }

  if (sceneStats.activeClipping) {
    return {
      status: 'unsupported',
      reason: 'Path trace preview is disabled while section or clipping planes are active.',
      renderScale: 0.5,
      previewSamples: 0,
      targetSamples: 0,
      bounces: 0,
      details,
    };
  }

  const largeScene = sceneStats.triangleCount > 1_500_000 || sceneStats.textureCount > 96;
  const hardSceneLimit =
    sceneStats.triangleCount > 5_000_000 ||
    sceneStats.textureCount > 384 ||
    sceneStats.meshCount > 12_000;

  if (hardSceneLimit) {
    return {
      status: 'unsupported',
      reason:
        'This scene exceeds the browser path trace preview budget. Use high-fidelity raster mode or a backend render job.',
      renderScale: 0.5,
      previewSamples: 0,
      targetSamples: 0,
      bounces: 0,
      details,
    };
  }

  const weakMemory = deviceMemoryGb !== null && deviceMemoryGb <= 4;
  const weakCpu = hardwareConcurrency !== null && hardwareConcurrency <= 4;
  const weakTextureLimit = maxTextureSize > 0 && maxTextureSize < 8192;
  const mediumScene = sceneStats.triangleCount > 300_000 || sceneStats.textureCount > 32;
  const shouldDegrade =
    mobileLike || weakMemory || weakCpu || weakTextureLimit || mediumScene || largeScene;

  if (shouldDegrade) {
    return {
      status: 'degraded',
      reason:
        largeScene
          ? 'Experimental large-scene path trace preview. Starting at low resolution and refining locally up to 1024 samples; this may take a while.'
          : 'Experimental path trace preview. The first usable pass appears at 48 samples; it keeps refining up to 1024 samples.',
      renderScale: largeScene ? 0.4 : 0.5,
      previewSamples: 48,
      targetSamples: 1024,
      bounces: 3,
      details,
    };
  }

  return {
    status: 'supported',
    reason:
      'Experimental path trace preview is refining. Early preview appears at 96 samples; final local preview uses up to 2048 samples.',
    renderScale: 0.85,
    previewSamples: 96,
    targetSamples: 2048,
    bounces: 6,
    details,
  };
}
