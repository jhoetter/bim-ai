export type WorkspaceId = 'arch' | 'struct' | 'mep' | 'concept';

export interface WorkspaceDescriptor {
  id: WorkspaceId;
  label: string;
  discToken: string;
  discSoftToken: string;
  defaultLensLabel: string;
}

export const WORKSPACES: WorkspaceDescriptor[] = [
  {
    id: 'arch',
    label: 'Architekt',
    discToken: 'var(--disc-arch)',
    discSoftToken: 'var(--disc-arch-soft)',
    defaultLensLabel: 'All',
  },
  {
    id: 'struct',
    label: 'Statiker',
    discToken: 'var(--disc-struct)',
    discSoftToken: 'var(--disc-struct-soft)',
    defaultLensLabel: 'Structure',
  },
  {
    id: 'mep',
    label: 'TGA',
    discToken: 'var(--disc-mep)',
    discSoftToken: 'var(--disc-mep-soft)',
    defaultLensLabel: 'MEP',
  },
  {
    id: 'concept',
    label: 'Concept',
    discToken: 'var(--color-accent)',
    discSoftToken: 'var(--color-accent-soft)',
    defaultLensLabel: 'All',
  },
];
