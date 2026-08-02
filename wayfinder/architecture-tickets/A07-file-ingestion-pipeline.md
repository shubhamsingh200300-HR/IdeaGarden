---
id: "A07"
title: File ingestion pipeline
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

**1. Column classification:** a deterministic, on-prem heuristic/rule-based classifier — column-header keyword matching (e.g., "comment," "notes," "feedback" → free-text) combined with data-shape signals (string length, punctuation density, uniqueness ratio). No model call, fully auditable for the security review. Runs before anonymization, on the most sensitive/least-processed data, so it must not require a cloud call or an opaque model.

**2. Anonymization of free text:** on-prem NER model + regex, with confidence-based quarantine. Regex handles pattern-matchable PII (emails, phone numbers, employee IDs); an on-prem NER model flags likely person names/entities inline in prose. Rows where NER confidence is low are held back and flagged for the HRBP (who already has raw-data access per the content spec) to manually review/clear, rather than auto-forwarding an uncertain automated judgment. No automated PII detector is claimed to be perfect — the quarantine step is the honest backstop for that residual risk, which matters directly for the security review this spec is written for.

**3. Malformed/ambiguous files:** reject and report, not best-effort processing. Wrong file type, corrupted/unreadable, or empty files are rejected outright with a clear error naming the problem. Ambiguous column classifications are flagged for HRBP confirmation before processing continues — consistent with the PII quarantine pattern ("ask a human on uncertainty," never silently guess). Rejected specifically because a wrong guess on column type risks either missing PII scrubbing on a misclassified free-text column, or silently dropping data the HRBP expected analyzed — both worse than occasionally asking the HRBP to confirm a column or re-upload a cleaner file.

## Question

Given the content spec's "no fixed schema" commitment (ticket 003 of the content-spec map — the AI dynamically works with whatever columns an upload contains), how does the platform reliably parse arbitrary-schema `.xlsx`/`.csv` uploads across three source types (annual survey, pulse survey, exit data)? Covers validation (file size/format limits, malformed-file handling), how structured vs. free-text columns get distinguished automatically, and what happens when a file is ambiguous or fails to parse.
