# Rayon Design Language Tracker

> Generated 2026-05-09 after watching 3 Rayon YouTube videos (20-min demo,
> 15-min tutorial, architect workflow, 2026 CAD comparison).
>
> Goal: make bim-ai's plan view and overall chrome feel as polished as Rayon.
> 3D rendering improvements are tracked separately (later milestone).

---

## What Rayon Looks Like (source of truth)

From the videos:

**Canvas / Plan View**
- White paper-like canvas as the drawing surface; dark chrome surrounds it
- Walls: solid BLACK fill — architectural section-cut convention, no ambiguity
- Floor zones: richly textured fills — chevron wood, terrazzo, beige carpet,
  limestone tiles, white concrete, each at ~50-70% opacity so outline still reads
- Annotations: RED accent color (company red ~#d93535), crisp, well-spaced
- Dimension chains: clean, thin witness lines, text above dim line
- North point + scale bar: always present as standard drawing blocks
- Grid: very subtle, almost invisible in light mode

**Chrome (dark mode primary)**
- Very dark navy/charcoal sidebar (#1a1d24 range)
- Compact left rail: tabs for Layers / Blocks / Shapes / Pages / Tables / Comments
- Bottom toolbar: primary drawing tools as icon strip
- Right panel: context-sensitive properties (fill, stroke, thickness, layer)
- Minimal header: just logo + share + account
- Red accent for active states, selections, and annotation elements
- Clean Inter-family typography

**Collaboration**
- Named cursors (live presence) — subtle, non-intrusive
- Comment pin system on drawings
- Share modal with editor/admin/viewer roles
- "Publish to web" one-click link sharing

**Key UX patterns**
- Bottom toolbar + keyboard shortcuts (W = wall, etc.)
- Type-to-search command palette (similar to our Cmd+K)
- Eyedropper to copy styles between zones
- Click-to-measure quick dimensions
- DWG/DXF import with rescale dialog
- AI block generator ("type what you need")
- Template library (hundreds of starter layouts)

---

## bim-ai Status vs Rayon

### Plan View Visual Quality

| Item | Rayon | bim-ai | Priority |
|------|-------|--------|----------|
| Wall fill (plan) | Black solid | ✅ #1c1917 via --plan-wall (token split) | DONE |
| Floor fill | Chevron/texture at ~50-70% opacity | ✅ Herringbone hatch at 42% opacity | DONE |
| Room fills | Rich texture fills per room | ✅ Sage green at 26% opacity | DONE |
| Annotation color | Company red | ✅ Warm red-ochre (--draft-anno) | DONE |
| Dim line quality | Clean thin lines, red text | ✅ dimLine color fixed; witness → --draft-witness | DONE |
| Hatch density | Dense, visible at 1:100 | ✅ paperMmRepeat 8→5, strokeWidth 0.12→0.18 | DONE |
| Floor hatch opacity | 50-70% | ✅ 42% (up from 16%) | DONE |
| Wall hatch inside cut | Brick/concrete hatching inside wall body | ✅ 45° diagonal hatch, paper-color at 22% opacity, via buildWallCutHatch() in planElementMeshBuilders.ts | DONE |
| North point | Standard block always shown | ✅ Half-filled circle compass overlay, bottom-left of plan canvas | DONE |
| Scale bar | Standard block always shown | ✅ Two-tone graphical scale bar in zoom control button (alternating segments + cm label) | DONE |
| Zone area labels | Auto-calculated m² per room | ✅ Area appended to planTagLabel pill: "name · X.X m²" in symbology.ts | DONE |
| Grid visibility | Near-invisible, just guides | ✅ #e4e6e8 / #f0f1f2 (near-invisible) | DONE |

### Chrome / UI Quality

| Item | Rayon | bim-ai | Priority |
|------|-------|--------|----------|
| Left rail tabs | Layers / Blocks / Pages / Comments | Inspector + nav | MEDIUM |
| Right properties | Fill, stroke, thickness inline | Right-rail inspector | DONE |
| Bottom toolbar | Primary tools in strip | Present (Tool modifier bar) | DONE |
| Theme toggle | Visible bottom-left | Hidden behind presence strip | FIXED |
| Active tool highlight | Red accent on active tool | ✅ bg-accent (warm amber) — confirmed correct in ToolPalette.tsx:130 | DONE |
| Presence avatars | Subtle named cursors | Fixed to 1 in dev | DONE |
| Share button | Top-right, prominent | Present (share presentation) | DONE |
| Keyboard shortcuts | W=wall shown in tooltip | Present via Cmd+K | DONE |

### Features bim-ai has beyond Rayon

- True 3D BIM model with geometry
- AI agent for model generation from text/sketch
- IFC export
- Real BIM elements (proper parametric walls, floors, roofs)
- Version history (milestones)
- Job queue panel
- Phasing
- Schedule views
- Sun/shadow simulation
- Activity stream

### Features bim-ai is missing vs Rayon

| Feature | Rayon | bim-ai | Notes |
|---------|-------|--------|-------|
| Room fill textures | Rich per-room material fills | Not implemented | High visual impact |
| Block library | 4000+ furniture/fixture 2D blocks | Not implemented | Rayon's killer feature |
| DWG/DXF import | First-class import + rescale | Not implemented | Major workflow |
| Template library | Hundreds of starter layouts | Not implemented | Onboarding |
| Zone tool | Click-once room area draw | Room tool exists | Needs area auto-label |
| Eyedropper style copy | One-click copy fill between elements | Not implemented | Quick UX win |
| Scale tool | Rescale selected elements to known dim | Not implemented | Import workflow |
| AI block generator | Type → generate 2D block | Not implemented | AI feature |
| Multi-view sections | Blocks with top/side/front views | Not implemented | 2D drawing |
| North point block | Standard library block | Not implemented | Documentation |
| Scale bar block | Standard library block | Not implemented | Documentation |

---

## Immediate Action Items (this sprint)

These are purely visual/CSS changes — no new features, high impact:

### P0 — Fix floor fill opacity (today)

`PLAN_FLOOR_FILL_OPACITY_BASE` in `packages/web/src/plan/symbology.ts:296` is 0.16.
Rayon uses ~50-70% for floor fills. Raise to 0.42 for the base.
Also: `PLAN_ROOF_FILL_OPACITY_BASE` at 0.2 → raise to 0.35.

File: `packages/web/src/plan/symbology.ts`

### P0 — Hatch density for plan floor

`CATEGORY_DEFAULT_HATCH.floor = 'herringbone'` with `paperMmRepeat: 8` in HatchRenderer.
At 1:100 scale this renders too sparse to see. Reduce to 5mm repeat for herringbone.

File: `packages/web/src/plan/HatchRenderer.ts`

### P1 — Room mesh fill (not just outline)

Currently `roomMesh()` in `planElementMeshBuilders.ts` renders rooms as outline only.
Add a filled polygon mesh below the outline, reading `--plan-room-fill` token at 30% opacity.
This gives the Rayon "zone" look — colored room fills with outline on top.

### P1 — Wall hatch inside body

Rayon's walls show brick/concrete hatch inside the solid black wall body.
Implement a hatch SVG overlay in the wall cut polygon using `--draft-cut` color at 60% opacity.
This is the biggest single visual quality jump for plan view.

### P2 — Tighten grid visibility

`--draft-grid-major` and `--draft-grid-minor` in light mode are too prominent.
Light mode: grid-major → `#e8eaec`, grid-minor → `#f2f3f4` (near-invisible).
Dark mode already tuned (hsl(25 6% 16%) / hsl(25 5% 12%) from UX polish).

### P2 — Annotation font size / weight

Plan annotation sprites in `planElementMeshBuilders.ts` use fontSize=11.
Rayon annotations are slightly smaller and lighter. Consider 10px, fontWeight=400.
Color already set to --draft-anno (warm red-ochre). ✅

---

## 3D Rendering Improvements (later milestone — deferred)

Separate from plan view polish. What "Rayon-style 3D" would look like:

**Material tone targets:**
- Walls: warm cream/plaster (#e8e3db light mode) — now fixed via --cat-wall split
- Floors: warm oak/concrete depending on material
- Roof: warm terracotta clay
- Glazing: very light blue-grey, high transparency

**Lighting targets:**
- Soft directional from SW at 35° elevation (golden hour feel)
- Strong hemi ambient (sky: warm white, ground: warm ochre)
- No harsh shadows in ambient viewport; shadows only in "render" mode
- Mild SSAO for depth cues without looking dirty

**UX targets for 3D:**
- No visible grid plane (hide the horizontal grid in 3D mode)
- Soft horizon fog
- Smooth camera transitions
- ViewCube: clean, minimal (F/B/R/L/T/Bt labels done ✅)

---

## Feature Gap Roadmap (future WPs)

These require actual feature work — not in scope for visual polish sprint:

| WP candidate | Feature | Rayon equivalent | Complexity |
|---|---|---|---|
| AST-V4-01 | 2D block/furniture library | Rayon 4000+ blocks | Large |
| IMP-V4-01 | DWG/DXF import | Rayon import + rescale | Large |
| TPL-V4-01 | Project template library | Rayon hundreds of templates | Medium |
| ZNE-V4-01 | Zone tool with auto area | Rayon zone tool | Small |
| STY-V4-01 | Eyedropper style copy | Rayon eyedropper | Small |
| SCL-V4-01 | Scale selection tool | Rayon scale tool | Small |
| ANN-V4-01 | North point + scale bar as blocks | Rayon standard blocks | Small |
| AIG-V4-01 | AI block generator | Rayon AI panel | Large |

---

## Visual Tokens Quick Reference

Current plan-view tokens (tokens-drafting.css):

```
--plan-wall:    light=#1c1917  dark=#d8d2ca   (plan section cut)
--plan-floor:   light=#e8e2d8  dark=#2e2a26   (floor fill)
--plan-door:    light=#2d2a27  dark=#c8c0b8   (door cut)
--plan-stair:   light=#2a2825  dark=#b8b4ae   (stair cut)
--plan-railing: light=#3a3632  dark=#9a948e   (railing)
--draft-anno:   light=#b5451b  dark=#e8703a   (dimensions, tags)
--draft-paper:  light=#fdfcf9  dark=#1a1d24   (canvas background)
--draft-cut:    light=#1d2330  dark=#e6e8ee   (cut line color)
```

Current 3D category tokens:

```
--cat-wall:   light=#ddd8d0  dark=#6a6460   (3D wall surface)
--cat-floor:  light=#cfc9be  dark=#4a4540   (3D floor surface)
--cat-door:   light=#b8a898  dark=#7a7068   (3D door face)
--cat-stair:  light=#c4bdb4  dark=#5e5a56   (3D stair)
--cat-railing:light=#a89e96  dark=#4e4a46   (3D railing)
```
