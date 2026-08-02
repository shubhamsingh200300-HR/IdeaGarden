# Employee Engagement Idea Generator — Content Spec

**Status:** Ready to build from. This spec covers product/content behavior only — data model, generation logic, quality bar, and output. Technical architecture (stack, system design, data pipeline implementation, and integration with existing Samsung systems) is explicitly out of scope; see [Out of scope](#out-of-scope).

**Full decision trail:** [`wayfinder/map.md`](../wayfinder/map.md) and its child tickets record the reasoning behind every decision below.

---

## 1. What this is

An HRBP-facing tool that generates top-tier, evidence-grounded engagement/culture initiatives for a specific team at Samsung R&D — benchmarked against real programs from Netflix, Atlassian, Airbnb, Google, Microsoft, Canva, and comparable engineering-culture leaders. It replaces generic, low-effort ideas (team outings, cake-cutting, one-off perks) with initiatives that are specific to a diagnosed signal, structurally real, and feasible for the requesting team.

## 2. Scope

The platform is **general and parameterized across all five team types** at Samsung R&D: software engineers, architects, data scientists, design, and product. It is not built for one function and extended later — team-type is a first-class dimension throughout the data model, from how signals are interpreted to which corpus initiatives are considered relevant.

## 3. Who uses it, and what they provide

The platform is **HRBP-facing**. The HRBP is the sole user who receives generated output and decides what to run with their team.

| Role | Provides | Does not |
|---|---|---|
| **HRBP** | Annual culture survey upload (required); optional pulse survey and exit/attrition data uploads; free-text organizational context (attrition events, reorgs, sensitive dynamics) | — |
| **Manager** | Free-text situational context (what they think is going on with the team) + constraints (budget, time, headcount/logistics the generator must respect) | No structured ratings (would duplicate survey data); never receives generated output directly |

The manager's input shapes generation and ranking but the manager is not a separate recipient — there is no manager-facing view of results.

## 4. Data sources & analysis

Three upload types, each with its own dedicated upload path in the platform:

1. **Annual culture survey** (required) — `.xlsx`, HRBP-uploaded.
2. **Pulse survey results** (optional) — same tabular shape as the annual survey.
3. **Exit/attrition data** (optional) — `.xlsx` mixing structured employee details (tenure, role, department, exit date) with free-text qualitative content (exit interview comments, HRBP/manager discussion notes).

**No fixed schema.** The AI analysis layer dynamically works with whatever columns a given upload contains — it does not assume a predefined dimension list, since Samsung's real export formats will vary by team and cycle. The same analysis mechanism handles both column types found across all three sources:

- **Structured columns** → slicing/filtering by whatever dimensions exist (e.g., sub-team, tenure, role, level).
- **Free-text columns** → qualitative theme/sentiment extraction (e.g., surfacing that "career growth" or "recognition" recurs across exit comments).

## 5. Quality bar: gate, then rank

Every generated idea passes through a two-stage filter before it can appear in output.

### 5.1 Gate (hard disqualifiers — must pass all four)

1. **Addresses a specific, named signal** drawn from the diagnosed data (a survey slice, an exit theme, stakeholder input) — not a vague aim like "boost morale."
2. **Is structural or recurring, not a single unrepeatable event** — a standing program, a recurring cadence, or a policy/operating-model change.
3. **Has a defined owner and resourcing shape** — team/org/exec-sponsored, with a rough time/budget cost — not "the team should just start doing X" with no owner.
4. **Is not on the generic-perk exclusion list** — team outings, cake/birthday celebrations, one-off swag, free snacks, unstructured "fun" events with no link to a diagnosed signal.

This gate is deliberately not built around "has measured ROI" — the 71-initiative benchmark corpus (Section 7) shows many genuinely top-tier programs have no public quantified impact evidence, relying instead on structural and organizational credibility. Requiring proof of ROI would disqualify real best-in-class patterns.

### 5.2 Rank (weighted scoring among ideas that pass the gate)

Highest weight first:

1. **Fit to the diagnosed signal** — precision of targeting vs. loose relevance.
2. **Feasibility given stated constraints** — respects the manager's budget/time/headcount limits; an unaffordable idea ranks below an equally strong feasible one.
3. **Structural ambition** — where it sits from "recurring event" → "standing program" → "policy/operating-model change."
4. **Precedent grounding** — how directly the idea traces to a real, proven pattern in the benchmark corpus vs. being unprecedented. *(Internal scoring signal only — never shown to the user; see Section 8.)*

Fit and Feasibility outrank Structural ambition and Precedent grounding so the platform never surfaces an impressive-sounding but unusable idea over a well-targeted, actionable one. Exact numeric weights are a build-time tuning detail, not fixed by this spec.

## 6. Generation approach: hybrid RAG

The system uses **hybrid retrieval-augmented generation**: an LLM generates an idea tailored to the specific team's diagnosed signals, retrieving grounding examples from the tagged benchmark corpus (Section 7) at generation time to inform structure and tone. It does not copy a corpus entry verbatim (pure corpus-matching), nor does it generate freely with no corpus reference (pure LLM) — the latter was already excluded by the rubric's precedent-grounding ranking dimension, which requires every idea to be checked against the corpus regardless of approach.

Pure corpus-matching/adaptation was considered and rejected: the corpus is a snapshot of 13 companies' documented programs, and real Samsung R&D teams will regularly present signals that don't map cleanly onto any single entry. Forcing a match in those cases risks "pick the least-bad template" rather than a genuine, well-targeted synthesis.

## 7. Benchmark corpus

A curated, cited reference set of **71 real initiatives across 13 companies** (Netflix, Atlassian, Airbnb, Google, Microsoft, Canva, plus Spotify, Stripe, GitHub, Shopify, Basecamp/37signals, HashiCorp, Figma), grouped by the primary engagement signal each addresses: Autonomy & Ownership, Growth & Mastery, Recognition, Cross-Team Visibility, Psychological Safety, Belonging & Inclusion, Career Progression Clarity, Purpose & Impact Visibility.

Every entry is sourced to first-party material (company engineering/culture blogs, official program pages) or named, attributed business press where no first-party source exists. Where no public impact evidence exists for an otherwise legitimate initiative, the corpus says so explicitly rather than inventing numbers. See [`wayfinder/research/benchmark-corpus.md`](../wayfinder/research/benchmark-corpus.md) for the full corpus.

This corpus is the grounding material for both the quality rubric's precedent-grounding dimension (Section 5.2) and the generation approach's retrieval step (Section 6). It is maintained independently of any single team's output — see Section 10 on why per-team outcomes do not automatically feed back into it.

## 8. Output shape

Each HRBP request returns a **ranked list of 3-5 ideas** — enough to give real choice without dumping the full ranking problem back on the user.

Each idea contains exactly seven fields:

1. **Title** — short name for the initiative.
2. **Description** — what it is and how it runs.
3. **Signal addressed** — the specific diagnosed issue it targets (e.g., "low autonomy score, Q2 survey, backend platform sub-team"), so the HRBP can see why it was suggested.
4. **Structural format** — cadence (one-time/recurring/standing) and what running it looks like day-to-day.
5. **Suggested ownership & sponsorship level** — team-level, org-level, or needs exec sign-off.
6. **Estimated effort/cost** — rough time and budget ask, checked against the manager's stated constraints. **Denominated in INR.**
7. **Suggested success metric** — how the team would know it worked, tied to the signal it's meant to move.

No confidence scores, raw rubric scores, or corpus attribution are shown. The output is a clean, actionable card — not a view into the ranking or retrieval mechanics.

## 9. Workflow: HRBP-only, with regeneration

The HRBP receives the ranked list and decides independently which initiative (if any) to run with the team. There is no additional approval gate before the HRBP sees output, and the manager is never shown the platform's output directly.

If none of the 3-5 ideas fit, the **HRBP can regenerate** — requesting a fresh batch, optionally after adjusting inputs (adding context, loosening/tightening a constraint) — rather than being forced to settle for the least-bad option from a single final list.

## 10. Post-launch measurement

Each idea's suggested success metric (Section 8) is tracked as follows:

1. **"Mark as adopted"** — the HRBP flags which of the 3-5 ideas (if any) they actually ran. This is the only manual step required.
2. **Automatic cycle comparison** — the platform automatically compares the targeted signal's score between the survey cycle that triggered the recommendation and the next cycle (annual or pulse upload), using the same analysis mechanism as Section 4. No further HRBP effort is needed once an idea is marked adopted.

**Feedback loop is scoped per-team, not to the shared corpus.** Adopted initiatives and their tracked outcomes inform future generations *for that same team* (e.g., avoid re-suggesting a variant of something that already didn't move the signal). Outcomes do not automatically feed into the benchmark corpus (Section 7) — doing so would require a new quality bar for distinguishing genuine strong outcomes from flukes or confounded results, which is not designed in this version. Corpus-contribution from real outcomes is a plausible future extension.

## 11. Data privacy & access control

The platform handles genuinely sensitive HR data — named individuals' exit-interview comments, employee details, and survey responses that may be identifiable at fine slicing granularity.

- **Raw individual comments (exit interviews, free-text survey responses) are visible to the HRBP only**, plus the AI's internal processing. No one downstream — including the manager — ever sees raw text, only derived, de-identified insights. The HRBP already has this access by definition (they uploaded the data, likely conducted the interviews); extending raw visibility to managers risks employees self-censoring exit/survey feedback, which would degrade the platform's own data source.
- **Minimum group size of 5 before any slice is shown**, with graceful roll-up rather than hard suppression — a slice smaller than 5 (e.g., "0-1yr tenure engineers citing low autonomy") is silently rolled into the next-broader group (e.g., "0-3yr tenure") rather than hidden outright or shown as-is.
- **Raw data is retained until superseded by the next cycle** (the following year's upload for that team), then deleted. De-identified aggregate themes/insights are retained indefinitely to support year-over-year trend comparison.

## Out of scope

- **Technical architecture** — stack, system design, data pipeline implementation. A follow-on effort once this product shape is locked.
- **Integration with existing Samsung systems** (HR tools, survey platforms, SSO) — an integration/architecture concern; the content model here (HRBP uploads a file, Section 4) is unaffected regardless of how or whether integration happens. Folded into the technical-architecture follow-on above.
- **Corpus contribution from real per-team outcomes** — considered in Section 10 and explicitly deferred; a plausible v2 extension once a quality bar for internal outcome data exists.
