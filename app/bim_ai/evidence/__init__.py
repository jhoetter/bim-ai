"""Evidence and parity packs (BRT-33).

Submodules house the evidence/parity packs that used to live directly under
`bim_ai.<module>`. Import them by their full dotted path
(`bim_ai.evidence.<module>`) rather than relying on package-level re-exports —
eagerly re-exporting them here would create circular-import cycles with
`bim_ai.export_gltf` and other parents that themselves import a single
submodule.
"""
