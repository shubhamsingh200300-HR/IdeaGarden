---
id: "A03"
title: Hosting environment
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Question

Given A01's findings on Samsung's data-residency and cloud policy for sensitive HR data, where does this system run — on-prem Samsung infrastructure, Samsung's private/internal cloud, or public cloud (and if public cloud, under what data-handling constraints)? This decision shapes the storage design (A05) and needs to be defensible in a security review.

## Resolution

**On-prem**, directly per A01's finding that on-prem hosting is required (mandated, not a judgment call) for this data class. No further architecture-level decision needed here — the application, its data store, and any model-serving components must all run within Samsung's on-prem infrastructure. This is a hard constraint the remaining tickets (A05 storage design, A02 LLM strategy, A06 RAG pipeline) must respect.
