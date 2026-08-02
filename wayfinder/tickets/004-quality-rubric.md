---
id: "004"
title: Quality bar / rubric — operationalizing "top-tier, not generic"
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

**Gate, then rank.** A hard binary gate filters out anything generic before scoring ever applies; everything that survives is ranked for the requesting team.

**Gate (idea must pass all four):**
1. Addresses a specific, named signal drawn from the diagnosed data (survey slice, exit theme, stakeholder input) — not a vague aim like "boost morale."
2. Is structural or recurring, not a single unrepeatable event — a standing program, a recurring cadence, or a policy/operating-model change.
3. Has a defined owner and resourcing shape (team/org/exec-sponsored, rough time/budget cost) — not "the team should just start doing X" with no owner.
4. Is not on the explicit generic-perk exclusion list (team outings, cake/birthday celebrations, one-off swag, free snacks, unstructured "fun" events with no link to a diagnosed signal).

**Ranking (weighted, among gate-passing ideas), highest weight first:**
1. **Fit to the diagnosed signal** (highest) — precision of targeting vs. loose relevance.
2. **Feasibility given stated constraints** (highest) — respects the manager's budget/time/headcount limits (ticket 002); an unaffordable idea ranks below an equally strong feasible one.
3. **Structural ambition** — where it sits from "recurring event" → "standing program" → "policy/operating-model change."
4. **Precedent grounding** — how directly it traces to a real, proven pattern in the benchmark corpus (ticket 005) vs. being unprecedented.

Rationale: this gate reliably excludes cake-cutting/team-outings (they fail signal-specificity, recurrence, and ownership simultaneously) without excluding real best-in-class initiatives, since the corpus shows even entries lacking quantified impact evidence still satisfy all four gate criteria — "measured ROI" is deliberately *not* a hard requirement, only a (minor) ranking input via precedent grounding. Fit and Feasibility outrank Structural ambition and Precedent grounding so the platform never recommends an impressive-sounding but unusable idea over a usable, well-targeted one.

Exact numeric weights are left as a build-time detail, not fixed in this content spec.

## Question

What concretely distinguishes a "top-tier" initiative (Netflix/Atlassian/Airbnb/Google/Microsoft/Canva-caliber) from a generic one (team outing, cake-cutting, one-off perk) in terms the spec can enforce mechanically — e.g., specificity to a diagnosed signal, structural/systemic nature vs. one-off event, executive sponsorship level, resourcing requirements, measurability of impact? The output is a rubric (a checklist or scored set of criteria) that any generated idea must pass, usable both to filter/rank generated ideas and to tag the benchmark corpus (ticket 005) for matching. This rubric should draw on the benchmark corpus research where available, but the underlying principles can be scoped before the corpus is fully populated.
