---
id: "008"
title: Human-in-the-loop — vetting before delivery
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: ["007"]
---

## Resolution

The platform is HRBP-facing: **output (the top 3-5 ranked ideas) goes exclusively to the HRBP**, who decides independently which initiative to run with the team. The manager (ticket 002) is an input source only — their free-text context and constraints shape generation and ranking — but they are not a separate recipient of output and are not a review/approval gate. There is no HRBP-approves-before-manager-sees-it step either, since the manager never sees the platform's output directly; if the HRBP wants the manager's buy-in before running something, that's their own judgment call, not a mandated workflow step.

**On rejection: the HRBP can regenerate.** If none of the 3-5 ideas fit, the HRBP can request a fresh batch, optionally adjusting inputs first (more context, a loosened/tightened constraint) rather than being stuck picking the least-bad option from a single final list. This protects the platform's top-tier quality bar — a one-shot, no-recourse generation would force settling in exactly the cases where refining the input would produce a genuinely better fit.

## Question

Given the output shape (ticket 007), does a person (HRBP, manager, the requesting stakeholder) review/edit/approve generated initiatives before a team sees them, or does the platform deliver directly? If review is required, at what granularity — every idea, or spot-checks — and what happens on rejection (regenerate, discard, escalate)? This decision determines whether the spec needs a review/approval workflow as part of the product surface, or whether generation quality alone is trusted to gate output.
