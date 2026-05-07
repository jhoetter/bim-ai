"""SKB-01 — phased build workflow + phase tag on commits.

The agent authors a model in 5-7 phases (matching SKB-12 cookbook):
  massing → skeleton → envelope → openings → interior → detail → documentation

Every command in a bundle carries a `phase` tag. The CLI / engine accept
phase tags as metadata; per-phase dry-run + commit lets the agent abort
the next phase if a validation gate fails.

This module owns:
  - The canonical SKB_PHASES enum + ordering
  - `PhasedBundle` representation (a list of (phase, command) tuples)
  - Helpers to split a bundle by phase, validate ordering, and produce
    per-phase sub-bundles for staged commit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Sequence

from bim_ai.elements import SkbPhaseId


# Canonical phase ordering — agents and validators check this constant.
SKB_PHASES: tuple[SkbPhaseId, ...] = (
    "massing",
    "skeleton",
    "envelope",
    "openings",
    "interior",
    "detail",
    "documentation",
)


def phase_index(phase: SkbPhaseId) -> int:
    """0-based index in the canonical ordering. Raises ValueError if unknown."""
    return SKB_PHASES.index(phase)


def is_phase_known(phase: str) -> bool:
    return phase in SKB_PHASES


@dataclass(frozen=True)
class PhasedCommand:
    """One command tagged with a phase. The command body is opaque (dict)
    so this stays decoupled from the engine command Pydantic models.
    """

    phase: SkbPhaseId
    command: dict[str, Any]


@dataclass(frozen=True)
class PhasedBundle:
    """A bundle of commands tagged with phases. Phases need not be
    monotonic in the source list — `split_by_phase` rebuilds groups."""

    commands: list[PhasedCommand]

    @property
    def size(self) -> int:
        return len(self.commands)

    def by_phase(self) -> dict[SkbPhaseId, list[dict[str, Any]]]:
        """Group commands by phase, preserving original within-phase order."""
        out: dict[SkbPhaseId, list[dict[str, Any]]] = {p: [] for p in SKB_PHASES}
        for pc in self.commands:
            out[pc.phase].append(pc.command)
        return {p: cmds for p, cmds in out.items() if cmds}

    def phases_present(self) -> list[SkbPhaseId]:
        """Phases that have ≥1 command, in canonical order."""
        present = {pc.phase for pc in self.commands}
        return [p for p in SKB_PHASES if p in present]

    def phase_subbundle(self, phase: SkbPhaseId) -> list[dict[str, Any]]:
        """Just the commands tagged with `phase`."""
        return [pc.command for pc in self.commands if pc.phase == phase]

    def staged_subbundles(self) -> list[tuple[SkbPhaseId, list[dict[str, Any]]]]:
        """Returns (phase, commands) pairs in canonical phase order so the
        agent can call `try_commit_bundle` once per phase."""
        grouped = self.by_phase()
        return [(p, grouped[p]) for p in self.phases_present()]


def from_dict_list(rows: Sequence[dict[str, Any]]) -> PhasedBundle:
    """Build a PhasedBundle from a list of dicts each shaped:
    `{"phase": "<phase>", "command": {...}}`. Rejects unknown phases.
    """
    out: list[PhasedCommand] = []
    for i, row in enumerate(rows):
        phase = row.get("phase")
        cmd = row.get("command")
        if phase is None or not is_phase_known(phase):
            raise ValueError(
                f"row {i}: phase {phase!r} is not one of {SKB_PHASES}"
            )
        if not isinstance(cmd, dict):
            raise ValueError(f"row {i}: command must be a dict, got {type(cmd).__name__}")
        out.append(PhasedCommand(phase=phase, command=cmd))
    return PhasedBundle(commands=out)


def from_legacy_bundle(
    commands: Sequence[dict[str, Any]],
    default_phase: SkbPhaseId = "skeleton",
) -> PhasedBundle:
    """Wrap a legacy unphased bundle so it can pass through the staged
    commit pipeline. All commands get `default_phase`. Used during the
    SKB-01 migration before agents emit phased bundles natively.
    """
    return PhasedBundle(
        commands=[PhasedCommand(phase=default_phase, command=cmd) for cmd in commands]
    )


def commit_message_prefix(phase: SkbPhaseId) -> str:
    """Conventional-commit type prefix for a phase commit.

    Mapping:
      massing       → feat(massing)
      skeleton      → feat(skeleton)
      envelope      → feat(envelope)
      openings      → feat(openings)
      interior      → feat(interior)
      detail        → feat(detail)
      documentation → docs(model)
    """
    if phase == "documentation":
        return "docs(model)"
    return f"feat({phase})"


def validate_phase_order(phases_in_commit_order: Iterable[SkbPhaseId]) -> list[str]:
    """Soft check: returns warnings for out-of-order phases.

    The cookbook's order is canonical but not strict — sometimes the
    agent legitimately revisits an earlier phase to correct a finding.
    Returns empty list when the sequence is non-decreasing.
    """
    out: list[str] = []
    seen: list[SkbPhaseId] = []
    for p in phases_in_commit_order:
        if seen:
            if phase_index(p) < phase_index(seen[-1]):
                out.append(
                    f"Phase {p!r} commits after later phase {seen[-1]!r} "
                    f"— intentional revisit, or out-of-order authoring?"
                )
        seen.append(p)
    return out
