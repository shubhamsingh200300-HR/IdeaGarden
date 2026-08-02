---
id: "A02"
title: LLM hosting/provider strategy
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

**Anonymize before it ever reaches the LLM.** Data from the uploaded Excel files (survey responses, exit-interview comments, employee details) is anonymized/de-identified as part of the on-prem ingestion pipeline (A07) before being sent to either Claude Enterprise or Gemini Enterprise — both are approved and available (A01) — for hybrid RAG generation and free-text theme/sentiment extraction. This resolves the tension flagged when Hosting environment (A03) was decided: the "on-prem required" mandate governs where raw, identifiable data is stored and processed; what leaves the on-prem boundary to the cloud LLM never contains identifying information, so it isn't the same data class the on-prem mandate is protecting.

Not yet fixed here (left as build-time/implementation choices, not product-architecture decisions): which specific model handles generation vs. analysis, or whether both are used for different tasks. The anonymization method itself (what counts as sufficiently de-identified — e.g., name/employee-ID stripping vs. more aggressive techniques) should be validated against the security review this spec's destination is written for, since "anonymized" needs to hold up to actual scrutiny, not just be asserted.

## Question

Given the content spec's HRBP-only raw-data constraint, which model(s) power (a) the hybrid RAG idea generation and (b) free-text theme/sentiment extraction on exit-interview and survey comments? Does sending raw exit comments to an external LLM API violate the "HRBP-only" access commitment, or is it acceptable under an enterprise data-processing agreement with no retention/training on the data? Depends on A01's findings about what's actually available/approved.
