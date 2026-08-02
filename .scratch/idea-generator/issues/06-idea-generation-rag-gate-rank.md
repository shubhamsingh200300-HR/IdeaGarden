# 06 — Idea generation: hybrid RAG + gate-then-rank

**What to build:** Given a team's diagnosed signals, manager constraints, and retrieved corpus examples, the platform generates candidate initiatives, filters them through a hard gate, and ranks the survivors — producing the top 3-5.

**Blocked by:** 05 (Signal analysis), 02 (Benchmark corpus + on-prem retrieval), 10 (Manager input via tokenized invite link — supersedes 04's mechanism; a request must be `submitted`, not merely `pending`)

**Status:** implemented (commit 880be25)

**Implementation note:** built as `src/generation/*` — gate, rank (real text-similarity scoring, not arbitrary constants), an idea-generation LLM client, and orchestration wiring tickets 02/05/10 together via `POST /api/teams/:teamId/ideas/generate`. 33 tests, all passing.

**Two review rounds caught real issues, all fixed.** Most serious: the manager's context/constraints — submitted raw through ticket 10's public form, never scrubbed since the HRBP is meant to see the real text — flowed straight to this ticket's new external LLM call with zero anonymization, violating the "only anonymized data reaches the LLM" mandate ticket 03 already enforces elsewhere. Fixed by scrubbing at the LLM-call boundary (reusing ticket 03's `piiScrubber`), with low-confidence name candidates redacted outright rather than flagged, since no review workflow exists for manager context. Also fixed: ranking's "fit" and "precedent grounding" were arbitrary constants/proxies rather than real measurement — both now use actual text-similarity scoring; the self-reported feasibility score had no bounds check (a misbehaving value could dominate ranking) — now clamped; and LLM-call failures had no error handling — now a clean 502 instead of a leaked stack trace.

**Disclosed, not fixed:** the gate trusts several LLM-self-reported fields (recurrence, owner, sponsorship) with no cross-check against the idea's actual text — only the generic-perk keyword check is verified against real content.

- [ ] For a submitted request, the platform retrieves benchmark corpus examples scoped to the diagnosed signal(s) (via ticket 02's retrieval), then generates a tailored idea via LLM grounded in those examples — not a verbatim copy, not an ungrounded free generation
- [ ] Every candidate idea passes a hard gate before ranking: (1) addresses a specific, named signal from the diagnosed data, (2) is structural/recurring, not a one-off event, (3) has a defined owner and resourcing shape, (4) is not on the generic-perk exclusion list (outings, cake/birthday, swag, unstructured "fun" events)
- [ ] Ideas that fail the gate are discarded, not shown at any rank
- [ ] Gate-passing ideas are ranked by weighted criteria, highest weight first: fit to the diagnosed signal, feasibility against the manager's stated constraints, structural ambition, precedent grounding in the benchmark corpus
- [ ] The top 3-5 ranked ideas are produced per request
- [ ] Precedent grounding and raw rubric scores are computed but not exposed in any user-facing output
- [ ] Tests cover: a generic/gate-failing candidate never appears in output; a feasibility-violating idea ranks below a feasible one addressing the same signal; a request yields between 3 and 5 ideas when enough gate-passing candidates exist
