import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function colorChannels(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type ${colorType}; expected grayscale, RGB, GA, or RGBA.`);
}

export async function readPngRgba(filePath) {
  const buf = await fs.readFile(filePath);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }

  let offset = 8;
  let ihdr = null;
  const idat = [];
  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!ihdr) throw new Error(`PNG is missing IHDR: ${filePath}`);
  if (ihdr.bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${ihdr.bitDepth}: ${filePath}`);
  if (ihdr.compression !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0) {
    throw new Error(`Unsupported PNG encoding options: ${filePath}`);
  }
  const channels = colorChannels(ihdr.colorType);
  const rowBytes = ihdr.width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(ihdr.width * ihdr.height * 4);
  let sourceOffset = 0;
  const previous = new Uint8Array(rowBytes);
  const current = new Uint8Array(rowBytes);

  for (let y = 0; y < ihdr.height; y++) {
    const filterType = raw[sourceOffset++];
    for (let x = 0; x < rowBytes; x++) {
      const rawByte = raw[sourceOffset++];
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let value;
      if (filterType === 0) value = rawByte;
      else if (filterType === 1) value = rawByte + left;
      else if (filterType === 2) value = rawByte + up;
      else if (filterType === 3) value = rawByte + Math.floor((left + up) / 2);
      else if (filterType === 4) value = rawByte + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG row filter ${filterType}: ${filePath}`);
      current[x] = value & 0xff;
    }

    for (let x = 0; x < ihdr.width; x++) {
      const src = x * channels;
      const dst = (y * ihdr.width + x) * 4;
      if (ihdr.colorType === 0) {
        rgba[dst] = current[src];
        rgba[dst + 1] = current[src];
        rgba[dst + 2] = current[src];
        rgba[dst + 3] = 255;
      } else if (ihdr.colorType === 2) {
        rgba[dst] = current[src];
        rgba[dst + 1] = current[src + 1];
        rgba[dst + 2] = current[src + 2];
        rgba[dst + 3] = 255;
      } else if (ihdr.colorType === 4) {
        rgba[dst] = current[src];
        rgba[dst + 1] = current[src];
        rgba[dst + 2] = current[src];
        rgba[dst + 3] = current[src + 1];
      } else {
        rgba[dst] = current[src];
        rgba[dst + 1] = current[src + 1];
        rgba[dst + 2] = current[src + 2];
        rgba[dst + 3] = current[src + 3];
      }
    }
    previous.set(current);
  }

  return { width: ihdr.width, height: ihdr.height, data: rgba };
}

function lumaAt(image, x, y) {
  const i = (y * image.width + x) * 4;
  return image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722;
}

function backgroundColor(image) {
  const points = [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1],
    [Math.floor(image.width / 2), 0],
    [Math.floor(image.width / 2), image.height - 1],
  ];
  const color = [0, 0, 0];
  for (const [x, y] of points) {
    const i = (y * image.width + x) * 4;
    color[0] += image.data[i];
    color[1] += image.data[i + 1];
    color[2] += image.data[i + 2];
  }
  return color.map((value) => value / points.length);
}

function colorDistance(image, index, bg) {
  const dr = image.data[index] - bg[0];
  const dg = image.data[index + 1] - bg[1];
  const db = image.data[index + 2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function analyzePng(filePath) {
  const image = await readPngRgba(filePath);
  const bg = backgroundColor(image);
  let contentPixels = 0;
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  let lumaSum = 0;
  let lumaSqSum = 0;
  const sampleColors = new Set();

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const luma = lumaAt(image, x, y);
      lumaSum += luma;
      lumaSqSum += luma * luma;
      if ((x + y) % 31 === 0) {
        sampleColors.add(`${image.data[i] >> 4},${image.data[i + 1] >> 4},${image.data[i + 2] >> 4}`);
      }
      if (image.data[i + 3] > 10 && colorDistance(image, i, bg) > 18) {
        contentPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  let edgeSum = 0;
  let edgeSamples = 0;
  for (let y = 1; y < image.height; y += 2) {
    for (let x = 1; x < image.width; x += 2) {
      const center = lumaAt(image, x, y);
      edgeSum += Math.abs(center - lumaAt(image, x - 1, y));
      edgeSum += Math.abs(center - lumaAt(image, x, y - 1));
      edgeSamples += 2;
    }
  }

  const pixelCount = image.width * image.height;
  const meanLuma = lumaSum / pixelCount;
  const lumaVariance = Math.max(0, lumaSqSum / pixelCount - meanLuma * meanLuma);
  const lumaStdDev = Math.sqrt(lumaVariance);
  const contentCoverage = contentPixels / pixelCount;
  const edgeDensity = edgeSamples ? edgeSum / edgeSamples / 255 : 0;
  const blankLike = contentCoverage < 0.002 || lumaStdDev < 2 || edgeDensity < 0.0015;

  return {
    filePath,
    width: image.width,
    height: image.height,
    contentCoverage,
    contentBoundingBox: contentPixels
      ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
    meanLuma,
    lumaStdDev,
    edgeDensity,
    uniqueColorBucketsSampled: sampleColors.size,
    blankLike,
  };
}

function pixelAtNearest(image, x, y, width, height) {
  const sx = Math.min(image.width - 1, Math.max(0, Math.floor((x / width) * image.width)));
  const sy = Math.min(image.height - 1, Math.max(0, Math.floor((y / height) * image.height)));
  return (sy * image.width + sx) * 4;
}

export async function comparePngFiles(actualPath, targetPath, options = {}) {
  const actual = await readPngRgba(actualPath);
  const target = await readPngRgba(targetPath);
  const width = Math.min(256, actual.width, target.width);
  const height = Math.min(256, actual.height, target.height);
  let mse = 0;
  let compared = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ai = pixelAtNearest(actual, x, y, width, height);
      const ti = pixelAtNearest(target, x, y, width, height);
      for (let c = 0; c < 3; c++) {
        const d = actual.data[ai + c] - target.data[ti + c];
        mse += d * d;
        compared += 1;
      }
    }
  }
  const normalizedMse = compared ? mse / compared / (255 * 255) : 1;
  const visualSimilarity = Math.max(0, 1 - normalizedMse);
  const threshold = Number.isFinite(options.threshold) ? options.threshold : 0.62;
  return {
    schemaVersion: 'sketch-to-bim-visual-compare.v0',
    generatedAt: new Date().toISOString(),
    actualPath,
    targetPath,
    width,
    height,
    normalizedMse,
    visualSimilarity,
    threshold,
    thresholdPassed: visualSimilarity >= threshold,
  };
}

function targetForCapture(capture, targetMap, targetImagePath) {
  if (!targetMap) return targetImagePath ?? null;
  const targets = isObject(targetMap.targets) ? targetMap.targets : targetMap;
  const direct = targets[capture.viewId] ?? targets[capture.purpose] ?? targets[capture.viewKind];
  if (typeof direct === 'string' && direct.trim()) return direct;
  return targetImagePath ?? null;
}

export async function buildVisualGateReport({
  screenshotManifest,
  targetImagePath = null,
  targetMap = null,
  threshold = 0.62,
} = {}) {
  const captures = [];
  for (const capture of screenshotManifest?.captures ?? []) {
    const row = {
      viewId: capture.viewId,
      viewKind: capture.viewKind,
      purpose: capture.purpose ?? '',
      screenshotPath: capture.screenshotPath ?? null,
      usedViewpointId: capture.usedViewpointId ?? null,
      syntheticViewpoint: Boolean(capture.syntheticViewpoint),
      fallbackFit: Boolean(capture.fallbackFit),
      analysis: null,
      comparison: null,
      status: 'needs_review',
      blockers: [],
      notes: [],
    };

    if (!row.screenshotPath) {
      row.status = 'fail';
      row.blockers.push('missing_screenshot_path');
      captures.push(row);
      continue;
    }

    try {
      row.analysis = await analyzePng(row.screenshotPath);
      if (row.analysis.blankLike) row.blockers.push('blank_or_low_information_screenshot');
    } catch (err) {
      row.blockers.push('screenshot_analysis_failed');
      row.notes.push(err instanceof Error ? err.message : String(err));
    }

    const targetPath = targetForCapture(capture, targetMap, targetImagePath);
    if (targetPath) {
      try {
        row.comparison = await comparePngFiles(row.screenshotPath, targetPath, { threshold });
        if (!row.comparison.thresholdPassed) row.blockers.push('target_visual_similarity_below_threshold');
      } catch (err) {
        row.blockers.push('visual_compare_failed');
        row.notes.push(err instanceof Error ? err.message : String(err));
      }
    } else {
      row.notes.push('No target image supplied; automated gate covers screenshot quality only.');
    }

    if (row.fallbackFit) row.blockers.push('fit_fallback_used_without_saved_or_synthetic_viewpoint');
    if (row.blockers.length) row.status = 'fail';
    else if (!row.comparison) row.status = 'needs_review';
    else row.status = 'pass';
    captures.push(row);
  }

  const summary = {
    captureCount: captures.length,
    passCount: captures.filter((capture) => capture.status === 'pass').length,
    needsReviewCount: captures.filter((capture) => capture.status === 'needs_review').length,
    failCount: captures.filter((capture) => capture.status === 'fail').length,
    blockingFailureCount: captures.reduce((sum, capture) => sum + capture.blockers.length, 0),
  };
  return {
    schemaVersion: 'sketch-to-bim-visual-gate.v0',
    generatedAt: new Date().toISOString(),
    threshold,
    targetImagePath,
    targetMapPath: targetMap?.$path ?? null,
    summary,
    captures,
  };
}

export function applyVisualGateToChecklist(checklist, visualGateReport) {
  const captures = new Map((visualGateReport?.captures ?? []).map((capture) => [capture.viewId, capture]));
  return {
    ...checklist,
    items: (checklist.items ?? []).map((item) => {
      if (!item.viewId) return item;
      const capture = captures.get(item.viewId);
      if (!capture) return item;
      const similarity = capture.comparison
        ? ` similarity=${capture.comparison.visualSimilarity.toFixed(3)}`
        : '';
      const blockers = capture.blockers?.length ? ` blockers=${capture.blockers.join(',')}` : '';
      return {
        ...item,
        status: capture.status,
        screenshotPath: item.screenshotPath ?? capture.screenshotPath,
        notes: [
          item.notes,
          `Visual gate ${capture.status}.${similarity}${blockers}`.trim(),
        ].filter(Boolean).join(' '),
      };
    }),
  };
}

export async function readTargetMap(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (isObject(parsed)) return { ...parsed, $path: path.resolve(filePath) };
  throw new Error(`Target map must be a JSON object: ${filePath}`);
}
