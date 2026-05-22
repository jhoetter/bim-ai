# UI-Equivalent Benchmark Traceability

Last updated: 2026-05-18

Source of intent: `spec/trackers/ui-mcp-parity-tracker.md#same-house-parity-benchmarks`.

## Simple Single-Storey House

The current `simple-single-storey-house` benchmark has a deterministic MCP/CLI
fixture and expected semantic counts. It does not yet have a UI/Cmd+K path that
authors the same house and produces a semantic diff against the MCP/CLI result.

Traceability status:

| Path                               | Status            | Evidence file                                                            | Notes                                                                                                     |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| MCP/CLI fixture                    | fixture-validated | `spec/benchmarks/simple-single-storey-house/mcp-cli-command-bundle.json` | Deterministic command bundle covers the canonical house shape.                                            |
| Expected semantics                 | declared          | `spec/benchmarks/simple-single-storey-house/expected-semantics.json`     | Declares expected counts and placeholder evidence requirements.                                           |
| UI/Cmd+K traceability              | traceability-only | `spec/benchmarks/simple-single-storey-house/ui-cmdk-traceability.json`   | Lists current Cmd+K steps, capability ids, execution kinds, and semantic mappings; not executable parity. |
| Live dry-run/commit evidence       | todo              | none                                                                     | Needs persisted live typed execution output from the benchmark runner.                                    |
| Advisor/screenshot/export evidence | placeholder       | `spec/benchmarks/simple-single-storey-house/expected-semantics.json`     | Expectations are tracked, but current files do not prove live evidence generation.                        |

Audit rule: generated parity reports may use benchmark fixture commands as
traceability markers, but they must not count as first-class UI/MCP parity unless
the benchmark files expose live typed dry-run/commit output and a UI-equivalent
semantic diff. The UI/Cmd+K traceability artifact is intentionally weaker: it
proves referenced command-palette ids and capability classifications stay wired,
but it does not execute UI gestures or compare UI-authored semantics to the
MCP/CLI fixture.
