# 10 — Manager input via tokenized invite link

**What to build:** Supersedes ticket 04's "HRBP relays manager input" mechanism. The HRBP triggers an invite for a team; the platform generates a unique, expiring, single-use link; the manager submits their own context and constraints directly through that link — no Knox login, no manager account. The HRBP no longer types anything into the request on the manager's behalf.

**Blocked by:** 04 (Request intake: manager context & constraints) — done; this changes its mechanism, not its stored shape (`GenerationRequest` scoped by team is still what ticket 06 reads).

**Status:** implemented (commit 47b25e1)

**Implementation note:** built as `src/requests/*` — `RequestIntakeStore`'s pending→submitted lifecycle (`createInvite`/`checkToken`/`submitByToken`), HRBP-facing invite/latest routes, and public token-gated manager routes. 35 tests, all passing.

**Code review caught a confirmed, exploitable path-traversal vulnerability** — the token (fully attacker-controlled on a public route) was used directly in a filesystem path join with no format validation; a crafted token could reach and decrypt an arbitrary sibling file. Proven with a test (plants a decoy file at the traversal target, asserts it's still rejected) and fixed by validating the token's exact expected shape before any filesystem use, plus a fail-safe try/catch as defense in depth. Also fixed: the "configurable expiry" checkbox was an unused parameter with no real config path — now wired through `MANAGER_INVITE_EXPIRY_MS`; and added a genuine end-to-end HTTP test since prior tests exercised the store and HTTP layer separately but never the full chain.

- [ ] HRBP triggers an invite for one of their mapped teams (e.g. `POST /api/teams/:teamId/requests/invite`); the platform creates a `pending` request and returns a link/token for the HRBP to send to the manager out-of-band (email/Slack — sending it is not this platform's job)
- [ ] The token is cryptographically random, single-use, and expires after a reasonable window (default 7 days; make it configurable, don't hardcode as unchangeable)
- [ ] An unauthenticated visitor with a valid, unexpired, unused token reaches a simple form (no login) to enter free-text context and constraints (budget/time/headcount) — same fields as ticket 04, just submitted by the manager instead of the HRBP
- [ ] Submitting the form fills in the pending request, marks it `submitted`, and invalidates the token so it can't be reused
- [ ] An invalid, expired, or already-used token shows a clear error, not a working form and not a stack trace
- [ ] The HRBP's existing retrieval (`GET /api/teams/:teamId/requests/latest`) reflects the request's status (`pending` vs `submitted`) so the HRBP can tell whether the manager has responded yet
- [ ] A `pending` (not yet submitted) request is not usable by generation (ticket 06) — only a `submitted` one has real context/constraints to generate from
- [ ] Tests cover: full invite → manager submits → HRBP sees submitted status; expired token rejected; already-used token rejected; invalid/unknown token rejected; a pending request can't be used for generation

## Note

This introduces a new kind of surface for this app: an unauthenticated-but-token-gated endpoint, distinct from every other route (all currently Knox/dev-login authenticated). Treat token validation with the same care as the auth middleware elsewhere — timing-safe comparison, no token-guessing surface (e.g. don't leak "expired" vs "not found" distinctions in ways that help enumerate valid tokens, though a clear user-facing error for each case is still fine).
