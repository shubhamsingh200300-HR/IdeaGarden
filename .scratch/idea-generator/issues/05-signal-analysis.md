# 05 — Signal analysis

**What to build:** Given a team's anonymized, ingested survey data, the platform analyzes it and surfaces a diagnosed-signals summary the HRBP can see.

**Blocked by:** 03 (Survey ingestion pipeline)

**Status:** ready-for-agent

- [ ] Structured columns are sliced/filtered by whatever dimensions the upload actually contains (no fixed dimension list)
- [ ] Any slice smaller than 5 people is rolled up into the next-broader group rather than shown as-is or suppressed outright
- [ ] Free-text columns (survey comments, exit interview text) are analyzed for qualitative themes/sentiment
- [ ] Only anonymized data is sent to the external LLM (Claude Enterprise or Gemini Enterprise) for this analysis — raw pre-anonymization data never leaves the on-prem boundary
- [ ] HRBP sees a diagnosed-signals summary for the team (e.g., which signals score low, which themes recur in free text) tied to a specific slice, not a vague overall score
- [ ] Raw individual comments remain visible to the uploading HRBP only — this analysis surfaces derived, de-identified insights, not raw text, to anyone else
- [ ] Tests cover: a slice below the group-size-5 threshold is rolled up, not shown directly; a slice at or above 5 is shown as-is; free-text theme extraction surfaces a recurring theme from sample data
