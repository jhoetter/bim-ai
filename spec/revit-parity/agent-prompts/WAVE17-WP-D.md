# Wave 17 — WP-D: Head-Height Clearance Check (§8.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/hostedOpeningDimensions.ts   — opening clearance helpers (may exist)
packages/web/src/plan/openingClearance.ts           — clearance detection (may exist)
packages/web/src/plan/symbology.ts                  — plan symbols (for violation overlay)
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
packages/web/src/workspace/Workspace.tsx             — handlers
packages/core/src/index.ts                          — door/window/stair element types
```

Search for `clearance`, `headHeight`, `head_height`, `hostedOpening`, `openingClearance` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `hostedOpeningDimensions.ts` (if exists): read fully — what does it compute?
2. `openingClearance.ts` (if exists): read fully — what violations does it detect?
3. `core/index.ts`: find `door` element — read `heightMm`, `widthMm`, and any clearance fields. Find `stair` — read `totalHeightMm`, `riserCount`.
4. `symbology.ts`: find any existing clearance violation rendering. Read the pattern for rendering warning overlays.

---

## Tasks

### A — `checkHeadHeightClearances` in `openingClearance.ts`

Create or extend `packages/web/src/plan/openingClearance.ts`:

```ts
export type ClearanceViolation = {
  elementId: string;
  kind: 'door' | 'window' | 'stair';
  clearanceMm: number; // actual head height at this element
  requiredMm: number; // minimum required (default: 2100mm for doors/stairs)
  positionMm: { xMm: number; yMm: number };
  message: string; // e.g. "Door head height 1800mm < required 2100mm"
};

/**
 * Checks all doors, windows, and stairs on a level for head-height clearance.
 * Returns violations where actual clearance < requiredMm.
 */
export function checkHeadHeightClearances(
  levelId: string,
  elementsById: Record<string, Element | undefined>,
  requiredDoorMm = 2100,
  requiredStairMm = 2000,
): ClearanceViolation[] {
  const violations: ClearanceViolation[] = [];

  for (const el of Object.values(elementsById)) {
    if (!el || el.levelId !== levelId) continue;

    if (el.kind === 'door') {
      const headH = el.heightMm ?? 2100;
      if (headH < requiredDoorMm) {
        violations.push({
          elementId: el.id,
          kind: 'door',
          clearanceMm: headH,
          requiredMm: requiredDoorMm,
          positionMm: el.positionMm,
          message: `Door head height ${headH}mm < required ${requiredDoorMm}mm`,
        });
      }
    }

    if (el.kind === 'stair') {
      // For stair: check landing head height (totalHeightMm / riserCount gives riser height,
      // available head height is storey height - totalHeightMm projected at landing)
      // Simplified: if stair heightMm is provided, check it directly
      const stairH = el.totalHeightMm ?? (el.riserCount ?? 16) * (el.riserHeightMm ?? 175);
      // Head height above mid-run landing = level height - stairH / 2 (approximation)
      // For simplicity: flag if riserHeightMm * riserCount > 3000 without explicit check
      // More accurate: use hostedOpeningDimensions if available
      // Simple approach: always pass stairs with reasonable geometry (leave detailed check as future work)
      _ = stairH; // satisfy lint
    }
  }

  return violations;
}
```

---

### B — Plan symbol overlay for violations

In `symbology.ts`, add a function to render clearance violation markers:

```ts
export function buildClearanceViolationMarkers(
  violations: ClearanceViolation[],
  scene: THREE.Scene | THREE.Group,
): void {
  for (const v of violations) {
    // Red circle at violation position
    const geo = new THREE.CircleGeometry(0.15, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(v.positionMm.xMm / 1000, PLAN_Y + 0.004, v.positionMm.yMm / 1000);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.clearanceViolation = true;
    mesh.userData.clearanceElementId = v.elementId;
    mesh.userData.clearanceMessage = v.message;
    scene.add(mesh);
  }
}
```

---

### C — Palette command + Workspace handler

In `defaultCommands.ts`:

```ts
{
  id: 'analysis.check-clearances',
  label: 'Check Head-Height Clearances',
  keywords: ['clearance', 'head height', 'door', 'stair', 'check', 'analysis'],
  category: 'command',
  invoke: (ctx) => ctx.checkClearances?.(),
},
```

In `Workspace.tsx`:

```ts
checkClearances: () => {
  const activeLevelId = /* get active level ID */;
  const violations = checkHeadHeightClearances(activeLevelId, elementsById);
  // Store violations in local state and render them
  setClearanceViolations(violations);
  if (violations.length === 0) {
    alert('No clearance violations found.');
  } else {
    alert(`${violations.length} clearance violation(s) found. See highlighted elements.`);
  }
},
```

Add `const [clearanceViolations, setClearanceViolations] = useState<ClearanceViolation[]>([])` to Workspace state.

Pass `clearanceViolations` to the plan canvas for overlay rendering.

---

### D — ClearanceViolationPanel component

Create `packages/web/src/workspace/ClearanceViolationPanel.tsx`:

```tsx
interface Props {
  violations: ClearanceViolation[];
  onClose: () => void;
}

export function ClearanceViolationPanel({ violations, onClose }: Props) {
  if (violations.length === 0) return null;
  return (
    <div
      data-testid="clearance-violation-panel"
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        background: '#fff',
        border: '2px solid #ef4444',
        borderRadius: 6,
        padding: 12,
        maxWidth: 300,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong data-testid="clearance-violation-count">
          {violations.length} clearance issue{violations.length !== 1 ? 's' : ''}
        </strong>
        <button data-testid="clearance-violation-close" onClick={onClose}>
          ×
        </button>
      </div>
      {violations.map((v) => (
        <div
          key={v.elementId}
          data-testid={`clearance-violation-${v.elementId}`}
          style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}
        >
          {v.message}
        </div>
      ))}
    </div>
  );
}
```

---

### E — Capability graph

In `commandCapabilities.ts`:

```ts
{ id: 'analysis.check-clearances', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### F — Tests

`packages/web/src/plan/openingClearance.test.ts`:

```ts
describe('checkHeadHeightClearances — §8.4', () => {
  it('returns empty array when no elements on level', () => { ... });
  it('flags door with heightMm below 2100', () => {
    const door = { kind: 'door', id: 'd1', levelId: 'L1', heightMm: 1800, positionMm: {xMm:0,yMm:0} };
    const result = checkHeadHeightClearances('L1', { d1: door as any });
    expect(result).toHaveLength(1);
    expect(result[0].elementId).toBe('d1');
    expect(result[0].clearanceMm).toBe(1800);
  });
  it('does not flag door with heightMm >= 2100', () => { ... });
  it('violation message contains element kind and measurements', () => { ... });
  it('ignores elements on other levels', () => { ... });
});
```

`packages/web/src/workspace/ClearanceViolationPanel.test.tsx`:

```ts
describe('ClearanceViolationPanel — §8.4', () => {
  it('renders null when violations is empty', () => { ... });
  it('renders clearance-violation-panel when violations exist', () => { ... });
  it('renders clearance-violation-count with correct count', () => { ... });
  it('renders one row per violation', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/D): head-height clearance check — violations panel + plan overlay (§8.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new clearance check tests.
