# 07 — Output display + regenerate

**What to build:** The HRBP sees the generated top 3-5 ideas as complete, actionable cards, and can request a fresh batch if none fit.

**Blocked by:** 06 (Idea generation: hybrid RAG + gate-then-rank)

**Status:** implemented (commit a18bdc0)

**Implementation note:** most JSON-API-level criteria were already satisfied by ticket 06. Added: `GeneratedIdeasStore` (persisted batch, no re-generation on page view), `runGeneration.ts` (shared orchestration between JSON API and HTML), `ideaPagesRoutes.ts` (the actual rendered card view + regenerate form with optional additional-context override), and a dashboard link to each team's ideas page. 24 new tests.

**Code review caught a real stored-XSS gap:** every idea field is escaped except `estimatedCostInr`, which bypasses `escapeHtml` since it's rendered via `toLocaleString()` — and the LLM response is parsed with a bare type assertion, not runtime validation, so this field isn't actually guaranteed to be a number at runtime. Fixed with a defensive `Number.isFinite` check (proven with a test using a malicious non-numeric value). Also factored a repeated authorization check into a shared page-level middleware.

**Disclosed, not fixed:** no CSRF token on the regenerate form — matches the pre-existing pattern on every other authenticated POST form in this codebase (dev-login, manager submission), not a new gap.

- [ ] Each idea displays exactly seven fields: title, description, signal addressed, structural format (cadence/day-to-day shape), suggested ownership & sponsorship level, estimated effort/cost (denominated in INR), and suggested success metric
- [ ] No confidence scores, raw rubric scores, or corpus attribution are shown to the HRBP
- [ ] Output is visible only to the requesting HRBP — never to the manager or any other role
- [ ] HRBP can trigger regeneration of a fresh batch, optionally after adjusting the original request's context/constraints (ticket 04)
- [ ] Tests cover: all seven fields render for each of the 3-5 ideas; cost displays in INR; regeneration produces a new batch without requiring a brand-new request from scratch
