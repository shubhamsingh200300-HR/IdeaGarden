# 04 — Request intake: manager context & constraints

**What to build:** An HRBP starts a generation request for one of their teams by entering the manager's free-text situational context and constraints (budget, time, headcount/logistics).

**Blocked by:** 01 (Foundation: Knox SSO + team model)

**Status:** implemented (commit ae8e82f)

**Implementation note:** built as `src/requests/*` — an encrypted, per-team `RequestIntakeStore` and two routes (submit, get-latest). 14 tests, all passing. The "assumption to confirm" checkbox is still genuinely open — the code documents the HRBP-relay assumption but it has not been confirmed with a stakeholder.

**Caught and fixed by code review:** `express.json()` was mounted globally in `app.ts`, so unauthenticated requests to any route got their body parsed before auth ran — the same class of gap ticket 03 fixed for file uploads, reintroduced here for JSON. Now scoped to just this route, after auth + team authorization. Also fixed: non-string constraint fields were silently coerced to empty string instead of rejected; and a duplicated authorization middleware was extracted to `src/teams/requireTeamAuthorization.ts`, shared with the upload routes.

- [ ] HRBP selects a team they're mapped to and enters free-text context (situational narrative) on the manager's behalf
- [ ] HRBP enters constraints the generator must respect: budget, time, and headcount/logistics limits
- [ ] No structured ratings are collected here (that's the survey's job, not this form's)
- [ ] **Assumption to confirm:** the content spec doesn't specify how manager input physically reaches the platform, since managers never use it directly. This ticket assumes the HRBP relays the manager's input during intake. If a separate manager-facing input surface is actually wanted, that's a different ticket — confirm before or during this work.
- [ ] A submitted request is associated with the correct team and is available to the generation step (ticket 06)
- [ ] Tests cover: a request with context + constraints submits successfully and is retrievable scoped to the correct team
