# 05 — Signal analysis

**What to build:** Given a team's anonymized, ingested survey data, the platform analyzes it and surfaces a diagnosed-signals summary the HRBP can see.

**Blocked by:** 03 (Survey ingestion pipeline)

**Status:** implemented (commit 65123c8)

**Implementation note:** built as `src/analysis/*` — group-size-5 structured rollup, an LLM client (real + fake) for free-text theme/sentiment extraction, orchestration excluding quarantined rows end-to-end, and `GET /api/teams/:teamId/analysis`. 24 tests, all passing.

**Code review verified in code (not assumed):** quarantined rows never reach either the structured breakdown or the LLM call, proven with a test that a quarantined row's value doesn't leak even into the rollup bucket; only aggregate label/count/sentiment reach the response, no raw quote or individual value. One smell fixed: a hand-duplicated source-type list derived from a shared constant instead.

**Known deviations, disclosed:** small groups always roll up into one generic "Other" bucket rather than a semantically-adjacent "next broader group" — no fixed schema means there's no way to infer what's adjacent for an arbitrary column. Structured breakdowns and free-text themes are independent lists, not cross-tabulated to the same slice.

- [ ] Structured columns are sliced/filtered by whatever dimensions the upload actually contains (no fixed dimension list)
- [ ] Any slice smaller than 5 people is rolled up into the next-broader group rather than shown as-is or suppressed outright
- [ ] Free-text columns (survey comments, exit interview text) are analyzed for qualitative themes/sentiment
- [ ] Only anonymized data is sent to the external LLM (Claude Enterprise or Gemini Enterprise) for this analysis — raw pre-anonymization data never leaves the on-prem boundary
- [ ] HRBP sees a diagnosed-signals summary for the team (e.g., which signals score low, which themes recur in free text) tied to a specific slice, not a vague overall score
- [ ] Raw individual comments remain visible to the uploading HRBP only — this analysis surfaces derived, de-identified insights, not raw text, to anyone else
- [ ] Tests cover: a slice below the group-size-5 threshold is rolled up, not shown directly; a slice at or above 5 is shown as-is; free-text theme extraction surfaces a recurring theme from sample data
