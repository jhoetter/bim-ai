// Pure command interfaces and logic for model groups (B2 workpackage).

import type { GroupDefinition, GroupInstance, GroupRegistry } from './groupTypes';

// ── Command interfaces ────────────────────────────────────────────────────────

export interface CreateGroupCommand {
  type: 'createGroup';
  name: string;
  elementIds: string[];
  originXMm: number;
  originYMm: number;
}

export interface PlaceGroupCommand {
  type: 'placeGroup';
  groupDefinitionId: string;
  insertionXMm: number;
  insertionYMm: number;
  rotationDeg: number;
}

export interface UngroupElementsCommand {
  type: 'ungroupElements';
  groupInstanceId: string;
}

export interface EditGroupCommand {
  type: 'editGroup';
  groupDefinitionId: string;
}

export interface FinishEditGroupCommand {
  type: 'finishEditGroup';
}

export interface RenameGroupCommand {
  type: 'renameGroup';
  groupDefinitionId: string;
  name: string;
}

// ── Pure logic functions ──────────────────────────────────────────────────────

/**
 * Creates a GroupDefinition and a first GroupInstance (at offset 0,0 from
 * origin). Returns a new registry (no mutation) plus the created IDs.
 */
export function applyCreateGroup(
  registry: GroupRegistry,
  cmd: CreateGroupCommand,
  generateId: () => string,
): { registry: GroupRegistry; definitionId: string; instanceId: string } {
  const definitionId = generateId();
  const instanceId = generateId();

  const definition: GroupDefinition = {
    id: definitionId,
    name: cmd.name,
    elementIds: [...cmd.elementIds],
    originXMm: cmd.originXMm,
    originYMm: cmd.originYMm,
  };

  const instance: GroupInstance = {
    id: instanceId,
    groupDefinitionId: definitionId,
    insertionXMm: cmd.originXMm,
    insertionYMm: cmd.originYMm,
    rotationDeg: 0,
  };

  const newRegistry: GroupRegistry = {
    definitions: { ...registry.definitions, [definitionId]: definition },
    instances: { ...registry.instances, [instanceId]: instance },
  };

  return { registry: newRegistry, definitionId, instanceId };
}

/**
 * Adds a new GroupInstance to the registry. Returns new registry + instance ID.
 */
export function applyPlaceGroup(
  registry: GroupRegistry,
  cmd: PlaceGroupCommand,
  generateId: () => string,
): { registry: GroupRegistry; instanceId: string } {
  const instanceId = generateId();

  const instance: GroupInstance = {
    id: instanceId,
    groupDefinitionId: cmd.groupDefinitionId,
    insertionXMm: cmd.insertionXMm,
    insertionYMm: cmd.insertionYMm,
    rotationDeg: cmd.rotationDeg,
  };

  const newRegistry: GroupRegistry = {
    ...registry,
    instances: { ...registry.instances, [instanceId]: instance },
  };

  return { registry: newRegistry, instanceId };
}

/**
 * Removes the instance from the registry. Actual element explosion is handled
 * by the command consumer; this just cleans up the registry.
 */
export function applyUngroupElements(
  registry: GroupRegistry,
  cmd: UngroupElementsCommand,
): GroupRegistry {
  const { [cmd.groupInstanceId]: _removed, ...remainingInstances } = registry.instances;

  return { ...registry, instances: remainingInstances };
}

/**
 * Renames the group definition. Returns a new registry (no mutation).
 */
export function applyRenameGroup(registry: GroupRegistry, cmd: RenameGroupCommand): GroupRegistry {
  const existing = registry.definitions[cmd.groupDefinitionId];
  if (!existing) return registry;

  const updated: GroupDefinition = { ...existing, name: cmd.name };

  return {
    ...registry,
    definitions: { ...registry.definitions, [cmd.groupDefinitionId]: updated },
  };
}

/**
 * Returns all instances for a given group definition.
 */
export function getInstancesForDefinition(
  registry: GroupRegistry,
  definitionId: string,
): GroupInstance[] {
  return Object.values(registry.instances).filter(
    (inst) => inst.groupDefinitionId === definitionId,
  );
}

/**
 * Validates the parameters for creating a group.
 * - name must be non-empty
 * - elementIds must have >= 2 elements
 */
export function validateCreateGroup(
  name: string,
  elementIds: string[],
): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Group name must not be empty.' };
  }
  if (elementIds.length < 2) {
    return {
      valid: false,
      error: 'A group must contain at least 2 elements.',
    };
  }
  return { valid: true };
}
