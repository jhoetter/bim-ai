/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../useFocusTrap';
import type { JSX } from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import type { Element } from '@bim-ai/core';
import { useBimStore } from '../../state/store';
import type { CategoryOverride, CategoryOverrides } from '../../state/store';
import type { ViewFilter } from '../../state/storeTypes';
import { applyCommand } from '../../lib/api';
import { dxfViewOverrideKey } from '../../plan/dxfUnderlay';

export const MODEL_CATEGORIES: string[] = [
  'air_terminal',
  'analytical_beam',
  'analytical_brace',
  'analytical_column',
  'analytical_floor',
  'analytical_foundation',
  'analytical_link',
  'analytical_node',
  'analytical_opening',
  'analytical_panel',
  'analytical_space',
  'analytical_surface',
  'analytical_wall',
  'assembly',
  'audio_visual_device',
  'cable_tray',
  'cable_tray_fitting',
  'casework',
  'wall',
  'floor',
  'roof',
  'ceiling',
  'column',
  'beam',
  'communication_device',
  'conduit',
  'conduit_fitting',
  'curtain_panel',
  'curtain_wall_mullion',
  'data_device',
  'door',
  'duct',
  'duct_accessory',
  'duct_fitting',
  'duct_insulation',
  'duct_lining',
  'duct_placeholder',
  'duct_system',
  'electrical_circuit',
  'electrical_equipment',
  'electrical_fixture',
  'entourage',
  'fire_alarm_device',
  'flex_duct',
  'flex_pipe',
  'food_service_equipment',
  'furniture',
  'furniture_system',
  'generic_model',
  'family_instance',
  'placed_asset',
  'hardscape',
  'hvac_zone',
  'lighting_device',
  'lighting_fixture',
  'mass',
  'mass_floor',
  'mechanical_equipment',
  'medical_equipment',
  'model_group',
  'model_line',
  'nurse_call_device',
  'parking',
  'part',
  'pipe',
  'pipe_accessory',
  'pipe_fitting',
  'pipe_insulation',
  'pipe_placeholder',
  'piping_system',
  'planting',
  'plumbing_fixture',
  'property_line',
  'railing',
  'ramp',
  'road',
  'room',
  'security_device',
  'shaft_opening',
  'site',
  'site_origin',
  'specialty_equipment',
  'sprinkler',
  'stair',
  'structural_area_reinforcement',
  'structural_column',
  'structural_connection',
  'structural_fabric_area',
  'structural_fabric_reinforcement',
  'structural_foundation',
  'structural_framing_system',
  'structural_path_reinforcement',
  'structural_rebar',
  'structural_stiffener',
  'structural_truss',
  'temporary_structure',
  'topography',
  'vertical_circulation',
  'window',
  'wire',
  'zone',
];

export const ANNOTATION_CATEGORIES: string[] = [
  'area_tag',
  'assembly_tag',
  'beam_annotation',
  'brace_annotation',
  'callout_head',
  'color_fill_legend',
  'column_tag',
  'communication_device_tag',
  'contour_label',
  'curtain_panel_tag',
  'curtain_wall_tag',
  'data_device_tag',
  'detail_component',
  'family_symbolic_line',
  'family_opening_projection',
  'family_hidden_cut',
  'detail_group',
  'detail_item_tag',
  'grid_line',
  'level_datum',
  'dimension',
  'room_tag',
  'door_tag',
  'window_tag',
  'section_mark',
  'elevation_mark',
  'electrical_equipment_tag',
  'electrical_fixture_tag',
  'entourage_tag',
  'fire_alarm_device_tag',
  'floor_tag',
  'furniture_tag',
  'generic_annotation',
  'generic_model_tag',
  'keynote_tag',
  'lighting_device_tag',
  'lighting_fixture_tag',
  'material_tag',
  'mechanical_equipment_tag',
  'multi_category_tag',
  'parking_tag',
  'pipe_tag',
  'planting_tag',
  'plumbing_fixture_tag',
  'railing_tag',
  'revision_cloud',
  'roof_tag',
  'room_separation',
  'area_boundary',
  'reference_plane',
  'masking_region',
  'detail_line',
  'scope_box',
  'span_direction_symbol',
  'specialty_equipment_tag',
  'spot_coordinate',
  'spot_elevation',
  'spot_slope',
  'stair_path',
  'stair_tag',
  'structural_column_tag',
  'structural_foundation_tag',
  'structural_framing_tag',
  'structural_rebar_tag',
  'text_note',
  'view_reference',
  'view_title',
  'wall_tag',
];

const CATEGORY_LABELS: Record<string, string> = {
  air_terminal: 'Air Terminals',
  analytical_beam: 'Analytical Beams',
  analytical_brace: 'Analytical Braces',
  analytical_column: 'Analytical Columns',
  analytical_floor: 'Analytical Floors',
  analytical_foundation: 'Analytical Foundations',
  analytical_link: 'Analytical Links',
  analytical_node: 'Analytical Nodes',
  analytical_opening: 'Analytical Openings',
  analytical_panel: 'Analytical Panels',
  analytical_space: 'Analytical Spaces',
  analytical_surface: 'Analytical Surfaces',
  analytical_wall: 'Analytical Walls',
  assembly: 'Assemblies',
  audio_visual_device: 'Audio Visual Devices',
  cable_tray: 'Cable Trays',
  cable_tray_fitting: 'Cable Tray Fittings',
  casework: 'Casework',
  wall: 'Walls',
  floor: 'Floors',
  roof: 'Roofs',
  ceiling: 'Ceilings',
  column: 'Columns',
  beam: 'Structural Framing',
  communication_device: 'Communication Devices',
  conduit: 'Conduits',
  conduit_fitting: 'Conduit Fittings',
  curtain_panel: 'Curtain Panels',
  curtain_wall_mullion: 'Curtain Wall Mullions',
  data_device: 'Data Devices',
  door: 'Doors',
  duct: 'Ducts',
  duct_accessory: 'Duct Accessories',
  duct_fitting: 'Duct Fittings',
  duct_insulation: 'Duct Insulations',
  duct_lining: 'Duct Linings',
  duct_placeholder: 'Duct Placeholders',
  duct_system: 'Duct Systems',
  electrical_circuit: 'Electrical Circuits',
  electrical_equipment: 'Electrical Equipment',
  electrical_fixture: 'Electrical Fixtures',
  entourage: 'Entourage',
  fire_alarm_device: 'Fire Alarm Devices',
  flex_duct: 'Flex Ducts',
  flex_pipe: 'Flex Pipes',
  food_service_equipment: 'Food Service Equipment',
  furniture: 'Furniture',
  furniture_system: 'Furniture Systems',
  generic_model: 'Generic Models',
  family_instance: 'Loaded Families',
  placed_asset: 'Furniture / Generic Models',
  hardscape: 'Hardscape',
  hvac_zone: 'HVAC Zones',
  lighting_device: 'Lighting Devices',
  lighting_fixture: 'Lighting Fixtures',
  mass: 'Mass',
  mass_floor: 'Mass Floors',
  mechanical_equipment: 'Mechanical Equipment',
  medical_equipment: 'Medical Equipment',
  model_group: 'Model Groups',
  model_line: 'Model Lines',
  nurse_call_device: 'Nurse Call Devices',
  parking: 'Parking',
  part: 'Parts',
  pipe: 'Pipes',
  pipe_accessory: 'Pipe Accessories',
  pipe_fitting: 'Pipe Fittings',
  pipe_insulation: 'Pipe Insulations',
  pipe_placeholder: 'Pipe Placeholders',
  piping_system: 'Piping Systems',
  planting: 'Planting',
  plumbing_fixture: 'Plumbing Fixtures',
  property_line: 'Property Lines',
  railing: 'Railings',
  ramp: 'Ramps',
  road: 'Roads',
  room: 'Rooms',
  security_device: 'Security Devices',
  shaft_opening: 'Shaft Openings',
  site: 'Site',
  site_origin: 'Site / Origin',
  specialty_equipment: 'Specialty Equipment',
  sprinkler: 'Sprinklers',
  stair: 'Stairs',
  structural_area_reinforcement: 'Structural Area Reinforcement',
  structural_column: 'Structural Columns',
  structural_connection: 'Structural Connections',
  structural_fabric_area: 'Structural Fabric Areas',
  structural_fabric_reinforcement: 'Structural Fabric Reinforcement',
  structural_foundation: 'Structural Foundations',
  structural_framing_system: 'Structural Framing Systems',
  structural_path_reinforcement: 'Structural Path Reinforcement',
  structural_rebar: 'Structural Rebar',
  structural_stiffener: 'Structural Stiffeners',
  structural_truss: 'Structural Trusses',
  temporary_structure: 'Temporary Structures',
  topography: 'Topography',
  vertical_circulation: 'Vertical Circulation',
  window: 'Windows',
  wire: 'Wires',
  zone: 'Zones',
  area_tag: 'Area Tags',
  assembly_tag: 'Assembly Tags',
  beam_annotation: 'Beam Annotations',
  brace_annotation: 'Brace Annotations',
  callout_head: 'Callout Heads',
  color_fill_legend: 'Color Fill Legends',
  column_tag: 'Column Tags',
  communication_device_tag: 'Communication Device Tags',
  contour_label: 'Contour Labels',
  curtain_panel_tag: 'Curtain Panel Tags',
  curtain_wall_tag: 'Curtain Wall Tags',
  data_device_tag: 'Data Device Tags',
  detail_component: 'Detail Components',
  family_symbolic_line: 'Family Symbolic Lines',
  family_opening_projection: 'Opening (Projection)',
  family_hidden_cut: 'Hidden Lines (Cut)',
  detail_group: 'Detail Groups',
  detail_item_tag: 'Detail Item Tags',
  grid_line: 'Grids',
  level_datum: 'Levels',
  dimension: 'Dimensions',
  room_tag: 'Room Tags',
  door_tag: 'Door Tags',
  window_tag: 'Window Tags',
  section_mark: 'Section Marks',
  elevation_mark: 'Elevation Marks',
  electrical_equipment_tag: 'Electrical Equipment Tags',
  electrical_fixture_tag: 'Electrical Fixture Tags',
  entourage_tag: 'Entourage Tags',
  fire_alarm_device_tag: 'Fire Alarm Device Tags',
  floor_tag: 'Floor Tags',
  furniture_tag: 'Furniture Tags',
  generic_annotation: 'Generic Annotations',
  generic_model_tag: 'Generic Model Tags',
  keynote_tag: 'Keynote Tags',
  lighting_device_tag: 'Lighting Device Tags',
  lighting_fixture_tag: 'Lighting Fixture Tags',
  material_tag: 'Material Tags',
  mechanical_equipment_tag: 'Mechanical Equipment Tags',
  multi_category_tag: 'Multi-Category Tags',
  parking_tag: 'Parking Tags',
  pipe_tag: 'Pipe Tags',
  planting_tag: 'Planting Tags',
  plumbing_fixture_tag: 'Plumbing Fixture Tags',
  railing_tag: 'Railing Tags',
  revision_cloud: 'Revision Clouds',
  roof_tag: 'Roof Tags',
  room_separation: 'Room Separation Lines',
  area_boundary: 'Area Boundary Lines',
  reference_plane: 'Reference Planes',
  masking_region: 'Masking Regions',
  detail_line: 'Detail Lines',
  scope_box: 'Scope Boxes',
  span_direction_symbol: 'Span Direction Symbols',
  specialty_equipment_tag: 'Specialty Equipment Tags',
  spot_coordinate: 'Spot Coordinates',
  spot_elevation: 'Spot Elevations',
  spot_slope: 'Spot Slopes',
  stair_path: 'Stair Paths',
  stair_tag: 'Stair Tags',
  structural_column_tag: 'Structural Column Tags',
  structural_foundation_tag: 'Structural Foundation Tags',
  structural_framing_tag: 'Structural Framing Tags',
  structural_rebar_tag: 'Structural Rebar Tags',
  text_note: 'Text Notes',
  view_reference: 'View References',
  view_title: 'View Titles',
  wall_tag: 'Wall Tags',
};

const PRESET_COLORS = ['#000000', '#808080', '#0000ff', '#ff0000', '#008000', 'custom'] as const;

const LINE_WEIGHTS = ['By Category', '1', '2', '3', '4', '5'] as const;

const LINE_PATTERNS = ['Solid', 'Dashed', 'Dotted', 'Center'] as const;

type Tab = 'model' | 'annotation' | 'filters' | 'links';

function clampTransparency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ColorSwatch({
  color,
  onChange,
}: {
  color: string | null | undefined;
  onChange: (c: string | null) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const display = color ?? '#000000';
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title="Line color"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 20,
          height: 14,
          border: '1px solid var(--color-border)',
          background: display,
          cursor: 'pointer',
          borderRadius: 2,
        }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 0,
            zIndex: 100,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: 4,
            display: 'flex',
            gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {PRESET_COLORS.slice(0, 5).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              style={{
                width: 18,
                height: 18,
                background: c,
                border:
                  c === color ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            />
          ))}
          <button
            type="button"
            aria-label="Clear colour override"
            title="Clear colour override"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            style={{
              padding: '0 4px',
              border: '1px solid var(--color-border)',
              borderRadius: 2,
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--color-foreground)',
              lineHeight: 1,
            }}
          >
            <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  categoryKey,
  draft,
  onChange,
}: {
  categoryKey: string;
  draft: CategoryOverride;
  onChange: (upd: CategoryOverride) => void;
}): JSX.Element {
  const visible = draft.visible !== false;
  const projColor = draft.projection?.lineColor ?? null;
  const projWeight =
    draft.projection?.lineWeightFactor != null
      ? String(Math.round(draft.projection.lineWeightFactor))
      : 'By Category';
  const projPattern = draft.projection?.linePattern ?? 'Solid';
  const cutColor = draft.cut?.lineColor ?? null;
  const cutWeight =
    draft.cut?.lineWeightFactor != null
      ? String(Math.round(draft.cut.lineWeightFactor))
      : 'By Category';
  const cutPattern = draft.cut?.linePattern ?? 'Solid';
  const projHalftone = draft.projection?.halftone ?? false;
  const projTransparency = clampTransparency(draft.projection?.transparency ?? 0);
  const cutTransparency = clampTransparency(draft.cut?.transparency ?? 0);

  return (
    <tr
      data-testid={`vv-category-row-${categoryKey}`}
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <td style={{ padding: '4px 8px', fontSize: 12 }}>
        {CATEGORY_LABELS[categoryKey] ?? categoryKey}
      </td>
      <td style={{ padding: '4px 8px' }}>
        <input
          type="checkbox"
          checked={visible}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} visible`}
          onChange={(e) => onChange({ ...draft, visible: e.target.checked })}
        />
      </td>
      {/* Projection: color, weight, pattern */}
      <td style={{ padding: '4px 8px' }}>
        <ColorSwatch
          color={projColor}
          onChange={(c) =>
            onChange({ ...draft, projection: { ...draft.projection, lineColor: c } })
          }
        />
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={projWeight}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} projection line weight`}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...draft,
              projection: {
                ...draft.projection,
                lineWeightFactor: v === 'By Category' ? undefined : Number(v),
              },
            });
          }}
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={projPattern}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} projection pattern`}
          onChange={(e) =>
            onChange({ ...draft, projection: { ...draft.projection, linePattern: e.target.value } })
          }
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={projTransparency}
            aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} projection transparency`}
            onChange={(e) =>
              onChange({
                ...draft,
                projection: {
                  ...draft.projection,
                  transparency: clampTransparency(Number(e.target.value)),
                },
              })
            }
            style={{ width: 76 }}
          />
          <span style={{ minWidth: 34, fontSize: 11, color: 'var(--color-muted)' }}>
            {projTransparency}%
          </span>
        </div>
      </td>
      {/* Cut: color, weight, pattern */}
      <td style={{ padding: '4px 8px' }}>
        <ColorSwatch
          color={cutColor}
          onChange={(c) => onChange({ ...draft, cut: { ...draft.cut, lineColor: c } })}
        />
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={cutWeight}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} cut line weight`}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...draft,
              cut: {
                ...draft.cut,
                lineWeightFactor: v === 'By Category' ? undefined : Number(v),
              },
            });
          }}
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={cutPattern}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} cut pattern`}
          onChange={(e) =>
            onChange({ ...draft, cut: { ...draft.cut, linePattern: e.target.value } })
          }
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={cutTransparency}
            aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} cut transparency`}
            onChange={(e) =>
              onChange({
                ...draft,
                cut: {
                  ...draft.cut,
                  transparency: clampTransparency(Number(e.target.value)),
                },
              })
            }
            style={{ width: 76 }}
          />
          <span style={{ minWidth: 34, fontSize: 11, color: 'var(--color-muted)' }}>
            {cutTransparency}%
          </span>
        </div>
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={projHalftone}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} halftone`}
          title="Render this category at 50% opacity (halftone)"
          onChange={(e) => {
            const ht = e.target.checked;
            onChange({
              ...draft,
              projection: { ...draft.projection, halftone: ht },
              cut: { ...draft.cut, halftone: ht },
            });
          }}
        />
      </td>
    </tr>
  );
}

function FiltersTabBody({
  planViewId,
  elementsById,
  addViewFilter,
  removeViewFilter,
}: {
  planViewId: string | undefined;
  elementsById: Record<string, import('@bim-ai/core').Element>;
  addViewFilter: (planViewId: string, filter: ViewFilter) => void;
  removeViewFilter: (planViewId: string, filterId: string) => void;
}): JSX.Element {
  const pv = planViewId ? elementsById[planViewId] : undefined;
  const filters: ViewFilter[] =
    pv?.kind === 'plan_view' ? ((pv.viewFilters as ViewFilter[] | undefined) ?? []) : [];

  const handleAdd = () => {
    if (!planViewId) return;
    const newFilter: ViewFilter = {
      id: crypto.randomUUID(),
      name: 'New Filter',
      rules: [{ field: '', operator: 'equals', value: '' }],
      override: {},
    };
    addViewFilter(planViewId, newFilter);
  };

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ marginBottom: 10 }}>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!planViewId}
          style={{
            padding: '5px 12px',
            fontSize: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: 'transparent',
            cursor: planViewId ? 'pointer' : 'not-allowed',
            color: 'var(--color-foreground)',
          }}
        >
          Add Filter
        </button>
      </div>
      {filters.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', padding: '8px 0' }}>
          No filters defined.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filters.map((f) => {
            const ruleSummary = f.rules
              .map((r) => `${r.field} ${r.operator} "${r.value}"`)
              .join(' AND ');
            return (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  background: 'var(--color-background)',
                }}
              >
                <input
                  type="text"
                  value={f.name}
                  readOnly
                  style={{
                    fontSize: 12,
                    border: '1px solid var(--color-border)',
                    borderRadius: 2,
                    padding: '2px 6px',
                    width: 140,
                    background: 'var(--color-surface)',
                    color: 'var(--color-foreground)',
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-muted)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ruleSummary || '(no rules)'}
                </span>
                <button
                  type="button"
                  onClick={() => planViewId && removeViewFilter(planViewId, f.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-muted)',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                  aria-label={`Remove filter ${f.name}`}
                  title={`Remove filter ${f.name}`}
                >
                  <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VVDialog({
  open,
  onClose,
  applyCommandImpl,
}: {
  open: boolean;
  onClose: () => void;
  /** Tests inject a mock to capture commands without hitting the network. */
  applyCommandImpl?: typeof applyCommand;
}): JSX.Element | null {
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const elementsById = useBimStore((s) => s.elementsById);
  const setCategoryOverride = useBimStore((s) => s.setCategoryOverride);
  const addViewFilter = useBimStore((s) => s.addViewFilter);
  const removeViewFilter = useBimStore((s) => s.removeViewFilter);
  const modelId = useBimStore((s) => s.modelId);

  const [tab, setTab] = useState<Tab>('model');
  const [categorySearch, setCategorySearch] = useState('');
  const [draft, setDraft] = useState<CategoryOverrides>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // Sync draft from store when dialog opens or active view changes
  useEffect(() => {
    if (!open) return;
    const pv = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const stored =
      pv?.kind === 'plan_view' ? ((pv.categoryOverrides as CategoryOverrides) ?? {}) : {};
    setDraft(stored);
  }, [open, activePlanViewId, elementsById]);

  const handleCategoryChange = useCallback((catKey: string, upd: CategoryOverride) => {
    setDraft((prev) => ({ ...prev, [catKey]: upd }));
  }, []);

  const handleApply = useCallback(() => {
    if (!activePlanViewId) return;
    const pv = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const stored =
      pv?.kind === 'plan_view' ? ((pv.categoryOverrides as CategoryOverrides) ?? {}) : {};
    const allKeys = new Set([...Object.keys(stored), ...Object.keys(draft)]);
    for (const key of allKeys) {
      const draftVal = draft[key];
      if (draftVal !== undefined) {
        setCategoryOverride(activePlanViewId, key, draftVal);
      }
    }
  }, [activePlanViewId, draft, elementsById, setCategoryOverride]);

  const handleOk = useCallback(() => {
    handleApply();
    onClose();
  }, [handleApply, onClose]);

  if (!open) return null;

  const planViewName = activePlanViewId
    ? ((elementsById[activePlanViewId] as { name?: string })?.name ?? 'Plan View')
    : 'No Plan View';

  const categories = tab === 'model' ? MODEL_CATEGORIES : ANNOTATION_CATEGORIES;
  const categoryQuery = categorySearch.trim().toLowerCase();
  const visibleCategories =
    categoryQuery === ''
      ? categories
      : categories.filter((cat) => {
          const label = CATEGORY_LABELS[cat] ?? cat;
          return (
            label.toLowerCase().includes(categoryQuery) || cat.toLowerCase().includes(categoryQuery)
          );
        });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visibility/Graphics Overrides"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          minWidth: 900,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-foreground)' }}>
            Visibility/Graphics Overrides — {planViewName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted)',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 14px',
          }}
        >
          {(['model', 'annotation', 'filters', 'links'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              data-testid={`vv-tab-${t}`}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: tab === t ? 600 : 400,
                background: 'transparent',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                borderLeft: 'none',
                cursor: 'pointer',
                color: tab === t ? 'var(--color-foreground)' : 'var(--color-muted)',
              }}
            >
              {t === 'model'
                ? 'Model Categories'
                : t === 'annotation'
                  ? 'Annotation Categories'
                  : t === 'filters'
                    ? 'Filters'
                    : 'Revit Links'}
            </button>
          ))}
        </div>

        {/* Table / Filters / Links */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'links' ? (
            <LinksTabBody
              elementsById={elementsById}
              modelId={modelId}
              activePlanViewId={activePlanViewId}
              setCategoryOverride={setCategoryOverride}
              applyCommandImpl={applyCommandImpl}
            />
          ) : tab === 'filters' ? (
            <FiltersTabBody
              planViewId={activePlanViewId}
              elementsById={elementsById}
              addViewFilter={addViewFilter}
              removeViewFilter={removeViewFilter}
            />
          ) : (
            <>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  padding: '8px 10px',
                }}
              >
                <input
                  type="search"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  aria-label="Search visibility categories"
                  placeholder="Search categories"
                  data-testid="vv-category-search"
                  style={{
                    width: 280,
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    background: 'var(--color-background)',
                    color: 'var(--color-foreground)',
                    fontSize: 12,
                    padding: '5px 8px',
                  }}
                />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--color-background)' }}>
                    <th
                      scope="col"
                      style={{
                        padding: '6px 8px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Category
                    </th>
                    <th scope="col" style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600 }}>
                      Visible
                    </th>
                    <th
                      scope="col"
                      colSpan={4}
                      style={{
                        padding: '6px 8px',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        borderLeft: '1px solid var(--color-border)',
                      }}
                    >
                      Projection
                    </th>
                    <th
                      scope="col"
                      colSpan={4}
                      style={{
                        padding: '6px 8px',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        borderLeft: '1px solid var(--color-border)',
                      }}
                    >
                      Cut
                    </th>
                    <th scope="col" style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600 }} />
                  </tr>
                  <tr style={{ background: 'var(--color-background)' }}>
                    <th scope="col" style={{ padding: '4px 8px' }} />
                    <th scope="col" style={{ padding: '4px 8px' }} />
                    <th
                      scope="col"
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 500,
                        borderLeft: '1px solid var(--color-border)',
                      }}
                    >
                      Color
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>
                      Weight
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>
                      Pattern
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>
                      Transp.
                    </th>
                    <th
                      scope="col"
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 500,
                        borderLeft: '1px solid var(--color-border)',
                      }}
                    >
                      Color
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>
                      Weight
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>
                      Pattern
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>
                      Transp.
                    </th>
                    <th scope="col" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 500 }}>
                      Halftone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCategories.map((cat) => (
                    <CategoryRow
                      key={cat}
                      categoryKey={cat}
                      draft={draft[cat] ?? {}}
                      onChange={(upd) => handleCategoryChange(cat, upd)}
                    />
                  ))}
                  {visibleCategories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        style={{ padding: 12, color: 'var(--color-muted)', fontSize: 12 }}
                      >
                        No matching categories
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-foreground)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-foreground)',
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleOk}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              border: 'none',
              borderRadius: 4,
              background: 'var(--color-accent)',
              cursor: 'pointer',
              color: 'var(--color-accent-foreground)',
              fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

type LinkRow = Extract<Element, { kind: 'link_model' }>;
type DxfLinkRow = Extract<Element, { kind: 'link_dxf' }>;

function LinksTabBody({
  elementsById,
  modelId,
  activePlanViewId,
  setCategoryOverride,
  applyCommandImpl,
}: {
  elementsById: Record<string, Element>;
  modelId?: string;
  activePlanViewId?: string;
  setCategoryOverride: (
    planViewId: string,
    categoryKey: string,
    override: CategoryOverride,
  ) => void;
  applyCommandImpl?: typeof applyCommand;
}): JSX.Element {
  const links: LinkRow[] = (Object.values(elementsById) as Element[])
    .filter((e): e is LinkRow => e.kind === 'link_model')
    .sort((a, b) => a.name.localeCompare(b.name));
  const dxfLinks: DxfLinkRow[] = (Object.values(elementsById) as Element[])
    .filter((e): e is DxfLinkRow => e.kind === 'link_dxf')
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
  const overrides =
    activePlanView?.kind === 'plan_view'
      ? ((activePlanView.categoryOverrides ?? {}) as CategoryOverrides)
      : {};
  const [pending, setPending] = useState<string | null>(null);
  const apply = applyCommandImpl ?? applyCommand;

  if (links.length === 0 && dxfLinks.length === 0) {
    return (
      <div
        data-testid="vv-links-empty"
        style={{ padding: 14, fontSize: 12, color: 'var(--color-muted)' }}
      >
        No linked models or imported CAD in this host.
      </div>
    );
  }

  const toggle = async (l: LinkRow): Promise<void> => {
    if (!modelId) return;
    setPending(l.id);
    try {
      await apply(modelId, {
        type: 'updateLinkModel',
        linkId: l.id,
        hidden: !l.hidden,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <table
      data-testid="vv-links-table"
      style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
    >
      <thead>
        <tr style={{ background: 'var(--color-background)' }}>
          <th
            scope="col"
            style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}
          >
            Link
          </th>
          <th
            scope="col"
            style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}
          >
            Type / mode
          </th>
          <th
            scope="col"
            style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600 }}
          >
            Visible
          </th>
          <th
            scope="col"
            style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600 }}
          >
            Transparency
          </th>
        </tr>
      </thead>
      <tbody>
        {links.map((l) => (
          <tr key={l.id} data-testid={`vv-links-row-${l.id}`}>
            <td style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: 12 }}>{l.name}</div>
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--color-muted)',
                }}
              >
                {l.sourceModelId}
              </div>
            </td>
            <td style={{ padding: '6px 8px', fontSize: 11 }}>
              {l.visibilityMode === 'linked_view' ? 'Linked view' : 'Host view'}
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={!l.hidden}
                disabled={pending === l.id}
                data-testid={`vv-links-visible-${l.id}`}
                onChange={() => void toggle(l)}
              />
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--color-muted)' }}>
              -
            </td>
          </tr>
        ))}
        {dxfLinks.map((l) => {
          const key = dxfViewOverrideKey(l.id);
          const override = overrides[key] ?? {};
          const transparency =
            override.projection?.transparency ?? Math.round((1 - (l.overlayOpacity ?? 0.5)) * 100);
          const visible = override.visible !== false && l.loaded !== false;
          const updateDxfOverride = (next: CategoryOverride): void => {
            if (!activePlanViewId) return;
            setCategoryOverride(activePlanViewId, key, next);
          };
          return (
            <tr key={l.id} data-testid={`vv-links-row-${l.id}`}>
              <td style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: 12 }}>{l.name ?? 'DXF Underlay'}</div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10,
                    color: 'var(--color-muted)',
                  }}
                >
                  {l.sourcePath ?? l.id}
                </div>
              </td>
              <td style={{ padding: '6px 8px', fontSize: 11 }}>
                Imported CAD
                {l.colorMode === 'native' ? ' / original colors' : ''}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={visible}
                  disabled={!activePlanViewId || l.loaded === false}
                  data-testid={`vv-links-visible-${l.id}`}
                  onChange={(e) => updateDxfOverride({ ...override, visible: e.target.checked })}
                />
              </td>
              <td style={{ padding: '6px 8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={transparency}
                    disabled={!activePlanViewId}
                    data-testid={`vv-links-transparency-${l.id}`}
                    onChange={(e) =>
                      updateDxfOverride({
                        ...override,
                        projection: {
                          ...override.projection,
                          transparency: Number(e.target.value),
                        },
                      })
                    }
                    style={{ width: 96 }}
                  />
                  <span
                    style={{
                      width: 34,
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 10,
                      color: 'var(--color-muted)',
                    }}
                  >
                    {transparency}%
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
