/**
 * Given a dimension's witness points, compute where they should be placed to achieve
 * equal spacing between the first and last point.
 * Returns the new witnessPointsMm array.
 */
export function equalizeWitnessSpacing(
  witnessPointsMm: Array<{ xMm: number; yMm: number }>,
): Array<{ xMm: number; yMm: number }> {
  if (witnessPointsMm.length < 3) return witnessPointsMm;
  const first = witnessPointsMm[0]!;
  const last = witnessPointsMm[witnessPointsMm.length - 1]!;
  const n = witnessPointsMm.length - 1; // number of segments
  return witnessPointsMm.map((_, i) => ({
    xMm: first.xMm + (last.xMm - first.xMm) * (i / n),
    yMm: first.yMm + (last.yMm - first.yMm) * (i / n),
  }));
}
