import type { ComponentType, ReactNode, SVGAttributes } from 'react';

export type BimIconHifiProps = SVGAttributes<SVGSVGElement> & {
  size?: number | string;
};

export type BimIconProps = SVGAttributes<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
};

export type BimIcon = ComponentType<BimIconProps>;

/**
 * Creates a BIM icon component from a static ReactNode of SVG children.
 * The returned component has the same props API as the app's standard icons:
 * `size`, `strokeWidth`, `absoluteStrokeWidth`, plus any SVG attribute.
 *
 * All icons are 24×24 viewBox, stroke-based with currentColor. Default
 * strokeWidth is 1.5; active/selected state uses 2.0 (driven by the parent).
 */
export function bimIcon(displayName: string, paths: ReactNode): BimIcon {
  function Icon({ size = 24, strokeWidth = 1.5, absoluteStrokeWidth, ...rest }: BimIconProps) {
    const sw = absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/**
 * Creates a high-fidelity BIM icon at 48×48 viewBox.
 *
 * Unlike bimIcon, children fully control their own fill and stroke —
 * the SVG root only provides `stroke="currentColor"` and `fill="none"` as
 * defaults, which individual elements can override with explicit attributes
 * (e.g. `fill="currentColor" fillOpacity={0.08}` for material fills).
 *
 * Stroke hierarchy convention:
 *   strokeWidth 2   — primary faces / outlines
 *   strokeWidth 1.5 — secondary edges / reveals
 *   strokeWidth 0.75 — material hatch, detail lines
 */
export function bimIconHifi(
  displayName: string,
  paths: ReactNode,
): ComponentType<BimIconHifiProps> {
  function Icon({ size = 48, ...rest }: BimIconHifiProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}
