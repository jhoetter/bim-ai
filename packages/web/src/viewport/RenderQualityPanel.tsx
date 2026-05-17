import { useBimStore } from '../state/store';

export function RenderQualityPanel({ onClose }: { onClose: () => void }) {
  const renderQuality = useBimStore((s) => s.renderQuality);
  const setRenderQuality = useBimStore((s) => s.setRenderQuality);

  return (
    <div
      data-testid="render-quality-panel"
      style={{
        position: 'absolute',
        top: 48,
        right: 8,
        background: '#1a1a2e',
        color: '#eee',
        padding: 12,
        borderRadius: 8,
        width: 220,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Render Quality</strong>
        <button onClick={onClose} data-testid="render-quality-close">
          ✕
        </button>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="checkbox"
          data-testid="render-quality-shadows"
          checked={renderQuality.shadowsEnabled}
          onChange={(e) => setRenderQuality({ shadowsEnabled: e.target.checked })}
        />
        Shadows
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Exposure
        <input
          type="range"
          data-testid="render-quality-exposure"
          min={0.5}
          max={3}
          step={0.1}
          value={renderQuality.toneMappingExposure}
          onChange={(e) => setRenderQuality({ toneMappingExposure: +e.target.value })}
          style={{ width: '100%' }}
        />
        <span data-testid="render-quality-exposure-value">
          {renderQuality.toneMappingExposure.toFixed(1)}×
        </span>
      </label>

      <label style={{ display: 'block' }}>
        Pixel Ratio
        <select
          data-testid="render-quality-pixel-ratio"
          value={renderQuality.pixelRatioScale}
          onChange={(e) =>
            setRenderQuality({ pixelRatioScale: e.target.value as 'auto' | '1x' | '2x' })
          }
        >
          <option value="auto">Auto (device)</option>
          <option value="1x">1× (performance)</option>
          <option value="2x">2× (quality)</option>
        </select>
      </label>
    </div>
  );
}
