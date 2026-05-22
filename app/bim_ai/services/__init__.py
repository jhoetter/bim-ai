"""Orchestration services for bim_ai.

This subpackage groups the high-level orchestration modules that coordinate
across the engine, agents, and persistence layers. Modules here are imported
by their fully-qualified path (``bim_ai.services.<name>``) — there are no
eager re-exports at the package level by design (see BRT-30/33/34 lessons on
avoiding import-time fan-out).
"""
