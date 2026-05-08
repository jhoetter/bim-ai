# BIM AI — Vision Corral

**Purpose.** Items that are strategically interesting but **deliberately not in v3 build scope**. Capturing them here keeps them warm without bloating the v3 tracker, and makes the "not now" decision auditable instead of accidental.

**Referenced from:** `spec/workpackage-tracker-v3.md` § Vision Corral.

**Promotion rule.** A vision item leaves this file only by becoming a real WP in the active tracker. When it does, link the v3 commit/PR back here as proof of provenance, then strike the item.

**Status:** Skeleton seeded 2026-05-08 ahead of v3 research synthesis. R-F (synthesis stream) populates and refines this file.

---

## Status legend

| Symbol     | Meaning                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| `corralled` | Captured but not committed to a build window                              |
| `promoted`  | Has been moved into the active tracker as a real WP — see linked tracker entry |
| `discarded` | Reviewed and rejected; reason captured                                   |

---

## Seeded vision items (preliminary; refined by R-F)

These were surfaced in the user's handwritten notes + verbal context (2026-05-08) and parked here pending synthesis.

### V-01 — BIM → AI-generated video walkthrough
**Status:** `corralled`
**Why interesting:** Compelling client-presentation moment ("here's a video tour of your house"). Differentiator vs Revit. Compounds with T7 Site & Context (drone-flyover style) and T4 Documentation Output (presentation deck).
**Why not v3:** Depends on AI-video model maturation + GPU pipeline cost economics + a viable in-house render path. Tooling moves quickly here — revisit Q3+ when text-to-video / 3D-to-video offerings stabilise.
**Reopen trigger:** A credible AI-video API (Runway-class, OpenAI-class, or Google-class) ships a 3D-scene-input mode at acceptable cost.

### V-02 — BIM → generative world (Unreal-style playable)
**Status:** `corralled`
**Why interesting:** End state of "walk through your future house" UX. Also a recruiting / press moment.
**Why not v3:** Adjacent product category. Even with Unreal Engine integration available, the BIM-to-game-mesh pipeline is its own product. v3's documentation surface (T4) gets the user 80 % of the value via static perspectives + walkthrough videos.
**Reopen trigger:** Customer demand exceeds T4 ceiling, or a partner integration (Twinmotion, Lumion, Forma) makes the pipeline cheap.

### V-03 — iPad / tablet sketch companion app
**Status:** `corralled`
**Why interesting:** The pre-BIM hour — client meeting, hand sketches, dimensioned doodles, vision boards. T6 Concept Phase plants the seed inside the main app; the full version is its own iPad-native codebase optimised for Apple Pencil.
**Why not v3:** Different codebase (Swift / SwiftUI / React Native?), different release cadence, different UX surface. Investing pre-PMF on the desktop product is risky.
**Reopen trigger:** Either (a) a clear customer signal that the pre-BIM hour is _the_ blocker, or (b) iPad becomes table-stakes for a competitive close.

### V-04 — Moodboard tool with AI hand-off → BIM seed
**Status:** `corralled`
**Why interesting:** The other half of T6 Concept Phase. Moodboard → constraints → generative-house seed. Closes the loop with V-03 (sketch) and T9 (AI authoring).
**Why not v3:** v3's T6 ships a basic moodboard-attachment surface (paste images, link to model). The full AI hand-off is a generative-house bet that depends on R-C (HighArc research) telling us whether a sane pipeline exists.
**Reopen trigger:** R-C surfaces a viable input-surface pattern; or a partner / vendor offers a paid moodboard→layout API.

### V-05 — Manufacturer marketplace (paid component catalog)
**Status:** `corralled`
**Why interesting:** Direct revenue channel; Revit's `BIMobject` parallel; supplier loyalty hook.
**Why not v3:** Business-model question first, engineering second. Needs (a) a meaningful number of architects on the platform to attract suppliers, and (b) supplier-side onboarding tooling. Premature in v3.
**Reopen trigger:** User base + per-project asset usage data justifies vendor outreach.

### V-06 — Real-time multi-user voice (yjs + livekit)
**Status:** `corralled`
**Why interesting:** Figma-grade live presence — co-editing with cursors and voice over the model.
**Why not v3:** T3 Collaboration in v3 goes **async-first** — comments, markups, activity stream, time machine. Live-cursor + live-voice is a separate UX and infra investment.
**Reopen trigger:** T3 lands and customer feedback specifically asks for live presence.

### V-07 — Generative neighborhood from satellite imagery
**Status:** `corralled`
**Why interesting:** T7 Site & Context's stretch goal — instead of importing OSM massing blocks, infer them from a satellite tile.
**Why not v3:** ML segmentation + photogrammetry pipeline, with cost and accuracy questions. T7 starts with OSM massing import (cheap, deterministic, accurate-enough).
**Reopen trigger:** A vendor (Hover, Cesium-style) offers an off-the-shelf API.

### V-08 — Native voice-first authoring ("hey BIM, add a window")
**Status:** `corralled`
**Why interesting:** Accessibility + ergonomic upside; conversational fallback for the AI loop.
**Why not v3:** T9 AI Authoring goes text-first (chat surface inside the app). Voice is an input mode on top of it; layer in once the text loop is reliable.
**Reopen trigger:** T9 hits "good enough" reliability that adding voice is a UX add, not a hidden cost.

---

## Discarded items (reviewed and rejected)

_None yet. Populated as research surfaces things we explicitly decide against._

---

## Promoted items (in active tracker)

_None yet. As items graduate into `spec/workpackage-tracker-v3.md`, they move here with a tracker link._
