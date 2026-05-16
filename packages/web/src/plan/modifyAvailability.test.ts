import { describe, expect, it } from 'vitest';

import { getEnabledVerbs, getModifyAvailability } from './modifyAvailability';

// ---------------------------------------------------------------------------
// WP-NEXT-47 — Universal Modify Toolkit
// ---------------------------------------------------------------------------

describe('WP-NEXT-47 modifyAvailability', () => {
  describe('getModifyAvailability — no selection', () => {
    it('disables all verbs when nothing is selected', () => {
      const avail = getModifyAvailability([], 'plan');
      expect(avail.every((a) => !a.enabled)).toBe(true);
      expect(avail.every((a) => a.reason === 'No element selected.')).toBe(true);
    });
  });

  describe('plan view', () => {
    it('enables move/copy/rotate/delete for a single wall', () => {
      const enabled = getEnabledVerbs(['wall'], 'plan');
      expect(enabled).toContain('move');
      expect(enabled).toContain('copy');
      expect(enabled).toContain('rotate');
      expect(enabled).toContain('delete');
    });

    it('enables offset/trim-extend/split in plan (wall-specific)', () => {
      const enabled = getEnabledVerbs(['wall'], 'plan');
      expect(enabled).toContain('offset');
      expect(enabled).toContain('trim-extend');
      expect(enabled).toContain('split');
    });

    it('enables attach/detach for wall selection', () => {
      const enabled = getEnabledVerbs(['wall'], 'plan');
      expect(enabled).toContain('attach');
      expect(enabled).toContain('detach');
    });

    it('disables attach/detach for non-wall elements', () => {
      const avail = getModifyAvailability(['floor'], 'plan');
      const attachEntry = avail.find((a) => a.verb === 'attach');
      expect(attachEntry?.enabled).toBe(false);
    });

    it('enables join/unjoin for solid geometry selection', () => {
      const enabled = getEnabledVerbs(['wall', 'floor'], 'plan');
      expect(enabled).toContain('join');
      expect(enabled).toContain('unjoin');
    });

    it('disables join/unjoin for non-solid elements (door)', () => {
      const avail = getModifyAvailability(['door'], 'plan');
      const joinEntry = avail.find((a) => a.verb === 'join');
      expect(joinEntry?.enabled).toBe(false);
      expect(joinEntry?.reason).toContain('solid geometry');
    });

    it('disables align when only one element is selected', () => {
      const avail = getModifyAvailability(['wall'], 'plan');
      const alignEntry = avail.find((a) => a.verb === 'align');
      expect(alignEntry?.enabled).toBe(false);
    });

    it('enables align for two or more selected elements', () => {
      const enabled = getEnabledVerbs(['wall', 'wall'], 'plan');
      expect(enabled).toContain('align');
    });

    it('enables mirror for any selection', () => {
      const enabled = getEnabledVerbs(['wall'], 'plan');
      expect(enabled).toContain('mirror');
    });
  });

  describe('3d view', () => {
    it('enables move/copy/rotate/delete/join/attach in 3D', () => {
      const enabled = getEnabledVerbs(['wall'], '3d');
      expect(enabled).toContain('move');
      expect(enabled).toContain('copy');
      expect(enabled).toContain('rotate');
      expect(enabled).toContain('delete');
      expect(enabled).toContain('attach');
    });

    it('disables offset/trim-extend/split in 3D', () => {
      const avail = getModifyAvailability(['wall'], '3d');
      const offsetEntry = avail.find((a) => a.verb === 'offset');
      const trimEntry = avail.find((a) => a.verb === 'trim-extend');
      const splitEntry = avail.find((a) => a.verb === 'split');
      expect(offsetEntry?.enabled).toBe(false);
      expect(trimEntry?.enabled).toBe(false);
      expect(splitEntry?.enabled).toBe(false);
      expect(offsetEntry?.reason).toContain('Plan');
    });
  });

  describe('section view', () => {
    it('enables only move/copy/rotate/delete/pin/unpin in section', () => {
      const enabled = getEnabledVerbs(['wall'], 'section');
      expect(enabled).toContain('move');
      expect(enabled).toContain('copy');
      expect(enabled).toContain('rotate');
      expect(enabled).toContain('delete');
      expect(enabled).toContain('pin');
      expect(enabled).toContain('unpin');
    });

    it('disables join/mirror/array in section', () => {
      const avail = getModifyAvailability(['wall'], 'section');
      const mirrorEntry = avail.find((a) => a.verb === 'mirror');
      const arrayEntry = avail.find((a) => a.verb === 'array');
      const joinEntry = avail.find((a) => a.verb === 'join');
      expect(mirrorEntry?.enabled).toBe(false);
      expect(arrayEntry?.enabled).toBe(false);
      expect(joinEntry?.enabled).toBe(false);
    });
  });

  describe('sheet view', () => {
    it('enables only move/copy/delete/scale on a sheet', () => {
      const enabled = getEnabledVerbs(['sheet'], 'sheet');
      expect(enabled).toContain('move');
      expect(enabled).toContain('copy');
      expect(enabled).toContain('delete');
      expect(enabled).toContain('scale');
    });

    it('disables join/mirror/rotate/array on a sheet', () => {
      const avail = getModifyAvailability(['sheet'], 'sheet');
      const joinEntry = avail.find((a) => a.verb === 'join');
      const mirrorEntry = avail.find((a) => a.verb === 'mirror');
      expect(joinEntry?.enabled).toBe(false);
      expect(mirrorEntry?.enabled).toBe(false);
    });
  });

  describe('schedule view', () => {
    it('disables all geometry verbs in schedule view', () => {
      const avail = getModifyAvailability(['schedule'], 'schedule');
      expect(avail.every((a) => !a.enabled)).toBe(true);
      expect(avail[0]?.reason).toContain('Schedule view');
    });
  });
});
