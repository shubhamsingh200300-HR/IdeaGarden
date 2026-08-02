---
id: "A04"
title: Identity & access control (SSO integration)
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: ["A08"]
---

## Resolution

1. **Authentication: federate to Samsung Knox via OIDC**, as the default for a new application — simpler token-based flow, widely supported by modern frameworks. Flagged as **pending confirmation** against what Knox actually exposes; if Knox only supports SAML for this integration, the spec should be updated accordingly. This is a fact to verify with whoever owns Knox integration, not fixed purely by this recommendation.
2. **Team authorization: the platform maintains its own team-to-HRBP mapping table**, rather than querying an external Samsung HR system of record. Querying a real HRIS would be the more elegant long-term answer, but committing to it now would mean guessing at a system's existence and accessibility, or spinning up another fact-finding task (as A01/A08 required) before this ticket could close. An internal, platform-maintained mapping is buildable immediately; real HR-system integration is a plausible v2 improvement, not a blocker.

This mapping table is what feeds the storage-layer enforcement pattern already decided in A05 (per-team ACLs/prefixes on object storage, row-level security in the database) — the authenticated Knox identity resolves to a set of authorized teams via this table, and that scope is what RLS/ACLs actually check.

## Question

Given A01's findings on Samsung's standard identity/SSO pattern, how does the platform authenticate HRBPs, and how is the content spec's "HRBP-only raw access" (ticket 009 of the content-spec map) technically enforced — role-based access control tied to SSO identity, row-level security in the data store, or another mechanism? This is the concrete answer to the Samsung-systems integration question the content spec deliberately deferred to this effort.
