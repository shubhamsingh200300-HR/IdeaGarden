# Employee Engagement Idea Generator — Technical Architecture Spec

**Status:** Ready to build from, with two flagged open items (Section 8) and one pending confirmation (Section 6). Written for both an engineering team building this system and a security/data-privacy review — every design decision touching sensitive HR data states explicitly how it's enforced, not just what's intended.

**Builds on:** [`spec/content-spec.md`](content-spec.md) (product/content behavior — not revisited here).
**Full decision trail:** [`wayfinder/architecture-map.md`](../wayfinder/architecture-map.md) and its child tickets.

---

## 1. Hosting environment

**On-prem — mandatory, not a judgment call.** Samsung's data-residency policy requires on-prem hosting for this data class. The application, its data stores, and any model-serving components (embedding model, vector store) all run within Samsung's on-prem infrastructure. This is a hard constraint on every other architectural decision below.

## 2. LLM strategy

**Anonymize on-prem, then call cloud LLMs.** Both Claude Enterprise and Gemini Enterprise are approved and available for use. Data from uploaded files is anonymized/de-identified during on-prem ingestion (Section 3) *before* being sent to either provider for hybrid RAG generation (per content spec ticket 006) and free-text theme/sentiment extraction.

This resolves the apparent tension between "on-prem required" and "cloud LLM access": the on-prem mandate governs where raw, identifiable data is stored and processed. Anonymized data leaving the boundary for LLM processing is not the same data class the mandate protects.

**Not fixed here (build-time choices):** which specific model handles generation vs. analysis, or whether both providers are used for different tasks.

**Requires validation, not just assertion:** the anonymization method (Section 3) must hold up to actual scrutiny in the security review — "anonymized" needs to be demonstrated, not claimed.

## 3. File ingestion pipeline

Handles three upload types (annual survey required, pulse survey optional, exit/attrition data optional — all `.xlsx`), consistent with the content spec's "no fixed schema" commitment.

**3.1 Column classification** — a deterministic, on-prem, rule-based heuristic classifier: column-header keyword matching (e.g., "comment," "notes," "feedback" → free-text) combined with data-shape signals (string length, punctuation density, uniqueness ratio). No model call, fully auditable. Runs on the most sensitive, least-processed data, before anonymization — it must not require a cloud call or an opaque model.

**3.2 Anonymization** — on-prem NER model + regex, with confidence-based quarantine:
- Regex handles pattern-matchable PII (emails, phone numbers, employee IDs).
- An on-prem NER model flags likely person names/entities inline in free text.
- Rows where NER confidence is low are held back and flagged for the HRBP to manually review/clear, rather than auto-forwarding an uncertain automated judgment. No automated PII detector is claimed to be perfect; this quarantine step is the explicit backstop for that residual risk.

**3.3 Validation / error handling** — reject and report, not best-effort processing:
- Wrong file type, corrupted/unreadable, or empty files are rejected outright with a clear error naming the problem.
- Ambiguous column classifications are flagged for HRBP confirmation before processing continues.
- No silent guessing: a wrong guess on column type risks either missing PII scrubbing on a misclassified free-text column, or silently dropping data the HRBP expected analyzed.

## 4. Data storage & encryption

**4.1 Storage shape — split by sensitivity tier:**
- Raw uploaded files → on-prem object storage, tight and narrowly-scoped access controls.
- Derived structured data and de-identified aggregate insights → a separate on-prem relational database.

This separation matches the two tiers' different retention rules (delete-at-next-cycle vs. keep-indefinitely) and different access rules (HRBP-only vs. broader), with a clean, auditable boundary for the security review.

**4.2 Encryption — standard, applied uniformly:** volume/disk-level encryption at rest for both object storage and the database; TLS in transit for all connections (app ↔ storage, app ↔ database, browser ↔ app). No additional defense-in-depth layer on the raw tier beyond this baseline.

**4.3 Access enforcement — at the storage layer, not application code:**
- Object storage: per-team ACLs/prefixes scoped to the requesting HRBP's identity.
- Database: row-level security restricting raw-tier rows to the requesting HRBP's own team scope.
- This holds even if the application layer is bypassed — a deliberate defense against "the UI won't show it to you, but the database will if you query it directly," a standard security-review finding.
- Team scope for these checks resolves through the identity/authorization design in Section 6.

**4.4 Retention — event-triggered deletion + immutable audit log:** uploading a new cycle's file for a team immediately triggers deletion of that team's previous raw data (not a periodic sweep) — "until superseded" is precisely defined by the upload event itself. Every deletion writes to an immutable audit log (who/what/when).

## 5. RAG pipeline / vector store

**5.1 Vector store & embeddings — on-prem.** A self-hosted vector database and a locally-run open-source embedding model, consistent with Section 1's mandate covering "any model-serving components." Keeps retrieval queries (which incorporate a team's diagnosed signals, derived from real team data) from needing to leave the on-prem boundary.

**5.2 Retrieval scoping — filter by signal tag, then rank by similarity.** Narrow to benchmark-corpus entries (see [`wayfinder/research/benchmark-corpus.md`](../wayfinder/research/benchmark-corpus.md)) tagged with the same primary/secondary signal as the team's diagnosed issue first, then rank those by semantic similarity. Matches how the corpus is already organized and avoids retrieving text that reads similarly but addresses a different underlying signal.

**5.3 Corpus growth — semi-automated, agent-assisted, human-approved.** A research agent periodically proposes candidate new initiatives with sources, mirroring how the original 71-entry corpus was built; nothing is added without human review and approval. Re-indexing is event-triggered on each approved update — cheap given the corpus's small size, and keeps the vector store always consistent with no lag window.

## 6. Identity & access control

**6.1 Authentication — federates to Samsung Knox (Enterprise Knox Services) via OIDC.** OIDC is the default choice for a new application (simpler, widely supported by modern frameworks). **Pending confirmation:** this assumes Knox supports OIDC for this integration; if Knox only exposes SAML, the spec should be updated accordingly. Verify with whoever owns Knox integration before building.

**6.2 Team authorization — the platform maintains its own team-to-HRBP mapping table**, rather than querying an external Samsung HR system of record. This is buildable immediately without a new, unverified integration dependency; querying a real HRIS is a plausible v2 improvement once such a system's existence and accessibility are confirmed. The authenticated Knox identity resolves to a set of authorized teams via this table, and that resolved scope is what Section 4.3's ACLs/row-level security actually check.

## 7. Data flow summary

```
HRBP (Knox-authenticated) uploads .xlsx
        │
        ▼
On-prem ingestion pipeline
  ├─ Column classification (heuristic, on-prem)
  ├─ Anonymization (NER + regex, on-prem) ──▶ low-confidence rows quarantined for HRBP review
  └─ Validation ──▶ malformed/ambiguous files rejected & reported
        │
        ├──▶ Raw files → on-prem object storage (per-team ACL, encrypted, deleted on next-cycle upload)
        │
        └──▶ Anonymized data → Claude Enterprise / Gemini Enterprise
                  │                (analysis: theme/sentiment extraction on free text,
                  │                 slicing on structured columns)
                  ▼
        Derived/aggregate data → on-prem relational DB (row-level security, retained indefinitely)
                  │
                  ▼
        Hybrid RAG generation, grounded via on-prem vector store
        (retrieval: filter by signal tag → rank by similarity)
        against the benchmark corpus
                  │
                  ▼
        Top 3-5 ranked ideas → HRBP only (per content spec)
```

## 8. Open items — flagged, not resolved

These remain genuinely unspecified rather than force-fit into a decision:

- **Scalability/load design** — depends on rollout scope (how many HRBPs/teams will actually use this), which isn't known yet. Should be revisited once a rollout plan exists.
- **Formal audit logging / compliance certification requirements** beyond the retention audit log in Section 4.4 (e.g., broader access logging, formal certifications like ISO 27001/SOC 2 if required internally) — depends on requirements the security review itself may surface; not designed in this version.

## Out of scope

- Anything already decided in the content spec (product behavior, quality rubric, output shape) — this document is architecture only.
- Real HR-system-of-record integration for team authorization (Section 6.2) — deferred as a plausible v2 improvement.
