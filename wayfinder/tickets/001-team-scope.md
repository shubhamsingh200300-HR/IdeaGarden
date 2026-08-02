---
id: "001"
title: Team scope — pilot team vs. general platform
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

General, parameterized across all team types — the spec defines one framework covering SW engineers, architects, data scientists, design, and product, with team-type as a variable shaping which signals/initiatives apply. Not a pilot-on-one-function spec.

Rationale: the platform was scoped from the start to serve all five functions; a leadership pitch for a single-function tool is a harder sell than a platform pitch. Parameterizing at the spec stage is cheap — it mainly means the quality rubric and corpus tagging need a team-type dimension — the real cost of full generalization shows up later, at build/corpus-curation time, not here.

Downstream effect: tickets 002 (stakeholder definition), 003 (culture data sources), 004 (quality rubric), and 007 (output shape) should treat team-type as a first-class dimension rather than assuming a single audience.

## Question

Is this spec for a general capability that generates initiatives for *any* team type at Samsung R&D (SW engineers, architects, data scientists, design, product), parameterized per team — or is it scoped to a single pilot team/function first, with generalization deferred? This decision shapes how much the spec needs to account for cross-functional variance (e.g., what "engagement" means differently for a design team vs. a backend platform team) versus how narrowly it can assume one team's context throughout.
