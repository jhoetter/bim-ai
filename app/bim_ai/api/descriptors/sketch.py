from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

# ---------------------------------------------------------------------------
# M3-F — Sketch IR, seed, and phase product surfaces
# ---------------------------------------------------------------------------

_SKETCH_IR_REF = "schema:sketch-understanding-ir.v0"
_SKETCH_MATRIX_REF = "schema:sketch-to-bim-capability-matrix.v0"
_SKETCH_PACKET_REF = "schema:sketch-to-bim-initiation-packet.v0"
_CMD_V3_REF = "schema:cmd-v3.0"

register(
    ToolDescriptor(
        name="sketch.ir.validate",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchIrValidateRequest",
            "type": "object",
            "required": ["ir"],
            "properties": {
                "ir": {"type": "object", "description": _SKETCH_IR_REF},
                "capabilityMatrix": {
                    "type": "object",
                    "description": _SKETCH_MATRIX_REF,
                },
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchIrValidateResult",
            "type": "object",
            "required": ["schemaVersion", "ok", "summary", "issues"],
            "properties": {
                "schemaVersion": {"const": "sketch.ir.validate.result.v0"},
                "ok": {"type": "boolean"},
                "summary": {
                    "type": "object",
                    "required": ["errorCount", "warningCount"],
                    "properties": {
                        "errorCount": {"type": "integer"},
                        "warningCount": {"type": "integer"},
                    },
                },
                "issues": {"type": "array", "items": {"type": "object"}},
                "cliEquivalent": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="IR contract is valid"),
            "invalid": ExitCode(code=2, meaning="IR or capability matrix has blocking errors"),
        },
        cliExample=(
            "bim-ai sketch ir validate --ir sketch-ir.json "
            "--capabilities spec/data/sketch-to-bim-capability-matrix.json --out packet"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/ir/validate"),
        sideEffects="none",
        agentSafetyNotes=(
            "Validation does not create model geometry. Treat a pass as preflight only; "
            "phase acceptance still requires live evidence."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:SketchIrValidateRequest",
            "output:SketchIrValidateResult",
            _SKETCH_IR_REF,
        ],
        exampleRefs=[
            "cli:sketch:ir:validate",
            "spec:examples/sketch-understanding-ir.example.json",
        ],
        resourceGroups=["sketch-to-bim", "sketch-ir", "initiation"],
    )
)

register(
    ToolDescriptor(
        name="sketch.seed.compile",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchSeedCompileRequest",
            "type": "object",
            "required": ["recipe"],
            "properties": {
                "recipe": {"type": "object", "description": "seed-dsl.v0 recipe"},
                "modelHint": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "CommandBundle",
            "type": "object",
            "required": ["schemaVersion", "commands", "assumptions"],
            "properties": {
                "schemaVersion": {"const": "cmd-v3.0"},
                "commands": {"type": "array", "items": {"type": "object"}},
                "assumptions": {"type": "array", "items": {"type": "object"}},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Bundle written by CLI compiler"),
            "blocked": ExitCode(code=501, meaning="Python API route is contract-only"),
        },
        cliExample="bim-ai sketch seed compile --recipe seed.json --out bundle.json",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/seed/compile"),
        sideEffects="none",
        implementationStatus="unsupported",
        unsupportedReason=(
            "The product compiler is implemented in packages/cli/lib/seed-dsl.mjs. "
            "The API route is a typed blocked contract until the compiler is hosted server-side."
        ),
        agentSafetyNotes="Compiled output must be submitted through model.dry_run before commit.",
        requiredPermissions=["model:read"],
        schemaRefs=["input:SketchSeedCompileRequest", f"output:{_CMD_V3_REF}"],
        exampleRefs=["cli:sketch:seed:compile", "spec:examples/seed-dsl-modern-house.example.json"],
        resourceGroups=["sketch-to-bim", "seed-dsl", "command-bundle"],
    )
)

register(
    ToolDescriptor(
        name="sketch.phase.apply",
        category="mutation",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseApplyRequest",
            "type": "object",
            "required": ["modelId", "phaseId", "bundle"],
            "properties": {
                "modelId": {"type": "string"},
                "phaseId": {"type": "string"},
                "featureIds": {"type": "array", "items": {"type": "string"}},
                "bundle": {"type": "object", "description": _CMD_V3_REF},
                "parentRevision": {"type": "integer"},
                "mode": {"type": "string", "enum": ["dry_run", "commit"], "default": "dry_run"},
                "userId": {"type": "string"},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseApplyDelegation",
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "bundleRequest": {"type": "object"},
                "cliEquivalent": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="CLI wrapper submitted phase bundle"),
            "blocked": ExitCode(code=501, meaning="Backend wrapper is contract-only"),
        },
        cliExample=(
            "bim-ai sketch phase apply --model $BIM_AI_MODEL_ID "
            "--bundle phase.json --base 7 --dry-run --out phase-apply.json"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/phase/apply"),
        sideEffects="mutates-kernel",
        implementationStatus="unsupported",
        unsupportedReason=(
            "Use the CLI wrapper or POST the described CommandBundle to /api/models/{model_id}/bundles. "
            "The sketch-specific backend wrapper is blocked to avoid duplicating transaction semantics."
        ),
        agentSafetyNotes="Default to dry_run. A commit must include parentRevision and preserve bundle assumptions.",
        kernelCommands=["*"],
        schemaRefs=[
            "input:SketchPhaseApplyRequest",
            "output:SketchPhaseApplyDelegation",
            _CMD_V3_REF,
        ],
        exampleRefs=["cli:sketch:phase:apply"],
        resourceGroups=["sketch-to-bim", "phase", "transaction", "kernel-command"],
    )
)

register(
    ToolDescriptor(
        name="sketch.phase.accept",
        category="transform",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseAcceptRequest",
            "type": "object",
            "required": ["phaseId", "packet"],
            "properties": {
                "phaseId": {"type": "string"},
                "packet": {"type": "object", "description": _SKETCH_PACKET_REF},
                "requireCurrentHead": {"type": "boolean", "default": True},
            },
            "additionalProperties": True,
        },
        outputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "SketchPhaseAcceptResult",
            "type": "object",
            "required": ["schemaVersion", "phaseId", "ok", "summary", "blockers"],
            "properties": {
                "schemaVersion": {"const": "sketch.phase.accept.result.v0"},
                "phaseId": {"type": "string"},
                "ok": {"type": "boolean"},
                "summary": {"type": "object"},
                "blockers": {"type": "array", "items": {"type": "object"}},
                "cliEquivalent": {"type": "string"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Phase packet has no acceptance blockers"),
            "blocked": ExitCode(code=5, meaning="Acceptance blockers remain"),
        },
        cliExample=(
            "bim-ai sketch phase accept --ir sketch-ir.json "
            "--capabilities spec/data/sketch-to-bim-capability-matrix.json --out packet "
            "--fail-on-acceptance"
        ),
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/sketch/phase/accept"),
        sideEffects="none",
        agentSafetyNotes=(
            "Passing acceptance requires current-head evidence, coverage, advisor, and visual gates. "
            "Do not treat stale packets as final acceptance."
        ),
        requiredPermissions=["model:read"],
        schemaRefs=[
            "input:SketchPhaseAcceptRequest",
            "output:SketchPhaseAcceptResult",
            _SKETCH_PACKET_REF,
        ],
        exampleRefs=["cli:sketch:phase:accept"],
        resourceGroups=["sketch-to-bim", "phase", "acceptance", "evidence"],
    )
)
