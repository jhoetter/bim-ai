"""API-V3-01 — public surface for the tool registry."""

from bim_ai.api.registry import ToolCatalog, ToolDescriptor, get_catalog, register

__all__ = ["ToolDescriptor", "ToolCatalog", "register", "get_catalog"]
