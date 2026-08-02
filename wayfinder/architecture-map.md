---
id: architecture-map
title: Employee Engagement Idea Generator — Technical Architecture Spec
labels: [wayfinder:map]
status: open
---

## Destination

A technical architecture spec for the Employee Engagement Idea Generator, handed off to an engineering team and written to also satisfy a security/data-privacy review — precise enough to build from without further open architectural decisions, and explicit about data flow wherever sensitive HR data is involved. It builds on the completed content spec's commitments ([`spec/content-spec.md`](../spec/content-spec.md)): HRBP-only raw data access, group-size-5 suppression, retention-until-next-cycle, hybrid RAG generation, the 71-initiative benchmark corpus. It does not revisit product/content decisions already locked there.

## Notes

- This is a follow-on effort to the closed content-spec map ([`wayfinder/map.md`](map.md)) — out-of-scope work there returns as a fresh effort, not a resumption, per wayfinder's own rule.
- Skills every session should consult: `/grilling` and `/domain-modeling` for decision tickets; the one Task ticket here is HITL (Samsung-internal knowledge the agent cannot look up itself).
- Standing constraint carried over from the content spec: raw HR data (exit-interview comments, employee details) is HRBP-only — every architecture decision must show how it's actually enforced, not just assumed.
- Plan-don't-do applies: this map produces an architecture spec, not the running system.

## Decisions so far

- [Task: Samsung internal infrastructure & AI policy inventory](architecture-tickets/A01-samsung-infra-inventory.md) — Claude Enterprise and Gemini Enterprise both available; on-prem hosting required for this data class. SSO fact split off into [A08](architecture-tickets/A08-sso-inventory.md).
- [Hosting environment](architecture-tickets/A03-hosting-environment.md) — on-prem, directly per A01's mandate (not a judgment call). Application, data store, and any model-serving must run within Samsung's on-prem infrastructure.
- [LLM hosting/provider strategy](architecture-tickets/A02-llm-hosting-strategy.md) — data is anonymized on-prem during ingestion before being sent to Claude Enterprise or Gemini Enterprise; the on-prem mandate governs raw/identifiable data, not anonymized data leaving the boundary. Anonymization method must hold up to the security review.
- [File ingestion pipeline](architecture-tickets/A07-file-ingestion-pipeline.md) — on-prem heuristic column classifier (structured vs. free-text); NER + regex anonymization with confidence-based quarantine for ambiguous PII; malformed files and ambiguous columns are rejected/flagged, never guessed.
- [Data storage & encryption design](architecture-tickets/A05-data-storage-encryption.md) — split-by-tier storage (raw files in object storage, derived/aggregate data in a DB); standard encryption everywhere; storage-layer (not app-layer) HRBP access enforcement; event-triggered deletion with immutable audit log.
- [RAG pipeline / vector store design](architecture-tickets/A06-rag-pipeline-design.md) — on-prem vector store + on-prem embedding model; retrieval filters by signal tag then ranks by similarity; corpus grows via agent-assisted, human-approved curation with event-triggered re-indexing.
- [Task: Samsung SSO/identity system inventory](architecture-tickets/A08-sso-inventory.md) — Samsung Knox (Enterprise Knox Services).
- [Identity & access control (SSO integration)](architecture-tickets/A04-identity-access-control.md) — federates to Knox via OIDC (pending confirmation); platform maintains its own team-to-HRBP mapping table, feeding A05's storage-layer enforcement.

## Not yet specified

- Scalability/load design — depends on rollout scope (how many HRBPs/teams will use it), not yet known.
- Audit logging / compliance certification requirements — depends on which hosting and LLM decisions win.

## Out of scope

- Anything already decided in the content spec (product behavior, quality rubric, output shape, etc.) — this map is architecture only.
