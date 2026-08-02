---
id: map
title: Employee Engagement Idea Generator — Content Spec
labels: [wayfinder:map]
status: open
---

## Destination

A detailed content/product spec for an employee-engagement idea generator platform serving Samsung R&D's engineering-adjacent teams (SW engineers, architects, data scientists, design, product) — precise enough that an engineering team could build it without further open decisions. Covers data inputs, idea-generation approach, quality bar/rubric, and output format. Excludes technical architecture (stack, system design) — that's a follow-on effort. A short companion pitch summary for leadership buy-in is derived from this spec once it's done, not tracked as separate tickets.

## Notes

- Domain: employee engagement / culture programs at a large tech R&D org (Samsung R&D, mobile software engineering).
- Skills every session should consult: `/grilling` and `/domain-modeling` for decision tickets, `/research` for research tickets.
- Standing quality bar: benchmark against Netflix, Atlassian, Airbnb, Google, Microsoft, Canva-caliber culture initiatives. Explicitly reject generic ideas (team outings, cake-cutting, one-off perks) — the spec must operationalize *why* an idea clears or fails this bar, not just assert it.
- Plan-don't-do applies: this map produces a spec, not the running app.

## Decisions so far

- [Research: benchmark corpus of top-tier culture initiatives](tickets/005-research-benchmark-corpus.md) — 71 cited initiatives across 13 companies, grouped by 8 signals; grounds the quality rubric and generation-approach tickets.
- [Team scope — pilot team vs. general platform](tickets/001-team-scope.md) — general, parameterized across all five team types (SW eng, architects, data scientists, design, product); not pilot-first.
- [Stakeholder definition — who inputs what](tickets/002-stakeholder-definition.md) — Manager (free-text context + constraints) and HRBP (annual culture survey Excel upload, AI-analyzed and sliceable by parameters, + free-text context); veto/approval authority deferred to ticket 008.
- [Culture data sources — what exists and what's usable](tickets/003-culture-data-sources.md) — three sources (annual survey required; pulse survey and exit/attrition data optional), each with its own upload path but a shared dynamic AI analysis mechanism handling both structured columns (slicing) and free-text columns (theme extraction), no fixed schema.
- [Quality bar / rubric — operationalizing "top-tier, not generic"](tickets/004-quality-rubric.md) — gate (4 hard disqualifiers: specific signal, structural/recurring, owned & resourced, not a generic perk) then rank (weighted: fit, feasibility, structural ambition, precedent grounding).
- [Generation approach — curated corpus vs. pure LLM vs. hybrid RAG](tickets/006-generation-approach.md) — hybrid RAG: LLM generates tailored ideas grounded via retrieval from the tagged benchmark corpus; pure corpus-matching rejected (force-fits novel signals), pure LLM already excluded by ticket 004's precedent-grounding rank dimension.
- [Data privacy & access control for sensitive HR inputs](tickets/009-data-privacy-access-control.md) — raw comments HRBP-only; min. group size 5 with roll-up before any slice is shown; raw data retained until superseded by next cycle, aggregate insights kept indefinitely.
- [Output shape — what a generated initiative contains](tickets/007-output-shape.md) — top 3-5 ranked ideas per request, 7 fields each (title, description, signal addressed, structural format, ownership/sponsorship, effort/cost in INR, success metric); precedent grounding kept internal, not shown.
- [Human-in-the-loop — vetting before delivery](tickets/008-human-in-the-loop.md) — HRBP-only output; platform is HRBP-facing tool, manager is input-only and never sees output directly; HRBP can regenerate a batch if none of the 3-5 ideas fit.
- [Post-launch impact measurement — tracking the suggested success metric](tickets/010-post-launch-measurement.md) — HRBP marks an idea "adopted"; platform then auto-compares the targeted signal's score across the next survey cycle. Feedback loop scoped to that same team's future generations only, not the shared corpus.

## Not yet specified

_(none — the frontier is clear)_

## Out of scope

- Technical architecture (stack, system design, data pipeline implementation) — ruled out of this spec's destination; a follow-on effort once the product shape is locked.
- Whether/how this integrates with existing Samsung systems (HR tools, survey platforms) — on reflection this is an integration/architecture concern, not a content-spec one (the content model — HRBP uploads Excel files, per ticket 003 — is unaffected either way); folded into the technical-architecture follow-on effort above rather than kept as separate fog.
