---
id: "A05"
title: Data storage & encryption design
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: ["A03"]
---

## Resolution

1. **Storage shape: split by tier.** Raw uploaded files go into on-prem object storage with tight, narrowly-scoped access controls; derived structured data and de-identified aggregate insights live in a separate on-prem relational database. This matches the two tiers' different retention rules (delete-at-next-cycle vs. keep-indefinitely) and access rules (HRBP-only vs. broader) with a clean, auditable boundary between them.
2. **Encryption: standard everywhere**, no extra defense-in-depth layer on the raw tier. Volume/disk-level encryption at rest for both object storage and database; TLS in transit for all connections (app ↔ storage, app ↔ database, browser ↔ app). Applied uniformly across both tiers.
3. **HRBP-only access: enforced at the storage layer**, not application logic alone. Object storage uses per-team ACLs/prefixes scoped to that team's HRBP identity (tied to whichever identity system A08/A04 land on); the database applies row-level security restricting raw-tier rows to the requesting HRBP's own team scope. This holds even if the application layer is bypassed.
4. **Retention: event-triggered deletion + immutable audit log.** Uploading a new cycle's file for a team immediately triggers deletion of that team's previous raw data — not a periodic sweep — since "until superseded" is precisely defined by the upload event itself. Every deletion is written to an immutable audit log (who/what/when) for compliance verification.

## Question

Given the hosting environment (A03), how and where are uploaded files (annual survey, pulse survey, exit data) and their derived analysis stored — what database/storage technology, what encryption at rest and in transit, and how is the content spec's "retain raw data until superseded by next cycle, then delete" rule (ticket 009) implemented as an actual automated mechanism rather than a manual promise? Also covers how the group-size-5 suppression/roll-up rule (ticket 009) is enforced at the data-access layer, not just in application logic that could be bypassed.
