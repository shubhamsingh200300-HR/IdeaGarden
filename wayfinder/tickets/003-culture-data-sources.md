---
id: "003"
title: Culture data sources — what exists and what's usable
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

Three data sources, each uploaded via its own dedicated upload path in the platform (separate buttons, not a single generic uploader):

1. **Annual culture survey** (required) — Excel, HRBP-uploaded, confirmed in ticket 002.
2. **Pulse survey results** (optional) — same tabular shape as the annual survey.
3. **Exit/attrition data** (optional) — `.xlsx` containing a mix of structured employee details (tenure, role, department, exit date) and free-text qualitative content (exit interview comments, HRBP/manager discussion notes).

No fixed schema or dimension list is defined for any source — the AI analysis layer dynamically works with whatever columns a given upload actually contains, rather than the spec hardcoding expected fields. This avoids the spec being invalidated the moment it meets a real export with different columns.

The AI analysis layer must handle **both** column types found across these sources: structured columns (slicing/filtering — by whatever dimensions exist, e.g. sub-team, tenure, role) and free-text columns (qualitative theme/sentiment extraction — e.g. surfacing that "career growth" or "recognition" recurs across exit comments). This dual capability is a single mechanism reused across all three sources, even though the sources have separate upload paths.

## Follow-on

Handling exit-interview data (named individuals, qualitative comments about why people left) surfaced a data-privacy/access-control question sharp enough to graduate out of the map's fog — see new ticket 009.

> **Context from ticket 002:** the HRBP-uploaded annual culture survey (Excel, AI-analyzed, sliceable by parameters) is already confirmed as one source. This ticket should establish whether other sources exist (attrition data, 1:1 notes, etc.) and pin down the concrete shape/parameters of the survey file itself.

## Question

What "culture data" actually exists today for Samsung R&D teams that this platform could ingest (pulse surveys, eNPS, attrition/exit interview themes, 1:1 notes, performance review sentiment, none of the above yet)? For each source that exists, is it accessible in a structured form, or would the spec need to assume manual/qualitative input instead? This decision fixes what the platform can realistically read as signal, independent of who provides direct stakeholder input (ticket 002).
