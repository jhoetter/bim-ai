/**
 * EDT-03 — wall-face radial menu tests (closeout).
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { WallFaceRadialMenu, WallFaceRadialMenuOpen, projectAlongT } from './wallFaceRadialMenu';

afterEach(() => cleanup());

const horizontalWall = {
  wallId: 'w-1',
  hitPoint: { xMm: 1500, yMm: 0, zMm: 1000 },
  wallStartMm: { xMm: 0, yMm: 0 },
  wallEndMm: { xMm: 5000, yMm: 0 },
  screen: { x: 200, y: 300 },
} satisfies WallFaceRadialMenuOpen;

describe('projectAlongT', () => {
  test('hit at start → t=0', () => {
    expect(projectAlongT({ xMm: 0, yMm: 0 }, { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 })).toBe(0);
  });
  test('hit at midpoint → t=0.5', () => {
    expect(
      projectAlongT({ xMm: 2500, yMm: 0 }, { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }),
    ).toBeCloseTo(0.5);
  });
  test('hit past wall end → clamped to 1', () => {
    expect(projectAlongT({ xMm: 9000, yMm: 0 }, { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 })).toBe(1);
  });
});

describe('WallFaceRadialMenu', () => {
  test('renders nothing when closed', () => {
    const { container } = render(
      <WallFaceRadialMenu open={null} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders three buttons when open', () => {
    render(<WallFaceRadialMenu open={horizontalWall} onSelect={() => {}} onDismiss={() => {}} />);
    expect(screen.getByTestId('wall-face-radial-menu-door')).toBeTruthy();
    expect(screen.getByTestId('wall-face-radial-menu-window')).toBeTruthy();
    expect(screen.getByTestId('wall-face-radial-menu-opening')).toBeTruthy();
  });

  test('renders UV rotation handle when the wall face has a material element', () => {
    const onSelect = vi.fn();
    render(
      <WallFaceRadialMenu
        open={{ ...horizontalWall, materialId: 'mat-brick', currentUvRotationDeg: 30 }}
        onSelect={onSelect}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('wall-face-radial-menu-uv-rotate'));
    const result = onSelect.mock.calls[0][0];
    expect(result.kind).toBe('uv-rotate');
    expect(result.cmd).toEqual({
      type: 'update_material_pbr',
      id: 'mat-brick',
      uvRotationDeg: 45,
    });
  });

  test('clicking Insert Door dispatches insertDoorOnWall with correct alongT', () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    render(<WallFaceRadialMenu open={horizontalWall} onSelect={onSelect} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('wall-face-radial-menu-door'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    const result = onSelect.mock.calls[0][0];
    expect(result.kind).toBe('door');
    expect(result.cmd.type).toBe('insertDoorOnWall');
    expect(result.cmd.wallId).toBe('w-1');
    expect(result.cmd.alongT).toBeCloseTo(0.3); // 1500 / 5000
    expect(result.cmd.widthMm).toBe(900);
  });

  test('clicking Insert Window dispatches insertWindowOnWall', () => {
    const onSelect = vi.fn();
    render(<WallFaceRadialMenu open={horizontalWall} onSelect={onSelect} onDismiss={() => {}} />);
    fireEvent.click(screen.getByTestId('wall-face-radial-menu-window'));
    const result = onSelect.mock.calls[0][0];
    expect(result.cmd.type).toBe('insertWindowOnWall');
    expect(result.cmd.widthMm).toBe(1200);
    expect(result.cmd.sillHeightMm).toBe(900);
    expect(result.cmd.heightMm).toBe(1500);
  });

  test('clicking Insert Opening dispatches createWallOpening with bracket range', () => {
    const onSelect = vi.fn();
    render(<WallFaceRadialMenu open={horizontalWall} onSelect={onSelect} onDismiss={() => {}} />);
    fireEvent.click(screen.getByTestId('wall-face-radial-menu-opening'));
    const result = onSelect.mock.calls[0][0];
    expect(result.cmd.type).toBe('createWallOpening');
    expect(result.cmd.hostWallId).toBe('w-1');
    expect(result.cmd.alongTStart).toBeLessThan(result.cmd.alongTEnd);
    expect(result.cmd.alongTStart).toBeGreaterThanOrEqual(0);
    expect(result.cmd.alongTEnd).toBeLessThanOrEqual(1);
  });
});
