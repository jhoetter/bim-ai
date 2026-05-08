// NOAA solar position algorithm — TypeScript port for 60-fps viewport updates.
// Deterministic, no dependencies. Matches the Python implementation in
// app/bim_ai/site/sun_position.py.

export function computeSunPositionNoaa(
  latDeg: number,
  lonDeg: number,
  dateIso: string,
  hours: number,
  minutes: number,
  dstStrategy: 'auto' | 'on' | 'off' = 'auto',
  utcOffsetHours?: number,
): { azimuthDeg: number; elevationDeg: number } {
  const [year, month, day] = dateIso.split('-').map(Number);

  if (utcOffsetHours === undefined) {
    utcOffsetHours = Math.round(lonDeg / 15);
  }

  let dstHours = 0;
  if (dstStrategy === 'on') {
    dstHours = 1;
  } else if (dstStrategy === 'auto') {
    if (latDeg >= 0 && month >= 3 && month <= 10) dstHours = 1;
    else if (latDeg < 0 && (month >= 9 || month <= 4)) dstHours = 1;
  }

  const localHours = hours + minutes / 60;
  const utHours = (((localHours - utcOffsetHours - dstHours) % 24) + 24) % 24;

  const jd = julianDay(year, month, day, utHours);
  const T = (jd - 2451545.0) / 36525.0;

  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  const Mrad = toRad(M);
  const C =
    (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  const sunLon = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const apparentLon = sunLon - 0.00569 - 0.00478 * Math.sin(toRad(omega));

  const meanObliq = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(toRad(omega));

  const declination = toDeg(Math.asin(Math.sin(toRad(obliqCorr)) * Math.sin(toRad(apparentLon))));

  const y = Math.tan(toRad(obliqCorr / 2)) ** 2;
  const L0rad = toRad(L0);
  const Mrad2 = toRad(M);
  const eot =
    4 *
    toDeg(
      y * Math.sin(2 * L0rad) -
        2 * e * Math.sin(Mrad2) +
        4 * e * y * Math.sin(Mrad2) * Math.cos(2 * L0rad) -
        0.5 * y * y * Math.sin(4 * L0rad) -
        1.25 * e * e * Math.sin(2 * Mrad2),
    );

  const trueSolarTime = (((utHours * 60 + eot + 4 * lonDeg) % 1440) + 1440) % 1440;
  const hourAngle = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  const latRad = toRad(latDeg);
  const declRad = toRad(declination);
  const haRad = toRad(hourAngle);

  const cosZenith = Math.max(
    -1,
    Math.min(
      1,
      Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad),
    ),
  );
  const zenith = toDeg(Math.acos(cosZenith));
  const elevation = 90 - zenith;

  let refraction = 0;
  if (elevation > 85) {
    refraction = 0;
  } else if (elevation > 5) {
    const tanEl = Math.tan(toRad(elevation));
    refraction = (58.1 / tanEl - 0.07 / tanEl ** 3 + 0.000086 / tanEl ** 5) / 3600;
  } else if (elevation > -0.575) {
    refraction =
      (1735 +
        elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)))) /
      3600;
  } else {
    refraction = -20.772 / Math.tan(toRad(elevation)) / 3600;
  }

  const elevationCorrected = elevation + refraction;

  const cosAzNum = Math.sin(latRad) * Math.cos(toRad(zenith)) - Math.sin(declRad);
  const cosAzDen = Math.cos(latRad) * Math.sin(toRad(zenith));

  let azimuth = 0;
  if (Math.abs(cosAzDen) >= 1e-10) {
    const cosAz = Math.max(-1, Math.min(1, cosAzNum / cosAzDen));
    const azimuthRaw = toDeg(Math.acos(cosAz));
    azimuth = hourAngle > 0 ? (azimuthRaw + 180) % 360 : (540 - azimuthRaw) % 360;
  }

  return { azimuthDeg: azimuth, elevationDeg: elevationCorrected };
}

function julianDay(year: number, month: number, day: number, utHours: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    utHours / 24 +
    B -
    1524.5
  );
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}
