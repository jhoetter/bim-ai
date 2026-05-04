# Revit parity PRD — locked decisions (§17)

This appendix records **implementation defaults** for [revit-production-parity-ai-agent-prd.md](prd/revit-production-parity-ai-agent-prd.md) open questions. The PRD file is not modified.

| Topic                    | Decision                                                                                                                                                                                                                                       | Rationale                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Regional building code   | **EU residential proxy** — document mm, staircase comfort: tread ≥ 260 mm × riser ≤ 190 mm for _advisory_ checks only; egress not fully enforced in v1.                                                                                        | Unblocks stair validation without claiming legal compliance.                |
| Residential vs cleanroom | **Residential reference house first**; cleanroom class / pressure / interlock metadata supported in schema where present, **IDS fixtures** phased after IFC subset.                                                                            | Matches golden bundle trajectory; avoids blocking core BIM on pharma rules. |
| Titleblock / sheet sizes | First-class layout: **A1 landscape metaphor** (`594×841` mm portrait stored as ×1000 coords in existing `sheet`/`viewportsMm` convention — keep mm paper space); titleblock strings: project name, sheet number, revision, drawn/checked/date. | Aligns R6 stubs with existing `sheet` command shape.                        |
| AI vision automation     | **Assumptions-first** — agent MUST log assumptions JSON before apply; automated screenshot comparison is CI opt-in (`compare` PNG diff tolerances), not silent vision-from-screenshot in core product.                                         | Reduces hallucination risk; PRD §8.2 pipeline preserved.                    |

## Review cadence

Revisit quarterly or when IFC scope expands. RVT bridge remains explicitly out-of-scope until OpenBIF stabilizes ([§16](prd/revit-production-parity-ai-agent-prd.md)).
