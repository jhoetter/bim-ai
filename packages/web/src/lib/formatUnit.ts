export type LengthUnit = 'mm' | 'm' | 'cm' | 'ft' | 'in' | 'ft-in';
export type AreaUnit = 'm2' | 'ft2';

export type ProjectUnits = {
  lengthUnit: LengthUnit;
  areaUnit: AreaUnit;
  decimalSymbol: '.' | ',';
};

function applyDecimal(numStr: string, decimalSymbol: '.' | ','): string {
  if (decimalSymbol === ',') {
    return numStr.replace('.', ',');
  }
  return numStr;
}

/** Greatest-common-divisor helper for fraction simplification */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Format a length value (stored as mm) into the display unit string.
 *
 * Examples:
 *   formatLength(3500, { lengthUnit: 'mm', ... }) => "3500 mm"
 *   formatLength(3500, { lengthUnit: 'm', decimalSymbol: '.' }) => "3.50 m"
 *   formatLength(3500, { lengthUnit: 'm', decimalSymbol: ',' }) => "3,50 m"
 *   formatLength(304.8, { lengthUnit: 'ft-in', ... }) => "1'-0\""
 *   formatLength(317.5, { lengthUnit: 'ft-in', ... }) => "1'-0 1/2\""
 */
export function formatLength(valueInMm: number, units: ProjectUnits): string {
  const { lengthUnit, decimalSymbol } = units;

  switch (lengthUnit) {
    case 'mm': {
      return `${Math.round(valueInMm)} mm`;
    }
    case 'cm': {
      const cm = valueInMm / 10;
      return `${applyDecimal(cm.toFixed(1), decimalSymbol)} cm`;
    }
    case 'm': {
      const m = valueInMm / 1000;
      return `${applyDecimal(m.toFixed(2), decimalSymbol)} m`;
    }
    case 'ft': {
      const ft = valueInMm / 304.8;
      return `${applyDecimal(ft.toFixed(2), decimalSymbol)} ft`;
    }
    case 'in': {
      const inches = valueInMm / 25.4;
      return `${applyDecimal(inches.toFixed(1), decimalSymbol)} in`;
    }
    case 'ft-in': {
      const totalFeet = valueInMm / 304.8;
      const feet = Math.floor(totalFeet);
      const remainingInches = (valueInMm - feet * 304.8) / 25.4;
      const numerator16 = Math.round(remainingInches * 16);

      if (numerator16 === 0) {
        return `${feet}'-0"`;
      }

      const wholeInches = Math.floor(numerator16 / 16);
      const fracNum = numerator16 % 16;

      if (fracNum === 0) {
        return `${feet}'-${wholeInches}"`;
      }

      const divisor = gcd(fracNum, 16);
      const simplifiedNum = fracNum / divisor;
      const simplifiedDen = 16 / divisor;

      if (wholeInches === 0) {
        return `${feet}'-0 ${simplifiedNum}/${simplifiedDen}"`;
      }
      return `${feet}'-${wholeInches} ${simplifiedNum}/${simplifiedDen}"`;
    }
    default: {
      return `${Math.round(valueInMm)} mm`;
    }
  }
}

/**
 * Format area value (stored as mm²) into display unit string.
 *
 * Examples:
 *   formatArea(1_000_000, { areaUnit: 'm2', ... }) => "1.00 m²"
 *   formatArea(1_000_000, { areaUnit: 'ft2', ... }) => "10.76 ft²"
 */
export function formatArea(valueInMm2: number, units: ProjectUnits): string {
  const { areaUnit, decimalSymbol } = units;

  switch (areaUnit) {
    case 'm2': {
      const m2 = valueInMm2 / 1_000_000;
      return `${applyDecimal(m2.toFixed(2), decimalSymbol)} m²`;
    }
    case 'ft2': {
      const ft2 = valueInMm2 / 92_903.04;
      return `${applyDecimal(ft2.toFixed(2), decimalSymbol)} ft²`;
    }
    default: {
      const m2 = valueInMm2 / 1_000_000;
      return `${applyDecimal(m2.toFixed(2), decimalSymbol)} m²`;
    }
  }
}
