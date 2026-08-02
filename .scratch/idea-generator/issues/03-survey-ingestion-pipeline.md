# 03 — Survey ingestion pipeline

**What to build:** An HRBP uploads a `.xlsx` file (annual survey, required; pulse survey or exit/attrition data, optional) for one of their teams. The file is classified, anonymized, validated, and stored — end to end, with no fixed expected schema.

**Blocked by:** 01 (Foundation: Knox SSO + team model)

**Status:** ready-for-agent

- [ ] HRBP can upload a `.xlsx` file for a specific team via a dedicated upload path per source type (annual survey / pulse survey / exit data — separate upload actions, not one generic uploader)
- [ ] Columns are classified as structured vs. free-text using a deterministic, on-prem, rule-based heuristic (header keywords + data-shape signals) — no fixed schema assumed, no model call for this step
- [ ] Free text is anonymized on-prem before anything is sent externally: regex for emails/phone/employee IDs, an on-prem NER model for inline names/entities
- [ ] Rows where NER confidence is low are quarantined and flagged for the HRBP to manually review/clear, not auto-forwarded
- [ ] Malformed files (wrong type, corrupted, empty) are rejected outright with a clear error; ambiguous column classifications are flagged for HRBP confirmation rather than guessed
- [ ] Raw files are stored in on-prem object storage with per-team access scoping; derived/structured data is stored separately in an on-prem database
- [ ] Standard encryption at rest and in transit applies to both storage tiers
- [ ] Uploading a new cycle's file for a team immediately triggers deletion of that team's previous raw data for the same source type, and the deletion is written to an immutable audit log
- [ ] Tests cover: a well-formed annual survey upload processes end-to-end; a malformed file is rejected with a clear error; a file with an ambiguous column is flagged rather than silently classified; uploading a second cycle's file deletes the first cycle's raw data and logs it
