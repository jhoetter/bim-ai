#!/usr/bin/env bash
# WP-A04 CI gate entrypoint — runs all v1 verification gates in fixed order.
# Exit 0: all hard gates passed. Exit 1: one or more hard gates failed.
# Gate 5 (prettier) always surfaces [warn] only; it never fails the run.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

_overall=0

_gate() {
  local label="$1" warn_only="$2"
  shift 2
  if "$@" >/dev/null 2>&1; then
    printf '[ok]   %s\n' "$label"
  else
    if [[ "$warn_only" == "1" ]]; then
      printf '[warn] %s\n' "$label"
    else
      printf '[fail] %s\n' "$label"
      _overall=1
    fi
  fi
}

_gate "ruff"                    0 bash -c "cd '${REPO_ROOT}/app' && .venv/bin/ruff check bim_ai tests"
_gate "pytest"                  0 bash -c "cd '${REPO_ROOT}/app' && .venv/bin/pytest -x"
_gate "typecheck"               0 bash -c "cd '${REPO_ROOT}/packages/web' && pnpm typecheck"
_gate "vitest"                  0 bash -c "cd '${REPO_ROOT}/packages/web' && pnpm exec vitest run"
_gate "prettier"                1 bash -c "cd '${REPO_ROOT}' && pnpm exec prettier --check ."
_gate "evidence-package-probe"  0 "${REPO_ROOT}/app/scripts/ci-evidence-package-probe.sh"

echo ""
if [[ "${_overall}" == "0" ]]; then
  echo "[verdict] all gates passed"
else
  echo "[verdict] one or more gates failed"
fi

exit "${_overall}"
