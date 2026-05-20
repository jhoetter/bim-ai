# Agent Prompt: bim-book → bim-ai Coverage Audit

**Purpose:** This prompt instructs an agent to check whether bim-ai fully
implements everything that bim-book describes. The book is the knowledge
specification; the software is the implementation. Every method, calculation,
norm check, and advisory described in the book should exist as working code.

**When to run:** After any significant expansion of either repo.
**Output:** `spec/book-coverage-tracker.md` — a living gap report.

---

## ► PROMPT START ◄

---

You are performing a **coverage audit** across two repositories:

- `~/repos/bim-book` — explanatory book: "Vom Entwurf zum Modell"
- `~/repos/bim-ai` — BIM software that should implement what the book describes

The book is the **specification**. The software is the **implementation**.
Your job is to find every gap between them.

---

## STEP 0: Understand the relationship

The book explains concepts to readers (architects, developers, students).
Wherever the book describes _how something works_ — a formula, a norm check,
a calculation, a classification — bim-ai should be able to _perform_ that
operation on real model data.

Example:

- Book (K06): explains U-value formula, R = d/λ, with a worked example
- bim-ai: `energy_lens.py::u_value_for_layers()` — ✅ implemented
- Book (K06): says GEG sets U-value limits per component type
- bim-ai: no GEG compliance check exists — ❌ gap

Your job is to find all such gaps, systematically, across all 26 chapters.

---

## STEP 1: Read the book chapters

Read every chapter in `~/repos/bim-book/docs/chapters/` in order.

For each chapter, extract a list of **implementable claims** — things the book
describes that a BIM software _could and should_ do:

- Calculations (formulas with inputs and outputs)
- Norm checks (does X meet the requirement of DIN/GEG/EC/MBO Y?)
- Classifications (assign a type, class, or category to a building element)
- Advisories (flag a potential problem based on a rule)
- Quantity derivations (compute an area, volume, count from model geometry)

**Do not extract:**

- Historical context or background explanations
- Descriptions of what humans do manually (unless automatable)
- Opinions or design guidance without a normative basis

For each implementable claim, record:

- `chapter` — e.g. K06
- `claim` — one sentence: what the software should be able to do
- `norm` — which standard governs it (DIN, EC, GEG, MBO, HOAI, etc.)
- `inputs` — what model data is needed
- `output` — what the function should return

---

## STEP 2: Audit bim-ai

For each claim extracted in Step 1, check whether bim-ai implements it.

Search across:

```
~/repos/bim-ai/app/bim_ai/          # core Python modules
~/repos/bim-ai/app/tests/           # tests (indicate what is tested)
~/repos/bim-ai/spec/lenses/         # lens specs (may describe planned features)
~/repos/bim-ai/spec/norms-calculations-tracker.md  # if it exists from prior run
```

For each claim, assign one status:

| Status            | Meaning                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `✅ full`         | Implemented correctly with norm reference in docstring + test                        |
| `⚠️ partial`      | Code exists but incomplete (missing norm ref, no test, wrong formula, advisory only) |
| `❌ missing`      | No implementation found anywhere                                                     |
| `🚫 out of scope` | Intentionally not a software feature (e.g. pure design guidance)                     |

---

## STEP 3: Write the coverage tracker

Create `~/repos/bim-ai/spec/book-coverage-tracker.md`.

Structure:

```markdown
# bim-book → bim-ai Coverage Tracker

Last updated: YYYY-MM-DD
Book version: [latest commit hash of bim-book]
bim-ai version: [latest commit hash of bim-ai]

## Summary

| Chapter | Claims | ✅ full | ⚠️ partial | ❌ missing | Coverage % |
| ------- | ------ | ------- | ---------- | ---------- | ---------- |
| K01     | ...    | ...     | ...        | ...        | ...        |

...
| TOTAL | ... | ... | ... | ... | ... |

## Gap List — ❌ Missing (priority order)

For each missing claim, one row:
| Chapter | Claim | Norm | Inputs needed | Target file | Priority |
|---------|-------|------|---------------|-------------|----------|

Priority rules:

- P0: claim is in K01–K16 (core chapters) AND has a norm reference
- P1: claim is in K17–K26 OR is advisory without hard norm
- P2: claim is design guidance that could be automated but isn't critical

## Full Claim Register

One section per chapter. Each claim on its own row with full detail.

### K01 — Architektur als System

| Claim | Norm | Inputs | Output | Status | bim-ai location |
| ----- | ---- | ------ | ------ | ------ | --------------- |

...
```

---

## STEP 4: Spot-check three claims end-to-end

Pick three claims with status `✅ full` and verify them properly:

1. Find the book passage that makes the claim
2. Find the bim-ai function that implements it
3. Find the test that covers it
4. Confirm: does the function actually implement what the book describes,
   at the right precision, with the right norm reference?

If any of the three fails the spot-check, downgrade its status to `⚠️ partial`
and note what specifically is wrong.

---

## STEP 5: Identify the top 5 highest-value gaps

From the missing claims, identify the 5 where a bim-ai implementation would
add the most value for users — considering:

- How central the chapter is (K04 Tragwerk > K26 Digitaler Zwilling)
- How concrete and automatable the claim is
- Whether the required model data already exists in bim-ai's data model

Write these up as `## Top 5 Implementation Priorities` at the top of the
tracker, each with a one-paragraph brief:

- What the book says
- What bim-ai needs to do
- Which existing module to extend or which new file to create
- Estimated complexity (small / medium / large)

---

## Ground rules

- Do not implement anything during this audit. Read only.
- If a bim-ai module exists but has no docstring norm reference, mark it
  `⚠️ partial` — correct implementation without traceability is not enough.
- If you find something in bim-ai that the book doesn't cover but should,
  add it to a `## Reverse Gaps (bim-ai has, book lacks)` section — this
  feeds back into bim-book chapter expansions.
- The tracker must be greppable:
  `grep "❌ missing" spec/book-coverage-tracker.md` → all gaps
  `grep "P0" spec/book-coverage-tracker.md` → critical gaps only

---

## ► PROMPT END ◄

---

_To run the implementation phase after this audit:_
_"Read `spec/book-coverage-tracker.md`. Implement all P0 gaps in priority order._
_For each: write the module, add norm reference to docstring, write tests._
_Update tracker row to ✅ full when done."_
