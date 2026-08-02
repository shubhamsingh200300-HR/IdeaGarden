# 04 — Request intake: manager context & constraints

**What to build:** An HRBP starts a generation request for one of their teams by entering the manager's free-text situational context and constraints (budget, time, headcount/logistics).

**Blocked by:** 01 (Foundation: Knox SSO + team model)

**Status:** ready-for-agent

- [ ] HRBP selects a team they're mapped to and enters free-text context (situational narrative) on the manager's behalf
- [ ] HRBP enters constraints the generator must respect: budget, time, and headcount/logistics limits
- [ ] No structured ratings are collected here (that's the survey's job, not this form's)
- [ ] **Assumption to confirm:** the content spec doesn't specify how manager input physically reaches the platform, since managers never use it directly. This ticket assumes the HRBP relays the manager's input during intake. If a separate manager-facing input surface is actually wanted, that's a different ticket — confirm before or during this work.
- [ ] A submitted request is associated with the correct team and is available to the generation step (ticket 06)
- [ ] Tests cover: a request with context + constraints submits successfully and is retrievable scoped to the correct team
