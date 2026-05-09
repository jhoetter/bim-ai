import type { Command } from '@bim-ai/core';

type QueueEntry = { command: Command; modelId: string; enqueuedAt: string };
let _queue: QueueEntry[] = [];

export function enqueueCommand(command: Command, modelId: string): void {
  _queue.push({ command, modelId, enqueuedAt: new Date().toISOString() });
}

export function getQueueLength(): number {
  return _queue.length;
}

export async function drainQueue(
  applyBundle: (modelId: string, commands: Command[]) => Promise<void>,
): Promise<{ drained: number; errors: number }> {
  if (_queue.length === 0) return { drained: 0, errors: 0 };
  const byModel = new Map<string, Command[]>();
  for (const entry of _queue) {
    if (!byModel.has(entry.modelId)) byModel.set(entry.modelId, []);
    byModel.get(entry.modelId)!.push(entry.command);
  }
  let drained = 0,
    errors = 0;
  for (const [modelId, commands] of byModel) {
    try {
      await applyBundle(modelId, commands);
      drained += commands.length;
    } catch {
      errors += commands.length;
    }
  }
  if (errors === 0) _queue = [];
  return { drained, errors };
}

export function clearQueue(): void {
  _queue = [];
}
