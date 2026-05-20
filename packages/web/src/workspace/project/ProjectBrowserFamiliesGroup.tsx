import { useState } from 'react';
import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

export type ProjectBrowserFamilyTypeElement = Extract<
  Element,
  { kind: 'wall_type' | 'floor_type' | 'roof_type' }
>;

type ProjectBrowserFamilyContextMenuState = {
  item: ProjectBrowserFamilyTypeElement;
  x: number;
  y: number;
} | null;

function newFamilyCopyId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

export function duplicateFamilyTypeCommand(
  item: ProjectBrowserFamilyTypeElement,
): Record<string, unknown> {
  const nextName = `${item.name} Copy`;
  const nextId = newFamilyCopyId(item.id);
  if (item.kind === 'wall_type') {
    return {
      type: 'upsertWallType',
      id: nextId,
      name: nextName,
      layers: item.layers,
      basisLine: item.basisLine ?? 'center',
    };
  }
  if (item.kind === 'floor_type') {
    return {
      type: 'upsertFloorType',
      id: nextId,
      name: nextName,
      layers: item.layers,
    };
  }
  return {
    type: 'upsertRoofType',
    id: nextId,
    name: nextName,
    layers: item.layers,
  };
}

export function ProjectBrowserFamiliesGroup({
  wallTypes,
  floorTypes,
  roofTypes,
  onSelect,
  onRename,
  onDuplicate,
}: {
  wallTypes: Extract<Element, { kind: 'wall_type' }>[];
  floorTypes: Extract<Element, { kind: 'floor_type' }>[];
  roofTypes: Extract<Element, { kind: 'roof_type' }>[];
  onSelect: (id: string) => void;
  onRename?: (id: string, name: string) => void | Promise<void>;
  onDuplicate?: (item: ProjectBrowserFamilyTypeElement) => void | Promise<void>;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ProjectBrowserFamilyContextMenuState>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const rawGroups: Array<{
    label: string;
    kind: ProjectBrowserFamilyTypeElement['kind'];
    items: ProjectBrowserFamilyTypeElement[];
  }> = [
    { label: 'Walls', kind: 'wall_type', items: wallTypes },
    { label: 'Floors', kind: 'floor_type', items: floorTypes },
    { label: 'Roofs', kind: 'roof_type', items: roofTypes },
  ];
  const groups = rawGroups.filter((g) => g.items.length > 0);

  const closeContextMenu = () => setCtxMenu(null);

  const startRename = (item: ProjectBrowserFamilyTypeElement) => {
    setRenamingId(item.id);
    setRenameDraft(item.name);
    closeContextMenu();
  };

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) void onRename?.(id, trimmed);
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <div className="space-y-1" data-testid="project-browser-families-group">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        data-testid="project-browser-families-toggle"
        className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        Families
      </button>
      {!collapsed ? (
        <div className="space-y-1 pl-1">
          {groups.map((grp) => (
            <div key={grp.kind} className="space-y-0">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted pl-1">
                {grp.label} ({grp.items.length})
              </div>
              <ul className="space-y-0">
                {grp.items.map((item) => (
                  <li key={item.id}>
                    {renamingId === item.id ? (
                      <input
                        autoFocus
                        type="text"
                        className="w-full px-2 py-0.5 text-[10px]"
                        value={renameDraft}
                        data-testid={`pb-family-type-rename-${item.id}`}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => commitRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(item.id);
                          if (e.key === 'Escape') {
                            setRenamingId(null);
                            setRenameDraft('');
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-full px-2 py-0.5 text-left text-[10px] hover:bg-surface-strong"
                        onClick={() => onSelect(item.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCtxMenu({ item, x: e.clientX, y: e.clientY });
                        }}
                        title={`${grp.kind} · ${item.id}`}
                        data-testid={`pb-family-type-${item.id}`}
                      >
                        <span className="text-muted">{grp.kind.replace('_', ' ')} ·</span>{' '}
                        {item.name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {ctxMenu ? (
        <ProjectBrowserFamilyContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={closeContextMenu}
          onSelect={() => {
            onSelect(ctxMenu.item.id);
            closeContextMenu();
          }}
          onRename={() => startRename(ctxMenu.item)}
          onDuplicate={() => {
            void onDuplicate?.(ctxMenu.item);
            closeContextMenu();
          }}
        />
      ) : null}
    </div>
  );
}

function ProjectBrowserFamilyContextMenu({
  x,
  y,
  onClose,
  onSelect,
  onRename,
  onDuplicate,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
}): JSX.Element {
  return (
    <div
      data-testid="project-browser-family-context-menu"
      className="fixed z-[9999] min-w-36 rounded border border-border bg-surface py-1 shadow-lg"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button
        type="button"
        data-testid="project-browser-family-ctx-select"
        className="block w-full px-3 py-1 text-left text-[12px] text-foreground hover:bg-surface-strong"
        onClick={onSelect}
      >
        Select Type
      </button>
      <button
        type="button"
        data-testid="project-browser-family-ctx-rename"
        className="block w-full px-3 py-1 text-left text-[12px] text-foreground hover:bg-surface-strong"
        onClick={onRename}
      >
        Rename
      </button>
      <button
        type="button"
        data-testid="project-browser-family-ctx-duplicate"
        className="block w-full px-3 py-1 text-left text-[12px] text-foreground hover:bg-surface-strong"
        onClick={onDuplicate}
      >
        Duplicate
      </button>
      <button
        type="button"
        data-testid="project-browser-family-ctx-close"
        className="block w-full px-3 py-1 text-left text-[12px] text-muted hover:bg-surface-strong"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}
