/**
 * Family-formula expression evaluator — FAM-04.
 *
 * Safe recursive-descent parser. Supports the §13.3 numeric grammar
 * plus the conditional / boolean grammar Revit uses for parameter
 * formulas. Booleans are encoded as 1.0 / 0.0 (Revit-compatible).
 *
 * Supported constructs:
 *   - Arithmetic: + - * / mod ** ()
 *   - Comparison: < <= > >= = <>  (return 1.0 or 0.0)
 *   - Functions:  if(cond, a, b), rounddown, roundup, round,
 *                 min, max, abs, sqrt, mod, not, and, or
 *   - Identifiers: bare names referencing the supplied parameter map.
 *
 * Unknown identifiers raise. No global access — all symbols pass
 * through the whitelisted function table or the explicit parameter
 * map. Never use eval / new Function on the input.
 */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'eof' };

const SINGLE_OPS = new Set(['+', '-', '*', '/', '%', '=']);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' });
      i++;
      continue;
    }
    // Multi-char operators first
    if (input.startsWith('**', i)) {
      tokens.push({ kind: 'op', value: '**' });
      i += 2;
      continue;
    }
    if (input.startsWith('<=', i)) {
      tokens.push({ kind: 'op', value: '<=' });
      i += 2;
      continue;
    }
    if (input.startsWith('>=', i)) {
      tokens.push({ kind: 'op', value: '>=' });
      i += 2;
      continue;
    }
    if (input.startsWith('<>', i)) {
      tokens.push({ kind: 'op', value: '<>' });
      i += 2;
      continue;
    }
    if (ch === '<') {
      tokens.push({ kind: 'op', value: '<' });
      i++;
      continue;
    }
    if (ch === '>') {
      tokens.push({ kind: 'op', value: '>' });
      i++;
      continue;
    }
    if (SINGLE_OPS.has(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      let dot = ch === '.';
      while (
        j + 1 < input.length &&
        ((input[j + 1] >= '0' && input[j + 1] <= '9') || (input[j + 1] === '.' && !dot))
      ) {
        j++;
        if (input[j] === '.') dot = true;
      }
      const numStr = input.slice(i, j + 1);
      const value = Number(numStr);
      if (!Number.isFinite(value)) {
        throw new Error(`expressionEvaluator: invalid number "${numStr}"`);
      }
      tokens.push({ kind: 'num', value });
      i = j + 1;
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let j = i;
      while (
        j + 1 < input.length &&
        ((input[j + 1] >= 'a' && input[j + 1] <= 'z') ||
          (input[j + 1] >= 'A' && input[j + 1] <= 'Z') ||
          (input[j + 1] >= '0' && input[j + 1] <= '9') ||
          input[j + 1] === '_')
      ) {
        j++;
      }
      tokens.push({ kind: 'ident', value: input.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    throw new Error(`expressionEvaluator: unexpected character "${ch}" at index ${i}`);
  }
  tokens.push({ kind: 'eof' });
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private params: Record<string, number | boolean>,
  ) {}

  evaluate(): number {
    const value = this.parseComparison();
    if (this.peek().kind !== 'eof') {
      throw new Error('expressionEvaluator: unexpected trailing input');
    }
    return value;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(predicate: (t: Token) => boolean, msg: string): Token {
    const t = this.consume();
    if (!predicate(t)) throw new Error(`expressionEvaluator: ${msg}`);
    return t;
  }

  private parseComparison(): number {
    let left = this.parseAdd();
    const t = this.peek();
    if (t.kind === 'op' && ['<', '<=', '>', '>=', '=', '<>'].includes(t.value)) {
      const op = t.value;
      this.consume();
      const right = this.parseAdd();
      switch (op) {
        case '<':
          return left < right ? 1 : 0;
        case '<=':
          return left <= right ? 1 : 0;
        case '>':
          return left > right ? 1 : 0;
        case '>=':
          return left >= right ? 1 : 0;
        case '=':
          return left === right ? 1 : 0;
        case '<>':
          return left !== right ? 1 : 0;
      }
    }
    return left;
  }

  private parseAdd(): number {
    let left = this.parseMul();
    while (true) {
      const t = this.peek();
      if (t.kind === 'op' && (t.value === '+' || t.value === '-')) {
        this.consume();
        const right = this.parseMul();
        left = t.value === '+' ? left + right : left - right;
      } else {
        return left;
      }
    }
  }

  private parseMul(): number {
    let left = this.parsePow();
    while (true) {
      const t = this.peek();
      if (t.kind === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        this.consume();
        const right = this.parsePow();
        if (t.value === '*') left = left * right;
        else if (t.value === '/') left = left / right;
        else left = left - Math.trunc(left / right) * right; // mod
      } else if (t.kind === 'ident' && t.value.toLowerCase() === 'mod') {
        // bare `mod` infix (Revit spelling)
        this.consume();
        const right = this.parsePow();
        left = left - Math.trunc(left / right) * right;
      } else {
        return left;
      }
    }
  }

  private parsePow(): number {
    const left = this.parseUnary();
    const t = this.peek();
    if (t.kind === 'op' && t.value === '**') {
      this.consume();
      const right = this.parsePow(); // right-assoc
      return Math.pow(left, right);
    }
    return left;
  }

  private parseUnary(): number {
    const t = this.peek();
    if (t.kind === 'op' && t.value === '-') {
      this.consume();
      return -this.parseUnary();
    }
    if (t.kind === 'op' && t.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const t = this.consume();
    if (t.kind === 'num') return t.value;
    if (t.kind === 'lparen') {
      const v = this.parseComparison();
      this.expect((x) => x.kind === 'rparen', 'expected ")"');
      return v;
    }
    if (t.kind === 'ident') {
      const name = t.value;
      if (this.peek().kind === 'lparen') {
        this.consume(); // (
        const args: number[] = [];
        if (this.peek().kind !== 'rparen') {
          args.push(this.parseComparison());
          while (this.peek().kind === 'comma') {
            this.consume();
            args.push(this.parseComparison());
          }
        }
        this.expect((x) => x.kind === 'rparen', 'expected ")" closing function call');
        return callFunction(name, args);
      }
      // Identifier reference: parameters table or constant true/false.
      const lower = name.toLowerCase();
      if (lower === 'true') return 1;
      if (lower === 'false') return 0;
      if (lower === 'pi') return Math.PI;
      if (lower === 'e') return Math.E;
      if (!(name in this.params)) {
        throw new Error(`expressionEvaluator: unknown identifier "${name}"`);
      }
      const v = this.params[name];
      return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
    }
    throw new Error(`expressionEvaluator: unexpected token ${JSON.stringify(t)}`);
  }
}

function callFunction(rawName: string, args: number[]): number {
  const name = rawName.toLowerCase();
  switch (name) {
    case 'if': {
      if (args.length !== 3) throw new Error('if(cond, a, b) needs 3 args');
      return args[0] !== 0 ? args[1] : args[2];
    }
    case 'rounddown': {
      if (args.length !== 1) throw new Error('rounddown(x) needs 1 arg');
      return Math.floor(args[0]);
    }
    case 'roundup': {
      if (args.length !== 1) throw new Error('roundup(x) needs 1 arg');
      return Math.ceil(args[0]);
    }
    case 'round': {
      if (args.length !== 1) throw new Error('round(x) needs 1 arg');
      return Math.round(args[0]);
    }
    case 'min': {
      if (args.length === 0) throw new Error('min needs at least 1 arg');
      return Math.min(...args);
    }
    case 'max': {
      if (args.length === 0) throw new Error('max needs at least 1 arg');
      return Math.max(...args);
    }
    case 'abs': {
      if (args.length !== 1) throw new Error('abs(x) needs 1 arg');
      return Math.abs(args[0]);
    }
    case 'sqrt': {
      if (args.length !== 1) throw new Error('sqrt(x) needs 1 arg');
      return Math.sqrt(args[0]);
    }
    case 'mod': {
      if (args.length !== 2) throw new Error('mod(a,b) needs 2 args');
      return args[0] - Math.trunc(args[0] / args[1]) * args[1];
    }
    case 'not': {
      if (args.length !== 1) throw new Error('not(x) needs 1 arg');
      return args[0] === 0 ? 1 : 0;
    }
    case 'and': {
      if (args.length < 2) throw new Error('and needs at least 2 args');
      return args.every((a) => a !== 0) ? 1 : 0;
    }
    case 'or': {
      if (args.length < 2) throw new Error('or needs at least 2 args');
      return args.some((a) => a !== 0) ? 1 : 0;
    }
    default:
      throw new Error(`expressionEvaluator: unknown function "${rawName}"`);
  }
}

/**
 * Evaluate a family-formula expression with the supplied parameter map.
 *
 * Returns `null` on parse error or when the result is not a finite
 * number — callers surface the failure inline rather than throwing.
 */
export function evaluateFormula(
  raw: string,
  params: Record<string, number | boolean> = {},
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, params);
    const value = parser.evaluate();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Same as :func:`evaluateFormula` but throws the parser error so the
 *  family editor can show "expected `)` at column 12"-style messages. */
export function evaluateFormulaOrThrow(
  raw: string,
  params: Record<string, number | boolean> = {},
): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('empty expression');
  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens, params);
  const value = parser.evaluate();
  if (!Number.isFinite(value)) throw new Error('non-finite result');
  return value;
}

/** Lightweight pre-flight: returns null on success or the error message. */
export function validateFormula(raw: string, knownParams: Iterable<string> = []): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stub: Record<string, number> = {};
  for (const k of knownParams) stub[k] = 0;
  try {
    const tokens = tokenize(trimmed);
    new Parser(tokens, stub).evaluate();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
