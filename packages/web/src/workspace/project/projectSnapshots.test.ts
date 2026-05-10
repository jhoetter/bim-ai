import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSnapshotFilename,
  buildSnapshotPayload,
  pushRecentProject,
  pushRollingSnapshotBackup,
  readRecentProjects,
  readRollingSnapshotBackups,
  readSnapshotFile,
} from './projectSnapshots';
import type { Snapshot } from '@bim-ai/core';

const FAKE_SNAP: Snapshot = {
  modelId: 'm1',
  revision: 7,
  elements: { 'lvl-0': { kind: 'level', id: 'lvl-0', name: 'L0', elevationMm: 0 } },
  violations: [],
};

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('projectSnapshots — T-03', () => {
  it('buildSnapshotPayload wraps a Snapshot with v=1 + label + timestamp', () => {
    const p = buildSnapshotPayload(FAKE_SNAP, 'My project');
    expect(p.v).toBe(1);
    expect(p.label).toBe('My project');
    expect(p.snapshot).toBe(FAKE_SNAP);
    expect(typeof p.capturedAt).toBe('string');
  });

  it('readSnapshotFile parses a valid v=1 payload', async () => {
    const payload = buildSnapshotPayload(FAKE_SNAP, 'Roundtrip');
    const file = new File([JSON.stringify(payload)], 'snap.json', {
      type: 'application/json',
    });
    const read = await readSnapshotFile(file);
    expect(read.snapshot.modelId).toBe('m1');
    expect(read.label).toBe('Roundtrip');
  });

  it('readSnapshotFile rejects schema mismatches', async () => {
    const file = new File([JSON.stringify({ v: 99, snapshot: {} })], 'bad.json');
    await expect(readSnapshotFile(file)).rejects.toThrow(/v=1/);
  });

  it('pushRecentProject caps the list at 5 and dedupes by label', () => {
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'A'));
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'B'));
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'C'));
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'A')); // dedupe
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'D'));
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'E'));
    pushRecentProject(buildSnapshotPayload(FAKE_SNAP, 'F'));
    const recent = readRecentProjects();
    expect(recent.length).toBe(5);
    expect(recent.map((r) => r.label)).toEqual(['F', 'E', 'D', 'A', 'C']);
  });

  it('pushRollingSnapshotBackup assigns Revit-style ordinal slots and caps by maximum backups', () => {
    const first = pushRollingSnapshotBackup(
      buildSnapshotPayload(FAKE_SNAP, 'House', { maximumBackups: 2 }),
      2,
    );
    const second = pushRollingSnapshotBackup(
      buildSnapshotPayload(FAKE_SNAP, 'House', { maximumBackups: 2 }),
      2,
    );
    const third = pushRollingSnapshotBackup(
      buildSnapshotPayload(FAKE_SNAP, 'House', { maximumBackups: 2 }),
      2,
    );

    expect(first.payload.saveAsOptions?.backupOrdinal).toBe(1);
    expect(second.payload.saveAsOptions?.backupOrdinal).toBe(2);
    expect(third.payload.saveAsOptions?.backupOrdinal).toBe(1);
    expect(readRollingSnapshotBackups().map((backup) => backup.ordinal)).toEqual([1, 2]);
    expect(buildSnapshotFilename(third.payload)).toBe('House.0001.json');
  });

  it('readRecentProjects survives a corrupt blob', () => {
    localStorage.setItem('bim-ai:recent-projects-v1', '{not json');
    expect(readRecentProjects()).toEqual([]);
  });
});
