from __future__ import annotations

from bim_ai.advisor_rule_registry import advisor_rule_catalog_payload
from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# SKB readiness — QA/advisor product surfaces
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="qa.advisor_rules",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAdvisorRulesInput",
            "type": "object",
            "properties": {
                "profile": {"type": "string"},
                "surface": {"type": "string", "enum": ["ui", "api", "cli", "mcp", "docs"]},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "AdvisorRuleCatalog",
            "type": "object",
            "required": ["format", "schemaVersion", "summary", "rules"],
            "properties": {
                "format": {"const": "advisorRuleCatalog_v1"},
                "schemaVersion": {"const": "advisor-rule-registry.v1"},
                "source": {"type": "string"},
                "filters": {"type": "object"},
                "summary": {
                    "type": "object",
                    "required": ["ruleCount", "canonicalRuleCount", "surfaces", "rulesBySurface"],
                    "properties": {
                        "ruleCount": {"type": "integer"},
                        "canonicalRuleCount": {"type": "integer"},
                        "surfaces": {"type": "array", "items": {"type": "string"}},
                        "rulesBySurface": {"type": "object"},
                    },
                    "additionalProperties": True,
                },
                "rules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": [
                            "ruleId",
                            "title",
                            "severity",
                            "discipline",
                            "perspective",
                            "profiles",
                            "sourceLayer",
                            "severityPolicy",
                            "suppressibility",
                            "actionability",
                            "surfaces",
                            "affectedIdKinds",
                            "recommendation",
                            "fixCommandHints",
                            "trackerItems",
                            "testRefs",
                            "status",
                        ],
                        "properties": {
                            "ruleId": {"type": "string"},
                            "title": {"type": "string"},
                            "severity": {"type": "string", "enum": ["error", "warning", "info"]},
                            "discipline": {"type": "string"},
                            "perspective": {"type": "string"},
                            "profiles": {"type": "array", "items": {"type": "string"}},
                            "sourceLayer": {"type": "string"},
                            "severityPolicy": {"type": "string"},
                            "suppressibility": {"type": "string"},
                            "actionability": {"type": "string"},
                            "surfaces": {"type": "array", "items": {"type": "string"}},
                            "affectedIdKinds": {"type": "array", "items": {"type": "string"}},
                            "recommendation": {"type": "string"},
                            "fixCommandHints": {"type": "array", "items": {"type": "string"}},
                            "trackerItems": {"type": "array", "items": {"type": "string"}},
                            "testRefs": {"type": "array", "items": {"type": "string"}},
                            "status": {"type": "string"},
                        },
                        "additionalProperties": True,
                    },
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Advisor rule metadata returned"),
        },
        cliExample="bim-ai qa rules --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/advisor-rules"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only canonical Advisor rule metadata. This is the parity source for "
            "UI, API, CLI, MCP-style agent, and generated documentation surfaces."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaAdvisorRulesInput", "output:AdvisorRuleCatalog"],
        exampleRefs=["cli:qa:rules", "route:advisor-rules", "doc:advisor-rule-ledger"],
        resourceGroups=["qa", "advisor", "rule-registry", "mcp"],
        uiFeatures=["advisor-panel", "agent-review", "rule-ledger"],
        surfaceMetadata={
            "advisorRuleCatalog": advisor_rule_catalog_payload()["summary"],
        },
    )
)

register(
    ToolDescriptor(
        name="qa.advisor",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAdvisorInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "profile": {
                    "type": "string",
                    "default": "authoring_default",
                    "description": "Constructability/advisor profile to evaluate.",
                },
                "severity": {"type": "string", "enum": ["info", "warning", "error"]},
                "elementIds": {"type": "array", "items": {"type": "string"}},
                "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAdvisorResult",
            "type": "object",
            "required": ["format", "profile", "findings", "summary"],
            "properties": {
                "format": {"const": "qaAdvisor_v1"},
                "profile": {"type": "string"},
                "findings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "ruleId": {"type": "string"},
                            "severity": {"type": "string"},
                            "message": {"type": "string"},
                            "recommendation": {"type": "string"},
                            "elementIds": {"type": "array", "items": {"type": "string"}},
                            "blockingClass": {"type": "string"},
                            "priority": {"type": "string"},
                            "priorityRank": {"type": "integer"},
                            "rootCauseGroupId": {"type": "string"},
                            "suppressibility": {"type": "string"},
                            "tolerancePolicy": {"type": "object"},
                            "audienceText": {"type": "object"},
                        },
                        "additionalProperties": True,
                    },
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "findingCount": {"type": "integer"},
                        "returnedCount": {"type": "integer"},
                        "severityCounts": {"type": "object"},
                    },
                    "additionalProperties": True,
                },
                "limitations": {"type": "array", "items": {"type": "string"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Advisor findings returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai qa advisor --output json --severity warning",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/qa/advisor"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Advisor surface for agent refinement. Findings preserve severity, "
            "profile, recommendation, and affected element ids where available."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaAdvisorInput", "output:QaAdvisorResult"],
        exampleRefs=["cli:qa:advisor", "route:qa:advisor"],
        resourceGroups=["qa", "advisor", "constructability", "sketch-to-bim"],
        uiFeatures=["advisor-panel", "group:advisor"],
    )
)

register(
    ToolDescriptor(
        name="validate.roof_dormer_source_alignment",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ValidateRoofDormerSourceAlignmentInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "facts": {"type": "array", "items": {"type": "object"}},
                "sourceFacts": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ValidateRoofDormerSourceAlignmentResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Roof/dormer source alignment report returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid alignment validation request"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai validate roof-dormer-source-alignment --facts roof-facts.json --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/validate/roof-dormer-source-alignment"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only phase gate; unresolved errors must be disposed before final acceptance.",
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:ValidateRoofDormerSourceAlignmentInput",
            "output:ValidateRoofDormerSourceAlignmentResult",
        ],
        exampleRefs=["route:validate-roof-dormer-source-alignment"],
        resourceGroups=["validate", "roofs", "dormers", "source", "mcp-resource"],
    )
)

register(
    ToolDescriptor(
        name="qa.constructability",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaConstructabilityInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "profile": {"type": "string", "default": "authoring_default"},
                "phaseFilter": {"type": "string", "default": "all"},
                "optionLocks": {"type": "string"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaConstructabilityReport",
            "type": "object",
            "required": ["modelId", "summary"],
            "properties": {
                "modelId": {"type": "string"},
                "profile": {"type": "string"},
                "summary": {"type": "object"},
                "findings": {"type": "array", "items": {"type": "object"}},
                "rootCauseGroups": {"type": "array", "items": {"type": "object"}},
                "issues": {"type": "array", "items": {"type": "object"}},
                "suppressionAudit": {"type": "object"},
                "reviewWorkflow": {"type": "object"},
                "learningCorpus": {"type": "object"},
                "viewpoints": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Constructability report returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample=(
            "curl /api/models/$BIM_AI_MODEL_ID/constructability-report?profile=authoring_default"
        ),
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/constructability-report"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only constructability profile report for phase acceptance. Use qa.advisor "
            "when an element-filterable warning/info/error list is needed."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaConstructabilityInput", "output:QaConstructabilityReport"],
        exampleRefs=["route:constructability-report"],
        resourceGroups=["qa", "constructability", "profile", "sketch-to-bim"],
        uiFeatures=["advisor-panel", "construction-lens", "group:constructability"],
    )
)

register(
    ToolDescriptor(
        name="qa.area_reconciliation",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAreaReconciliationInput",
            "type": "object",
            "required": ["modelId", "sourceFacts"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "sourceFacts": {"type": "array", "items": {"type": "object"}},
                "toleranceM2": {"type": "number", "minimum": 0, "default": 0.5},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaAreaReconciliationResult",
            "type": "object",
            "required": ["format", "modelId", "revision", "summary", "rows"],
            "properties": {
                "format": {"const": "areaReconciliationReport_v1"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "toleranceM2": {"type": "number"},
                "summary": {"type": "object"},
                "rows": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Area reconciliation report returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid source fact payload"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai qa area-reconciliation --source-facts source-fact-ledger.json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/qa/area-reconciliation"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only source-vs-model area QA. Reverse-BIM acceptance should keep "
            "accepted=false until mismatches and missing model rooms are resolved."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaAreaReconciliationInput", "output:QaAreaReconciliationResult"],
        exampleRefs=["route:qa-area-reconciliation"],
        resourceGroups=["qa", "areas", "rooms", "mcp-resource"],
        uiFeatures=["advisor-panel", "schedule-view"],
    )
)

register(
    ToolDescriptor(
        name="qa.bim_requirement_validation",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaBimRequirementValidationInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaBimRequirementValidationResult",
            "type": "object",
            "required": ["format", "modelId", "revision", "packs", "reports", "summary"],
            "properties": {
                "format": {"const": "bimRequirementValidationApiParity_v1"},
                "modelId": {"type": "string"},
                "revision": {"type": ["integer", "string"]},
                "validationRuleCount": {"type": "integer"},
                "packs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["schemaVersion", "packId", "summary", "checks"],
                        "properties": {
                            "schemaVersion": {"const": "bim-requirement-validation-pack.v1"},
                            "packId": {"type": "string"},
                            "summary": {"type": "object"},
                            "checks": {"type": "array", "items": {"type": "object"}},
                        },
                        "additionalProperties": True,
                    },
                },
                "reports": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["schemaVersion", "ok", "summary", "blockers"],
                        "properties": {
                            "schemaVersion": {"const": "bim-requirement-validation-report.v1"},
                            "ok": {"type": "boolean"},
                            "summary": {"type": "object"},
                            "blockers": {"type": "array", "items": {"type": "object"}},
                        },
                        "additionalProperties": True,
                    },
                },
                "summary": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="BIR/IDS-style validation packs returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample=("curl /api/models/$BIM_AI_MODEL_ID/qa/bim-requirement-validation"),
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/qa/bim-requirement-validation"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only backend parity for BIR/IDS-style information requirement packs "
            "stored as validation_rule elements."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:QaBimRequirementValidationInput",
            "output:QaBimRequirementValidationResult",
        ],
        exampleRefs=["route:qa:bim-requirement-validation"],
        resourceGroups=["qa", "advisor", "ids", "bir", "mcp"],
        uiFeatures=["agent-review", "advisor-panel", "group:exchange-validation"],
    )
)

register(
    ToolDescriptor(
        name="qa.integrity_preflight",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaIntegrityPreflightInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "changedElementIds": {"type": "array", "items": {"type": "string"}},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaIntegrityPreflightResult",
            "type": "object",
            "required": ["format", "profileIndependent", "summary", "findings", "diagnostics"],
            "properties": {
                "format": {"const": "integrityPreflightReport_v1"},
                "profileIndependent": {"type": "boolean"},
                "summary": {"type": "object"},
                "findings": {"type": "array", "items": {"type": "object"}},
                "remediation": {"type": "object"},
                "diagnostics": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Integrity preflight returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai qa integrity --output json",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/qa/integrity-preflight"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Profile-independent BIM integrity preflight. It excludes subjective sketch "
            "acceptance checks and includes deterministic remediation proposals for safe dry-run."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaIntegrityPreflightInput", "output:QaIntegrityPreflightResult"],
        exampleRefs=["cli:qa:integrity", "route:qa:integrity-preflight"],
        resourceGroups=["qa", "advisor", "model-integrity", "preflight", "mcp"],
        uiFeatures=["advisor-panel", "agent-review", "group:integrity"],
    )
)

register(
    ToolDescriptor(
        name="qa.profile_comparison",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaProfileComparisonInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "profiles": {"type": "array", "items": {"type": "string"}},
                "changedElementIds": {"type": "array", "items": {"type": "string"}},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QaProfileComparisonResult",
            "type": "object",
            "required": ["format", "profiles", "rows", "ruleMatrix", "summary"],
            "properties": {
                "format": {"const": "advisorMultiProfileComparison_v1"},
                "profiles": {"type": "array", "items": {"type": "string"}},
                "rows": {"type": "array", "items": {"type": "object"}},
                "ruleMatrix": {"type": "array", "items": {"type": "object"}},
                "summary": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Profile comparison returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai qa profiles --profiles authoring_default,construction_readiness,fire",
        restEndpoint=RestEndpoint(
            method="GET", path="/api/models/{model_id}/qa/profile-comparison"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Compares deterministic Advisor/constructability profile outputs without merging "
            "findings by hand."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QaProfileComparisonInput", "output:QaProfileComparisonResult"],
        exampleRefs=["cli:qa:profiles", "route:qa:profile-comparison"],
        resourceGroups=["qa", "advisor", "profile", "mcp"],
        uiFeatures=["advisor-panel", "agent-review", "group:profile-comparison"],
    )
)

register(
    ToolDescriptor(
        name="model-show",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelShowInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSnapshot",
            "type": "object",
            "required": ["modelId", "revision", "elements"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "elements": {"type": "object"},
                "violations": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Success"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai snapshot  # (BIM_AI_MODEL_ID must be set)",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/snapshot"),
        sideEffects="none",
        agentSafetyNotes="Safe to call freely; read-only snapshot.",
        stableId="model-show",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ModelShowInput", "output:ModelSnapshot"],
        exampleRefs=["route:model-snapshot", "cli:snapshot"],
        resourceGroups=["model", "snapshot", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["model-browser", "workspace"],
    )
)

register(
    ToolDescriptor(
        name="model.summary",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSummaryInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelSummaryResource",
            "type": "object",
            "required": ["modelId", "revision", "summary"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "summary": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Model summary returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai model summary --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/summary"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only compact model resource for planning. Use snapshot or query.elements "
            "when element payloads are required."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:ModelSummaryInput", "output:ModelSummaryResource"],
        exampleRefs=["route:model-summary", "cli:model:summary"],
        resourceGroups=["model", "summary", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["model-browser", "workspace-summary"],
    )
)

register(
    ToolDescriptor(
        name="model.command_log",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelCommandLogInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ModelCommandLog",
            "type": "object",
            "required": ["modelId", "revision", "commands"],
            "properties": {
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "commands": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Recent command log returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="curl /api/models/$BIM_AI_MODEL_ID/command-log",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/command-log"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only audit trail for recent model commits, undo metadata, command payloads, "
            "and agent/user attribution when recorded."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:ModelCommandLogInput", "output:ModelCommandLog"],
        exampleRefs=["route:model-command-log"],
        resourceGroups=["model", "command-log", "audit", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["activity-stream", "undo-redo"],
    )
)

register(
    ToolDescriptor(
        name="evidence.package",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "EvidencePackageInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {"modelId": {"type": "string", "format": "uuid"}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "EvidencePackage",
            "type": "object",
            "required": ["format", "modelId", "revision", "summary", "validate"],
            "properties": {
                "format": {"const": "evidencePackage_v1"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "summary": {"type": "object"},
                "validate": {"type": "object"},
                "advisorSeveritySummary_v1": {"type": "object"},
                "semanticDigestSha256": {"type": "string"},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Evidence package returned"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai evidence-package --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/evidence-package"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only evidence package for agent review. It includes validation, summary, "
            "export links, deterministic evidence manifests, and Advisor severity rollups; "
            "live screenshot capture remains a separate evidence step."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:EvidencePackageInput", "output:EvidencePackage"],
        exampleRefs=["route:evidence-package", "cli:evidence-package"],
        resourceGroups=["evidence", "model", "validation", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["agent-review", "advisor-panel"],
    )
)

register(
    ToolDescriptor(
        name="commands.schema.catalog",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaCatalogInput",
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaCatalog",
            "type": "object",
            "required": ["schemaVersion", "commandCount", "commandNames", "schemas", "metadata"],
            "properties": {
                "schemaVersion": {"const": "command-schemas-v1"},
                "commandCount": {"type": "integer"},
                "commandNames": {"type": "array", "items": {"type": "string"}},
                "schemas": {"type": "object"},
                "metadata": {
                    "type": "object",
                    "description": (
                        "Per-command metadata keyed by discriminator. Each row includes "
                        "a generated example, example status, rawSemanticMapping, and "
                        "mappingStatus ('mapped' or 'explicit-raw-expert')."
                    ),
                },
                "unionSchema": {"type": "object"},
            },
            "additionalProperties": True,
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Kernel command schemas returned")},
        cliExample="bim-ai api list-commands --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/commands"),
        sideEffects="none",
        agentSafetyNotes=(
            "Exports the full backend Command union as per-command JSON Schemas. "
            "Each command carries a generated minimal example plus raw/semantic mapping "
            "metadata; commands without a typed descriptor are explicitly marked raw/expert."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:CommandSchemaCatalogInput", "output:CommandSchemaCatalog"],
        exampleRefs=["route:v3-commands"],
        resourceGroups=["api-descriptor", "command-schema", "kernel-command", "mcp-resource"],
        uiFeatures=["developer-tools"],
    )
)

register(
    ToolDescriptor(
        name="commands.schema.inspect",
        category="introspection",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaInspectInput",
            "type": "object",
            "required": ["name"],
            "properties": {"name": {"type": "string", "description": "Kernel command type."}},
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandSchemaInspectResult",
            "type": "object",
            "required": ["schemaVersion", "name", "schema", "metadata"],
            "properties": {
                "schemaVersion": {"const": "command-schemas-v1"},
                "name": {"type": "string"},
                "schema": {"type": "object"},
                "metadata": {
                    "type": "object",
                    "description": (
                        "Command metadata with generated example, exampleStatus, "
                        "rawSemanticMapping, and mappingStatus."
                    ),
                },
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Kernel command schema returned"),
            "not_found": ExitCode(code=1, meaning="Command not found"),
        },
        cliExample="bim-ai api inspect-command createWall --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/commands/{name}"),
        sideEffects="none",
        agentSafetyNotes=(
            "Inspect a single backend command schema. The schema is executable through "
            "raw apply-bundle, but first-class semantic descriptors remain preferred "
            "where available."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:CommandSchemaInspectInput", "output:CommandSchemaInspectResult"],
        exampleRefs=["route:v3-command"],
        resourceGroups=["api-descriptor", "command-schema", "kernel-command", "mcp-resource"],
        uiFeatures=["developer-tools"],
    )
)

register(
    ToolDescriptor(
        name="query.elements",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryElementsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "filter": {"type": "object"},
                "include": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["geometrySummary", "hostRefs", "scheduleSummary", "raw"],
                    },
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 1000},
                "cursor": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryResolveEnvelope",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data", "warnings"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
                "nextCursor": {"type": ["string", "null"]},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Matching elements returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported filter/include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query elements --category wall --include geometrySummary --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/elements"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only element discovery for replacing UI selection. Supports category, "
            "level, type, bbox, property, and createdBy-style filters where implemented."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryElementsInput", "output:QueryResolveEnvelope"],
        exampleRefs=["route:query-elements", "cli:query:elements"],
        resourceGroups=["query", "elements", "model", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["selection", "model-browser", "inspector"],
    )
)

register(
    ToolDescriptor(
        name="query.levels",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryLevelsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["planViews", "constraints"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryLevelsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Levels returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query levels --include planViews --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/levels"),
        sideEffects="none",
        agentSafetyNotes="Read-only level and plan-view discovery for explicit level ids.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryLevelsInput", "output:QueryLevelsResult"],
        exampleRefs=["route:query-levels", "cli:query:levels"],
        resourceGroups=["query", "levels", "model", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["level-browser", "project-browser"],
    )
)

register(
    ToolDescriptor(
        name="query.types",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryTypesInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "filter": {"type": "object"},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["parameters", "materials"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryTypesResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Type/material catalog returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported filter/include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query types --category wall_type --include materials --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/types"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only type/material discovery. Agents should resolve existing types before "
            "authoring walls, slabs, roofs, openings, or assets."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryTypesInput", "output:QueryTypesResult"],
        exampleRefs=["route:query-types", "cli:query:types"],
        resourceGroups=["query", "types", "materials", "model", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["type-browser", "inspector"],
    )
)

register(
    ToolDescriptor(
        name="query.views",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryViewsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "filter": {"type": "object"},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["crop", "placements", "templates"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryViewsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Views returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported filter/include value"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query views --kind plan --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/views"),
        sideEffects="none",
        agentSafetyNotes="Read-only view/sheet/schedule discovery for review and documentation.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryViewsInput", "output:QueryViewsResult"],
        exampleRefs=["route:query-views", "cli:query:views"],
        resourceGroups=["query", "views", "sheets", "schedules", "model", "mcp-resource"],
        uiFeatures=["project-browser", "view-browser", "sheet-browser"],
    )
)

register(
    ToolDescriptor(
        name="query.hosts",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryHostsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "hostKinds": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["wall", "floor", "roof", "slab"]},
                },
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "lineMm": {
                    "type": "array",
                    "items": {"type": "array", "items": {"type": "number"}},
                },
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["hostFaces", "normalizedPosition"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryHostsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Candidate hosts returned"),
            "bad_request": ExitCode(code=2, meaning="Unsupported host query"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query hosts --kind wall --point-mm 1200,0 --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/hosts"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only host discovery for wall, roof, floor/slab, and hosted-opening workflows."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryHostsInput", "output:QueryHostsResult"],
        exampleRefs=["route:query-hosts", "cli:query:hosts"],
        resourceGroups=["query", "hosts", "walls", "roofs", "slabs", "mcp-resource"],
        uiFeatures=["canvas-hover", "selection"],
    )
)

register(
    ToolDescriptor(
        name="query.nearest_wall",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryNearestWallInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "maxDistanceMm": {"type": "number", "minimum": 0},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryNearestWallResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Nearest wall result returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid point or tolerance"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query nearest-wall --point-mm 1200,300 --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/query/nearest-wall"),
        sideEffects="none",
        agentSafetyNotes="Read-only wall proximity resolver for hosted openings and line matching.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryNearestWallInput", "output:QueryNearestWallResult"],
        exampleRefs=["route:query-nearest-wall", "cli:query:nearest-wall"],
        resourceGroups=["query", "walls", "resolver", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["canvas-hover", "wall-tool"],
    )
)

register(
    ToolDescriptor(
        name="query.room_access_graph",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryRoomAccessGraphInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "roomId": {"type": "string"},
                "roomIds": {"type": "array", "items": {"type": "string"}},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryRoomAccessGraphResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Room access graph returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid room access graph request"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query room-access-graph --room room-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/query/room-access-graph"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only access graph for existing-building room/access repair loops. "
            "Use with Advisor findings before accepting room topology."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryRoomAccessGraphInput", "output:RoomAccessGraphResult"],
        exampleRefs=["route:query-room-access-graph"],
        resourceGroups=["query", "rooms", "access", "mcp-resource"],
        uiFeatures=["advisor-panel", "room-tool"],
    )
)

register(
    ToolDescriptor(
        name="query.enclosed_loops",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryEnclosedLoopsInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "levelId": {"type": "string"},
                "sourceElementIds": {"type": "array", "items": {"type": "string"}},
                "include": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["area", "segments", "sourceElementIds"]},
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "QueryEnclosedLoopsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Candidate enclosed loops returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid loop query"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai query loops --level level-1 --include area --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/query/enclosed-loops"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only loop discovery for floors, roofs, rooms, and wall-chain-derived boundaries."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:QueryEnclosedLoopsInput", "output:QueryEnclosedLoopsResult"],
        exampleRefs=["route:query-enclosed-loops", "cli:query:loops"],
        resourceGroups=["query", "loops", "rooms", "floors", "roofs", "mcp-resource"],
        uiFeatures=["floor-tool", "roof-sketch", "room-tool"],
    )
)

register(
    ToolDescriptor(
        name="resolve.active_or_default_level",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveActiveOrDefaultLevelInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "activeLevelId": {"type": "string"},
                "preferredElevationMm": {"type": "number"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveLevelResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Level resolved"),
            "not_found": ExitCode(code=1, meaning="Model not found or no level exists"),
        },
        cliExample="bim-ai resolve level --active-or-default --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/active-or-default-level"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only replacement for UI active-level state.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveActiveOrDefaultLevelInput", "output:ResolveLevelResult"],
        exampleRefs=["route:resolve-active-or-default-level", "cli:resolve:level"],
        resourceGroups=["resolve", "levels", "context", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["active-level-picker"],
    )
)

register(
    ToolDescriptor(
        name="resolve.default_plan_view",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveDefaultPlanViewInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveDefaultPlanViewResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Plan view resolved"),
            "not_found": ExitCode(code=1, meaning="Model, level, or plan view not found"),
        },
        cliExample="bim-ai resolve default-plan-view --level level-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/default-plan-view"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only replacement for UI active-plan-view context.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveDefaultPlanViewInput", "output:ResolveDefaultPlanViewResult"],
        exampleRefs=["route:resolve-default-plan-view", "cli:resolve:default-plan-view"],
        resourceGroups=["resolve", "views", "levels", "context", "mcp-resource"],
        uiFeatures=["project-browser", "active-view"],
    )
)

register(
    ToolDescriptor(
        name="resolve.wall_by_line",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveWallByLineInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "startMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "endMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "toleranceMm": {"type": "number", "minimum": 0},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveWallByLineResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Wall resolved by line"),
            "not_found": ExitCode(code=1, meaning="Model not found or no wall matched"),
            "bad_request": ExitCode(code=2, meaning="Invalid line/tolerance"),
        },
        cliExample="bim-ai resolve wall --line 0,0:6000,0 --tolerance-mm 50 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/wall-by-line"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only line-matched wall resolver for sketch wall/host equivalence.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveWallByLineInput", "output:ResolveWallByLineResult"],
        exampleRefs=["route:resolve-wall-by-line", "cli:resolve:wall"],
        resourceGroups=["resolve", "walls", "line-match", "mcp-resource", "sketch-to-bim"],
        uiFeatures=["wall-tool", "selection"],
    )
)

register(
    ToolDescriptor(
        name="resolve.floor_supports",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveFloorSupportsInput",
            "type": "object",
            "required": ["modelId", "floorId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "floorId": {"type": "string"},
                "lowerLevelId": {"type": "string"},
                "supportLevelId": {"type": "string"},
                "supportKinds": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["wall"]},
                    "default": ["wall"],
                },
                "toleranceMm": {"type": "number", "minimum": 0, "default": 250},
                "verticalToleranceMm": {"type": "number", "minimum": 0, "default": 500},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveFloorSupportsResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Floor support candidates returned"),
            "not_found": ExitCode(code=1, meaning="No support candidate matched"),
            "bad_request": ExitCode(code=2, meaning="Invalid floor/support request"),
        },
        cliExample="bim-ai resolve floor-supports --floor floor-dg --lower-level eg --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/floor-supports"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only floor support resolver. Use returned payloadPatch in a follow-up "
            "transaction and rerun Advisor."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveFloorSupportsInput", "output:ResolveFloorSupportsResult"],
        exampleRefs=["route:resolve-floor-supports"],
        resourceGroups=["resolve", "floors", "structure", "mcp-resource"],
        uiFeatures=["floor-tool", "advisor-panel"],
    )
)

register(
    ToolDescriptor(
        name="resolve.opening_source_match",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveOpeningSourceMatchInput",
            "type": "object",
            "required": ["modelId", "openings"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "openings": {"type": "array", "items": {"type": "object"}, "minItems": 2},
                "minScore": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveOpeningSourceMatchResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Opening source matches returned"),
            "bad_request": ExitCode(code=2, meaning="At least two opening rows are required"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai resolve opening-source-match --source-openings openings.json --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/opening-source-match"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only source reconciliation; use output as a disposition worklist before creating duplicate openings.",
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:ResolveOpeningSourceMatchInput",
            "output:ResolveOpeningSourceMatchResult",
        ],
        exampleRefs=["route:resolve-opening-source-match"],
        resourceGroups=["resolve", "openings", "source", "mcp-resource"],
    )
)

register(
    ToolDescriptor(
        name="resolve.wall_opening_host",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveWallOpeningHostInput",
            "type": "object",
            "required": ["modelId", "pointMm", "widthMm"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "nearPointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "sourcePointMm": {"type": "object"},
                "widthMm": {"type": "number", "exclusiveMinimum": 0},
                "levelId": {"type": "string"},
                "maxDistanceMm": {"type": "number", "minimum": 0},
                "maxAdjustmentMm": {"type": "number", "minimum": 0},
                "adjustOpeningToFit": {"type": "boolean"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveWallOpeningHostResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Wall host and authoring-safe alongT returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid point or opening width"),
            "not_found": ExitCode(code=1, meaning="No fitting wall host found"),
        },
        cliExample=(
            "bim-ai resolve wall-opening-host --point-mm 3285,4100 "
            "--width-mm 875 --level EG --output json"
        ),
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/wall-opening-host"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only resolver for existing-building openings. Use the returned wallId/alongT "
            "in a transactional door/window command, then rerun Advisor."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveWallOpeningHostInput", "output:ResolveWallOpeningHostResult"],
        exampleRefs=["route:resolve-wall-opening-host"],
        resourceGroups=["resolve", "openings", "walls", "mcp-resource"],
        uiFeatures=["wall-tool", "advisor-panel"],
    )
)

register(
    ToolDescriptor(
        name="resolve.dormer_opening_host",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveDormerOpeningHostInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "dormerId": {"type": "string"},
                "hostRoofId": {"type": "string"},
                "positionOnRoof": {"type": "object"},
                "maxDistanceMm": {"type": "number", "minimum": 0},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveDormerOpeningHostResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Dormer host candidate returned"),
            "not_found": ExitCode(code=1, meaning="No matching dormer found"),
            "bad_request": ExitCode(code=2, meaning="Invalid dormer host request"),
        },
        cliExample="bim-ai resolve dormer-opening-host --dormer dormer-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/dormer-opening-host"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only host resolver for dormer windows; may return a tool-gap blocker until a dormer face/wall host exists.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveDormerOpeningHostInput", "output:ResolveDormerOpeningHostResult"],
        exampleRefs=["route:resolve-dormer-opening-host"],
        resourceGroups=["resolve", "openings", "dormers", "roofs", "mcp-resource"],
    )
)

register(
    ToolDescriptor(
        name="resolve.roof_position_from_source_point",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoofPositionFromSourcePointInput",
            "type": "object",
            "required": ["modelId", "hostRoofId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "hostRoofId": {"type": "string"},
                "roofId": {"type": "string"},
                "sourcePointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "sourcePositionMm": {"type": "object"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoofPositionFromSourcePointResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Roof-local position candidate returned"),
            "not_found": ExitCode(code=1, meaning="Roof not found"),
            "bad_request": ExitCode(code=2, meaning="Invalid source point"),
        },
        cliExample="bim-ai resolve roof-position --roof roof-1 --point-mm 1200,3000 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/roof-position-from-source-point"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only approximate roof-local projection; source overlay validation must confirm final placement.",
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:ResolveRoofPositionFromSourcePointInput",
            "output:ResolveRoofPositionFromSourcePointResult",
        ],
        exampleRefs=["route:resolve-roof-position-from-source-point"],
        resourceGroups=["resolve", "roofs", "dormers", "openings", "mcp-resource"],
    )
)

register(
    ToolDescriptor(
        name="resolve.room_boundary_edges",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoomBoundaryEdgesInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "roomId": {"type": "string"},
                "roomIds": {"type": "array", "items": {"type": "string"}},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoomBoundaryEdgesResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Room boundary edge backing returned"),
            "bad_request": ExitCode(code=2, meaning="Invalid room boundary edge request"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai resolve room-boundary-edges --room room-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/room-boundary-edges"
        ),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only room boundary backing report. Use unbacked/partial edges to author "
            "walls, room separations, or revised room outlines before accepting topology."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:ResolveRoomBoundaryEdgesInput",
            "output:ResolveRoomBoundaryEdgesResult",
        ],
        exampleRefs=["route:resolve-room-boundary-edges"],
        resourceGroups=["resolve", "rooms", "topology", "mcp-resource"],
        uiFeatures=["advisor-panel", "room-tool"],
    )
)

register(
    ToolDescriptor(
        name="resolve.host_face",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveHostFaceInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "hostId": {"type": "string"},
                "hostKinds": {"type": "array", "items": {"type": "string"}},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveHostFaceResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Host face resolved"),
            "not_found": ExitCode(code=1, meaning="Model or host not found"),
            "bad_request": ExitCode(code=2, meaning="Invalid host-face request"),
        },
        cliExample="bim-ai resolve host-face --host wall-1 --point-mm 1000,0 --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/resolve/host-face"),
        sideEffects="none",
        agentSafetyNotes="Read-only hosted-placement resolver for walls, roof faces, and slab faces.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveHostFaceInput", "output:ResolveHostFaceResult"],
        exampleRefs=["route:resolve-host-face", "cli:resolve:host-face"],
        resourceGroups=["resolve", "hosts", "host-face", "walls", "roofs", "slabs"],
        uiFeatures=["canvas-hover", "hosted-placement-tools"],
    )
)

register(
    ToolDescriptor(
        name="resolve.family_type",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveFamilyTypeInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "category": {"type": "string"},
                "name": {"type": "string"},
                "constraints": {"type": "object"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveFamilyTypeResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Family/type resolved"),
            "not_found": ExitCode(code=1, meaning="No matching type found"),
            "bad_request": ExitCode(code=2, meaning="Invalid resolver request"),
        },
        cliExample="bim-ai resolve family-type --category door --name Entry --output json",
        restEndpoint=RestEndpoint(method="POST", path="/api/models/{model_id}/resolve/family-type"),
        sideEffects="none",
        agentSafetyNotes="Read-only replacement for UI family/type picker state.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveFamilyTypeInput", "output:ResolveFamilyTypeResult"],
        exampleRefs=["route:resolve-family-type", "cli:resolve:family-type"],
        resourceGroups=["resolve", "types", "families", "catalog", "mcp-resource"],
        uiFeatures=["type-picker", "family-browser"],
    )
)

register(
    ToolDescriptor(
        name="resolve.room_boundary",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoomBoundaryInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "roomId": {"type": "string"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "levelId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveRoomBoundaryResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Room boundary resolved"),
            "not_found": ExitCode(code=1, meaning="Room or boundary not found"),
            "bad_request": ExitCode(code=2, meaning="Invalid room-boundary request"),
        },
        cliExample="bim-ai resolve room-boundary --room room-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/room-boundary"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only room/space boundary resolver for room-programme authoring.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveRoomBoundaryInput", "output:ResolveRoomBoundaryResult"],
        exampleRefs=["route:resolve-room-boundary", "cli:resolve:room-boundary"],
        resourceGroups=["resolve", "rooms", "boundaries", "loops", "mcp-resource"],
        uiFeatures=["room-tool", "inspector"],
    )
)

register(
    ToolDescriptor(
        name="resolve.loop_for_boundary",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveLoopForBoundaryInput",
            "type": "object",
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
                "boundaryElementIds": {"type": "array", "items": {"type": "string"}},
                "levelId": {"type": "string"},
                "pointMm": {"type": "array", "items": {"type": "number"}, "minItems": 2},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ResolveLoopForBoundaryResult",
            "type": "object",
            "required": ["ok", "modelId", "revision", "data"],
            "properties": {
                "ok": {"type": "boolean"},
                "modelId": {"type": "string"},
                "revision": {"type": "integer"},
                "data": {"type": "object"},
                "warnings": {"type": "array", "items": {"type": "object"}},
            },
            "additionalProperties": True,
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Boundary loop resolved"),
            "not_found": ExitCode(code=1, meaning="No loop matched"),
            "bad_request": ExitCode(code=2, meaning="Invalid boundary request"),
        },
        cliExample="bim-ai resolve loop-for-boundary --level level-1 --output json",
        restEndpoint=RestEndpoint(
            method="POST", path="/api/models/{model_id}/resolve/loop-for-boundary"
        ),
        sideEffects="none",
        agentSafetyNotes="Read-only resolver from selected/detected boundary context to explicit loop id.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:ResolveLoopForBoundaryInput", "output:ResolveLoopForBoundaryResult"],
        exampleRefs=["route:resolve-loop-for-boundary", "cli:resolve:loop-for-boundary"],
        resourceGroups=["resolve", "loops", "boundaries", "floors", "roofs", "mcp-resource"],
        uiFeatures=["floor-tool", "roof-sketch", "room-tool"],
    )
)

register(
    ToolDescriptor(
        name="fire-safety-lens-review-status",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "FireSafetyLensReviewStatusInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "FireSafetyLensReviewStatus",
            "type": "object",
            "required": [
                "modelId",
                "format",
                "lensId",
                "scheduleDefaults",
                "viewDefaults",
                "sheetDefaults",
                "counts",
                "schedules",
            ],
            "properties": {
                "modelId": {"type": "string"},
                "format": {"const": "fireSafetyLensReviewStatus_v1"},
                "lensId": {"const": "fire-safety"},
                "germanName": {"const": "Brandschutz"},
                "scheduleDefaults": {"type": "array", "items": {"type": "object"}},
                "viewDefaults": {"type": "array", "items": {"type": "object"}},
                "sheetDefaults": {"type": "array", "items": {"type": "object"}},
                "nonGoals": {"type": "array", "items": {"type": "string"}},
                "counts": {"type": "object"},
                "schedules": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Fire Safety Lens readout generated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai fire-safety-lens-review-status --model-id <id>",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/fire-safety-lens"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Brandschutz review payload. It exposes consultant-review "
            "schedules and statuses, but does not claim jurisdictional fire-code approval."
        ),
    )
)

register(
    ToolDescriptor(
        name="cost-quantity-lens-review-status",
        category="query",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CostQuantityLensReviewStatusInput",
            "type": "object",
            "required": ["modelId"],
            "properties": {
                "modelId": {"type": "string", "format": "uuid"},
            },
            "additionalProperties": False,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CostQuantityLensReviewStatus",
            "type": "object",
            "required": [
                "modelId",
                "format",
                "lensId",
                "scheduleDefaults",
                "viewDefaults",
                "sheetDefaults",
                "counts",
                "totals",
                "schedules",
            ],
            "properties": {
                "modelId": {"type": "string"},
                "format": {"const": "costQuantityLensReviewStatus_v1"},
                "lensId": {"const": "cost-quantity"},
                "englishName": {"const": "Cost and Quantity"},
                "germanName": {"const": "Kosten und Mengen"},
                "scheduleDefaults": {"type": "array", "items": {"type": "object"}},
                "viewDefaults": {"type": "array", "items": {"type": "object"}},
                "sheetDefaults": {"type": "array", "items": {"type": "object"}},
                "nonGoals": {"type": "array", "items": {"type": "string"}},
                "counts": {"type": "object"},
                "totals": {"type": "object"},
                "schedules": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Cost and Quantity Lens readout generated"),
            "not_found": ExitCode(code=1, meaning="Model not found"),
        },
        cliExample="bim-ai cost-quantity-lens-review-status --model-id <id>",
        restEndpoint=RestEndpoint(method="GET", path="/api/models/{model_id}/cost-quantity-lens"),
        sideEffects="none",
        agentSafetyNotes=(
            "Read-only Kosten und Mengen payload. Unit rates without source references "
            "are surfaced for review but excluded from cost totals."
        ),
    )
)
