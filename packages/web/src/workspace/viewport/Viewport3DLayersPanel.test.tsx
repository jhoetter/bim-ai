import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import {
  Viewport3DLayersPanel,
  VIEWER_HIDDEN_KIND_KEYS,
  type Viewport3DLayersPanelProps,
} from './Viewport3DLayersPanel';
import i18n from '../../i18n';

afterEach(() => {
  cleanup();
});

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

function makeProps(
  overrides: Partial<Viewport3DLayersPanelProps> = {},
): Viewport3DLayersPanelProps {
  return {
    viewerCategoryHidden: {},
    onToggleCategory: vi.fn(),
    viewerRenderStyle: 'shaded',
    onSetRenderStyle: vi.fn(),
    viewerBackground: 'light_grey',
    onSetBackground: vi.fn(),
    viewerEdges: 'normal',
    onSetEdges: vi.fn(),
    viewerProjection: 'perspective',
    onSetProjection: vi.fn(),
    sectionBoxActive: false,
    onSetSectionBoxActive: vi.fn(),
    viewerClipElevMm: null,
    onSetClipElevMm: vi.fn(),
    viewerClipFloorElevMm: null,
    onSetClipFloorElevMm: vi.fn(),
    ...overrides,
  };
}

describe('<Viewport3DLayersPanel />', () => {
  it('renders the panel with all category toggles', () => {
    const { getByTestId } = render(<Viewport3DLayersPanel {...makeProps()} />);
    expect(getByTestId('viewport3d-layers-panel')).toBeTruthy();
    for (const key of VIEWER_HIDDEN_KIND_KEYS) {
      expect(getByTestId(`layer-toggle-${key}`)).toBeTruthy();
    }
  });

  it('calls graphics controls when render style changes', () => {
    const onSetRenderStyle = vi.fn();
    const { getByTestId, getByText } = render(
      <Viewport3DLayersPanel {...makeProps({ onSetRenderStyle })} />,
    );
    expect(getByTestId('graphic-style-preview-shaded')).toBeTruthy();
    expect(getByTestId('graphic-style-preview-wireframe')).toBeTruthy();
    fireEvent.click(getByText('Wire'));
    expect(onSetRenderStyle).toHaveBeenCalledWith('wireframe');
  });

  it('calls background and edge controls from the graphics panel', () => {
    const onSetBackground = vi.fn();
    const onSetEdges = vi.fn();
    const { getByRole } = render(
      <Viewport3DLayersPanel {...makeProps({ onSetBackground, onSetEdges })} />,
    );
    fireEvent.click(getByRole('button', { name: 'Use Dark background' }));
    fireEvent.click(getByRole('button', { name: 'Off model edges' }));
    expect(onSetBackground).toHaveBeenCalledWith('dark');
    expect(onSetEdges).toHaveBeenCalledWith('none');
  });

  it('calls camera and section-box controls from the view panel', () => {
    const onSetProjection = vi.fn();
    const onSetSectionBoxActive = vi.fn();
    const { getByRole } = render(
      <Viewport3DLayersPanel {...makeProps({ onSetProjection, onSetSectionBoxActive })} />,
    );
    fireEvent.click(getByRole('button', { name: 'Use Ortho projection' }));
    fireEvent.click(getByRole('button', { name: 'Section box off' }));
    expect(onSetProjection).toHaveBeenCalledWith('orthographic');
    expect(onSetSectionBoxActive).toHaveBeenCalledWith(true);
  });

  it('shows checkboxes as checked when category is NOT hidden', () => {
    const { getByTestId } = render(
      <Viewport3DLayersPanel
        {...makeProps({ viewerCategoryHidden: { wall: false, floor: true } })}
      />,
    );
    expect((getByTestId('layer-toggle-wall') as HTMLInputElement).checked).toBe(true);
    expect((getByTestId('layer-toggle-floor') as HTMLInputElement).checked).toBe(false);
  });

  it('calls onToggleCategory when a checkbox is clicked', () => {
    const onToggleCategory = vi.fn();
    const { getByTestId } = render(<Viewport3DLayersPanel {...makeProps({ onToggleCategory })} />);
    fireEvent.click(getByTestId('layer-toggle-roof'));
    expect(onToggleCategory).toHaveBeenCalledOnce();
    expect(onToggleCategory).toHaveBeenCalledWith('roof');
  });

  it('renders clip elevation inputs', () => {
    const { getByTestId } = render(<Viewport3DLayersPanel {...makeProps()} />);
    expect(getByTestId('clip-elev-input')).toBeTruthy();
    expect(getByTestId('clip-floor-input')).toBeTruthy();
  });

  it('populates clip elevation inputs from props', () => {
    const { getByTestId } = render(
      <Viewport3DLayersPanel
        {...makeProps({ viewerClipElevMm: 5600, viewerClipFloorElevMm: 0 })}
      />,
    );
    expect((getByTestId('clip-elev-input') as HTMLInputElement).value).toBe('5600');
    expect((getByTestId('clip-floor-input') as HTMLInputElement).value).toBe('0');
  });

  it('calls onSetClipElevMm with parsed number on cap input change', () => {
    const onSetClipElevMm = vi.fn();
    const { getByTestId } = render(<Viewport3DLayersPanel {...makeProps({ onSetClipElevMm })} />);
    fireEvent.change(getByTestId('clip-elev-input'), { target: { value: '3200' } });
    expect(onSetClipElevMm).toHaveBeenCalledWith(3200);
  });

  it('calls onSetClipElevMm with null when cap input is cleared', () => {
    const onSetClipElevMm = vi.fn();
    const { getByTestId } = render(
      <Viewport3DLayersPanel {...makeProps({ viewerClipElevMm: 5600, onSetClipElevMm })} />,
    );
    fireEvent.change(getByTestId('clip-elev-input'), { target: { value: '' } });
    expect(onSetClipElevMm).toHaveBeenCalledWith(null);
  });

  it('calls onSetClipFloorElevMm on floor input change', () => {
    const onSetClipFloorElevMm = vi.fn();
    const { getByTestId } = render(
      <Viewport3DLayersPanel {...makeProps({ onSetClipFloorElevMm })} />,
    );
    fireEvent.change(getByTestId('clip-floor-input'), { target: { value: '1200' } });
    expect(onSetClipFloorElevMm).toHaveBeenCalledWith(1200);
  });

  it('calls onClipElevBlur when cap input loses focus', () => {
    const onClipElevBlur = vi.fn();
    const { getByTestId } = render(<Viewport3DLayersPanel {...makeProps({ onClipElevBlur })} />);
    fireEvent.blur(getByTestId('clip-elev-input'));
    expect(onClipElevBlur).toHaveBeenCalledOnce();
  });

  it('calls onClipFloorBlur when floor input loses focus', () => {
    const onClipFloorBlur = vi.fn();
    const { getByTestId } = render(<Viewport3DLayersPanel {...makeProps({ onClipFloorBlur })} />);
    fireEvent.blur(getByTestId('clip-floor-input'));
    expect(onClipFloorBlur).toHaveBeenCalledOnce();
  });

  it('shows activeViewpointId hint when provided', () => {
    const { getByText } = renderWithI18n(
      <Viewport3DLayersPanel {...makeProps({ activeViewpointId: 'vp-42' })} />,
    );
    expect(getByText(/vp-42/)).toBeTruthy();
  });

  it('hides viewpoint hint when activeViewpointId is absent', () => {
    const { queryByText } = render(<Viewport3DLayersPanel {...makeProps()} />);
    expect(queryByText(/viewpoint/)).toBeNull();
  });
});
