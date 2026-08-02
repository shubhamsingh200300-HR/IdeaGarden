# 03 — Survey ingestion pipeline

**What to build:** An HRBP uploads a `.xlsx` file (annual survey, required; pulse survey or exit/attrition data, optional) for one of their teams. The file is classified, anonymized, validated, and stored — end to end, with no fixed expected schema.

**Blocked by:** 01 (Foundation: Knox SSO + team model)

**Status:** implemented (commit fec481a)

**Implementation note:** built as `src/uploads/*` — xlsx parsing, column classification, PII scrubbing (regex + `compromise`-based local name detection with confidence quarantine), AES-256-GCM-encrypted raw/derived storage, audit-logged retention, and three per-source-type upload routes. 113 tests total, all passing.

**Caught and fixed by two-round code review:** the most serious was PII scrubbing only applying to free-text-classified columns, letting a short "Manager Name" or "Contact Phone" column leak raw PII into the supposedly de-identified derived tier — now regex redaction applies to every column and full name scrubbing applies to any identity-labeled header regardless of classification. Also fixed: a column-classifier bug where small row counts made a uniqueness signal unreliable; auth now runs before file buffering; oversized uploads return a clean 4xx instead of a 500; broadened phone-number regex.

**Disclosed, not fixed (residual limitations):** `compromise`'s name detection has real false negatives beyond just low-confidence cases — some names go entirely undetected; it only tags person names, not other entity types; the employee-ID regex format is an unconfirmed guess; encryption-in-transit is a deployment-layer (TLS) concern this code can't provide.

- [ ] HRBP can upload a `.xlsx` file for a specific team via a dedicated upload path per source type (annual survey / pulse survey / exit data — separate upload actions, not one generic uploader)
- [ ] Columns are classified as structured vs. free-text using a deterministic, on-prem, rule-based heuristic (header keywords + data-shape signals) — no fixed schema assumed, no model call for this step
- [ ] Free text is anonymized on-prem before anything is sent externally: regex for emails/phone/employee IDs, an on-prem NER model for inline names/entities
- [ ] Rows where NER confidence is low are quarantined and flagged for the HRBP to manually review/clear, not auto-forwarded
- [ ] Malformed files (wrong type, corrupted, empty) are rejected outright with a clear error; ambiguous column classifications are flagged for HRBP confirmation rather than guessed
- [ ] Raw files are stored in on-prem object storage with per-team access scoping; derived/structured data is stored separately in an on-prem database
- [ ] Standard encryption at rest and in transit applies to both storage tiers
- [ ] Uploading a new cycle's file for a team immediately triggers deletion of that team's previous raw data for the same source type, and the deletion is written to an immutable audit log
- [ ] Tests cover: a well-formed annual survey upload processes end-to-end; a malformed file is rejected with a clear error; a file with an ambiguous column is flagged rather than silently classified; uploading a second cycle's file deletes the first cycle's raw data and logs it
