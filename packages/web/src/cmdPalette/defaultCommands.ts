import { useBimStore } from '../state/store';
import { registerCommand } from './registry';

// Tool commands
registerCommand({
  id: 'tool.wall',
  label: 'Place Wall',
  shortcut: 'W',
  keywords: ['wall', 'draw'],
  category: 'command',
  invoke: () => useBimStore.getState().setPlanTool('wall'),
});

registerCommand({
  id: 'tool.door',
  label: 'Place Door',
  shortcut: 'D',
  keywords: ['door', 'opening'],
  category: 'command',
  invoke: () => useBimStore.getState().setPlanTool('door'),
});

registerCommand({
  id: 'tool.window',
  label: 'Place Window',
  keywords: ['window', 'opening'],
  category: 'command',
  invoke: () => useBimStore.getState().setPlanTool('window'),
});

registerCommand({
  id: 'tool.floor',
  label: 'Place Floor',
  keywords: ['floor', 'slab'],
  category: 'command',
  invoke: () => useBimStore.getState().setPlanTool('floor'),
});

registerCommand({
  id: 'tool.room',
  label: 'Place Room',
  shortcut: 'R',
  keywords: ['room', 'space'],
  category: 'command',
  invoke: () => useBimStore.getState().setPlanTool('room'),
});

registerCommand({
  id: 'tool.select',
  label: 'Select',
  shortcut: 'Esc',
  keywords: ['select', 'pointer'],
  category: 'command',
  invoke: () => useBimStore.getState().setPlanTool('select'),
});

// Phase / view commands
registerCommand({
  id: 'view.phase.demolition',
  label: 'Set view phase: Demolition',
  keywords: ['phase', 'demolition', 'demo'],
  category: 'command',
  invoke: () => useBimStore.getState().setPerspectiveId('coordination'),
});

registerCommand({
  id: 'view.phase.existing',
  label: 'Set view phase: Existing',
  keywords: ['phase', 'existing'],
  category: 'command',
  invoke: () => useBimStore.getState().setPerspectiveId('architecture'),
});

registerCommand({
  id: 'view.phase.new',
  label: 'Set view phase: New Construction',
  keywords: ['phase', 'new', 'construction'],
  category: 'command',
  invoke: () => useBimStore.getState().setPerspectiveId('construction'),
});

// Navigate commands
registerCommand({
  id: 'navigate.plan',
  label: 'Go to plan view',
  keywords: ['plan', '2d', 'floor plan'],
  category: 'navigate',
  invoke: () => {
    const st = useBimStore.getState();
    st.setViewerMode('plan_canvas');
  },
});

registerCommand({
  id: 'navigate.3d',
  label: 'Go to 3D view',
  keywords: ['3d', 'orbit', 'perspective'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setViewerMode('orbit_3d'),
});

registerCommand({
  id: 'navigate.architecture',
  label: 'Switch to Architecture perspective',
  keywords: ['architecture', 'archi'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setPerspectiveId('architecture'),
});

registerCommand({
  id: 'navigate.structure',
  label: 'Switch to Structure perspective',
  keywords: ['structure', 'structural'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setPerspectiveId('structure'),
});

registerCommand({
  id: 'navigate.mep',
  label: 'Switch to MEP perspective',
  keywords: ['mep', 'mechanical', 'electrical', 'plumbing'],
  category: 'navigate',
  invoke: () => useBimStore.getState().setPerspectiveId('mep'),
});
