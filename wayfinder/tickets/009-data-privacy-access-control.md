---
id: "009"
title: Data privacy & access control for sensitive HR inputs
labels: [wayfinder:grilling]
status: closed
assignee: current-session
blocked_by: []
---

## Resolution

1. **Raw individual comments (exit interviews, free-text survey responses) are visible to the HRBP only** (plus the AI's internal processing). Managers and anyone downstream never see raw text — only derived, de-identified insights. Rationale: the HRBP already has this access by definition (they uploaded it, likely conducted the interviews); extending raw visibility to managers risks employees self-censoring exit/survey feedback, which would poison the data source itself.
2. **Minimum group size of 5 before any slice is shown**, with graceful roll-up rather than hard suppression — a slice smaller than 5 (e.g., "0-1yr tenure engineers citing low autonomy") is silently rolled into the next-broader group (e.g., "0-3yr tenure") instead of being hidden outright or shown as-is. 5 matches common HR-analytics/survey-industry convention for balancing usefulness against re-identification risk in small teams.
3. **Raw data is retained until superseded by the next cycle** (i.e., until the following year's upload for that team), then deleted. De-identified aggregate themes/insights are retained indefinitely to support year-over-year trend comparison, without accumulating raw sensitive text.

## Question

The platform ingests genuinely sensitive HR data — exit-interview data includes named individuals' qualitative comments about why they left, plus employee details; the annual/pulse survey data may be identifiable at fine slicing granularity even if collected anonymously. What access controls, anonymization, and retention rules govern this data: can raw individual comments ever surface (to whom — HRBP only, manager, the AI's internal analysis only), must outputs be aggregated/de-identified before a manager or engineering team sees anything derived from them, and how long is uploaded data retained? This decision affects what the AI analysis layer is allowed to surface downstream (ticket 007, output shape) versus what it may only use internally to inform an initiative without exposing the source.
