from __future__ import annotations

from typing import Any

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# AGT-V3-06 — External model-call audit export
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="external-model-call-audit-export",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExternalModelCallAuditExportInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ExternalModelCallAuditCsv",
            "type": "string",
            "description": "CSV with jobId, modelId, modelVersion, trainOnInputFlag, timestamp, agentIdentifier.",
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="External model-call audit CSV returned"),
            "error": ExitCode(code=1, meaning="Unexpected error"),
        },
        cliExample="curl /api/v3/ai/audit-log.csv",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/ai/audit-log.csv"),
        sideEffects="none",
        agentSafetyNotes=(
            "AGT-V3-06: v3 has no external AI calls, so this export is header-only. "
            "Future integrations must validate calls through bim_ai.ai_boundary with "
            "trainOnInputFlag=false."
        ),
    )
)


# ---------------------------------------------------------------------------
# Reverse-BIM / existing-building digitization source surfaces
# ---------------------------------------------------------------------------

_CMD_V3_BUNDLE_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "SemanticAuthoringBundle",
    "type": "object",
    "required": ["operation", "commands", "metadata"],
    "properties": {
        "operation": {"type": "string"},
        "commands": {"type": "array", "items": {"type": "object"}},
        "todo": {"type": "array", "items": {"type": "object"}},
        "metadata": {"type": "object"},
    },
}

_GENERIC_JSON_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "StructuredJsonResult",
    "type": "object",
    "properties": {
        "ok": {"type": "boolean"},
        "format": {"type": "string"},
        "summary": {"type": "object"},
        "diagnostics": {"type": "array", "items": {"type": "object"}},
    },
    "additionalProperties": True,
}


for _source_tool in (
    {
        "name": "source.folder_manifest",
        "title": "SourceFolderManifestInput",
        "path": "/api/v3/source/folder-manifest",
        "required": ["rootPath"],
        "properties": {"rootPath": {"type": "string"}, "path": {"type": "string"}},
        "cli": "bim-ai source folder-manifest --root /path/to/source --output json",
        "notes": "Builds an immutable file manifest with hashes and lightweight PDF/image metadata.",
    },
    {
        "name": "source.classify_documents",
        "title": "SourceClassifyDocumentsInput",
        "path": "/api/v3/source/classify-documents",
        "required": ["manifest"],
        "properties": {"manifest": {"type": "object"}, "files": {"type": "array"}},
        "cli": "bim-ai source classify-documents --manifest manifest.json --output json",
        "notes": "Classifies source files/pages by reverse-BIM document role using deterministic heuristics.",
    },
    {
        "name": "source.extract_text",
        "title": "SourcePdfTextInput",
        "path": "/api/v3/source/pdf-text",
        "required": ["sourcePath"],
        "properties": {"sourcePath": {"type": "string"}, "maxPages": {"type": "integer"}},
        "cli": "bim-ai source pdf-text --source plan.pdf --output json",
        "notes": "Extracts native PDF text when pypdf is available; returns diagnostics otherwise.",
    },
    {
        "name": "source.render_pdf_pages",
        "title": "SourceRenderPdfInput",
        "path": "/api/v3/source/render-pdf",
        "required": ["sourcePath"],
        "properties": {
            "sourcePath": {"type": "string"},
            "outputDir": {"type": "string"},
            "dpi": {"type": "integer", "default": 240},
            "firstPage": {"type": "integer"},
            "lastPage": {"type": "integer"},
        },
        "cli": "bim-ai source render-pdf --source plan.pdf --output-dir tmp/pdfs/source-render",
        "notes": "Renders PDF pages via Poppler pdftoppm when available; returns diagnostics otherwise.",
    },
    {
        "name": "source.detect_scale",
        "title": "SourceDetectScaleInput",
        "path": "/api/v3/source/detect-scale",
        "required": ["text"],
        "properties": {"text": {"type": "string"}, "sourceDocumentId": {"type": "string"}},
        "cli": "bim-ai source detect-scale --text 'M 1:100' --output json",
        "notes": "Detects drawing scale and dimension-text candidates from source text.",
    },
    {
        "name": "source.ai_reading_packet",
        "title": "SourceAiReadingPacketInput",
        "path": "/api/v3/source/ai-reading-packet",
        "required": ["manifest"],
        "properties": {
            "manifest": {"type": "object"},
            "classifications": {"type": "object"},
            "renderedPages": {"type": "array", "items": {"type": "object"}},
            "textExtractions": {"type": "array", "items": {"type": "object"}},
        },
        "cli": "bim-ai source ai-reading-packet --manifest manifest.json --rendered rendered.json --output json",
        "notes": "Packages rendered source pages and native text for a multimodal LLM/subagent to read; this is not OCR.",
    },
    {
        "name": "source.ai_visual_trace_packet",
        "title": "SourceAiVisualTracePacketInput",
        "path": "/api/v3/source/ai-visual-trace-packet",
        "required": ["manifest"],
        "properties": {
            "manifest": {"type": "object"},
            "classifications": {"type": "object"},
            "renderedPages": {"type": "array", "items": {"type": "object"}},
            "textExtractions": {"type": "array", "items": {"type": "object"}},
        },
        "cli": "bim-ai source ai-visual-trace-packet --manifest manifest.json --rendered rendered.json --output json",
        "notes": "Packages rendered plans/docs for AI visual tracing into source facts; replaces CV tracing as the primary reverse-BIM source-understanding path.",
    },
    {
        "name": "source.ai_visual_trace_work_order",
        "title": "SourceAiVisualTraceWorkOrderInput",
        "path": "/api/v3/source/ai-visual-trace-work-order",
        "required": ["aiVisualTracePacket"],
        "properties": {
            "aiVisualTracePacket": {"type": "object"},
            "packet": {"type": "object"},
            "projectGoal": {"type": "string"},
        },
        "cli": "bim-ai source ai-visual-trace-work-order --packet source-ai-visual-trace-packet.json --output json",
        "notes": "Splits an AI visual trace packet into reusable source-reading work packages before any MCP modeling.",
    },
    {
        "name": "source.ai_visual_trace_agent_requests",
        "title": "SourceAiVisualTraceAgentRequestsInput",
        "path": "/api/v3/source/ai-visual-trace-agent-requests",
        "required": ["workOrder"],
        "properties": {
            "workOrder": {"type": "object"},
            "aiVisualTraceWorkOrder": {"type": "object"},
            "runId": {"type": "string"},
            "maxNativeTextChars": {"type": "integer"},
        },
        "cli": "bim-ai source ai-visual-trace-agent-requests --work-order work-order.json --output json",
        "notes": "Creates multimodal AI-reader request packets from a visual trace work order; does not call a model or mutate BIM.",
    },
    {
        "name": "source.ai_visual_trace_reader_pass_manifest",
        "title": "SourceAiVisualTraceReaderPassManifestInput",
        "path": "/api/v3/source/ai-visual-trace-reader-pass-manifest",
        "required": ["agentRequests", "workOrder"],
        "properties": {
            "agentRequests": {"type": "object"},
            "aiVisualTraceAgentRequests": {"type": "object"},
            "workOrder": {"type": "object"},
            "aiVisualTraceWorkOrder": {"type": "object"},
            "responses": {"type": "array", "items": {"type": "object"}},
            "readerResponses": {"type": "array", "items": {"type": "object"}},
            "minIndependentReadersForCriticalFacts": {"type": "integer"},
        },
        "cli": "bim-ai source ai-visual-trace-reader-pass-manifest --requests requests.json --work-order work-order.json --output json",
        "notes": "Creates the multimodal-reader dispatch checklist, including first-pass source reading assignments and second independent passes for critical geometry/site facts.",
    },
    {
        "name": "source.prepare_ai_visual_trace_run",
        "title": "SourcePrepareAiVisualTraceRunInput",
        "path": "/api/v3/source/prepare-ai-visual-trace-run",
        "required": ["rootPath", "outputDir"],
        "properties": {
            "rootPath": {"type": "string"},
            "path": {"type": "string"},
            "outputDir": {"type": "string"},
            "runId": {"type": "string"},
            "dpi": {"type": "integer"},
            "maxPagesPerPdf": {"type": "integer"},
        },
        "cli": "bim-ai source prepare-ai-visual-trace-run --root /path/to/source --output-dir tmp/reverse-bim/run",
        "notes": "End-to-end folder preparation: manifest, classify, render PDFs, extract native text, build AI visual trace packet/work order, create reader requests, and write initial blocked loop artifacts.",
    },
    {
        "name": "source.ai_visual_trace_agent_loop",
        "title": "SourceAiVisualTraceAgentLoopInput",
        "path": "/api/v3/source/ai-visual-trace-agent-loop",
        "required": ["workOrder"],
        "properties": {
            "workOrder": {"type": "object"},
            "aiVisualTraceWorkOrder": {"type": "object"},
            "responses": {"type": "array", "items": {"type": "object"}},
            "readerResponses": {"type": "array", "items": {"type": "object"}},
            "readerCommand": {"type": "array", "items": {"type": "string"}},
            "readerTimeoutSeconds": {"type": "integer"},
            "runId": {"type": "string"},
        },
        "cli": "bim-ai source ai-visual-trace-agent-loop --work-order work-order.json --responses responses.json --output json",
        "notes": "Validates multimodal AI-reader responses, optionally dispatches missing packages to an external reader command over JSON stdin/stdout, accepts complete packages, and emits repair requests before MCP authoring.",
    },
    {
        "name": "source.normalize_ai_visual_trace_reader_responses",
        "title": "SourceNormalizeAiVisualTraceReaderResponsesInput",
        "path": "/api/v3/source/normalize-ai-visual-trace-reader-responses",
        "required": ["responses"],
        "properties": {
            "responses": {"type": "array", "items": {"type": "object"}},
            "readerResponses": {"type": "array", "items": {"type": "object"}},
        },
        "cli": "bim-ai source normalize-ai-visual-trace-reader-responses --responses responses.json --output json",
        "notes": "Normalizes flexible AI/subagent visual-reading responses into structured, provenance-preserving source facts that can be validated and mapped to MCP authoring surfaces.",
    },
    {
        "name": "source.reader_consensus",
        "title": "SourceReaderConsensusInput",
        "path": "/api/v3/source/reader-consensus",
        "required": ["responses"],
        "properties": {
            "responses": {"type": "array", "items": {"type": "object"}},
            "readerResponses": {"type": "array", "items": {"type": "object"}},
            "minIndependentReaders": {"type": "integer", "default": 2},
            "readerConsensusDispositions": {"type": "array", "items": {"type": "object"}},
            "consensusDispositions": {"type": "array", "items": {"type": "object"}},
        },
        "cli": "bim-ai source reader-consensus --responses responses.json --output json",
        "notes": "Compares critical source facts across independent AI-reader passes and blocks source handoff on insufficient passes or conflicting values unless an explicit deterministic, source-backed consensus disposition is supplied.",
    },
    {
        "name": "source.validate_ai_facts",
        "title": "SourceValidateAiFactsInput",
        "path": "/api/v3/source/validate-ai-facts",
        "required": ["facts"],
        "properties": {
            "facts": {"type": "array", "items": {"type": "object"}},
        },
        "cli": "bim-ai source validate-ai-facts --facts ai-source-facts.json --output json",
        "notes": "Validates AI-read source facts for required provenance and confidence before reverse-BIM IR ingestion.",
    },
    {
        "name": "source.validate_ai_visual_trace_completeness",
        "title": "SourceValidateAiVisualTraceCompletenessInput",
        "path": "/api/v3/source/validate-ai-visual-trace-completeness",
        "required": ["facts"],
        "properties": {
            "facts": {"type": "array", "items": {"type": "object"}},
            "requiredKinds": {"type": "array", "items": {"type": "string"}},
            "requiredFactKinds": {"type": "array", "items": {"type": "string"}},
        },
        "cli": "bim-ai source validate-ai-visual-trace-completeness --facts ai-source-facts.json --output json",
        "notes": "Validates that AI visual trace facts contain required modelable fields and optional required fact kinds for reverse-BIM authoring, not only generic provenance.",
    },
    {
        "name": "source.extract_facts",
        "title": "SourceExtractFactsInput",
        "path": "/api/v3/source/extract-facts",
        "required": ["classifications"],
        "properties": {
            "classifications": {"type": "object"},
            "textExtractions": {"type": "array", "items": {"type": "object"}},
        },
        "cli": "bim-ai source extract-facts --classifications classifications.json --output json",
        "notes": "Builds a source fact ledger with provenance from classifications and extracted text.",
    },
    {
        "name": "source.rerender_for_legibility",
        "title": "SourceRerenderForLegibilityInput",
        "path": "/api/v3/source/rerender-for-legibility",
        "required": ["outputDir", "targets"],
        "properties": {
            "outputDir": {"type": "string"},
            "targets": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "sourceDocumentId": {"type": "string"},
                        "pages": {"type": "array", "items": {"type": "integer"}},
                        "page": {"type": "integer"},
                    },
                    "required": ["sourceDocumentId"],
                },
            },
            "dpi": {"type": "integer", "default": 300},
        },
        "cli": "bim-ai source rerender-for-legibility --output-dir tmp/reverse-bim/run --targets '[{\"sourceDocumentId\":\"srcdoc-eg\",\"pages\":[1]}]' --dpi 300",
        "notes": "Re-renders specific (sourceDocumentId, page) pairs at a higher DPI when readers flag dimension_legibility conflicts. Overwrites the existing PNGs in source/rendered-pages/<docId>/ and updates source/rendered-pages.json in place. Default DPI is 300; use 360+ for very faint dimension strings.",
    },
    {
        "name": "source.classify_pages_dispatch_plan",
        "title": "SourceClassifyPagesDispatchPlanInput",
        "path": "/api/v3/source/classify-pages/dispatch-plan",
        "required": ["aiVisualTracePacket", "outputDir"],
        "properties": {
            "aiVisualTracePacket": {"type": "object"},
            "outputDir": {"type": "string"},
            "mode": {"type": "string", "enum": ["auto", "all", "none"], "default": "auto"},
            "writeAssignments": {"type": "boolean", "default": True},
        },
        "cli": "bim-ai source classify-pages-dispatch-plan --packet ai-visual-trace-packet.json --output-dir tmp/reverse-bim/run",
        "notes": "Identifies compound or unknown source PDFs that need per-page visual classification before work-order routing, and emits markdown reader assignments under ai-reading/page-classifications/assignments/. Walks an aiVisualTracePacket (so the manifest/classification/rendered-page join is already done). Use when document-level classification under-fits (gamma 'unknown' / beta multi-role single PDF).",
    },
    {
        "name": "source.classify_pages_normalize",
        "title": "SourceClassifyPagesNormalizeInput",
        "path": "/api/v3/source/classify-pages/normalize",
        "required": ["outputDir"],
        "properties": {
            "outputDir": {"type": "string"},
            "aiVisualTracePacket": {"type": "object"},
        },
        "cli": "bim-ai source classify-pages-normalize --output-dir tmp/reverse-bim/run --packet ai-visual-trace-packet.json",
        "notes": "Reads visual page-classification responses under ai-reading/page-classifications/responses/ and (when an aiVisualTracePacket is supplied) merges the per-page roles back into pageClassificationRoles[] on each rendered page. Idempotent: missing responses are not an error.",
    },
):
    register(
        ToolDescriptor(
            name=_source_tool["name"],
            category="transform",
            inputSchema={
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": _source_tool["title"],
                "type": "object",
                "required": _source_tool["required"],
                "properties": _source_tool["properties"],
                "additionalProperties": True,
            },
            outputSchema=_GENERIC_JSON_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Source ingestion result returned"),
                "invalid": ExitCode(code=2, meaning="Invalid source request"),
            },
            cliExample=_source_tool["cli"],
            restEndpoint=RestEndpoint(method="POST", path=_source_tool["path"]),
            sideEffects="none",
            agentSafetyNotes=str(_source_tool["notes"]),
            requiredPermissions=["model:read"],
            schemaRefs=[f"input:{_source_tool['title']}", "output:StructuredJsonResult"],
            exampleRefs=[f"route:{_source_tool['name']}"],
            resourceGroups=["source-ingestion", "reverse-bim", "mcp"],
            uiFeatures=["agent-review", "source-ingestion"],
        )
    )


for _reverse_tool in (
    {
        "name": "reverse_bim.ir_seed",
        "title": "ReverseBimIrSeedInput",
        "path": "/api/v3/reverse-bim/ir/seed",
        "cli": "bim-ai reverse-bim ir-seed --manifest manifest.json --facts facts.json",
        "notes": "Creates a starter ExistingBuildingIR shell from source manifest, classifications, and facts.",
    },
    {
        "name": "reverse_bim.ir_validate",
        "title": "ReverseBimIrValidateInput",
        "path": "/api/v3/reverse-bim/ir/validate",
        "cli": "bim-ai reverse-bim ir-validate --ir existing-building-ir.json",
        "notes": "Validates source provenance, confidence, required collections, and fact status.",
    },
    {
        "name": "reverse_bim.source_coverage",
        "title": "ReverseBimSourceCoverageInput",
        "path": "/api/v3/reverse-bim/source-coverage",
        "cli": "bim-ai reverse-bim source-coverage --ir existing-building-ir.json --model model.json",
        "notes": "Builds a source-fact coverage matrix showing modeled, candidate, conflicting, and deferred facts.",
    },
    {
        "name": "reverse_bim.plan_authoring",
        "title": "ReverseBimPlanAuthoringInput",
        "path": "/api/v3/reverse-bim/plan-authoring",
        "cli": "bim-ai reverse-bim plan-authoring --facts ai-source-facts.json --phase P3",
        "notes": "Maps validated AI-read source facts to first-class MCP authoring tools or required resolver steps.",
    },
    {
        "name": "reverse_bim.mcp_readiness",
        "title": "ReverseBimMcpReadinessInput",
        "path": "/api/v3/reverse-bim/mcp-readiness",
        "cli": "bim-ai reverse-bim mcp-readiness --facts ai-source-facts.json --phase P3",
        "notes": "Classifies normalized source facts as directly MCP-authorable, resolver-needed, source-refinement-needed, metadata/reference, conflict, or missing-tool before live modeling.",
    },
    {
        "name": "reverse_bim.source_material_assemblies",
        "title": "ReverseBimSourceMaterialAssembliesInput",
        "path": "/api/v3/reverse-bim/source-material-assemblies",
        "cli": "bim-ai reverse-bim source-material-assemblies --facts ai-source-facts.json",
        "notes": "Builds wall/floor/roof material and layer-stack readiness from source facts; blocks generic type authoring unless assemblies are captured or explicitly source-unavailable.",
    },
    {
        "name": "reverse_bim.source_building_scope",
        "title": "ReverseBimSourceBuildingScopeInput",
        "path": "/api/v3/reverse-bim/source-building-scope",
        "cli": "bim-ai reverse-bim source-building-scope --facts ai-source-facts.json --scope-decisions decisions.json",
        "notes": "Checks whether source facts resolve the authoring target as whole building, Doppelhaus, target half, unit, or context-only geometry before MCP modeling; optional source-backed scope decisions can resolve document ambiguity while still requiring masks for half/unit targets.",
    },
    {
        "name": "reverse_bim.source_level_completeness",
        "title": "ReverseBimSourceLevelCompletenessInput",
        "path": "/api/v3/reverse-bim/source-level-completeness",
        "cli": "bim-ai reverse-bim source-level-completeness --facts ai-source-facts.json",
        "notes": "Checks that every source-required level/storey has physical wall, floor, room, opening, or stair facts before MCP authoring.",
    },
    {
        "name": "reverse_bim.coordinate_frame_worklist",
        "title": "ReverseBimCoordinateFrameWorklistInput",
        "path": "/api/v3/reverse-bim/coordinate-frame-worklist",
        "cli": "bim-ai reverse-bim coordinate-frame-worklist --coordinate-frames coordinate-frames.json --facts facts.json",
        "notes": "Lists page-to-model coordinate frames that must be aligned before geometry facts from plans, sections, elevations, or site documents can drive authoring.",
    },
    {
        "name": "reverse_bim.coordinate_frame_alignment",
        "title": "ReverseBimCoordinateFrameAlignmentInput",
        "path": "/api/v3/reverse-bim/coordinate-frame-alignment",
        "cli": "bim-ai reverse-bim coordinate-frame-alignment --coordinate-frames coordinate-frames.json --alignments alignments.json",
        "notes": "Applies accepted source-page coordinate-frame alignments and reports remaining blocking missing/invalid frame alignments.",
    },
    {
        "name": "reverse_bim.document_authority",
        "title": "ReverseBimDocumentAuthorityInput",
        "path": "/api/v3/reverse-bim/document-authority",
        "cli": "bim-ai reverse-bim document-authority --manifest manifest.json --classifications classifications.json",
        "notes": "Ranks and groups source documents by role/scope, marks superseded or duplicate drawings, and blocks critical document groups with unresolved authority before source facts drive MCP authoring.",
    },
    {
        "name": "reverse_bim.folder_output",
        "title": "ReverseBimFolderOutputInput",
        "path": "/api/v3/reverse-bim/folder-output",
        "cli": "bim-ai reverse-bim folder-output --root /path/to/source --output-dir tmp/reverse-bim/run",
        "notes": "Builds the folder-output handoff package from a source folder plus optional AI-reader responses and source-backed consensus/scope dispositions, including source registry, normalized facts, completeness, MCP readiness, resolver worklist, phase authoring spec, prioritized source repair plan, and package acceptance.",
    },
    {
        "name": "reverse_bim.reader_dispatch_plan",
        "title": "ReverseBimReaderDispatchPlanInput",
        "path": "/api/v3/reverse-bim/reader-dispatch-plan",
        "cli": "bim-ai reverse-bim reader-dispatch-plan --output-dir tmp/reverse-bim/run",
        "notes": "Builds an assignment-level dispatch plan from a folder-output package so open multimodal reader assignments can be routed without hand-copying prompts.",
    },
    {
        "name": "reverse_bim.reader_dispatch_execute",
        "title": "ReverseBimReaderDispatchExecuteInput",
        "path": "/api/v3/reverse-bim/reader-dispatch-execute",
        "cli": "bim-ai reverse-bim reader-dispatch-execute --output-dir tmp/reverse-bim/run --reader-command ./reader",
        "notes": "Executes open reader assignments through a configured reader command and writes structured response JSON files under ai-reading/responses for the next folder-output run.",
    },
    {
        "name": "reverse_bim.phase_packet",
        "title": "ReverseBimPhasePacketInput",
        "path": "/api/v3/reverse-bim/phase-packet",
        "cli": "bim-ai reverse-bim phase-packet --phase P1 --advisor advisor.json",
        "notes": "Aggregates per-phase transactions, source facts, QA payloads, and finding dispositions.",
    },
    {
        "name": "reverse_bim.phase_run",
        "title": "ReverseBimPhaseRunInput",
        "path": "/api/v3/reverse-bim/phase-run",
        "cli": "bim-ai reverse-bim phase-run --phase-spec phase-authoring-spec.json --packets phase-packets.json",
        "notes": "Checks that source-bearing reverse-BIM phases have accepted phase packets and prevents skipping earlier blocked phases.",
    },
    {
        "name": "reverse_bim.readback_compare",
        "title": "ReverseBimReadbackCompareInput",
        "path": "/api/v3/reverse-bim/readback-compare",
        "cli": "bim-ai reverse-bim readback-compare --expected expected-readback.json --elements query-elements.json",
        "notes": "Compares expected source-derived authoring readback with live model query/readback evidence before a slice can be accepted.",
    },
    {
        "name": "reverse_bim.source_spec_revision",
        "title": "ReverseBimSourceSpecRevisionInput",
        "path": "/api/v3/reverse-bim/source-spec-revision",
        "cli": "bim-ai reverse-bim source-spec-revision --readback readback-comparison.json --overlay source-overlay.json",
        "notes": "Classifies modeling feedback into source fact repair, coordinate-frame repair, model repair, tool gap, or source-backed existing-condition disposition.",
    },
    {
        "name": "reverse_bim.source_revision_ledger",
        "title": "ReverseBimSourceRevisionLedgerInput",
        "path": "/api/v3/reverse-bim/source-revision-ledger",
        "cli": "bim-ai reverse-bim source-revision-ledger --source-spec-revision source-spec-revision.json --facts facts.json",
        "notes": "Turns source-spec revision actions into a persistent-style repair ledger with reopened fact updates and affected modeling slices.",
    },
    {
        "name": "reverse_bim.source_revision_ledger_persist",
        "title": "ReverseBimSourceRevisionLedgerPersistInput",
        "path": "/api/v3/reverse-bim/source-revision-ledger-persist",
        "cli": "bim-ai reverse-bim source-revision-ledger-persist --output-dir folder-output --ledger source-revision-ledger.json",
        "notes": "Persists and merges the source revision ledger under validation/source-revision-ledger.json and appends a resumable history record for future agents.",
    },
    {
        "name": "reverse_bim.handoff_regeneration",
        "title": "ReverseBimHandoffRegenerationInput",
        "path": "/api/v3/reverse-bim/handoff-regeneration",
        "cli": "bim-ai reverse-bim handoff-regeneration --source-revision-ledger source-revision-ledger.json --facts facts.json --phase-spec phase-authoring-spec.json",
        "notes": "Builds bounded regenerated MCP handoff rows, expected readback, and reader repair requests for only the slices affected by source/model repair findings.",
    },
    {
        "name": "reverse_bim.hybrid_slice",
        "title": "HybridReverseBimSliceInput",
        "path": "/api/v3/reverse-bim/hybrid-slice",
        "cli": "bim-ai reverse-bim hybrid-slice --phase phase.json --readback readback.json --packet phase-packet.json",
        "notes": "Reports the current state of a hybrid modeling slice: source-blocked, MCP-ready, readback-blocked, source-revision-required, QA-blocked, visual-blocked, or accepted.",
    },
    {
        "name": "reverse_bim.hybrid_slice_execute",
        "title": "HybridReverseBimSliceExecuteInput",
        "path": "/api/v3/models/{model_id}/reverse-bim/hybrid-slice-execute",
        "cli": "bim-ai reverse-bim hybrid-slice-execute --model-id <id> --bundle bundle.json --phase phase.json",
        "notes": "Executes one live reverse-BIM slice through model.dry_run/model.commit_bundle, then queries readback, Advisor, constructability, integrity, source-spec revision, phase/slice gates, and persists the source-revision ledger when outputDir is supplied. When evidenceRequirements/sourcePageIndex plus outputDir are provided, it also emits a deterministic viewCapturePlan and blocks acceptance until required UI/overlay evidence is supplied.",
    },
    {
        "name": "reverse_bim.hybrid_run",
        "title": "HybridReverseBimRunInput",
        "path": "/api/v3/reverse-bim/hybrid-run",
        "cli": "bim-ai reverse-bim hybrid-run --phase-spec phase-authoring-spec.json --packets phase-packets.json",
        "notes": "Aggregates package state, phase packets, and slice states so an agent can continue the hybrid reverse-BIM run without guessing.",
    },
    {
        "name": "reverse_bim.hybrid_run_execute",
        "title": "HybridReverseBimRunExecuteInput",
        "path": "/api/v3/models/{model_id}/reverse-bim/hybrid-run-execute",
        "cli": "bim-ai reverse-bim hybrid-run-execute --model-id <id> --slices slices.json",
        "notes": "Executes ordered live reverse-BIM slices through the single-slice executor, stops on the first unresolved source/readback/QA/visual blocker, and returns handoffRegeneration for the latest source-revision ledger.",
    },
    {
        "name": "reverse_bim.evidence_requirements",
        "title": "ReverseBimEvidenceRequirementsInput",
        "path": "/api/v3/reverse-bim/evidence-requirements",
        "cli": "bim-ai reverse-bim evidence-requirements --source-page-index source-page-index.json --phase-spec phase-authoring-spec.json",
        "notes": "Derives required source overlay views and UI screenshot/checklist views from source pages, facts, and the phase authoring spec.",
    },
    {
        "name": "reverse_bim.view_capture_plan",
        "title": "ReverseBimViewCapturePlanInput",
        "path": "/api/v3/reverse-bim/view-capture-plan",
        "cli": "bim-ai reverse-bim view-capture-plan --evidence-requirements evidence-requirements.json --model-id <id>",
        "notes": "Creates a deterministic browser/Playwright screenshot work order for source-equivalent plan/elevation/section/site/3D views before UI and overlay evidence gates run.",
    },
    {
        "name": "reverse_bim.view_capture_execute",
        "title": "ReverseBimViewCaptureExecuteInput",
        "path": "/api/v3/reverse-bim/view-capture-execute",
        "cli": "pnpm --filter @bim-ai/web reverse-bim:capture -- --plan view-capture-plan.json --out folder-output/evidence/reverse-bim --json",
        "notes": "Returns the deterministic Chromium runner command for a reverseBimViewCapturePlan_v1. The runner writes PNG screenshots and emits a manifest whose UI checklist and overlay metrics remain pending until AI review/measurement.",
    },
    {
        "name": "reverse_bim.visual_review_requests",
        "title": "ReverseBimVisualReviewRequestsInput",
        "path": "/api/v3/reverse-bim/visual-review-requests",
        "cli": "bim-ai reverse-bim visual-review-requests --capture-run capture-manifest.json --source-context source-context.json",
        "notes": "Builds provider-neutral multimodal AI review requests from captured BIM screenshots so plan/3D UI checklist and source overlay metrics are reviewed consistently.",
    },
    {
        "name": "reverse_bim.visual_review_normalize",
        "title": "ReverseBimVisualReviewNormalizeInput",
        "path": "/api/v3/reverse-bim/visual-review-normalize",
        "cli": "bim-ai reverse-bim visual-review-normalize --capture-run capture-manifest.json --requests visual-review-requests.json --responses visual-review-responses.json",
        "notes": "Normalizes AI visual review responses into uiEvidenceRows and overlayEvidenceRows for the strict reverse-BIM evidence gates.",
    },
    {
        "name": "reverse_bim.level_completeness",
        "title": "ReverseBimLevelCompletenessInput",
        "path": "/api/v3/reverse-bim/level-completeness",
        "cli": "bim-ai reverse-bim level-completeness --facts source-facts.json --model-summary model-summary.json",
        "notes": "Checks that every source-required storey/level has real physical model content; empty KG-like levels block final acceptance.",
    },
    {
        "name": "reverse_bim.physical_topology",
        "title": "ReverseBimPhysicalTopologyInput",
        "path": "/api/v3/reverse-bim/physical-topology",
        "cli": "bim-ai reverse-bim physical-topology --room-boundary-edges room-boundary-edges.json --advisor advisor.json",
        "notes": "Checks physical room/opening/stair topology so analytical room graphs cannot substitute for real walls, hosted openings, and collision-free vertical circulation.",
    },
    {
        "name": "reverse_bim.source_overlay_evidence",
        "title": "ReverseBimSourceOverlayEvidenceInput",
        "path": "/api/v3/reverse-bim/source-overlay-evidence",
        "cli": "bim-ai reverse-bim source-overlay-evidence --required-views required-views.json --overlays overlays.json",
        "notes": "Validates source/model overlay evidence for required floor plans, sections, elevations, and site views before final acceptance.",
    },
    {
        "name": "reverse_bim.ui_evidence",
        "title": "ReverseBimUiEvidenceInput",
        "path": "/api/v3/reverse-bim/ui-evidence",
        "cli": "bim-ai reverse-bim ui-evidence --required-views required-views.json --screenshots screenshots.json",
        "notes": "Validates human-inspectable live UI screenshot evidence plus per-view visual checklist items so failures visible in the UI cannot pass JSON-only acceptance.",
    },
    {
        "name": "reverse_bim.final_acceptance",
        "title": "ReverseBimFinalAcceptanceInput",
        "path": "/api/v3/reverse-bim/final-acceptance",
        "cli": "bim-ai reverse-bim final-acceptance --model model.json --advisor advisor.json --overlay source-overlay.json",
        "notes": "Runs the strict post-target-house-3 final gate: Advisor/constructability warnings block by default, and level completeness, physical topology, source-overlay, and UI evidence reports are required.",
    },
):
    register(
        ToolDescriptor(
            name=_reverse_tool["name"],
            category="transform",
            inputSchema={
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": _reverse_tool["title"],
                "type": "object",
                "additionalProperties": True,
            },
            outputSchema=_GENERIC_JSON_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Reverse-BIM result returned"),
                "blocked": ExitCode(code=5, meaning="Reverse-BIM blockers remain"),
            },
            cliExample=_reverse_tool["cli"],
            restEndpoint=RestEndpoint(method="POST", path=_reverse_tool["path"]),
            sideEffects="none",
            agentSafetyNotes=str(_reverse_tool["notes"]),
            requiredPermissions=["model:read"],
            schemaRefs=[f"input:{_reverse_tool['title']}", "output:StructuredJsonResult"],
            exampleRefs=[f"route:{_reverse_tool['name']}"],
            resourceGroups=["reverse-bim", "existing-building", "source-ingestion", "mcp"],
            uiFeatures=["agent-review", "reverse-bim"],
        )
    )


for _reverse_qa_tool in (
    {
        "name": "qa.level_completeness",
        "title": "QaLevelCompletenessInput",
        "path": "/api/v3/qa/level-completeness",
        "cli": "bim-ai qa level-completeness --facts source-facts.json --model-summary model-summary.json",
        "notes": "Reverse-BIM QA gate that fails empty source-required levels such as an unmodeled KG.",
    },
    {
        "name": "qa.physical_topology",
        "title": "QaPhysicalTopologyInput",
        "path": "/api/v3/qa/physical-topology",
        "cli": "bim-ai qa physical-topology --room-boundary-edges room-boundary-edges.json --advisor advisor.json",
        "notes": "Reverse-BIM QA gate for physical room/opening/stair topology; analytical room graphs alone are insufficient.",
    },
    {
        "name": "qa.source_overlay_compare",
        "title": "QaSourceOverlayCompareInput",
        "path": "/api/v3/qa/source-overlay-compare",
        "cli": "bim-ai qa source-overlay-compare --required-views required-views.json --overlays overlays.json",
        "notes": "Reverse-BIM QA gate for source/model overlay evidence and deviation thresholds.",
    },
):
    register(
        ToolDescriptor(
            name=_reverse_qa_tool["name"],
            category="transform",
            inputSchema={
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": _reverse_qa_tool["title"],
                "type": "object",
                "additionalProperties": True,
            },
            outputSchema=_GENERIC_JSON_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Reverse-BIM QA result returned"),
                "blocked": ExitCode(code=5, meaning="Reverse-BIM QA blockers remain"),
            },
            cliExample=_reverse_qa_tool["cli"],
            restEndpoint=RestEndpoint(method="POST", path=_reverse_qa_tool["path"]),
            sideEffects="none",
            agentSafetyNotes=str(_reverse_qa_tool["notes"]),
            requiredPermissions=["model:read"],
            schemaRefs=[f"input:{_reverse_qa_tool['title']}", "output:StructuredJsonResult"],
            exampleRefs=[f"route:{_reverse_qa_tool['name']}"],
            resourceGroups=["reverse-bim", "existing-building", "qa", "mcp"],
            uiFeatures=["agent-review", "reverse-bim", "advisor-panel"],
        )
    )


for _semantic_arch_tool in (
    {
        "name": "author.level",
        "kernel": ["createLevel"],
        "title": "AuthorLevelInput",
        "notes": "Generates a typed createLevel bundle for source-derived storey datums.",
    },
    {
        "name": "author.wall",
        "kernel": ["createWall"],
        "title": "AuthorWallInput",
        "notes": "Generates a typed createWall bundle. Use model.dry_run then model.commit_bundle.",
    },
    {
        "name": "author.wall_chain",
        "kernel": ["createWallChain"],
        "title": "AuthorWallChainInput",
        "notes": "Generates a typed createWallChain bundle for source-derived wall graphs.",
    },
    {
        "name": "author.floor_from_boundary",
        "kernel": ["createFloor"],
        "title": "AuthorFloorFromBoundaryInput",
        "notes": "Generates a typed createFloor bundle from an explicit boundary.",
    },
    {
        "name": "author.floor_supports",
        "kernel": ["updateElementProperty"],
        "title": "AuthorFloorSupportsInput",
        "notes": "Generates a typed floor support metadata update from resolved bearing/support ids.",
    },
    {
        "name": "author.room_outline",
        "kernel": ["createRoomOutline"],
        "title": "AuthorRoomOutlineInput",
        "notes": "Generates a typed room outline bundle for source area reconciliation.",
    },
    {
        "name": "author.room_separation",
        "kernel": ["createRoomSeparation"],
        "title": "AuthorRoomSeparationInput",
        "notes": "Generates a typed room separation line for explicit source-derived room topology.",
    },
    {
        "name": "author.roof_from_boundary",
        "kernel": ["createRoof"],
        "title": "AuthorRoofFromBoundaryInput",
        "notes": "Generates a typed createRoof bundle from an explicit source-derived boundary.",
    },
    {
        "name": "author.dormer_on_roof",
        "kernel": ["createDormer"],
        "title": "AuthorDormerOnRoofInput",
        "notes": "Generates a typed createDormer bundle; resolve host roof and roof-local position before calling.",
    },
    {
        "name": "opening.door_on_wall",
        "kernel": ["insertDoorOnWall"],
        "title": "OpeningDoorOnWallInput",
        "notes": "Generates a typed insertDoorOnWall bundle; resolve host wall before calling.",
    },
    {
        "name": "opening.window_on_wall",
        "kernel": ["insertWindowOnWall"],
        "title": "OpeningWindowOnWallInput",
        "notes": "Generates a typed insertWindowOnWall bundle; resolve host wall before calling.",
    },
    {
        "name": "opening.roof_opening",
        "kernel": ["createRoofOpening"],
        "title": "OpeningRoofOpeningInput",
        "notes": "Generates a typed createRoofOpening bundle; resolve host roof before calling.",
    },
):
    register(
        ToolDescriptor(
            name=_semantic_arch_tool["name"],
            category="mutation",
            inputSchema={
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": _semantic_arch_tool["title"],
                "type": "object",
                "additionalProperties": True,
            },
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Typed semantic authoring bundle generated"),
                "invalid": ExitCode(code=422, meaning="Invalid semantic authoring payload"),
            },
            cliExample=f"bim-ai {_semantic_arch_tool['name'].replace('.', ' ')} --json",
            restEndpoint=RestEndpoint(method="POST", path="/api/semantic-authoring/{surface_id}"),
            sideEffects="mutates-kernel",
            agentSafetyNotes=str(_semantic_arch_tool["notes"]),
            schemaRefs=[f"input:{_semantic_arch_tool['title']}", "output:SemanticAuthoringBundle"],
            exampleRefs=[f"route:{_semantic_arch_tool['name']}"],
            kernelCommands=list(_semantic_arch_tool["kernel"]),
            resourceGroups=[
                "semantic-authoring",
                "architecture",
                "reverse-bim",
                "kernel-command",
            ],
            uiFeatures=["cmd-k:agent-equivalent", "reverse-bim"],
        )
    )


# ---------------------------------------------------------------------------
# TH-UI-005 — Reverse-BIM source-derived view authoring surfaces
#
# These descriptors give agents and humans a single, source-aware way to author
# the source-derived views the testhouse hybrid reverse-BIM tracker requires
# (exterior elevations, architectural details, and source-equivalent section
# cuts), each carrying source-document / page / region provenance and an
# intended comparison type so the per-row evidence badge in the project browser
# can show acceptance progress.
#
# The view-creation tools wrap the existing kernel commands
# (`createElevationView`, `upsertPlanView` with `planViewSubtype='callout'`,
# `createSectionCut`). The companion `reverse_bim.source_view_evidence_upsert`
# tool documents the evidence-record surface; the persistent backing element
# kind (`source_view_evidence`) is tracked as follow-up in
# `spec/testhouse-hybrid-reverse-bim-tracker.md` finding `TH-X-F006`.
# ---------------------------------------------------------------------------


for _th_ui_view_tool in (
    {
        "name": "reverse_bim.exterior_view_create",
        "title": "ReverseBimExteriorViewCreateInput",
        "path": "/api/v3/reverse-bim/exterior-view-create",
        "kernel": ["createElevationView"],
        "cli": (
            "bim-ai reverse-bim exterior-view-create --name 'Berg-Ansicht' "
            "--direction north --source-document srcdoc-... --source-page 1 --comparison overlay"
        ),
        "notes": (
            "TH-UI-001/005 — generate a typed createElevationView bundle for a source-"
            "derived exterior view. The view sits in the Exterior Views sidebar group "
            "(distinct from sections) and accepts optional source provenance "
            "(sourceDocumentId, page, region, comparisonType) that the evidence pill "
            "renders in the project browser."
        ),
    },
    {
        "name": "reverse_bim.detail_view_create",
        "title": "ReverseBimDetailViewCreateInput",
        "path": "/api/v3/reverse-bim/detail-view-create",
        "kernel": ["upsertPlanView"],
        "cli": (
            "bim-ai reverse-bim detail-view-create --name 'Eave detail south' "
            "--parent-view-id pv-... --scale 20 --source-document srcdoc-... --source-page 9"
        ),
        "notes": (
            "TH-UI-002/005 — generate a typed upsertPlanView bundle with "
            "planViewSubtype='callout' for an architectural detail/callout view (eave, "
            "ridge, dormer, balcony/guard, stair, wall/floor/roof assembly, foundation, "
            "drainage interface, facade opening). Detail views sit in the dedicated "
            "Detail Views sidebar group."
        ),
    },
    {
        "name": "reverse_bim.section_view_create",
        "title": "ReverseBimSectionViewCreateInput",
        "path": "/api/v3/reverse-bim/section-view-create",
        "kernel": ["createSectionCut"],
        "cli": (
            "bim-ai reverse-bim section-view-create --name 'Querschnitt A-A' "
            "--start 0,0 --end 0,10000 --source-document srcdoc-... --source-page 1"
        ),
        "notes": (
            "TH-UI-003/005 — generate a typed createSectionCut bundle. Section cuts are "
            "explicitly distinct from exterior views; opening one creates a cut plane. "
            "Optional source provenance feeds the section evidence pill."
        ),
    },
    {
        "name": "reverse_bim.source_view_evidence_upsert",
        "title": "ReverseBimSourceViewEvidenceUpsertInput",
        "path": "/api/v3/reverse-bim/source-view-evidence-upsert",
        "kernel": ["upsertSourceViewEvidence"],
        "cli": (
            "bim-ai reverse-bim source-view-evidence-upsert --view-id ev-... "
            "--category exterior --source-document srcdoc-... --source-page 1 "
            "--status overlay_compared --screenshot path.png --overlay overlay.png"
        ),
        "notes": (
            "TH-UI-004/005 — upsert the source-view-evidence record attached to a "
            "section_cut / elevation_view / detail (callout plan_view). Status values: "
            "missing_source_link, source_linked, screenshot_captured, overlay_compared, "
            "findings_open, accepted. Schema/kernel backing is tracked as follow-up; "
            "until then the project-browser pill derives state from view name hints."
        ),
    },
):
    register(
        ToolDescriptor(
            name=_th_ui_view_tool["name"],
            category="mutation",
            inputSchema={
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": _th_ui_view_tool["title"],
                "type": "object",
                "additionalProperties": True,
            },
            outputSchema=_CMD_V3_BUNDLE_OUTPUT_SCHEMA,
            exitCodes={
                "ok": ExitCode(code=0, meaning="Typed source-derived view bundle generated"),
                "invalid": ExitCode(
                    code=422, meaning="Invalid source-derived view authoring payload"
                ),
            },
            cliExample=str(_th_ui_view_tool["cli"]),
            restEndpoint=RestEndpoint(method="POST", path=str(_th_ui_view_tool["path"])),
            sideEffects="mutates-kernel",
            agentSafetyNotes=str(_th_ui_view_tool["notes"]),
            schemaRefs=[
                f"input:{_th_ui_view_tool['title']}",
                "output:SemanticAuthoringBundle",
            ],
            exampleRefs=[f"route:{_th_ui_view_tool['name']}"],
            kernelCommands=list(_th_ui_view_tool["kernel"]),
            resourceGroups=[
                "semantic-authoring",
                "reverse-bim",
                "source-derived-views",
                "kernel-command",
            ],
            uiFeatures=[
                "cmd-k:agent-equivalent",
                "reverse-bim",
                "project-browser:source-derived-views",
            ],
        )
    )
