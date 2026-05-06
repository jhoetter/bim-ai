/**
 * Built-in wall-type assemblies — FL-08.
 *
 * Mirrors the spec §FL-08 minimum-viable system family catalog. Each
 * entry describes an ordered layer stack with explicit `function` and
 * `exterior` flags so the renderer can extrude a multi-layer wall and
 * the plan canvas can draw the layer boundary lines.
 *
 * User-authored `wall_type` elements live in `elementsById` and use the
 * narrower `core.WallTypeLayer` shape; this catalog is a parallel
 * read-only source that the renderer + family library prefer first.
 */

export type WallAssemblyLayerFunction = 'structure' | 'insulation' | 'finish' | 'membrane' | 'air';

export interface WallAssemblyLayer {
  name: string;
  thicknessMm: number;
  materialKey: string;
  function: WallAssemblyLayerFunction;
  exterior?: boolean;
}

export interface WallTypeAssembly {
  id: string;
  name: string;
  basisLine: 'center' | 'face_interior' | 'face_exterior';
  layers: WallAssemblyLayer[];
}

const EXT_TIMBER: WallTypeAssembly = {
  id: 'wall.ext-timber',
  name: 'Ext. Timber Frame',
  basisLine: 'face_interior',
  layers: [
    {
      name: 'Cladding',
      thicknessMm: 18,
      materialKey: 'timber_cladding',
      function: 'finish',
      exterior: true,
    },
    { name: 'Air gap', thicknessMm: 25, materialKey: 'air', function: 'air' },
    {
      name: 'Frame + Insulation',
      thicknessMm: 140,
      materialKey: 'timber_frame_insulation',
      function: 'structure',
    },
    { name: 'VCL', thicknessMm: 3, materialKey: 'vcl_membrane', function: 'membrane' },
    {
      name: 'Plasterboard',
      thicknessMm: 12.5,
      materialKey: 'plasterboard',
      function: 'finish',
    },
  ],
};

const EXT_MASONRY: WallTypeAssembly = {
  id: 'wall.ext-masonry',
  name: 'Ext. Brick Cavity',
  basisLine: 'face_interior',
  layers: [
    {
      name: 'Brick',
      thicknessMm: 102,
      materialKey: 'masonry_brick',
      function: 'finish',
      exterior: true,
    },
    { name: 'Cavity', thicknessMm: 75, materialKey: 'air', function: 'air' },
    { name: 'Block', thicknessMm: 100, materialKey: 'masonry_block', function: 'structure' },
    { name: 'Plaster', thicknessMm: 13, materialKey: 'plaster', function: 'finish' },
  ],
};

const INT_PARTITION: WallTypeAssembly = {
  id: 'wall.int-partition',
  name: 'Int. Timber Partition',
  basisLine: 'center',
  layers: [
    { name: 'Plasterboard', thicknessMm: 12.5, materialKey: 'plasterboard', function: 'finish' },
    { name: 'Stud', thicknessMm: 89, materialKey: 'timber_stud', function: 'structure' },
    { name: 'Plasterboard', thicknessMm: 12.5, materialKey: 'plasterboard', function: 'finish' },
  ],
};

const INT_BLOCKWORK: WallTypeAssembly = {
  id: 'wall.int-blockwork',
  name: 'Int. Blockwork',
  basisLine: 'center',
  layers: [
    { name: 'Plaster', thicknessMm: 13, materialKey: 'plaster', function: 'finish' },
    { name: 'Block', thicknessMm: 100, materialKey: 'masonry_block', function: 'structure' },
    { name: 'Plaster', thicknessMm: 13, materialKey: 'plaster', function: 'finish' },
  ],
};

export const BUILT_IN_WALL_TYPES: WallTypeAssembly[] = [
  EXT_TIMBER,
  EXT_MASONRY,
  INT_PARTITION,
  INT_BLOCKWORK,
];

export function getBuiltInWallType(id: string): WallTypeAssembly | undefined {
  return BUILT_IN_WALL_TYPES.find((w) => w.id === id);
}

export function totalThicknessMm(assembly: WallTypeAssembly): number {
  return assembly.layers.reduce((acc, l) => acc + l.thicknessMm, 0);
}

export function visibleLayerCount(assembly: WallTypeAssembly): number {
  return assembly.layers.filter((l) => l.function !== 'air').length;
}

export const WALL_LAYER_MATERIAL_HEX: Readonly<Record<string, string>> = {
  timber_cladding: '#7c5b3b',
  timber_frame_insulation: '#d6b675',
  timber_stud: '#cf9b56',
  vcl_membrane: '#b9c0c8',
  plasterboard: '#ece8de',
  plaster: '#efe9d8',
  masonry_brick: '#a45a3f',
  masonry_block: '#bcb6a8',
  air: '#ffffff',
};

export function materialHexFor(materialKey: string | null | undefined): string {
  if (!materialKey) return '#cccccc';
  return WALL_LAYER_MATERIAL_HEX[materialKey] ?? '#cccccc';
}
