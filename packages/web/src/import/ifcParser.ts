/** §12.1.2 — Pure-TypeScript ISO 10303-21 (IFC STEP) parser. */

export interface IfcRef {
  ref: number;
}

export interface IfcEntity {
  id: number;
  type: string;
  attrs: (string | number | null | IfcRef | IfcRef[])[];
}

// ---------------------------------------------------------------------------
// Tokeniser helpers
// ---------------------------------------------------------------------------

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Parse a single STEP attribute value starting at position `pos` in `line`.
 * Returns [parsedValue, nextPos].
 */
function parseAttr(
  line: string,
  pos: number,
): [string | number | null | IfcRef | IfcRef[], number] {
  // Skip leading whitespace
  while (pos < line.length && (line[pos] === ' ' || line[pos] === '\t')) pos++;

  const ch = line[pos];

  if (ch === undefined) return [null, pos];

  // Null / unset
  if (ch === '$') {
    return [null, pos + 1];
  }

  // Reference #N
  if (ch === '#') {
    let end = pos + 1;
    while (end < line.length && isDigit(line[end]!)) end++;
    const ref: IfcRef = { ref: parseInt(line.slice(pos + 1, end), 10) };
    return [ref, end];
  }

  // List (...)
  if (ch === '(') {
    let cursor = pos + 1;
    const list: IfcRef[] = [];
    while (cursor < line.length && line[cursor] !== ')') {
      while (cursor < line.length && (line[cursor] === ' ' || line[cursor] === ',')) cursor++;
      if (line[cursor] === ')') break;
      if (line[cursor] === '#') {
        let end = cursor + 1;
        while (end < line.length && isDigit(line[end]!)) end++;
        list.push({ ref: parseInt(line.slice(cursor + 1, end), 10) });
        cursor = end;
      } else {
        // Skip non-ref list items (rare in supported entities)
        cursor++;
      }
    }
    return [list, cursor + 1]; // skip ')'
  }

  // String '...'
  if (ch === "'") {
    let end = pos + 1;
    while (end < line.length) {
      if (line[end] === "'") {
        // Check escaped apostrophe ''
        if (line[end + 1] === "'") {
          end += 2;
          continue;
        }
        break;
      }
      end++;
    }
    const raw = line.slice(pos + 1, end).replace(/''/g, "'");
    return [raw, end + 1];
  }

  // Enum .ENUMVALUE.
  if (ch === '.') {
    const end = line.indexOf('.', pos + 1);
    if (end !== -1) {
      const val = line.slice(pos, end + 1);
      return [val, end + 1];
    }
    return [null, pos + 1];
  }

  // Number (integer or float, possibly negative)
  if (ch === '-' || isDigit(ch)) {
    let end = pos + 1;
    while (
      end < line.length &&
      (isDigit(line[end]!) ||
        line[end] === '.' ||
        line[end] === 'E' ||
        line[end] === 'e' ||
        line[end] === '+' ||
        (line[end] === '-' && (line[end - 1] === 'E' || line[end - 1] === 'e')))
    ) {
      end++;
    }
    const numStr = line.slice(pos, end);
    const num =
      numStr.includes('.') || numStr.includes('E') || numStr.includes('e')
        ? parseFloat(numStr)
        : parseInt(numStr, 10);
    return [num, end];
  }

  // Unknown/skip
  return [null, pos + 1];
}

/**
 * Parse the attribute list `(attr1, attr2, ...)` for a STEP entity.
 * `raw` is the content between the outer parentheses.
 */
function parseAttrList(raw: string): (string | number | null | IfcRef | IfcRef[])[] {
  const attrs: (string | number | null | IfcRef | IfcRef[])[] = [];
  let pos = 0;

  while (pos < raw.length) {
    // Skip whitespace and commas between attrs
    while (pos < raw.length && (raw[pos] === ' ' || raw[pos] === '\t' || raw[pos] === ',')) {
      pos++;
    }
    if (pos >= raw.length) break;

    const [val, nextPos] = parseAttr(raw, pos);
    attrs.push(val);
    pos = nextPos;
  }

  return attrs;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw IFC STEP string into a flat entity map.
 * Handles the DATA section; ignores HEADER.
 */
export function parseIfcStep(text: string): Map<number, IfcEntity> {
  const entities = new Map<number, IfcEntity>();

  // Split into lines; handle both \r\n and \n
  const lines = text.split(/\r?\n/);

  let inData = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === 'DATA;') {
      inData = true;
      continue;
    }
    if (line === 'ENDSEC;') {
      inData = false;
      continue;
    }

    if (!inData) continue;
    if (!line.startsWith('#')) continue;

    // Match: #N= TYPENAME(attrs...);
    // Find the '=' sign
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const idStr = line.slice(1, eqIdx).trim();
    const id = parseInt(idStr, 10);
    if (isNaN(id)) continue;

    const rest = line.slice(eqIdx + 1).trim();

    // Find type name and opening paren
    const parenIdx = rest.indexOf('(');
    if (parenIdx === -1) continue;

    const typeName = rest.slice(0, parenIdx).trim().toUpperCase();

    // Find the matching closing paren for the attr list
    // We need to handle nested parens (e.g. list of refs)
    let depth = 0;
    let closeIdx = -1;
    for (let i = parenIdx; i < rest.length; i++) {
      if (rest[i] === '(') depth++;
      else if (rest[i] === ')') {
        depth--;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }

    if (closeIdx === -1) continue;

    const attrRaw = rest.slice(parenIdx + 1, closeIdx);
    const attrs = parseAttrList(attrRaw);

    entities.set(id, { id, type: typeName, attrs });
  }

  return entities;
}
