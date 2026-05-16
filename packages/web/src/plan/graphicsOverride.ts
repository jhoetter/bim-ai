export function resolveElementFillColor(
  defaultHex: string,
  override: { fillColorHex?: string | null } | null | undefined,
): string {
  if (override?.fillColorHex != null) return override.fillColorHex;
  return defaultHex;
}

export function resolveElementSurfaceColor(
  defaultHex: string,
  override: { surfaceColorHex?: string | null } | null | undefined,
): string {
  if (override?.surfaceColorHex != null) return override.surfaceColorHex;
  return defaultHex;
}
