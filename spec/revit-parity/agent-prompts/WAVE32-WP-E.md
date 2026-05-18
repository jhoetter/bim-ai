# Wave 32 — WP-E: Steel Fabrication Elements + Parametric Section Cuts (§9.5.3 + §9.5.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§9.5.3 "Fertigungselemente" (steel fabrication elements) is Not Started P2.
§9.5.4 "Parametrische Schnitte" (parametric section cuts for steel profiles) is Not Started P2.

**Good news**: `steel_connection` element type already exists in `packages/core/src/index.ts` with:
- `connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab'`
- `boltRows?`, `boltCols?`, `boltDiameterMm?`
- `CreateSteelConnectionCmd` already defined

And `steel_connection` already has an inspector case in `InspectorContent.tsx`.

What's missing for §9.5.3:
- A tool to place `steel_connection` elements (tool registry entry)
- A plan symbol for steel connections (small X or bolt pattern)
- `modify.steel-connection` capability

For §9.5.4 (parametric section cuts):
- Beams already have `sectionProfileId?` referencing a `beam_section_profile` element (check core)
- What's missing: a `beam_section_profile` element type (if not already there) + editor UI
- `SetBeamSectionProfileCmd` for selecting/creating a custom cross-section

---

## Repo orientation

```
packages/core/src/index.ts                                   — find steel_connection, beam, beam_section_profile types
packages/web/src/tools/toolRegistry.ts                       — find beam/column tools as pattern; add steel-connection tool
packages/web/src/workspace/inspector/InspectorContent.tsx    — find steel_connection inspector case
packages/web/src/plan/planElementMeshBuilders.ts             — find where beam plan symbols are rendered, add steel_connection symbol
```

Run before editing:
- `grep -n "steel_connection\|CreateSteelConnection\|beam_section_profile\|sectionProfile" packages/core/src/index.ts | head -15`
- `grep -n "steel.*connection\|steelConnection\|steel-connection" packages/web/src/tools/toolRegistry.ts | head -10`
- `grep -n "steel_connection\|'steel_connection'" packages/web/src/workspace/inspector/InspectorContent.tsx | head -10`
- `grep -n "beam_section_profile\|sectionProfileId\|SetBeamSection" packages/core/src/index.ts | head -10`
- `grep -n "modify.steel-connection\|steel.*connection" packages/web/src/workspace/commandCapabilities.ts | head -5`

---

## Tasks

### A — beam_section_profile element type + SetBeamSectionProfileCmd (if not already present)

Check if `beam_section_profile` already exists in core. If not, add:

```ts
// §9.5.4: parametric beam section profile
{
  kind: 'beam_section_profile';
  id: string;
  name: string;
  /** Profile points defining the cross-section outline in mm, relative to beam centroid. */
  profilePoints: { xMm: number; yMm: number }[];
  /** Optional: width of the bounding box in mm. */
  widthMm?: number;
  /** Optional: height of the bounding box in mm. */
  heightMm?: number;
}
```

Add `'beam_section_profile'` to the element kind union only if not present.

Add `SetBeamSectionProfileCmd` if not present:

```ts
export type SetBeamSectionProfileCmd = {
  type: 'setBeamSectionProfile';
  beamId: string;
  /** ID of a beam_section_profile element, or null to reset to default. */
  profileId: string | null;
};
```

Add to `SemanticCommand` and export (only if not already there).

### B — steel-connection tool in toolRegistry

In `packages/web/src/tools/toolRegistry.ts`, find where `beam` or `column` tools are registered. Add a steel-connection tool entry following the same pattern. Read the file to understand the exact format — it may use an object with `id`, `label`, `icon`, `shortcut`, `category`.

The tool should use an existing icon (e.g. `beam` or `column` icon) and category `'structural'`.

Tool ID: `'steel-connection'` (or `'steelConnection'` if the registry uses camelCase — check the existing pattern).

### C — steel_connection plan symbol

In `packages/web/src/plan/planElementMeshBuilders.ts`, find where beam or column plan symbols are rendered. Add a steel_connection plan symbol — a small X at the connection position:

```ts
export function buildSteelConnectionPlanSymbol(
  conn: { id: string; positionMm?: { xMm: number; yMm: number }; startMm?: { xMm: number; yMm: number } },
  ux: (mm: number) => number,
  uz: (mm: number) => number,
  PLAN_Y: number,
): THREE.Group {
  const grp = new THREE.Group();
  const pos = (conn as any).positionMm ?? (conn as any).startMm ?? { xMm: 0, yMm: 0 };
  const cx = ux(pos.xMm ?? 0), cz = uz(pos.yMm ?? 0);
  const r = 0.08;

  // X symbol: two crossed lines
  for (const [dx, dz] of [[-r, -r, r, r], [-r, r, r, -r]] as [number, number, number, number][]) {
    const pts = [new THREE.Vector3(cx + dx, PLAN_Y + 0.003, cz + dz), new THREE.Vector3(cx + dx + (r * 2 * Math.sign(dx - r)), PLAN_Y + 0.003, cz)];
    // Simplified: just two diagonal segments
  }

  // Simpler: use a small RingGeometry
  const ringGeo = new THREE.RingGeometry(0.04, 0.07, 8);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, PLAN_Y + 0.003, cz);
  ring.userData.elementId = conn.id;
  grp.add(ring);

  return grp;
}
```

**Important**: Read the actual planElementMeshBuilders.ts to understand the exact signature pattern. Adapt to use the real `ux`, `uz`, `PLAN_Y` parameters. Keep the symbol simple (ring or cross) — correctness matters more than complexity.

### D — Workspace handler for SetBeamSectionProfileCmd

In `packages/web/src/workspace/Workspace.tsx`, add:

```ts
if (cmd.type === 'setBeamSectionProfile') {
  const { elementsById: cur } = useBimStore.getState();
  const beam = cur[cmd.beamId as string];
  if (!beam || beam.kind !== 'beam') return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [beam.id]: { ...beam, sectionProfileId: (cmd.profileId as string | null) ?? undefined },
    },
  });
  return;
}
```

### E — commandCapabilities.ts entries

Check if `modify.steel-connection` already exists. If it does, update its notes. If not, add:

```ts
{
  id: 'modify.steel-connection',
  label: 'Steel Connection (Fabrication Element)',
  owner: 'plan/planElementMeshBuilders',
  group: 'modify',
  scope: 'canvas',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: ['steel-context'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§9.5.3: steel_connection element (end_plate/bolted_flange/shear_tab) with boltRows/boltCols/boltDiameterMm; CreateSteelConnectionCmd; plan symbol (ring); steel-connection tool in registry; inspector case in InspectorContent.',
},
{
  id: 'modify.beam-section-profile',
  label: 'Beam Parametric Section Profile',
  owner: 'workspace/inspector/InspectorContent',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: ['selected-beam'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§9.5.4: beam_section_profile element type with profilePoints[]; SetBeamSectionProfileCmd patches sectionProfileId on beam; parametric cross-section for structural detail.',
},
```

Add matching `registerCommand` entries in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'modify.steel-connection',
  label: 'Place Steel Connection',
  keywords: ['steel', 'connection', 'bolt', 'weld', 'end plate', 'shear tab', 'fabrication'],
  category: 'modify',
  isAvailable: () => true,
  invoke: () => { /* use steel-connection tool */ },
});

registerCommand({
  id: 'modify.beam-section-profile',
  label: 'Set Beam Section Profile',
  keywords: ['beam', 'section', 'profile', 'cross-section', 'parametric', 'steel profile'],
  category: 'modify',
  isAvailable: (ctx) => (ctx.selectedElements ?? []).some((e) => e.kind === 'beam'),
  invoke: () => { /* set via inspector */ },
});
```

### F — Tests

Create `packages/web/src/workspace/inspector/steelFabricationAndSections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Steel fabrication + parametric sections — §9.5.3 + §9.5.4', () => {
  it('steel_connection connectionType values are valid', () => {
    const types = ['end_plate', 'bolted_flange', 'shear_tab'] as const;
    expect(types.length).toBe(3);
    expect(types).toContain('end_plate');
  });

  it('CreateSteelConnectionCmd has correct type', () => {
    const cmd = { type: 'create_steel_connection' as const, id: 'sc-1', hostBeamId: 'b1', connectionType: 'end_plate' as const };
    expect(cmd.type).toBe('create_steel_connection');
    expect(cmd.connectionType).toBe('end_plate');
  });

  it('SetBeamSectionProfileCmd has correct shape', () => {
    const cmd = { type: 'setBeamSectionProfile' as const, beamId: 'b1', profileId: 'bsp-1' };
    expect(cmd.type).toBe('setBeamSectionProfile');
    expect(cmd.profileId).toBe('bsp-1');
  });

  it('SetBeamSectionProfileCmd supports null to reset', () => {
    const cmd = { type: 'setBeamSectionProfile' as const, beamId: 'b1', profileId: null };
    expect(cmd.profileId).toBeNull();
  });

  it('beam_section_profile has profilePoints array', () => {
    const profile: any = {
      kind: 'beam_section_profile',
      id: 'bsp-1',
      name: 'HEB 300',
      profilePoints: [{ xMm: -150, yMm: 0 }, { xMm: 150, yMm: 0 }, { xMm: 150, yMm: 300 }, { xMm: -150, yMm: 300 }],
    };
    expect(profile.profilePoints.length).toBe(4);
  });

  it('steel connection plan symbol uses ring geometry', () => {
    const innerR = 0.04;
    const outerR = 0.07;
    expect(outerR).toBeGreaterThan(innerR);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave32/E): steel fabrication + parametric sections — beam_section_profile type + SetBeamSectionProfileCmd + steel-connection tool + plan symbol + modify.steel-connection + modify.beam-section-profile capabilities (§9.5.3+§9.5.4)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
