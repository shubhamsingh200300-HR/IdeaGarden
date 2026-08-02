---
id: "006"
title: Generation approach — curated corpus vs. pure LLM vs. hybrid RAG
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: ["004"]
---

## Resolution

**Hybrid RAG.** The LLM generates an idea tailored to the specific team's diagnosed signals (from stakeholder input + culture data analysis), retrieving grounding examples from the tagged benchmark corpus (ticket 005) at generation time to inform structure and tone — not copying a template verbatim, but not inventing ungrounded either. Pure LLM generation with no corpus reference was already ruled out by ticket 004's "precedent grounding" ranking dimension, which requires every idea to be checked against the corpus regardless of approach.

Rejected: pure corpus-matching/adaptation (select-and-adapt the closest real initiative). Reasoning: the corpus is a snapshot of 13 companies' documented programs, and real Samsung R&D teams will regularly present signals that don't map cleanly onto any single corpus entry — pure matching risks becoming "pick the least-bad template" exactly when the best answer would be a genuine synthesis. Hybrid RAG handles that case natively, while the gate-then-rank rubric (ticket 004) already supplies the guardrail against drifting into generic, ungrounded territory that pure LLM generation would have lacked.

## Question

Given the quality rubric (ticket 004), which generation mechanism actually guarantees ideas clear that bar: (a) a hand-vetted corpus of real benchmark initiatives that the system matches/adapts to a team's signals, (b) pure LLM generation driven by strong prompting and rubric-as-instructions with no fixed corpus, or (c) a hybrid where the LLM generates freely but retrieves grounding examples from the corpus at generation time? The decision should weigh: how much control each gives over avoiding generic output, how much upkeep the corpus requires over time, and how much novelty/adaptability each allows for team-specific signals the corpus doesn't already cover.
