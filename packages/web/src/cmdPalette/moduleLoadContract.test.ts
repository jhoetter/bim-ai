/**
 * TEST-CQ-07 — cmdPalette module-load contract test.
 *
 * Why this exists: PR #144 fixed a circular import between
 * `defaultCommands.ts` and `defaultCommandsDisplayAndExtras.ts`. In
 * Vite/Vitest's CommonJS interop layer, the bottom-of-file chain-import
 * caused the extras module to load before defaultCommands had finished
 * initializing; the named imports it pulled from defaultCommands
 * (`isSelectedWall3dContext`, `hasSelection`, etc.) resolved to
 * `undefined`, which then got registered as `isAvailable: undefined`
 * on every palette entry that referenced them. Only one test caught
 * this (via a `disabledReason` assertion), which is far too weak a
 * signal for a class of bug that touches every entry.
 *
 * This is a structural smoke test: regardless of which order the two
 * modules are imported, every registered palette entry must have
 *
 *   - `invoke` defined and a function
 *   - `isAvailable` either defined and a function, OR absent
 *     (NOT present with an undefined value)
 *
 * The "either defined or absent" check is the load-bearing one. A
 * `typeof entry.isAvailable === 'undefined'` slips through a naive
 * "is it defined?" check because `undefined` has type `undefined`,
 * so we use `'isAvailable' in entry` to distinguish "the key was set
 * to undefined" (the bug) from "the key was never set" (fine).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _clearRegistry, registerCommand, type PaletteEntry } from './registry';

function assertEntryContract(entry: PaletteEntry): void {
  expect(typeof entry.invoke, `entry ${entry.id} must have invoke defined`).toBe('function');

  // The bug: PR #144 fixed entries being registered with
  // `isAvailable: undefined`. `'isAvailable' in entry` is true in
  // that case (the key was set, just to undefined). It is false
  // when the entry never declared the field at all. Both shapes
  // are otherwise indistinguishable via `typeof`.
  if ('isAvailable' in entry) {
    expect(
      typeof entry.isAvailable,
      `entry ${entry.id} has 'isAvailable' key — it must be a function (was undefined: circular-import regression)`,
    ).toBe('function');
  }
}

async function loadInOrder(first: string, second: string): Promise<readonly PaletteEntry[]> {
  // Reset the vitest module cache so the dynamic imports re-evaluate.
  // Without this, the second describe block sees the cached singletons
  // from the first and never exercises the alternate import order.
  vi.resetModules();
  _clearRegistry();
  await import(first);
  await import(second);
  // Re-resolve the registry through the freshly evaluated module
  // graph rather than the top-of-file static import. The freshly
  // imported defaultCommands writes into its own copy of the
  // singleton, so we must read through the same module instance.
  const registryModule = await import('./registry');
  return registryModule.getRegistry();
}

beforeEach(() => {
  _clearRegistry();
});

afterEach(() => {
  _clearRegistry();
  vi.resetModules();
});

describe('cmdPalette module-load contract — defaultCommands then defaultCommandsDisplayAndExtras', () => {
  it('every registered entry has invoke defined and isAvailable either defined or absent', async () => {
    const registry = await loadInOrder('./defaultCommands', './defaultCommandsDisplayAndExtras');
    expect(registry.length, 'registry must be non-empty after both modules load').toBeGreaterThan(
      0,
    );
    for (const entry of registry) {
      assertEntryContract(entry);
    }
  });
});

describe('cmdPalette module-load contract — defaultCommandsDisplayAndExtras then defaultCommands', () => {
  it('every registered entry has invoke defined and isAvailable either defined or absent', async () => {
    const registry = await loadInOrder('./defaultCommandsDisplayAndExtras', './defaultCommands');
    expect(registry.length, 'registry must be non-empty after both modules load').toBeGreaterThan(
      0,
    );
    for (const entry of registry) {
      assertEntryContract(entry);
    }
  });
});

describe('cmdPalette module-load contract — assertEntryContract regression coverage', () => {
  // Belt-and-braces: prove the contract assertion actually catches
  // the PR #144 failure mode (isAvailable set but undefined). If
  // anyone weakens assertEntryContract to a `typeof undefined`-style
  // check, these tests fail and force the issue back into view.
  it('catches an entry registered with isAvailable: undefined', () => {
    const broken: PaletteEntry = {
      // Simulate exactly what the circular-import bug produced: a
      // PaletteEntry object literal where `isAvailable: someImport`
      // resolved to undefined during module evaluation.
      id: 'simulated.broken.entry',
      label: 'Broken entry',
      category: 'command',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isAvailable: undefined as unknown as (ctx: any) => boolean,
      invoke: () => {},
    };
    expect(() => assertEntryContract(broken)).toThrow();
  });

  it('catches an entry registered without invoke', () => {
    const broken = {
      id: 'simulated.no-invoke',
      label: 'No invoke',
      category: 'command',
    } as unknown as PaletteEntry;
    expect(() => assertEntryContract(broken)).toThrow();
  });

  it('passes an entry without isAvailable at all', () => {
    const ok: PaletteEntry = {
      id: 'simulated.no-isAvailable',
      label: 'No isAvailable',
      category: 'command',
      invoke: () => {},
    };
    expect(() => assertEntryContract(ok)).not.toThrow();
  });

  it('regression-prove — registering a poisoned entry into the real registry surfaces via the live registry sweep', async () => {
    // Drive the same shape that the circular-import bug emitted —
    // an entry where `isAvailable` was set to `undefined`. We push
    // it through the public `registerCommand` API just like the
    // module-evaluation path did, then re-run the contract sweep
    // against `getRegistry()` and confirm it fails.
    vi.resetModules();
    const registryModule = await import('./registry');
    registryModule._clearRegistry();
    registryModule.registerCommand({
      id: 'simulated.live.broken',
      label: 'Broken live',
      category: 'command',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isAvailable: undefined as unknown as (ctx: any) => boolean,
      invoke: () => {},
    });
    const live = registryModule.getRegistry();
    const violations: string[] = [];
    for (const entry of live) {
      try {
        assertEntryContract(entry);
      } catch {
        violations.push(entry.id);
      }
    }
    expect(violations).toContain('simulated.live.broken');
    registryModule._clearRegistry();
  });

  // The static-import variant kept around so registerCommand is
  // exercised — silences the unused-import linter.
  it('registerCommand is the public surface used by both modules', () => {
    expect(typeof registerCommand).toBe('function');
  });
});
