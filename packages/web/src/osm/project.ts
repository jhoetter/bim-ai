const METRES_PER_DEGREE = 111_319.508;

/**
 * Convert a WGS84 lat/lon into local millimetres relative to an anchor point.
 * Uses equirectangular projection — accurate to < 0.1 % at neighbourhood scale
 * (< 1 km radius). East = +xMm, North = +yMm.
 */
export function wgs84ToMm(
  lat: number,
  lon: number,
  anchorLat: number,
  anchorLon: number,
): { xMm: number; yMm: number } {
  const latRad = anchorLat * (Math.PI / 180);
  const xMm = (lon - anchorLon) * Math.cos(latRad) * METRES_PER_DEGREE * 1000;
  const yMm = (lat - anchorLat) * METRES_PER_DEGREE * 1000;
  return { xMm, yMm };
}

/** Reverse: local mm → WGS84 lat/lon. */
export function mmToWgs84(
  xMm: number,
  yMm: number,
  anchorLat: number,
  anchorLon: number,
): { lat: number; lon: number } {
  const latRad = anchorLat * (Math.PI / 180);
  const lat = anchorLat + yMm / (METRES_PER_DEGREE * 1000);
  const lon = anchorLon + xMm / (Math.cos(latRad) * METRES_PER_DEGREE * 1000);
  return { lat, lon };
}
