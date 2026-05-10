from __future__ import annotations

from typing import Any

from bim_ai.document import Document
from bim_ai.elements import SiteElem
from bim_ai.export_ifc_manifest import document_kernel_export_eligible


def _kernel_site_element_ids_sorted(doc: Document | None) -> list[str]:
    if doc is None:
        return []
    return sorted(eid for eid, e in doc.elements.items() if isinstance(e, SiteElem))


def build_site_exchange_evidence_v0_for_manifest(doc: Document) -> dict[str, Any]:
    """Offline-safe document-only site participation (manifest); independent of STEP."""

    kernel_ids = _kernel_site_element_ids_sorted(doc)
    kn = len(kernel_ids)
    eligible = document_kernel_export_eligible(doc)
    out: dict[str, Any] = {
        "schemaVersion": 0,
        "kernelSiteCount": kn,
        "kernelIfcExportEligible": eligible,
        "joinedKernelSiteIdsExpected": ",".join(kernel_ids) if kn else "",
    }
    if not eligible:
        out["note"] = (
            "kernelExpectedIfcKinds stays empty until wall/slab-floor eligibility is satisfied; "
            "kernel SiteElem counts remain declared here."
        )
    return out


def build_site_exchange_evidence_v0(
    *,
    doc: Document | None,
    model: Any | None = None,
    unavailable_reason: str | None = None,
    ifc_elem_util: Any | None = None,
) -> dict[str, Any]:
    """Kernel site ↔ IFC ``IfcSite`` identity slice for inspectors (WP-X03)."""

    kernel_ids = _kernel_site_element_ids_sorted(doc)
    kn = len(kernel_ids)
    joined_expect = ",".join(kernel_ids)
    base: dict[str, Any] = {
        "schemaVersion": 0,
        "kernelSiteCount": kn,
        "joinedKernelSiteIdsExpected": joined_expect if kn else "",
    }

    if unavailable_reason is not None:
        base["reason"] = unavailable_reason
        base["ifcSiteCount"] = None
        base["identityReferenceJoined"] = None
        base["sitesWithPsetSiteCommonReference"] = None
        base["kernelIdsMatchJoinedReference"] = False
        return base

    if model is None:
        base["ifcSiteCount"] = None
        base["identityReferenceJoined"] = None
        base["sitesWithPsetSiteCommonReference"] = None
        base["kernelIdsMatchJoinedReference"] = None
        return base

    sites_raw = model.by_type("IfcSite") or []
    sites_sorted = sorted(sites_raw, key=lambda s: str(getattr(s, "GlobalId", None) or ""))
    base["ifcSiteCount"] = len(sites_sorted)

    refs_nonempty = 0
    joined_from_ifc = ""
    if ifc_elem_util is not None:
        for si in sites_sorted:
            ps = ifc_elem_util.get_psets(si)
            bucket = ps.get("Pset_SiteCommon") or {}
            ref = bucket.get("Reference")
            if isinstance(ref, str) and ref.strip():
                refs_nonempty += 1
                if not joined_from_ifc:
                    joined_from_ifc = ref.strip()

    base["sitesWithPsetSiteCommonReference"] = refs_nonempty
    base["identityReferenceJoined"] = joined_from_ifc or None

    if kn == 0:
        base["kernelIdsMatchJoinedReference"] = refs_nonempty == 0
    else:
        parsed = sorted(part.strip() for part in joined_from_ifc.split(",") if part.strip())
        base["kernelIdsMatchJoinedReference"] = bool(parsed == kernel_ids and refs_nonempty >= 1)

    return base
