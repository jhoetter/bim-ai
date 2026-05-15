import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react';
import * as THREE from 'three';
import {
  alignmentForPick,
  compassLabelFromAzimuth,
  type ViewCubeAlignment,
  type ViewCubeCorner,
  type ViewCubeEdge,
  type ViewCubeFace,
  type ViewCubePick,
} from './viewCubeAlignment';
import {
  hoverTargetFromPick,
  nearestViewCubeSnapTarget,
  poseFromDrag,
  VIEWCUBE_MAX_ELEVATION,
  VIEWCUBE_MIN_ELEVATION,
} from './viewcube/orientation';

export interface ViewCubeProps {
  currentAzimuth: number;
  /** Camera elevation in radians (0 = horizontal, π/2 = straight down). */
  currentElevation: number;
  onPick: (pick: ViewCubePick, alignment: ViewCubeAlignment) => void;
  /** Raw pixel deltas during a drag. Viewport calls rig.orbit(dx, dy). */
  onDrag?: (dxPx: number, dyPx: number) => void;
  onSetHome?: () => void;
  className?: string;
}

const WIDGET_SIZE = 184;
const STAGE_SIZE = 130;
const STAGE_TOP = 11;
const STAGE_LEFT = 27;
const DRAG_THRESHOLD_PX = 4;
const THREE_CUBE_SIZE = 2;
const THREE_HALF = THREE_CUBE_SIZE / 2;
const THREE_CAMERA_DISTANCE = 6;
const THREE_CAMERA_EXTENT = 1.9;
const FACE_TEXTURE_SIZE = 256;

type HoverTarget =
  | { kind: 'face'; face: ViewCubeFace }
  | { kind: 'edge'; edge: ViewCubeEdge }
  | { kind: 'corner'; corner: ViewCubeCorner }
  | null;

type CompassDirection = 'N' | 'E' | 'S' | 'W';

type Vec3 = { x: number; y: number; z: number };

interface FaceDef {
  id: ViewCubeFace;
  normal: Vec3;
  position: Vec3;
  rotation: Vec3;
  fill: string;
}

interface ViewCubeThreeHandle {
  pick: (clientX: number, clientY: number) => Exclude<ViewCubePick, { kind: 'home' }> | null;
}

const FACES: FaceDef[] = [
  {
    id: 'FRONT',
    normal: { x: 0, y: 0, z: 1 },
    position: { x: 0, y: 0, z: THREE_HALF },
    rotation: { x: 0, y: 0, z: 0 },
    fill: 'rgb(236, 238, 241)',
  },
  {
    id: 'RIGHT',
    normal: { x: 1, y: 0, z: 0 },
    position: { x: THREE_HALF, y: 0, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    fill: 'rgb(222, 225, 229)',
  },
  {
    id: 'BACK',
    normal: { x: 0, y: 0, z: -1 },
    position: { x: 0, y: 0, z: -THREE_HALF },
    rotation: { x: 0, y: Math.PI, z: 0 },
    fill: 'rgb(227, 230, 234)',
  },
  {
    id: 'LEFT',
    normal: { x: -1, y: 0, z: 0 },
    position: { x: -THREE_HALF, y: 0, z: 0 },
    rotation: { x: 0, y: -Math.PI / 2, z: 0 },
    fill: 'rgb(232, 235, 238)',
  },
  {
    id: 'TOP',
    normal: { x: 0, y: 1, z: 0 },
    position: { x: 0, y: THREE_HALF, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    fill: 'rgb(247, 248, 250)',
  },
  {
    id: 'BOTTOM',
    normal: { x: 0, y: -1, z: 0 },
    position: { x: 0, y: -THREE_HALF, z: 0 },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    fill: 'rgb(214, 219, 225)',
  },
];

const EDGE_POINTS: Record<ViewCubeEdge, [Vec3, Vec3]> = {
  'FRONT-TOP': [
    { x: -1, y: 1, z: 1 },
    { x: 1, y: 1, z: 1 },
  ],
  'BACK-TOP': [
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
  ],
  'LEFT-TOP': [
    { x: -1, y: 1, z: -1 },
    { x: -1, y: 1, z: 1 },
  ],
  'RIGHT-TOP': [
    { x: 1, y: 1, z: 1 },
    { x: 1, y: 1, z: -1 },
  ],
  'FRONT-BOTTOM': [
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
  ],
  'BACK-BOTTOM': [
    { x: 1, y: -1, z: -1 },
    { x: -1, y: -1, z: -1 },
  ],
  'LEFT-BOTTOM': [
    { x: -1, y: -1, z: -1 },
    { x: -1, y: -1, z: 1 },
  ],
  'RIGHT-BOTTOM': [
    { x: 1, y: -1, z: 1 },
    { x: 1, y: -1, z: -1 },
  ],
  'FRONT-LEFT': [
    { x: -1, y: -1, z: 1 },
    { x: -1, y: 1, z: 1 },
  ],
  'FRONT-RIGHT': [
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
  ],
  'BACK-LEFT': [
    { x: -1, y: -1, z: -1 },
    { x: -1, y: 1, z: -1 },
  ],
  'BACK-RIGHT': [
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
  ],
};

const CORNER_POINTS: Record<ViewCubeCorner, Vec3> = {
  'TOP-NE': { x: 1, y: 1, z: 1 },
  'TOP-NW': { x: -1, y: 1, z: 1 },
  'TOP-SE': { x: 1, y: 1, z: -1 },
  'TOP-SW': { x: -1, y: 1, z: -1 },
  'BOTTOM-NE': { x: 1, y: -1, z: 1 },
  'BOTTOM-NW': { x: -1, y: -1, z: 1 },
  'BOTTOM-SE': { x: 1, y: -1, z: -1 },
  'BOTTOM-SW': { x: -1, y: -1, z: -1 },
};

const COMPASS_CENTER = { x: 92, y: 113 };
const COMPASS_LABEL_RX = 68;
const COMPASS_LABEL_RY = 38;
const COMPASS_LABEL_REFERENCE_AZIMUTH = Math.PI / 2;
const COMPASS_LABEL_REFERENCE_POSITIONS: Record<CompassDirection, { x: number; y: number }> = {
  W: { x: 43, y: 94 },
  N: { x: 141, y: 94 },
  S: { x: 36, y: 146 },
  E: { x: 148, y: 146 },
};

const visuallyHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
  pointerEvents: 'none',
};

export function ViewCube({
  currentAzimuth,
  currentElevation,
  onPick,
  onDrag,
  className,
}: ViewCubeProps): JSX.Element {
  const dragRef = useRef({
    dragging: false,
    startAzimuth: currentAzimuth,
    startElevation: currentElevation,
    dx: 0,
    dy: 0,
    totalMoved: 0,
    clickPick: null as Exclude<ViewCubePick, { kind: 'home' }> | null,
  });
  const suppressNextClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ azimuth: number; elevation: number } | null>(
    null,
  );
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);
  const threeRef = useRef<ViewCubeThreeHandle | null>(null);

  const displayAzimuth = dragPreview?.azimuth ?? currentAzimuth;
  const displayElevation = dragPreview?.elevation ?? currentElevation;
  const snapTarget = nearestViewCubeSnapTarget({
    azimuth: displayAzimuth,
    elevation: displayElevation,
  });
  const activeHoverTarget =
    hoverTarget ?? (isDragging ? hoverTargetFromPick(snapTarget?.pick ?? null) : null);

  const emit = useCallback(
    (pick: ViewCubePick): void => {
      onPick(pick, alignmentForPick(pick));
    },
    [onPick],
  );

  function handleKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      emit({ kind: 'home' });
    }
  }

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const stageEl = e.currentTarget;
      dragRef.current = {
        dragging: true,
        startAzimuth: currentAzimuth,
        startElevation: currentElevation,
        dx: 0,
        dy: 0,
        totalMoved: 0,
        clickPick: threeRef.current?.pick(e.clientX, e.clientY) ?? null,
      };
      setIsDragging(true);
      setHoverTarget(null);
      stageEl.setPointerCapture?.(e.pointerId);
      document.body.style.cursor = 'grabbing';

      const onMove = (ev: PointerEvent) => {
        const state = dragRef.current;
        state.dx += ev.movementX;
        state.dy += ev.movementY;
        state.totalMoved += Math.abs(ev.movementX) + Math.abs(ev.movementY);
        const preview = poseFromDrag({
          startAzimuth: state.startAzimuth,
          startElevation: state.startElevation,
          dxPx: state.dx,
          dyPx: state.dy,
        });
        setDragPreview(preview);
        setHoverTarget(hoverTargetFromPick(nearestViewCubeSnapTarget(preview)?.pick ?? null));
        onDrag?.(ev.movementX, ev.movementY);
      };

      const onUp = (ev: PointerEvent) => {
        if (dragRef.current.totalMoved > DRAG_THRESHOLD_PX) {
          suppressNextClickRef.current = true;
          const preview = poseFromDrag({
            startAzimuth: dragRef.current.startAzimuth,
            startElevation: dragRef.current.startElevation,
            dxPx: dragRef.current.dx,
            dyPx: dragRef.current.dy,
          });
          const snapped = nearestViewCubeSnapTarget(preview);
          if (snapped) emit(snapped.pick);
        } else {
          const pick = dragRef.current.clickPick ?? threeRef.current?.pick(ev.clientX, ev.clientY);
          const compassPick = pick
            ? null
            : pickCompassDirectionFromPoint(stageEl, ev.clientX, ev.clientY, currentAzimuth);
          if (pick) emit(pick);
          else if (compassPick) emit(compassPick);
        }
        dragRef.current.dragging = false;
        setIsDragging(false);
        setDragPreview(null);
        setHoverTarget(null);
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [currentAzimuth, currentElevation, emit, onDrag],
  );

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.dragging) return;
    const pick = threeRef.current?.pick(e.clientX, e.clientY) ?? null;
    setHoverTarget(pickToHoverTarget(pick));
  }, []);

  const handleClickCapture = useCallback((e: MouseEvent) => {
    if (suppressNextClickRef.current) {
      e.stopPropagation();
      suppressNextClickRef.current = false;
    }
  }, []);

  return (
    <div
      data-testid="view-cube"
      role="group"
      aria-label="ViewCube"
      onKeyDown={handleKey}
      className={['relative flex items-center justify-center', className ?? ''].join(' ')}
      style={{ width: WIDGET_SIZE, height: WIDGET_SIZE, userSelect: 'none' }}
    >
      <ViewCubeCompass currentAzimuth={currentAzimuth} onPick={emit} onDrag={onDrag} />

      <div
        data-testid="view-cube-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClickCapture={handleClickCapture}
        onPointerLeave={() => setHoverTarget(null)}
        style={{
          position: 'absolute',
          left: STAGE_LEFT,
          top: STAGE_TOP,
          width: STAGE_SIZE,
          height: STAGE_SIZE,
          zIndex: 2,
          cursor: isDragging ? 'grabbing' : activeHoverTarget ? 'pointer' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <ViewCubeThreeControl
          ref={threeRef}
          azimuth={displayAzimuth}
          elevation={displayElevation}
          hoverTarget={activeHoverTarget}
        />

        {FACES.map((face) => (
          <button
            key={face.id}
            type="button"
            onClick={() => emit({ kind: 'face', face: face.id })}
            aria-label={`Align camera to ${face.id}`}
            style={visuallyHiddenStyle}
          />
        ))}
        {(Object.keys(EDGE_POINTS) as ViewCubeEdge[]).map((edge) => (
          <button
            key={edge}
            type="button"
            onClick={() => emit({ kind: 'edge', edge })}
            aria-label={`Align camera to ${edge}`}
            style={visuallyHiddenStyle}
          />
        ))}
        {(Object.keys(CORNER_POINTS) as ViewCubeCorner[]).map((corner) => (
          <button
            key={corner}
            type="button"
            onClick={() => emit({ kind: 'corner', corner })}
            aria-label={`Align camera to ${corner}`}
            style={visuallyHiddenStyle}
          />
        ))}
      </div>
    </div>
  );
}

const ViewCubeThreeControl = forwardRef<
  ViewCubeThreeHandle,
  { azimuth: number; elevation: number; hoverTarget: HoverTarget }
>(function ViewCubeThreeControl({ azimuth, elevation, hoverTarget }, ref): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<ViewCubeThreeRuntime | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.navigator.userAgent.includes('jsdom')) return undefined;
    const runtime = createViewCubeThreeRuntime(host);
    runtimeRef.current = runtime;
    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.render(azimuth, elevation, hoverTarget);
  }, [azimuth, elevation, hoverTarget]);

  useImperativeHandle(
    ref,
    () => ({
      pick(clientX: number, clientY: number) {
        return runtimeRef.current?.pick(clientX, clientY) ?? null;
      },
    }),
    [],
  );

  return (
    <div
      ref={hostRef}
      data-testid="view-cube-three"
      aria-hidden="true"
      className="absolute inset-0"
      style={{ width: STAGE_SIZE, height: STAGE_SIZE, pointerEvents: 'none', userSelect: 'none' }}
    />
  );
});

interface ViewCubeThreeRuntime {
  pick: (clientX: number, clientY: number) => Exclude<ViewCubePick, { kind: 'home' }> | null;
  render: (azimuth: number, elevation: number, hoverTarget: HoverTarget) => void;
  dispose: () => void;
}

function createViewCubeThreeRuntime(host: HTMLDivElement): ViewCubeThreeRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -THREE_CAMERA_EXTENT,
    THREE_CAMERA_EXTENT,
    THREE_CAMERA_EXTENT,
    -THREE_CAMERA_EXTENT,
    0.1,
    20,
  );
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const faceHits: THREE.Object3D[] = [];
  const edgeHits: THREE.Object3D[] = [];
  const cornerHits: THREE.Object3D[] = [];
  const faceHighlights = new Map<ViewCubeFace, THREE.Mesh>();
  const edgeHighlights = new Map<ViewCubeEdge, THREE.Mesh>();
  const cornerHighlights = new Map<ViewCubeCorner, THREE.Mesh>();

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(STAGE_SIZE, STAGE_SIZE, false);
  renderer.domElement.setAttribute('data-testid', 'view-cube-three-canvas');
  renderer.domElement.style.width = `${STAGE_SIZE}px`;
  renderer.domElement.style.height = `${STAGE_SIZE}px`;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.style.userSelect = 'none';
  host.appendChild(renderer.domElement);

  const faceGeometry = new THREE.PlaneGeometry(THREE_CUBE_SIZE, THREE_CUBE_SIZE);
  for (const face of FACES) {
    const visual = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshBasicMaterial({
        map: createFaceTexture(face.id, face.fill),
        side: THREE.FrontSide,
      }),
    );
    applyFaceTransform(visual, face, 0);
    scene.add(visual);

    const hit = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    hit.userData.pick = { kind: 'face', face: face.id } satisfies Exclude<
      ViewCubePick,
      { kind: 'home' }
    >;
    applyFaceTransform(hit, face, 0.014);
    scene.add(hit);
    faceHits.push(hit);

    const highlight = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x207eff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    highlight.visible = false;
    applyFaceTransform(highlight, face, 0.018);
    scene.add(highlight);
    faceHighlights.set(face.id, highlight);
  }

  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        THREE_CUBE_SIZE + 0.008,
        THREE_CUBE_SIZE + 0.008,
        THREE_CUBE_SIZE + 0.008,
      ),
    ),
    new THREE.LineBasicMaterial({ color: 0x8f969f, linewidth: 1 }),
  );
  scene.add(edgeLines);

  const edgeHitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const edgeHighlightMaterial = new THREE.MeshBasicMaterial({
    color: 0x207eff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  for (const [edge, points] of Object.entries(EDGE_POINTS) as [ViewCubeEdge, [Vec3, Vec3]][]) {
    const hit = createCylinderBetween(points[0], points[1], 0.13, edgeHitMaterial);
    hit.userData.pick = { kind: 'edge', edge } satisfies Exclude<ViewCubePick, { kind: 'home' }>;
    scene.add(hit);
    edgeHits.push(hit);

    const highlight = createCylinderBetween(points[0], points[1], 0.045, edgeHighlightMaterial);
    highlight.visible = false;
    scene.add(highlight);
    edgeHighlights.set(edge, highlight);
  }

  const cornerHitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const cornerHighlightMaterial = new THREE.MeshBasicMaterial({
    color: 0x207eff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  for (const [corner, point] of Object.entries(CORNER_POINTS) as [ViewCubeCorner, Vec3][]) {
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), cornerHitMaterial);
    hit.position.copy(vec3(point));
    hit.userData.pick = { kind: 'corner', corner } satisfies Exclude<
      ViewCubePick,
      { kind: 'home' }
    >;
    scene.add(hit);
    cornerHits.push(hit);

    const highlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      cornerHighlightMaterial,
    );
    highlight.position.copy(vec3(point));
    highlight.visible = false;
    scene.add(highlight);
    cornerHighlights.set(corner, highlight);
  }

  function render(azimuth: number, elevation: number, target: HoverTarget): void {
    positionViewCubeCamera(camera, azimuth, elevation);
    for (const item of faceHighlights.values()) item.visible = false;
    for (const item of edgeHighlights.values()) item.visible = false;
    for (const item of cornerHighlights.values()) item.visible = false;
    if (target?.kind === 'face') faceHighlights.get(target.face)!.visible = true;
    if (target?.kind === 'edge') edgeHighlights.get(target.edge)!.visible = true;
    if (target?.kind === 'corner') cornerHighlights.get(target.corner)!.visible = true;
    renderer.render(scene, camera);
  }

  function pick(clientX: number, clientY: number): Exclude<ViewCubePick, { kind: 'home' }> | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    return (
      pickFromObjects(raycaster, cornerHits) ??
      pickFromObjects(raycaster, edgeHits) ??
      pickFromObjects(raycaster, faceHits)
    );
  }

  render(0, 0.45, null);

  return {
    pick,
    render,
    dispose() {
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}

function pickFromObjects(
  raycaster: THREE.Raycaster,
  objects: THREE.Object3D[],
): Exclude<ViewCubePick, { kind: 'home' }> | null {
  const hit = raycaster.intersectObjects(objects, false)[0]?.object;
  return (hit?.userData.pick as Exclude<ViewCubePick, { kind: 'home' }> | undefined) ?? null;
}

function createFaceTexture(face: ViewCubeFace, fill: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_TEXTURE_SIZE;
  canvas.height = FACE_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, FACE_TEXTURE_SIZE, FACE_TEXTURE_SIZE);
  ctx.fillStyle = 'rgb(47, 53, 64)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px Arial, Helvetica, sans-serif';
  ctx.fillText(face, FACE_TEXTURE_SIZE / 2, FACE_TEXTURE_SIZE / 2 + 2, FACE_TEXTURE_SIZE * 0.76);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createCylinderBetween(
  a: Vec3,
  b: Vec3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const start = vec3(a);
  const end = vec3(b);
  const delta = end.clone().sub(start);
  const lengthValue = delta.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, lengthValue, 10),
    material,
  );
  mesh.position.copy(start.add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function applyFaceTransform(mesh: THREE.Object3D, face: FaceDef, offset: number): void {
  mesh.position.set(
    face.position.x + face.normal.x * offset,
    face.position.y + face.normal.y * offset,
    face.position.z + face.normal.z * offset,
  );
  mesh.rotation.set(face.rotation.x, face.rotation.y, face.rotation.z);
}

function positionViewCubeCamera(
  camera: THREE.OrthographicCamera,
  azimuth: number,
  elevation: number,
): void {
  const clampedElevation = clamp(elevation, VIEWCUBE_MIN_ELEVATION, VIEWCUBE_MAX_ELEVATION);
  const cosElevation = Math.cos(clampedElevation);
  const direction = new THREE.Vector3(
    Math.sin(azimuth) * cosElevation,
    Math.sin(clampedElevation),
    Math.cos(azimuth) * cosElevation,
  ).normalize();
  camera.position.copy(direction.multiplyScalar(THREE_CAMERA_DISTANCE));
  camera.up.set(0, 1, 0);
  if (Math.abs(camera.position.y) > THREE_CAMERA_DISTANCE * 0.92) {
    camera.up.set(0, 0, camera.position.y > 0 ? -1 : 1);
  }
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function vec3(value: Vec3): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

function pickToHoverTarget(pick: ViewCubePick | null): HoverTarget {
  if (!pick || pick.kind === 'home') return null;
  return pick;
}

function pickCompassDirectionFromPoint(
  stageEl: HTMLElement,
  clientX: number,
  clientY: number,
  currentAzimuth: number,
): ViewCubePick | null {
  const widgetRect = stageEl.parentElement?.getBoundingClientRect();
  if (!widgetRect) return null;
  const x = clientX - widgetRect.left;
  const y = clientY - widgetRect.top;
  const hit = compassDirectionTargets(currentAzimuth).find((item) => {
    const nx = (x - item.x) / item.rx;
    const ny = (y - item.y) / item.ry;
    return nx * nx + ny * ny <= 1;
  });
  return hit ? pickForCompassDirection(hit.direction) : null;
}

function compassDirectionTargets(
  currentAzimuth: number,
): { direction: CompassDirection; x: number; y: number; rx: number; ry: number; size: number }[] {
  return (['W', 'N', 'S', 'E'] as CompassDirection[]).map((direction) => {
    const reference = COMPASS_LABEL_REFERENCE_POSITIONS[direction];
    const referenceTheta = Math.atan2(
      (reference.y - COMPASS_CENTER.y) / COMPASS_LABEL_RY,
      (reference.x - COMPASS_CENTER.x) / COMPASS_LABEL_RX,
    );
    const theta = referenceTheta - (currentAzimuth - COMPASS_LABEL_REFERENCE_AZIMUTH);
    const lowerHalf = Math.sin(theta) > 0;
    return {
      direction,
      x: COMPASS_CENTER.x + Math.cos(theta) * COMPASS_LABEL_RX,
      y: COMPASS_CENTER.y + Math.sin(theta) * COMPASS_LABEL_RY,
      rx: lowerHalf ? 26 : 21,
      ry: lowerHalf ? 24 : 21,
      size: lowerHalf ? 27 : 23,
    };
  });
}

function ViewCubeCompass({
  currentAzimuth,
  onPick,
  onDrag,
}: {
  currentAzimuth: number;
  onPick: (pick: ViewCubePick) => void;
  onDrag?: (dxPx: number, dyPx: number) => void;
}): JSX.Element {
  const cardinal = compassLabelFromAzimuth(currentAzimuth);
  const directionTargets = compassDirectionTargets(currentAzimuth);
  const dragRef = useRef({ moved: 0, suppressClick: false });

  const handleCompassPointerDown = useCallback(
    (direction: CompassDirection | null, event: ReactPointerEvent<SVGElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragRef.current = { moved: 0, suppressClick: false };
      const target = event.currentTarget;
      target.setPointerCapture?.(event.pointerId);

      const onMove = (ev: PointerEvent) => {
        dragRef.current.moved += Math.abs(ev.movementX);
        onDrag?.(ev.movementX, 0);
      };

      const onUp = () => {
        if (dragRef.current.moved > DRAG_THRESHOLD_PX) {
          dragRef.current.suppressClick = true;
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onDrag],
  );

  const handleCompassClick = useCallback(
    (direction: CompassDirection, event: MouseEvent<SVGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (dragRef.current.suppressClick) {
        dragRef.current.suppressClick = false;
        return;
      }
      onPick(pickForCompassDirection(direction));
    },
    [onPick],
  );

  return (
    <svg
      data-testid="view-cube-compass"
      data-cardinal={cardinal}
      viewBox={`0 0 ${WIDGET_SIZE} ${WIDGET_SIZE}`}
      width={WIDGET_SIZE}
      height={WIDGET_SIZE}
      className="absolute inset-0"
      aria-hidden="true"
    >
      <defs>
        <filter id="viewcube-compass-soft-shadow" x="-30%" y="-60%" width="160%" height="220%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="4"
            floodColor="rgb(15 23 42)"
            floodOpacity="0.13"
          />
        </filter>
        <marker
          id="viewcube-compass-arrow-left"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M1 1l8 4-8 4 2.2-4z" fill="rgb(100 116 139 / 0.58)" />
        </marker>
        <marker
          id="viewcube-compass-arrow-right"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M1 1l8 4-8 4 2.2-4z" fill="rgb(100 116 139 / 0.58)" />
        </marker>
      </defs>
      <g className="pointer-events-none">
        <ellipse
          cx="92"
          cy="113"
          rx="80"
          ry="41"
          fill="none"
          stroke="rgb(100 116 139 / 0.36)"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
        <ellipse
          cx="92"
          cy="113"
          rx="61"
          ry="31"
          fill="none"
          stroke="rgb(100 116 139 / 0.15)"
          strokeWidth="1.2"
          strokeDasharray="5 5"
        />
        <ellipse cx="92" cy="106" rx="56" ry="28" fill="rgb(15 23 42 / 0.04)" />
        <path
          d="M23 103c8-15 24-25 45-29"
          fill="none"
          stroke="rgb(100 116 139 / 0.58)"
          strokeWidth="2.2"
          strokeLinecap="round"
          markerEnd="url(#viewcube-compass-arrow-left)"
          filter="url(#viewcube-compass-soft-shadow)"
        />
        <path
          d="M161 103c-8-15-24-25-45-29"
          fill="none"
          stroke="rgb(100 116 139 / 0.58)"
          strokeWidth="2.2"
          strokeLinecap="round"
          markerEnd="url(#viewcube-compass-arrow-right)"
          filter="url(#viewcube-compass-soft-shadow)"
        />
      </g>

      <g
        className="pointer-events-auto cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => handleCompassPointerDown(null, event)}
      >
        <ellipse cx="92" cy="113" rx="84" ry="45" fill="transparent" />
      </g>
      {directionTargets.map(({ direction, x, y, size }) => (
        <CompassText
          key={direction}
          x={x}
          y={y}
          label={direction}
          opacity={y > COMPASS_CENTER.y ? 0.52 : 0.47}
          size={size}
          onPointerDown={(event) => handleCompassPointerDown(direction, event)}
          onClick={(event) => handleCompassClick(direction, event)}
        />
      ))}
      {directionTargets.map(({ direction, x, y, rx, ry }) => (
        <ellipse
          key={`${direction}-hit`}
          cx={x}
          cy={y}
          rx={rx}
          ry={ry}
          fill="transparent"
          className="cursor-pointer"
          pointerEvents="all"
          onPointerDown={(event) => handleCompassPointerDown(direction, event)}
          onClick={(event) => handleCompassClick(direction, event)}
        />
      ))}
    </svg>
  );
}

function CompassText({
  x,
  y,
  label,
  opacity,
  size,
  onPointerDown,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  opacity: number;
  size: number;
  onPointerDown: (event: ReactPointerEvent<SVGTextElement>) => void;
  onClick: (event: MouseEvent<SVGElement>) => void;
}): JSX.Element {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize={size}
      fontWeight="700"
      stroke={`rgb(71 85 105 / ${opacity * 0.35})`}
      strokeWidth="0.8"
      paintOrder="stroke"
      fill={`rgb(71 85 105 / ${opacity})`}
      className="cursor-pointer select-none"
      pointerEvents="all"
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {label}
    </text>
  );
}

function pickForCompassDirection(direction: CompassDirection): ViewCubePick {
  if (direction === 'N') return { kind: 'face', face: 'BACK' };
  if (direction === 'E') return { kind: 'face', face: 'RIGHT' };
  if (direction === 'S') return { kind: 'face', face: 'FRONT' };
  return { kind: 'face', face: 'LEFT' };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
