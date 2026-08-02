# 01 — Foundation: Knox SSO + team model

**What to build:** An HRBP can log in via Samsung Knox and land on a dashboard listing the team(s) they're mapped to. This is the foundation every other slice authenticates and scopes against.

**Blocked by:** None — can start immediately

**Status:** implemented (commits 61802bd, 0dbaa17) — all acceptance criteria met, no open flags

**Implementation note:** built as `src/app.ts` (Express) with `src/auth/*` (Knox OIDC client, session-based auth middleware, login/callback routes), `src/teams/*` (team mapping store, file-backed seed via `TEAM_MAPPINGS_PATH`, protected JSON API), and `src/pages/*` (rendered dashboard UI — `GET /` login link, `GET /dashboard` team list / empty state, XSS-escaped). 29 tests passing, typecheck clean. Two rounds of `/code-review` fixed: a missing ID-token issuer check, a hardcoded-empty mapping seed, and a duplicated inline auth check (factored into `requireAuthPage`).

**Confirmed decisions (previously open flags):** Knox integration uses the OIDC assumption as-is. The dashboard is a real rendered UI, not just a JSON API.

- [ ] HRBP authenticates via Samsung Knox using OIDC; a successful login reaches an authenticated dashboard
- [ ] **Caveat to verify first:** this assumes Knox supports OIDC for this integration. Confirm with whoever owns Knox integration before building — if Knox only exposes SAML, swap the auth flow accordingly and update this ticket
- [ ] A team-to-HRBP mapping table exists, maintained by the platform (not queried from an external HR system of record)
- [ ] An authenticated HRBP sees only the team(s) they're mapped to; an HRBP with no mapped teams sees an appropriate empty state
- [ ] Attempting to access a team not in the requester's mapping is denied
- [ ] Tests cover: successful login → dashboard, denied access to an unmapped team, empty-state for an HRBP with no teams
