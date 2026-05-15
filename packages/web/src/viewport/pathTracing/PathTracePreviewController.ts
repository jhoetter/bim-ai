import * as THREE from 'three';
import type { WebGLPathTracer } from 'three-gpu-pathtracer';

import type { PathTraceCapability } from './capabilities';
import { buildPathTraceScene } from './sceneFilter';

export type PathTracePreviewPhase =
  | 'idle'
  | 'preparing'
  | 'rendering'
  | 'complete'
  | 'degraded'
  | 'unsupported'
  | 'error';

export type PathTracePreviewState = {
  phase: PathTracePreviewPhase;
  message: string;
  samples: number;
  previewSamples: number;
  targetSamples: number;
  progress: number;
  meshCount: number;
  triangleCount: number;
};

const IDLE_STATE: PathTracePreviewState = {
  phase: 'idle',
  message: '',
  samples: 0,
  previewSamples: 0,
  targetSamples: 0,
  progress: 0,
  meshCount: 0,
  triangleCount: 0,
};

function matricesEqual(a: THREE.Matrix4, b: THREE.Matrix4): boolean {
  const ae = a.elements;
  const be = b.elements;
  for (let i = 0; i < 16; i += 1) {
    if (Math.abs(ae[i] - be[i]) > 1e-8) return false;
  }
  return true;
}

export class PathTracePreviewController {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly onState: (state: PathTracePreviewState) => void;
  private pathTracer: WebGLPathTracer | null = null;
  private traceScene: THREE.Scene | null = null;
  private activeCamera: THREE.Camera | null = null;
  private previewSamples = 0;
  private targetSamples = 0;
  private meshCount = 0;
  private triangleCount = 0;
  private disposed = false;
  private buildNonce = 0;
  private lastCameraMatrix = new THREE.Matrix4();
  private lastProjectionMatrix = new THREE.Matrix4();
  private lastState: PathTracePreviewState = IDLE_STATE;

  constructor(renderer: THREE.WebGLRenderer, onState: (state: PathTracePreviewState) => void) {
    this.renderer = renderer;
    this.onState = onState;
  }

  get state(): PathTracePreviewState {
    return this.lastState;
  }

  private emit(patch: Partial<PathTracePreviewState>): void {
    this.lastState = { ...this.lastState, ...patch };
    this.onState(this.lastState);
  }

  private async ensureTracer(): Promise<WebGLPathTracer> {
    if (this.pathTracer) return this.pathTracer;
    const { WebGLPathTracer } = await import('three-gpu-pathtracer');
    const tracer = new WebGLPathTracer(this.renderer);
    tracer.renderToCanvas = true;
    tracer.rasterizeScene = false;
    tracer.dynamicLowRes = true;
    tracer.lowResScale = 0.25;
    tracer.minSamples = 1;
    tracer.fadeDuration = 120;
    tracer.renderDelay = 0;
    tracer.textureSize.set(1024, 1024);
    this.pathTracer = tracer;
    return tracer;
  }

  private disposeTraceScene(): void {
    const environment = this.traceScene?.environment;
    if (environment?.userData.bimPathTraceOwned) environment.dispose();
    this.traceScene = null;
  }

  async prepare(
    sourceScene: THREE.Scene,
    root: THREE.Object3D,
    camera: THREE.Camera,
    capability: PathTraceCapability,
  ): Promise<void> {
    this.buildNonce += 1;
    const nonce = this.buildNonce;
    this.activeCamera = camera;
    this.previewSamples = capability.previewSamples;
    this.targetSamples = capability.targetSamples;

    if (capability.status === 'unsupported') {
      this.emit({
        phase: 'unsupported',
        message: capability.reason,
        samples: 0,
        previewSamples: 0,
        targetSamples: 0,
        progress: 0,
        meshCount: 0,
        triangleCount: 0,
      });
      return;
    }

    const tracer = await this.ensureTracer();
    tracer.renderScale = capability.renderScale;
    tracer.bounces = capability.bounces;
    tracer.transmissiveBounces = Math.max(2, Math.min(4, capability.bounces));
    tracer.filterGlossyFactor = capability.status === 'degraded' ? 0.6 : 0.35;

    this.emit({
      phase: 'preparing',
      message: capability.reason,
      samples: 0,
      previewSamples: capability.previewSamples,
      targetSamples: capability.targetSamples,
      progress: 0,
      meshCount: 0,
      triangleCount: 0,
    });

    try {
      const filtered = buildPathTraceScene(sourceScene, root);
      if (nonce !== this.buildNonce || this.disposed) return;
      this.disposeTraceScene();
      this.traceScene = filtered.scene;
      this.meshCount = filtered.meshCount;
      this.triangleCount = filtered.triangleCount;

      tracer.setScene(filtered.scene, camera);
      if (nonce !== this.buildNonce || this.disposed) return;

      camera.updateMatrixWorld(true);
      this.lastCameraMatrix.copy(camera.matrixWorld);
      this.lastProjectionMatrix.copy(camera.projectionMatrix);
      tracer.reset();
      this.emit({
        phase: capability.status === 'degraded' ? 'degraded' : 'rendering',
        message: capability.reason,
        samples: 0,
        previewSamples: capability.previewSamples,
        targetSamples: capability.targetSamples,
        progress: 0,
        meshCount: filtered.meshCount,
        triangleCount: filtered.triangleCount,
      });
    } catch (error) {
      if (nonce !== this.buildNonce || this.disposed) return;
      // Keep this visible in runtime captures; path tracer failures usually come from
      // scene/material data incompatibilities that need the original stack.
      console.error('Path trace preview failed', error);
      this.emit({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Path trace preview failed.',
        samples: 0,
        previewSamples: capability.previewSamples,
        targetSamples: capability.targetSamples,
        progress: 0,
        meshCount: this.meshCount,
        triangleCount: this.triangleCount,
      });
    }
  }

  renderSample(): boolean {
    const tracer = this.pathTracer;
    const camera = this.activeCamera;
    if (!tracer || !camera || !this.traceScene) return false;
    if (this.lastState.phase === 'unsupported' || this.lastState.phase === 'error') return false;

    camera.updateMatrixWorld(true);
    if (
      !matricesEqual(camera.matrixWorld, this.lastCameraMatrix) ||
      !matricesEqual(camera.projectionMatrix, this.lastProjectionMatrix)
    ) {
      this.lastCameraMatrix.copy(camera.matrixWorld);
      this.lastProjectionMatrix.copy(camera.projectionMatrix);
      tracer.updateCamera();
      this.emit({
        phase: this.lastState.phase === 'degraded' ? 'degraded' : 'rendering',
        samples: 0,
        progress: 0,
      });
    }

    if (tracer.samples < this.targetSamples) {
      tracer.renderSample();
    }

    const rawSamples = Math.min(tracer.samples, this.targetSamples);
    const samples = Math.floor(rawSamples);
    this.emit({
      phase: rawSamples >= this.targetSamples ? 'complete' : this.lastState.phase,
      samples,
      previewSamples: this.previewSamples,
      targetSamples: this.targetSamples,
      progress: this.targetSamples > 0 ? rawSamples / this.targetSamples : 0,
      meshCount: this.meshCount,
      triangleCount: this.triangleCount,
    });
    return true;
  }

  reset(): void {
    this.pathTracer?.reset();
    this.emit({ samples: 0, progress: 0 });
  }

  dispose(): void {
    this.disposed = true;
    this.buildNonce += 1;
    this.pathTracer?.dispose();
    this.pathTracer = null;
    this.disposeTraceScene();
    this.activeCamera = null;
    this.onState(IDLE_STATE);
  }
}

export const idlePathTracePreviewState = IDLE_STATE;
