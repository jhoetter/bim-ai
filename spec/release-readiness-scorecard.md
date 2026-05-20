# Release Readiness Scorecard

The code-quality scorecard is generated from repository state. Do not edit the
generated report by hand.

Run locally:

```sh
pnpm quality:report -- --out-json spec/generated/code-quality-report.json --out-md spec/generated/code-quality-report.md --fail-below B-
```

CI writes and uploads the same files from the governance job:

- `spec/generated/code-quality-report.json`
- `spec/generated/code-quality-report.md`

Release notes can link to the uploaded `code-quality-${{ github.run_id }}`
artifact or to a committed generated report from the release branch. Quality
claims should cite the generated grade, blocker list, waiver state, and trend
section instead of copying manual summaries.

The trend section compares the current report against
`spec/generated/code-quality-baseline.json`. Refresh that baseline only as an
intentional quality-governance change after reviewing the generated
improvements and regressions.
