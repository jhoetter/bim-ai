import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { Violation } from '@bim-ai/core';
import i18n from '../i18n';
import { AdvisorPanel } from './AdvisorPanel';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

const violations: Violation[] = [
  {
    ruleId: 'physical_hard_clash',
    severity: 'error',
    message: 'Physical clash detected.',
    elementIds: ['wall-1'],
    blocking: true,
    priorityRank: 10,
    rootCauseGroupId: 'physical_coordination:wall-1',
    rootCauseGroup: { id: 'physical_coordination:wall-1', family: 'physical_coordination' },
    audienceText: { ui: 'Resolve the physical clash.' },
    quickFixCommand: { type: 'tag_element', elementId: 'wall-1', key: 'clashStatus', value: 'ok' },
    viewpointRef: 'vp-clash-wall-1',
    evidenceRefs: [{ kind: 'viewpoint', viewpointId: 'vp-clash-wall-1' }],
    viewpointEvidence: {
      diagnosticCodes: ['renderer.wall_cut.unsupported'],
    },
  },
  {
    ruleId: 'schedule_sheet_viewport_missing',
    severity: 'warning',
    message: 'Schedule viewport is missing.',
    elementIds: ['sheet-a101'],
    rootCauseGroupId: 'documentation:sheet-a101',
  },
  {
    ruleId: 'room_finish_metadata_hint',
    severity: 'info',
    message: 'Room finish metadata missing.',
    elementIds: ['room-2'],
    rootCauseGroupId: 'metadata_requirement:room-2',
  },
];

afterEach(() => {
  cleanup();
});

describe('AdvisorPanel', () => {
  it('supports severity/category/view/element grouping — UX-DIA-019', () => {
    const { getByTestId, getByLabelText } = renderWithI18n(
      <AdvisorPanel
        violations={violations}
        preset="residential"
        onPreset={() => {}}
        onApplyQuickFix={() => {}}
        perspective="architecture"
        showAllPerspectives
      />,
    );

    expect(getByTestId('advisor-group-error').textContent).toContain('(1)');
    expect(getByTestId('advisor-actionability-physical-hard-clash').textContent).toContain(
      'vp-clash-wall-1',
    );
    expect(getByTestId('advisor-actionability-physical-hard-clash').textContent).toContain(
      'renderer.wall_cut.unsupported',
    );
    fireEvent.change(getByTestId('advisor-group-by'), { target: { value: 'category' } });
    expect(getByTestId('advisor-group-physical').textContent).toContain('Physical');
    expect(getByTestId('advisor-group-schedule').textContent).toContain('Schedule');
    fireEvent.change(getByTestId('advisor-group-by'), { target: { value: 'view' } });
    expect(getByTestId('advisor-group-3d').textContent).toContain('3D');
    expect(getByTestId('advisor-group-schedule').textContent).toContain('Schedule');
    fireEvent.change(getByLabelText('Advisor group by'), { target: { value: 'element' } });
    expect(getByTestId('advisor-group-wall-1').textContent).toContain('wall-1');
    expect(getByTestId('advisor-group-room-2').textContent).toContain('room-2');
    fireEvent.change(getByLabelText('Advisor group by'), { target: { value: 'rootCause' } });
    expect(getByTestId('advisor-group-physical-coordination').textContent).toContain(
      'Physical Coordination',
    );
  });

  it('supports ignore and restore workflow while preserving apply and navigate actions', () => {
    const onApplyQuickFix = vi.fn();
    const onNavigateToElement = vi.fn();
    const onIsolateElements = vi.fn();
    const { getAllByRole, getByTestId, queryByText } = renderWithI18n(
      <AdvisorPanel
        violations={violations}
        preset="residential"
        onPreset={() => {}}
        onApplyQuickFix={onApplyQuickFix}
        perspective="architecture"
        showAllPerspectives
        onNavigateToElement={onNavigateToElement}
        onIsolateElements={onIsolateElements}
      />,
    );

    fireEvent.click(getByTestId('advisor-navigate-wall-1'));
    expect(onNavigateToElement).toHaveBeenCalledWith('wall-1');
    fireEvent.click(getByTestId('advisor-isolate-physical-hard-clash'));
    expect(onIsolateElements).toHaveBeenCalledWith(['wall-1']);
    fireEvent.click(getAllByRole('button', { name: 'Ignore' })[0]!);
    expect(queryByText('Physical clash detected.')).toBeNull();
    expect(getByTestId('advisor-ignored-summary').textContent).toContain('Ignored 1');
    fireEvent.click(getByTestId('advisor-reset-ignored'));
    expect(queryByText('Physical clash detected.')).toBeTruthy();
    fireEvent.click(getAllByRole('button', { name: 'Apply suggested fix' })[0]!);
    expect(onApplyQuickFix).toHaveBeenCalledTimes(1);
  });
});
