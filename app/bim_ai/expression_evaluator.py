"""Family-formula expression evaluator — FAM-04 (Python side).

Mirror of ``packages/web/src/lib/expressionEvaluator.ts``. Safe
recursive-descent parser; never uses ``eval`` / ``exec``. Booleans
are encoded as 1.0 / 0.0 (Revit-compatible).

Supported constructs:
    - Arithmetic:  + - * / ** ()  and ``mod`` / ``%`` for modulo
    - Comparison:  < <= > >= = <>   (return 1.0 or 0.0)
    - Functions:   if(cond, a, b), rounddown, roundup, round,
                   min, max, abs, sqrt, mod, not, and, or
    - Identifiers: bare names referencing the supplied parameter map.

Unknown identifiers raise ``ExpressionError``. No global access.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass


class ExpressionError(ValueError):
    """Raised on parse or evaluation failure."""


_SINGLE_OPS = {"+", "-", "*", "/", "%", "="}


@dataclass(frozen=True)
class _Token:
    kind: str  # 'num', 'ident', 'op', 'lparen', 'rparen', 'comma', 'eof'
    value: str | float | None = None


def _tokenize(source: str) -> list[_Token]:
    tokens: list[_Token] = []
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch.isspace():
            i += 1
            continue
        if ch == "(":
            tokens.append(_Token("lparen"))
            i += 1
            continue
        if ch == ")":
            tokens.append(_Token("rparen"))
            i += 1
            continue
        if ch == ",":
            tokens.append(_Token("comma"))
            i += 1
            continue
        if source.startswith("**", i):
            tokens.append(_Token("op", "**"))
            i += 2
            continue
        if source.startswith("<=", i):
            tokens.append(_Token("op", "<="))
            i += 2
            continue
        if source.startswith(">=", i):
            tokens.append(_Token("op", ">="))
            i += 2
            continue
        if source.startswith("<>", i):
            tokens.append(_Token("op", "<>"))
            i += 2
            continue
        if ch in "<>":
            tokens.append(_Token("op", ch))
            i += 1
            continue
        if ch in _SINGLE_OPS:
            tokens.append(_Token("op", ch))
            i += 1
            continue
        if ch.isdigit() or ch == ".":
            j = i
            saw_dot = ch == "."
            while j + 1 < n and (source[j + 1].isdigit() or (source[j + 1] == "." and not saw_dot)):
                j += 1
                if source[j] == ".":
                    saw_dot = True
            num_str = source[i : j + 1]
            try:
                value = float(num_str)
            except ValueError as exc:
                raise ExpressionError(f"invalid number {num_str!r}") from exc
            if not math.isfinite(value):
                raise ExpressionError(f"non-finite number {num_str!r}")
            tokens.append(_Token("num", value))
            i = j + 1
            continue
        if ch.isalpha() or ch == "_":
            j = i
            while j + 1 < n and (source[j + 1].isalnum() or source[j + 1] == "_"):
                j += 1
            tokens.append(_Token("ident", source[i : j + 1]))
            i = j + 1
            continue
        raise ExpressionError(f"unexpected character {ch!r} at index {i}")
    tokens.append(_Token("eof"))
    return tokens


def _is_truthy(x: float) -> bool:
    return x != 0


def _call_function(name: str, args: list[float]) -> float:
    n = name.lower()
    if n == "if":
        if len(args) != 3:
            raise ExpressionError("if(cond, a, b) needs 3 args")
        return args[1] if _is_truthy(args[0]) else args[2]
    if n == "rounddown":
        if len(args) != 1:
            raise ExpressionError("rounddown(x) needs 1 arg")
        return float(math.floor(args[0]))
    if n == "roundup":
        if len(args) != 1:
            raise ExpressionError("roundup(x) needs 1 arg")
        return float(math.ceil(args[0]))
    if n == "round":
        if len(args) != 1:
            raise ExpressionError("round(x) needs 1 arg")
        # Python's round uses banker's rounding; Revit/JS use half-away-from-zero.
        x = args[0]
        return float(math.floor(x + 0.5)) if x >= 0 else -float(math.floor(-x + 0.5))
    if n == "min":
        if not args:
            raise ExpressionError("min needs at least 1 arg")
        return float(min(args))
    if n == "max":
        if not args:
            raise ExpressionError("max needs at least 1 arg")
        return float(max(args))
    if n == "abs":
        if len(args) != 1:
            raise ExpressionError("abs(x) needs 1 arg")
        return float(abs(args[0]))
    if n == "sqrt":
        if len(args) != 1:
            raise ExpressionError("sqrt(x) needs 1 arg")
        return float(math.sqrt(args[0]))
    if n == "mod":
        if len(args) != 2:
            raise ExpressionError("mod(a, b) needs 2 args")
        a, b = args
        return a - math.trunc(a / b) * b
    if n == "not":
        if len(args) != 1:
            raise ExpressionError("not(x) needs 1 arg")
        return 0.0 if _is_truthy(args[0]) else 1.0
    if n == "and":
        if len(args) < 2:
            raise ExpressionError("and needs at least 2 args")
        return 1.0 if all(_is_truthy(a) for a in args) else 0.0
    if n == "or":
        if len(args) < 2:
            raise ExpressionError("or needs at least 2 args")
        return 1.0 if any(_is_truthy(a) for a in args) else 0.0
    raise ExpressionError(f"unknown function {name!r}")


class _Parser:
    def __init__(self, tokens: list[_Token], params: Mapping[str, float | bool]) -> None:
        self._tokens = tokens
        self._params = params
        self._pos = 0

    def evaluate(self) -> float:
        value = self._comparison()
        if self._peek().kind != "eof":
            raise ExpressionError("unexpected trailing input")
        return value

    def _peek(self) -> _Token:
        return self._tokens[self._pos]

    def _consume(self) -> _Token:
        t = self._tokens[self._pos]
        self._pos += 1
        return t

    def _expect_kind(self, kind: str, msg: str) -> _Token:
        t = self._consume()
        if t.kind != kind:
            raise ExpressionError(msg)
        return t

    def _comparison(self) -> float:
        left = self._add()
        t = self._peek()
        if t.kind == "op" and t.value in ("<", "<=", ">", ">=", "=", "<>"):
            op = t.value
            self._consume()
            right = self._add()
            if op == "<":
                return 1.0 if left < right else 0.0
            if op == "<=":
                return 1.0 if left <= right else 0.0
            if op == ">":
                return 1.0 if left > right else 0.0
            if op == ">=":
                return 1.0 if left >= right else 0.0
            if op == "=":
                return 1.0 if left == right else 0.0
            if op == "<>":
                return 1.0 if left != right else 0.0
        return left

    def _add(self) -> float:
        left = self._mul()
        while True:
            t = self._peek()
            if t.kind == "op" and t.value in ("+", "-"):
                self._consume()
                right = self._mul()
                left = left + right if t.value == "+" else left - right
            else:
                return left

    def _mul(self) -> float:
        left = self._pow()
        while True:
            t = self._peek()
            if t.kind == "op" and t.value in ("*", "/", "%"):
                self._consume()
                right = self._pow()
                if t.value == "*":
                    left = left * right
                elif t.value == "/":
                    left = left / right
                else:
                    left = left - math.trunc(left / right) * right
            elif t.kind == "ident" and isinstance(t.value, str) and t.value.lower() == "mod":
                self._consume()
                right = self._pow()
                left = left - math.trunc(left / right) * right
            else:
                return left

    def _pow(self) -> float:
        left = self._unary()
        t = self._peek()
        if t.kind == "op" and t.value == "**":
            self._consume()
            right = self._pow()  # right-assoc
            return float(math.pow(left, right))
        return left

    def _unary(self) -> float:
        t = self._peek()
        if t.kind == "op" and t.value == "-":
            self._consume()
            return -self._unary()
        if t.kind == "op" and t.value == "+":
            self._consume()
            return self._unary()
        return self._primary()

    def _primary(self) -> float:
        t = self._consume()
        if t.kind == "num":
            assert isinstance(t.value, float)
            return t.value
        if t.kind == "lparen":
            v = self._comparison()
            self._expect_kind("rparen", 'expected ")"')
            return v
        if t.kind == "ident":
            assert isinstance(t.value, str)
            name = t.value
            if self._peek().kind == "lparen":
                self._consume()
                args: list[float] = []
                if self._peek().kind != "rparen":
                    args.append(self._comparison())
                    while self._peek().kind == "comma":
                        self._consume()
                        args.append(self._comparison())
                self._expect_kind("rparen", 'expected ")" closing function call')
                return _call_function(name, args)
            lower = name.lower()
            if lower == "true":
                return 1.0
            if lower == "false":
                return 0.0
            if lower == "pi":
                return math.pi
            if lower == "e":
                return math.e
            if name not in self._params:
                raise ExpressionError(f"unknown identifier {name!r}")
            v = self._params[name]
            if isinstance(v, bool):
                return 1.0 if v else 0.0
            return float(v)
        raise ExpressionError(f"unexpected token {t!r}")


def evaluate_formula(
    raw: str, params: Mapping[str, float | bool] | None = None
) -> float | None:
    """Evaluate a family-formula expression. Returns ``None`` on failure."""
    trimmed = raw.strip()
    if not trimmed:
        return None
    try:
        tokens = _tokenize(trimmed)
        parser = _Parser(tokens, params or {})
        value = parser.evaluate()
        return value if math.isfinite(value) else None
    except ExpressionError:
        return None


def evaluate_formula_or_throw(
    raw: str, params: Mapping[str, float | bool] | None = None
) -> float:
    """Same as :func:`evaluate_formula` but raises ``ExpressionError``."""
    trimmed = raw.strip()
    if not trimmed:
        raise ExpressionError("empty expression")
    tokens = _tokenize(trimmed)
    parser = _Parser(tokens, params or {})
    value = parser.evaluate()
    if not math.isfinite(value):
        raise ExpressionError("non-finite result")
    return value


def validate_formula(raw: str, known_params: Iterable[str] = ()) -> str | None:
    """Pre-flight: returns ``None`` on success or the error message."""
    trimmed = raw.strip()
    if not trimmed:
        return None
    stub: dict[str, float] = {k: 0.0 for k in known_params}
    try:
        tokens = _tokenize(trimmed)
        _Parser(tokens, stub).evaluate()
        return None
    except ExpressionError as exc:
        return str(exc)
