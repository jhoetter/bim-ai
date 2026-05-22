# Agent Prompt: Full Norms & Calculations Coverage Tracker

**Purpose:** Paste this entire prompt into a new agent session.
The agent will audit the current state, build a comprehensive tracker,
and then systematically implement all missing calculations and compliance
checks needed for a fully norm-compliant German BIM solution.

---

## ► PROMPT START (copy everything below) ◄

---

You are working on the **bim-ai** repository — a browser-first BIM authoring
and coordination platform targeting the German construction market.

Your job is a three-phase mission:

1. **Audit** — read the existing codebase and understand what is already
   implemented in terms of norms, calculations, and compliance checks
2. **Build a tracker** — create `spec/trackers/norms-calculations-tracker.md` that
   maps every domain of a fully norm-compliant German BIM solution to its
   implementation status and what still needs to be built
3. **Implement** — work through the tracker top-down, implementing missing
   calculations as Python modules in `app/bim_ai/`, with tests in
   `app/tests/`, and full norm references in every docstring

The goal is that bim-ai can credibly claim: **every calculation it performs
or advises on is traceable to a specific German or European norm, implemented
correctly, and tested.**

---

## PHASE 1: AUDIT — Read these files first

Before writing anything, read and internalize:

```
app/bim_ai/energy_lens.py          # U-value calculation — partly implemented
app/bim_ai/structure_lens.py       # structural classification only — no calculations
app/bim_ai/codes.py                # 3 door/corridor thresholds — minimal
app/bim_ai/area_calculation.py     # shoelace formula — no DIN 277 compliance
app/bim_ai/constructability_advisories.py  # geometric clash only
app/bim_ai/constructability_matrix.py
app/bim_ai/constraints_core.py
spec/lenses/energy-lens.md
spec/lenses/structure-lens.md
spec/lenses/fire-safety-lens.md
spec/lenses/cost-quantity-lens.md
spec/lenses/sustainability-lens.md
spec/lenses/mep-lens.md
spec/lenses/architecture-lens.md
```

Key findings you will confirm as you read:

- `energy_lens.py` computes U-values per DIN EN ISO 6946 (correct formula,
  correct R_si/R_se constants) but **explicitly does not implement GEG,
  DIN V 18599, or BAFA compliance** — the check against GEG limit values is
  missing entirely
- `structure_lens.py` classifies elements (load_bearing, column, beam) but
  performs **zero Eurocode calculations** — no loads, no pre-dimensioning
- `codes.py` has **3 hardcoded thresholds** — not a compliance engine
- `area_calculation.py` uses the shoelace formula correctly but does **not
  map to DIN 277 area types** (BGF, NUF, VF, TF) or WoFlV

---

## PHASE 2: BUILD THE TRACKER

Create `spec/trackers/norms-calculations-tracker.md` with the following structure.

For each domain, the tracker must record:

- **Norm / Standard** — exact document number and title
- **What it governs** — one sentence
- **Current status** — one of: `✅ implemented`, `⚠️ partial`, `❌ missing`
- **What exists** — file + function name if anything is there
- **What needs to be built** — precise description of the missing module/function
- **Priority** — `P0` (blocking, core product), `P1` (important), `P2` (nice-to-have)
- **Target file** — where the new code should live

Use this domain structure:

---

### Domain 1 — Area Calculation (Flächenberechnung)

| Norm | Governs | Status | Exists | To Build | Prio | Target |
| ---- | ------- | ------ | ------ | -------- | ---- | ------ |

Norms to cover:

- **DIN 277-1:2016** — Grundflächen und Rauminhalte im Bauwesen; defines BGF
  (Brutto-Grundfläche), NUF (Nutzungsfläche 1–7), VF (Verkehrsfläche), TF
  (Technische Funktionsfläche), BRI (Brutto-Rauminhalt)
- **WoFlV 2003** — Wohnflächenverordnung; residential area calculation with
  specific rules for sloped ceilings (< 1 m = 0%, 1–2 m = 50%, > 2 m = 100%),
  balconies (25–50%), terraces (25–50%)
- **BauNVO §§ 19–20** — GRZ (Grundflächenzahl) and GFZ (Geschossflächenzahl)
  calculation; what counts toward GRZ anrechnung (parking, paths, terraces)

---

### Domain 2 — Thermal Protection (Wärmeschutz)

Norms to cover:

- **DIN EN ISO 6946:2018** — U-value calculation: U = 1/(R_si + Σ(d/λ) + R_se)
  — `energy_lens.py::u_value_for_layers` → **⚠️ partial** (formula correct,
  material library incomplete, no validation against limit values)
- **DIN 4108-2:2013** — Mindestwärmeschutz: minimum R-values per component type
  (exterior wall ≥ 1.2 m²K/W, roof ≥ 1.75 m²K/W, floor slab ≥ 0.9 m²K/W);
  these are the absolute floor — below this is a building defect regardless of GEG
- **DIN 4108-3:2018** — Klimabedingter Feuchteschutz: Glaser method for dew-point
  analysis in building assemblies; sd-values, vapour diffusion resistance,
  permissible condensate accumulation
- **GEG 2024 (Gebäudeenergiegesetz)** — primary energy demand, U-value limits
  per component (§ 48 Tabelle 1: U_max exterior wall 0.24 W/m²K new build), annual
  primary energy demand QP, heating energy demand QH; Anforderungen für Neubau vs.
  Bestand (§§ 10–16 vs. §§ 47–52)
- **DIN V 18599:2018** — detailed energy need calculation (monthly balance method);
  this is the calculation method behind GEG compliance — very complex, mark as P2
  unless you implement a simplified version
- **DIN EN ISO 13788:2013** — surface condensation and mould growth risk (fRsi factor)

---

### Domain 3 — Sound Insulation (Schallschutz)

Norms to cover:

- **DIN 4109-1:2018** — Schallschutz im Hochbau; minimum sound insulation
  requirements: R'w values for party walls (≥ 53 dB MFH), party floors (≥ 54 dB),
  stairs (≥ 53 dB), doors (≥ 27 dB); impact sound level L'n,w (≤ 50 dB party floors)
- **DIN 4109-2:2018** — verification methods and calculation
- **DIN EN ISO 717-1** — rating of sound insulation (Rw, Ctr correction terms)
- **VDI 4100** — enhanced sound insulation classes (SSt I/II/III) above DIN 4109 minimum

---

### Domain 4 — Fire Protection (Brandschutz)

Norms to cover:

- **MBO §§ 26–32 + Anlage** — building class assignment (GK 1–5) based on height
  and number of units; fire resistance requirements per GK (F30/F60/F90 for load-
  bearing elements, R30/R60/R90 in Eurocode notation)
- **DIN 4102-4:2016** / **DIN EN 13501-2** — fire resistance classification:
  R (load-bearing), E (integrity), I (insulation); REI 60 = load-bearing + intact
  - insulated for 60 minutes
- **MBO § 33 + LBO** — escape routes: max. escape route length (35 m to protected
  staircase in GK 4/5), second escape route requirement, protected staircase
  requirements
- **MLAR 2005 (Muster-Leitungsanlagen-Richtlinie)** — penetration sealing for
  MEP through fire-rated assemblies; fire stop requirements per F-classification
- **MVStättVO** — assembly buildings (Versammlungsstätten): applies when > 200 persons
  in one room; triggers additional escape route, sprinkler, alarm requirements

---

### Domain 5 — Structural Pre-dimensioning (Tragwerk Vorbemessung)

Note: This module provides **pre-dimensioning guidance only** — not a substitute
for a structural engineer's full EC calculation. Every output must carry a
disclaimer: "Pre-dimensioning estimate only. Structural engineer sign-off required."

Norms to cover:

- **DIN EN 1990 (EC0):2021** — basis of structural design; load combinations:
  Ed = Σ(γG,j · Gk,j) + γQ,1 · Qk,1 + Σ(γQ,i · ψ0,i · Qk,i);
  fundamental combination for persistent/transient design situations
- **DIN EN 1991-1-1 (EC1):2010 + NA** — self-weight and imposed loads;
  floor loads per use: residential 2.0 kN/m², office 3.0 kN/m², staircase 3.0 kN/m²,
  corridor 3.0 kN/m², roof non-accessible 0.4 kN/m²; self-weight: reinforced
  concrete 25 kN/m³, steel 78.5 kN/m³, timber 5–8 kN/m³
- **DIN EN 1991-1-3 (EC1) + NA** — snow loads; Schneelastzonen 1–3 in Germany;
  sk values per zone and altitude; shape coefficient μ1 = 0.8 for flat roof
- **DIN EN 1991-1-4 (EC1) + NA** — wind loads; Windlastzonen 1–4; basic velocity
  pressure qb; terrain category; peak velocity pressure qp(z)
- **DIN EN 1992-1-1 (EC2) + NA** — concrete structures; pre-dimensioning rules:
  slab thickness l/30 for simply supported, l/35 for continuous; beam depth l/15;
  column effective length, buckling; minimum reinforcement; concrete cover
- **DIN EN 1993-1-1 (EC3) + NA** — steel structures; pre-dimensioning: I-beam
  selection for given span and load; buckling curve for columns; connection types
- **DIN EN 1995-1-1 (EC5) + NA** — timber structures; pre-dimensioning: BSH
  beam l/15–l/20; CLT slab l/30–l/35; modification factors kmod; service classes

Implementation approach for structural: implement as a `pre_dimensioning.py`
module that returns **advisory outputs with confidence levels**, not normative
results. Each function must include the EC reference in its docstring.

---

### Domain 6 — Accessibility (Barrierefreiheit)

Norms to cover:

- **DIN 18040-1:2010** — public buildings: turning circle ≥ 1.50 m diameter,
  door clear width ≥ 0.90 m, corridor width ≥ 1.50 m, threshold ≤ 2 cm,
  ramp gradient ≤ 6%, handrail requirements
- **DIN 18040-2:2011** — residential buildings (R designation = suitable for
  wheelchair users): same turning circle, WC space ≥ 1.50 × 2.20 m clear,
  shower without threshold, lift minimum cab 1.10 × 1.40 m clear (already in codes.py
  as a fact but not as a validated constraint)
- **MBO § 39 / BayBO Art. 37** — lift requirement: buildings with more than 4
  storeys (GK 4+) require at least one lift accessible from all entrance levels;
  minimum cab dimensions per DIN 18040-2

---

### Domain 7 — Cost & Quantities (Kosten und Mengen)

Norms to cover:

- **DIN 276:2018** — cost structure: KG 100 (site), KG 200 (development), KG 300
  (construction — building shell), KG 400 (technical systems), KG 500 (outdoor
  facilities), KG 600 (equipment), KG 700 (project costs); cost benchmark ranges
  per building type in €/m² BGF; Kostenermittlungsstufen (Schätzung LP2,
  Berechnung LP3, Anschlag LP6, Feststellung LP9)
- **HOAI 2021** — fee calculation: anrechenbare Kosten (KG 300+400, not KG 700),
  Honorarzonen I–V, Mindestsatz and Höchstsatz per Leistungsphase; full fee
  calculation formula from Anlage 1

---

### Domain 8 — MEP / TGA

Norms to cover:

- **DIN EN 12831:2017** — heating load calculation (Heizlastberechnung);
  design heat loss per room = transmission + ventilation losses; this is what
  sizing radiators and underfloor heating requires
- **DIN 1946-6:2019** — residential ventilation (Wohnraumlüftung);
  minimum air flow rates per room; KWL (controlled residential ventilation)
  system design; hygiene air flow qH per person, total building air flow
- **DVGW W 551:2004** — hot water systems; Legionella prevention; supply
  temperature ≥ 60°C at calorifier, circulation ≥ 55°C; pipe volume limits
  for dead legs; risk assessment triggers
- **VDE 0100 (series)** — electrical installations; circuit protection,
  earthing, RCD requirements; mostly advisory at BIM level (flag if
  circuit count looks inconsistent with room count)
- **DIN EN 806 / TRWI** — drinking water installation; pipe sizing, flow
  rates, pressure requirements

---

### Domain 9 — Planning Law (Planungsrecht)

Norms to cover:

- **BauNVO §§ 17, 19, 20** — GRZ calculation (built footprint / site area);
  GFZ calculation (sum of all floor areas / site area); what counts toward
  GRZ (§ 19 Abs. 4: garages, carports, paved areas count at 50%);
  maximum values per zone type (WA: GRZ 0.4, GFZ 1.2; MI: GRZ 0.6, GFZ 2.4)
- **MBO §§ 5–7 / BayBO Art. 6** — Abstandsflächen (setback distances):
  H × 0.4 to boundary (min. 3 m) in Bayern; 1H in MBO default; exceptions
  for side boundaries with fire wall; calculation per facade including roof pitch
- **MBO § 2 Abs. 3 / BayBO Art. 2** — Gebäudeklassen 1–5 assignment rules:
  GK 1: ≤ 7 m height, 1–2 units; GK 2: ≤ 7 m, > 2 units; GK 3: ≤ 7 m other;
  GK 4: ≤ 13 m; GK 5: > 13 m or special use — this is the gateway to all
  fire protection and accessibility requirements

---

### Domain 10 — Sustainability / LCA

Norms to cover:

- **DIN EN 15978:2012** — Sustainability assessment of buildings; life cycle
  assessment (LCA); GWP (Global Warming Potential in kg CO2-eq/m²·a), ODP, AP, EP;
  system boundary A1–A5 (production + construction), B6 (energy use), C3–C4 (disposal)
- **EU Taxonomy (Delegated Act 2021/2139)** — Do No Significant Harm criteria
  for buildings; primary energy demand thresholds for DNSH climate mitigation;
  relevant for institutional clients and ESG reporting
- **DGNB criteria** — not a norm but common in practice; ENV 1.1 (LCA), TEC 1.5
  (building envelope quality); advisory output only

---

## PHASE 3: IMPLEMENT — Execution order

After building the tracker, work through items in this priority order:

### P0 — Must have for credible BIM product

1. **GEG compliance check** (`app/bim_ai/geg_compliance.py`)
   - Input: U-values from `energy_lens.py`, building type, component type
   - Logic: compare against GEG 2024 Anlage 7 Table 1 limits
   - Output: `GEGComplianceResult` with pass/fail per component + advisory text
   - Norm reference in docstring: `GEG 2024 § 10 i.V.m. Anlage 7`
   - Test: residential exterior wall U=0.20 → pass; U=0.30 → fail

2. **DIN 4108-2 Mindestwärmeschutz check** (add to `energy_lens.py` or new module)
   - Independent of GEG — these are the absolute minimums
   - Exterior wall: R ≥ 1.2 m²K/W; Roof: R ≥ 1.75; Floor slab: R ≥ 0.9
   - A wall that fails DIN 4108-2 is a building defect, not just energy-inefficient

3. **DIN 277 area classification** (`app/bim_ai/area_din277.py`)
   - Extend `area_calculation.py` with area type mapping
   - Functions: `bgf_from_rooms()`, `nuf_by_category()`, `grf_from_gross_minus_walls()`
   - Each DIN 277-1 area type (NUF 1–7, VF, TF) as an enum with definition

4. **Building class determination** (`app/bim_ai/building_class.py`)
   - Input: building height (OKFF top floor above terrain), number of dwelling units,
     building use
   - Logic: MBO § 2 Abs. 3 classification tree
   - Output: GK 1–5 + which LBO applies (Bayern/NRW/etc.) + triggered requirements
     (lift, fire resistance, escape routes)
   - This is the gateway rule that everything else branches from

5. **GRZ/GFZ calculation** (extend `area_calculation.py` or new `planning_law.py`)
   - GRZ = (footprint + 50% of parking/paths) / site area
   - GFZ = sum of all floor areas (per BauNVO § 20) / site area
   - Flag if GRZ > plan maximum or GFZ > plan maximum

6. **DIN 4109 sound insulation advisory** (`app/bim_ai/sound_insulation.py`)
   - Input: wall/floor assembly material layers (mass per m² as proxy for Rw)
   - Rule of thumb: single-leaf homogeneous wall Rw ≈ 37.5 × log(m') - 42 dB
     (mass law — approximate, must be labelled as such)
   - Check against DIN 4109-1 minimum requirements per building situation
   - Output: advisory (not normative — mass law is a proxy, not a certification)

7. **Fire resistance classification check** (`app/bim_ai/fire_resistance.py`)
   - Input: GK (from building_class.py), element type (load-bearing wall/floor/column)
   - Output: required fire resistance class (R/E/I + minutes) per MBO Anlage
   - Check: does assigned material + thickness plausibly meet the requirement?
     (use lookup table, not calculation — REI 60 concrete ≥ 120 mm, etc.)

### P1 — Important for completeness

8. **Structural pre-dimensioning** (`app/bim_ai/pre_dimensioning.py`)
   - `floor_slab_thickness_mm(span_m, use) → dict` — l/30 rule + load check
   - `column_cross_section_mm(height_m, tributary_area_m2, floors, material)`
   - `beam_depth_mm(span_m, load_kn_per_m, material)`
   - Always returns `{"value_mm": X, "rule": "EC2 l/30", "disclaimer": "advisory only"}`

9. **Heating load estimate** (`app/bim_ai/heating_load.py`)
   - Simplified DIN EN 12831: transmission loss per element (A × U × ΔT) +
     ventilation loss (0.34 × n × V × ΔT); design temperature difference Germany
     -12°C interior to -14°C exterior (regional variation)
   - Output: kW per room + whole building; basis for radiator/UFH sizing

10. **WoFlV residential area** (extend `area_din277.py`)
    - Sloped ceiling rules, balcony/terrace percentage rules
    - Critical for rental and sale documentation

11. **Abstandsflächen / setback check** (extend `planning_law.py`)
    - Per facade: measure height H including roof pitch above terrain
    - Required setback = H × 0.4 (Bayern) or H × 1.0 (MBO default)
    - Check against measured distance to boundary from geometry

### P2 — Advanced / specialist

12. **GEG primary energy demand** — simplified monthly balance, or integration
    with external tool (PHPP, Energieberater export)
13. **LCA / GWP estimate** — material volume × GWP factor per material
    (ÖKOBAUDAT database as reference)
14. **DIN V 18599** — detailed energy balance; very complex, consider wrapping
    an external Python library rather than implementing from scratch
15. **DVGW W 551 Legionella risk** — pipe volume check, temperature advisory

---

## Implementation rules (apply to every new module)

**Docstring format** — every calculation function must have:

```python
def u_value_for_layers(doc, layers) -> dict:
    """Compute U-value per DIN EN ISO 6946:2018-03, Section 6.

    Formula: U = 1 / (R_si + sum(d_i / lambda_i) + R_se)
    Surface resistances: R_si = 0.13 m²K/W (interior), R_se = 0.04 m²K/W (exterior)
    per Table 1 of DIN EN ISO 6946 for horizontal heat flow.

    Returns dict with keys: u_value_w_per_m2k, r_total_m2k_per_w,
    layers (list of layer resistance contributions), warnings (list).

    Limitations:
    - Does not account for thermal bridges (ISO 14683 required for that)
    - Homogeneous layers only (no inhomogeneous layers per Annex C)
    """
```

**No silent failures** — every function must return a structured result that
includes a `warnings` list and an `advisory_only: bool` flag where relevant.

**Tests** — every new module needs tests in `app/tests/test_<module>.py`:

- At least one "known good" case verified against the norm example
- At least one boundary/edge case (zero thickness, missing lambda, etc.)
- At least one failure case that should return a warning

**No external norm text in code** — you may reference section numbers and
formula identifiers (e.g. "EC2 Eq. 5.1") but do not copy tables verbatim
from commercial norm publications. Implement the math; cite the source.

---

## Output of Phase 2 (the tracker file)

`spec/trackers/norms-calculations-tracker.md` must be machine-readable enough that
a future agent can:

- `grep "❌ missing" spec/trackers/norms-calculations-tracker.md` to find remaining work
- `grep "P0" spec/trackers/norms-calculations-tracker.md` to find next priority items
- Update a row's status from `❌ missing` to `⚠️ partial` or `✅ implemented`
  as work progresses

At the top of the tracker, maintain a **summary table**:

| Domain | Total checks | ✅  | ⚠️  | ❌  | P0 remaining |
| ------ | ------------ | --- | --- | --- | ------------ |

---

## ► PROMPT END ◄
