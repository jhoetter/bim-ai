"""ARCH-CQ-06 — Pydantic → TypeScript codegen for cmd schemas.

Walks Pydantic ``BaseModel`` subclasses declared in ``app/bim_ai/cmd/*.py``
and emits a single TypeScript interface file at
``packages/web/src/generated/backend-types.ts`` that the web bundle imports.

Selection rule
--------------
Every concrete ``BaseModel`` subclass defined inside ``app.bim_ai.cmd.<module>``
is exported by default. To explicitly opt a model out, set
``__codegen_skip__ = True`` on the class. To explicitly mark a model
exportable from elsewhere, set ``__codegen_export__ = True`` (currently unused
inside ``cmd``; reserved for future scopes).

Field-name convention
---------------------
Pydantic command schemas in this repo use ``populate_by_name=True`` and declare
the wire-form name on each field via ``Field(alias="camelCase")``. The codegen
emits interfaces keyed by the alias when present and falls back to the python
attribute name otherwise. This matches the convention used by the route layer
which serialises with ``model_dump(by_alias=True)``.

Supported type mappings
-----------------------
- ``str`` -> ``string``
- ``int`` / ``float`` -> ``number``
- ``bool`` -> ``boolean``
- ``None`` -> ``null``
- ``Optional[X]`` / ``X | None`` -> ``X | null`` (also marks the field optional)
- ``Literal["a", "b"]`` -> ``'a' | 'b'`` (string + numeric literal mix supported)
- ``list[X]`` / ``tuple[X, ...]`` -> ``X[]``
- ``dict[str, X]`` -> ``Record<string, X>``
- ``dict[str, Any]`` -> ``Record<string, unknown>``
- ``Union[A, B]`` -> ``A | B`` (preserves order, deduplicates ``None``)
- Other Pydantic models -> referenced by class name
- Anything else -> emitted as ``unknown`` with a ``// fallback`` comment.

Recursive / forward references are fine: TypeScript hoists interface
declarations, so we just emit one interface per model in deterministic order.

CI integration
--------------
``scripts/check-backend-types-sync.mjs`` regenerates the file and diffs it
against the committed copy; ``pnpm verify:strict`` invokes that gate.

Usage
-----
    cd app && PYTHONPATH=. uv run python scripts/export_schemas.py
"""

from __future__ import annotations

import importlib
import inspect
import pkgutil
import shutil
import subprocess
import sys
import types as _typesmod
import typing
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Union, get_args, get_origin

from pydantic import BaseModel
from pydantic.fields import FieldInfo

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# This script lives at app/scripts/export_schemas.py.
SCRIPT_PATH = Path(__file__).resolve()
APP_ROOT = SCRIPT_PATH.parent.parent  # repo/app
REPO_ROOT = APP_ROOT.parent  # repo
CMD_PACKAGE = "bim_ai.cmd"
#
# Output path note: the ARCH-CQ-06 brief originally suggested
# ``packages/web/src/generated/backend-types.ts`` because the hand-mirrored
# types were assumed to live in ``packages/web/src/cmd/types.ts``. In this
# repo they actually live in ``packages/core/src/modelContracts.ts``
# (consumed by web + cli + every other package via ``@bim-ai/core``), so the
# generated file lives next to the canonical TS type registry rather than
# inside the web package. This avoids a ``core`` -> ``web`` cross-package
# import that would violate the architecture-boundary gate.
OUTPUT_PATH = REPO_ROOT / "packages" / "core" / "src" / "generated" / "backend-types.ts"

# ---------------------------------------------------------------------------
# Model discovery
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ModelSpec:
    """One Pydantic model selected for export."""

    cls: type[BaseModel]
    module: str
    name: str


def discover_models() -> list[ModelSpec]:
    """Walk ``bim_ai.cmd.*`` and collect concrete ``BaseModel`` subclasses.

    Models are deduplicated by python class identity and returned sorted by
    (module path, class name) so codegen output is deterministic.
    """
    if str(APP_ROOT) not in sys.path:
        sys.path.insert(0, str(APP_ROOT))

    pkg = importlib.import_module(CMD_PACKAGE)
    found: dict[type[BaseModel], ModelSpec] = {}

    # Top-level module __init__ may itself define models.
    _collect_from_module(pkg, found)

    pkg_path = getattr(pkg, "__path__", None)
    if pkg_path is not None:
        for sub in pkgutil.walk_packages(pkg_path, prefix=f"{CMD_PACKAGE}."):
            module = importlib.import_module(sub.name)
            _collect_from_module(module, found)

    return sorted(found.values(), key=lambda spec: (spec.module, spec.name))


def _collect_from_module(
    module: _typesmod.ModuleType, out: dict[type[BaseModel], ModelSpec]
) -> None:
    for _name, cls in inspect.getmembers(module, inspect.isclass):
        if cls is BaseModel:
            continue
        if not issubclass(cls, BaseModel):
            continue
        # Only collect classes that originated in our package — not re-exports.
        if not getattr(cls, "__module__", "").startswith(CMD_PACKAGE):
            continue
        if getattr(cls, "__codegen_skip__", False):
            continue
        if cls in out:
            continue
        out[cls] = ModelSpec(cls=cls, module=cls.__module__, name=cls.__name__)


# ---------------------------------------------------------------------------
# Python annotation -> TypeScript type
# ---------------------------------------------------------------------------


_NoneType = type(None)


def _render_type(annotation: Any, model_names: set[str]) -> str:
    """Render a python annotation as a TypeScript type fragment.

    Falls back to ``unknown`` (with a comment in the caller) for anything not
    explicitly handled, rather than crashing — matches the codegen brief.
    """
    if annotation is Any:
        return "unknown"
    if annotation is _NoneType or annotation is None:
        return "null"
    if annotation is str:
        return "string"
    if annotation is bool:
        return "boolean"
    if annotation in (int, float):
        return "number"

    origin = get_origin(annotation)
    args = get_args(annotation)

    # Literal[...] -> union of literal values
    if origin is Literal:
        return " | ".join(_render_literal_value(a) for a in args)

    # Union / Optional / X | None (PEP 604)
    if origin is Union or origin is _typesmod.UnionType:
        rendered: list[str] = []
        seen: set[str] = set()
        for a in args:
            r = _render_type(a, model_names)
            if r in seen:
                continue
            seen.add(r)
            rendered.append(r)
        return " | ".join(rendered) if rendered else "unknown"

    # list / tuple
    if origin in (list, tuple):
        if not args:
            return "unknown[]"
        # tuple[X, ...] -> X[]; tuple[X, Y] -> [X, Y]
        if origin is tuple:
            if len(args) == 2 and args[1] is Ellipsis:
                return f"{_wrap_for_array(_render_type(args[0], model_names))}[]"
            return "[" + ", ".join(_render_type(a, model_names) for a in args) + "]"
        return f"{_wrap_for_array(_render_type(args[0], model_names))}[]"

    # dict[str, X] -> Record<string, X>
    if origin is dict:
        if len(args) == 2:
            k, v = args
            key_t = "string" if k in (str, Any) else _render_type(k, model_names)
            val_t = _render_type(v, model_names)
            return f"Record<{key_t}, {val_t}>"
        return "Record<string, unknown>"

    # Nested Pydantic model -> reference by class name.
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation.__name__

    # Forward reference / unresolved string — try the model_names set first.
    if isinstance(annotation, str):
        return annotation if annotation in model_names else "unknown"
    if isinstance(annotation, typing.ForwardRef):
        fwd = annotation.__forward_arg__
        return fwd if fwd in model_names else "unknown"

    return "unknown"


def _wrap_for_array(rendered: str) -> str:
    """Parenthesise a type when needed so ``X[]`` parses unambiguously."""
    if any(ch in rendered for ch in (" ", "|", "&")):
        return f"({rendered})"
    return rendered


def _render_literal_value(value: Any) -> str:
    if isinstance(value, str):
        # Use single quotes to match prettier's singleQuote config.
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    return "unknown"


# ---------------------------------------------------------------------------
# Per-model emission
# ---------------------------------------------------------------------------


def _wire_name(field_name: str, info: FieldInfo) -> str:
    alias = getattr(info, "alias", None)
    return alias or field_name


def _is_optional(annotation: Any, info: FieldInfo) -> bool:
    """A field is TS-``?`` iff producers may omit it on the wire.

    Producers may omit a Pydantic field when:
      - the annotation includes ``None`` (``Optional[X]`` / ``X | None``), or
      - the field has a default (literal value or ``default_factory``).

    Both cases mean the wire payload can lack the key and the server / consumer
    will fall back to the documented default. Marking it required on the TS
    side would force every callsite to supply the value explicitly, which
    breaks the producer-side ergonomics that the Pydantic default was
    introduced for.
    """
    origin = get_origin(annotation)
    if origin is Union or origin is _typesmod.UnionType:
        if any(a is _NoneType for a in get_args(annotation)):
            return True

    is_required = getattr(info, "is_required", None)
    if callable(is_required):
        try:
            return not bool(is_required())
        except Exception:
            return False
    return False


def _render_interface(spec: ModelSpec, model_names: set[str]) -> str:
    cls = spec.cls
    doc = (cls.__doc__ or "").strip().splitlines()
    lines: list[str] = []

    if doc:
        lines.append("/**")
        for line in doc:
            stripped = line.rstrip()
            if stripped:
                lines.append(f" * {stripped}")
            else:
                lines.append(" *")
        lines.append(" */")
    lines.append(f"export interface {cls.__name__} {{")

    for field_name, info in cls.model_fields.items():
        wire = _wire_name(field_name, info)
        annotation = info.annotation
        ts_type = _render_type(annotation, model_names)
        optional = _is_optional(annotation, info)
        marker = "?" if optional else ""
        desc = (info.description or "").strip()
        if desc:
            lines.append(f"  /** {desc} */")
        lines.append(f"  {wire}{marker}: {ts_type};")

    lines.append("}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# File assembly + formatting
# ---------------------------------------------------------------------------

HEADER = """// ============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source of truth: app/bim_ai/cmd/*.py (Pydantic models).
// Generator: app/scripts/export_schemas.py (ARCH-CQ-06).
// Regenerate:  cd app && PYTHONPATH=. uv run python scripts/export_schemas.py
//
// CI gate: scripts/check-backend-types-sync.mjs (run by `pnpm verify:strict`)
// regenerates this file and fails the build if the working copy drifts.
// ============================================================================
"""


def render_file(specs: list[ModelSpec]) -> str:
    model_names = {s.name for s in specs}
    blocks = [_render_interface(s, model_names) for s in specs]
    body = "\n\n".join(blocks)
    return HEADER + "\n" + body + "\n"


def _maybe_prettier(path: Path) -> None:
    """Best-effort prettier pass so generated formatting matches the repo style.

    Skipped silently if prettier is not on PATH (e.g. uv-only python lane).
    The CI gate uses `prettier --write` on its check pass too, so this only
    matters for local-run determinism.
    """
    prettier = shutil.which("prettier") or shutil.which("npx")
    if prettier is None:
        return
    try:
        if prettier.endswith("npx"):
            cmd = ["npx", "--yes", "prettier", "--write", str(path)]
        else:
            cmd = [prettier, "--write", str(path)]
        subprocess.run(cmd, cwd=str(REPO_ROOT), check=False, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=60)
    except (OSError, subprocess.SubprocessError):
        pass


def main() -> int:
    specs = discover_models()
    if not specs:
        print("export_schemas: no models found", file=sys.stderr)
        return 1
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_file(specs), encoding="utf-8")
    _maybe_prettier(OUTPUT_PATH)
    rel = OUTPUT_PATH.relative_to(REPO_ROOT)
    print(f"export_schemas: wrote {len(specs)} interface(s) to {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
