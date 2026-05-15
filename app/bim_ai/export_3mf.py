"""3MF export for printer-oriented model exchange.

3MF keeps millimeter units and object grouping that STL cannot represent. The
geometry source is the same deterministic print mesh used by STL so category
filters and print profiles behave identically across both formats.
"""

from __future__ import annotations

import html
import zipfile
from collections import defaultdict
from io import BytesIO
from typing import Any

from bim_ai.document import Document
from bim_ai.export_stl import (
    StlExportOptions,
    StlTriangle,
    _bounds_mm,
    _element_counts_by_kind,
    _export_options_manifest,
    _kind_counts,
    document_to_stl_triangles,
    stl_export_options,
)

THREEMF_PACKAGE_CONTENT_TYPE = "model/3mf"
THREEMF_MODEL_PATH = "3D/3dmodel.model"


def _fmt(v: float) -> str:
    if v == 0:
        return "0"
    return f"{v:.9g}"


def _zip_write(zf: zipfile.ZipFile, path: str, body: str) -> None:
    info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    zf.writestr(info, body.encode("utf-8"))


def _object_groups(triangles: list[StlTriangle]) -> list[tuple[tuple[str, str], list[StlTriangle]]]:
    grouped: dict[tuple[str, str], list[StlTriangle]] = defaultdict(list)
    for tri in triangles:
        grouped[(tri.kind, tri.element_id)].append(tri)
    return sorted(grouped.items(), key=lambda item: item[0])


def _mesh_xml_for_triangles(triangles: list[StlTriangle]) -> str:
    vertex_index: dict[tuple[int, int, int], int] = {}
    vertices: list[tuple[float, float, float]] = []
    triangle_indices: list[tuple[int, int, int]] = []

    for tri in triangles:
        tri_ix: list[int] = []
        for vertex in tri.vertices:
            key = (round(vertex[0] * 1000), round(vertex[1] * 1000), round(vertex[2] * 1000))
            ix = vertex_index.get(key)
            if ix is None:
                ix = len(vertices)
                vertex_index[key] = ix
                vertices.append(vertex)
            tri_ix.append(ix)
        triangle_indices.append((tri_ix[0], tri_ix[1], tri_ix[2]))

    lines = ["<mesh>", "<vertices>"]
    for x, y, z in vertices:
        lines.append(f'<vertex x="{_fmt(x)}" y="{_fmt(y)}" z="{_fmt(z)}"/>')
    lines.append("</vertices>")
    lines.append("<triangles>")
    for v1, v2, v3 in triangle_indices:
        lines.append(f'<triangle v1="{v1}" v2="{v2}" v3="{v3}"/>')
    lines.append("</triangles>")
    lines.append("</mesh>")
    return "\n".join(lines)


def document_to_3mf_model_xml(
    doc: Document,
    *,
    options: StlExportOptions | None = None,
) -> str:
    opts = options or stl_export_options()
    triangles = document_to_stl_triangles(doc, options=opts)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
        '<metadata name="Application">BIM AI</metadata>',
        '<metadata name="Title">BIM AI print mesh export</metadata>',
        "<resources>",
    ]

    object_ids: list[int] = []
    for object_id, ((kind, element_id), group) in enumerate(_object_groups(triangles), start=1):
        object_ids.append(object_id)
        safe_name = html.escape(f"{kind}:{element_id}", quote=True)
        lines.append(f'<object id="{object_id}" type="model" name="{safe_name}">')
        lines.append(f'<metadata name="bim-ai-kind">{html.escape(kind)}</metadata>')
        lines.append(f'<metadata name="bim-ai-element-id">{html.escape(element_id)}</metadata>')
        lines.append(_mesh_xml_for_triangles(group))
        lines.append("</object>")

    lines.append("</resources>")
    lines.append("<build>")
    for object_id in object_ids:
        lines.append(f'<item objectid="{object_id}"/>')
    lines.append("</build>")
    lines.append("</model>")
    return "\n".join(lines) + "\n"


def document_to_3mf_bytes(
    doc: Document,
    *,
    options: StlExportOptions | None = None,
) -> bytes:
    model_xml = document_to_3mf_model_xml(doc, options=options)
    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
"""
    rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
"""
    out = BytesIO()
    with zipfile.ZipFile(out, "w") as zf:
        _zip_write(zf, "[Content_Types].xml", content_types)
        _zip_write(zf, "_rels/.rels", rels)
        _zip_write(zf, THREEMF_MODEL_PATH, model_xml)
    return out.getvalue()


def build_3mf_export_manifest(
    doc: Document,
    *,
    options: StlExportOptions | None = None,
) -> dict[str, Any]:
    opts = options or stl_export_options()
    triangles = document_to_stl_triangles(doc, options=opts)
    package = document_to_3mf_bytes(doc, options=opts)
    return {
        "format": "threeMfPrintExportManifest_v1",
        "units": "millimeter",
        "encoding": "3mf_zip",
        "meshSource": "dedicated_print_mesh_v2",
        "exportOptions": _export_options_manifest(opts),
        "packageByteLength": len(package),
        "modelPath": THREEMF_MODEL_PATH,
        "objectCount": len(_object_groups(triangles)),
        "triangleCount": len(triangles),
        "trianglesByKind": _kind_counts(triangles),
        "elementCountsByKind": _element_counts_by_kind(triangles),
        "boundsMm": _bounds_mm(triangles),
        "capabilities": [
            "3MF package stores millimeter units.",
            "Each BIM AI printable element is emitted as a separate 3MF object.",
            "Element kind and element id are carried as object metadata.",
        ],
        "limitations": [
            "This 3MF writer does not yet emit color/material resources.",
            "The mesh is not boolean-unioned into a single shell.",
        ],
    }
