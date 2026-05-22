# Security and Dependency Hygiene

This repo treats security hygiene as an automated quality signal. Manual review
is acceptable only when the decision is recorded as machine-readable repo state.

## Commands

| Purpose                                         | Command                                                                                                                                                          | Gate                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Tracked-file secret and unsafe browser API scan | `pnpm security:hygiene`                                                                                                                                          | Local strict verification and CI |
| JavaScript dependency advisories                | `pnpm audit --audit-level=high`                                                                                                                                  | CI governance job                |
| Python dependency advisories                    | `uv export --frozen --all-extras --no-hashes --format requirements-txt > /tmp/bim-ai-requirements.txt && uvx pip-audit -r /tmp/bim-ai-requirements.txt --strict` | CI governance job                |
| Security waiver visibility                      | `pnpm quality:report`                                                                                                                                            | CI scorecard artifact            |

## Exception Policy

Security exceptions live in `spec/governance/security-waivers.json`. Each waiver must
include an owner, reason, expiry date, tracker ID, severity, affected check,
affected path, and replacement plan. Expired waivers or unwaived findings fail
`pnpm security:hygiene`.

Unsafe browser APIs are not banned outright because the app has internal SVG
rendering paths, but every production use of `dangerouslySetInnerHTML`,
`.innerHTML =`, `eval(`, or `new Function(` must either be removed or carry an
expiring waiver.

## Dependency Update Workflow

For JavaScript packages, edit the relevant `package.json`, then run
`pnpm install` from the repo root and commit the package manifest plus
`pnpm-lock.yaml`. CI runs `pnpm audit --audit-level=high` against the resulting
lockfile.

For Python packages, edit `app/pyproject.toml`, then run `cd app && uv lock`
and commit both `app/pyproject.toml` and `app/uv.lock`. CI verifies lockfile
freshness with `uv lock --check` and audits the exported locked environment
with `pip-audit`.

If an advisory cannot be fixed immediately, add an expiring waiver with a
replacement plan and a tracker ID before merging.
