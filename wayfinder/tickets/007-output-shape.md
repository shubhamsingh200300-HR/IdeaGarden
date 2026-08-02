---
id: "007"
title: Output shape — what a generated initiative contains
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: ["004", "006", "009"]
---

## Resolution

**Presentation:** a top 3-5 ranked list per request (not a single verdict, not the full gate-passing set) — gives the manager/HRBP real choice without dumping the ranking work back on them.

**Precedent grounding (ticket 004's ranking dimension) is internal only** — not shown to the user. Ideas are not labeled with the benchmark corpus entry they're grounded in; the corpus reference exists purely to inform generation and scoring.

**Per-idea fields (seven, no more):**
1. **Title** — short name for the initiative.
2. **Description** — what it is and how it runs.
3. **Signal addressed** — the specific diagnosed issue it targets (e.g., "low autonomy score, Q2 survey, backend platform sub-team"), so the manager sees why it was suggested.
4. **Structural format** — cadence (one-time/recurring/standing) and what running it looks like day-to-day.
5. **Suggested ownership & sponsorship level** — team-level, org-level, or needs exec sign-off.
6. **Estimated effort/cost** — rough time and budget ask, checked against the manager's stated constraints (ticket 002); **cost/budget is denominated in INR**.
7. **Suggested success metric** — how the team would know it worked, tied to the signal it's meant to move.

No confidence scores or raw rubric scores are shown — the output is a clean, actionable card, not a view into the ranking mechanics.

## Question

Given the quality rubric (ticket 004) and generation approach (ticket 006), what fields does a single generated initiative actually contain — e.g., title, description, the specific signal/pain point it addresses, structural format (cadence/ownership/resourcing), suggested sponsorship level, estimated effort/cost, expected success metric, and (if the corpus-matching approach won) a reference to the benchmark initiative it's adapted from? This fixes the concrete artifact the platform produces per idea, which the human-in-the-loop decision (ticket 008) then governs the review of.
