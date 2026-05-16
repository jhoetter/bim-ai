export function formatRoomAreaM2(areaMm2: number): string {
  return `${(areaMm2 / 1_000_000).toFixed(1)} m²`;
}
